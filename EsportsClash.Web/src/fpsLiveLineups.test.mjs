import {FPS_T_POSITIONS,FPS_CT_POSITIONS} from './fps/fpsPlayerArchitecture.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {LIVE_AUTHORED_SMOKE_LINEUPS,solveLiveSmokeThrow,LIVE_SMOKE_SOLUTION_LIMITS} from './fps/fpsLiveLineups.ts';
import {launchLiveGrenade,predictLiveGrenade,stepLiveGrenade} from './fps/fpsLiveGrenades.ts';
import {distance,liveWalkable,findLivePath,LIVE_FPS_MAP} from './fps/fpsLiveMap.ts';
import {liveGroundHeight} from './fps/fpsLiveTerrain.ts';
import {computeLiveGrenadeTrajectoryPoints} from './fps/fpsLiveViewer.ts';
import {FpsLiveSimulation} from './fps/fpsLiveSimulation.ts';
import {FPS_IDENTITY_PERSONALITIES,generatePlayerDNA} from './fps/fpsIdentity.ts';

const handPoint=lineup=>{
  const yaw=Math.atan2(lineup.target.x-lineup.position.x,lineup.target.z-lineup.position.z);
  return {x:lineup.position.x+Math.sin(yaw)*.2+Math.cos(yaw)*.16,z:lineup.position.z+Math.cos(yaw)*.2-Math.sin(yaw)*.16,level:lineup.position.level};
};

test('every authored smoke has a reachable launch point and a physical low-floor landing from the actual hand',()=>{
  for(const lineup of LIVE_AUTHORED_SMOKE_LINEUPS){
    assert.ok(liveWalkable(lineup.position),`${lineup.id}: launch point`);
    assert.ok(liveWalkable(lineup.target),`${lineup.id}: target floor`);
    const spawn=LIVE_FPS_MAP.spawns[lineup.attacking?'attackers':'defenders'];
    assert.ok(findLivePath(spawn,lineup.position).length,`${lineup.id}: reachable from spawn`);
    const from=handPoint(lineup),height=liveGroundHeight(lineup.position)+1.55;
    const solution=solveLiveSmokeThrow(from,lineup.target,height);assert.ok(solution,`${lineup.id}: physical solution`);
    const grenade=launchLiveGrenade(7,'smoke','test','blue',from,solution.aimTarget??solution.target,9,false,solution.throwStyle,height,{x:0,z:0},solution.flightTime);
    assert.ok(Math.hypot(grenade.vx,grenade.vy,grenade.vz)<=LIVE_SMOKE_SOLUTION_LIMITS.maxLaunchSpeed);
    // Replay actual fixed ticks through rest detonation, including any partial final tick. A
    // solution never moves the item to the destination when its fuse expires.
    let elapsed=0;
    const fuse=grenade.detonateAt-grenade.releaseAt;
    while(elapsed<fuse-1e-8){const dt=Math.min(1/30,fuse-elapsed);stepLiveGrenade(grenade,dt);elapsed+=dt;}
    assert.ok(distance(grenade,lineup.target)<=.6,`${lineup.id}: landed ${JSON.stringify(grenade)}`);
    const offset=grenade.y-liveGroundHeight(lineup.target);
    assert.ok(offset>=.06&&offset<=.45,`${lineup.id}: wrong floor ${grenade.y}`);
    assert.ok(distance(grenade,solution.forecast)<.01,`${lineup.id}: forecast/release mismatch`);
  }
});

test('covered market uses a low arc and CT delay lands north of its roof instead of exploding above it',()=>{
  const passage=LIVE_AUTHORED_SMOKE_LINEUPS.find(l=>l.id==='b-speedway');
  const from=handPoint(passage),height=liveGroundHeight(passage.position)+1.55;
  const ordinary=predictLiveGrenade(launchLiveGrenade(1,'smoke','test','blue',from,passage.target,0,false,'overhead',height),0);
  assert.ok(distance(ordinary,passage.target)>3);
  const solution=solveLiveSmokeThrow(from,passage.target,height);assert.ok(solution);assert.ok(solution.flightTime<1);
  const ct=LIVE_AUTHORED_SMOKE_LINEUPS.find(l=>l.id==='guard-market');
  const delay=solveLiveSmokeThrow(handPoint(ct),ct.target,liveGroundHeight(ct.position)+1.55);assert.ok(delay);
  assert.ok(delay.forecast.y<.45);assert.ok(ct.target.z>11.2);
});

