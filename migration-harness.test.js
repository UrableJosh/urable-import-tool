// ---- minimal shims for the browser globals the module touches ----
const els={};
function el(id){ return els[id] || (els[id]={id,value:'',checked:false,innerHTML:'',textContent:'',
  disabled:false,style:{},children:[],scrollTop:0,scrollHeight:0,
  appendChild(c){this.children.push(c);}}); }
global.document={ getElementById:el, createElement:()=>({textContent:'',className:''}) };
global.alert=m=>{ LOG.alerts.push(m); };
const LOG={alerts:[],writes:[],reads:[]};
const API_SERVERS={production:'https://app.urable.com/api',dev:'https://dev-app.urable.com/api'};
global.XLSX={};global.Papa={};
const INDUSTRIES=['vehicleCare','lawnCare','flatGlass','other'];
function selectedIndustry(){ return 'vehicleCare'; }
function escHtml(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function cl(v){ return String(v==null?'':v).trim(); }
function matchKey(s){
  return cl(s).toLowerCase()
    .replace(/\s*\(\s*imported\s*\)\s*$/,'')
    .replace(/\s*\b(ad\s*on|add[\s-]*on|copy)\b\s*$/,'')
    .replace(/[^a-z0-9]+/g,' ').trim();
}

// ---- fake accounts ----
const SRC={
  customers:[
    {id:'c1',firstName:'Nick',lastName:'Roman',type:'person',status:'existing',
     emails:[{label:'Main',value:'ngroman95@gmail.com'}],
     phoneNumbers:[{label:'Mobile',value:'+12245673423'}],
     createdAt:1,updatedAt:2,businessRef:'biz/1',jobCount:7,loyaltyPoints:400},
    {id:'c2',firstName:'Dana',lastName:'Webb',type:'person',
     phoneNumbers:[{label:'Mobile',value:'(586) 709-2279'}],createdAt:1}
  ],
  items:[
    {id:'i1',customerRef:'businesses/x/customers/c1',name:'Black Honda Accord',type:'automotive',
     industry:'vehicleCare',year:'2019',make:'Honda',model:'Accord',color:'Black',createdAt:1},
    {id:'i2',customerRef:'businesses/x/customers/c2',name:'Kia Carnival',type:'automotive',industry:'vehicleCare'},
    {id:'i3',customerRef:'',name:'Orphan Vehicle',type:'automotive'}
  ],
  products:[
    {id:'p1',name:'Full Interior Detail',type:'service',categoryName:'Detailing Packages',taxable:true,
     prices:[{sku:'fid-coupe',label:'Coupe 2 Door',value:22900},{sku:'fid-lsuv',label:'Large SUV',value:29900}],
     createdAt:1,quickbooksId:'QB1'},
    {id:'p2',name:'Ceramic Coat Wheel Faces',type:'service',categoryName:'Ceramic Coatings',
     prices:[{sku:'ccwf-all',label:'All vehicles',value:10000}], checklist:['wash','tape']},
    {id:'p3',name:'Window Tint Front Doors',type:'service',categoryName:'Ceramic Coatings',
     prices:[{sku:'wt-1',label:'All vehicles',value:9000}]}
  ]
};
let DST={customers:[],items:[],products:[]};
let idSeq=0;

global.fetch=async(url,opts)=>{
  const method=(opts&&opts.method||'GET').toUpperCase();
  const isSrc=url.includes('/api/v1/')&&(opts.headers.Authorization==='Bearer SRCKEY');
  const store=isSrc?SRC:DST;
  const path=url.split('/api/v1/')[1].split('?')[0];
  if(method==='GET'){
    LOG.reads.push((isSrc?'src':'dst')+':'+path);
    return {ok:true,status:200,json:async()=>({success:true,data:store[path]||[]})};
  }
  if(isSrc) throw new Error('WROTE TO SOURCE — must never happen');
  const body=JSON.parse(opts.body);
  LOG.writes.push({path,body,at:Date.now()});
  const rec={id:'new'+(++idSeq),...body};
  // emulate the real API: GET /v1/items reports the owner as a customerRef path
  if(path==='items'&&rec.customerId){ rec.customerRef='businesses/y/customers/'+rec.customerId; delete rec.customerId; }
  DST[path].push(rec);
  return {ok:true,status:200,json:async()=>({success:true,data:rec})};
};





// ═══════════════════════════════════════════════════════════════════════════
// Account-to-account copy (API → API)
//
// Extending this to a non-Urable system means writing ONE object with the three
// methods below. Nothing else in this section knows where records come from:
//
//   { label, async customers(), async items(), async products() }
//
//     customers() -> [{ srcId, ...fields for POST /v1/customers }]
//     items()     -> [{ srcId, srcCustomerId, ...fields for POST /v1/items }]
//     products()  -> [{ srcId, ...fields for POST /v1/products }]
//
// Register it in MIGRATION_SOURCES and it appears in the dropdown. The
// destination is always Urable.
// ═══════════════════════════════════════════════════════════════════════════

const MIG_TIMEOUT_MS=60000;
const migNormPhone=v=>{let d=String(v||'').replace(/\D/g,'');return d.length===11&&d[0]==='1'?d.slice(1):d;};
const migNormNm=s=>String(s||'').trim().toLowerCase().replace(/\s+/g,' ');
const migNormVeh=s=>String(s||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
// GET /v1/items returns the owner as a customerRef path; a POST body carries a
// plain customerId. Read either, so matching can't silently miss and duplicate
// every vehicle on a re-run.
const migOwnerId=it=>String((it&&(it.customerRef||it.customerId))||'').split('/').pop();
// Industry belongs to the record, not to the CSV panel's dropdown. A lawn-care
// account copied with the vehicle-care default turns every property into a
// vehicle-shaped item, which is how yards came across wrong.
function migIndustryChoice(){
  const el=document.getElementById('migIndustry');
  const v=el&&el.value;
  return (v==='source'||INDUSTRIES.includes(v))?v:'source';
}
function migIndustryFor(rec,fallback){
  const c=migIndustryChoice();
  if(c!=='source') return c;
  const own=rec&&rec.industry;
  return INDUSTRIES.includes(own)?own:fallback;
}
const migTally=(list,fn)=>{const m={};for(const x of list){const k=fn(x)||'(none)';m[k]=(m[k]||0)+1;}return m;};
const migFmtTally=m=>Object.entries(m).sort((a,b)=>b[1]-a[1]).map(([k,n])=>k+' ×'+n.toLocaleString()).join(', ');

// A foreign source only carries the fields we know how to translate. A same-system
// source does NOT use this list — see `passthrough` below.
const MIG_FIELDS={
  customers:['firstName','lastName','companyName','type','status','origin','notes',
             'emails','phoneNumbers','locations','tags','birthday','preferredContact'],
  items:['name','type','industry','year','make','model','color','vin','licensePlate',
         'notes','size','subType','mileage'],
  products:['name','type','categoryName','description','taxable','prices','costs',
            'barcode','commissionRate','jobType','virtualShop','duration','notes']
};
// Server-owned or structural — never sent to the destination, never reported as a
// loss. `category`/`categoryRef` are the source account's own refs; the category
// travels as categoryName instead. `industry` is NOT here: it belongs to the
// record and must survive the copy.
const MIG_SERVER_FIELDS=new Set(['id','createdAt','updatedAt','deletedAt','createdBy','updatedBy',
  'customerRef','businessRef','ref','path','category','categoryRef','archived',
  'quickbooksId','searchTerms','jobCount','lastJobAt','balance','totalSpent','_highlightResult',
  'srcId','srcCustomerId']);

function migBase(which){
  const el=document.getElementById(which==='src'?'migSrcEnv':'migDstEnv');
  return API_SERVERS[el?el.value:'production'];
}
function migLog(msg,cls){
  const box=document.getElementById('migLog');
  box.style.display='block';
  const d=document.createElement('div');
  if(cls) d.className=cls;
  d.textContent=msg;
  box.appendChild(d); box.scrollTop=box.scrollHeight;
}
function migProgress(done,total,label){
  document.getElementById('migProgressWrap').style.display='block';
  const pct=total?Math.round(done/total*100):0;
  document.getElementById('migProgressFill').style.width=pct+'%';
  document.getElementById('migProgressText').textContent=label+' · '+done.toLocaleString()+' / '+total.toLocaleString();
}

// The source key is used for reads and nothing else. This is enforced here, not
// by convention: a non-GET against the source is a bug, and it would be a bug
// that writes to a customer's live account.
async function migFetch(base,path,opts,key,readOnly){
  const method=String((opts&&opts.method)||'GET').toUpperCase();
  if(readOnly&&method!=='GET') throw new Error('refusing '+method+' against the source account');
  const ac=new AbortController();
  const timer=setTimeout(()=>ac.abort(),MIG_TIMEOUT_MS);
  let res;
  try{
    res=await fetch(base+path,{...(opts||{}),signal:ac.signal,
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+key,...((opts&&opts.headers)||{})}});
  }catch(e){
    clearTimeout(timer);
    const timedOut=e&&e.name==='AbortError';
    if(method==='GET'&&(opts&&opts._try||0)<2){
      await new Promise(r=>setTimeout(r,2000));
      return migFetch(base,path,{...opts,_try:((opts&&opts._try)||0)+1},key,readOnly);
    }
    return {ok:false,status:0,body:{error:timedOut?'timed out after 60s':'network error: '+((e&&e.message)||'unknown')}};
  }
  clearTimeout(timer);
  if(res.status===429){
    await new Promise(r=>setTimeout(r,20000));
    if(((opts&&opts._try)||0)<3) return migFetch(base,path,{...opts,_try:((opts&&opts._try)||0)+1},key,readOnly);
    return {ok:false,status:429,body:{error:'rate limited after 3 waits'}};
  }
  let body=null; try{ body=await res.json(); }catch(e){}
  return {ok:res.ok,status:res.status,body};
}

async function migPageAll(base,key,path,onCount){
  const out=[]; let startAfter=null,last=null;
  for(let guard=0;guard<300;guard++){
    const q='/v1/'+path+'?limit=100'+(startAfter?'&startAfter='+encodeURIComponent(startAfter):'');
    const r=await migFetch(base,q,{},key,true);
    if(!r.ok||!r.body||!r.body.success) throw new Error('reading '+path+': '+((r.body&&r.body.error)||('HTTP '+r.status)));
    const data=r.body.data||[];
    out.push(...data);
    if(onCount) onCount(path,out.length);
    if(data.length<100) break;
    const next=data[data.length-1].id;
    if(next===last) throw new Error('reading '+path+': pagination cursor stopped advancing at '+out.length);
    last=next; startAfter=next;
  }
  return out;
}

// The API hands back a product's category as an internal reference
// (categoryRef) with no name attached, and exposes no categories collection on
// some accounts. The account's own Products/Services export DOES carry the
// names, so it can stand in as the naming source. Keyed on product id first
// (exact), then product name.
let migCatNames=null;   // {byProductId, byName, byRefTail}
function migLoadCatFile(file){
  const st=document.getElementById('migCatStatus');
  if(!file){ migCatNames=null; if(st) st.textContent=''; return; }
  const done=rows=>{
    const byProductId={},byName={};
    let n=0;
    for(const r of rows){
      const cat=String(r.Category||r.category||r['Product Category']||'').trim();
      if(!cat) continue;
      const id=String(r.ID||r.Id||r.id||'').trim();
      const nm=String(r.Name||r.name||'').trim();
      if(id) byProductId[id]=cat;
      if(nm) byName[matchKey(nm)]=cat;
      n++;
    }
    migCatNames=n?{byProductId,byName,byRefTail:{}}:null;
    if(st){ st.textContent=n?(n.toLocaleString()+' category names loaded'):'no Category column found';
            st.style.color=n?'var(--mint-darker)':'#dc2626'; }
  };
  const ext=file.name.split('.').pop().toLowerCase();
  const rd=new FileReader();
  if(ext==='xlsx'||ext==='xls'){
    rd.onload=e=>{ const wb=XLSX.read(e.target.result,{type:'array'});
      done(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:''})); };
    rd.readAsArrayBuffer(file);
  }else{
    rd.onload=e=>{ const text=new TextDecoder('utf-8').decode(e.target.result);
      done(Papa.parse(text,{header:true,skipEmptyLines:true}).data); };
    rd.readAsArrayBuffer(file);
  }
}

