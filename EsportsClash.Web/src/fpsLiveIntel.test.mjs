import test from 'node:test';
import assert from 'node:assert/strict';
import {FpsLiveSimulation} from './fps/fpsLiveSimulation.ts';
import {FPS_IDENTITY_PERSONALITIES,generatePlayerDNA} from './fps/fpsIdentity.ts';
import {emptyLiveIntel,rememberLiveIntel,liveIntelBeliefs,assessLiveIntel,strongestLiveIntel,clearLiveIntel} from './fps/fpsLiveIntel.ts';
import {launchLiveGrenade} from './fps/fpsLiveGrenades.ts';

const plan={tempo:.6,structure:.7,aggression:.5,preparation:.7,freedom:.5,economy:.8};
const coach={...plan,rigidity:.7,communication:.7,leadership:.7,adaptability:.7,development:.5};
const chemistry={trust:.6,communication:.6,understanding:.6,leadershipAcceptance:.6,roleCompetition:.3};
const cards=Array.from({length:10},(_,i)=>({id:`intel-${i}`,name:`Player ${i}`,stats:{lan:80,iq:80,tf:80,clu:80,sta:80,flx:80,ldr:80}}));
const identity={players:Object.fromEntries(cards.map((p,i)=>[p.id,{id:p.id,personality:FPS_IDENTITY_PERSONALITIES[i],dna:generatePlayerDNA(p.id),intensity:.6,roleSuitability:.6,familiarity:.5}])),teams:{blue:{coach,plan,chemistry},red:{coach,plan,chemistry}}};
const game=()=>{const sim=new FpsLiveSimulation(cards.slice(0,5),cards.slice(5),1337,identity);sim.time=20;return sim;};
const sight=(id,x,z,observed=20)=>({key:`enemy:${id}`,enemyId:id,observerId:'observer',source:'sight',x,z,observed,confidence:.98,uncertainty:.45});
const addStack=(sim,p,site,count)=>{
  for(let i=0;i<count;i++)sim.observeIntel(p,sight(`known-${i}`,site==='A'?-19:20,14+i,sim.time),false);
};

test('multiple sightings survive weaker noises, decay and expand without tracking hidden movement',()=>{
  const memory=emptyLiveIntel();rememberLiveIntel(memory,sight('one',-19,14),20);rememberLiveIntel(memory,sight('two',-20,15),20);
  rememberLiveIntel(memory,{key:'sound:4:4',observerId:'listener',source:'footstep',x:23,z:15,observed:20.3,confidence:.5,uncertainty:3},20.3);
  assert.equal(assessLiveIntel(memory,20.3).A.identified,2);assert.equal(assessLiveIntel(memory,20.3).B.identified,0);
  assert.equal(strongestLiveIntel(memory,{x:-19,z:12},20.3).source,'sight');
  const before=liveIntelBeliefs(memory,20).find(c=>c.enemyId==='one'),after=liveIntelBeliefs(memory,24).find(c=>c.enemyId==='one');
  assert.ok(after.certainty<before.certainty);assert.ok(after.radius>before.radius);assert.equal(after.x,-19);assert.equal(after.z,14);
  assert.equal(liveIntelBeliefs(memory,35).length,0);
});

test('echoed reports do not refresh their age or multiply identified enemies; noises do not become counts',()=>{
  const memory=emptyLiveIntel(),original=sight('one',20,14);
  rememberLiveIntel(memory,original,20);
  for(let i=0;i<5;i++)rememberLiveIntel(memory,{...original,observerId:`observer-${i}`,via:`messenger-${i}`,confidence:.8},24);
  const assessment=assessLiveIntel(memory,24);assert.equal(assessment.B.identified,1);assert.equal(assessment.B.confirmed,0);
  assert.equal(memory.contacts[0].observed,20);
  for(let i=0;i<20;i++)rememberLiveIntel(memory,{key:`sound:${i}`,observerId:'listener',source:'footstep',x:22,z:12+i*.05,observed:24,confidence:.5,uncertainty:3},24);
  assert.equal(assessLiveIntel(memory,24).B.identified,1,'Noises must neither acquire identities nor crowd a useful sighting out of memory');
  assert.ok(assessLiveIntel(memory,24).B.strength<.8);
});

test('empty-angle checks weaken only the fully observed small area, not obscured or broad uncertainty',()=>{
  const memory=emptyLiveIntel();rememberLiveIntel(memory,sight('one',-19,14),20);
  const confidence=memory.contacts[0].confidence;
  clearLiveIntel(memory,20.5,()=>false,[]);assert.equal(memory.contacts[0].confidence,confidence);
  clearLiveIntel(memory,20.5,()=>true,[{x:-19,z:14}]);assert.equal(memory.contacts[0].confidence,confidence);
  clearLiveIntel(memory,20.5,()=>true,[]);assert.ok(memory.contacts[0].confidence<confidence*.3);
  const old=emptyLiveIntel();rememberLiveIntel(old,sight('one',-19,14),20);clearLiveIntel(old,23,()=>true,[]);
  assert.equal(old.contacts[0].confidence,.98,'Seeing the last point cannot clear all possible movement after three seconds');
});