test('smoke solver rejects blocked or impossible floors and cached results cannot be mutated by the caller',()=>{
  assert.equal(solveLiveSmokeThrow({x:0,z:-14},{x:23,z:9},1.55),undefined,'Closed market house is not a lineup position');
  assert.equal(solveLiveSmokeThrow({x:0,z:-14},{x:0,z:40},1.55),undefined,'Range remains bounded');
  assert.equal(solveLiveSmokeThrow({x:NaN,z:-14},{x:0,z:19.5},1.55),undefined);
  const lineup=LIVE_AUTHORED_SMOKE_LINEUPS.find(l=>l.id==='a-arch'),from=handPoint(lineup),height=liveGroundHeight(lineup.position)+1.55;
  const first=solveLiveSmokeThrow(from,lineup.target,height);assert.ok(first);first.forecast.x=999;first.target.x=999;
  const next=solveLiveSmokeThrow(from,lineup.target,height);assert.ok(next);assert.ok(next.forecast.x<0);assert.equal(next.target.x,lineup.target.x);
});

test('trajectory helper builds elevated arc and snapshots export utilityPrep target metadata',()=>{
  const lineup=LIVE_AUTHORED_SMOKE_LINEUPS.find(l=>l.id==='a-arch'),from=handPoint(lineup),height=liveGroundHeight(lineup.position)+1.55;
  const solution=solveLiveSmokeThrow(from,lineup.target,height);assert.ok(solution);
  const grenade=launchLiveGrenade(11,'smoke','test','red',from,solution.aimTarget??solution.target,5,false,solution.throwStyle,height,{x:0,z:0},solution.flightTime);
  const arc=computeLiveGrenadeTrajectoryPoints(grenade);
  assert.ok(arc.length>=10,'Trajectory arc should preserve curved flight samples');
  assert.ok(Math.hypot(arc[0].x-from.x,arc[0].z-from.z)<.01);
  assert.ok(Math.max(...arc.map(p=>p.y))>height+1.5);
  assert.ok(Math.hypot(arc.at(-1).x-lineup.target.x,arc.at(-1).z-lineup.target.z)<=.6);

  const plan={tempo:.6,structure:.7,aggression:.5,preparation:.7,freedom:.5,economy:.8};
  const cards=Array.from({length:10},(_,i)=>({id:`lineup-${i}`,name:`Test ${i}`,stats:{rifling:80,positioning:80,entry:80,sniping:80,utility:80,shotcalling:80}}));
  const coach={...plan,rigidity:.7,communication:.7,leadership:.7,adaptability:.7,development:.5};
  const chemistry={trust:.6,communication:.6,understanding:.6,leadershipAcceptance:.6,roleCompetition:.3};
  const identity={players:Object.fromEntries(cards.map((p,i)=>[p.id,{id:p.id,assignments:{t:FPS_T_POSITIONS[(i)%5],ct:FPS_CT_POSITIONS[(i)%5]},personality:FPS_IDENTITY_PERSONALITIES[i],dna:generatePlayerDNA(p.id),intensity:.6,roleSuitability:.6,familiarity:.5}])),teams:{blue:{coach,plan,chemistry},red:{coach,plan,chemistry}}};
  const sim=new FpsLiveSimulation(cards.slice(0,5),cards.slice(5),4242,identity);
  Object.assign(sim,{phase:'live',time:20,roundLiveAt:0});
  for(const actor of sim.actors)actor.hp=0;
  const thrower=sim.actors[5];
  Object.assign(thrower,{hp:100,smoke:1,reload:0,weaponReady:0,utilityAt:0,x:lineup.position.x,z:lineup.position.z,level:lineup.position.level,jumpY:0,crouch:false,channel:0,target:undefined});
  assert.equal(sim.throwUtility(thrower,'smoke',lineup.target,lineup.throwStyle,lineup.id),true);
  const pub=sim.snapshot().players.find(p=>p.id===thrower.id);
  assert.ok(pub?.utilityPrep?.target);
  assert.equal(pub.utilityPrep.kind,'smoke');
  assert.equal(pub.utilityPrep.lineupId,lineup.id);
  assert.equal(pub.utilityPrep.throwStyle,solution.throwStyle);
  assert.ok((pub.utilityPrep.flightTime??0)>0);
});
