import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const settings=Object.fromEntries((await readFile('.env.evolution.local','utf8')).split(/\r?\n/).filter(line=>line&&!line.startsWith('#')).map(line=>{const at=line.indexOf('=');return [line.slice(0,at),line.slice(at+1).replace(/^(['"])(.*)\1$/,'$2')];}));
const cdp=process.env.REGISTRY_CDP??'http://127.0.0.1:9244';
const page=await(await fetch(cdp+'/json/new?about:blank',{method:'PUT'})).json();
const socket=new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
let sequence=0;const pending=new Map(),errors=[];
socket.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description??m.params.exceptionDetails.text);const p=pending.get(m.id);if(p){pending.delete(m.id);clearTimeout(p.timeout);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}});
const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence,timeout=setTimeout(()=>{pending.delete(id);reject(Error(method+' timed out'));},30000);pending.set(id,{resolve,reject,timeout});socket.send(JSON.stringify({id,method,params}));});
const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description??r.exceptionDetails.text);return r.result.value;};
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(expression){for(let i=0;i<120;i++){if(await evaluate(expression))return;await wait(250);}throw Error('Browser condition timed out: '+expression);}
async function navigate(url){await send('Page.navigate',{url});await until('document.readyState==="complete"');}
const report={date:'2026-10-24',scope:'Actual local registry and engine browser; simulated version/outage responses only inside an isolated browser fixture. No catalog mutations or asset jobs.'};
try{
  await send('Runtime.enable');await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await navigate('http://localhost:8089/evolution/registry/avatars');
  await until('!!document.querySelector("[name=email]") || !!document.querySelector("h1")');
  if(await evaluate('!!document.querySelector("[name=email]")')){
    // Credentials stay in process memory and the private browser session.
    await evaluate(`document.querySelector('[name=email]').value=${JSON.stringify(settings.EVOLUTION_OWNER_EMAIL??'owner@teamfight.local')};document.querySelector('[name=password]').value=${JSON.stringify(settings.EVOLUTION_OWNER_PASSWORD)};document.querySelector('[name=password]').form.requestSubmit();true`);
    await until('!document.querySelector("[name=password]")');
    await navigate('http://localhost:8089/evolution/registry/avatars');
  }
  await until('document.querySelector("h1")?.textContent==="Avatar registry"');
  report.roster=await evaluate(`({count:document.querySelectorAll('.manage-card').length,currentIdentity:document.body.textContent.includes('Solenne Vaelor'),draftLink:!![...document.querySelectorAll('a')].find(a=>a.textContent==='Design drafts')})`);
  assert.equal(report.roster.count,45);assert.ok(report.roster.currentIdentity);
  await writeFile('docs/avatar-registry-desktop.png',Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
  await navigate('http://localhost:8089/evolution/registry/avatars/c_solana');
  report.detail=await evaluate(`({name:document.querySelector('h1')?.textContent,skills:[...document.querySelectorAll('a')].filter(a=>a.href.includes('/catalog/skill/')).length,evidence:document.body.textContent.includes('Asset pipeline evidence')})`);
  assert.equal(report.detail.name,'Solenne Vaelor');assert.equal(report.detail.skills,4);assert.ok(report.detail.evidence);
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  report.mobile=await evaluate('({width:innerWidth,scroll:document.documentElement.scrollWidth})');
  assert.ok(report.mobile.scroll<=report.mobile.width+1,JSON.stringify(report.mobile));
  await writeFile('docs/avatar-registry-mobile.png',Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await navigate('http://localhost:8088');
  await until(`document.querySelector('[aria-label="Backoffice catalog connection"]')?.textContent.includes('Backoffice connected')`);
  report.app=await evaluate(`(async()=>{const snapshot=await(await fetch('/backend/api/v1/game-content')).json();const {validateGameContent}=await import('/src/gameContent.ts');return {valid:!!validateGameContent(snapshot),avatars:snapshot.records.filter(r=>r.kind==='avatar').length,hash:snapshot.hash};})()`);
  assert.ok(report.app.valid);assert.equal(report.app.avatars,45);
  await evaluate(`(async()=>{
    const main=await(await fetch('/src/main.tsx')).text();
    const reactUrl=main.split('"').find(s=>s.includes('/deps/react.js')),domUrl=main.split('"').find(s=>s.includes('/deps/react-dom_client.js'));
    const aram=await(await fetch('/src/components/AramMatchView.tsx')).text(),ctxUrl=aram.split('"').find(s=>s.includes('/src/GameContentContext.tsx'));
    const [rm,dm,ctx,{contentChampion},{CHAMPIONS,INITIAL_PLAYERS,INITIAL_COACHES},{AramMatchView}]=await Promise.all([import(reactUrl),import(domUrl),import(ctxUrl),import('/src/gameContent.ts'),import('/src/mockData.ts'),import('/src/components/AramMatchView.tsx')]);
    const React=rm.default??rm.t(),{createRoot}=dm.default??dm;
    window.registryActualFetch=window.fetch.bind(window);window.registryResponse=await(await window.registryActualFetch('/backend/api/v1/game-content')).json();window.registryOutage=false;
    window.fetch=(input,options)=>String(input).endsWith('/game-content')?(window.registryOutage?Promise.reject(Error('Fixture outage')):Promise.resolve(new Response(JSON.stringify(window.registryResponse),{status:200}))):window.registryActualFetch(input,options);
    const host=document.createElement('div');host.id='registry-fixture';document.body.append(host);
    function Probe(){const catalog=ctx.useGameContent(),connection=ctx.useGameContentConnection();const [frozen]=React.useState(()=>catalog?structuredClone(catalog):undefined);window.registryRefresh=connection.refresh;window.registryProbe={status:connection.status,hash:catalog?.hash,frozenHash:frozen?.hash,currentHp:contentChampion(CHAMPIONS[0],catalog).hp,frozenHp:contentChampion(CHAMPIONS[0],frozen).hp};return null;}
    const lineup=offset=>CHAMPIONS.slice(0,5).map((champion,i)=>({player:INITIAL_PLAYERS[offset+i],champion}));
    function MatchHarness(){const [key,setKey]=React.useState(0);window.registryRemount=()=>setKey(k=>k+1);return React.createElement(AramMatchView,{key,seed:71011,evaluationController:'baseline',evaluationStartPaused:true,evaluationRenderless:true,trustedServer:true,
      blueLineup:lineup(0),redLineup:lineup(5),blueCoach:INITIAL_COACHES[0],redCoach:INITIAL_COACHES[0],onExit:()=>{},onReplay:()=>{},onMatchComplete:()=>{}});}
    window.registryRoot=createRoot(host);window.registryRoot.render(React.createElement(ctx.GameContentProvider,null,React.createElement(React.Fragment,null,React.createElement(Probe),React.createElement(MatchHarness))));
  })()`);
  await until('window.registryProbe?.status==="connected"');
  await until('!!window.__esportsTrusted');
  const matchBefore=await evaluate(`(()=>{const s=window.__esportsTrusted.snapshot();return {fingerprint:s.fingerprint,randomState:s.randomState,championHp:s.frame.champions[0].champion.hp,maxHp:s.frame.champions[0].maxHp};})()`);
  const before=await evaluate('window.registryProbe');
  await evaluate(`window.registryResponse=structuredClone(window.registryResponse);window.registryResponse.hash='f'.repeat(64);window.registryResponse.records.find(r=>r.kind==='avatar'&&r.id==='c_solana').data.hp+=123;window.dispatchEvent(new Event('focus'));true`);
  await until(`window.registryProbe?.hash==='f'.repeat(64)`);
  const after=await evaluate('window.registryProbe');
  assert.equal(after.currentHp,before.currentHp+123);assert.equal(after.frozenHp,before.frozenHp);assert.equal(after.frozenHash,before.hash);
  const matchAfter=await evaluate(`(()=>{const s=window.__esportsTrusted.snapshot();return {fingerprint:s.fingerprint,randomState:s.randomState,championHp:s.frame.champions[0].champion.hp,maxHp:s.frame.champions[0].maxHp};})()`);
  assert.deepEqual(matchAfter,matchBefore);report.activeMatch={before:matchBefore,after:matchAfter};
  await evaluate('window.registryOutage=true;window.registryRefresh();true');await until('window.registryProbe?.status==="stale"');
  const outage=await evaluate('window.registryProbe');assert.equal(outage.hash,after.hash);
  await evaluate('window.registryOutage=false;window.dispatchEvent(new Event("online"));true');await until('window.registryProbe?.status==="connected"');
  report.refresh={before,after,outage,recovered:await evaluate('window.registryProbe')};
  await evaluate('window.registryOldTrusted=window.__esportsTrusted;window.registryRemount();true');
  await until('!!window.__esportsTrusted && window.__esportsTrusted!==window.registryOldTrusted');
  report.newMatch=await evaluate(`(()=>{const s=window.__esportsTrusted.snapshot();return {championHp:s.frame.champions[0].champion.hp,maxHp:s.frame.champions[0].maxHp};})()`);
  assert.ok(report.newMatch.championHp>matchBefore.championHp,JSON.stringify({before:matchBefore,after:report.newMatch}));
  await evaluate('window.registryRoot.unmount();document.querySelector("#registry-fixture").remove();window.fetch=window.registryActualFetch;true');
  assert.deepEqual(errors,[]);report.errors=errors;
  await writeFile('docs/avatar-registry-verification-20261024.json',JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report));
}finally{socket.close();await fetch(cdp+'/json/close/'+page.id);}
