import test from 'node:test';
import assert from 'node:assert/strict';
import {FpsLiveSimulation} from './fps/fpsLiveSimulation.ts';
import {FPS_T_POSITIONS,FPS_CT_POSITIONS} from './fps/fpsPlayerArchitecture.ts';
import {FPS_IDENTITY_PERSONALITIES,generatePlayerDNA} from './fps/fpsIdentity.ts';
import {rememberLiveIntel} from './fps/fpsLiveIntel.ts';

const plan={tempo:.6,structure:.7,aggression:.5,preparation:.7,freedom:.5,economy:.8};
const coach={...plan,rigidity:.7,communication:.7,leadership:.7,adaptability:.7,development:.5};
const chemistry={trust:.6,communication:.6,understanding:.6,leadershipAcceptance:.6,roleCompetition:.3};
const cards=Array.from({length:10},(_,i)=>({id:`caller-polish-${i}`,name:`Player ${i}`,stats:{rifling:80,sniping:80,entry:80,utility:80,positioning:80,shotcalling:80}}));
const identity={players:Object.fromEntries(cards.map((p,i)=>[p.id,{id:p.id,assignments:{t:FPS_T_POSITIONS[i%5],ct:FPS_CT_POSITIONS[i%5]},personality:FPS_IDENTITY_PERSONALITIES[i],dna:generatePlayerDNA(p.id),intensity:.6,roleSuitability:.6,familiarity:.5}])),teams:{blue:{coach,plan,chemistry},red:{coach,plan,chemistry}}};
function game(){
  const sim=new FpsLiveSimulation(cards.slice(0,5),cards.slice(5),1337,identity);
  Object.assign(sim,{phase:'live',time:100,liveElapsed:30,remaining:90,site:'A',planCommit:0,defenseSetup:'standard'});
  sim.pendingBuys.clear();
  for(const p of sim.actors)Object.assign(p,{hp:100,x:-19,z:13,target:undefined,seenAt:-100,lastShot:-100,damageAt:-100,
    channel:0,reload:0,bomb:false,utilityPreparation:undefined,smokeLineupId:undefined});
  sim.actors[8].bomb=true;
  sim.bomb.status='carried';
  sim.informationOrders.blue={mode:'hold',responders:[],until:0,strength:0,reason:'Hold'};
  sim.informationOrders.red={mode:'hold',responders:[],until:0,strength:0,reason:'Hold'};
  return sim;
}
function sight(sim,caller,id,site,{bomb=false,age=0}={}){
  rememberLiveIntel(caller.intel,{key:`enemy:${id}`,enemyId:id,observerId:caller.id,source:'sight',x:site==='A'?-20:20,z:15,
    observed:sim.time-age,confidence:.98,uncertainty:.45,carryingBomb:bomb},sim.time);
}
function reassess(sim,caller,allies){
  sim.callFromInformation(caller,allies);
  if(caller.planAssessmentAt>sim.time){const delay=caller.planAssessmentAt-sim.time+.01;sim.time+=delay;sim.liveElapsed+=delay;sim.callFromInformation(caller,allies);}
}

test('fresh C4 reports can redirect an active call without needing a larger pressure total',()=>{
  const a=game(),b=game();
  for(const sim of [a,b]){
    const caller=sim.actors[2];
    sim.informationOrders.blue={mode:'reinforce',site:'A',responders:[],until:110,strength:2.9,reason:'Earlier A contact',callerId:caller.id,issuedAt:98};
    sight(sim,caller,'bomb-carrier','B',{bomb:true});sight(sim,caller,'escort','B');
  }
  b.actors.slice(5).forEach(p=>Object.assign(p,{x:31,z:-40}));
  for(const sim of [a,b])sim.callFromInformation(sim.actors[2],sim.actors.slice(0,5));
  assert.equal(a.informationOrders.blue.site,'B');assert.equal(a.informationOrders.blue.mode,'reinforce');
  assert.equal(a.informationOrders.blue.responders.length,1);
  assert.deepEqual(a.informationOrders.blue,b.informationOrders.blue,'Hidden positions cannot affect the IGL call');
});