// Probe an endpoint that may not exist. Null means "not available", which is
// different from "empty" and must not be mistaken for it.
async function migTryPage(base,key,path){
  try{
    const r=await migFetch(base,'/v1/'+path+'?limit=100',{},key,true);
    if(!r.ok||!r.body||!r.body.success||!Array.isArray(r.body.data)) return null;
    return r.body.data;
  }catch(e){ return null; }
}

// Where a product's category actually lives differs by account and endpoint.
// Guessing one shape is what put an entire lawn-care catalog into a single
// bucket, twice. Resolve against every shape we've seen, say which one worked,
// and if none does, STOP rather than inventing "Uncategorized" for everything.
const migRefTail=p=>String(p.categoryRef||(p.category&&p.category.path)||'').trim().split('/').pop();
function migResolveCategory(p,byId){
  const direct=String(p.categoryName||'').trim();
  if(direct) return {name:direct,via:'categoryName'};
  const obj=p.category;
  if(obj&&typeof obj==='object'&&obj.name) return {name:String(obj.name).trim(),via:'category.name'};
  // some accounts carry a `categories` array of names or {name} objects
  if(Array.isArray(p.categories)&&p.categories.length){
    const first=p.categories[0];
    const nm=typeof first==='string'?first:(first&&first.name);
    if(nm&&String(nm).trim()&&!/^[A-Za-z0-9]{16,}$/.test(String(nm).trim()))
      return {name:String(nm).trim(),via:'categories[]'};
  }
  if(typeof obj==='string'&&obj.trim()){
    const hit=byId&&byId[obj.trim()];
    return hit?{name:hit,via:'category id lookup'}:{name:obj.trim(),via:'category (string)'};
  }
  for(const k of ['categoryId','productCategoryId']){
    const id=p[k]&&String(p[k]).trim();
    if(id&&byId&&byId[id]) return {name:byId[id],via:k+' lookup'};
  }
  const tail=migRefTail(p);
  if(tail&&byId&&byId[tail]) return {name:byId[tail],via:'categoryRef lookup'};
  // the account's own export, keyed on product id then product name
  if(migCatNames){
    const byId2=migCatNames.byProductId[String(p.id||'').trim()];
    if(byId2) return {name:byId2,via:'export file (product id)'};
    const byNm=migCatNames.byName[matchKey(p.name||'')];
    if(byNm) return {name:byNm,via:'export file (product name)'};
    if(tail&&migCatNames.byRefTail[tail]) return {name:migCatNames.byRefTail[tail],via:'categoryRef learned from export'};
  }
  return {name:'',via:null};
}

