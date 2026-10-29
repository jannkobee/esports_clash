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
 await send('Runtime.enable');await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 const results=[];
 for(const {team,mode} of (process.env.BARRACKS_DEBUG ? [{team:'blue',mode:'champions'}] : [{team:'blue',mode:'combined'},{team:'red',mode:'combined'},{team:'blue',mode:'champions'},{team:'red',mode:'champions'}])){
  await send('Page.navigate',{url:base});await new Promise(r=>setTimeout(r,2500));
  await evaluate(`(async()=>{
    const entry=await(await fetch('/src/main.tsx')).text();const reactUrl=entry.split('"').find(s=>s.includes('/deps/react.js')),domUrl=entry.split('"').find(s=>s.includes('/deps/react-dom_client.js'));
    const [r,d,{AramMatchView},{INITIAL_PLAYERS,CHAMPIONS,INITIAL_COACHES}]=await Promise.all([import(reactUrl),import(domUrl),import('/src/components/AramMatchView.tsx'),import('/src/mockData.ts')]);
    const React=r.default??r.t(),createRoot=(d.default??d).createRoot,host=document.createElement('div');host.id='barracks-check';host.style.cssText='position:fixed;inset:0;z-index:99999';document.body.append(host);window.testRoot=createRoot(host);
    const ids=['c_astra','c_cora','c_aetherbolt','c_senna','c_buck'],lineup=offset=>ids.map((id,i)=>({player:INITIAL_PLAYERS[offset+i],champion:CHAMPIONS.find(c=>c.id===id)}));
    window.testRoot.render(React.createElement(AramMatchView,{seed:71001,evaluationStartPaused:true,evaluationController:'baseline',trustedServer:true,contentCatalog:null,
      blueLineup:lineup(0),redLineup:lineup(5),blueCoach:INITIAL_COACHES[0],redCoach:INITIAL_COACHES[0],onExit:()=>{},onReplay:()=>{},onMatchComplete:()=>{}}));
  })()`);
  for(let i=0;i<60;i++){if(await evaluate('!!window.__esportsTrusted'))break;await new Promise(r=>setTimeout(r,100));}
  assert.equal(await evaluate(`window.__esportsTrusted.barracksFixture('${team}','${mode}')`),true);
  let state;
  for(let i=0;i<(process.env.BARRACKS_DEBUG?10:120);i++){
    assert.equal(await evaluate('window.__esportsTrusted.step(30)'),true);
    state=await evaluate(`(()=>{const s=window.__esportsTrusted.snapshot();return {second:s.second,buildings:s.frame.structures.filter(b=>b.team!=='${team}').map(b=>({id:b.id,type:b.type,x:b.x,y:b.y,hp:b.hp,alive:b.isAlive})),
      actors:s.frame.champions.filter(c=>c.team==='${team}').map(c=>({x:c.x,y:c.y,alive:c.isAlive,attackTimer:c.attackTimer,visual:c.basicAttackVisual,damage:c.objectiveDamage,range:c.champion.range,legacy:c.champion.legacyInternalName,intent:c.actionIntent, target:c.actionIntent?.targetId,ruleset:c.champion.abilityRuleset,name:c.champion.displayName})),fingerprint:s.fingerprint};})()`);
    if(state.buildings.filter(b=>b.type==='barracks').every(b=>!b.alive))break;
  }
  results.push({team,mode,...state});console.log(JSON.stringify(results.at(-1)));
  assert.ok(state.buildings.filter(b=>b.type==='barracks').every(b=>!b.alive),'Side barracks still alive: '+JSON.stringify(state));
  assert.ok(state.actors.every(c=>c.ruleset==='original-v3-preview-2'));
  await writeFile('../docs/avatar-rework/barracks-'+team+'-20261024.png',Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
  await evaluate('window.testRoot.unmount()');
 }
 await writeFile('../docs/avatar-rework/barracks-live-20261024.json',JSON.stringify({results,errors},null,2));assert.deepEqual(errors,[]);
}finally{socket.close();await fetch(cdp+'/json/close/'+target.id);}

