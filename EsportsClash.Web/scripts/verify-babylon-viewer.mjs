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
try{
  await send('Runtime.enable');await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:base});await new Promise(resolve=>setTimeout(resolve,3000));
  await evaluate(`(async()=>{
    const {BabylonMatchViewer}=await import('/src/match-viewer/BabylonMatchViewer.ts');
    const host=document.createElement('div');host.id='babylon-check';host.style.cssText='position:fixed;inset:0;background:#071419;z-index:99999';document.body.append(host);
    window.checkViewer=await BabylonMatchViewer.create(host,2600,760,0,2600,()=>{});
    const ids=['c_solana','c_invoker','c_largo','c_puck','c_raijin','c_wraithhook','c_nullweaver','c_bristleback','c_batrider','c_skybreaker'];
    window.checkSnapshot={tick:300,second:10,actors:ids.map((heroId,i)=>({id:'actor:'+i,heroId,label:heroId,x:1090+(i%5)*100,y:i<5?320:460,hp:100,maxHp:100,alive:true,facing:i<5?1:-1,team:i<5?'blue':'red',kind:'champion',motion:{state:'walk',vx:100,vy:0,attackTimer:0}})),effects:[],constructs:[{id:'test-seam',kind:'seam',x:1300,y:380,radius:20,angle:0,team:'blue',hp:2,maxHp:2,created:290,expires:500,disabledUntil:0,attackable:true,points:[{x:1220,y:380},{x:1380,y:380}]}]};
    window.checkViewer.loadSnapshot(window.checkSnapshot);window.checkLoop=setInterval(()=>window.checkViewer.draw(1300,380,2),50);return true;
  })()`);
  let state;
  for(let i=0;i<90;i++){
    state=await evaluate(`({models:Number(document.querySelector('#babylon-check')?.dataset.models??0),...window.checkViewer.diagnostics()})`);
    if(Number(state.models)===10)break;await new Promise(resolve=>setTimeout(resolve,1000));
  }
  assert.equal(Number(state.models),10,JSON.stringify(state));
  const phases=await evaluate(`(()=>{const a=window.checkSnapshot;for(const [phase,second,alive] of [['cast',11,true],['attack',12,true],['dead',13,false],['idle',14,true]]){window.checkSnapshot={...a,tick:second*30,second,actors:a.actors.map(actor=>({...actor,alive,motion:{...actor.motion,state:phase}}))};window.checkViewer.loadSnapshot(window.checkSnapshot);window.checkViewer.draw(1300,380,2);}return window.checkViewer.isAvailable();})()`);
  assert.ok(phases);await new Promise(resolve=>setTimeout(resolve,500));
  const screenshot=await send('Page.captureScreenshot',{format:'png'});
  await writeFile('../docs/babylon-migration/integrated-viewer.png',Buffer.from(screenshot.data,'base64'));
  const report={date:'2026-10-24',state,phases,errors,scope:'Ten GLB instances, geometry, death/spawn states, loading and disposal; no gameplay balance qualification'};
  const canLose=await evaluate("(()=>{window.contextLoss=document.querySelector('#babylon-check canvas').getContext('webgl2')?.getExtension('WEBGL_lose_context');window.contextLoss?.loseContext();return !!window.contextLoss;})()");
  if(canLose){
    await new Promise(r=>setTimeout(r,200));
    assert.equal(await evaluate('window.checkViewer.isAvailable()'),false);
    await evaluate('window.contextLoss.restoreContext()');
    for(let i=0;i<60;i++){if(await evaluate('window.checkViewer.isAvailable()'))break;await new Promise(r=>setTimeout(r,250));}
    report.contextRestored=await evaluate('window.checkViewer.isAvailable() && window.checkViewer.draw(1300,380,2)');
    assert.ok(report.contextRestored);
  }
  await evaluate("clearInterval(window.checkLoop);window.checkViewer.dispose();document.querySelector('#babylon-check').remove()");
  report.disposed=await evaluate("!document.querySelector('#babylon-check')");
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
  assert.equal(await evaluate('window.__esportsTrusted.step(120)'),true);
  for(let i=0;i<60;i++){if(await evaluate("document.querySelector('#live-babylon-check [data-renderer=babylon]')?.dataset.models==='10'"))break;await new Promise(r=>setTimeout(r,500));}
  report.live=await evaluate(`(()=>{const s=window.__esportsTrusted.snapshot(),host=document.querySelector('#live-babylon-check [data-renderer=babylon]');return {second:s.second,models:Number(host?.dataset.models),backend:host?.dataset.backend,canvases:host?.querySelectorAll('canvas').length,hasOldSelector:document.querySelector('#live-babylon-check').innerText.includes('Legacy renderer'),fingerprint:s.fingerprint,constructs:window.__esportsTrusted.v3State().constructs.length};})()`);
  assert.equal(report.live.models,10);assert.equal(report.live.canvases,1);assert.equal(report.live.hasOldSelector,false);
  await writeFile('../docs/babylon-migration/live-viewer.png',Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
  await evaluate("[...document.querySelectorAll('#live-babylon-check button')].find(b=>b.textContent==='Stop / replay recording').click()");
  for(let i=0;i<40;i++){if(await evaluate("!!document.querySelector('[role=dialog] canvas')"))break;await new Promise(r=>setTimeout(r,250));}
  report.replay=await evaluate("({opened:!!document.querySelector('[role=dialog] canvas'),duration:Number(document.querySelector('input[aria-label=\"Seek recording\"]')?.max)})");
  assert.ok(report.replay.opened);assert.ok(report.replay.duration>=3.9);
  await evaluate("window.liveCheckRoot.unmount();document.querySelector('#live-babylon-check').remove()");
  await writeFile('../docs/babylon-migration/viewer-check.json',JSON.stringify(report,null,2));assert.deepEqual(errors,[]);console.log(JSON.stringify(report));
}finally{socket.close();await fetch(cdp+'/json/close/'+target.id);}
