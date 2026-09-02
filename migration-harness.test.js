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
// Account-to-account copy — LOADED FROM index.html, not duplicated here.
//
// This file used to carry its own copy of the ~540 lines below. That copy could
// drift from the shipped tool and keep passing, which is a test that proves
// nothing. Instead we lift the account-copy section straight out of index.html
// and evaluate it against the shims above, so what is tested is what ships.
// ═══════════════════════════════════════════════════════════════════════════

const __fs = require('fs');
const __html = __fs.readFileSync(__dirname + '/index.html', 'utf8');
const __script = __html.match(/<script>([\s\S]*?)<\/script>/)[1];

// Take everything from the account-copy banner to the end of migRun. Anything
// the section needs from earlier in the file is already shimmed above.
const __from = __script.indexOf('const MIG_TIMEOUT_MS');
const __endMark = '\nasync function migRun(dry){';
const __runAt = __script.indexOf(__endMark);
if (__from < 0 || __runAt < 0) {
  console.error('Could not locate the account-copy section in index.html.');
  console.error('If it was renamed or moved, update the markers in this file.');
  process.exit(1);
}
// walk to the closing brace of migRun
let __d = 0, __i = __script.indexOf('{', __runAt + __endMark.length - 1);
const __bodyStart = __i;
do { const ch = __script[__i]; if (ch === '{') __d++; else if (ch === '}') __d--; __i++; } while (__d > 0);
const __section = __script.slice(__from, __i);

// Evaluate it in this module's scope, exporting the names the scenarios use.
const __names = ['migRun','migPreview','migStart','migFetch','migPageAll','migResolveCategory',
  'migPick','migIndustryFor','migIndustryChoice','UrableSource','migTryPage','migShape',
  'migLoadCatFile','migOwnerId','MIGRATION_SOURCES','MIG_FIELDS','migRefTail'];
const __exported = new Function('document','alert','fetch','XLSX','Papa','API_SERVERS',
  'INDUSTRIES','selectedIndustry','escHtml','cl','matchKey',
  __section + '\nreturn {' + __names.map(n => n + ':typeof ' + n + '!=="undefined"?' + n + ':undefined').join(',') + ', set migCatNamesSet(v){ migCatNames=v; }};'
)(global.document, global.alert, (...a) => global.fetch(...a), global.XLSX, global.Papa,
  API_SERVERS, INDUSTRIES, selectedIndustry, escHtml, cl, matchKey);

const { migRun, migPreview, migStart, migFetch, migOwnerId } = __exported;
// migCatNames lives inside the evaluated scope; the scenarios set it through here
Object.defineProperty(global, 'migCatNames', { set(v){ __exported.migCatNamesSet = v; }, get(){ return undefined; }, configurable:true });

console.log('loaded the account-copy section from index.html (' + __section.length + ' chars)\n');

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