// Aggregate the field names actually present on a set of records. When a shape
// surprises us, this is what tells us how — instead of another round of guessing.
function migShape(list,n){
  const seen={};
  for(const r of list) for(const k of Object.keys(r||{})) seen[k]=(seen[k]||0)+1;
  return Object.entries(seen).sort((a,b)=>b[1]-a[1]).slice(0,n||40)
    .map(([k,c])=>k+(c<list.length?'('+c+')':'')).join(', ');
}

// Split a source record into what we copy and what we'd be dropping.
// passthrough: the source IS a Urable account, so its records are already in the
// destination's shape. Carrying everything is both more faithful and safer than
// an allowlist — a lawn-care property has fields no vehicle-shaped list would
// name, and an allowlist would quietly drop them.
function migPick(rec,allow,passthrough){
  const keep={},dropped=[];
  for(const k of Object.keys(rec||{})){
    if(MIG_SERVER_FIELDS.has(k)) continue;
    const v=rec[k];
    if(v==null||v===''||(Array.isArray(v)&&!v.length)) continue;
    if(passthrough||allow.includes(k)) keep[k]=v; else dropped.push(k);
  }
  return {keep,dropped};
}

function UrableSource(base,key,onCount){
  // NOTE the spread comes FIRST in every map below. With `...p` last, a key the
  // API returns as null (categoryName is one) overwrites the value computed
  // above it — which is exactly how a whole catalog ended up in one "Imported"
  // category instead of keeping its own.
  return {
    label:'Urable account',
    passthrough:true,          // already in the destination's shape
    async customers(){
      return (await migPageAll(base,key,'customers',onCount)).map(c=>({...c, srcId:c.id}));
    },
    async items(){
      return (await migPageAll(base,key,'items',onCount)).map(i=>({
        ...i, srcId:i.id, srcCustomerId:migOwnerId(i)}));
    },
    async products(){
      const raw=await migPageAll(base,key,'products',onCount);
      // categories may be their own collection referenced by id
      let byId=null; const probes=[];
      for(const ep of ['categories','productCategories','product-categories','products/categories',
                       'productCategory','serviceCategories']){
        const res=await migTryPage(base,key,ep);
        probes.push(ep+':'+(res===null?'n/a':res.length));
        if(res&&res.length){ byId={}; for(const c of res) byId[c.id]=String(c.name||c.categoryName||'').trim(); break; }
      }
      const resolve=()=>{
        const via={};
        const out=raw.map(p=>{
          const r=migResolveCategory(p,byId);
          via[r.via||'UNRESOLVED']=(via[r.via||'UNRESOLVED']||0)+1;
          return {...p, srcId:p.id, categoryName:r.name};
        });
        out._categoryVia=via;
        return out;
      };
      let out=resolve();
      // Second pass: every product we DID name teaches us what its categoryRef
      // means, which then names the products the export didn't cover.
      if(migCatNames&&out.some(p=>!p.categoryName)){
        let learned=0;
        for(let i=0;i<raw.length;i++){
          const tail=migRefTail(raw[i]);
          if(tail&&out[i].categoryName&&!migCatNames.byRefTail[tail]){ migCatNames.byRefTail[tail]=out[i].categoryName; learned++; }
        }
        if(learned) out=resolve();
      }
      out._categoriesEndpoint=byId?Object.keys(byId).length:0;
      out._probes=probes.join(', ');
      out._shape=migShape(raw);
      out._refCount=new Set(raw.map(migRefTail).filter(Boolean)).size;
      return out;
    }
  };
}
const MIGRATION_SOURCES={ urable:{ label:'Urable account', make:UrableSource } };

let migPlan=null;   // result of the last preview; Start copy refuses to run without one

async function migPreview(){ return migRun(true); }
async function migStart(){
  if(!migPlan){ alert('Run the preview first.'); return; }
  return migRun(false);
}

