import assert from 'node:assert/strict';
import {createBaselineSimulation} from './fpsBaselineFixtures.mjs';
import {LIVE_WEAPONS} from '../fps/fpsLiveWeapons.ts';
import {liveGroundHeight} from '../fps/fpsLiveTerrain.ts';

// Each family runs the current armory automatically. These are gameplay
// invariants, not a frozen seed score, selected winner or tuning benchmark.
const arsenal=Object.entries(LIVE_WEAPONS);
const probeArsenal=arsenal.filter(([,stats])=>stats.category!=='sniper');
const seeds=[17,1337];
function scenario(weapon,seed=1337){
  const sim=createBaselineSimulation(seed),stats=LIVE_WEAPONS[weapon];
  Object.assign(sim,{phase:'live',time:20,liveElapsed:10,remaining:80});sim.pendingBuys.clear();
  sim.shots=[];sim.grenades=[];sim.smokes=[];sim.fires=[];
  for(const actor of sim.actors)Object.assign(actor,{hp:0,profile:undefined,bomb:false,target:undefined,
    nextSense:Infinity,nextThink:Infinity,nextShot:0,utilityPreparation:undefined,throwAt:undefined,
    reload:0,channel:0,blinded:0,weaponReady:0,damageAt:-100,seenAt:-100,contactAt:-100,lastShot:-100,
    equipUntil:0,path:[],goal:undefined,x:-19,z:-10,yaw:0,pitch:0,jumpY:0,jump:false,speed:0,vx:0,vz:0,
    stillSince:0,scopeState:'hip',scopeLevel:0,holsteredPrimary:undefined,sidearmUntil:0,peek:undefined,
    recoil:0,recoilPitch:0,glockBurstRemaining:0,knownSmokes:[],suppression:undefined,intel:{contacts:[]},
    objectiveUrgent:false,bombEscape:undefined,lookAwayUntil:0,lookAwayPoint:undefined,noticedEnemies:[]});
  const player=sim.actors[0],enemy=sim.actors.find(a=>a.team!==player.team),ally=sim.actors.find(a=>a!==player&&a.team===player.team);
  Object.assign(player,{hp:100,weapon,equipped:weapon,ammo:stats.magazine,reserve:stats.reserve,pitch:Math.atan2(1.25-1.6,8)});
  const contact={key:'baseline:last-observation',enemyId:'baseline-observed',observerId:player.id,source:'sight',
    x:-19,z:-2,observed:19.9,confidence:.98,uncertainty:.45};
  player.intel.contacts=[contact];player.contact={x:contact.x,z:contact.z};player.contactAt=contact.observed;
  const smoke={id:410,x:-19,z:-6,y:1.4,radius:3.3,startedAt:17,expires:38};
  player.knownSmokes=[{...smoke}];sim.smokes=[{...smoke}];
  return {sim,player,enemy,ally,contact,stats};
}
function inventory(player){return {weapon:player.weapon,equipped:player.equipped,ammo:player.ammo,reserve:player.reserve,
  flash:player.flash,smoke:player.smoke,he:player.he,incendiary:player.incendiary};}
function shotShape(shot){return {weapon:shot.weapon,from:shot.from,to:shot.to,fromY:shot.fromY,toY:shot.toY,
  targetId:shot.targetId,hitRegion:shot.hitRegion};}
function assertSilent(fixture,label){
  const {sim,player}=fixture,before=inventory(player),health=sim.actors.map(a=>a.hp);
  sim.tryInformationFire(player);
  assert.deepEqual(inventory(player),before,`${label}: veto consumed inventory`);
  assert.equal(sim.shots.length,0,`${label}: veto emitted a world shot`);
  assert.deepEqual(sim.actors.map(a=>a.hp),health,`${label}: veto damaged an actor`);
}

