import {FPS_T_POSITIONS,FPS_CT_POSITIONS} from './fps/fpsPlayerArchitecture.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {FpsLiveSimulation} from './fps/fpsLiveSimulation.ts';
import {LIVE_TACTICAL,LIVE_MID,liveWalkable,liveSightline} from './fps/fpsLiveMap.ts';
import {LIVE_B_APARTMENTS,liveGroundHeight} from './fps/fpsLiveTerrain.ts';
import {liveSmokeOccludes} from './fps/fpsLiveBrain.ts';
import {LIVE_AUTHORED_SMOKE_LINEUPS} from './fps/fpsSmokeLineupDefinitions.ts';
import {FPS_IDENTITY_PERSONALITIES,generatePlayerDNA} from './fps/fpsIdentity.ts';

const plan={tempo:.6,structure:.7,aggression:.5,preparation:.7,freedom:.5,economy:.8};
const coach={...plan,rigidity:.7,communication:.7,leadership:.7,adaptability:.7,development:.5};
const chemistry={trust:.6,communication:.6,understanding:.6,leadershipAcceptance:.6,roleCompetition:.3};
const cards=Array.from({length:10},(_,i)=>({id:`polish-${i}`,name:`Player ${i}`,stats:{rifling:80,positioning:80,entry:80,sniping:80,utility:80,shotcalling:80}}));
const identity={players:Object.fromEntries(cards.map((p,i)=>[p.id,{id:p.id,assignments:{t:FPS_T_POSITIONS[(i)%5],ct:FPS_CT_POSITIONS[(i)%5]},personality:FPS_IDENTITY_PERSONALITIES[i],dna:generatePlayerDNA(p.id),intensity:.6,roleSuitability:.6,familiarity:.5}])),teams:{blue:{coach,plan,chemistry},red:{coach,plan,chemistry}}};
function game(){
  const sim=new FpsLiveSimulation(cards.slice(0,5),cards.slice(5),1337,identity);
  Object.assign(sim,{phase:'live',time:20,roundLiveAt:0,liveElapsed:5,remaining:90,site:'A',defenseSetup:'standard',tacticArchetype:'default_pick'});
  sim.pendingBuys.clear();
  for(const p of sim.actors)Object.assign(p,{hp:0,bomb:false,target:undefined,contact:undefined,contactAt:-100,intelManaged:false,
    lastShot:-100,damageAt:-100,seenAt:-100,reload:0,weaponReady:0,channel:0,smoke:0,flash:0,he:0,incendiary:0,
    utilityPreparation:undefined,smokeLineupGoal:undefined,smokeLineupId:undefined,retreatUntil:0,
    nextSense:Infinity,nextThink:Infinity,nextPeek:Infinity,nextJump:Infinity,freezeDelay:0,
    vx:0,vz:0,speed:0,crouch:false,jump:false,jumpY:liveGroundHeight(p),jumpVy:0,path:[],goal:undefined,peek:undefined,
    clearUntil:0,flashWindow:undefined,knownSmokes:[],objectiveUrgent:false,ammo:12,equipped:p.weapon,decision:'prepare'});
  sim.informationOrders.blue={mode:'hold',responders:[],until:25,strength:0,reason:'No confirmed pressure — hold the setup'};
  sim.informationOrders.red={mode:'hold',responders:[],until:25,strength:0,reason:'Gather information'};
  return sim;
}

test('a quiet caller HOLD preserves the standard CT window and gallery opening assignments',()=>{
  const sim=game(),defenders=sim.actors.filter(p=>!p.attacking);
  for(const p of defenders)p.hp=100;
  const caller=defenders[0];caller.role='caller';
  sim.informationOrders[caller.team].until=0;
  sim.callFromInformation(caller,defenders);
  assert.equal(sim.informationOrders[caller.team].mode,'hold');
  assert.ok(sim.informationOrders[caller.team].until>sim.time);
  const window=defenders.find(p=>p.position==='CT_FLEX'),gallery=defenders.find(p=>p.position==='CT_ANCHOR_B');
  window.role='sniper';gallery.role='trade';
  sim.decide(window);sim.decide(gallery);
  assert.deepEqual(window.goal,{...LIVE_MID.window.hold,level:undefined},'A generic quiet order must not suppress the Mid lookout');
  assert.deepEqual(gallery.goal,{...LIVE_TACTICAL.B.holds[3],level:undefined},'A generic quiet order must not suppress the apartment stairs');
  assert.ok(window.path.length&&gallery.path.length);
});

