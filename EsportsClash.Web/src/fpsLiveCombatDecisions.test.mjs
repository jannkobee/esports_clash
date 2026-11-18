import test from 'node:test';
import assert from 'node:assert/strict';
import {FpsLiveSimulation} from './fps/fpsLiveSimulation.ts';
import {LIVE_WEAPONS,liveDrawTime} from './fps/fpsLiveWeapons.ts';
import {LIVE_MID,liveSightline} from './fps/fpsLiveMap.ts';
import {liveGroundHeight} from './fps/fpsLiveTerrain.ts';
import {LIVE_AUTHORED_SMOKE_LINEUPS} from './fps/fpsSmokeLineupDefinitions.ts';
import {FPS_T_POSITIONS,FPS_CT_POSITIONS} from './fps/fpsPlayerArchitecture.ts';
import {FPS_IDENTITY_PERSONALITIES,generatePlayerDNA} from './fps/fpsIdentity.ts';

const plan={tempo:.6,structure:.7,aggression:.5,preparation:.7,freedom:.5,economy:.8};
const coach={...plan,rigidity:.7,communication:.7,leadership:.7,adaptability:.7,development:.5};
const chemistry={trust:.6,communication:.6,understanding:.6,leadershipAcceptance:.6,roleCompetition:.3};
const cards=Array.from({length:10},(_,i)=>({id:`combat-choice-${i}`,name:`Player ${i}`,stats:{rifling:80,sniping:80,entry:80,utility:80,positioning:80,shotcalling:80}}));
const identity={players:Object.fromEntries(cards.map((p,i)=>[p.id,{id:p.id,assignments:{t:FPS_T_POSITIONS[i%5],ct:FPS_CT_POSITIONS[i%5]},personality:FPS_IDENTITY_PERSONALITIES[i],dna:generatePlayerDNA(p.id),intensity:.6,roleSuitability:.6,familiarity:.5}])),teams:{blue:{coach,plan,chemistry},red:{coach,plan,chemistry}}};
function game(){
  const sim=new FpsLiveSimulation(cards.slice(0,5),cards.slice(5),1337,identity);
  // Coordination fixture: a fixed team smoke plan (the authored examples) instead of this round's calculated one.
  sim.roundSmokes=sim.map.authoredSmokeLineups.map(l=>({...l}));
  Object.assign(sim,{phase:'live',time:20,liveElapsed:10,remaining:90});sim.pendingBuys.clear();
  for(const p of sim.actors)Object.assign(p,{hp:0,bomb:false,target:undefined,nextSense:Infinity,nextThink:Infinity,
    nextShot:0,utilityPreparation:undefined,throwAt:undefined,reload:0,channel:0,blinded:0,weaponReady:0,
    damageAt:-100,seenAt:-100,contactAt:-100,lastShot:-100,equipUntil:0,path:[],goal:undefined,
    x:-19,z:-10,yaw:0,pitch:0,jumpY:0,jump:false,speed:0,vx:0,vz:0,stillSince:0,
    scopeState:'hip',scopeLevel:0,holsteredPrimary:undefined,sidearmUntil:0,peek:undefined,
    recoil:0,recoilPitch:0,knownSmokes:[],suppression:undefined,intel:{contacts:[]}});
  const p=sim.actors[0],enemy=sim.actors[5];p.hp=100;
  Object.assign(p,{weapon:'m4a1_s',equipped:'m4a1_s',ammo:25,reserve:75,sidearmLoadout:{weapon:'usp_s',ammo:12,reserve:48}});
  Object.assign(enemy,{hp:100,x:-19,z:-4,yaw:Math.PI});
  return {sim,p,enemy};
}
function smokeScenario(){
  const fx=game(),{sim,p,enemy}=fx;enemy.hp=0;
  const contact={key:'enemy:last-seen',enemyId:'last-seen',observerId:p.id,source:'sight',x:-19,z:0,observed:19.8,confidence:.98,uncertainty:.45};
  p.intel.contacts=[contact];p.contact={x:contact.x,z:contact.z};p.contactAt=contact.observed;
  p.knownSmokes=[{id:400,x:-19,z:-5,y:1.4,radius:3,startedAt:17,expires:38}];
  return {...fx,contact};
}