test('seeing C4 draws support toward it while an unconfirmed opposite site retains its anchor',()=>{
  const sim=game(),caller=sim.actors[2],allies=sim.actors.slice(0,5);
  sight(sim,caller,'a-one','A');sight(sim,caller,'a-two','A');sight(sim,caller,'bomb-carrier','B',{bomb:true});
  sim.callFromInformation(caller,allies);
  const order=sim.informationOrders.blue;
  assert.equal(order.site,'B');assert.equal(order.mode,'reinforce');assert.equal(order.responders.length,1);
  assert.ok(!order.responders.includes(allies.find(a=>a.position==='CT_ANCHOR_A').id));
  assert.match(order.reason,/Confirmed C4/);
  sim.time+=.1;sim.callFromInformation(caller,allies);
  assert.equal(sim.informationOrders.blue.issuedAt,order.issuedAt,'A repeated decoy report must not postpone the support command');
});

test('the opposite anchor can collapse when every remaining opponent is freshly located',()=>{
  const sim=game(),caller=sim.actors[2],allies=sim.actors.slice(0,5),enemies=sim.actors.slice(5);
  enemies.slice(1).forEach(p=>sim.confirmedDeaths.add(p.id));sight(sim,caller,enemies[0].id,'B');
  sim.callFromInformation(caller,allies);
  const order=sim.informationOrders.blue,anchor=allies.find(p=>p.position==='CT_ANCHOR_A');
  assert.equal(order.mode,'rotate');assert.ok(order.responders.includes(anchor.id));assert.match(order.reason,/All 1 remaining/);
  const issuedAt=order.issuedAt,readyAt=order.readyAt;
  sim.time+=.1;sim.callFromInformation(caller,allies);
  assert.equal(sim.informationOrders.blue.issuedAt,issuedAt,'Repeating the same evidence must not restart command delay');
  assert.equal(sim.informationOrders.blue.readyAt,readyAt);
});

test('stale last-opponent sightings and anonymous noises cannot release the opposite anchor',()=>{
  for(const source of ['stale','noise']){
    const sim=game(),caller=sim.actors[2],allies=sim.actors.slice(0,5),enemies=sim.actors.slice(5);
    enemies.slice(1).forEach(p=>sim.confirmedDeaths.add(p.id));
    if(source==='stale')sight(sim,caller,enemies[0].id,'B',{age:2});
    else rememberLiveIntel(caller.intel,{key:'noise',observerId:caller.id,source:'gunfire',x:20,z:15,observed:sim.time,confidence:.98,uncertainty:3},sim.time);
    sim.callFromInformation(caller,allies);
    assert.ok(!sim.informationOrders.blue.responders.includes(allies.find(p=>p.position==='CT_ANCHOR_A').id));
    assert.notEqual(sim.informationOrders.blue.mode,'rotate');
  }
});

test('entry losses do not redirect the device into a stronger reported stack',()=>{
  const sim=game(),allies=sim.actors.slice(5),caller=allies[0];sim.roundSiteKills.red=2;
  sight(sim,caller,'a-one','A');sight(sim,caller,'a-two','A');
  for(let i=0;i<3;i++)sight(sim,caller,`b-${i}`,'B');
  reassess(sim,caller,allies);
  assert.equal(sim.site,'A');assert.notEqual(sim.informationOrders.red.mode,'rotate');
});

test('late redirects use the carrier and regroup travel plus plant budget',()=>{
  for(const remaining of [32,21]){
    const sim=game(),allies=sim.actors.slice(5),caller=allies[0];sim.remaining=remaining;
    for(let i=0;i<3;i++)sight(sim,caller,`a-${i}`,'A');
    reassess(sim,caller,allies);
    assert.equal(sim.site,remaining===32?'B':'A',`Redirect with ${remaining}s must account for actual reachable travel and plant time`);
  }
});

test('a dropped or missing carrier never receives a fictitious whole-team redirect',()=>{
  const sim=game(),allies=sim.actors.slice(5),caller=allies[0];allies.forEach(a=>a.bomb=false);
  for(let i=0;i<3;i++)sight(sim,caller,`a-${i}`,'A');
  reassess(sim,caller,allies);assert.equal(sim.site,'A');assert.notEqual(sim.informationOrders.red.mode,'rotate');
});
