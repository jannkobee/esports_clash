import {FPS_T_POSITIONS,FPS_CT_POSITIONS} from './fps/fpsPlayerArchitecture.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { LIVE_B_APARTMENTS, LIVE_TERRAIN_SOLIDS, liveGroundHeight, liveTerrainPathClear } from './fps/fpsLiveTerrain.ts';
import { LIVE_FPS_MAP, findLivePath, liveWalkable, liveSightline, liveWallIntersections, liveWallSegmentHit } from './fps/fpsLiveMap.ts';
import { advanceLiveJump } from './fps/fpsLiveMovement.ts';
import { FpsLiveSimulation } from './fps/fpsLiveSimulation.ts';
import { LIVE_WEAPONS, LIVE_SIDE_LOADOUTS, canBuyLiveWeapon } from './fps/fpsLiveWeapons.ts';
import { buyLiveTeam } from './fps/fpsLiveEconomy.ts';
import { launchLiveGrenade, stepLiveGrenade, liveGrenadeSightline } from './fps/fpsLiveGrenades.ts';
import { traceLiveActorHit } from './fps/fpsLiveBallistics.ts';
import { FPS_IDENTITY_PERSONALITIES, generatePlayerDNA } from './fps/fpsIdentity.ts';

const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
const plan={tempo:.6,structure:.7,aggression:.5,preparation:.7,freedom:.5,economy:.8};
function game() {
  const cards=Array.from({length:10},(_,i)=>({id:`elevation-${i}`,name:`Test ${i}`,stats:{rifling:80,positioning:80,entry:80,sniping:80,utility:80,shotcalling:80}}));
  const coach={...plan,rigidity:.7,communication:.7,leadership:.7,adaptability:.7,development:.5};
  const chemistry={trust:.6,communication:.6,understanding:.6,leadershipAcceptance:.6,roleCompetition:.3};
  const identity={players:Object.fromEntries(cards.map((p,i)=>[p.id,{id:p.id,assignments:{t:FPS_T_POSITIONS[(i)%5],ct:FPS_CT_POSITIONS[(i)%5]},personality:FPS_IDENTITY_PERSONALITIES[i],dna:generatePlayerDNA(p.id),intensity:.6,roleSuitability:.6,familiarity:.5}])),teams:{blue:{coach,plan,chemistry},red:{coach,plan,chemistry}}};
  return new FpsLiveSimulation(cards.slice(0,5),cards.slice(5),1337,identity);
}

test('apartment routes climb the staircase instead of its sheer side and can return to ground',()=>{
  const start={x:30,z:18},goal=LIVE_B_APARTMENTS.hold;
  assert.ok(liveWalkable(goal)); assert.equal(liveTerrainPathClear(start,goal),false);
  const path=findLivePath(start,goal); assert.ok(path.length>1);
  let previous=start;
  for(const point of path){assert.ok(liveTerrainPathClear(previous,point,undefined,true));previous=point;}
  assert.ok(path.some(p=>p.z<14),'The gallery entrance must be approached through the stairs');
  assert.deepEqual(path.at(-1),goal);
  const back=findLivePath(goal,{x:32,z:7});assert.ok(back.length);
  previous=goal;for(const point of back){assert.ok(liveTerrainPathClear(previous,point,undefined,true));previous=point;}
  for(let i=0;i<10;i++)close(liveGroundHeight({x:29.4,z:8+(i+.5)*.6}),(i+1)*.18);
});

test('actual actor motion climbs grounded treads, holds the deck, and falls from an open edge',()=>{
  const sim=game(),p=sim.actors[0];for(const other of sim.actors)other.hp=other===p?100:0;
  Object.assign(p,{x:29.4,z:7.4,vx:0,vz:0,speed:0,jump:false,jumpY:0,jumpVy:0,isBoosted:false});
  let previousHeight=0;
  for(let i=0;i<260&&p.z<18.2;i++){
    const wish=p.z<14.1?{x:0,z:2}:p.x<32?{x:2,z:0}:{x:0,z:2};
    sim.time+=1/30;sim.applyMotion(p,wish,1/30,'walk');
    assert.equal(p.jump,false);close(p.jumpY,liveGroundHeight(p));assert.ok(p.jumpY-previousHeight<=.181);previousHeight=p.jumpY;
  }
  close(p.jumpY,1.8);assert.ok(p.z>18);
  let state={jump:false,jumpY:1.8,jumpVy:0,groundY:1.8};
  for(let i=0;i<30;i++)state=advanceLiveJump(state,1/30);
  assert.equal(state.jump,false);close(state.jumpY,1.8);
  Object.assign(p,{x:31,z:14.2,vx:0,vz:0,speed:0,jump:false,jumpY:1.8,jumpVy:0});
  let fell=false;
  for(let i=0;i<60;i++){
    Object.assign(p,advanceLiveJump({jump:p.jump,jumpY:p.jumpY,jumpVy:p.jumpVy,groundY:liveGroundHeight(p)},1/30));
    sim.time+=1/30;sim.applyMotion(p,{x:-2,z:0},1/30,'walk');fell ||= p.jump;
  }
  assert.ok(fell);close(p.jumpY,0);assert.equal(p.jump,false);assert.ok(p.x<30);
  Object.assign(p,{jump:true,jumpY:1.8,jumpVy:0,vx:0,vz:0,path:[],goal:undefined,postRoamAt:sim.time+100});
  for(let i=0;i<30;i++){sim.time+=1/30;sim.stepPostRound(1/30);}
  close(p.jumpY,0);assert.equal(p.jump,false,'Gravity continues during the round break');
});