test('a sidearm fires after its draw instead of inheriting the sniper bolt cooldown',()=>{
  const {sim,p,enemy}=game();
  Object.assign(p,{weapon:'sniper',equipped:'sniper',ammo:4,reserve:20,nextShot:21.45,scopeState:'cycling',acquired:0});
  enemy.z=-3;sim.chooseEquipment(p,enemy);
  assert.equal(p.weapon,'usp_s');assert.equal(p.holsteredPrimary.nextShot,21.45);assert.equal(p.scopeState,'hip');
  sim.time+=liveDrawTime(p.weapon);p.weaponReady=0;
  assert.ok(sim.time>=p.nextShot&&sim.time<21.45);
  sim.fire(p,enemy);assert.equal(p.ammo,11);
  sim.time=20.7;sim.restorePrimary(p);
  assert.equal(p.nextShot,21.45,'Switching back must retain the primary cooldown');
});

test('shotguns use a loaded sidearm for a distant duel and return when the fight closes',()=>{
  const {sim,p,enemy}=game();Object.assign(p,{weapon:'mag7',equipped:'mag7',ammo:5,reserve:25,acquired:0});enemy.z=10;
  assert.ok(liveSightline(p,enemy));sim.chooseEquipment(p,enemy);
  assert.equal(p.weapon,'usp_s');assert.equal(p.holsteredPrimary.weapon,'mag7');
  sim.time=23;p.weaponReady=0;enemy.z=-4;sim.chooseEquipment(p,enemy);
  assert.equal(p.weapon,'mag7');assert.equal(p.sidearmLoadout.ammo,12);
});

test('an empty sidearm yields immediately to a loaded rifle without waiting for the preference hold',()=>{
  const {sim,p,enemy}=game();p.ammo=20;sim.drawSidearm(p);p.weaponReady=0;p.ammo=0;
  sim.time+=.5;sim.chooseEquipment(p,enemy);
  assert.equal(p.weapon,'m4a1_s');assert.equal(p.ammo,20);
});

test('an empty backup cannot pull a loaded primary out of the hands',()=>{
  const {sim,p,enemy}=game();Object.assign(p,{weapon:'sniper',equipped:'sniper',ammo:5,acquired:0});
  p.sidearmLoadout.ammo=0;enemy.z=-7;sim.chooseEquipment(p,enemy);
  assert.equal(p.weapon,'sniper');assert.equal(p.holsteredPrimary,undefined);
});

test('smoke probes use short bursts and retain an ammunition allowance despite refreshed reports',()=>{
  const {sim,p,contact}=smokeScenario();let shots=0,firstPause;
  for(let i=0;i<75;i++){
    sim.time=20+i/30;contact.observed=sim.time-.1;contact.x=-19+(i%2)*.1;
    if(sim.tryInformationFire(p)){shots++;if(shots===2)firstPause=p.nextShot-sim.time;}
  }
  assert.equal(shots,6);assert.ok(firstPause>=.64);assert.equal(p.ammo,19);
});

test('smoke probes reject stale, vague and footsteps-only clues and preserve low magazines',()=>{
  for(const kind of ['old','vague','footstep','low-ammo','sniper','far-shotgun']){
    const {sim,p,contact}=smokeScenario();
    if(kind==='old')contact.observed=16;
    if(kind==='vague')contact.uncertainty=8;
    if(kind==='footstep')contact.source='footstep';
    if(kind==='low-ammo')p.ammo=8;
    if(kind==='sniper')Object.assign(p,{weapon:'sniper',equipped:'sniper',ammo:5});
    if(kind==='far-shotgun'){Object.assign(p,{weapon:'mag7',equipped:'mag7',ammo:5});contact.z=10;}
    const before=p.ammo;assert.equal(sim.tryInformationFire(p),false,kind);assert.equal(p.ammo,before);
  }
});

