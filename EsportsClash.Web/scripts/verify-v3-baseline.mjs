// Reproduce the retained natural ML-off match through the actual arena with V3 off.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {intelligenceSourceHash} from './intelligence-source-hash.mjs';
const output=process.argv[2];assert.ok(output,'Supply a new output path');
const frozenSourceHash=intelligenceSourceHash();
const reference=JSON.parse(await readFile('../docs/baseline-recovery-verification-20261023.json','utf8')).runs[0];
const pages=await(await fetch('http://127.0.0.1:9236/json/list')).json(),ws=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);
await new Promise(r=>ws.addEventListener('open',r,{once:true}));let id=0;const pending=new Map();
ws.addEventListener('message',e=>{const r=JSON.parse(e.data),p=pending.get(r.id);if(p){pending.delete(r.id);clearTimeout(p.timer);r.error?p.reject(Error(JSON.stringify(r.error))):p.resolve(r.result);}});
const send=(method,params={})=>new Promise((resolve,reject)=>{const key=++id,timer=setTimeout(()=>{pending.delete(key);reject(Error(method+' timeout'));},60000);pending.set(key,{resolve,reject,timer});ws.send(JSON.stringify({id:key,method,params}));});
const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description??r.exceptionDetails.text);return r.result.value;};
const waitFor=async expression=>{for(let i=0;i<150;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,100));}throw Error('Fixture not ready');};
try{
 await send('Page.navigate',{url:'http://127.0.0.1:5184/evolution-compiled.html'});await waitFor('!!window.__evolutionPageReady');
 assert.equal(await evaluate('window.__evolutionBuildSourceHash'),frozenSourceHash,'Compiled/runtime source mismatch');
 await evaluate(`(()=>{localStorage.clear();sessionStorage.clear();const {React,createRoot,AramMatchView,INITIAL_PLAYERS,CHAMPIONS,INITIAL_COACHES,buildPairedStudyDraft}=window.__evolutionModules;
 const lineup=buildPairedStudyDraft(INITIAL_PLAYERS,CHAMPIONS,0);window.fixtureRoot=createRoot(document.getElementById('root'));
 window.fixtureRoot.render(React.createElement(AramMatchView,{seed:71001,evaluationController:'baseline',evaluationStartPaused:true,evaluationRenderless:true,trustedServer:true,contentCatalog:null,
 blueLineup:lineup.slice(0,5),redLineup:lineup.slice(5),blueCoach:INITIAL_COACHES[0],redCoach:INITIAL_COACHES[0],onExit:()=>{},onReplay:()=>{},onMatchComplete:()=>{}}));})()`);
 await waitFor('!!window.__esportsTrusted');let finished=false;
 for(let tick=0;tick<36000&&!finished;tick+=300){await evaluate('window.__esportsTrusted.step(300)');finished=await evaluate('window.__esportsTrusted.snapshot().finished');}
 const result=await evaluate(`(()=>{const s=window.__esportsTrusted.snapshot();return {finished:s.finished,second:s.second,fingerprint:s.fingerprint,randomState:s.randomState,
 winner:s.report?.winner,controllers:s.report?.gameplayControllers,v3:window.__esportsTrusted.v3State()};})()`);
 const exact=result.fingerprint===reference.fingerprint;
 assert.equal(intelligenceSourceHash(),frozenSourceHash,'Source changed during verification');
 await writeFile(output,JSON.stringify({scope:'Known-seed unchanged-baseline regression',sourceHash:frozenSourceHash,referenceFingerprint:reference.fingerprint,exact,result},null,2)+'\n',{flag:'wx'});
 assert.equal(exact,true,'Legacy baseline full world changed');assert.equal(result.second,reference.second);assert.equal(result.v3,null);
 console.log(JSON.stringify({exact,second:result.second,winner:result.winner}));await evaluate('window.fixtureRoot.unmount()');
}finally{ws.close();}