test('gallery sight, actor hit regions, parapets and solid floors share world elevation',()=>{
  const below={x:23,z:16},above=LIVE_B_APARTMENTS.hold;
  assert.ok(liveSightline(below,above),'Standing sight clears the low gallery parapet');
  const rail=LIVE_FPS_MAP.solids.find(w=>w.id==='b-apartments-parapet');
  assert.equal(liveWallSegmentHit({x:29,y:1,z:18},{x:31,y:1,z:18},rail),undefined);
  assert.notEqual(liveWallSegmentHit({x:29,y:2.2,z:18},{x:31,y:2.2,z:18},rail),undefined);
  assert.ok(liveWallIntersections({x:29,y:.8,z:18},{x:32,y:.8,z:18}).some(hit=>hit.wall.height===1.8&&(hit.wall.baseY??0)===0));
  const roof=liveWallIntersections({x:32,y:3.5,z:18},{x:32,y:5,z:18});
  assert.equal(roof[0].wall.id,'b-apartments-roof');close(3.5+roof[0].t*1.5,4.35);
  const target={...above,jumpY:1.8,crouch:false};
  assert.equal(traceLiveActorHit({x:28,y:3.34,z:above.z},{x:1,y:0,z:0},10,target)?.region,'head');
  assert.equal(traceLiveActorHit({x:28,y:1.54,z:above.z},{x:1,y:0,z:0},10,target),undefined);
});

test('crouched utility releases and grenade bounces respect the raised floor',()=>{
  const spot=LIVE_B_APARTMENTS.hold;
  const g=launchLiveGrenade(1,'smoke','p','blue',spot,spot,0,false,'crouch',3.35);
  close(g.y,2.82);Object.assign(g,{vx:0,vz:0,vy:0,y:2.4});
  for(let i=0;i<90;i++){stepLiveGrenade(g,1/30);assert.ok(g.y>=1.89-1e-6);}
  close(g.y,1.89);
  assert.equal(liveGrenadeSightline({x:29,y:.8,z:18},{x:32,y:.8,z:18}),false);
  const rising={...g,y:4.1,vy:10,vx:0,vz:0};stepLiveGrenade(rising,1/30);
  assert.ok(rising.vy<0&&rising.y<=4.26,'Utility must bounce off the gallery ceiling from below');
  assert.ok(LIVE_TERRAIN_SOLIDS.some(w=>w.id==='b-apartments-roof'&&w.baseY===4.35));
});

test('new buys and paid gifts use faction guns across economy tiers while recovered guns survive',()=>{
  const sim=game();
  for(const p of sim.snapshot().players)assert.equal(p.weapon,p.attacking?'glock':'usp_s');
  sim.round=16;sim.startRound();
  for(const p of sim.snapshot().players){assert.equal(p.weapon,p.attacking?'glock':'usp_s');assert.equal(p.attacking,p.team==='blue');}
  for(const attacking of [false,true])for(const cash of [800,1400,1800,4500,10000]) {
    const loadout=LIVE_SIDE_LOADOUTS[attacking?'t':'ct'];
    const players=['entry','trade','sniper','support','anchor'].map((role,i)=>({id:`buy-${i}`,role,cash,weapon:loadout.sidearm,armor:0,kit:false,flash:0,smoke:0,incendiary:0,he:0,attacking}));
    const original=structuredClone(players),result=buyLiveTeam(players,plan,5,1,cash===1800);
    assert.deepEqual(players,original);
    for(const p of result.players){assert.ok(canBuyLiveWeapon(p.weapon,p.attacking),p.weapon);assert.ok(p.cash>=0);}
    for(const gift of result.gifts)assert.ok(canBuyLiveWeapon(gift.weapon,attacking));
    assert.equal(cash*5-result.players.reduce((n,p)=>n+p.cash,0),result.spent);
    assert.equal(canBuyLiveWeapon(attacking?'m4a1_s':'ak47',attacking),false);
    assert.equal(canBuyLiveWeapon(attacking?'mp9':'mac10',attacking),false);
  }
  const p={id:'captured',role:'entry',cash:1000,weapon:'ak47',armor:100,kit:true,flash:0,smoke:0,incendiary:0,he:0,attacking:false};
  assert.equal(buyLiveTeam([p],plan,5,0,false).players[0].weapon,'ak47');
  assert.equal(LIVE_WEAPONS.ak47.side,'t');assert.equal(LIVE_WEAPONS.m4a1_s.side,'ct');
});


test('removed boost crates leave flat ground without automatic hopping',()=>{
  for(const [x,z] of [[-32,23.8],[21.4,31.2]]){
    const sim=game(),p=sim.actors[0];for(const other of sim.actors)other.hp=other===p?100:0;
    Object.assign(p,{x,z:z-2.3,jump:false,jumpY:0,jumpVy:0,vx:0,vz:0,speed:0,isBoosted:false,nextClimbAt:0});
    let airborne=false;
    for(let tick=0;tick<180;tick++){
      sim.time+=1/30;sim.advanceElevation(p,1/30);
      sim.applyMotion(p,{x:0,z:p.z<z-.05?1.6:0},1/30,'walk');airborne ||= p.jump;
    }
    assert.equal(airborne,false);assert.ok(Math.abs(p.jumpY)<1e-6);assert.ok(p.z>=z-.1);
  }
});