test('a teammate in the known firing lane prevents speculative smoke fire',()=>{
  const {sim,p}=smokeScenario(),ally=sim.actors[1];Object.assign(ally,{hp:100,x:-19,z:-7});
  assert.equal(sim.tryInformationFire(p),false);assert.equal(p.ammo,25);
});

test('a teammate beyond an empty reported position also prevents speculative smoke fire',()=>{
  const {sim,p,contact}=smokeScenario(),ally=sim.actors[1];contact.z=-5;
  Object.assign(ally,{hp:100,x:-19,z:-1});
  assert.equal(sim.tryInformationFire(p),false);assert.equal(p.ammo,25);
});

test('a time-critical objective approach keeps priority over speculative fire',()=>{
  const {sim,p}=smokeScenario();p.objectiveUrgent=true;
  assert.equal(sim.tryInformationFire(p),false);assert.equal(p.ammo,25);
});

test('live ticks can fire from remembered smoke evidence without acquiring the hidden opponent',()=>{
  const {sim,p,enemy}=smokeScenario();Object.assign(enemy,{hp:100,x:20,z:35});
  Object.assign(p,{watchPoint:{x:-19,z:0},contactAt:19.8,objectiveUrgent:false});
  sim.smokes=structuredClone(p.knownSmokes);sim.bomb={status:'carried',x:0,z:-32,remaining:40};
  for(let i=0;i<25;i++)sim.step();
  assert.ok(p.impact.shots>=2&&p.impact.shots<=6,`Actual live loop fired ${p.impact.shots} probe shots`);
  assert.equal(p.target,undefined);assert.equal(enemy.hp,100);
});

test('speculative aim follows the selected evidence rather than a conflicting contact pointer or hidden body',()=>{
  const run=hiddenX=>{
    const {sim,p,enemy,contact}=smokeScenario();Object.assign(enemy,{hp:100,x:hiddenX,z:1});
    p.contact={x:27,z:15};p.pitch=Math.atan2(1.25-1.6,10);
    assert.equal(sim.tryInformationFire(p),true);
    return {ammo:p.ammo,suppression:p.suppression,yaw:p.yaw,pitch:p.pitch,endpoint:sim.shots[0].to,contact};
  };
  assert.deepEqual(run(18),run(27));
});

test('smoke probes evaluate an elevated lookout firing line at its real height',()=>{
  const {sim,p,contact}=smokeScenario();
  Object.assign(p,{x:LIVE_MID.window.hold.x,z:LIVE_MID.window.hold.z,jumpY:liveGroundHeight(LIVE_MID.window.hold)});
  Object.assign(contact,{x:0,z:10,observed:19.9});p.yaw=Math.atan2(contact.x-p.x,contact.z-p.z);
  p.pitch=Math.atan2(1.25-(p.jumpY+1.6),Math.hypot(contact.x-p.x,contact.z-p.z));
  p.knownSmokes=[{id:401,x:0,z:15,y:.1,radius:1.2,startedAt:17,expires:38}];
  assert.equal(sim.tryInformationFire(p),false,'A low street cloud does not justify shooting a clear elevated ray');
});

test('speculative shots bypass target-specific mechanics learning for invented target IDs',()=>{
  const {sim,p}=smokeScenario();let calls=0;sim.combatLearner=()=>({choose(){calls++;return 'sustain';}});
  assert.equal(sim.tryInformationFire(p),true);assert.equal(calls,0);
});

