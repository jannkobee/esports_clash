import {FPS_T_POSITIONS,FPS_CT_POSITIONS} from './fps/fpsPlayerArchitecture.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {LIVE_MID_WINDOW,liveGroundHeight,liveTerrainPathClear,liveOnStairs} from './fps/fpsLiveTerrain.ts';
import {LIVE_FPS_MAP,LIVE_MID,LIVE_TACTICAL,findLivePath,liveWalkable,liveSightline,liveWallIntersections,distance,livePathLength} from './fps/fpsLiveMap.ts';
import {LIVE_RUN_SPEED} from './fps/fpsLiveMovement.ts';
import {FpsLiveSimulation} from './fps/fpsLiveSimulation.ts';
import {FPS_IDENTITY_PERSONALITIES,generatePlayerDNA} from './fps/fpsIdentity.ts';

function isolatedActor(){
  const plan={tempo:.6,structure:.7,aggression:.5,preparation:.7,freedom:.5,economy:.8};
  const cards=Array.from({length:10},(_,i)=>({id:`window-${i}`,name:`Test ${i}`,stats:{rifling:80,positioning:80,entry:80,sniping:80,utility:80,shotcalling:80}}));
  const coach={...plan,rigidity:.7,communication:.7,leadership:.7,adaptability:.7,development:.5};
  const chemistry={trust:.6,communication:.6,understanding:.6,leadershipAcceptance:.6,roleCompetition:.3};
  const identity={players:Object.fromEntries(cards.map((p,i)=>[p.id,{id:p.id,assignments:{t:FPS_T_POSITIONS[(i)%5],ct:FPS_CT_POSITIONS[(i)%5]},personality:FPS_IDENTITY_PERSONALITIES[i],dna:generatePlayerDNA(p.id),intensity:.6,roleSuitability:.6,familiarity:.5}])),teams:{blue:{coach,plan,chemistry},red:{coach,plan,chemistry}}};
  const sim=new FpsLiveSimulation(cards.slice(0,5),cards.slice(5),1337,identity),p=sim.actors[0];
  for(const a of sim.actors)a.hp=a===p?100:0;
  Object.assign(sim,{phase:'live',time:20,roundLiveAt:0});
  Object.assign(p,{x:6,z:28,jump:false,jumpY:0,jumpVy:0,crouch:false,vx:0,vz:0,speed:0,objectiveUrgent:true,nextJump:Infinity,nextPeek:Infinity,freezeDelay:0,target:undefined,contact:undefined,reload:0,equipped:'knife',weaponReady:0});
  return {sim,p};
}

test('enlarged lookout has reachable civic access while its firing window remains closed to walking',()=>{
  const w=LIVE_MID_WINDOW,from={x:6,z:38},path=findLivePath(from,w.hold);
  assert.ok(liveWalkable(w.hold));assert.equal(liveGroundHeight(w.hold),1.8);
  assert.deepEqual(LIVE_MID.window.hold,w.hold);assert.ok(path.length>1);
  let previous=from;for(const point of path){assert.ok(liveTerrainPathClear(previous,point));previous=point;}
  assert.deepEqual(path.at(-1),w.hold);
  assert.equal(liveTerrainPathClear({x:0,z:16},w.hold),false);
  assert.equal(liveTerrainPathClear({x:5,z:20},w.hold),false);
  assert.ok(findLivePath(w.hold,{x:-6,z:28}).length,'The lookout can be left for a rotation');
  for(let i=0;i<w.steps;i++){
    const z=w.stairStart+(i+.5)*(w.stairEnd-w.stairStart)/w.steps;
    assert.ok(Math.abs(liveGroundHeight({x:-3.1,z})-(i+1)*.15)<1e-6);
  }
});

test('the real window passes elevated Mid sight and bullets while sill, lintel, side walls and roof remain solid',()=>{
  const w=LIVE_MID_WINDOW;
  assert.ok(liveSightline(w.hold,w.watch));
  assert.ok(liveSightline(w.hold,{x:0,z:-12}),'The elevated angle looks down the actual Mid corridor');
  assert.ok(!liveSightline(w.hold,LIVE_FPS_MAP.spawns.attackers),'Arrival screen still prevents spawn-to-spawn vision');
  assert.equal(liveWallIntersections({x:0,y:3.3,z:18.6},{x:0,y:3.3,z:15}).length,0);
  assert.ok(liveWallIntersections({x:0,y:2.6,z:18.6},{x:0,y:2.6,z:15}).some(h=>h.wall.id==='mid-window-front-sill'));
  assert.ok(liveWallIntersections({x:0,y:4.9,z:18.6},{x:0,y:4.9,z:15}).some(h=>h.wall.id==='mid-window-front-lintel'));
  assert.ok(liveWallIntersections({x:0,y:3.4,z:20},{x:5,y:3.4,z:20}).some(h=>h.wall.id==='mid-window-side-1'));
  assert.ok(liveWallIntersections({x:0,y:3.4,z:20},{x:0,y:6,z:20}).some(h=>h.wall.id==='mid-window-roof'));
});

test('a real actor enters the house and returns to ground without jumping',()=>{
  const {sim,p}=isolatedActor();let airborne=false;
  for(const goal of [LIVE_MID_WINDOW.hold,{x:-6,z:28}]){
    p.goal=goal;p.path=findLivePath(p,goal);assert.ok(p.path.length);
    for(let tick=0;tick<1800&&distance(p,goal)>.25;tick++){
      sim.time+=1/30;sim.advanceElevation(p,1/30);sim.move(p,1/30);airborne||=p.jump;
    }
    assert.ok(distance(p,goal)<.4,JSON.stringify({x:p.x,z:p.z,y:p.jumpY,path:p.path}));
    assert.ok(Math.abs(p.jumpY-liveGroundHeight(goal))<1e-6);
  }
  assert.equal(airborne,false);
});