function regroupScenario(){
  const sim=game(),allies=sim.actors.filter(p=>p.attacking);
  for(const p of allies){p.hp=100;p.role='trade';}
  const [entry,trade,carrier,lurker,cover]=allies;
  Object.assign(entry,{x:-19,z:5,role:'entry'});Object.assign(trade,{x:-30,z:3});
  Object.assign(carrier,{x:0,z:-32,bomb:true,role:'support'});
  Object.assign(lurker,{x:20,z:10,role:'lurker'});Object.assign(cover,{x:-18,z:6});
  sim.attackTeam=entry.team;
  sim.informationOrders[entry.team]={mode:'execute',site:'A',responders:allies.map(p=>p.id),until:sim.time+20,strength:0,
    reason:'Work A together',executePhase:'regroup',phaseAt:sim.time-1,entryId:entry.id,callerId:trade.id,readyAt:0};
  return {sim,entry,carrier,lurker,order:sim.informationOrders[entry.team]};
}

test('an isolated opposite-lane lurker fight does not release the full execute',()=>{
  const {sim,lurker,order}=regroupScenario();lurker.lastShot=sim.time-.1;
  sim.updateExecute();
  assert.equal(order.mode,'execute');assert.equal(order.executePhase,'regroup');
});

test('regroup timeout rechecks an incomplete execute instead of breaching with the carrier far away',()=>{
  const {sim,carrier,order}=regroupScenario();order.phaseAt=sim.time-10;
  assert.ok(carrier.z<0);
  sim.updateExecute();
  assert.equal(order.mode,'recheck');assert.notEqual(order.executePhase,'breach');
  assert.match(order.reason,/Regroup incomplete/);
});

test('a committed entry fight still releases the nearby execute rather than holding teammates back',()=>{
  const {sim,entry,order}=regroupScenario();entry.lastShot=sim.time-.1;
  sim.updateExecute();
  assert.equal(order.executePhase,'breach');
});

test('nearby spare utility remains low priority while an injured player retreats to cover',()=>{
  const sim=game(),p=sim.actors[1],cover={x:-20,z:24},stock={id:9001,kind:'flash',team:p.team,x:-14,z:24};
  Object.assign(p,{hp:30,x:-19,z:25,goal:cover,retreatUntil:sim.time+1.4});
  sim.droppedUtility=[stock];
  assert.ok(liveWalkable(p)&&liveWalkable(cover));
  sim.decide(p);
  assert.deepEqual(p.goal,{...cover,level:undefined});assert.notDeepEqual(p.goal,stock);
  assert.doesNotMatch(p.intent,/Collect the paid spare/);
  const control=game(),healthy=control.actors[1];Object.assign(healthy,{hp:100,x:-19,z:25});
  control.droppedUtility=[{...stock,team:healthy.team}];control.decide(healthy);
  assert.deepEqual(healthy.goal,{x:stock.x,z:stock.z,level:undefined},'The same reachable spare is collectable when there is no commitment');
});

test('nearby spare utility cannot pull the selected opening thrower off the authored launch point',()=>{
  const sim=game(),p=sim.actors.find(a=>a.attacking),lineup=LIVE_AUTHORED_SMOKE_LINEUPS.find(l=>l.id==='restaurant-civic');
  Object.assign(p,{hp:100,x:0,z:-32,role:'support',smoke:1,bomb:false});
  sim.droppedUtility=[{id:9002,kind:'flash',team:p.team,x:4,z:-32}];
  sim.decide(p);
  assert.equal(p.smokeLineupId,lineup.id);
  assert.deepEqual(p.goal,{...lineup.position,level:undefined});
  assert.doesNotMatch(p.intent,/Collect the paid spare/);
});

