// CT rotation hesitation on incomplete information (2026-11-17): contested home lanes hold responders on
// non-firm calls, noise-only calls are verified briefly (per tendencies), callers do not strip a contested
// site on a non-firm call, and firm calls are always followed.
import test from 'node:test';
import assert from 'node:assert/strict';
import {FPS_T_POSITIONS,FPS_CT_POSITIONS} from './fps/fpsPlayerArchitecture.ts';
import {FpsLiveSimulation} from './fps/fpsLiveSimulation.ts';
import {FPS_IDENTITY_PERSONALITIES,generatePlayerDNA} from './fps/fpsIdentity.ts';
import {emptyLiveIntel,liveIntelBeliefs} from './fps/fpsLiveIntel.ts';

const plan={tempo:.6,structure:.7,aggression:.5,preparation:.7,freedom:.5,economy:.8};
const coach={...plan,rigidity:.7,communication:.7,leadership:.7,adaptability:.7,development:.5};
const chemistry={trust:.6,communication:.6,understanding:.6,leadershipAcceptance:.6,roleCompetition:.3};
const cards=Array.from({length:10},(_,i)=>({id:`rh-${i}`,name:`Player ${i}`,stats:{rifling:80,positioning:80,entry:80,sniping:80,utility:80,shotcalling:80}}));
const identity={players:Object.fromEntries(cards.map((p,i)=>[p.id,{id:p.id,assignments:{t:FPS_T_POSITIONS[i%5],ct:FPS_CT_POSITIONS[i%5]},personality:FPS_IDENTITY_PERSONALITIES[i],dna:generatePlayerDNA(p.id),intensity:.6,roleSuitability:.6,familiarity:.5}])),teams:{blue:{coach,plan,chemistry},red:{coach,plan,chemistry}}};
const game=(options={})=>{const sim=new FpsLiveSimulation(cards.slice(0,5),cards.slice(5),1337,identity,{mapId:'fontessa',...options});sim.time=20;return sim;};
const belief=(extra)=>({certainty:.7,age:.5,radius:2,...extra});
const order=(sim,p,extra={})=>({mode:'reinforce',site:'A',responders:[p.id],until:sim.time+5,strength:1,reason:'test',issuedAt:sim.time,callerId:p.id,...extra});
const defender=sim=>sim.actors.find(a=>!a.attacking&&sim.defenseHome(a)==='B'&&a.position!=='CT_ANCHOR_B');

test('a lane is contested by an identified attacker, two separate sounds or a confident sound on site; not by one faint sound',()=>{
  const sim=game(),tactical=sim.map.definition.tactical,entry=tactical.B.entries[0],site=sim.map.definition.sites.B;
  assert.equal(sim.laneContact('B',[belief({x:entry.x,z:entry.z,source:'footstep',certainty:.4})]).contested,false);
  assert.equal(sim.laneContact('B',[belief({x:site.x+2,z:site.z,source:'footstep'})]).contested,true,'a confident fresh sound on the site itself');
  assert.equal(sim.laneContact('B',[belief({x:entry.x,z:entry.z,source:'footstep',certainty:.4}),belief({x:entry.x+6,z:entry.z,source:'gunfire',certainty:.4})]).contested,true);
  // An identified attacker on the lane counts even well outside the site centre.
  const far=[...tactical.B.entries,tactical.mid.splits.B].find(q=>Math.hypot(q.x-site.x,q.z-site.z)>22);
  if(far)assert.equal(sim.laneContact('B',[belief({x:far.x,z:far.z,enemyId:'t1',source:'sight'})]).contested,true);
  assert.equal(sim.laneContact('B',[belief({x:entry.x,z:entry.z,enemyId:'t1',source:'sight',age:6})]).contested,false,'stale information does not hold a lane');
});

test('a contested home lane holds a responder on a non-firm call, never on a firm one',()=>{
  const sim=game(),p=defender(sim),entry=sim.map.definition.tactical.B.entries[0];
  p.tendencies={...p.tendencies,rotationCommitment:20};
  const contact=[belief({x:entry.x,z:entry.z,enemyId:'t1',source:'sight'})];
  assert.match(sim.rotationHesitation(p,order(sim,p),'B',contact),/Own contact at B/);
  assert.equal(sim.rotationHesitation(p,order(sim,p,{firm:true}),'B',contact),undefined);
  p.tendencies={...p.tendencies,rotationCommitment:95};
  p.hesitatedOrder=undefined;
  assert.doesNotMatch(sim.rotationHesitation(p,order(sim,p,{mode:'rotate',issuedAt:sim.time-10}),'B',contact)??'',/Own contact/,'a fully committed rotator goes');
});

