import test from 'node:test';
import assert from 'node:assert/strict';
import {LIVE_COLLISION_SOLIDS,LIVE_TACTICAL,LIVE_MID} from './fps/fpsLiveMap.ts';
import {segmentHitsWall} from './fps/fpsSpatialWorld.ts';
import {liveGroundHeight,liveFloorAt,liveCanalArea} from './fps/fpsLiveTerrain.ts';
import {LIVE_UTILITY_RULES,LIVE_THROW_PHYSICS,launchLiveGrenade,stepLiveGrenade,liveGrenadeSightline} from './fps/fpsLiveGrenades.ts';

// Frozen pre-index narrow phase from fpsLiveGrenades.ts, 14 November 2026.
// Keep the complete ordered solid scan as an independent broad-phase reference.
function fullScanStep(g,dt) {
  const before={x:g.x,y:g.y,z:g.z};
  g.x+=g.vx*dt;g.y+=g.vy*dt-.5*LIVE_UTILITY_RULES.gravity*dt*dt;g.z+=g.vz*dt;g.vy-=LIVE_UTILITY_RULES.gravity*dt;
  for(const w of LIVE_COLLISION_SOLIDS) {
    if(Math.min(before.y,g.y)>w.height+.09 || Math.max(before.y,g.y)<(w.baseY??0)-.09 || !segmentHitsWall(before,g,w,.09))continue;
    const inside=g.x>w.minX-.09&&g.x<w.maxX+.09&&g.z>w.minZ-.09&&g.z<w.maxZ+.09;
    if(before.y>=w.height+.089&&g.y<=w.height+.09&&inside){g.y=w.height+.09;g.vy=Math.abs(g.vy)*.3;g.vx*=.7;g.vz*=.7;}
    else if(w.baseY!==undefined&&before.y<=(w.baseY??0)-.089&&g.y>=(w.baseY??0)-.09&&inside){g.y=(w.baseY??0)-.09;g.vy=-Math.abs(g.vy)*.3;g.vx*=.7;g.vz*=.7;}
    else if(before.y<w.height+.09) {
      if(before.x<=w.minX-.089||before.x>=w.maxX+.089)g.vx*=-.45;else g.vz*=-.45;
      g.x=before.x;g.z=before.z;
    }
  }
  const floor=liveFloorAt(g,g.y)+.09;
  if(g.y<floor){g.y=floor;g.vy=Math.abs(g.vy)*.3;g.vx*=.68;g.vz*=.68;if(g.vy<.8)g.vy=0;}
  g.level=liveCanalArea(g)&&g.y<liveGroundHeight({...g,level:undefined})-.05?'canal':undefined;
}

function fullScanSightline(from,to) {
  return !LIVE_COLLISION_SOLIDS.some(w=>{
    let enter=0,exit=1;
    for(const [origin,delta,min,max] of [[from.x,to.x-from.x,w.minX,w.maxX],[from.z,to.z-from.z,w.minZ,w.maxZ],[from.y,to.y-from.y,w.baseY??0,w.height]]) {
      if(Math.abs(delta)<1e-9){if(origin<min||origin>max)return false;}
      else {const a=(min-origin)/delta,b=(max-origin)/delta;enter=Math.max(enter,Math.min(a,b));exit=Math.min(exit,Math.max(a,b));if(enter>exit)return false;}
    }
    return enter<=exit;
  });
}

const seededRandom=(seed)=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};

function compareFlight(initial,ticks=150,dt=1/30) {
  const actual={...initial},reference={...initial};
  for(let tick=0;tick<ticks;tick++){
    stepLiveGrenade(actual,dt);fullScanStep(reference,dt);
    assert.deepEqual(actual,reference,`Grenade ${initial.id}/${initial.throwStyle??'custom'} differs at tick ${tick}`);
  }
  return actual;
}

