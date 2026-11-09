import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const base=process.env.BABYLON_CHECK_URL??'http://localhost:8088';
const cdp=process.env.BABYLON_CDP??'http://127.0.0.1:9238';
const target=await(await fetch(cdp+'/json/new?about:blank',{method:'PUT'})).json();
const socket=new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
let id=0;const pending=new Map(),errors=[];
socket.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description??m.params.exceptionDetails.text);const p=pending.get(m.id);if(p){pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}});
const send=(method,params={})=>new Promise((resolve,reject)=>{const key=++id,timer=setTimeout(()=>reject(Error(method+' timed out')),120000);pending.set(key,{resolve,reject,timer});socket.send(JSON.stringify({id:key,method,params}));});
const evaluate=async expression=>{const result=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description??result.exceptionDetails.text);return result.result.value;};
const report={batches:[],errors};
try{
await send('Runtime.enable');await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
await send('Page.navigate',{url:base});await new Promise(r=>setTimeout(r,3000));
await evaluate(`(async()=>{const {BabylonMatchViewer}=await import('/src/match-viewer/BabylonMatchViewer.ts');const {PAINTED_ROSTER_ART}=await import('/src/match-viewer/paintedRosterArt.ts');window.ArtViewer=BabylonMatchViewer;window.artIds=Object.keys(PAINTED_ROSTER_ART);window.artHost=document.createElement('div');window.artHost.style.cssText='position:fixed;inset:0;z-index:99999';document.body.append(window.artHost);})()`);
for(let batch=0;batch<9;batch++){
 await evaluate(`(async()=>{window.artViewer?.dispose();const ids=window.artIds.slice(${batch}*5,${batch+1}*5);window.artViewer=await window.ArtViewer.create(window.artHost,2600,1440,0,2600,()=>{});window.artSnapshot={tick:300,second:10,actors:[...ids,...ids].map((heroId,i)=>({id:'a'+i,heroId,label:heroId,x:900+(i%5)*200,y:i<5?650:900,hp:100,maxHp:100,alive:true,facing:i<5?1:-1,team:i<5?'blue':'red',kind:'champion',motion:{state:'walk',stateSince:9,vx:100,vy:0,attackTimer:0}})),effects:ids.flatMap((heroId,i)=>['passive','skill1','skill2','ultimate'].map((slot,j)=>({id:'token:'+i+':'+j,heroId,slot,kind:'impact',x:850+i*200+j*26,y:800,radius:16,color:'#ffffff',age:0}))),constructs:ids.includes('c_invoker')?['seam','shelter','pocket','bridge','pleat','serrated','hem','waltz','cutout','canopy'].map((kind,i)=>({id:'page:'+i,kind,heroId:'c_invoker',slot:'ultimate',owner:'a0',x:850+i*105,y:1040,radius:16,angle:0,team:'blue',hp:2,maxHp:2,created:280,expires:600,disabledUntil:0,attackable:true,points:[]})):[]};window.artFrozen=JSON.stringify(window.artSnapshot);window.artViewer.loadSnapshot(window.artSnapshot);window.artLoop=setInterval(()=>window.artViewer.draw(1300,800,2),50);})()`);
 let state;
 for(let n=0;n<100;n++){state=await evaluate(`(()=>{window.artViewer.draw(1300,800,2);return window.artViewer.diagnostics();})()`);if(state.sprites.length===10&&state.sprites.every(s=>s.ready)&&state.abilityArt.visible>=20&&state.abilityArt.visible===state.abilityArt.tokens)break;await new Promise(r=>setTimeout(r,200));}
 assert.equal(state.sprites.length,10);assert.ok(state.sprites.every(s=>s.ready),JSON.stringify(state));assert.ok(state.abilityArt.visible>=20&&state.abilityArt.visible===state.abilityArt.tokens,JSON.stringify(state));assert.deepEqual(state.abilityArt.failed,[]);
 assert.equal(await evaluate('window.artFrozen===JSON.stringify(window.artSnapshot)'),true);report.batches.push(state);
 if(batch===6)await writeFile('../docs/arena-2d/ability-drawings-v1/renderer-fixture.png',Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
 await evaluate('clearInterval(window.artLoop)');
}
report.death=await evaluate(`(()=>{const s=window.artSnapshot;window.artViewer.loadSnapshot({...s,tick:330,second:11,actors:s.actors.map(a=>({...a,alive:false,motion:{...a.motion,stateSince:10,state:'dead'}}))});window.artViewer.draw(1300,800,2);return window.artViewer.diagnostics().sprites.every(a=>Math.abs(a.tilt)>1.5&&a.opacity<.5);})()`);assert.ok(report.death);
report.respawn=await evaluate(`(()=>{const s=window.artSnapshot;window.artViewer.loadSnapshot({...s,tick:360,second:12});window.artViewer.draw(1300,800,2);return window.artViewer.diagnostics().sprites.every(a=>a.opacity===1&&Math.abs(a.tilt)<.1);})()`);assert.ok(report.respawn);
const lost=await evaluate(`(()=>{window.artLoss=window.artHost.querySelector('canvas').getContext('webgl2').getExtension('WEBGL_lose_context');window.artLoss?.loseContext();return !!window.artLoss;})()`);
if(lost){await new Promise(r=>setTimeout(r,200));await evaluate('window.artLoss.restoreContext()');for(let n=0;n<60;n++){if(await evaluate('window.artViewer.isAvailable()'))break;await new Promise(r=>setTimeout(r,250));}report.contextRestored=await evaluate('window.artViewer.draw(1300,800,2)');assert.ok(report.contextRestored);}
await evaluate('window.artViewer.dispose();window.artHost.remove()');
  await evaluate(`(async()=>{
    const entry=await (await fetch('/src/main.tsx')).text();
    const reactUrl=entry.split('"').find(s=>s.includes('/deps/react.js')),domUrl=entry.split('"').find(s=>s.includes('/deps/react-dom_client.js'));
    const [reactModule,domModule,{AramMatchView},{INITIAL_PLAYERS,CHAMPIONS,INITIAL_COACHES}]=await Promise.all([import(reactUrl),import(domUrl),import('/src/components/AramMatchView.tsx'),import('/src/mockData.ts')]);
    const React=reactModule.default??reactModule.t(),{createRoot}=domModule.default??domModule;
    const host=document.createElement('div');host.id='live-babylon-check';host.style.cssText='position:fixed;inset:0;z-index:99999';document.body.append(host);
    window.liveCheckRoot=createRoot(host);
    const ids=['c_puck','c_invoker','c_wraithhook','c_nullweaver','c_raijin'];
    const lineup=offset=>ids.map((id,i)=>({player:INITIAL_PLAYERS[offset+i],champion:CHAMPIONS.find(c=>c.id===id)}));
    window.liveCheckRoot.render(React.createElement(React.StrictMode,null,React.createElement(AramMatchView,{seed:71001,abilityRuleset:'original-v3-preview-2',
      evaluationController:'baseline',evaluationStartPaused:true,evaluationRenderless:false,trustedServer:true,contentCatalog:null,
      blueLineup:lineup(0),redLineup:lineup(5),blueCoach:INITIAL_COACHES[0],redCoach:INITIAL_COACHES[0],onExit:()=>{},onReplay:()=>{},onMatchComplete:()=>{}})));
  })()`);
  for(let i=0;i<60;i++){if(await evaluate("!!window.__esportsTrusted && document.querySelector('#live-babylon-check [data-renderer=babylon]')!==null"))break;await new Promise(r=>setTimeout(r,500));}

assert.equal(await evaluate('window.__esportsTrusted.v3Fixture()'),true);
await evaluate("[...document.querySelectorAll('#live-babylon-check button')].find(b=>b.textContent==='Record viewer').click()");
assert.equal(await evaluate('window.__esportsTrusted.step(150)'),true);
for(let n=0;n<100;n++){if(await evaluate("document.querySelector('#live-babylon-check [data-renderer=babylon]')?.dataset.sprites==='10'&&Number(document.querySelector('#live-babylon-check [data-renderer=babylon]')?.dataset.abilityTokens)>0"))break;await new Promise(r=>setTimeout(r,200));}
assert.equal(await evaluate('window.__esportsTrusted.valleyFixture()'),true);
assert.equal(await evaluate(`(()=>{const a=window.__esportsTrusted.snapshot().frame.champions.find(c=>c.champion.id==='c_invoker'&&c.team==='blue');window.__esportsTrusted.v3Input({actor:a.id,slot:'skill1',point:{x:a.x+10,y:a.y}});return window.__esportsTrusted.step(15);})()`),true);
await new Promise(r=>setTimeout(r,600));
report.cast=await evaluate(`(async()=>{const s=window.__esportsTrusted.snapshot(),world=window.__esportsTrusted.v3State(),{captureViewerSnapshot}=await import('/src/match-viewer/MatchViewer.ts');const f=captureViewerSnapshot({...s.frame,v3:world});return {pins:f.constructs.filter(c=>c.kind==='pin'&&c.heroId==='c_invoker'),cues:f.cues};})()`);assert.ok(report.cast.pins.length>0);assert.ok(report.cast.cues.some(c=>c.heroId==='c_invoker'&&c.slot==='skill1'));
report.live=await evaluate(`(()=>{const host=document.querySelector('#live-babylon-check [data-renderer=babylon]');return {sprites:Number(host.dataset.sprites),abilityTokens:Number(host.dataset.abilityTokens),icons:document.querySelectorAll('#live-babylon-check .painted-ability-icon').length,portraits:[...document.querySelectorAll('#live-babylon-check .painted-roster-portrait')].every(i=>i.complete&&i.naturalWidth>0),fingerprint:window.__esportsTrusted.snapshot().fingerprint};})()`);
assert.equal(report.live.sprites,10);assert.ok(report.live.abilityTokens>0);assert.equal(report.live.icons,40);assert.ok(report.live.portraits);
await new Promise(r=>setTimeout(r,400));assert.equal(await evaluate('window.__esportsTrusted.snapshot().fingerprint'),report.live.fingerprint);
await writeFile('../docs/arena-2d/ability-drawings-v1/live-match.png',Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await new Promise(r=>setTimeout(r,500));
report.mobile=await evaluate('document.documentElement.scrollWidth<=innerWidth');assert.ok(report.mobile);
await writeFile('../docs/arena-2d/ability-drawings-v1/live-mobile.png',Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
await evaluate("[...document.querySelectorAll('#live-babylon-check button')].find(b=>b.textContent==='Stop / replay recording').click()");
for(let n=0;n<60;n++){if(await evaluate("document.querySelector('[role=dialog] [data-renderer=babylon]')?.dataset.sprites==='10'"))break;await new Promise(r=>setTimeout(r,200));}
report.replay=await evaluate("({sprites:Number(document.querySelector('[role=dialog] [data-renderer=babylon]')?.dataset.sprites),duration:Number(document.querySelector('input[aria-label=\"Seek recording\"]')?.max)})");assert.equal(report.replay.sprites,10);assert.ok(report.replay.duration>=4.9);
await evaluate("window.liveCheckRoot.unmount();document.querySelector('#live-babylon-check').remove()");
assert.deepEqual(errors,[]);report.disposed=true;await writeFile('../docs/arena-2d/ability-drawings-v1/live-browser.json',JSON.stringify(report,null,2));console.log(JSON.stringify({batches:report.batches.length,...report.live,replay:report.replay,errors}));
}finally{socket.close();await fetch(cdp+'/json/close/'+target.id);}