async function migRun(dry){
  const srcKey=document.getElementById('migSrcKey').value.trim();
  const dstKey=document.getElementById('migDstKey').value.trim();
  const doCust=document.getElementById('migDoCust').checked;
  const doVeh=document.getElementById('migDoVeh').checked;
  const doProd=document.getElementById('migDoProd').checked;
  const sBase=migBase('src'), dBase=migBase('dst');

  document.getElementById('migLog').innerHTML='';
  document.getElementById('migSummary').style.display='none';
  if(!srcKey||!dstKey){ alert('Both API keys are required.'); return; }
  if(srcKey===dstKey&&sBase===dBase){
    migLog('Source and destination are the same account — that would duplicate every record into itself. Stopped.',true&&'log-err'); return;
  }
  if(!doCust&&!doProd){ alert('Pick at least one thing to copy.'); return; }
  if(doVeh&&!doCust){ migLog('Vehicles need their customers — tick Customers as well.','log-err'); return; }

  const pBtn=document.getElementById('migPreviewBtn'), rBtn=document.getElementById('migRunBtn');
  pBtn.disabled=true; rBtn.disabled=true;
  const startedAt=Date.now();
  try{
    const src=MIGRATION_SOURCES[document.getElementById('migSrcType').value].make(sBase,srcKey,
      (p,n)=>migProgress(0,1,'Reading source '+p+' · '+n.toLocaleString()));
    migLog('Reading the source account…');

    const [sCust,sItems,sProds]=await Promise.all([
      doCust?src.customers():Promise.resolve([]),
      (doCust&&doVeh)?src.items():Promise.resolve([]),
      doProd?src.products():Promise.resolve([])
    ]);
    migLog('Source: '+sCust.length.toLocaleString()+' customers, '+sItems.length.toLocaleString()+' vehicles, '+sProds.length.toLocaleString()+' products/services.');

    migLog('Reading the destination account…');
    const [dCust,dItems,dProds]=await Promise.all([
      doCust?migPageAll(dBase,dstKey,'customers'):Promise.resolve([]),
      (doCust&&doVeh)?migPageAll(dBase,dstKey,'items'):Promise.resolve([]),
      doProd?migPageAll(dBase,dstKey,'products'):Promise.resolve([])
    ]);
    migLog('Destination already holds '+dCust.length.toLocaleString()+' customers, '+dItems.length.toLocaleString()+' vehicles, '+dProds.length.toLocaleString()+' products/services.');

    // ── match what the destination already has, on the same rules the file
    // imports use: identifier + name for people, name for catalog entries.
    const custIndex={};
    for(const c of dCust){
      const nm=migNormNm((c.firstName||'')+' '+(c.lastName||''));
      for(const p of (c.phoneNumbers||[])) { const k=migNormPhone(p.value)+'|'+nm; if(!custIndex[k]) custIndex[k]=c.id; }
      for(const e of (c.emails||[])) { const k=String(e.value||'').toLowerCase()+'|'+nm; if(!custIndex[k]) custIndex[k]=c.id; }
      if(nm&&!custIndex['|'+nm]) custIndex['|'+nm]=c.id;
    }
    const custKeysOf=c=>{
      const nm=migNormNm((c.firstName||'')+' '+(c.lastName||''));
      const ks=[];
      for(const p of (c.phoneNumbers||[])) ks.push(migNormPhone(p.value)+'|'+nm);
      for(const e of (c.emails||[])) ks.push(String(e.value||'').toLowerCase()+'|'+nm);
      ks.push('|'+nm);
      return ks;
    };
    const prodIndex={};
    for(const p of dProds){ const k=matchKey(p.name||''); if(k&&!prodIndex[k]) prodIndex[k]=p.id; }
    const existingCats=new Set(dProds.map(p=>String(p.categoryName||(p.category&&p.category.name)||'').trim().toLowerCase()).filter(Boolean));

    const idMap={};             // source customer id -> destination customer id
    const custToCreate=[], custMatched=[];
    for(const c of sCust){
      const hit=custKeysOf(c).map(k=>custIndex[k]).find(Boolean);
      if(hit){ idMap[c.srcId]=hit; custMatched.push(c); } else custToCreate.push(c);
    }
    const prodToCreate=[], prodMatched=[];
    for(const p of sProds){
      const k=matchKey(p.name||'');
      if(k&&prodIndex[k]) prodMatched.push(p); else prodToCreate.push(p);
    }
    const catsToCreate=[...new Set(prodToCreate
      .map(p=>(p.categoryName||'').trim()).filter(Boolean)
      .filter(c=>!existingCats.has(c.toLowerCase())))];

    // vehicles: only for customers that will exist, keyed within their owner
    const itemIndex=new Set();
    const dstIdToItems={};
    for(const it of dItems){
      const cid=migOwnerId(it);
      (dstIdToItems[cid]=dstIdToItems[cid]||[]).push(migNormVeh(it.name));
    }
    const itemsToCreate=[]; let itemsMatched=0, itemsOrphan=0;
    for(const it of sItems){
      const dstCust=idMap[it.srcCustomerId];
      if(!it.srcCustomerId){ itemsOrphan++; continue; }
      if(dstCust&&(dstIdToItems[dstCust]||[]).includes(migNormVeh(it.name))){ itemsMatched++; continue; }
      itemsToCreate.push(it);
    }

    // what would not carry across
    const lost={};
    const noteLost=(kind,dropped)=>{ for(const d of dropped){ const k=kind+'.'+d; lost[k]=(lost[k]||0)+1; } };
    const pass=!!src.passthrough;
    for(const c of custToCreate) noteLost('customer',migPick(c,MIG_FIELDS.customers,pass).dropped);
    for(const i of itemsToCreate) noteLost('vehicle',migPick(i,MIG_FIELDS.items,pass).dropped);
    for(const p of prodToCreate) noteLost('product',migPick(p,MIG_FIELDS.products,pass).dropped);

    // Industry and categories are the two things a cross-account copy gets wrong
    // quietly, so both are stated up front rather than discovered afterwards.
    const srcInd=migTally([...sCust,...sItems,...sProds],r=>r.industry);
    const dstInd=migTally([...dCust,...dItems,...dProds],r=>r.industry);
    const dstMain=Object.entries(dstInd).filter(([k])=>INDUSTRIES.includes(k)).sort((a,b)=>b[1]-a[1])[0];
    const fallbackInd=(dstMain&&dstMain[0])||'vehicleCare';
    const srcCats=[...new Set(sProds.map(p=>(p.categoryName||'').trim()).filter(Boolean))];
    const noCat=prodToCreate.filter(p=>!(p.categoryName||'').trim()).length;

    // How the category was found, and what the source records actually look
    // like. Both go in the log so a surprising shape is diagnosable from the
    // preview instead of from a wrongly-populated destination account.
    if(doProd&&sProds.length){
      const via=sProds._categoryVia||{};
      migLog('Category resolved via: '+(Object.keys(via).length?migFmtTally(via):'n/a')+
        (sProds._categoriesEndpoint?' · categories endpoint returned '+sProds._categoriesEndpoint+' categor(ies)':' · no categories collection')+
        (sProds._refCount?' · '+sProds._refCount+' distinct categoryRef(s) in the source':''));
      if(via.UNRESOLVED){
        migLog('Endpoint probes: '+(sProds._probes||''));
        migLog('Source product fields seen: '+(sProds._shape||''),'log-err');
      }
    }
    // Every product losing its category is not a copy — it is a flattening, and
    // the shop has to undo it by hand. Stop instead.
    const allUncategorised=doProd&&sProds.length>0&&srcCats.length===0;

    const pricePts=prodToCreate.reduce((n,p)=>n+((p.prices||[]).length),0);

    if(allUncategorised){
      migLog('Stopped: none of the '+sProds.length.toLocaleString()+' source products resolves to a category name. Nothing was written.','log-err');
      const sb=document.getElementById('migSummary');
      sb.style.display='block';
      sb.innerHTML='<strong style="color:#dc2626">Catalog copy stopped &mdash; nothing was written.</strong><br>'+
        'The API returns each product\u2019s category as an internal reference ('+
        (sProds._refCount||0)+' distinct one'+((sProds._refCount||0)===1?'':'s')+' here) and this account exposes no categories collection, so the names are not available over the API alone.'+
        '<div style="margin-top:10px"><strong>The fix takes a minute:</strong> in the <em>source</em> account open Products/Services &rarr; <strong>Export</strong>, then drop that file into <em>Category names</em> above and preview again. The export carries the real category names and is matched on product id, so the copy reproduces the source\u2019s categories exactly.</div>'+
        '<div style="margin-top:8px;font-size:12px;color:var(--lt-grey)">Flattening 92 services into one category would be worse than not copying them, which is why this stops instead.</div>';
      pBtn.disabled=false; rBtn.disabled=true; migPlan=null;
      return;
    }

    if(dry){
      migPlan={sCust,sItems,sProds};
      migLog('— preview only, nothing was written —','log-ok');
      const rows=[];
      if(doCust) rows.push('<strong>'+custToCreate.length.toLocaleString()+'</strong> customers created, '+custMatched.length.toLocaleString()+' already there');
      if(doCust&&doVeh) rows.push('<strong>'+itemsToCreate.length.toLocaleString()+'</strong> vehicles created, '+itemsMatched.toLocaleString()+' already there'+(itemsOrphan?', '+itemsOrphan+' with no owner (skipped)':''));
      if(doProd) rows.push('<strong>'+prodToCreate.length.toLocaleString()+'</strong> products/services created ('+pricePts.toLocaleString()+' price points, carried with their original SKUs), '+prodMatched.length.toLocaleString()+' matched by name');
      if(doProd&&sProds.length) rows.push('Category source: '+escHtml(migFmtTally(sProds._categoryVia||{})));
      if(doProd) rows.push('Categories are preserved exactly as the source has them &mdash; '+srcCats.length+' in the source'+
        (catsToCreate.length?', '+catsToCreate.length+' of which the destination does not have yet: '+escHtml(catsToCreate.slice(0,8).join(', '))+(catsToCreate.length>8?' +'+(catsToCreate.length-8)+' more':''):', all already present'));
      if(doProd&&noCat) rows.push('<span style="color:#b45309">'+noCat+' product(s) have no category in the source and will land in &ldquo;Uncategorized&rdquo;.</span>');
      const choice=migIndustryChoice();
      rows.push('Source industry: '+escHtml(migFmtTally(srcInd))+(Object.keys(dstInd).length?' &nbsp;·&nbsp; destination: '+escHtml(migFmtTally(dstInd)):''));
      if(choice==='source'){
        const sKeys=Object.keys(srcInd).filter(k=>INDUSTRIES.includes(k));
        const mismatch=sKeys.filter(k=>k!==fallbackInd);
        if(mismatch.length&&Object.keys(dstInd).length) rows.push('<span style="color:#b45309">These records keep their own industry ('+escHtml(mismatch.join(', '))+'), which differs from the destination\u2019s ('+escHtml(fallbackInd)+'). They will not show under the destination\u2019s industry unless you force one above.</span>');
      } else rows.push('<span style="color:#b45309">Every record will be forced to <strong>'+escHtml(choice)+'</strong>, overriding what the source says.</span>');
      const lostKeys=Object.keys(lost).sort();
      const sb=document.getElementById('migSummary');
      sb.style.display='block';
      sb.innerHTML='<strong>Preview — nothing written.</strong><br>'+rows.join('<br>')+
        (lostKeys.length?'<div style="margin-top:10px;color:#b45309"><strong>Would not carry across:</strong><br>'+
          lostKeys.map(k=>escHtml(k)+' &times;'+lost[k]).join('<br>')+
          '<br><span style="font-size:12px">These fields exist on the source records but this tool does not copy them yet.</span></div>':
          '<div style="margin-top:10px;color:var(--mint-darker)">Every field on the source records is carried across.</div>');
      rBtn.disabled=false; pBtn.disabled=false;
      return;
    }

    // ── write ──────────────────────────────────────────────────────────────
    let created={cust:0,veh:0,prod:0}, failed=0;
    const total=custToCreate.length+itemsToCreate.length+prodToCreate.length;
    let done=0;
    const tick=l=>migProgress(++done,total,l);
    const fail=(what,msg)=>{ failed++; migLog(what+': '+msg,'log-err'); };
    async function pool(list,n,fn){ let i=0; const w=async()=>{while(i<list.length){await fn(list[i++]);}};
      await Promise.all(Array.from({length:Math.min(n,list.length)},w)); }

    if(custToCreate.length){
      await pool(custToCreate,4,async c=>{
        const {keep}=migPick(c,MIG_FIELDS.customers,pass);
        if(!keep.firstName&&!keep.companyName) keep.firstName='Customer';
        if(!keep.type) keep.type='person';
        const r=await migFetch(dBase,'/v1/customers',{method:'POST',body:JSON.stringify(keep)},dstKey,false);
        if(r.ok&&r.body&&r.body.success){ idMap[c.srcId]=r.body.data.id; created.cust++; }
        else fail('customer '+((c.firstName||'')+' '+(c.lastName||'')).trim(),(r.body&&r.body.error)||('HTTP '+r.status));
        tick('Copying customers');
      });
      migLog(created.cust.toLocaleString()+' customers created.','log-ok');
    }

    if(itemsToCreate.length){
      await pool(itemsToCreate,4,async it=>{
        const cid=idMap[it.srcCustomerId];
        if(!cid){ fail('vehicle '+(it.name||''),'its customer was not created'); tick('Copying vehicles'); return; }
        const {keep}=migPick(it,MIG_FIELDS.items,pass);
        keep.customerId=cid;
        keep.industry=migIndustryFor(it,fallbackInd);
        if(!keep.name) keep.name='Item';
        const r=await migFetch(dBase,'/v1/items',{method:'POST',body:JSON.stringify(keep)},dstKey,false);
        if(r.ok&&r.body&&r.body.success) created.veh++;
        else fail('vehicle '+(it.name||''),(r.body&&r.body.error)||('HTTP '+r.status));
        tick('Copying vehicles');
      });
      migLog(created.veh.toLocaleString()+' vehicles created.','log-ok');
    }

    if(prodToCreate.length){
      // Urable mints a category on first use and does not dedupe concurrent
      // creates — four parallel POSTs naming one new category produce four
      // categories. One product per new category goes first, serially.
      const seen=new Set(), first=[], rest=[];
      for(const p of prodToCreate){
        const c=(p.categoryName||'Imported').trim().toLowerCase();
        if(seen.has(c)) rest.push(p); else { seen.add(c); first.push(p); }
      }
      const make=async p=>{
        const {keep}=migPick(p,MIG_FIELDS.products,pass);
        if(!keep.name){ tick('Copying services'); return; }
        keep.industry=migIndustryFor(p,fallbackInd);
        if(!keep.type) keep.type='service';
        // Never bucket a catalog into "Imported" — this is a clean copy, so the
        // source's own categories are the whole point. Only a product with no
        // category at all gets a home of our choosing.
        if(!keep.categoryName) keep.categoryName='Uncategorized';
        const r=await migFetch(dBase,'/v1/products',{method:'POST',body:JSON.stringify(keep)},dstKey,false);
        if(r.ok&&r.body&&r.body.success) created.prod++;
        else fail('product '+keep.name,(r.body&&r.body.error)||('HTTP '+r.status));
        tick('Copying services');
      };
      await pool(first,1,make);
      await pool(rest,4,make);
      migLog(created.prod.toLocaleString()+' products/services created.','log-ok');
    }

    const secs=Math.round((Date.now()-startedAt)/1000);
    const sb=document.getElementById('migSummary');
    sb.style.display='block';
    sb.innerHTML='<strong>Copy complete.</strong> '+
      created.cust.toLocaleString()+' customers · '+created.veh.toLocaleString()+' vehicles · '+
      created.prod.toLocaleString()+' products/services created in '+secs+'s.'+
      (failed?' <span style="color:#dc2626">'+failed+' record(s) failed — re-run to finish them; anything already copied is matched and skipped.</span>':
              ' Nothing failed. Re-running is safe: everything copied is matched and skipped.');
    migPlan=null; rBtn.disabled=true;
  }catch(e){
    migLog('Stopped: '+((e&&e.message)||e),'log-err');
  }finally{
    document.getElementById('migPreviewBtn').disabled=false;
  }
}



