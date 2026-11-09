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
const report={errors};
try{
await send('Runtime.enable');await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});await send('Page.navigate',{url:base});await new Promise(r=>setTimeout(r,3000));
await evaluate(`(async()=>{const {BabylonMatchViewer}=await import('/src/match-viewer/BabylonMatchViewer.ts');const host=document.createElement('div');host.id='world-fx';host.style.cssText='position:fixed;inset:0;z-index:99999';document.body.append(host);window.fxViewer=await BabylonMatchViewer.create(host,2600,1440,0,2600,()=>{});window.fxBase={tick:300,second:10,actors:[{id:'weaver',heroId:'c_invoker',label:'Mirelle',x:1060,y:680,hp:100,maxHp:100,alive:true,facing:1,team:'blue',kind:'champion',motion:{state:'cast',stateSince:10,vx:0,vy:0,attackTimer:0}},{id:'archer',heroId:'c_astra',label:'Ivera',x:1450,y:720,hp:100,maxHp:100,alive:true,facing:-1,team:'red',kind:'champion',motion:{state:'idle',stateSince:9,vx:0,vy:0,attackTimer:0}}],effects:[{id:'ice-shot',heroId:'c_astra',slot:'skill1',kind:'projectile',x:1300,y:720,radius:6,angle:Math.PI,color:'#48caff'},{id:'hit',heroId:'c_invoker',slot:'skill1',kind:'impact',x:1200,y:700,radius:30,age:0,color:'#ee3d82',originX:1060,originY:680},{id:'beam',heroId:'c_raijin',slot:'ultimate',kind:'zone',sourceX:1020,sourceY:840,x:1240,y:840,radius:20,color:'#8a65ff'}],constructs:[{id:'thread',kind:'seam',heroId:'c_invoker',slot:'ultimate',x:1100,y:780,radius:12,angle:0,owner:'weaver',team:'blue',hp:2,maxHp:2,created:290,expires:420,disabledUntil:0,attackable:false,points:[{x:1000,y:780},{x:1220,y:780}]},{id:'circuit',kind:'circuit',heroId:'c_raijin',slot:'ultimate',x:1400,y:890,radius:68,angle:0,owner:'archer',team:'red',hp:2,maxHp:2,created:290,expires:420,disabledUntil:0,attackable:false,points:[]},{id:'pin',kind:'pin',heroId:'c_invoker',slot:'skill1',x:1220,y:780,radius:12,angle:0,owner:'weaver',team:'blue',hp:2,maxHp:2,created:290,expires:420,disabledUntil:0,attackable:true,points:[]}],cues:[{id:'cast',actor:'weaver',heroId:'c_invoker',slot:'ultimate',tick:300}]};window.fxViewer.loadSnapshot(window.fxBase);window.fxViewer.draw(1250,780,2.5);})()`);
for(let n=0;n<100;n++){if(await evaluate('window.fxViewer.draw(1250,780,2.5)&&window.fxViewer.diagnostics().abilityArt.visible===window.fxViewer.diagnostics().abilityArt.tokens'))break;await new Promise(r=>setTimeout(r,200));}
const before=await evaluate('JSON.stringify(window.fxBase)');
await evaluate(`(()=>{window.fxChunks=[];window.fxStream=document.querySelector('#world-fx canvas').captureStream(15);window.fxRecorder=new MediaRecorder(window.fxStream,{mimeType:'video/webm;codecs=vp8'});window.fxRecorder.ondataavailable=e=>{if(e.data.size)window.fxChunks.push(e.data);};window.fxRecorder.start();})()`);
for(let i=0;i<45;i++){
 await evaluate(`(()=>{const t=${i}/15,b=window.fxBase;window.fxViewer.loadSnapshot({...b,tick:300+${i}*2,second:10+t,effects:b.effects.map(e=>e.id==='hit'?{...e,age:t%1}:e.id==='ice-shot'?{...e,x:1400-(t%1)*250}:e),cues:t<.65?b.cues:[]});window.fxViewer.draw(1250,780,2.5);})()`);
 if(i===3)await writeFile('../docs/arena-2d/ability-effects-v2/animated-effects.png',Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
 await new Promise(r=>setTimeout(r,67));
}
const video=await evaluate(`(async()=>{await new Promise(r=>{window.fxRecorder.onstop=r;window.fxRecorder.stop();});for(const t of window.fxStream.getTracks())t.stop();const data=new Uint8Array(await new Blob(window.fxChunks,{type:'video/webm'}).arrayBuffer());let b='';for(let i=0;i<data.length;i+=32768)b+=String.fromCharCode(...data.subarray(i,i+32768));return btoa(b);})()`);
await writeFile('../docs/arena-2d/ability-effects-v2/animated-effects.webm',Buffer.from(video,'base64'));
assert.equal(await evaluate('JSON.stringify(window.fxBase)'),before);
report.video=await evaluate(`(async()=>{const v=document.createElement('video');v.src=URL.createObjectURL(new Blob(window.fxChunks,{type:'video/webm'}));await new Promise((r,j)=>{v.onloadedmetadata=r;v.onerror=j;});v.currentTime=.3;await new Promise((r,j)=>{v.onseeked=r;v.onerror=j;});const out={width:v.videoWidth,height:v.videoHeight,time:v.currentTime};URL.revokeObjectURL(v.src);return out;})()`);assert.ok(report.video.width>0&&report.video.time>=.3);
report.world=await evaluate('window.fxViewer.diagnostics().abilityArt');assert.equal(report.world.worldMeshes,15);
report.paused=await evaluate(`(()=>{const a=JSON.stringify(window.fxViewer.diagnostics().abilityArt);window.fxViewer.draw(1250,780,2.5);return a===JSON.stringify(window.fxViewer.diagnostics().abilityArt);})()`);assert.equal(report.paused,true);
await evaluate('window.fxViewer.dispose();document.querySelector("#world-fx").remove()');
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


assert.equal(await evaluate('window.__esportsTrusted.v3Fixture()'),true);assert.equal(await evaluate('window.__esportsTrusted.step(75)'),true);
await new Promise(r=>setTimeout(r,1500));
report.before=await evaluate(`(()=>{const s=window.__esportsTrusted.snapshot();return {actors:s.frame.champions.map(a=>({id:a.id,x:a.x,y:a.y,alive:a.isAlive,hero:a.champion.id})),world:window.__esportsTrusted.v3State()};})()`);
await evaluate('window.__esportsTrusted.step(15)');
report.hitWaitSteps=0;
for(let i=0;i<300;i++){if(await evaluate('window.__esportsTrusted.snapshot().frame.abilityHits.some(h=>window.__esportsTrusted.snapshot().second-h.second<.3)'))break;await evaluate('window.__esportsTrusted.step(3)');report.hitWaitSteps+=3;}
await new Promise(r=>setTimeout(r,300));
report.hits=await evaluate('window.__esportsTrusted.snapshot().frame.abilityHits');report.events=await evaluate('window.__esportsTrusted.v3State().events.slice(-12)');
await writeFile('../docs/arena-2d/ability-effects-v2/live-hit.png',Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
report.live=await evaluate("({...document.querySelector('#live-babylon-check [data-renderer=babylon]').dataset})");
report.fingerprint=await evaluate('window.__esportsTrusted.snapshot().fingerprint');
report.focusedReplay=await evaluate(`(async()=>{const {BabylonMatchViewer}=await import('/src/match-viewer/BabylonMatchViewer.ts'),{captureViewerSnapshot}=await import('/src/match-viewer/MatchViewer.ts'),{ViewerReplay}=await import('/src/match-viewer/ViewerReplay.ts');const live=window.__esportsTrusted.snapshot(),frame=captureViewerSnapshot({...live.frame,v3:window.__esportsTrusted.v3State()}),record=new ViewerReplay();record.record(frame);const copy=ViewerReplay.parse(record.export()).seek(frame.second);const host=document.createElement('div');host.id='focused-hit';host.style.cssText='position:fixed;inset:0;z-index:100000';document.body.append(host);window.hitViewer=await BabylonMatchViewer.create(host,2600,1440,0,2600,()=>{});window.hitViewer.loadSnapshot(copy);window.hitDraw=()=>window.hitViewer.draw(1300,730,3.2);window.hitDraw();return {identical:JSON.stringify(copy.effects)===JSON.stringify(frame.effects),hits:copy.effects.filter(e=>e.id.startsWith('ability-hit:')).length};})()`);assert.ok(report.focusedReplay.identical&&report.focusedReplay.hits>0);
for(let n=0;n<60;n++){if(await evaluate('window.hitDraw()&&window.hitViewer.diagnostics().sprites.length===10&&window.hitViewer.diagnostics().sprites.every(s=>s.ready)&&window.hitViewer.diagnostics().abilityArt.visible===window.hitViewer.diagnostics().abilityArt.tokens'))break;await new Promise(r=>setTimeout(r,200));}
await new Promise(r=>setTimeout(r,300));assert.equal(await evaluate('window.hitDraw()&&window.hitViewer.diagnostics().sprites.every(s=>s.ready)'),true);
await writeFile('../docs/arena-2d/ability-effects-v2/live-hit-focused.png',Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
report.focusedReplay.world=await evaluate('window.hitViewer.diagnostics().abilityArt');
report.contextRestored=await evaluate(`(async()=>{const ext=document.querySelector('#focused-hit canvas').getContext('webgl2').getExtension('WEBGL_lose_context');if(!ext)return null;ext.loseContext();await new Promise(r=>setTimeout(r,200));ext.restoreContext();for(let i=0;i<60;i++){if(window.hitViewer.isAvailable())return !!window.hitDraw();await new Promise(r=>setTimeout(r,200));}return false;})()`);assert.notEqual(report.contextRestored,false);
await evaluate('window.hitViewer.dispose();document.querySelector("#focused-hit").remove()');
assert.equal(await evaluate('window.__esportsTrusted.snapshot().fingerprint'),report.fingerprint);
report.disposed=true;
await writeFile('../docs/arena-2d/ability-effects-v2/browser.json',JSON.stringify(report,null,2));
assert.ok(report.hits.length>0,JSON.stringify({events:report.events}));assert.ok(Number(report.live.abilityWorldMeshes)>0);assert.deepEqual(errors,[]);
await evaluate("window.liveCheckRoot.unmount();document.querySelector('#live-babylon-check').remove()");console.log(JSON.stringify({world:report.world,hits:report.hits.length,live:report.live,errors}));
}finally{socket.close();await fetch(cdp+'/json/close/'+target.id);}
