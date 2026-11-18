// Flash pop spots and the CT information push when up in numbers (2026-11-17).
import test from 'node:test';
import assert from 'node:assert/strict';
import {FpsLiveSimulation} from './fps/fpsLiveSimulation.ts';
import {FPS_T_POSITIONS,FPS_CT_POSITIONS} from './fps/fpsPlayerArchitecture.ts';
import {FPS_IDENTITY_PERSONALITIES,generatePlayerDNA} from './fps/fpsIdentity.ts';
import {emptyLiveIntel,rememberLiveIntel} from './fps/fpsLiveIntel.ts';
import {liveGrenadeSightline} from './fps/fpsLiveGrenades.ts';
import {liveGroundHeight} from './fps/fpsLiveTerrain.ts';

const plan={tempo:.6,structure:.7,aggression:.5,preparation:.7,freedom:.5,economy:.8};
const coach={...plan,rigidity:.7,communication:.7,leadership:.7,adaptability:.7,development:.5};
const chemistry={trust:.6,communication:.6,understanding:.6,leadershipAcceptance:.6,roleCompetition:.3};
const cards=Array.from({length:10},(_,i)=>({id:`flash-push-${i}`,name:`Player ${i}`,stats:{rifling:80,sniping:80,entry:80,utility:80,positioning:80,shotcalling:80}}));
const identity={players:Object.fromEntries(cards.map((p,i)=>[p.id,{id:p.id,assignments:{t:FPS_T_POSITIONS[i%5],ct:FPS_CT_POSITIONS[i%5]},personality:FPS_IDENTITY_PERSONALITIES[i],dna:generatePlayerDNA(p.id),intensity:.6,roleSuitability:.6,familiarity:.5}])),teams:{blue:{coach,plan,chemistry},red:{coach,plan,chemistry}}};
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);

function game(){
  const sim=new FpsLiveSimulation(cards.slice(0,5),cards.slice(5),1337,identity);
  Object.assign(sim,{phase:'live',time:100,liveElapsed:30,remaining:90,site:'A',planCommit:0,defenseSetup:'standard'});
  sim.pendingBuys.clear();sim.grenades=[];sim.smokes=[];sim.fires=[];
  for(const p of sim.actors)Object.assign(p,{hp:100,target:undefined,seenAt:-100,lastShot:-100,damageAt:-100,intel:emptyLiveIntel(),
    channel:0,reload:0,bomb:false,utilityPreparation:undefined,smokeLineupId:undefined,patterns:[]});
  sim.actors[8].bomb=true;sim.bomb.status='carried';
  for(const team of ['blue','red'])sim.informationOrders[team]={mode:'hold',responders:[],until:0,strength:0,reason:'Hold'};
  sim.nextInformationProbe.blue=0;sim.nextInformationProbe.red=0;
  return sim;
}
/** Defenders (blue) with `alive` players against `enemies` attackers, every death confirmed. */
function advantage(alive,enemies){
  const sim=game(),defenders=sim.actors.filter(a=>!a.attacking),attackers=sim.actors.filter(a=>a.attacking);
  const homes=[{x:-19,z:13},{x:20,z:15},{x:0,z:8},{x:-12,z:10},{x:12,z:10}];
  defenders.forEach((p,i)=>Object.assign(p,i<alive?{...homes[i]}:{hp:0}));
  attackers.forEach((p,i)=>{if(i>=enemies){p.hp=0;sim.confirmedDeaths.add(p.id);}});
  defenders.slice(alive).forEach(p=>sim.confirmedDeaths.add(p.id));
  return {sim,allies:defenders.slice(0,alive)};
}

