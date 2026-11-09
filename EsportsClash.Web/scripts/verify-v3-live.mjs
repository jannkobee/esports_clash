// Actual AramMatchView, deterministic engineering fixture; never promotion data.
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {intelligenceSourceHash} from './intelligence-source-hash.mjs';
const output=process.argv[2];assert.ok(output,'New output filename required');
const pages=await(await fetch('http://127.0.0.1:9236/json/list')).json();
const ws=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));
let serial=0;const pending=new Map(),errors=[];
ws.addEventListener('message',event=>{const data=JSON.parse(event.data);if(data.method==='Runtime.exceptionThrown')errors.push(data.params.exceptionDetails.exception?.description??data.params.exceptionDetails.text);
 const handler=pending.get(data.id);if(handler){pending.delete(data.id);clearTimeout(handler.timer);data.error?handler.reject(Error(JSON.stringify(data.error))):handler.resolve(data.result);}});
const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial,timer=setTimeout(()=>{pending.delete(id);reject(Error(method+' timeout'));},60000);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));});
const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description??r.exceptionDetails.text);return r.result.value;};
const waitFor=async expression=>{for(let i=0;i<150;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,100));}throw Error('Not ready: '+expression);};
const runs=[];const frozenSourceHash=intelligenceSourceHash();
try{
 await send('Runtime.enable');
 for(const spec of [{grouping:1,renderless:true},{grouping:4,renderless:true},{grouping:4,renderless:false}]){
  const {grouping,renderless}=spec;
  await send('Page.navigate',{url:'http://127.0.0.1:5184/evolution-compiled.html'});await waitFor('!!window.__evolutionPageReady');
  assert.equal(await evaluate('window.__evolutionBuildSourceHash'),frozenSourceHash,'Compiled/runtime source mismatch');
  await evaluate(`(()=>{localStorage.clear();sessionStorage.clear();const {React,createRoot,AramMatchView,INITIAL_PLAYERS,CHAMPIONS,INITIAL_COACHES}=window.__evolutionModules;
   const keys=['c_puck','c_invoker','c_wraithhook','c_nullweaver','c_raijin'];const lineup=offset=>keys.map((key,i)=>({player:INITIAL_PLAYERS[offset+i],champion:CHAMPIONS.find(c=>c.id===key)}));
   window.fixtureRoot=createRoot(document.getElementById('root'));window.fixtureRoot.render(React.createElement(AramMatchView,{
    seed:71001,abilityRuleset:'original-v3-preview-2',evaluationController:'baseline',evaluationStartPaused:true,evaluationRenderless:${renderless},trustedServer:true,contentCatalog:null,
    blueLineup:lineup(0),redLineup:lineup(5),blueCoach:INITIAL_COACHES[0],redCoach:INITIAL_COACHES[0],onExit:()=>{},onReplay:()=>{},onMatchComplete:()=>{}}));})()`);
  await waitFor('!!window.__esportsTrusted');assert.equal(await evaluate('window.__esportsTrusted.v3Fixture()'),true);
  for(let tick=0;tick<1200;tick+=grouping)assert.equal(await evaluate(`window.__esportsTrusted.step(${grouping})`),true);
  const data=await evaluate(`(()=>{const s=window.__esportsTrusted.snapshot();return {second:s.second,fingerprint:s.fingerprint,randomState:s.randomState,world:window.__esportsTrusted.v3State(),
    units:s.frame.champions.map(c=>({id:c.id,key:c.champion.id,name:c.champion.displayName,title:c.champion.title,ruleset:c.champion.abilityRuleset,
      hp:c.hp,mana:c.mana,kills:c.kills,deaths:c.deaths,x:c.x,y:c.y,paxiOrb:c.paxiOrb,blackHole:c.blackHole,hook:c.hookPull,orbs:c.kaelenOrbs,
      phase:c.untargetableTimer,silence:c.silenceTimer,oldDash:c.dash,damage:c.damageDealt})),events:s.events};})()`);
  runs.push({grouping,renderless,...data});console.log(JSON.stringify({grouping,renderless,second:data.second,counters:data.world.counters}));
  if(!renderless){await new Promise(r=>setTimeout(r,400));const screenshot=await send('Page.captureScreenshot',{format:'png'});
    await writeFile(output.replace(/\.json$/,'-preview.png'),Buffer.from(screenshot.data,'base64'),{flag:'wx'});}
  await evaluate('window.fixtureRoot.unmount()');
 }
 assert.equal(errors.length,0,errors.join('\n'));assert.equal(runs[0].fingerprint,runs[1].fingerprint);assert.equal(runs[0].randomState,runs[1].randomState);
 assert.deepEqual(runs[0].world,runs[1].world);
 assert.equal(runs[0].fingerprint,runs[2].fingerprint,'Spectator rendering changed gameplay state');
 assert.ok(runs[0].world.counters.ability_committed>0);
 for(const u of runs[0].units){assert.equal(u.ruleset,'original-v3-preview-2');assert.ok(Number.isFinite(u.hp)&&u.hp>=0&&Number.isFinite(u.mana)&&u.mana>=0);
  assert.equal(u.paxiOrb,undefined);assert.equal(u.blackHole,undefined);assert.equal(u.hook,undefined);assert.equal(u.oldDash,undefined);assert.ok(!u.orbs?.length);assert.equal(u.phase??0,0);assert.equal(u.silence??0,0);}
 assert.equal(intelligenceSourceHash(),frozenSourceHash,'Source changed during verification');
 await writeFile(output,JSON.stringify({scope:'Known-seed 40s original-V3 live teamfight; not full roster or balance qualification',sourceHash:frozenSourceHash,errors,runs},null,2)+'\n',{flag:'wx'});
}finally{ws.close();}