test('team reports arrive after communication delay, preserve the old position, and never acquire a firing target',()=>{
  const sim=game(),observer=sim.actors[0],receiver=sim.actors[1],enemy=sim.actors[5];
  for(const p of sim.actors)Object.assign(p,{hp:0,nextSense:Infinity,nextThink:Infinity,nextShot:Infinity});
  Object.assign(observer,{hp:100,x:-19,z:-10,yaw:0,bomb:false});
  Object.assign(receiver,{hp:100,x:31,z:30,yaw:0,bomb:false});
  Object.assign(enemy,{hp:100,x:-19,z:-5,yaw:Math.PI});
  sim.phase='live';sim.perceive(observer);assert.equal(observer.target,enemy.id);assert.equal(receiver.intel.contacts.length,0);
  const due=sim.reports.find(r=>r.contact.enemyId===enemy.id).at;assert.ok(due>20.1);
  enemy.x=31;enemy.z=-10;
  while(sim.time+1/30<due){sim.step();assert.equal(receiver.intel.contacts.length,0);}
  sim.step();const report=receiver.intel.contacts.find(c=>c.enemyId===enemy.id);
  assert.ok(report);assert.equal(report.x,-19);assert.equal(report.z,-5);assert.equal(report.observed,20);assert.equal(report.via,observer.id);
  assert.equal(receiver.target,undefined);assert.equal(receiver.impact.shots,0);
});

test('hearing and unseen damage provide uncertain anonymous clues, not precise shooter identities',()=>{
  const sim=game(),listener=sim.actors[0],enemy=sim.actors[5];for(const p of sim.actors)p.hp=0;
  Object.assign(listener,{hp:100,x:-19,z:-10,yaw:0,armor:0,target:undefined});
  Object.assign(enemy,{hp:100,x:-19,z:-12,yaw:0});listener.skills.gameSense=1;
  sim.hear(enemy,17);assert.equal(listener.target,undefined);assert.equal(assessLiveIntel(listener.intel,20).A.identified,0);
  assert.ok(listener.intel.contacts.every(c=>!c.enemyId&&c.uncertainty>=2.3));
  sim.fire(enemy,listener);assert.ok(listener.hp>0&&listener.hp<100);
  const damage=listener.intel.contacts.find(c=>c.source==='damage');assert.ok(damage);assert.equal(damage.enemyId,undefined);
  assert.ok(Math.hypot(damage.x-enemy.x,damage.z-enemy.z)>1);assert.equal(listener.target,undefined);
});

test('smoke blocks negative evidence as well as positive sight',()=>{
  const sim=game(),p=sim.actors[0];for(const a of sim.actors)a.hp=0;
  Object.assign(p,{hp:100,x:-19,z:-10,yaw:0});sim.time=20.5;
  sim.observeIntel(p,sight('old',-19,-5,20),false);sim.smokes=[{id:1,x:-19,z:-7,y:1.5,radius:2,expires:30}];
  sim.perceive(p);assert.equal(p.intel.contacts[0].confidence,.98);
  sim.smokes=[];sim.perceive(p);assert.ok(p.intel.contacts[0].confidence<.3);
});

test('a visible smoke detonation creates an anonymous utility cue before the smoke occludes it',()=>{
  const sim=game(),listener=sim.actors[0];for(const a of sim.actors)a.hp=0;
  Object.assign(listener,{hp:100,x:-19,z:-10,yaw:0,target:undefined});
  sim.grenades=[launchLiveGrenade(1,'smoke','unseen-thrower','red',{x:-19,z:-6},{x:-19,z:-5},20)];
  for(let i=0;i<35;i++){sim.time+=1/30;sim.stepGrenades(1/30);}
  assert.equal(sim.smokes.length,1);assert.ok(listener.intel.contacts.some(c=>c.source==='utility'&&!c.enemyId));
  assert.equal(listener.target,undefined);assert.equal(assessLiveIntel(listener.intel,sim.time).A.identified,0);
});

test('defense holds against a sound cue, reinforces confirmed pressure, preserves an anchor and resets stale calls',()=>{
  const sim=game(),allies=sim.actors.slice(0,5),caller=allies[2];
  allies.forEach((p,i)=>{p.role=i===0?'anchor':i===2?'caller':'trade';p.target=undefined;});
  sim.observeIntel(caller,{key:'noise',observerId:caller.id,source:'footstep',x:20,z:14,observed:20,confidence:.5,uncertainty:4},false);
  sim.callFromInformation(caller,allies);assert.equal(sim.informationOrders.blue.mode,'watch');assert.equal(sim.informationOrders.blue.responders.length,0);
  sim.time=20.2;addStack(sim,caller,'B',2);
  sim.callFromInformation(caller,allies);const order=sim.informationOrders.blue;
  assert.equal(order.mode,'reinforce');assert.equal(order.responders.length,1);assert.ok(!order.responders.includes(allies[0].id));
  const responder=allies.find(p=>order.responders.includes(p.id));sim.decide(responder);
  assert.ok(responder.goal.x>10);assert.match(responder.intent,/Reinforce B/);
  sim.time=20.5;sim.observeIntel(caller,{key:'other-noise',observerId:caller.id,source:'footstep',x:-20,z:14,observed:20.5,confidence:.5,uncertainty:4},false);
  sim.callFromInformation(caller,allies);assert.equal(sim.informationOrders.blue.site,'B');
  sim.time=40;sim.callFromInformation(caller,allies);assert.equal(sim.informationOrders.blue.mode,'recheck');assert.equal(sim.informationOrders.blue.responders.length,0);
});