const LAWN={
  customers:[
    {id:'lc1',firstName:'Marta',lastName:'Reyes',type:'person',industry:'lawnCare',
     phoneNumbers:[{label:'Mobile',value:'+15551234567'}],createdAt:1}
  ],
  items:[
    // a lawn-care "item" is a PROPERTY, not a vehicle — none of the vehicle
    // fields exist, and these are the ones that were coming across undefined
    {id:'li1',customerRef:'businesses/z/customers/lc1',name:'14 Oak Ridge Ct',type:'property',
     industry:'lawnCare',lotSize:'0.42 acre',gateCode:'2244',serviceArea:'Front + back',
     address:{line1:'14 Oak Ridge Ct',city:'Holton',state:'MI'},createdAt:1}
  ],
  products:[
    {id:'lp1',name:'Weekly Mow',type:'service',categoryName:'Mowing',industry:'lawnCare',
     prices:[{sku:'mow-s',label:'Up to 1/4 acre',value:4500}]},
    // the killer case: the API returns categoryName EXPLICITLY null
    {id:'lp2',name:'Spring Cleanup',type:'service',categoryName:null,
     category:{name:'Seasonal'},industry:'lawnCare',
     prices:[{sku:'sc-1',label:'Standard',value:19900}]},
    {id:'lp3',name:'Fertilizer Treatment',type:'service',categoryName:'Turf Care',industry:'lawnCare',
     prices:[{sku:'fert-1',label:'Standard',value:7500}]}
  ]
};

