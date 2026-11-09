import {mkdir, writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
// Track 1 live check: renders every battlefield feature kind, all lighting presets and element tints in the real Babylon viewer.
const base=process.env.BABYLON_CHECK_URL??'http://localhost:5199';
const cdp=process.env.BABYLON_CDP??'http://127.0.0.1:9338';
const outDir=process.env.OUTPUT_DIR??'../docs/battlefield-features';
await mkdir(outDir,{recursive:true});
const target=await(await fetch(cdp+'/json/new?about:blank',{method:'PUT'})).json();
const socket=new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
let id=0;const pending=new Map(),errors=[];
socket.addEventListener('message',event=>{const m=JSON.parse(event.data);
  if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description??m.params.exceptionDetails.text);
  if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')errors.push(m.params.args.map(a=>a.value??a.description).join(' '));
  const p=pending.get(m.id);if(p){pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}});
const send=(method,params={})=>new Promise((resolve,reject)=>{const key=++id,timer=setTimeout(()=>reject(Error(method+' timed out')),120000);pending.set(key,{resolve,reject,timer});socket.send(JSON.stringify({id:key,method,params}));});
const evaluate=async expression=>{const result=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description??result.exceptionDetails.text);return result.result.value;};
const shot=async name=>{await new Promise(r=>setTimeout(r,700));const s=await send('Page.captureScreenshot',{format:'png'});await writeFile(`${outDir}/${name}.png`,Buffer.from(s.data,'base64'));};
try{
  await send('Runtime.enable');await send('Emulation.setDeviceMetricsOverride',{width:1440,height:810,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:base});await new Promise(resolve=>setTimeout(resolve,4000));
  const report=await evaluate(`(async()=>{
    const {BabylonMatchViewer}=await import('/src/match-viewer/BabylonMatchViewer.ts');
    const {buildArenaFeatures,resolveArenaAtmosphere}=await import('/src/match-viewer/battlefieldFeatures.ts');
    const {captureViewerSnapshot}=await import('/src/match-viewer/MatchViewer.ts');
    const {ARENA_WIDTH,ARENA_HEIGHT}=await import('/src/arenaLayout.ts');
    const host=document.createElement('div');host.id='feature-check';host.style.cssText='position:fixed;inset:0;background:#071419;z-index:99999';document.body.append(host);
    const viewer=await BabylonMatchViewer.create(host,ARENA_WIDTH,ARENA_HEIGHT,0,ARENA_WIDTH,()=>{});
    window.fv=viewer;window.mkFrame=(second,element,lighting)=>captureViewerSnapshot({
      second,champions:[],minions:[],structures:[],camps:[],dragon:{id:'dragon',x:0,y:0,hp:0,maxHp:1,isAlive:false},wards:[],projectiles:[],spells:[],
      features:buildArenaFeatures({second,supplyCaptureSeconds:3,
        scuttlers:[{id:'scuttle_n',x:1330,y:330,hp:60,maxHp:100,isAlive:true,shrineTeam:'blue',shrineExpiresAt:second+40},{id:'scuttle_s',x:1470,y:1110,hp:100,maxHp:100,isAlive:true}],
        plants:[{id:'p_blast',kind:'blast_cone',x:1250,y:300,isAlive:true},{id:'p_blast_d',kind:'blast_cone',x:1180,y:300,isAlive:false},
          {id:'p_bloom',kind:'scryer_bloom',x:1550,y:340,isAlive:true},{id:'p_bloom_d',kind:'scryer_bloom',x:1620,y:340,isAlive:false},
          {id:'p_fruit',kind:'honeyfruit',x:1400,y:420,isAlive:true},{id:'p_fruit_d',kind:'honeyfruit',x:1480,y:420,isAlive:false}],
        portals:[{id:'gate_a',team:'blue',fromX:1300,y:0,fromY:560,toX:1300,toY:260,expiresAt:second+30}],
        supplyDrop:{id:'drop',x:1400,y:720,active:true,capturingTeam:'red',captureProgress:1.8}}),
      atmosphere:resolveArenaAtmosphere(second,element,lighting)});
    return {ok:true};
  })()`);
  assert.ok(report.ok);
  const views=[['river-north',1400,360,3.2,60,null,undefined],['mid-plaza',1400,720,3.2,60,null,undefined],['river-south',1470,1110,3.4,60,null,undefined],
    ['dusk-ocean',1400,720,2.65,1100,'ocean',undefined],['overcast-infernal',1400,360,2.65,60,'infernal','overcast']];
  const results=[];
  for(const [name,x,y,zoom,second,element,lighting] of views){
    const state=await evaluate(`(()=>{const f=window.mkFrame(${second},${JSON.stringify(element)},${JSON.stringify(lighting??null)}||undefined);
      window.fv.loadSnapshot(f);window.fv.draw(${x},${y},${zoom});window.fv.draw(${x},${y},${zoom});
      const h=document.querySelector('#feature-check');return {actors:Number(h.dataset.actors),lighting:h.dataset.lighting,element:h.dataset.arenaElement,available:window.fv.isAvailable()};})()`);
    await shot(name);results.push({name,...state});
  }
  assert.ok(results.every(r=>r.available),JSON.stringify(results));
  assert.ok(results.every(r=>r.actors>=12),'all 12 feature actors rendered: '+JSON.stringify(results));
  assert.equal(results[3].lighting,'dusk');assert.equal(results[3].element,'ocean');assert.equal(results[4].lighting,'overcast');assert.equal(results[0].lighting,'daylight');
  // Disposal: features disappear when their data does.
  const cleared=await evaluate(`(()=>{const f=window.mkFrame(61,null);window.fv.loadSnapshot({...f,tick:61*30,actors:[]});window.fv.draw(1400,720,3);return Number(document.querySelector('#feature-check').dataset.actors);})()`);
  assert.equal(cleared,0);
  await writeFile(`${outDir}/report.json`,JSON.stringify({date:new Date().toISOString(),views:results,cleared,errors},null,2));
  assert.deepEqual(errors,[],'browser errors: '+errors.join('\n'));
  console.log(JSON.stringify({results,cleared,errors},null,2));
}finally{try{await fetch(cdp+'/json/close/'+target.id);}catch{}socket.close();}