function smokeCrossing(){
  const sim=game(),p=sim.actors.find(a=>a.attacking),partner=sim.actors.find(a=>a.attacking&&a!==p);
  const next={x:-19,z:4},smoke={id:807,x:-19,z:1,y:1.45,radius:3,startedAt:sim.time-3,expires:sim.time+15};
  Object.assign(p,{hp:100,x:-19,z:-3,jumpY:0,path:[next],goal:next,role:'entry',knownSmokes:[smoke]});
  Object.assign(partner,{hp:100,x:-20.3,z:-4,jumpY:0,role:'trade'});
  sim.informationOrders[p.team]={mode:'execute',site:'A',responders:[p.id,partner.id],until:sim.time+8,strength:0,
    reason:'Breach A together',executePhase:'breach',phaseAt:sim.time-.5,readyAt:0,entryId:p.id};
  assert.ok(liveSmokeOccludes(p,next,1.6,1.6,smoke,sim.time));
  assert.ok(liveSightline(p,partner));
  return {sim,p,partner};
}

test('an isolated player respects an obscured smoke crossing',()=>{
  const {sim,p,partner}=smokeCrossing();partner.hp=0;
  const before={x:p.x,z:p.z};sim.move(p,1/30);
  assert.equal(p.action,'Watching smoke edge');assert.deepEqual({x:p.x,z:p.z},before);
});

test('a fresh breach may cross smoke with a ready trading partner, but loses that exception when support is unready',()=>{
  const supported=smokeCrossing();supported.sim.move(supported.p,1/30);
  assert.equal(supported.p.action,'Breaching with trade support');assert.ok(supported.p.z>-3);
  for(const bad of ['reload','empty','blind','stale']){
    const {sim,p,partner}=smokeCrossing();
    if(bad==='reload')partner.reload=1;
    if(bad==='empty')partner.ammo=0;
    if(bad==='blind')partner.blinded=.7;
    if(bad==='stale')sim.informationOrders[p.team].phaseAt=sim.time-4.1;
    sim.move(p,1/30);
    assert.equal(p.action,'Watching smoke edge',`${bad} must not count as ready trade support`);
  }
});

test('gallery movement evaluates smoke at the actual raised eye height rather than at the street below',()=>{
  const sim=game(),p=sim.actors[1],next={x:32,z:20.5};
  const smoke={id:808,x:32,z:15,y:.3,radius:3,startedAt:sim.time-3,expires:sim.time+15};
  Object.assign(p,{hp:100,x:32,z:10.5,jumpY:LIVE_B_APARTMENTS.height,path:[next],goal:next,knownSmokes:[smoke]});
  assert.equal(liveGroundHeight(p),LIVE_B_APARTMENTS.height);
  assert.equal(liveGroundHeight(next),LIVE_B_APARTMENTS.height);
  assert.ok(liveSmokeOccludes(p,next,1.6,1.6,smoke,sim.time),'This cloud would block the old street-height check');
  assert.equal(liveSmokeOccludes(p,next,3.4,3.4,smoke,sim.time),false);
  sim.move(p,1/30);
  assert.notEqual(p.action,'Watching smoke edge');assert.ok(p.z>10.5);
});

test('an unobserved enemy behind the actor does not cancel utility, while an acquired threat still protects the duel',()=>{
  const sim=game(),p=sim.actors[1],enemy=sim.actors.find(a=>a.team!==p.team);
  Object.assign(p,{hp:100,x:-19,z:-10,yaw:0,jumpY:0,target:undefined});
  Object.assign(enemy,{hp:100,x:-19,z:-15,jumpY:0});
  assert.ok(liveSightline(p,enemy));
  assert.equal(sim.inImmediateFight(p),false,'Rear proximity cannot reveal an unobserved enemy');
  p.target=enemy.id;p.acquired=sim.time-.1;p.seenAt=sim.time-.1;
  assert.equal(sim.inImmediateFight(p),true,'A recently acquired threat must still stop an unsafe utility switch');
});