function executeScenario(){
  const {sim}=game();for(const actor of sim.actors)actor.hp=0;
  const [entry,thrower,carrier]=sim.actors.filter(a=>a.attacking);
  Object.assign(sim,{site:'A',liveElapsed:30,tacticArchetype:'default_pick',roundVariant:.5,attackTeam:entry.team});
  for(const [i,p] of [entry,thrower,carrier].entries())Object.assign(p,{hp:100,x:-19+i*.5,z:10+i,smoke:1,flash:0,bomb:i===2,role:i===0?'entry':i===1?'support':'trade',utilityAt:0});
  const order={mode:'execute',site:'A',responders:[entry.id,thrower.id,carrier.id],until:40,strength:0,reason:'Hit A',
    executePhase:'utility',phaseAt:20,smokesSent:0,flashSent:false,entryId:entry.id,callerId:carrier.id,readyAt:0};
  sim.informationOrders[entry.team]=order;
  return {sim,entry,thrower,carrier,order};
}

test('a cancelled execute lineup advances the plan without inventing a released smoke',()=>{
  const {sim,thrower,order}=executeScenario();sim.updateExecute();
  const assigned=thrower.smokeLineupId;assert.ok(assigned);
  thrower.damageAt=sim.time;sim.time+=.3;sim.updateExecute();
  assert.equal(thrower.smokeLineupId,undefined);assert.equal(thrower.smoke,1);
  assert.equal(order.smokesSent,0);assert.ok(order.smokeLineupDone.includes(assigned));assert.equal(sim.grenades.length,0);
});

test('an already observed cloud covers a crossing without counting a new paid release',()=>{
  const {sim,thrower,order}=executeScenario(),lineup=LIVE_AUTHORED_SMOKE_LINEUPS.find(l=>l.id==='a-arch');
  thrower.knownSmokes=[{id:900,...lineup.target,y:1.4,radius:5,startedAt:17,expires:38}];
  sim.updateExecute();assert.ok(order.smokeLineupDone.includes(lineup.id));assert.equal(order.smokesSent,0);assert.equal(thrower.smoke,1);
});

test('a completed utility plan leaves teammates spare smokes in their pockets',()=>{
  const {sim,entry,thrower,order}=executeScenario();
  order.smokeLineupDone=['a-arch','a-library'];sim.openingSmokeTeams.add(thrower.team);
  sim.funnelTeamSmokes(thrower.team);
  assert.equal(entry.smoke,1);assert.equal(thrower.smoke,1);assert.equal(sim.droppedUtility.length,0);
  sim.openingSmokeTeams.clear();
  assert.deepEqual(sim.nextUncoveredSmokeLineups(thrower.team),[],'Late opening techniques cannot create spare-stock demand');
});

test('an execute prioritizes a reported sniper crossing and retains the chosen lineup order',()=>{
  const {sim,thrower,carrier,order}=executeScenario(),lineup=LIVE_AUTHORED_SMOKE_LINEUPS.find(l=>l.id==='a-library');
  thrower.z=0;
  carrier.intel.contacts=[{key:'sniper-report',observerId:carrier.id,source:'sight',...lineup.target,observed:19.8,confidence:.98,uncertainty:.45,weaponHint:'sniper'}];
  sim.updateExecute();assert.equal(thrower.smokeLineupId,lineup.id);assert.equal(order.smokeLineupOrder[0],lineup.id);
  carrier.intel.contacts=[];sim.time+=.3;sim.updateExecute();
  assert.equal(thrower.smokeLineupId,lineup.id);assert.equal(order.smokeLineupOrder[0],lineup.id);
});

test('an execute keeps a feasible smoke ahead of an observed angle whose origin is too far away',()=>{
  const {sim,thrower,carrier,order}=executeScenario(),distant=LIVE_AUTHORED_SMOKE_LINEUPS.find(l=>l.id==='a-library');
  carrier.intel.contacts=[{key:'sniper-report',observerId:carrier.id,source:'sight',...distant.target,observed:19.8,confidence:.98,uncertainty:.45,weaponHint:'sniper'}];
  sim.updateExecute();assert.equal(thrower.smokeLineupId,'a-arch');assert.equal(order.smokeLineupOrder[0],'a-arch');
});