test('flash pop spot sits in front of the enemy toward the watched angle, in sight of their eyes',()=>{
  const sim=game(),p=sim.actors.find(a=>!a.attacking);
  Object.assign(p,{x:17,z:33,flash:1});
  const enemy={x:19,z:21};
  const pop=sim.flashPopSpot(p,enemy,p);
  assert.ok(pop,'a throwable pop spot exists');
  assert.ok(dist(pop,enemy)>=2&&dist(pop,enemy)<=9,`pop ${dist(pop,enemy).toFixed(1)} m from the enemy`);
  assert.ok(dist(pop,p)<dist(enemy,p),'pop is between the enemy and the angle they watch, not behind them');
  const eye={x:enemy.x,y:liveGroundHeight(enemy)+1.6,z:enemy.z};
  assert.ok(liveGrenadeSightline({x:pop.x,y:liveGroundHeight(pop)+1.6,z:pop.z},eye),'the enemy can see the pop');
});

test('a flash the thrower expects to pop far from anyone is not thrown',()=>{
  const sim=game(),p=sim.actors.find(a=>!a.attacking);
  Object.assign(p,{x:17,z:33,flash:1,yaw:Math.PI});
  // Expected pop far above/away from the spot: the thrower keeps the flash.
  sim.flashPopSpot=()=>undefined;
  const plan=sim.utilityFor(p.team).plan;
  sim.utilityFor(p.team).plan=(...args)=>{const r=plan.apply(sim.utilityFor(p.team),args);return r&&{...r,flightTime:3.2};};
  assert.equal(sim.throwUtility(p,'flash',{x:19,z:21}),false);
});

test('execute flash threats: fresh belief first, smoked holds skipped',()=>{
  const sim=game(),caller=sim.actors.find(a=>a.attacking);
  const holds=sim.map.definition.tactical.A.holds,entry=sim.map.definition.tactical.A.entries[0];
  const believed={x:holds[0].x+1,z:holds[0].z+1};
  rememberLiveIntel(caller.intel,{key:'enemy:x',enemyId:'x',observerId:caller.id,source:'sight',...believed,observed:sim.time-1,confidence:.95,uncertainty:.5},sim.time);
  const threats=sim.siteFlashThreats(caller,'A',entry);
  assert.ok(threats.length>0&&dist(threats[0],believed)<1,'the believed defender comes first');
  const smoked=holds[holds.length-1];
  sim.smokes=[{id:1,x:smoked.x,z:smoked.z,y:1.4,radius:4.8,startedAt:sim.time-2,expires:sim.time+12}];
  assert.ok(sim.siteFlashThreats(caller,'A',entry).every(t=>dist(t,smoked)>=5.8),'a smoked hold is not flashed');
});

test('CTs up 3v1 with no fresh contact push for information with a trade and keep a site guard',()=>{
  const {sim,allies}=advantage(3,1),caller=allies[0];
  sim.callFromInformation(caller,allies);
  const order=sim.informationOrders.blue;
  assert.equal(order.mode,'probe');
  assert.match(order.reason,/up 3v1/);
  assert.equal(order.responders.length,2);
  assert.equal(allies.filter(a=>!order.responders.includes(a.id)).length,1,'one defender stays on a site');
});

test('CTs up 2v1 send one scout; even numbers below four do not push',()=>{
  const two=advantage(2,1);
  two.sim.callFromInformation(two.allies[0],two.allies);
  assert.equal(two.sim.informationOrders.blue.mode,'probe');
  assert.equal(two.sim.informationOrders.blue.responders.length,1);
  assert.match(two.sim.informationOrders.blue.reason,/scout/);
  const even=advantage(3,3);
  even.sim.callFromInformation(even.allies[0],even.allies);
  assert.notEqual(even.sim.informationOrders.blue.mode,'probe');
});

test('a fresh sighting is not a reason to scout: no information push while in contact',()=>{
  const {sim,allies}=advantage(3,1),caller=allies[0],enemy=sim.actors.find(a=>a.attacking&&a.hp>0);
  rememberLiveIntel(caller.intel,{key:`enemy:${enemy.id}`,enemyId:enemy.id,observerId:caller.id,source:'sight',x:20,z:15,observed:sim.time,confidence:.98,uncertainty:.45},sim.time);
  sim.callFromInformation(caller,allies);
  assert.notEqual(sim.informationOrders.blue.mode,'probe');
});