function executeUtilityScenario(site){
  const sim=game(),allies=sim.actors.filter(p=>p.attacking),[entry,thrower,carrier]=allies;
  Object.assign(sim,{site,liveElapsed:30});
  const x=site==='A'?-19:20;
  Object.assign(entry,{hp:100,x:x+.5,z:12,role:'entry',smoke:1});
  Object.assign(thrower,{hp:100,x,z:10,role:'support',smoke:1});
  Object.assign(carrier,{hp:100,x,z:13,role:'trade',smoke:1,bomb:true});
  sim.attackTeam=entry.team;
  const order={mode:'execute',site,responders:[entry.id,thrower.id,carrier.id],until:sim.time+20,strength:0,
    reason:`Work ${site} with utility`,executePhase:'utility',phaseAt:sim.time,smokesSent:0,flashSent:false,
    entryId:entry.id,callerId:carrier.id,readyAt:0};
  sim.informationOrders[entry.team]=order;
  const lineup=LIVE_AUTHORED_SMOKE_LINEUPS.find(l=>l.phase==='execute'&&l.site===site);
  sim.updateExecute();
  assert.equal(thrower.smokeLineupId,lineup.id,`${site}: choose the called site's authored lineup`);
  assert.deepEqual(thrower.smokeLineupGoal,lineup.position);
  assert.notDeepEqual(thrower.smokeLineupGoal,{x:thrower.x,z:thrower.z},'The thrower must reach an authored origin instead of throwing from arbitrary current coordinates');
  assert.equal(entry.smokeLineupId,undefined);assert.equal(carrier.smokeLineupId,undefined);
  assert.equal(order.smokesSent,0);assert.equal(sim.grenades.length,0);
  // Controlled arrival at the real launch point keeps the ordinary equip/pin,
  // inventory and physical release code authoritative in this integration test.
  Object.assign(thrower,{...lineup.position,jumpY:liveGroundHeight(lineup.position),speed:0,vx:0,vz:0,
    yaw:Math.atan2(lineup.target.x-lineup.position.x,lineup.target.z-lineup.position.z)});
  sim.time+=.25;sim.updateExecute();
  assert.equal(thrower.utilityPreparation?.lineupId,lineup.id,`${site}: equip and pin the assigned smoke`);
  assert.equal(thrower.smoke,1);assert.equal(order.smokesSent,0);assert.equal(sim.grenades.length,0);
  sim.updateExecute();
  assert.equal(order.smokesSent,0,'A queued preparation is not a released smoke');
  sim.time=thrower.utilityPreparation.readyAt;sim.releaseUtilityPreparation(thrower);
  assert.equal(thrower.smoke,0);assert.equal(entry.smoke,1);assert.equal(carrier.smoke,1);
  assert.equal(sim.grenades.length,1);assert.equal(sim.grenades[0].actorId,thrower.id);
  assert.equal(order.smokesSent,0,'Release is counted by the following coordinator update');
  sim.updateExecute();
  assert.equal(order.smokesSent,1,'The coordinator advances only after the real inventory-backed release');
  return {sim,order,entry,thrower,grenade:sim.grenades[0]};
}

test('execute utility sends a non-entry non-carrier to the selected site launch point and counts actual release',()=>{
  executeUtilityScenario('A');executeUtilityScenario('B');
});

test('execute waits for the released smoke to detonate and bloom before positively releasing the breach',()=>{
  const {sim,order,grenade}=executeUtilityScenario('A');
  assert.ok(Math.abs(order.breachAt-(grenade.detonateAt+1.2))<1e-8);
  order.smokesSent=LIVE_AUTHORED_SMOKE_LINEUPS.filter(l=>l.phase==='execute'&&l.site==='A').length;
  order.flashSent=true;
  sim.time=grenade.detonateAt+.8;sim.updateExecute();
  assert.equal(order.executePhase,'utility','A detonated but still blooming smoke must not release the breach');
  sim.time=grenade.detonateAt+1.201;sim.updateExecute();
  assert.equal(order.executePhase,'breach','The ready team should breach once the smoke has bloomed');
});