test('an advanced support refuses to return to spawn for a late opening smoke',()=>{
  const {sim,thrower}=executeScenario();Object.assign(sim,{liveElapsed:17});
  sim.informationOrders[thrower.team]={mode:'hold',responders:[],until:25,strength:0,reason:'Default'};
  assert.equal(sim.openingUtility(thrower),false);assert.equal(thrower.smokeLineupId,undefined);
});

test('a nearby eligible teammate can cover an opening lineup when the support cannot arrive in time',()=>{
  const {sim,entry,thrower}=executeScenario(),lineup=LIVE_AUTHORED_SMOKE_LINEUPS.find(l=>l.id==='restaurant-civic');
  Object.assign(sim,{liveElapsed:9});Object.assign(entry,{...lineup.position,role:'trade'});
  sim.informationOrders[entry.team]={mode:'hold',responders:[],until:25,strength:0,reason:'Default'};
  assert.equal(sim.openingUtility(thrower),false);assert.equal(sim.openingUtility(entry),true);
  assert.equal(entry.smokeLineupId,lineup.id);
});

test('catching an opponent pants-down cancels peek/retreat and commits to the spray',()=>{
  for(const mode of ['reloading','knife','blinded','facing-away']){
    const {sim,p,enemy}=game();
    Object.assign(p,{target:enemy.id,acquired:19.5,seenAt:20,decision:'prepare',hp:32,engagementShots:2,lastShot:19.9,
      retreatUntil:21.2,peek:{home:{x:-22,z:-10},out:{x:-19,z:-10},back:true,until:22,pause:0,style:'shoulder',pumps:0,prefired:0}});
    Object.assign(enemy,{reload:mode==='reloading'?1.2:0,equipped:mode==='knife'?'knife':'ak47',
      blinded:mode==='blinded'?.9:0,yaw:mode==='facing-away'?0:Math.PI,speed:0,crouch:true});
    const commit=sim.computeDuelCommitment(p,enemy,1,0);
    assert.ok(commit.targetExposed&&commit.score>=.65,`Expected high commitment for ${mode}, got ${commit.score}`);
    assert.equal(sim.peekShouldReturn(p),false,`Should not return behind cover when enemy is ${mode}`);
    sim.stepDuelMovement(p,enemy,1/30);
    assert.equal(p.peek,undefined,`Should cancel peek when catching enemy ${mode}`);
    assert.ok(p.retreatUntil<=sim.time,`Should clear retreat when enemy is ${mode}`);
    const beforeCommit=p.shotCommitUntil??0;
    sim.fire(p,enemy);
    assert.ok(p.shotCommitUntil>beforeCommit+.25,`Should extend shotCommitUntil for ${mode}`);
  }
});

test('mid-duel utility is suppressed against a vulnerable opponent while multi-angle outnumbered risk dampens commitment',()=>{
  const {sim,p,enemy}=game();
  Object.assign(p,{target:enemy.id,acquired:19.5,seenAt:20,hp:40,flash:1,smoke:1,utilityAt:0});
  Object.assign(enemy,{equipped:'flash',utilityPreparation:{kind:'flash'},speed:0});
  sim.useUtility(p);
  assert.equal(p.utilityPreparation,undefined,'Should keep gun out instead of throwing utility at a vulnerable enemy');
  const solo=sim.computeDuelCommitment(p,enemy,1,0);
  Object.assign(enemy,{equipped:'ak47',utilityPreparation:undefined,speed:3.5,crouch:false});
  const outnumbered=sim.computeDuelCommitment(p,enemy,3,3);
  assert.ok(outnumbered.score<solo.score&&outnumbered.score<.6,`Multi-angle outnumbered risk should dampen commitment (${outnumbered.score} vs ${solo.score})`);
});
