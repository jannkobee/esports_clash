import test from 'node:test';
import assert from 'node:assert/strict';
import {FpsLiveSimulation} from './fps/fpsLiveSimulation.ts';
import {createFpsIdentityContext} from './fps/fpsIdentityMatch.ts';
import {LIVE_FPS_MAP,LIVE_MARKET_PASSAGE,findLivePath,distance,liveWalkable,liveMovementSegmentClear,liveWallIntersections} from './fps/fpsLiveMap.ts';
import {LIVE_MID_WINDOW as window,liveGroundHeight} from './fps/fpsLiveTerrain.ts';
import {LIVE_WINDOW_FURNITURE} from './fps/fpsMidWindowInterior.ts';

const cards=Array.from({length:10},(_,i)=>({id:`routing-${i}`,name:`Route ${i}`,stats:{rifling:80,sniping:80,entry:80,utility:80,positioning:80,shotcalling:80}}));
function game(){
  const sim=new FpsLiveSimulation(cards.slice(0,5),cards.slice(5),1337,createFpsIdentityContext(cards.slice(0,5),cards.slice(5)));
  Object.assign(sim,{phase:'live',time:20,roundLiveAt:0,liveElapsed:20,remaining:80});
  for(const p of sim.actors)Object.assign(p,{hp:0,bomb:false,vx:0,vz:0,speed:0,jump:false,jumpY:0,jumpVy:0,nextJump:Infinity,nextPeek:Infinity,
    target:undefined,contact:undefined,contactAt:-100,damageAt:-100,freezeDelay:0,equipped:'knife',reload:0,stuckFor:0,utilityPreparation:undefined,smokeLineupId:undefined,clearUntil:0,
    objectiveUrgent:false,trafficYield:undefined,routeRepairAt:0,brakeAt:undefined,knownSmokes:[],path:[],goal:undefined});
  return sim;
}
function route(p,from,to){
  Object.assign(p,{...from,hp:100,goal:to,path:findLivePath(from,to),vx:0,vz:0,speed:0,jump:false,jumpY:liveGroundHeight(from),jumpVy:0,trafficYield:undefined});
  assert.ok(p.path.length,JSON.stringify({from,to}));
}
function tick(sim,players){
  sim.time+=1/30;
  for(const p of players){sim.advanceElevation(p,1/30);sim.move(p,1/30);assert.ok(Number.isFinite(p.x+p.z));assert.equal(p.jump,false);}
  for(const p of players)for(const q of players)if(p!==q&&Math.abs(p.jumpY-q.jumpY)<.6)assert.ok(distance(p,q)>.89,'Bodies must not pass through each other');
}

test('all 80 valid restaurant start/exit combinations physically reach their routes',()=>{
  const sim=game(),p=sim.actors.find(a=>a.attacking);let count=0;
  for(const x of [-8,-6,-4,-2,0,2,4,6,8])for(const z of [-39,-37,-35,-33,-31])for(const side of [-1,1]){
    const from={x,z},to={x:side*8,z:-24};if(!liveWalkable(from))continue;
    route(p,from,to);count++;
    for(let i=0;i<450&&distance(p,to)>.5;i++)tick(sim,[p]);
    assert.ok(distance(p,to)<.5,JSON.stringify({from,to,x:p.x,z:p.z,path:p.path}));
  }
  assert.equal(count,80);
});

test('five teammates crossing toward opposite restaurant exits yield and leave the doorway',()=>{
  const sim=game(),players=sim.actors.filter(a=>a.attacking);
  for(const [i,p] of players.entries())route(p,{x:(i-2)*1.1,z:-31},{x:(i%2?1:-1)*8,z:-24});
  let yielded=false;
  for(let i=0;i<600;i++){tick(sim,players);yielded||=players.some(p=>p.action==='Making room for teammate');}
  assert.ok(yielded,'Crossing players must resolve the old symmetric blockage');
  for(const p of players){assert.ok(p.z>-29,JSON.stringify({x:p.x,z:p.z,path:p.path}));assert.equal(p.stuckFor,0);}
  assert.ok(players.some(p=>p.action==='Holding trade spacing'),'A shared occupied destination is a hold, not endless running');
});

test('opposing teammates can pass the one-person B market gap without collision or jumping',()=>{
  const sim=game(),players=sim.actors.filter(a=>a.attacking).slice(0,2),[a,b]=players;
  const south={x:18,z:16},north=LIVE_MARKET_PASSAGE.north;
  route(a,south,north);route(b,north,south);
  for(let i=0;i<1200&&(distance(a,north)>.6||distance(b,south)>.6);i++)tick(sim,players);
  assert.ok(distance(a,north)<.6,JSON.stringify({actor:a.id,x:a.x,z:a.z,path:a.path}));
  assert.ok(distance(b,south)<.6,JSON.stringify({actor:b.id,x:b.x,z:b.z,path:b.path}));
});

test('a close corner waypoint cannot be discarded while the following leg still crosses a wall',()=>{
  const sim=game(),p=sim.actors[0],from={x:2.78,z:-30.2},corner={x:2.5,z:-30.2},to={x:2.5,z:-28.5};
  route(p,from,to);p.path=[corner,to];
  assert.ok(liveMovementSegmentClear(p,corner));assert.equal(liveMovementSegmentClear(p,to),false);
  sim.consumePath(p,.3);assert.deepEqual(p.path[0],corner);
  for(let i=0;i<180&&distance(p,to)>.35;i++)tick(sim,[p]);
  assert.ok(distance(p,to)<.35);
});

test('a displaced actor repairs a stale wall-crossing leg before following it',()=>{
  const sim=game(),p=sim.actors[0],from={x:4,z:-30.3},to={x:4,z:-28};
  route(p,from,to);p.path=[to];assert.equal(liveMovementSegmentClear(from,to),false);
  tick(sim,[p]);assert.ok(p.path.length>1,'The fresh path must use the real door');
  for(let i=0;i<300&&distance(p,to)>.35;i++)tick(sim,[p]);
  assert.ok(distance(p,to)<.35);
});

test('furnished window retains walking access through the T, CT and civic doors in both directions',()=>{
  const sim=game(),p=sim.actors[0];p.objectiveUrgent=true;
  for(const entrance of [window.tApproach,window.rearApproach,window.sideApproach]){
    for(const [from,to] of [[entrance,window.hold],[window.hold,entrance]]){
      route(p,from,to);
      for(let i=0;i<1500&&distance(p,to)>.3;i++)tick(sim,[p]);
      assert.ok(distance(p,to)<.4,JSON.stringify({from,to,x:p.x,z:p.z,path:p.path}));
      assert.ok(Math.abs(p.jumpY-liveGroundHeight(to))<1e-6);
    }
  }
});

test('window furniture is grounded and solid while the main firing line remains clear',()=>{
  for(const item of LIVE_WINDOW_FURNITURE){
    assert.equal(liveGroundHeight(item),item.baseY);
    assert.equal(liveWalkable(item),false);
    const wall=LIVE_FPS_MAP.solids.find(s=>s.id===item.id);assert.ok(wall);
    assert.equal(wall.baseY,item.baseY);assert.equal(wall.height,item.baseY+item.height);
    const hits=liveWallIntersections({x:item.x,y:item.baseY+item.height/2,z:item.z-2},{x:item.x,y:item.baseY+item.height/2,z:item.z+2});
    assert.ok(hits.some(h=>h.wall.id===item.id));
  }
  assert.equal(liveWallIntersections({x:0,y:3.4,z:18.6},{x:0,y:1.6,z:6}).length,0);
});
