import test from 'node:test';
import assert from 'node:assert/strict';
import {FpsLiveSimulation} from './fps/fpsLiveSimulation.ts';
import {FPS_T_POSITIONS,FPS_CT_POSITIONS} from './fps/fpsPlayerArchitecture.ts';
import {FPS_IDENTITY_PERSONALITIES,generatePlayerDNA} from './fps/fpsIdentity.ts';
import {emptyLiveIntel,rememberLiveIntel} from './fps/fpsLiveIntel.ts';
import {launchLiveGrenade,predictLiveGrenade} from './fps/fpsLiveGrenades.ts';
import {solveLiveGrenadeThrow} from './fps/fpsLiveLineups.ts';
import {liveGroundHeight} from './fps/fpsLiveTerrain.ts';

const plan={tempo:.6,structure:.7,aggression:.5,preparation:.7,freedom:.5,economy:.8};
const coach={...plan,rigidity:.7,communication:.7,leadership:.7,adaptability:.7,development:.5};
const chemistry={trust:.6,communication:.6,understanding:.6,leadershipAcceptance:.6,roleCompetition:.3};
const cards=Array.from({length:10},(_,i)=>({id:`utility-polish-${i}`,name:`Player ${i}`,stats:{rifling:80,positioning:80,entry:80,sniping:80,utility:80,shotcalling:80}}));
const identity={players:Object.fromEntries(cards.map((p,i)=>[p.id,{id:p.id,assignments:{t:FPS_T_POSITIONS[i%5],ct:FPS_CT_POSITIONS[i%5]},personality:FPS_IDENTITY_PERSONALITIES[i],dna:generatePlayerDNA(p.id),intensity:.6,roleSuitability:.6,familiarity:.5}])),teams:{blue:{coach,plan,chemistry},red:{coach,plan,chemistry}}};
function game(attacking=true){
  const sim=new FpsLiveSimulation(cards.slice(0,5),cards.slice(5),1337,identity);
  Object.assign(sim,{phase:'live',time:20,roundLiveAt:0,liveElapsed:30,remaining:70,site:'B',defenseSetup:'standard',tacticArchetype:'default_pick',fakeSite:undefined});
  sim.pendingBuys.clear();sim.grenades=[];sim.smokes=[];sim.fires=[];
  for(const p of sim.actors)Object.assign(p,{hp:0,profile:undefined,bomb:false,target:undefined,role:'trade',intel:emptyLiveIntel(),intelManaged:true,
    lastShot:-100,damageAt:-100,seenAt:-100,reload:0,weaponReady:0,channel:0,smoke:0,flash:0,he:0,incendiary:0,utilityAt:0,
    utilityPreparation:undefined,smokeLineupGoal:undefined,smokeLineupId:undefined,retreatUntil:0,
    nextSense:Infinity,nextThink:Infinity,nextPeek:Infinity,nextJump:Infinity,freezeDelay:0,vx:0,vz:0,speed:0,crouch:false,jump:false,
    jumpY:liveGroundHeight(p),jumpVy:0,path:[],goal:undefined,peek:undefined,clearUntil:0,flashWindow:undefined,knownSmokes:[],ammo:25,equipped:p.weapon});
  const p=sim.actors.find(a=>a.attacking===attacking);
  Object.assign(p,{hp:100,x:0,z:-17,jumpY:0,yaw:0});
  sim.informationOrders[p.team]={mode:'hold',responders:[],until:sim.time+5,strength:0,reason:'Hold current space'};
  return {sim,p};
}
function contact(sim,p,point,source='sight',uncertainty=.5){
  rememberLiveIntel(p.intel,{key:'reported-contact',observerId:p.id,source,...point,observed:sim.time-.2,confidence:.95,uncertainty},sim.time);
}
function recordThrows(sim){
  const calls=[];
  sim.throwUtility=(_p,kind,target)=>{calls.push({kind,target:{...target}});return true;};
  return calls;
}

test('a recent precise Mid contact can receive real HE preparation, release and paid consumption',()=>{
  const {sim,p}=game();p.he=1;contact(sim,p,{x:0,z:-4});
  assert.match(sim.useInformationUtility(p,[p]),/HE the recent Mid contact/);
  assert.equal(p.utilityPreparation.kind,'he');assert.equal(p.he,1);assert.equal(sim.grenades.length,0);
  sim.time=p.utilityPreparation.readyAt;sim.releaseUtilityPreparation(p);
  assert.equal(p.he,0);assert.equal(sim.grenades.length,1);assert.equal(sim.grenades[0].kind,'he');
});

test('imprecise contact areas do not receive exact damaging grenade throws',()=>{
  const {sim,p}=game();Object.assign(p,{he:1,incendiary:1});contact(sim,p,{x:0,z:-4},'sight',7);
  const calls=recordThrows(sim);sim.useInformationUtility(p,[p]);assert.deepEqual(calls,[]);
});