test('both site approaches and tactical holds stay reachable around the lookout',()=>{
  for(const site of ['A','B'])for(const goal of [...LIVE_TACTICAL[site].entries,...LIVE_TACTICAL[site].holds,...LIVE_TACTICAL[site].postPlant]){
    assert.ok(liveWalkable(goal),JSON.stringify(goal));
    const path=findLivePath(LIVE_FPS_MAP.spawns.defenders,goal);assert.ok(path.length,JSON.stringify(goal));assert.ok(distance(path.at(-1),goal)<.01);
  }
  const rotation=livePathLength(LIVE_FPS_MAP.sites.A,LIVE_FPS_MAP.sites.B)/LIVE_RUN_SPEED;
  assert.ok(rotation>=10&&rotation<=15,`Rotation ${rotation}`);
});

test('the covered side passage connects the window to the civic return with a gentler second entrance',()=>{
  const w=LIVE_MID_WINDOW;
  assert.ok(liveWalkable(w.sideLanding));assert.equal(liveGroundHeight(w.sideLanding),1.8);
  assert.equal(liveGroundHeight(w.sideApproach),0);
  assert.ok(liveOnStairs({x:-11,z:23.7}),'Side-facing treads suppress automatic route hopping');
  assert.equal(liveWallIntersections({x:0,y:3.4,z:23.1},{x:-5.8,y:3.4,z:23.1}).length,0,'Side doorway and hall are genuinely open');
  assert.ok(liveWallIntersections({x:0,y:3.4,z:20},{x:-5,y:3.4,z:20}).some(h=>h.wall.id==='mid-window-side-west-front'));
  const {sim,p}=isolatedActor();Object.assign(p,{...w.sideApproach});let airborne=false;
  for(const goal of [w.sideLanding,w.hold,w.sideLanding,w.sideApproach]){
    p.goal=goal;p.path=findLivePath(p,goal);assert.ok(p.path.length);
    if(goal===w.sideLanding&&p.x<-15)assert.ok(p.path.every(point=>point.x<-3),'Civic entrance avoids the old rear stair');
    for(let tick=0;tick<1800&&distance(p,goal)>.25;tick++){
      sim.time+=1/30;sim.advanceElevation(p,1/30);sim.move(p,1/30);airborne||=p.jump;
    }
    assert.ok(distance(p,goal)<.4,JSON.stringify({goal,x:p.x,z:p.z,y:p.jumpY,path:p.path}));
    assert.ok(Math.abs(p.jumpY-liveGroundHeight(goal))<1e-6);
  }
  assert.equal(airborne,false,'Both directions use real walking steps');
});

test('attackers can walk the lower Mid entrance up into the house and back out',()=>{
  const w=LIVE_MID_WINDOW,{sim,p}=isolatedActor();Object.assign(p,{...w.tApproach});let airborne=false;
  for(const goal of [{x:-3.1,z:23.5},w.hold,{x:-3.1,z:23.5},w.tApproach]){
    p.goal=goal;p.path=findLivePath(p,goal);assert.ok(p.path.length);
    for(let tick=0;tick<1800&&distance(p,goal)>.25;tick++){
      sim.time+=1/30;sim.advanceElevation(p,1/30);sim.move(p,1/30);airborne||=p.jump;
    }
    assert.ok(distance(p,goal)<.4,JSON.stringify({goal,x:p.x,z:p.z,y:p.jumpY,path:p.path}));
    assert.ok(Math.abs(p.jumpY-liveGroundHeight(goal))<1e-6);
  }
  assert.equal(airborne,false);
});

test('street doors have level thresholds and CT stairs are fully inside the house',()=>{
  for(const point of [{x:-3.1,z:16.2},{x:-15.8,z:24.3},{x:2.8,z:27.5}]){
    assert.ok(liveWalkable(point));assert.equal(liveGroundHeight(point),0);assert.equal(liveOnStairs(point),false);
  }
  assert.equal(LIVE_FPS_MAP.solids.some(w=>w.id.startsWith('mid-window-side-cheek-')||w.id.startsWith('mid-window-stair-cheek-')||w.id.startsWith('mid-window-t-wing-')||w.id==='mid-window-t-west-wall'||w.id==='mid-window-t-east-wall'||w.id==='mid-window-t-street-header'),false);
  assert.ok(LIVE_FPS_MAP.solids.filter(w=>w.id.startsWith('mid-window-')).every(w=>w.minZ>=16.7));
  const {sim,p}=isolatedActor();Object.assign(p,{x:2.8,z:27.5});let airborne=false;
  for(const goal of [LIVE_MID_WINDOW.hold,{x:2.8,z:27.5}]){
    p.goal=goal;p.path=findLivePath(p,goal);assert.ok(p.path.length);
    for(let tick=0;tick<1800&&distance(p,goal)>.25;tick++){
      sim.time+=1/30;sim.advanceElevation(p,1/30);sim.move(p,1/30);airborne||=p.jump;
    }
    assert.ok(distance(p,goal)<.4,JSON.stringify({goal,x:p.x,z:p.z,path:p.path}));
    assert.ok(Math.abs(p.jumpY-liveGroundHeight(goal))<1e-6);
  }
  assert.equal(airborne,false);
});