test('a call built on sounds alone is verified first; a sighted call is not; verifiers wait longer',()=>{
  const sim=game(),p=defender(sim),siteA=sim.map.definition.sites.A;
  const noise=[belief({x:siteA.x,z:siteA.z,source:'footstep'})],seen=[belief({x:siteA.x,z:siteA.z,enemyId:'t1',source:'sight'})];
  p.tendencies={...p.tendencies,informationVerification:90,rotationCommitment:10};
  const heard={reason:'Corroborated activity at A; send support, keep B covered'};
  assert.match(sim.rotationHesitation(p,order(sim,p,heard),'B',noise),/Confirm the A call/);
  assert.match(p.radioMessage??'',/Only noise on A/);
  p.tendencies={...p.tendencies,informationVerification:0};
  assert.equal(sim.rotationHesitation(p,order(sim,p,heard),'B',seen),undefined,'an identified attacker on the called site: go');
  assert.equal(sim.rotationHesitation(p,order(sim,p,{reason:'Multiple spotted A; send support, keep B covered'}),'B',[]),undefined,'a sighted call is trusted');
  assert.equal(sim.rotationHesitation(p,order(sim,p,{...heard,issuedAt:sim.time-3}),'B',noise),undefined,'verification is brief');
  const wait=v=>{p.tendencies={...p.tendencies,informationVerification:v,rotationCommitment:10};let t=0;for(;t<3;t+=.05)if(!sim.rotationHesitation(p,order(sim,p,{...heard,issuedAt:sim.time-t}),'B',noise))break;return t;};
  assert.ok(wait(95)>wait(5)+.5,'verifying players take longer');
});

test('a caller does not strip a site whose lane is still contested on a non-firm reinforce',()=>{
  const sim=game(),allies=sim.actors.filter(a=>!a.attacking),caller=allies.find(a=>a.role==='caller');
  for(const a of allies)Object.assign(a,{target:undefined,channel:0,intel:emptyLiveIntel(),intelManaged:true});
  const siteA=sim.map.definition.sites.A,entryB=sim.map.definition.tactical.B.entries[0];
  const report=(id,x,z)=>sim.observeIntel(caller,{key:`enemy:${id}`,enemyId:id,observerId:caller.id,source:'sight',x,z,observed:sim.time,confidence:.98,uncertainty:.45},false);
  report('a1',siteA.x,siteA.z+1);report('a2',siteA.x+1,siteA.z+2);
  sim.callFromInformation(caller,allies);
  const plain=sim.informationOrders[caller.team];
  assert.equal(plain.mode,'reinforce');assert.equal(plain.responders.length,1);
  report('b1',entryB.x,entryB.z);
  sim.informationOrders[caller.team]={mode:'hold',responders:[],until:0,strength:0,reason:'reset'};
  sim.callFromInformation(caller,allies);
  const held=sim.informationOrders[caller.team];
  assert.equal(held.responders.length,0);assert.match(held.reason,/B lane still contested/);
  assert.ok(liveIntelBeliefs(caller.intel,sim.time).length>=3);
});

test('re-issuing an unchanged call keeps the call time; the static ablation keeps the old behaviour',()=>{
  const sim=game(),allies=sim.actors.filter(a=>!a.attacking),caller=allies.find(a=>a.role==='caller');
  for(const a of allies)Object.assign(a,{target:undefined,channel:0,intel:emptyLiveIntel(),intelManaged:true});
  const siteA=sim.map.definition.sites.A;
  for(const [i,id] of ['a1','a2'].entries())sim.observeIntel(caller,{key:`enemy:${id}`,enemyId:id,observerId:caller.id,source:'sight',x:siteA.x+i,z:siteA.z,observed:sim.time,confidence:.98,uncertainty:.45},false);
  sim.callFromInformation(caller,allies);const first=sim.informationOrders[caller.team].issuedAt;
  sim.time+=5.5;for(const id of ['a1','a2'])sim.observeIntel(caller,{key:`enemy:${id}`,enemyId:id,observerId:caller.id,source:'sight',x:siteA.x,z:siteA.z,observed:sim.time,confidence:.98,uncertainty:.45},false);
  sim.callFromInformation(caller,allies);
  assert.equal(sim.informationOrders[caller.team].issuedAt,first);
  const ablation=game({diagnostics:{staticRoles:true}}),p=defender(ablation),entry=ablation.map.definition.tactical.B.entries[0];
  assert.equal(ablation.rotationHesitation(p,order(ablation,p),'B',[belief({x:entry.x,z:entry.z,enemyId:'t1',source:'sight'})]),undefined);
});
