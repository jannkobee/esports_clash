import test from 'node:test';
import assert from 'node:assert/strict';
import {NullEngine,Scene} from '@babylonjs/core';
import {FpsLiveViewer} from './fps/fpsLiveViewer.ts';
import {FpsLiveSimulation} from './fps/fpsLiveSimulation.ts';
import {launchLiveGrenade,stepLiveGrenade} from './fps/fpsLiveGrenades.ts';
import {chooseLiveApproach,liveAssaultApproaches,liveRetakeApproaches} from './fps/fpsLiveBrain.ts';
import {LIVE_MARKET_PASSAGE,findLivePath,distance,liveWalkable} from './fps/fpsLiveMap.ts';
import {fpsBehaviorPreferences,FPS_T_POSITIONS,FPS_CT_POSITIONS} from './fps/fpsPlayerArchitecture.ts';
import {FPS_IDENTITY_PERSONALITIES,generatePlayerDNA} from './fps/fpsIdentity.ts';

const plan={tempo:.6,structure:.7,aggression:.5,preparation:.7,freedom:.5,economy:.8};
const coach={...plan,rigidity:.7,communication:.7,leadership:.7,adaptability:.7,development:.5};
const chemistry={trust:.6,communication:.6,understanding:.6,leadershipAcceptance:.6,roleCompetition:.3};
const cards=Array.from({length:10},(_,i)=>({id:`autonomy-${i}`,name:`Player ${i}`,stats:{rifling:80,sniping:80,entry:80,utility:80,positioning:80,shotcalling:80}}));
const identity={players:Object.fromEntries(cards.map((p,i)=>[p.id,{id:p.id,assignments:{t:FPS_T_POSITIONS[i%5],ct:FPS_CT_POSITIONS[i%5]},personality:FPS_IDENTITY_PERSONALITIES[i],dna:generatePlayerDNA(p.id),intensity:.6,roleSuitability:.6,familiarity:.5}])),teams:{blue:{coach,plan,chemistry},red:{coach,plan,chemistry}}};
function game(){
  const sim=new FpsLiveSimulation(cards.slice(0,5),cards.slice(5),1337,identity);
  Object.assign(sim,{phase:'live',time:40,roundLiveAt:0,liveElapsed:25,remaining:90,site:'B'});
  sim.pendingBuys.clear();
  for(const p of sim.actors)Object.assign(p,{hp:0,bomb:false,target:undefined,contact:undefined,contactAt:-100,
    damageAt:-100,lastShot:-100,reload:0,weaponReady:0,channel:0,smoke:0,flash:0,incendiary:0,he:0,
    nextThink:Infinity,nextSense:Infinity,nextJump:Infinity,nextPeek:Infinity,jump:false,jumpY:0,jumpVy:0,
    speed:0,vx:0,vz:0,freezeDelay:0,goal:undefined,path:[],retreatUntil:0,peek:undefined,utilityPreparation:undefined});
  return sim;
}

test('the B produce-stall passage connects both mouths without a detour through the fountain lane',()=>{
  for(const p of Object.values(LIVE_MARKET_PASSAGE))assert.ok(liveWalkable(p));
  for(const [from,to] of [[{x:18,z:16},{x:18,z:24}],[{x:18,z:24},{x:18,z:16}]]){
    const path=findLivePath(from,to);let previous=from,total=0;
    assert.ok(path.some(p=>p.x===16.9),'Path must enter the actual narrow gap');
    for(const point of path){
      const d=distance(previous,point);total+=d;
      for(let t=0;t<=1;t+=.02)assert.ok(liveWalkable({x:previous.x+(point.x-previous.x)*t,z:previous.z+(point.z-previous.z)*t}));
      previous=point;
    }
    assert.ok(total<10,`The direct gap route should stay short (${total})`);
    assert.ok(distance(path.at(-1),to)<.1);
  }
});

test('a real moving actor traverses the narrow B passage in both directions without jumping',()=>{
  for(const [from,to] of [[{x:18,z:16},{x:18,z:24}],[{x:18,z:24},{x:18,z:16}]]){
    const sim=game(),p=sim.actors[0];
    Object.assign(p,{...from,hp:100,goal:to,path:findLivePath(from,to),equipped:p.weapon,ammo:20});
    let usedGap=false;
    for(let i=0;i<600&&distance(p,to)>.7;i++){
      sim.time+=1/30;sim.move(p,1/30);
      if(Math.abs(p.x-16.9)<.2&&p.z>19&&p.z<21)usedGap=true;
      assert.equal(p.jump,false);
    }
    assert.ok(usedGap);assert.ok(distance(p,to)<.7,JSON.stringify({from,to,x:p.x,z:p.z,action:p.action}));
  }
});

const choices=[{key:'entry',point:{x:-3,z:5},purpose:'entry'},{key:'flank',point:{x:3,z:5},purpose:'flank'}];
const preferences=p=>fpsBehaviorPreferences({temperament:'STEADY',playstyle:'BALANCED',mindset:'INDIVIDUALIST',decisionStyle:'INSTINCTIVE',...p});
const context={position:{x:0,z:0},role:'trade',remaining:80,judgment:.7,allies:[],beliefs:[],committed:false,visited:new Set(),execute:true,behavior:preferences()};
const samples=ctx=>Array.from({length:200},(_,i)=>chooseLiveApproach(choices,ctx,()=>i/200).key);

