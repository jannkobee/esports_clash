// Inspect the real paused spectator with the production stylesheet. The private
// stepping harness does not refresh wall-HUD state; world telegraphs use sim ticks.
import {readFile,readdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const prefix=process.argv[2];assert.ok(prefix,'New output prefix required');
const css=(await Promise.all((await readdir('dist/assets')).filter(f=>f.endsWith('.css')).map(f=>readFile('dist/assets/'+f,'utf8')))).join('\n');
const pages=await(await fetch('http://127.0.0.1:9236/json/list')).json(),ws=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);
await new Promise(r=>ws.addEventListener('open',r,{once:true}));let id=0;const pending=new Map();
ws.addEventListener('message',event=>{const r=JSON.parse(event.data),p=pending.get(r.id);if(p){pending.delete(r.id);clearTimeout(p.timer);r.error?p.reject(Error(JSON.stringify(r.error))):p.resolve(r.result);}});
const send=(method,params={})=>new Promise((resolve,reject)=>{const key=++id,timer=setTimeout(()=>reject(Error(method+' timeout')),60000);pending.set(key,{resolve,reject,timer});ws.send(JSON.stringify({id:key,method,params}));});
const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description??r.exceptionDetails.text);return r.result.value;};
const waitFor=async expression=>{for(let i=0;i<100;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,100));}throw Error('Not ready');};
try{
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url:'http://127.0.0.1:5184/evolution-compiled.html'});await waitFor('!!window.__evolutionPageReady');
 await evaluate(`(()=>{localStorage.clear();sessionStorage.clear();const style=document.createElement('style');style.textContent=${JSON.stringify(css)};document.head.append(style);
 const {React,createRoot,AramMatchView,INITIAL_PLAYERS,CHAMPIONS,INITIAL_COACHES}=window.__evolutionModules;
 const keys=['c_puck','c_invoker','c_wraithhook','c_nullweaver','c_raijin'],lineup=offset=>keys.map((id,i)=>({player:INITIAL_PLAYERS[offset+i],champion:CHAMPIONS.find(c=>c.id===id)}));
 window.fixtureRoot=createRoot(document.getElementById('root'));window.fixtureRoot.render(React.createElement(AramMatchView,{seed:71001,abilityRuleset:'original-v3-preview-2',evaluationController:'baseline',
 evaluationStartPaused:true,evaluationRenderless:false,trustedServer:true,contentCatalog:null,blueLineup:lineup(0),redLineup:lineup(5),blueCoach:INITIAL_COACHES[0],redCoach:INITIAL_COACHES[0],
 onReplay:()=>{},onExit:()=>{},onMatchComplete:()=>{}}));})()`);
 await waitFor('!!window.__esportsTrusted');assert.equal(await evaluate('window.__esportsTrusted.v3Fixture()'),true);
 await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Hide panel')?.click()`);
 await evaluate('window.__esportsTrusted.step(120)');await new Promise(r=>setTimeout(r,500));
 const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(prefix+'.png',Buffer.from(shot.data,'base64'),{flag:'wx'});
 const evidence=await evaluate(`(()=>{const w=window.__esportsTrusted.v3State();return {sourceHash:window.__evolutionBuildSourceHash,second:w.tick/30,constructs:w.constructs.map(c=>({id:c.id,kind:c.kind,hp:c.hp,points:c.points})),counters:w.counters,
  selectors:[...document.querySelectorAll('select[aria-label^="Mirelle page"]')].map(s=>({label:s.getAttribute('aria-label'),pages:s.options.length})),
  previewLabel:document.body.textContent.includes('legacy visual placeholders')};})()`);
 assert.equal(evidence.selectors.length,2);assert.ok(evidence.selectors.every(s=>s.pages===10));assert.equal(evidence.previewLabel,true);
 await writeFile(prefix+'.json',JSON.stringify({scope:'Styled private paused fixture, 2D fallback; wall-HUD remains paused while authoritative time is stepped',...evidence},null,2)+'\n',{flag:'wx'});
 await evaluate('window.fixtureRoot.unmount()');console.log(JSON.stringify({second:evidence.second,constructs:evidence.constructs.length,palettePages:10,placeholderLabel:true}));
}finally{ws.close();}