// ---- run the scenarios ----
function setup(src='SRCKEY',dst='DSTKEY'){
  el('migSrcKey').value=src; el('migDstKey').value=dst;
  el('migSrcType').value='urable'; el('migIndustry').value='source';
  el('migSrcEnv').value='production'; el('migDstEnv').value='dev';
  el('migDoCust').checked=true; el('migDoVeh').checked=true; el('migDoProd').checked=true;
  el('migLog').children=[]; LOG.alerts=[];
}
(async()=>{
  console.log('=== 1. PREVIEW against an empty destination ===');
  setup(); await migPreview();
  console.log('   writes during preview:', LOG.writes.length, LOG.writes.length===0?'✓ read-only':'✗ WROTE');
  LOG.previewHtml=el('migSummary').innerHTML;
  console.log('   summary:', LOG.previewHtml.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim().slice(0,300));
  console.log('   Start enabled:', el('migRunBtn').disabled===false?'✓':'✗');

  console.log('\n=== 2. RUN the copy ===');
  await migStart();
  console.log('   customers created:',DST.customers.length,' vehicles:',DST.items.length,' products:',DST.products.length);
  console.log('   summary:', el('migSummary').innerHTML.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim().slice(0,220));

  const fid=DST.products.find(p=>p.name==='Full Interior Detail');
  console.log('   price SKUs carried verbatim:', JSON.stringify(fid.prices)===JSON.stringify(SRC.products[0].prices)?'✓':'✗ '+JSON.stringify(fid.prices));
  console.log('   server-owned fields stripped (no id/createdAt/quickbooksId in payload):',
    LOG.writes.every(w=>!('createdAt' in w.body)&&!('quickbooksId' in w.body)&&!('customerRef' in w.body))?'✓':'✗');
  const veh=DST.items.find(i=>i.name==='Black Honda Accord');
  const nick=DST.customers.find(c=>c.firstName==='Nick');
  console.log('   vehicle re-pointed at the NEW customer id:', migOwnerId(veh)===nick.id?'✓ '+migOwnerId(veh):'✗ '+JSON.stringify(veh));
  const nickDst=DST.customers.find(c=>c.firstName==='Nick');
  const ccwf=DST.products.find(p=>p.name==='Ceramic Coat Wheel Faces');
  console.log('   same-system fields carried, not dropped (loyaltyPoints, checklist):',
    nickDst.loyaltyPoints===400&&Array.isArray(ccwf.checklist)?'✓':'✗ '+JSON.stringify({l:nickDst.loyaltyPoints,c:ccwf.checklist}));
  console.log('   preview declared no losses:', /Every field on the source/.test(LOG.previewHtml)?'✓':'✗');
  console.log('   orphan vehicle skipped:', DST.items.length===2?'✓':'✗ '+DST.items.length);

  const catFirst=LOG.writes.filter(w=>w.path==='products').map(w=>w.body.categoryName);
  console.log('   category order (serial-first per category):', JSON.stringify(catFirst));

  console.log('\n=== 3. RE-RUN — idempotency ===');
  const before={c:DST.customers.length,i:DST.items.length,p:DST.products.length};
  setup(); await migPreview();
  console.log('   preview says:', el('migSummary').innerHTML.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim().slice(0,240));
  await migStart();
  console.log('   created on re-run — customers:',DST.customers.length-before.c,
              ' vehicles:',DST.items.length-before.i,' products:',DST.products.length-before.p,
              (DST.customers.length===before.c&&DST.items.length===before.i&&DST.products.length===before.p)?'✓ nothing duplicated':'✗ DUPLICATED');

  console.log('\n=== 4. GUARDS ===');
  DST={customers:[],items:[],products:[]};
  setup('SAME','SAME'); el('migDstEnv').value='production';
  await migPreview();
  const txt=el('migLog').children.map(c=>c.textContent).join(' | ');
  console.log('   same account refused:', /same account/.test(txt)?'✓':'✗ '+txt);
  setup(); el('migDoCust').checked=false; el('migDoVeh').checked=true;
  await migPreview();
  console.log('   vehicles-without-customers refused:',
    /Vehicles need their customers/.test(el('migLog').children.map(c=>c.textContent).join(' '))?'✓':'✗');
  console.log('\n=== 5. A DESTINATION FAILURE IS REPORTED, NOT SWALLOWED ===');
  DST={customers:[],items:[],products:[]};
  const realFetch=global.fetch;
  global.fetch=async(url,opts)=>{
    if((opts&&opts.method)==='POST'&&url.includes('/products')&&JSON.parse(opts.body).name==='Ceramic Coat Wheel Faces')
      return {ok:false,status:400,json:async()=>({success:false,error:'price sku already in use'})};
    return realFetch(url,opts);
  };
  setup(); await migPreview(); await migStart();
  const s5=el('migSummary').innerHTML.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
  console.log('   ', s5.slice(0,200));
  console.log('   failure counted:', /1 record\(s\) failed/.test(s5)?'✓':'✗');
  console.log('   named in the log:', el('migLog').children.some(c=>/Ceramic Coat Wheel Faces.*price sku/.test(c.textContent))?'✓':'✗');
  console.log('   other 2 products still copied:', DST.products.length===2?'✓':'✗ '+DST.products.length);
  global.fetch=realFetch;

  console.log('\n=== 6. LAWN CARE SOURCE — categories and industry must survive ===');
  const VEHDEST={customers:[],items:[],products:[
    {id:'d1',name:'Full Detail',industry:'vehicleCare',categoryName:'Detailing Packages'}]};
  DST=VEHDEST;
  const baseFetch=global.fetch;
  global.fetch=async(url,opts)=>{
    const method=(opts&&opts.method||'GET').toUpperCase();
    const isSrc=opts.headers.Authorization==='Bearer SRCKEY';
    const path=url.split('/api/v1/')[1].split('?')[0];
    if(method==='GET') return {ok:true,status:200,json:async()=>({success:true,data:(isSrc?LAWN:DST)[path]||[]})};
    if(isSrc) throw new Error('WROTE TO SOURCE');
    const body=JSON.parse(opts.body); LOG.writes.push({path,body});
    const rec={id:'n'+(++idSeq),...body};
    if(path==='items'&&rec.customerId){ rec.customerRef='c/'+rec.customerId; delete rec.customerId; }
    DST[path].push(rec); return {ok:true,status:200,json:async()=>({success:true,data:rec})};
  };
  setup(); el('migIndustry').value='source';
  LOG.writes=[]; await migPreview();
  const pv=el('migSummary').innerHTML.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ');
  console.log('   preview:', pv.slice(0,420));
  console.log('   preview declared no losses:', /Every field on the source/.test(el('migSummary').innerHTML)?'✓':'✗');
  await migStart();
  const cats=DST.products.filter(p=>p.id!=='d1').map(p=>p.categoryName).sort();
  console.log('   categories preserved:', JSON.stringify(cats),
    JSON.stringify(cats)===JSON.stringify(['Mowing','Seasonal','Turf Care'])?'✓':'✗ (Imported bucket bug)');
  console.log('   null categoryName recovered from category.name:', cats.includes('Seasonal')?'✓':'✗');
  const inds=[...new Set(DST.products.filter(p=>p.id!=='d1').map(p=>p.industry))];
  console.log('   industry kept as lawnCare:', JSON.stringify(inds), inds.length===1&&inds[0]==='lawnCare'?'✓':'✗');
  const prop=DST.items[0];
  console.log('   property fields carried (lotSize/gateCode/address):',
    prop.lotSize==='0.42 acre'&&prop.gateCode==='2244'&&prop.address?'✓':'✗ '+JSON.stringify(prop));
  console.log('   property industry:', prop.industry, prop.industry==='lawnCare'?'✓':'✗');


  console.log('\n=== 7. FORCE INDUSTRY overrides the source ===');
  DST={customers:[],items:[],products:[]};
  setup(); el('migIndustry').value='vehicleCare';
  await migPreview();
  console.log('   preview warns:', /forced to/.test(el('migSummary').innerHTML)?'✓':'✗');
  await migStart();
  console.log('   all products forced:', [...new Set(DST.products.map(p=>p.industry))].join(',')==='vehicleCare'?'✓':'✗');
  console.log('   categories STILL preserved when forcing industry:',
    JSON.stringify(DST.products.map(p=>p.categoryName).sort())===JSON.stringify(['Mowing','Seasonal','Turf Care'])?'✓':'✗');
  global.fetch=baseFetch;

  console.log('\n=== 8. CATEGORY SHAPES the API might return ===');
  const shapes={
    'categoryName (plain)':      [{id:'a',name:'A',categoryName:'Mowing',prices:[]}],
    'category.name object':      [{id:'a',name:'A',categoryName:null,category:{name:'Mowing'},prices:[]}],
    'category as a string id':   [{id:'a',name:'A',category:'cat1',prices:[]}],
    'categoryId + collection':   [{id:'a',name:'A',categoryId:'cat1',prices:[]}],
    'categoryRef path':          [{id:'a',name:'A',categoryRef:'businesses/b/categories/cat1',prices:[]}],
    'NOTHING resolvable':        [{id:'a',name:'A',someOtherField:1,prices:[]}]
  };
  for(const [label,prods] of Object.entries(shapes)){
    DST={customers:[],items:[],products:[]};
    const CATS=[{id:'cat1',name:'Mowing'}];
    global.fetch=async(url,opts)=>{
      const method=(opts&&opts.method||'GET').toUpperCase();
      const isSrc=opts.headers.Authorization==='Bearer SRCKEY';
      const path=url.split('/api/v1/')[1].split('?')[0];
      if(method==='GET'){
        if(path==='categories') return isSrc?{ok:true,status:200,json:async()=>({success:true,data:CATS})}
                                           :{ok:true,status:200,json:async()=>({success:true,data:[]})};
        if(path==='productCategories'||path==='product-categories') return {ok:false,status:404,json:async()=>({success:false})};
        const d=isSrc?{customers:[],items:[],products:prods}:DST;
        return {ok:true,status:200,json:async()=>({success:true,data:d[path]||[]})};
      }
      if(isSrc) throw new Error('WROTE TO SOURCE');
      const body=JSON.parse(opts.body);
      DST[path].push({id:'n'+(++idSeq),...body});
      return {ok:true,status:200,json:async()=>({success:true,data:{id:'n'+idSeq}})};
    };
    setup(); el('migDoCust').checked=false; el('migDoVeh').checked=false; el('migDoProd').checked=true;
    await migPreview();
    const html=el('migSummary').innerHTML;
    const stopped=/Catalog copy stopped/.test(html);
    if(!stopped) await migStart();
    const got=DST.products.map(p=>p.categoryName);
    const ok = label==='NOTHING resolvable' ? (stopped && DST.products.length===0)
                                            : (JSON.stringify(got)===JSON.stringify(['Mowing']));
    console.log('   '+label.padEnd(28)+' -> '+(stopped?'STOPPED (nothing written)':JSON.stringify(got))+'  '+(ok?'✓':'✗'));
  }
  global.fetch=baseFetch;

  console.log('\n=== 9. THE REAL SHAPE from the lawn-care account (categoryRef, no categories endpoint) ===');
  // exactly what the preview reported: categoryRef present, every probe 404s
  const REALP=[
    {id:'P1',name:'Plant Installation',categoryRef:'businesses/b/categories/CAT_HARD',prices:[{sku:'s1',label:'Std',value:0}],description:'Installation of plants in garden beds',industry:'lawnCare',type:'service'},
    {id:'P2',name:'Gravel Patio',categoryRef:'businesses/b/categories/CAT_HARD',prices:[],industry:'lawnCare',type:'service'},
    {id:'P3',name:'Weekly Mow',categoryRef:'businesses/b/categories/CAT_MOW',prices:[{sku:'s3',label:'Std',value:4500}],industry:'lawnCare',type:'service'},
    // not present in the export file — must be named by the learned ref mapping
    {id:'P4',name:'Bed Edging',categoryRef:'businesses/b/categories/CAT_HARD',prices:[],industry:'lawnCare',type:'service'}
  ];
  const mkFetch=()=>async(url,opts)=>{
    const method=(opts&&opts.method||'GET').toUpperCase();
    const isSrc=opts.headers.Authorization==='Bearer SRCKEY';
    const path=url.split('/api/v1/')[1].split('?')[0];
    if(method==='GET'){
      if(/categor/i.test(path)) return {ok:false,status:404,json:async()=>({success:false,error:'not found'})};
      const d=isSrc?{customers:[],items:[],products:REALP}:DST;
      return {ok:true,status:200,json:async()=>({success:true,data:d[path]||[]})};
    }
    if(isSrc) throw new Error('WROTE TO SOURCE');
    const body=JSON.parse(opts.body); DST[path].push({id:'n'+(++idSeq),...body});
    return {ok:true,status:200,json:async()=>({success:true,data:{id:'n'+idSeq}})};
  };

  DST={customers:[],items:[],products:[]};
  global.fetch=mkFetch(); migCatNames=null;
  setup(); el('migDoCust').checked=false; el('migDoVeh').checked=false;
  await migPreview();
  console.log('   without the export: stopped rather than flattening:',
    /Catalog copy stopped/.test(el('migSummary').innerHTML)&&DST.products.length===0?'✓':'✗');
  console.log('   halt message names the fix:',
    /Products\/Services.*Export/i.test(el('migSummary').innerHTML)?'✓':'✗');

  // now supply the source account's own export — only 3 of the 4 products listed
  migCatNames={byProductId:{P1:'Hardscaping',P2:'Hardscaping',P3:'Mowing'},
               byName:{},byRefTail:{}};
  DST={customers:[],items:[],products:[]};
  global.fetch=mkFetch();
  setup(); el('migDoCust').checked=false; el('migDoVeh').checked=false;
  await migPreview();
  console.log('   with the export, preview proceeds:', !/Catalog copy stopped/.test(el('migSummary').innerHTML)?'✓':'✗');
  await migStart();
  const got={}; for(const p of DST.products) got[p.name]=p.categoryName;
  console.log('   categories:', JSON.stringify(got));
  console.log('   named from the export:', got['Plant Installation']==='Hardscaping'&&got['Weekly Mow']==='Mowing'?'✓':'✗');
  console.log('   4th product named by the LEARNED categoryRef mapping:',
    got['Bed Edging']==='Hardscaping'?'✓ (not in the export, still correct)':'✗ '+got['Bed Edging']);
  console.log('   nothing landed in Uncategorized:', !Object.values(got).includes('Uncategorized')?'✓':'✗');
  migCatNames=null; global.fetch=baseFetch;

  let threw=false;
  try{ await migFetch('https://x/api','/v1/customers',{method:'POST',body:'{}'},'SRCKEY',true); }catch(e){ threw=/refusing POST/.test(e.message); }
  console.log('   write against source blocked at the transport:', threw?'✓':'✗');
})();
