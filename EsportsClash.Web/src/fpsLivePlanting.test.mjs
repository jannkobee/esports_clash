import test from 'node:test';
import assert from 'node:assert/strict';
import {FpsLiveSimulation} from './fps/fpsLiveSimulation.ts';
import {FPS_IDENTITY_PERSONALITIES,generatePlayerDNA} from './fps/fpsIdentity.ts';
import {generateFpsSkillProfile} from './fps/fpsSkillProfile.ts';
import {LIVE_FPS_MAP,distance,liveWalkable} from './fps/fpsLiveMap.ts';
import {livePlantSite,planLivePlant,LIVE_PLANT_RULES} from './fps/fpsLivePlanning.ts';

const plan={tempo:.6,structure:.7,aggression:.5,preparation:.7,freedom:.5,economy:.8};
const coach={...plan,rigidity:.7,communication:.7,leadership:.7,adaptability:.7,development:.5};
const chemistry={trust:.6,communication:.6,understanding:.6,leadershipAcceptance:.6,roleCompetition:.3};
const cards=Array.from({length:10},(_,i)=>({id:`plant-${i}`,name:`Player ${i}`,stats:{lan:80,iq:80,tf:80,clu:80,sta:80,flx:80,ldr:80}}));
const identity={players:Object.fromEntries(cards.map((p,i)=>[p.id,{id:p.id,personality:FPS_IDENTITY_PERSONALITIES[i],dna:generatePlayerDNA(p.id),intensity:.6,roleSuitability:.6,familiarity:.5}])),teams:{blue:{coach,plan,chemistry},red:{coach,plan,chemistry}}};
const profiles=Object.fromEntries(cards.map(p=>[p.id,generateFpsSkillProfile(p.id,1337,'2026-11-11T00:00:00Z')]));
const game=()=>new FpsLiveSimulation(cards.slice(0,5),cards.slice(5),1337,identity,{skillProfiles:profiles});
const finishBuy=sim=>{while(sim.phase==='freeze')sim.step();};

function plantScenario(site='A',position=LIVE_FPS_MAP.sites.A){
  const sim=game();finishBuy(sim);
  const p=sim.actors.find(a=>a.bomb),enemy=sim.actors.find(a=>a.team!==p.team);
  sim.actors.forEach(a=>Object.assign(a,{hp:0,target:undefined,nextSense:Infinity,nextThink:Infinity,nextShot:Infinity}));
  Object.assign(p,{...position,hp:100,speed:0,vx:0,vz:0,crouch:false,jump:false,jumpY:0,isBoosted:false,
    flash:0,smoke:0,incendiary:0,reload:0,weaponReady:0,freezeDelay:0,channel:0,contact:undefined,
    intelManaged:false,noticedEnemies:[],goal:undefined,path:[],nextThink:0,damageAt:-100});
  Object.assign(enemy,{hp:100,x:0,z:-42,flash:0,smoke:0,incendiary:0});
  sim.site=site;sim.remaining=80;
  return {sim,p,enemy};
}

test('staggered purchases preserve exactly one bomb carrier through pistol, normal, swap and overtime buys',()=>{
  for(const round of [1,2,16,31]){
    const sim=game();sim.round=round;sim.startRound();
    const carrier=sim.actors.find(p=>p.bomb);
    assert.ok(carrier.attacking);
    while(sim.phase==='freeze'){
      sim.step();
      const carriers=sim.actors.filter(p=>p.bomb);
      assert.deepEqual(carriers.map(p=>p.id),[carrier.id],`Round ${round}: buying removed or duplicated the carrier`);
      assert.equal(sim.bomb.x,carrier.x);assert.equal(sim.bomb.z,carrier.z);
    }
    assert.equal(sim.pendingBuys.size,0);assert.equal(sim.bomb.status,'carried');
  }
});

test('plant planning finds reachable ground around the B fountain and retains its chosen spot',()=>{
  assert.equal(liveWalkable(LIVE_FPS_MAP.sites.B),false);
  for(const site of ['A','B']){
    const from=site==='A'?{x:-19,z:12}:{x:19,z:12};
    const chosen=planLivePlant(from,site);
    assert.ok(chosen);assert.ok(liveWalkable(chosen.point));
    assert.equal(livePlantSite(chosen.point),site);assert.ok(Number.isFinite(chosen.seconds));
    const retained=planLivePlant({x:from.x,z:from.z+.2},site,[],chosen.point);
    assert.deepEqual(retained.point,chosen.point);
  }
});