export const baselineTacticalContracts=[
  {name:'Every weapon obeys bounded smoke-fire ammunition and world-shot accounting',run(){
    const categories=new Set();let cases=0,active=0,spentTotal=0;
    for(const seed of seeds)for(const [weapon,stats] of arsenal){
      const {sim,player,contact}=scenario(weapon,seed);categories.add(stats.category);
      const reserve=player.reserve;
      for(let tick=0;tick<87;tick++){
        sim.time=20+tick/30;contact.observed=sim.time-.1;
        sim.tryInformationFire(player);
      }
      const spent=stats.magazine-player.ammo;spentTotal+=spent;cases++;
      assert.equal(spent,sim.shots.length,`${weapon}/${seed}: ammunition differs from actual world shots`);
      assert.equal(spent,player.impact.shots,`${weapon}/${seed}: impact accounting differs from shots`);
      assert.equal(player.reserve,reserve,`${weapon}/${seed}: probing manufactured or consumed reserve`);
      assert.ok(player.ammo>=Math.max(3,Math.ceil(stats.magazine*.3)),`${weapon}/${seed}: no next-duel reserve`);
      assert.ok(spent<=9,`${weapon}/${seed}: unbounded speculative magazine dump`);
      if(stats.category==='sniper')assert.equal(spent,0,`${weapon}/${seed}: scarce precision ammunition spent blindly`);
      else{assert.ok(spent>0,`${weapon}/${seed}: eligible weapon never exercised its real firing path`);active++;}
      for(const shot of sim.shots){
        assert.ok(Number.isFinite(shot.to.x+shot.to.z+shot.fromY+shot.toY),`${weapon}/${seed}: invalid world ray`);
        assert.equal(shot.weapon,weapon);assert.equal(shot.targetId,undefined,'A remembered ID cannot become an invented hit');
      }
    }
    assert.ok(cases>=42&&active>=38&&spentTotal>60,'The armory matrix lost meaningful cases');
    assert.ok(['pistol','smg','rifle','sniper','shotgun','heavy'].every(c=>categories.has(c)),'A weapon category disappeared from coverage');
    return {cases,categories:categories.size,actualShots:spentTotal};
  }},
  {name:'Unseen opponent movement and conflicting pointers cannot steer evidence-led world rays',run(){
    let cases=0;
    for(const seed of seeds)for(const [weapon] of probeArsenal){
      const outcomes=[];
      for(const position of [{x:18,z:30},{x:30,z:-20}]){
        const {sim,player,enemy}=scenario(weapon,seed);
        Object.assign(enemy,{hp:100,...position,jumpY:liveGroundHeight(position)});
        player.contact={x:27,z:15};player.aimPoint={x:-30,z:30};
        sim.tryInformationFire(player);
        assert.equal(player.target,undefined,'Speculative fire acquired an unseen opponent');
        assert.equal(enemy.hp,100,'An off-ray unseen opponent took speculative damage');
        assert.equal(sim.shots.length,1,`${weapon}/${seed}: comparison never emitted a real ray`);
        outcomes.push({ammo:player.ammo,yaw:player.yaw,pitch:player.pitch,action:player.action,
          suppression:player.suppression,shots:sim.shots.map(shotShape)});
      }
      assert.deepEqual(outcomes[0],outcomes[1],`${weapon}/${seed}: hidden movement altered legal firing behavior`);cases++;
    }
    assert.ok(cases>=38,'The hidden-position matrix lost weapon or seed coverage');
    return {cases,actualShots:cases*2};
  }},
  {name:'Objective, handling, blindness and full-ray teammate safety veto real smoke shots',run(){
    const vetoes={
      objective:({player})=>{player.objectiveUrgent=true;},
      escaping:({player})=>{player.bombEscape={point:{x:-31,z:-20}};},
      draw:({player})=>{player.weaponReady=.4;},
      reload:({player})=>{player.reload=.5;},
      blind:({player})=>{player.blinded=.8;},
      channel:({player})=>{player.channel=.5;},
      utility:({player})=>{player.utilityPreparation={kind:'flash',target:{x:-19,z:0}};},
      holstered:({player})=>{player.equipped='knife';},
      acquiredTarget:({player,enemy})=>{player.target=enemy.id;},
      teammateBefore:({ally})=>{Object.assign(ally,{hp:100,x:-19,z:-7,jumpY:0});},
      teammateBeyond:({ally})=>{Object.assign(ally,{hp:100,x:-19,z:2,jumpY:0});},
      flashTurn:({sim,player})=>{player.lookAwayUntil=sim.time+1;player.lookAwayStarts=sim.time-.1;player.lookAwayPoint={x:-19,z:-8,y:1.6};},
    };
    let cases=0;
    for(const [weapon] of probeArsenal){
      const control=scenario(weapon);control.sim.tryInformationFire(control.player);
      assert.equal(control.sim.shots.length,1,`${weapon}: veto controls must be capable of firing`);
      for(const [label,mutate] of Object.entries(vetoes)){
        const fixture=scenario(weapon);mutate(fixture);assertSilent(fixture,`${weapon}/${label}`);cases++;
      }
    }
    assert.ok(cases>=228,'The safety-veto matrix lost cases');
    return {cases,positiveControls:probeArsenal.length};
  }},
  {name:'Absent or degraded evidence stays silent, while a real body can intercept an unchanged speculative ray',run(){
    const rejected={
      absent:({player})=>{player.intel.contacts=[];},
      old:({contact})=>{contact.observed=16;},
      vague:({contact})=>{contact.uncertainty=9;},
      weak:({contact})=>{contact.confidence=.15;},
      footstep:({contact})=>{contact.source='footstep';},
      utilityCue:({contact})=>{contact.source='utility';},
      reloadCue:({contact})=>{contact.source='reload';},
      clearLane:({player,sim})=>{player.knownSmokes=[];sim.smokes=[];},
      expiredCloud:({player,sim})=>{player.knownSmokes[0].expires=19;sim.smokes[0].expires=19;},
      lastRounds:({player})=>{player.ammo=3;},
    };
    let cases=0;
    for(const [weapon] of probeArsenal)for(const [label,mutate] of Object.entries(rejected)){
      const fixture=scenario(weapon);mutate(fixture);assertSilent(fixture,`${weapon}/${label}`);cases++;
    }
    let actualHits=0;
    for(const seed of seeds){
      const empty=scenario('m4a1_s',seed),occupied=scenario('m4a1_s',seed);
      Object.assign(occupied.enemy,{hp:100,armor:0,x:occupied.contact.x,z:occupied.contact.z,jumpY:0});
      empty.sim.tryInformationFire(empty.player);occupied.sim.tryInformationFire(occupied.player);
      assert.equal(empty.sim.shots.length,1);assert.equal(occupied.sim.shots.length,1);
      assert.equal(empty.player.ammo,occupied.player.ammo);assert.equal(empty.player.yaw,occupied.player.yaw);assert.equal(empty.player.pitch,occupied.player.pitch);
      assert.equal(occupied.player.target,undefined,'A physical blind hit cannot grant prior visual acquisition');
      assert.ok(occupied.enemy.hp<100&&occupied.player.impact.hits>0,'A real body did not intercept the speculative world shot');
      assert.equal(occupied.sim.shots[0].targetId,occupied.enemy.id,'Actual collision did not identify its actual hit actor');
      assert.equal(empty.sim.shots[0].targetId,undefined,'Empty-space ray invented a target');
      const ray=shot=>{
        const dx=shot.to.x-shot.from.x,dy=shot.toY-shot.fromY,dz=shot.to.z-shot.from.z,length=Math.hypot(dx,dy,dz);
        return [dx/length,dy/length,dz/length];
      };
      const a=ray(empty.sim.shots[0]),b=ray(occupied.sim.shots[0]);
      assert.ok(a.every((v,i)=>Math.abs(v-b[i])<1e-10),'Hidden occupancy changed the fired direction rather than only collision');
      actualHits++;
    }
    assert.ok(cases>=190&&actualHits===seeds.length,'The evidence matrix lost meaningful silent or positive-hit cases');
    return {cases,actualHits};
  }},
];
