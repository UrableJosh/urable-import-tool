const {chromium}=require('playwright');
const fs=require('fs');
const S='/root/work/samples';
const OUT='/root/work/shots';
const FRAME={width:1568,height:726};
const HOTS={};

// Stand-in wordmark: app.urable.com is unreachable from this sandbox.
const LOGO=`<svg xmlns="http://www.w3.org/2000/svg" width="150" height="34" viewBox="0 0 150 34">
<text x="0" y="26" font-family="Roboto,Helvetica,sans-serif" font-size="27" font-weight="500">
<tspan fill="#1D9E75">Ur</tspan><tspan fill="#9a9a9a">able</tspan></text></svg>`;

// Centre the subject in the frame rather than eyeballing scroll offsets:
// put the element's top at `anchor` (fraction of viewport height).
const shot=async(p,name,sel,{anchor=0.22,full=false,hot=null}={})=>{
  if(sel){
    await p.locator(sel).first().scrollIntoViewIfNeeded();
    await p.waitForTimeout(200);
    await p.evaluate(([s,a,h])=>{
      const el=document.querySelector(s);
      if(!el) return;
      const top=el.getBoundingClientRect().top+window.scrollY;
      window.scrollTo(0,Math.max(0,Math.round(top-h*a)));
    },[sel,anchor,FRAME.height]);
    await p.waitForTimeout(250);
  }
  await p.screenshot({path:`${OUT}/${name}.png`,fullPage:full});
  if(hot){
    // hotspot as a % of the captured frame, read straight off the DOM
    const hs=await p.evaluate(([h,w,ht])=>{
      const el=document.querySelector(h); if(!el) return null;
      const r=el.getBoundingClientRect();
      return [ +(((r.left+r.width/2)/w)*100).toFixed(1),
               +(((r.top+r.height/2)/ht)*100).toFixed(1) ];
    },[hot,FRAME.width,FRAME.height]);
    if(hs) HOTS[name]=hs;
    console.log('  shot',name,'hs',JSON.stringify(hs));
  } else console.log('  shot',name);
};

(async()=>{
  const b=await chromium.launch();
  const p=await b.newPage({viewport:FRAME,deviceScaleFactor:2});
  await p.route('**cdnjs.cloudflare.com/**/xlsx.full.min.js',r=>r.fulfill({path:'/root/work/node_modules/xlsx/dist/xlsx.full.min.js',contentType:'application/javascript'}));
  await p.route('**cdnjs.cloudflare.com/**/papaparse.min.js',r=>r.fulfill({path:'/root/work/node_modules/papaparse/papaparse.min.js',contentType:'application/javascript'}));
  await p.route('**fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));
  await p.route('**app.urable.com/assets/images/urable_logo.svg',r=>r.fulfill({contentType:'image/svg+xml',body:LOGO}));
  const load=async()=>{await p.goto('file:///root/work/cap.html',{waitUntil:'load'});await p.waitForTimeout(900);};
  const inputs=async()=>await p.locator('.drop-zone input[type=file]').all();

  // ── Part A · customers → CSV
  await load();
  await shot(p,'step-01',null,{hot:'.drop-zone'});
  let ins=await inputs();
  await ins[0].setInputFiles(`${S}/Client List - Sunset Auto Spa.csv`);
  await p.waitForTimeout(1800);
  await shot(p,'step-02','.detected.show',{anchor:0.30,hot:'.detected.show .det-stats'});
  await shot(p,'step-03','#tableWrap',{anchor:0.22,hot:'#tableWrap'});
  await shot(p,'step-04','.mode-tabs',{anchor:0.35,hot:'#panelCsv .btn'});

  // ── Part B · column mapper
  await load();
  ins=await inputs();
  await ins[0].setInputFiles(`${S}/sunset-clients-legacy-system.csv`);
  await p.waitForTimeout(1800);
  const hasMapper=await p.locator('#mapperCard').isVisible().catch(()=>false);
  console.log('  mapper visible:',hasMapper);
  if(hasMapper){
    await shot(p,'step-05','#mapperCard',{anchor:0.14,hot:'#mapperCard h2'});
    await shot(p,'step-06','#mapperCard',{anchor:-0.20,hot:'#mapperCard .map-row:nth-of-type(9) select, #mapperCard select'});
    await shot(p,'step-07','#mapperCard',{anchor:-0.62,hot:'#unmappedToNotes'});
    const applyBtn=p.locator('button',{hasText:'Apply mapping'}).first();
    await applyBtn.click();
    await p.waitForTimeout(1500);
    await shot(p,'step-08','#tableWrap',{anchor:0.22,hot:'#tableWrap'});
  }

  // ── Part C · direct API import
  await load();
  ins=await inputs();
  await ins[0].setInputFiles(`${S}/Client List - Sunset Auto Spa.csv`);
  await p.waitForTimeout(1800);
  await p.locator('#tabApi').click();
  await p.waitForTimeout(500);
  await shot(p,'step-09','#panelApi',{anchor:0.30,hot:'#apiKey'});
  await shot(p,'step-10','#panelApi',{anchor:0.02,hot:'#panelApi .btn'});

  // ── Part D · products & jobs
  await load();
  ins=await inputs();
  await ins[1].setInputFiles(`${S}/Sunset Auto Spa - Service Menu.csv`);
  await p.waitForTimeout(1800);
  const detP=await p.locator('.detected.show').first().innerText().catch(()=>'(none)');
  console.log('  products detected:',detP.replace(/\n/g,' | '));
  await shot(p,'step-11','.detected.show',{anchor:0.30,hot:'.detected.show .det-stats'});
  await shot(p,'step-12','#tableWrap',{anchor:0.22,hot:'#tableWrap'});

  await load();
  ins=await inputs();
  await ins[2].setInputFiles(`${S}/Sunset Auto Spa - Jobs Export.csv`);
  await p.waitForTimeout(2200);
  const detJ=await p.locator('.detected.show').first().innerText().catch(()=>'(none)');
  const errJ=await p.locator('.error-box.show').first().innerText().catch(()=>'');
  console.log('  jobs detected:',detJ.replace(/\n/g,' | '),'| err:',errJ.slice(0,90));
  await shot(p,'step-13','.detected.show',{anchor:0.30,hot:'.detected.show .det-stats'});
  await shot(p,'step-14','#tableWrap',{anchor:0.22,hot:'#tableWrap'});
  await p.locator('#tabApi').click();
  await p.waitForTimeout(500);
  await shot(p,'step-15','#panelApi',{anchor:0.05,hot:'#createCatalog'});

  fs.writeFileSync('/root/work/hotspots.json',JSON.stringify(HOTS,null,1));
  await b.close();
})().catch(e=>{console.log('ERR',e.message);process.exit(1);});