test('indexed grenade candidates preserve full-scan physics across seeded authored lanes and every throw style',()=>{
  const random=seededRandom(1337),styles=Object.keys(LIVE_THROW_PHYSICS);
  const points=[...LIVE_TACTICAL.A.staging,...LIVE_TACTICAL.A.entries,...LIVE_TACTICAL.B.staging,...LIVE_TACTICAL.B.entries,
    ...LIVE_TACTICAL.B.holds,LIVE_MID.window.hold,LIVE_MID.window.rearApproach,LIVE_MID.control,LIVE_MID.approach,
    {x:0,z:-36},{x:-3.5,z:40},{x:29,z:-26},{x:20,z:4,level:'canal'}];
  for(let i=0;i<56;i++){
    const from=points[Math.floor(random()*points.length)],to=points[Math.floor(random()*points.length)];
    const style=styles[i%styles.length],kind=['smoke','flash','he','incendiary'][i%4];
    const momentum={x:(random()-.5)*8,z:(random()-.5)*8};
    const height=liveGroundHeight(from)+(i%3===0?1.08:1.55);
    compareFlight(launchLiveGrenade(i,kind,'index-reference','blue',from,to,0,false,style,height,momentum));
  }
});

test('indexed grenade candidates preserve ordered wall, roof, floor and canal bounces',()=>{
  const fixtures=[
    {x:-19,y:1.55,z:-7,vx:22,vy:0,vz:0},
    {x:32,y:4.1,z:18,vx:0,vy:10,vz:0},
    {x:32,y:6,z:18,vx:0,vy:-4,vz:0},
    {x:0,y:4.8,z:20,vx:0,vy:14,vz:0},
    {x:0,y:2.1,z:18.6,vx:0,vy:-2,vz:-8},
    {x:0,y:-.2,z:4,vx:0,vy:-5,vz:0},
    {x:-19.5,y:.5,z:3.5,vx:1,vy:-5,vz:0},
    {x:0,y:2,z:-36,vx:12,vy:8,vz:14},
    {x:31,y:2.5,z:16,vx:4,vy:3,vz:8},
    {x:23,y:2,z:22,vx:-6,vy:-2,vz:10},
  ];
  for(const [i,fixture] of fixtures.entries()){
    const initial={id:100+i,kind:'smoke',actorId:'fixture',team:'blue',releaseAt:0,detonateAt:5,coordinated:false,...fixture};
    const final=compareFlight(initial,180);
    if(i===0)assert.ok(final.vx<0,'The wall fixture must actually reverse its horizontal velocity');
    if(i===1){const bounced=compareFlight(initial,1);assert.ok(bounced.vy<0&&bounced.y<=4.26,'The rising fixture must bounce off the apartment roof underside');}
    if(i===2)assert.ok(final.y>=4.61-1e-9,'The falling fixture must settle on the roof');
    if(i===5)assert.equal(final.level,'canal','The below-bridge fixture must reach the lower canal floor');
  }
});

test('indexed grenade sightlines preserve full 3D slab results for seeded rays and structural boundary heights',()=>{
  const random=seededRandom(4242),rays=[];
  for(let i=0;i<240;i++)rays.push([{x:random()*72-36,y:random()*10-1.5,z:random()*90-45},{x:random()*72-36,y:random()*10-1.5,z:random()*90-45}]);
  for(const w of LIVE_COLLISION_SOLIDS.filter((_,i)=>i%11===0)){
    const x=(w.minX+w.maxX)/2,z=(w.minZ+w.maxZ)/2;
    for(const y of [(w.baseY??0)-.000001,w.baseY??0,w.height,w.height+.000001]){
      rays.push([{x:w.minX-1,y,z},{x:w.maxX+1,y,z}]);
      rays.push([{x,y,z:w.minZ-1},{x,y,z:w.maxZ+1}]);
    }
  }
  let blocked=0,clear=0;
  for(const [i,[from,to]] of rays.entries()){
    const expected=fullScanSightline(from,to);
    assert.equal(liveGrenadeSightline(from,to),expected,`3D grenade ray ${i} differs`);
    if(expected)clear++;else blocked++;
  }
  assert.ok(blocked>100&&clear>20,`Both outcomes must be exercised: ${blocked} blocked / ${clear} clear`);
});