test('a real carrier survives buying, approaches either site and completes its plant through the full step loop',()=>{
  for(const site of ['A','B']){
    const position=site==='A'?{x:-19,z:15}:{x:19,z:14};
    const {sim,p}=plantScenario(site,position);
    for(let tick=0;tick<900&&sim.bomb.status!=='planted';tick++)sim.step();
    assert.equal(sim.bomb.status,'planted',`${site}: ${p.action} / ${p.intent}`);
    assert.equal(sim.bomb.site,site);assert.equal(p.impact.plants,1);assert.equal(p.bomb,false);
    assert.ok(liveWalkable(sim.bomb));
    assert.ok(distance(sim.bomb,LIVE_FPS_MAP.sites[site])<LIVE_PLANT_RULES.radius);
  }
});

test('a distant visible defender does not indefinitely cancel an unpressured plant',()=>{
  const {sim,p,enemy}=plantScenario();
  Object.assign(enemy,{x:-19,z:-3,hp:1000});
  Object.assign(p,{yaw:Math.atan2(enemy.x-p.x,enemy.z-p.z),nextThink:Infinity,target:enemy.id,acquired:0,
    aimPoint:{x:enemy.x,z:enemy.z},noticedEnemies:[{...enemy}],channel:.4});
  assert.equal(sim.visible(p,enemy),true);
  for(let tick=0;tick<110&&sim.bomb.status!=='planted';tick++)sim.step();
  assert.equal(sim.bomb.status,'planted');assert.equal(p.impact.plants,1);
});

test('an immediate visible threat interrupts planting and allows the carrier to defend itself',()=>{
  const {sim,p,enemy}=plantScenario();
  Object.assign(enemy,{x:-23,z:16,hp:1000,yaw:0});
  Object.assign(p,{yaw:Math.PI,nextThink:Infinity,target:enemy.id,acquired:0,nextShot:0,
    aimPoint:{x:enemy.x,z:enemy.z},noticedEnemies:[{...enemy}],channel:1});
  for(let tick=0;tick<20;tick++)sim.step();
  assert.equal(sim.bomb.status,'carried');assert.equal(p.channel,0);assert.ok(p.impact.shots>0);
});

test('shot presentation identifies the actual shooter and equipped gun when a primary is slung',()=>{
  const {sim,p,enemy}=plantScenario();
  Object.assign(p,{weapon:'sniper',equipped:'glock',ammo:5,yaw:Math.PI});
  Object.assign(enemy,{x:-23,z:16,hp:1000});
  sim.fire(p,enemy);
  const shot=sim.shots.at(-1);
  assert.equal(shot.actorId,p.id);assert.equal(shot.weapon,'glock');
  assert.equal(sim.drainAudioCues().find(cue=>cue.kind==='gunshot').weapon,'glock');
});

test('travel time plus the full plant channel releases retreat and slow movement before the last twelve seconds',()=>{
  const {sim,p}=plantScenario('A',{x:0,z:-33});
  Object.assign(p,{hp:25,crouch:true,contact:{x:-19,z:10},contactAt:sim.time,goal:{x:0,z:-31},retreatUntil:sim.time+30});
  sim.remaining=20;sim.decide(p);
  assert.equal(p.objectiveUrgent,true);assert.equal(p.retreatUntil,0);assert.equal(livePlantSite(p.goal),'A');
  sim.move(p,1/30);assert.equal(p.crouch,false);assert.equal(p.stance,'run');
});

test('an unengaged low-HP carrier resumes the objective instead of renewing retreat from old sound reports',()=>{
  const {sim,p}=plantScenario('A',{x:-19,z:9});
  Object.assign(p,{hp:25,damageAt:sim.time-4});
  sim.observeIntel(p,{key:'old-pressure',observerId:p.id,source:'footstep',x:-19,z:12,
    observed:sim.time-1,confidence:.8,uncertainty:2},false);
  sim.decide(p);
  assert.equal(livePlantSite(p.goal),'A');assert.doesNotMatch(p.intent,/fall back|Reposition behind cover/);
});

test('teammates take covering positions while their carrier plants',()=>{
  const {sim,p}=plantScenario();
  p.channel=1;
  const ally=sim.actors.find(a=>a!==p&&a.team===p.team);
  Object.assign(ally,{hp:100,x:-19,z:15,flash:0,smoke:0,incendiary:0,bomb:false,role:'trade',noticedEnemies:[]});
  sim.decide(ally);assert.match(ally.intent,/Cover the plant/);
});

test('recovering a dropped bomb carries through to a completed plant',()=>{
  const {sim,p}=plantScenario();
  p.bomb=false;sim.bomb={status:'dropped',x:p.x,z:p.z,remaining:40};
  for(let tick=0;tick<110&&sim.bomb.status!=='planted';tick++)sim.step();
  assert.equal(sim.bomb.status,'planted');assert.equal(p.impact.plants,1);
  assert.ok(sim.events.some(e=>e.text.includes('recovered the device')));
});
