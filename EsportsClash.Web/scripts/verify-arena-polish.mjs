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
await send('Page.navigate',{url:base});await new Promise(r=>setTimeout(r,3000));

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
assert.equal(await evaluate('window.__esportsTrusted.step(120)'),true);
await new Promise(r=>setTimeout(r,5000));
const state=await evaluate("({ready:!!window.__esportsTrusted,arena:document.querySelector('[data-renderer=babylon]')?.dataset.paintedArena})");
assert.equal(state.ready,true);assert.equal(state.arena,'valley-ready');
await writeFile('../docs/arena-2d/polish-live.png',Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await new Promise(r=>setTimeout(r,800));
await writeFile('../docs/arena-2d/polish-mobile.png',Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
await evaluate("window.liveCheckRoot.unmount();document.querySelector('#live-babylon-check').remove()");
await writeFile('../docs/arena-2d/polish-browser.json',JSON.stringify({state,errors,disposed:true},null,2));assert.deepEqual(errors,[]);console.log(JSON.stringify({state,errors}));
}finally{socket.close();await fetch(cdp+'/json/close/'+target.id);}