test('corroborated gunfire and movement can draw one supporter without inventing an enemy count',()=>{
  const sim=game(),allies=sim.actors.slice(0,5),caller=allies[2];
  allies.forEach((p,i)=>{p.role=i===0?'anchor':'trade';p.target=undefined;});
  for(const [source,confidence] of [['gunfire',.64],['footstep',.5]])sim.observeIntel(caller,
    {key:`cue:${source}`,observerId:caller.id,source,x:20,z:14,observed:20,confidence,uncertainty:3},false);
  assert.equal(assessLiveIntel(caller.intel,20).B.identified,0);
  sim.callFromInformation(caller,allies);assert.equal(sim.informationOrders.blue.mode,'reinforce');
  assert.equal(sim.informationOrders.blue.responders.length,1);assert.match(sim.informationOrders.blue.reason,/Corroborated activity/);
  assert.ok(!sim.informationOrders.blue.reason.includes('spotted'));
});

test('attack redirects from a reported stack without reading hidden defense and does not immediately reverse',()=>{
  const a=game(),b=game();
  for(const sim of [a,b]){
    sim.time=45;sim.liveElapsed=30;sim.remaining=90;sim.site='A';sim.protocol.site='A';sim.protocol.phase='default';sim.bomb.status='carried';
    const caller=sim.actors[5];addStack(sim,caller,'A',3);
  }
  for(const enemy of b.actors.slice(0,5)){enemy.x=31;enemy.z=35;}
  a.callFromInformation(a.actors[5],a.actors.slice(5));b.callFromInformation(b.actors[5],b.actors.slice(5));
  assert.equal(a.site,'B');assert.equal(b.site,'B');assert.deepEqual(a.informationOrders.red,b.informationOrders.red);
  a.time=47;a.liveElapsed=32;addStack(a,a.actors[5],'B',3);
  a.callFromInformation(a.actors[5],a.actors.slice(5));assert.equal(a.site,'B');
});

test('reported pressure spends real delay utility without giving the defender a visible target',()=>{
  const sim=game(),p=sim.actors[3];Object.assign(p,{x:32,z:26,role:'anchor',smoke:1,utilityAt:0,target:undefined});
  addStack(sim,p,'B',2);const reason=sim.useInformationUtility(p,sim.actors.slice(0,5));
  assert.match(reason,/Delay reported B/);assert.equal(p.smoke,1);assert.equal(sim.grenades.length,0);assert.equal(p.utilityPreparation.kind,'smoke');assert.equal(p.target,undefined);
  sim.time+=.55;sim.releaseUtilityPreparation(p);
  assert.equal(p.smoke,0);assert.equal(sim.grenades.length,1);assert.equal(sim.grenades[0].kind,'smoke');
});

test('confirmed death removes the known threat and late reports cannot resurrect it; public snapshots exclude raw memory',()=>{
  const sim=game(),p=sim.actors[0],enemy=sim.actors[5];
  Object.assign(p,{x:-19,z:-10,yaw:0});Object.assign(enemy,{x:-19,z:-5,hp:1,armor:0});
  sim.observeIntel(p,sight(enemy.id,-19,-5),false);
  sim.fire(p,enemy);assert.equal(enemy.hp,0);assert.ok(!p.intel.contacts.some(c=>c.enemyId===enemy.id));
  sim.observeIntel(p,sight(enemy.id,-19,-5,19),false);assert.equal(p.intel.contacts.length,0);
  const snapshot=sim.snapshot();assert.equal(snapshot.version,'hexatrick-live-exhibition-v10');
  assert.equal('intel' in snapshot.players[0],false);assert.equal('sentReports' in snapshot.players[0],false);assert.equal('informationOrders' in snapshot,false);
  assert.ok(!JSON.stringify(snapshot).includes('riskTolerance'));assert.equal(typeof snapshot.players[0].information,'string');
});

test('confirmed objective information supersedes earlier uncertain site calls',()=>{
  const sim=game();sim.informationOrders.blue.reason='Possible B pressure — hold the other site';
  sim.bomb={status:'planted',site:'A',x:-23,z:21,remaining:25};
  const snapshot=sim.snapshot();assert.match(snapshot.teams.blue.information,/Device confirmed A/);assert.match(snapshot.teams.red.information,/Device planted A/);
  assert.ok(!snapshot.teams.blue.information.includes('Possible B'));
});