test('incendiaries are conserved when observed smoke will extinguish them',()=>{
  const {sim,p}=game();p.incendiary=1;contact(sim,p,{x:0,z:-4});
  p.knownSmokes=[{id:44,x:0,z:-4,y:1.4,radius:4.8,startedAt:sim.time-3,expires:sim.time+12}];
  const calls=recordThrows(sim);sim.useInformationUtility(p,[p]);assert.deepEqual(calls,[]);
});

test('teammates reserve the same HE target during preparation and released flight',()=>{
  for(const state of ['preparing','released']){
    const {sim,p}=game();p.he=1;contact(sim,p,{x:0,z:-4});
    const mate=sim.actors.find(a=>a.team===p.team&&a!==p);Object.assign(mate,{hp:100,x:0,z:-19});
    if(state==='preparing')mate.utilityPreparation={kind:'he',target:{x:0,z:-4}};
    else sim.grenades=[launchLiveGrenade(501,'he',mate.id,mate.team,{x:0,z:-17},{x:0,z:-4},sim.time)];
    const calls=recordThrows(sim);sim.useInformationUtility(p,[p,mate]);assert.deepEqual(calls,[],state);
  }
});

test('a support conserves a flash while the nearby entry is stationary and no fresh cue exists',()=>{
  const {sim,p}=game();Object.assign(p,{role:'support',flash:1,x:19,z:0});
  const entry=sim.actors.find(a=>a.team===p.team&&a!==p);Object.assign(entry,{hp:100,role:'entry',x:19,z:6,speed:0,goal:undefined,bomb:false});
  const calls=recordThrows(sim);sim.useInformationUtility(p,[p,entry]);assert.deepEqual(calls,[]);
  entry.goal={x:20,z:16};sim.useInformationUtility(p,[p,entry]);assert.equal(calls[0]?.kind,'flash');
});

test('HE smoke clearance requires a ready teammate who can use the temporary gap',()=>{
  for(const state of ['ready','reload','empty','blinded','turning-away']){
    const {sim,p}=game();Object.assign(p,{he:1,x:20,z:-10});contact(sim,p,{x:20,z:8},'footstep');
    p.knownSmokes=[{id:55,x:20,z:0,y:1.4,radius:4.8,startedAt:sim.time-3,expires:sim.time+12}];
    const mate=sim.actors.find(a=>a.team===p.team&&a!==p);Object.assign(mate,{hp:100,x:20,z:-9,jumpY:0,yaw:0,decision:'pressure'});
    if(state==='reload')mate.reload=1;if(state==='empty')mate.ammo=0;if(state==='blinded')mate.blinded=.8;if(state==='turning-away')mate.yaw=Math.PI;
    const calls=recordThrows(sim);sim.useInformationUtility(p,[p,mate]);
    assert.equal(calls.length,state==='ready'?1:0,state);
    if(state==='ready')assert.deepEqual(calls[0],{kind:'he',target:{x:20,z:0}});
  }
});

test('an urgent elected defuser keeps time for the stick instead of drawing a smoke',()=>{
  const {sim,p}=game(false);Object.assign(p,{x:20,z:20,smoke:1,kit:true});
  sim.bomb={status:'planted',x:20,z:21,remaining:7,site:'B'};
  const calls=recordThrows(sim);sim.usePostPlantUtility(p,[p]);assert.deepEqual(calls,[]);
  sim.bomb.remaining=20;sim.usePostPlantUtility(p,[p]);assert.equal(calls[0]?.kind,'smoke');
});

test('post-plant attackers choose HE over a molly that would be extinguished by known bomb smoke',()=>{
  const {sim,p}=game();Object.assign(p,{x:20,z:7,incendiary:1,he:1,heardDefuseAt:sim.time});
  sim.bomb={status:'planted',x:20,z:21,remaining:15,site:'B'};
  p.knownSmokes=[{id:77,x:20,z:21,y:1.4,radius:4.8,startedAt:sim.time-3,expires:sim.time+12}];
  const calls=recordThrows(sim);sim.usePostPlantUtility(p,[p]);assert.equal(calls[0]?.kind,'he');
});

test('post-plant decisions do not inspect unobserved enemy smoke and fire',()=>{
  function run(hiddenHazards){
    const {sim,p}=game();Object.assign(p,{x:20,z:7,incendiary:1,heardDefuseAt:sim.time});
    sim.bomb={status:'planted',x:20,z:21,remaining:15,site:'B'};
    if(hiddenHazards){
      sim.smokes=[{id:88,x:20,z:21,y:1.4,radius:4.8,startedAt:sim.time-3,expires:sim.time+12}];
      sim.fires=[{id:89,x:20,z:21,team:p.team==='red'?'blue':'red',startedAt:sim.time-2,expires:sim.time+5,radius:4.2}];
      sim.observablePoint=()=>false;
    }
    const calls=recordThrows(sim);sim.usePostPlantUtility(p,[p]);return calls;
  }
  assert.deepEqual(run(true),run(false));assert.equal(run(false)[0]?.kind,'incendiary');
});