test('executes allow plausible side routes, while personality and entry strength change their frequency',()=>{
  const balanced=samples(context);
  assert.equal(new Set(balanced).size,2,'Execute calls must not eliminate flanks');
  const count=items=>items.filter(k=>k==='entry').length;
  assert.ok(count(samples({...context,behavior:preferences({playstyle:'AGGRESSIVE'})}))>
    count(samples({...context,behavior:preferences({playstyle:'PASSIVE'})})));
  assert.ok(count(samples({...context,entrySkill:1}))>count(samples({...context,entrySkill:0})));
  assert.deepEqual(samples(context),balanced,'The same random input reproduces decisions');
});

test('fresh danger overrides an execute commitment and an infeasible detour cannot win on randomness',()=>{
  const ctx={...context,health:25,previous:'entry',committed:true,beliefs:[{key:'one',x:-3,z:5,radius:1,certainty:1,age:0},{key:'two',x:-3,z:5,radius:1,certainty:1,age:0}]};
  assert.equal(chooseLiveApproach(choices,ctx,()=>0).key,'flank');
  const routeTo=p=>({path:[p],seconds:p.x>0?70:2,distance:10,exposure:0});
  for(const roll of [0,.5,.999])assert.equal(chooseLiveApproach(choices,{...context,remaining:18,routeTo},()=>roll).key,'entry');
});

test('a B execute uses the market gap instead of a fixed order lane and advances past a reached entrance',()=>{
  const sim=game(),p=sim.actors.find(a=>a.attacking);
  Object.assign(p,{hp:100,x:16.9,z:17,role:'lurker',decision:'improvise'});
  sim.informationOrders[p.team]={mode:'execute',site:'B',responders:[p.id],readyAt:0,until:60,strength:0,reason:'Take B',executePhase:'breach',lanes:{[p.id]:1}};
  sim.worldRandom=()=>0;
  assert.deepEqual(sim.executeGoal(p,[p]),LIVE_MARKET_PASSAGE.center);
  const next=liveAssaultApproaches('B',{x:20,z:10});
  assert.ok(!next.some(c=>c.key==='B:entry:0'),'Reached entry cannot trap the player at the choke');
  assert.ok(next.some(c=>c.key==='B:market-passage'));
});

test('retake cover follows reachable evidence-led choices rather than player slot or a centre-site flash script',()=>{
  const run=slot=>{
    const sim=game(),defenders=sim.actors.filter(a=>!a.attacking),[p,defuser]=defenders;
    Object.assign(p,{hp:100,x:20,z:30,slot,role:'support',flash:1,kit:false});
    Object.assign(defuser,{hp:100,x:23,z:17.5,kit:true});
    sim.bomb={status:'planted',site:'B',x:23,z:18.1,remaining:32};sim.worldRandom=()=>.3;
    sim.decide(p);
    assert.ok(p.path.length);assert.ok(distance(p.goal,sim.bomb)>3);
    assert.equal(p.utilityPreparation,undefined,'Without evidence there is no automatic retake flash');
    assert.ok(liveRetakeApproaches('B',sim.bomb).some(c=>distance(c.point,p.goal)<.1));
    return p.goal;
  };
  assert.deepEqual(run(1),run(4));
});

test('entry losses can interrupt an active execute and wake unengaged players to reassess',()=>{
  const sim=game(),allies=sim.actors.filter(a=>a.attacking),p=allies[0];
  for(const a of allies){a.hp=100;a.tacticalChoice={key:'old',phase:'breach',until:100};}
  p.role='caller';sim.roundSiteKills[p.team]=2;sim.planCommit=0;
  sim.informationOrders[p.team]={mode:'execute',site:'B',responders:allies.map(a=>a.id),until:60,readyAt:0,strength:0,reason:'Take B',executePhase:'utility'};
  sim.callFromInformation(p,allies);
  assert.notEqual(sim.informationOrders[p.team].mode,'execute');
  assert.equal(p.tacticalChoice,undefined);
});

test('3D grenade trails remain absent throughout preparation and never extend beyond elapsed flight',()=>{
  const engine=new NullEngine(),scene=new Scene(engine),viewer=Object.create(FpsLiveViewer.prototype);
  Object.assign(viewer,{scene,grenadeLineups:new Map(),grenadeOrigins:new Map(),lineupRound:1,lineupTime:0});
  const frame={round:1,time:10,attackTeam:'red',grenades:[],players:[]};
  try{
    for(const phase of ['equip','pin','ready']){
      frame.players=[{id:'thrower',hp:100,team:'red',attacking:true,x:0,z:-17,utilityPrep:{phase,kind:'smoke',target:{x:0,z:2},releaseAt:11}}];
      viewer.updateGrenadeLineups(frame,10);
      assert.equal(viewer.grenadeLineups.size,0);assert.equal(scene.meshes.length,0);
    }
    const grenade=launchLiveGrenade(77,'smoke','thrower','red',{x:0,z:-17},{x:0,z:2},10,false,'medium',1.55);
    frame.players=[];frame.grenades=[grenade];
    viewer.updateGrenadeLineups(frame,9.99);assert.equal(scene.meshes.length,0);
    viewer.updateGrenadeLineups(frame,10);assert.equal(scene.meshes.length,0,'No forecast is drawn at release');
    viewer.updateGrenadeLineups(frame,10.2);
    const view=viewer.grenadeLineups.get('grenade:77');assert.ok(view);
    const positions=view.line.getVerticesData('position'),actual={...grenade};
    for(let i=0;i<6;i++)stepLiveGrenade(actual,1/30);
    assert.ok(Math.abs(positions.at(-3)-actual.x)<1e-4);
    assert.ok(Math.abs(positions.at(-2)-actual.y)<1e-4);
    assert.ok(Math.abs(positions.at(-1)-actual.z)<1e-4);
  }finally{scene.dispose();engine.dispose();}
});