test('post-plant utility is conserved when its setup and flight cannot beat the explosion',()=>{
  const {sim,p}=game();Object.assign(p,{x:20,z:7,incendiary:1,he:1,heardDefuseAt:sim.time});
  sim.bomb={status:'planted',x:20,z:21,remaining:1.8,site:'B'};
  const calls=recordThrows(sim);sim.usePostPlantUtility(p,[p]);assert.deepEqual(calls,[]);
});

test('retake flash, HE, and incendiary throws solve arcs over tall cover even during idle weapon draw',()=>{
  const {sim,p}=game(false);
  const coverTarget={x:19,z:21};
  const hand={x:17,z:33};
  const baseHeight=1.55+liveGroundHeight(hand);
  for(const kind of ['flash','he','incendiary']){
    const solved=solveLiveGrenadeThrow(kind,hand,coverTarget,baseHeight);
    assert.ok(solved,`${kind} should find a wall-clearing arc over b-screen`);
    assert.ok(solved.forecast.z<26.5,`solved ${kind} should land beyond b-screen (z=${solved.forecast.z.toFixed(2)})`);
    Object.assign(p,{x:hand.x,z:hand.z,yaw:Math.PI,equipped:p.weapon,weaponReady:.35,[kind]:1,utilityPreparation:undefined,throwAt:undefined});
    const ok=sim.throwUtility(p,kind,coverTarget);
    assert.equal(ok,true,`idle weaponReady must not block retake ${kind} setup over tall cover`);
    assert.equal(p.utilityPreparation?.kind,kind);
    // Release launches at the prepared aim point: for a flash that is the pop spot in front of the target (2026-11-17).
    const preview=launchLiveGrenade(-1,kind,p.id,p.team,hand,p.utilityPreparation.aimTarget??coverTarget,sim.time+2,false,p.utilityPreparation.throwStyle,baseHeight,{x:0,z:0},p.utilityPreparation.flightTime);
    const landed=predictLiveGrenade(preview,sim.time+2);
    assert.ok(landed.z<26.5,`prepared ${kind} preview must clear b-screen instead of bouncing back at CT (z=${landed.z.toFixed(2)})`);
  }
});

test('CTs deploy retake flash, incendiary, HE, and distant smoke from legal intel while preserving urgent-defuser discipline',()=>{
  const {sim,p}=game(false);
  const ally=sim.actors.find(a=>a!==p&&!a.attacking);
  Object.assign(ally,{hp:100,x:19,z:26,weapon:ally.weapon,equipped:ally.weapon});
  Object.assign(p,{x:17,z:33,yaw:Math.PI});
  sim.site='B';sim.bomb={status:'planted',x:20,z:21,remaining:26,site:'B'};
  const calls=recordThrows(sim);
  // 1. Legal delayed team report (`via`) on a post-plant angle (~7m from bomb, >19m from retaker; outside old <4m radius cap).
  const postPlantThreat={x:20,z:14};
  rememberLiveIntel(p.intel,{key:'site-report',observerId:ally.id,via:ally.id,source:'sight',...postPlantThreat,observed:sim.time-2.0,confidence:.95,uncertainty:1.5},sim.time);
  p.smoke=1;sim.usePostPlantUtility(p,[p,ally]);p.smoke=0;
  p.incendiary=1;sim.usePostPlantUtility(p,[p,ally]);p.incendiary=0;
  p.he=1;sim.usePostPlantUtility(p,[p,ally]);p.he=0;
  p.flash=1;sim.usePostPlantUtility(p,[p,ally]);p.flash=0;
  const kinds=calls.map(c=>c.kind);
  assert.deepEqual(kinds,['smoke','incendiary','he','flash'],'CT retaker should use smoke, incendiary, HE, and flash on legal retake threat');

  calls.length=0;p.intel=emptyLiveIntel();p.he=1;
  rememberLiveIntel(p.intel,{key:'gunfire-report',observerId:ally.id,source:'gunfire',x:20,z:8.5,observed:sim.time-1.2,confidence:.9,uncertainty:.9},sim.time);
  sim.usePostPlantUtility(p,[p,ally]);
  assert.equal(calls[0]?.kind,'he','CT retaker should throw HE on recent distant gunfire report (~12.5m from bomb)');

  // 2. Active defuse in progress suppresses retake flash so the stick is not blinded, and 0 intel stays quiet.
  calls.length=0;p.flash=1;p.he=0;ally.channel=3.2;
  sim.usePostPlantUtility(p,[p,ally]);
  assert.equal(calls.filter(c=>c.kind==='flash').length,0,'must not flash while ally is actively channeling defuse');
  ally.channel=0;p.intel=emptyLiveIntel();
  sim.usePostPlantUtility(p,[p,ally]);
  assert.deepEqual(calls,[],'without legal intel or an ally fighting site, CT emits no retake utility');
});
