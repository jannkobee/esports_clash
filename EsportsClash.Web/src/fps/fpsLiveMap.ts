import { hasFpsLineOfSight, segmentHitsWall, type FpsPoint, type FpsWall } from './fpsSpatialWorld.ts';
import { LIVE_B_APARTMENTS, LIVE_MID_WINDOW, LIVE_BRIDGE, LIVE_RIVER, LIVE_CANAL_CROSSINGS, LIVE_TERRAIN_SOLIDS, LIVE_BRIDGE_VAULTS, liveGroundHeight, liveTerrainPathClear, liveTerrainConnector } from './fpsLiveTerrain.ts';
import {VILLAGE_MARKET_STALLS} from './fpsVillageMarketLayout.ts';
import { liveVillageAsset } from './fpsVillageDesign.ts';
import {LIVE_AUTHORED_SMOKE_LINEUPS} from './fpsSmokeLineupDefinitions.ts';
import {LIVE_WINDOW_FURNITURE} from './fpsMidWindowInterior.ts';
import {createLiveGeometryIndex} from './fpsStaticGeometry.ts';

export interface LiveSolid extends FpsWall { id: string; height: number; color: string; baseY?:number; bulletPenetration?:number }
const solid = (id: string, x: number, z: number, width: number, depth: number, height: number, color: string,bulletPenetration=0): LiveSolid =>
({ id, minX: x-width/2, maxX: x+width/2, minZ: z-depth/2, maxZ: z+depth/2, height, color:liveVillageAsset(id).color,bulletPenetration });

/** Fontessa's market and civic courts share admitted geometry with movement, sight and ballistics.
 * Tactical IDs remain stable for existing route/intel consumers; display callouts stay hidden. */
export const LIVE_FPS_MAP = {
id: 'fontessa-village-v12', name: 'Fontessa', width: 72, depth: 92,
spawns:{attackers:{x:0,z:-30.5},defenders:{x:0,z:41}},
sites: { A: { x: -23, z: 21 }, B: { x: 23, z: 21 } } satisfies Record<string, FpsPoint>,
solids: [
// Low garden boundaries open onto the surrounding village streets. Play bounds stay explicit.
...[-1,1].flatMap(side=>[[-47,LIVE_RIVER.minZ],[LIVE_RIVER.maxZ,47]].map(([a,b],i)=>({...solid(`${side<0?'west':'east'}-wall-${i}`,side*36.5,(a+b)/2,1,b-a,1.25,'#b9ad92'),minZ:a,maxZ:b}))),
...([-1,1].flatMap(side=>[
  solid(`south-wall-${side}`,side*21.25,-46.5,31.5,1,1.3,'#b9ad92'),
  solid(`port-quay-${side}`,side*20.5,44.2,27,.4,.85,'#c6b99d'),
])),

// Hollow restaurant arrival: clear center, north doors and two open service exits.
solid('restaurant-south-wall',0,-40,18,.3,4.4,'#bba283'),
...[-1,1].flatMap(side=>[
 solid(`restaurant-front-${side}`,side*6,-29.5,6,.3,4.4,'#bba283'),
 solid(`restaurant-side-rear-${side}`,side*9,-38,.3,4,4.4,'#bba283'),
 solid(`restaurant-side-front-${side}`,side*9,-30.7,.3,2.4,4.4,'#bba283'),
 solid(`restaurant-table-${side}`,side*6,-37,1.7,1.2,.82,'#806347',.4),
]),
// Short pedestrian crossings: parapets constrain the crossing, not the bank approaches.
...LIVE_CANAL_CROSSINGS.filter((_,i)=>i!==2&&i!==4).flatMap((bridge,i)=>[-1,1].map(side=>({
 ...solid(`canal-crossing-${i}-${side}`,side<0?bridge.minX-.12:bridge.maxX+.12,.3,.24,5,.85,'#aa826a'),baseY:-.18,
}))),
// CT's customs quay has a wide, dry five-player assembly area and two clear site exits.
solid('port-customs-west',-18,41,5,5,5.6,'#c2ab83'),
solid('port-customs-east',18,41,5,5,6.4,'#c2ab83'),
solid('port-landing-head',0,44.1,14,.35,.85,'#c6b99d'),
{...solid('restaurant-door-lintel',0,-29.5,6,.3,4.4,'#bba283'),baseY:2.7},
solid('restaurant-service-counter',0,-39.2,7,.65,.95,'#806347',.4),
{...solid('restaurant-roof',0,-34.75,18.4,10.9,4.65,'#a97451'),baseY:4.4},
// Street dining furniture belongs to the restaurant, away from the centre exit.
...[-1,1].map(side=>solid(`restaurant-outside-table-${side}`,side*6.5,-26.8,1.4,1.2,.78,'#806347',.4)),
solid('restaurant-menu-stand',-10.5,-30.8,.65,.45,1.2,'#806347',.4),
{...solid('restaurant-teal-awning',0,-28.9,18.8,1.8,3.25,'#48776c'),baseY:3.05},
...[-1,1].flatMap(side=>[
 {...solid(`bridge-parapet-${side}-river`,side*1.65,(LIVE_RIVER.minZ+LIVE_RIVER.maxZ)/2,.22,LIVE_RIVER.maxZ-LIVE_RIVER.minZ+.1,LIVE_BRIDGE.parapetY,'#aa826a'),baseY:LIVE_BRIDGE.deckY},
 {...solid(`bridge-parapet-${side}-bank`,side*1.65,4.25,.22,2.7,LIVE_BRIDGE.parapetY,'#aa826a'),baseY:LIVE_BRIDGE.deckY},
]),
// Masonry retaining walls end at the stair mouths, never across the lower route.
{...solid('canal-bank-retaining-west',-10.1,5.72,16.8,.24,0,'#979982'),baseY:-1.4},
{...solid('canal-bank-retaining-east',10.25,5.72,17.1,.24,0,'#979982'),baseY:-1.4},
{...solid('canal-bank-retaining-market-end',24.8,5.72,7.2,.24,0,'#979982'),baseY:-1.4},
{...solid('canal-river-curb',4.95,2.9,50.9,.2,-.75,'#979982'),baseY:-1.9},
{...solid('canal-bank-end-west',-20.65,4.25,.2,2.7,0,'#979982'),baseY:-1.4},
...[-18,-12,-6,3,9,15,22,27].map(x=>({...solid(`canal-bollard-${x}`,x,3.04,.16,.16,-.35,'#787b69'),baseY:-1.4})),

// T Spawn approach screen & harbor buildings
solid('loading-office', -22, -27, 8, 6, 4, '#b6aa91'),
solid('pump-house', 22, -27, 8, 6, 4, '#b6aa91'),
solid('mid-approach-screen', 0, -25, 4, 3, 3, '#859596'),

// Central Mid & Underpass (The Sluice)
// Mid lane runs along x: 0; Second Mid runs along x: -8
solid('mid-west-lower', -4.75, -15, 5.5, 6, 5.5, '#b6ac92'),
solid('mid-west-upper', -4.75, -5, 5.5, 6, 5.5, '#b6ac92'),
// Gap between z: -12 and z: -8 is the Underpass sluice connecting Second Mid to Mid!

// Apartments / Warehouse Gallery block (x: -16 to -7)
// Flanking upper route into A Balcony and Short
solid('apartments-south', -12.5, -12, 5, 12, 8, '#b6ac92'),
solid('apartments-north', -11.5, 14, 9, 16, 7, '#b0a38a'),

// East Mid Warehouse: separates Mid from Banana Slipway
solid('customs-warehouse-east', 8.5, -10, 11, 16, 8, '#98aaa8'),
solid('freight-office-east', 10.3, 14, 11.4, 16, 7, '#90a6ac'),

// Banana Slipway: curved approach to B with Logs, Car, and Sandbag bastion
solid('b-logs', 14, -11, 3, 4, 1.8, '#a36f50',.42),
solid('b-car', 18, -14.5, 4, 3, 2.4, '#537778'),
// The old sandbag block was wholly inside the market shop row and is removed.

// Containers & outer gate walls
solid('west-container', -25, 11, 6, 8, 3, '#537778',.28),
solid('east-container', 24.5, 11.1, 7, 7.4, 8.4, '#a36f50'),
solid('west-outer-gate', -35, 5.5, 2, 4.2, 3.5, '#9e9682'),
solid('east-outer-gate', 35, -11, 2, 8, 3.5, '#8da1a8'),
solid('west-lane-dogleg', -32, -15, 8, 3, 3, '#9e9682'),
solid('east-lane-dogleg', 29.6, -14, 1.6, 2.8, 1.8, '#8da1a8'),
solid('west-staging-cover', -17, -20, 3, 3, 2.4, '#697c79'),
solid('east-staging-cover', 18, -20, 3, 3, 2.4, '#947c5f'),

// A Site Courtyard & Pit
solid('a-generator', -28.65, 13.0, 1.3, 3.6, 2.5, '#627577'),
solid('a-pit-revetment', -30.5, 16, 1.9, 1.1, .68, '#8b927f'),
solid('a-crates', -28, 20, 5, 5, 6.4, '#9a805a'),
solid('a-screen', -16.2, 33.5, 4, 8, 5.2, '#536b71'),
solid('a-retake-cover', -11, 34, 4, 3, 2.5, '#8b927f'),
// The terracotta loggia used to be render-only: actors and bullets passed through it.
// Render these exact volumes in the viewer, with no separate scenery wall.
solid('a-loggia-wall', -23, 31, 9.6, 9.2, 8.2, '#b86455'),
solid('a-loggia-west-column', -27.5, 26, .45, .45, 3.8, '#cfc3a7'),
solid('a-loggia-center-column', -24.6, 26, .45, .45, 3.8, '#cfc3a7'),
solid('a-loggia-east-column', -21.4, 26, .45, .45, 3.8, '#cfc3a7'),

solid('a-loggia-outer-column', -18.5, 26, .45, .45, 3.8, '#cfc3a7'),

// Market counters and their supported canopies share collision with the rendered stalls.
...VILLAGE_MARKET_STALLS.flatMap(stall=>[
  solid(`market-stall-${stall.id}`,stall.x,stall.z,stall.w,stall.d,1.02,stall.color,.38),
  {...solid(`market-canopy-${stall.id}`,stall.x,stall.z,stall.w+.5,stall.d+1,2.74,stall.canvas),baseY:2.65},
  ...[-1,1].flatMap(side=>[-1,1].map(face=>solid(`market-post-${stall.id}-${side}-${face}`,stall.x+side*(stall.w/2+.14),stall.z+face*(stall.d/2+.36),.08,.08,2.65,'#8c7651'))),
]),
// B Site Basin & Central Fountain
// Tall, close-set houses and one covered passage give B a compressed silhouette.
// Both entries, fountain ring, rear retake lane and apartment stairs remain open.
solid('b-canal-house',25,-6.4,6,8.4,9.4,'#c18777'),
solid('b-market-west-house',14.2,19.1,4.4,6.2,8.8,'#c18777'),
{...solid('b-sottoportego',18.5,9.5,5,3.4,3.3,'#c6b99d'),baseY:3.05},
solid('b-fountain', 23, 21, 4.6, 4.6, 1.5, '#6e807e'),
solid('b-coffins', 14.6, 25, 2.8, 2.6, 2.8, '#a77a55',.38),
solid('b-screen', 17, 28, 5, 3, 7.8, '#b5a36d'),
solid('b-dark-wall', 30, 24, 4, 3, 7.6, '#a99267'),
solid('b-retake-cover', 27, 34, 4, 3, 6.4, '#8b927f'),

// Hollow CT customs lookout: raised room, real window, CT rear stair door, and ground-level T open door.
solid('mid-window-front-sill',.6,17,4.8,.24,LIVE_MID_WINDOW.sillY,'#ba8068'),
solid('mid-window-front-pier-west',-4.5,17,.24,.24,5.4,'#ba8068'),
solid('mid-window-front-pier-center',-1.65,17,.3,.24,5.4,'#ba8068'),
solid('mid-window-front-pier-east',3.75,17,1.5,.24,5.4,'#ba8068'),
{...solid('mid-window-front-lintel',.6,17,4.8,.24,5.4,'#ba8068'),baseY:LIVE_MID_WINDOW.lintelY},
{...solid('mid-window-t-door-lintel',-3.1,17,2.6,.24,5.4,'#ba8068'),baseY:2.6},
solid('mid-window-t-stair-wall',-1.68,19.7,.24,5.4,2.65,'#ba8068'),
solid('mid-window-side-1',4.5,21.75,.24,9.74,5.4,'#ba8068'),
solid('mid-window-side-west-front',-4.5,19.54,.24,5.32,5.4,'#ba8068'),
{...solid('mid-window-side-door-lintel',-4.5,24.35,.24,4.3,5.4,'#ba8068'),baseY:4.3},
solid('mid-window-passage-south',-5.85,22.2,2.7,.24,5.4,'#ba8068'),
solid('mid-window-passage-north-return',-5.85,26.5,2.7,.24,5.4,'#ba8068'),
...[-1,1].map(side=>solid(`mid-window-passage-west-jamb-${side}`,-7.2,24.3+side*1.99,.24,.32,5.4,'#ba8068')),
{...solid('mid-window-passage-exit-lintel',-7.2,24.3,.24,3.6,5.4,'#ba8068'),baseY:4.3},
{...solid('mid-window-passage-roof',-5.85,24.35,2.94,4.54,5.62,'#ba8068'),baseY:5.4},
// Both stair flights are enclosed inside the house. Street entries are level doors.
solid('mid-window-civic-south-wall',-11.35,22.2,8.3,.24,5.4,'#ba8068'),
solid('mid-window-civic-north-wall',-11.35,26.5,8.3,.24,5.4,'#ba8068'),
...[-1,1].map(side=>solid(`mid-window-civic-door-jamb-${side}`,-15.5,24.35+side*1.99,.24,.32,5.4,'#ba8068')),
{...solid('mid-window-civic-door-header',-15.5,24.3,.24,3.6,5.4,'#ba8068'),baseY:2.6},
{...solid('mid-window-civic-roof',-11.35,24.35,8.54,4.54,5.62,'#a66b4d'),baseY:5.4},
solid('mid-window-rear-wall',-1.65,26.5,5.7,.24,5.4,'#ba8068'),
{...solid('mid-window-ct-door-header',2.85,26.5,3.3,.24,5.4,'#ba8068'),baseY:2.8},
solid('mid-window-interior-gallery-rail',1.12,23.7,.16,5.6,2.65,'#ba8068'),
...LIVE_WINDOW_FURNITURE.map(item=>({...solid(item.id,item.x,item.z,item.width,item.depth,item.baseY+item.height,item.color,.35),baseY:item.baseY})),
{...solid('mid-window-roof',0,21.75,9.4,10,5.62,'#a66b4d'),baseY:5.4},
// North Divider (Speedway & Customs Yard) keeps a protected port-to-site split.
solid('north-divider', 0, 33, 8, 6, 4, '#a9a291'),
...([-1,1].flatMap(side=>[-37,40].flatMap(z=>[
  solid(`spawn-bench-${side}-${z}`,side*13,z,3.4,1.05,.7,'#987d55'),
  {...solid(`spawn-bench-${side}-${z}-back`,side*13,z+(z<0?-.42:.42),3.4,.12,1.35,'#987d55'),baseY:.7},
]))),
// The residential wing fronts the raised promenade from the inn approach to the market.
solid('market-residential-wing',38.5,-8,10,44,6.6,'#c4ab8e'),
...([{id:'0',minZ:-27.5,maxZ:-18.5},{id:'1',minZ:-10.5,maxZ:-3.5},
 {id:'2',minZ:2.5,maxZ:7.5}].map(p=>({
 ...solid(`market-gallery-parapet-${p.id}`,30.4,(p.minZ+p.maxZ)/2,.2,p.maxZ-p.minZ,2.5,'#cfc1a2'),baseY:1.8}))),
// Rooted trees and street furniture have small, explicitly admitted collision footprints.
solid('village-tree-civic',-22,-4,.72,.72,3.6,'#6b5840'),
solid('village-tree-arrival',10,-37,.8,.8,4.2,'#6b5840'),
solid('village-tree-market',29,30,.7,.7,3.5,'#6b5840'),
solid('village-tree-guard',-9,39,.72,.72,3.6,'#6b5840'),
solid('village-bin-inn',-16.9,-28,.65,.65,1.05,'#536d65'),
solid('village-bin-bakery',-7.9,-16,.6,.6,1.05,'#536d65'),
solid('village-bin-market',27.2,16,.6,.6,1.05,'#536d65'),
solid('village-bin-civic',-28.8,28,.6,.6,1.05,'#536d65'),
// Fountain-side apartment gallery: the filled deck and stairs are terrain, not 2D obstacles.
solid('b-apartments-back', 38.5, 18, 10, 8.4, 7, '#acb8b5'),
{...solid('b-apartments-parapet', 30.4, 18.3, .24, 7, 2.52, '#cfbea0'),baseY:1.8},
{...solid('b-apartments-north-rail', 31.9, 21.8, 3.24, .24, 2.52, '#cfbea0'),baseY:1.8},
{...solid('b-apartments-column-s', 30.4, 14.9, .28, .28, 4.35, '#d4c6a7'),baseY:1.8},
{...solid('b-apartments-column-n', 30.4, 21.6, .28, .28, 4.35, '#d4c6a7'),baseY:1.8},
]
};

const LIVE_MOVEMENT_SOLIDS=[...LIVE_FPS_MAP.solids,...LIVE_BRIDGE_VAULTS,...LIVE_TERRAIN_SOLIDS.filter(w=>w.id.includes('-cheek-'))];
export const LIVE_COLLISION_SOLIDS:readonly LiveSolid[]=[...LIVE_FPS_MAP.solids,...LIVE_TERRAIN_SOLIDS];
const movementSolidsAt=createLiveGeometryIndex(LIVE_MOVEMENT_SOLIDS),collisionSolidsAt=createLiveGeometryIndex(LIVE_COLLISION_SOLIDS);

/** All tactical positions are in traversable space, shared by the HUD and the AI. */
export const LIVE_TACTICAL = {
A: {
staging:[{x:-20,z:-12},{x:-30,z:-12}],
rally:[{x:-19,z:-7},{x:-31,z:-7}],
entries:[{x:-18,z:9},{x:-30,z:7}],
flash:{x:-21,z:14},smoke:{x:-21,z:31},
holds:[{x:-23,z:24},{x:-31,z:25},{x:-14,z:23}],
postPlant:[{x:-20,z:15},{x:-30,z:14},{x:-26,z:24},{x:-13,z:24},{x:-19,z:9}],
},
B: {
staging:[{x:20,z:-12},{x:31,z:-10}],
rally:[{x:19,z:-7},{x:31,z:-7}],
entries:[{x:20,z:10},{x:31,z:9}],
flash:{x:21,z:15},smoke:{x:24,z:31},
holds:[{x:23,z:29},{x:32,z:26},{x:18,z:24},LIVE_B_APARTMENTS.hold],
postPlant:[{x:20,z:14},LIVE_B_APARTMENTS.hold,{x:23,z:28},{x:19,z:26},{x:19,z:8}],
}
};
/** Repeatable attack-side smoke setups. Throws release from the named staging point. */
export const LIVE_OPENING_LINEUPS=LIVE_AUTHORED_SMOKE_LINEUPS.filter(l=>l.phase==='opening');
export const LIVE_SMOKE_LINEUPS=LIVE_AUTHORED_SMOKE_LINEUPS.filter(l=>l.phase==='execute');
export const LIVE_MID={
approach:{x:0,z:-21},
control:{x:0,z:1},
underpass:{west:{x:-8.7,z:-10},east:{x:0,z:-10}},
window:LIVE_MID_WINDOW,
splits:{A:{x:-19,z:5},B:{x:19,z:5}}
};
// The gap west of the produce stall is physically open but falls between the
// two-metre navigation columns. Keep its real clearance and add fine connectors.
export const LIVE_MARKET_PASSAGE={south:{x:16.9,z:18},center:{x:16.9,z:20},north:{x:18,z:24}};
export const LIVE_CHOKES=[
{name:'A main',center:{x:-19,z:7},width:6,axis:'x'},
{name:'A outer',center:{x:-31,z:7},width:6,axis:'x'},
{name:'B main',center:{x:18.5,z:8},width:4.9,axis:'x'},
{name:'B outer',center:{x:31,z:9},width:6,axis:'x'},
{name:'Mid gate',center:{x:0,z:-12},width:6,axis:'x'},
] as const;
export const LIVE_CALLOUTS = [
{name:'Jade Lantern restaurant',x:0,z:-38},
{name:'Bakery lane',x:18,z:-16},
{name:'Firewood store',x:14,z:-11},
{name:'Street kiosk',x:18,z:-2},
{name:'Market approach',x:24,z:4},
{name:'Market entrance',x:20,z:8},
{name:'Public fountain',x:23,z:21},
{name:'B apartments gallery',...LIVE_B_APARTMENTS.hold},
{name:'B apartments stairs',x:32,z:10.5},
{name:'Flower seller',x:15,z:26},
{name:'Grocer corner',x:31,z:28},
{name:'Market guard street',x:23,z:36},
{name:'Market rear lane',x:12,z:35},
{name:'Customs port / CT quay',x:0,z:41},
{name:'Civic passage',x:-4,z:22},
{name:'Customs Mid window',...LIVE_MID_WINDOW.hold},
{name:'Town-hall approach',x:-12,z:8},
{name:'West homes',x:-12,z:-4},
{name:'A balcony',x:-16,z:14},
{name:'Carpenter lane',x:-20,z:-10},
{name:'Courtyard bench',x:-30,z:14},
{name:'Town-hall courtyard',x:-23,z:21},
{name:'Town-hall rear',x:-24,z:30},
{name:'Mid lane',x:0,z:-8},
{name:'Second mid canal',x:-8,z:-16},
{name:'Residential passage',x:-5,z:-10},
{name:'Canal stone bridge',x:0,z:2},
];
export function liveCallout(p:FpsPoint):string {
let nearest=LIVE_CALLOUTS[0],best=distance(p,nearest);
for(let i=1;i<LIVE_CALLOUTS.length;i++){const candidate=LIVE_CALLOUTS[i],d=distance(p,candidate);if(d<best){best=d;nearest=candidate;}}
return nearest.name;
}

export const LIVE_ACTOR_RADIUS = .35;
export const distance = (a: FpsPoint, b: FpsPoint) => Math.hypot(a.x-b.x, a.z-b.z);
/** Overhead roofs/canopies do not occupy an actor's floor. Raised railings still
 * block actors standing on the deck, and supports below their feet do not. */
export const LIVE_MAX_CROUCH_JUMP_STEP = .88;
export function liveActorSolids(point:FpsPoint,feetY=liveGroundHeight(point),height=1.72,crouchJump=false):LiveSolid[]{
  const climbFloor=crouchJump?Math.max(feetY,liveGroundHeight(point)+Math.min(LIVE_MAX_CROUCH_JUMP_STEP,feetY-liveGroundHeight(point)+.26)):feetY;
  return LIVE_MOVEMENT_SOLIDS.filter(w=>{
    if(w.height<=feetY+.01||(w.baseY??0)>=feetY+height)return false;
    if(crouchJump&&w.height<=climbFloor+.01&&w.height-liveGroundHeight(point)<=LIVE_MAX_CROUCH_JUMP_STEP&&!w.id.includes('bridge'))return false;
    return true;
  });
}
/** Land on a real low wall/cover top before a descending capsule can enter its side. */
export function liveSupportHeight(point:FpsPoint,feetY:number,crouchJump=false):number {
 let floor=liveGroundHeight(point);
 const reach=crouchJump?feetY+.24:feetY;
 for(const wall of LIVE_MOVEMENT_SOLIDS){
  if(wall.height<=floor)continue;
  if(crouchJump&&wall.height>floor+LIVE_MAX_CROUCH_JUMP_STEP)continue;
  if(wall.height<=reach+.015&&segmentHitsWall(point,point,wall,LIVE_ACTOR_RADIUS-.001))floor=wall.height;
 }
 return floor;
}
const bodyPathClear=(a:FpsPoint,b:FpsPoint,radius:number)=>{
  const floorA=liveGroundHeight(a),floorB=liveGroundHeight(b),low=Math.min(floorA,floorB),high=Math.max(floorA,floorB)+1.72;
  return !movementSolidsAt(a,b,radius).some(w=>{
    if(w.height<=low+.01||(w.baseY??0)>=high||!segmentHitsWall(a,b,w,radius))return false;
    if((w.baseY??0)===0&&w.height>Math.max(floorA,floorB)+.01)return true;
    // Evaluate height where the actor actually overlaps this wall, rather than
    // projecting a later stair's elevation backwards through a low overhang.
    let enter=0,exit=1;
    for(let axis=0;axis<2;axis++){
      const origin=axis===0?a.x:a.z,delta=axis===0?b.x-a.x:b.z-a.z;
      if(Math.abs(delta)<1e-10)continue;
      const u=((axis===0?w.minX:w.minZ)-radius-origin)/delta,v=((axis===0?w.maxX:w.maxZ)+radius-origin)/delta;
      enter=Math.max(enter,Math.min(u,v));exit=Math.min(exit,Math.max(u,v));
    }
    for(const t of [enter,(enter+exit)/2,exit]){
      const feet=liveGroundHeight({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t,level:a.level});
      if(w.height>feet+.01&&(w.baseY??0)<feet+1.72)return true;
    }
    return false;
  });
};
const clear = (a: FpsPoint, b: FpsPoint) => liveTerrainPathClear(a,b)&&bodyPathClear(a,b,LIVE_ACTOR_RADIUS+.08);
/** Physical capsule clearance for following a route after acceleration or body avoidance. */
export const liveMovementSegmentClear=(a:FpsPoint,b:FpsPoint)=>liveTerrainPathClear(a,b)&&bodyPathClear(a,b,LIVE_ACTOR_RADIUS-.00001);
export const liveWalkable=(point:FpsPoint)=>Math.abs(point.x)<=34 && Math.abs(point.z)<=43 && clear(point,point);
const nodes: FpsPoint[] = [];
const grid = new Map<string, number>();
const gridKey=(p:FpsPoint)=>`${p.x},${p.z},${p.level??'street'}`;
for(const level of ['street','canal'] as const)for (let z = -42; z <= 42; z += level==='canal'?1:2) for (let x = -34; x <= 34; x += level==='canal'?1:2) {
  const point:FpsPoint = level==='canal'?{x,z,level}:{x,z};
  if (clear(point, point)) { grid.set(gridKey(point), nodes.length); nodes.push(point); }
}
// Fine connectors at the narrow bakery service lane and southern stair landing.
// Keep the main grid coarse; these prevent valid one-metre clearances becoming islands.
for(const point of [...Array.from({length:8},(_,i)=>({x:-9,z:-20+i*2})),...Array.from({length:6},(_,i)=>({x:-8+i*2,z:-11}))]){
 if(clear(point,point)&&!grid.has(gridKey(point))){grid.set(gridKey(point),nodes.length);nodes.push(point);}
}
// One-metre stair and rear-landing samples join the normal two-metre street grid.
for(const point of [
  ...Array.from({length:9},(_,i)=>({x:0,z:17+i})),
  ...Array.from({length:12},(_,i)=>({x:2,z:18+i})),
  ...Array.from({length:12},(_,i)=>({x:3,z:18+i})),
  ...Array.from({length:9},(_,i)=>({x:-4+i,z:29})),
]){
 if(clear(point,point)&&!grid.has(gridKey(point))){grid.set(gridKey(point),nodes.length);nodes.push(point);}
}
for(const point of [...Array.from({length:4},(_,i)=>({x:-6+i*2,z:23})),
  ...Array.from({length:11},(_,i)=>({x:-16+i,z:24}))]){
 if(clear(point,point)&&!grid.has(gridKey(point))){grid.set(gridKey(point),nodes.length);nodes.push(point);}
}
for(const point of [...Array.from({length:11},(_,i)=>({x:-3,z:15+i})),{x:-4,z:24}]){
 if(clear(point,point)&&!grid.has(gridKey(point))){grid.set(gridKey(point),nodes.length);nodes.push(point);}
}
for(const point of Array.from({length:5},(_,i)=>({x:-17,z:24+i}))){
 if(clear(point,point)&&!grid.has(gridKey(point))){grid.set(gridKey(point),nodes.length);nodes.push(point);}
}
const marketPassageNodes=Array.from({length:8},(_,i)=>({x:16.9,z:16+i}));
const marketPassageLinks=[[marketPassageNodes[0],{x:18,z:16}],[marketPassageNodes[7],{x:18,z:24}],[marketPassageNodes[7],{x:16,z:23}],[marketPassageNodes[7],{x:18,z:23}],[{x:28,z:6},{x:29,z:8}]];
for(const point of marketPassageNodes){
 if(clear(point,point)&&!grid.has(gridKey(point))){grid.set(gridKey(point),nodes.length);nodes.push(point);}
}
// Fine 1m street connectors for narrow side alleys (Image 1 B alley, Image 3/4 A courtyard, East promenade & market canal edge).
for(const point of [
 ...Array.from({length:9},(_,i)=>({x:10+i,z:23})),
 ...Array.from({length:6},(_,i)=>({x:11,z:23+i})),
 ...Array.from({length:7},(_,xIdx)=>Array.from({length:17},(_,zIdx)=>({x:-34+xIdx,z:7+zIdx}))).flat(),
 ...Array.from({length:9},(_,i)=>({x:21+i,z:6})),
 ...Array.from({length:3},(_,xIdx)=>Array.from({length:24},(_,zIdx)=>({x:28+xIdx,z:-12+zIdx}))).flat(),
]){
 if(clear(point,point)&&!grid.has(gridKey(point))){grid.set(gridKey(point),nodes.length);nodes.push(point);}
}
const neighbors = nodes.map(p => {
 const step=p.level==='canal'?1:2;
 const offsets=p.level==='canal'?[[step,0],[-step,0],[0,step],[0,-step]]:[[2,0],[-2,0],[0,2],[0,-2],[1,0],[-1,0],[0,1],[0,-1]];
 const adjacent=offsets.flatMap(([x,z])=>{
  const next=grid.get(gridKey({...p,x:p.x+x,z:p.z+z}));
  return next!==undefined&&clear(p,nodes[next])?[next]:[];
 });
 if(p.level!=='canal'){
  for(const [dx,dz] of [[2,2],[2,-2],[-2,2],[-2,-2],[1,1],[1,-1],[-1,1],[-1,-1]]){
   const next=grid.get(gridKey({...p,x:p.x+dx,z:p.z+dz}));
   if(next!==undefined&&clear(p,nodes[next])&&clear(p,{...p,x:p.x+dx})&&clear(p,{...p,z:p.z+dz}))adjacent.push(next);
  }
 }
 // Join the fractional-width lane at its two unobstructed mouths.
 for(const [mouth,street] of marketPassageLinks)for(const [a,b] of [[mouth,street],[street,mouth]]){
  if(gridKey(p)!==gridKey(a))continue;
  const next=grid.get(gridKey(b));if(next!==undefined&&clear(p,b))adjacent.push(next);
 }
 const opposite=grid.get(gridKey({...p,level:p.level==='canal'?'street':'canal'}));
 if(opposite!==undefined&&liveTerrainConnector(p,nodes[opposite])&&clear(p,nodes[opposite]))adjacent.push(opposite);
 return adjacent;
});
// These results depend only on immutable map geometry and exact coordinates.
// Actor intel and moving bodies are never inputs to an endpoint lookup.
const endpointCache=new Map<string,number>();
const staticPathCache=new Map<string,FpsPoint[]>();
const predecessors:number[][]=nodes.map(()=>[]);
neighbors.forEach((next,from)=>next.forEach(to=>predecessors[to].push(from)));
const goalDistanceCache=new Map<number,Int32Array>();
function goalDistances(goal:number):Int32Array {
  const cached=goalDistanceCache.get(goal);if(cached)return cached;
  const hops=new Int32Array(nodes.length).fill(-1),queue=new Int32Array(nodes.length);
  let head=0,tail=1;queue[0]=goal;hops[goal]=0;
  while(head<tail){const at=queue[head++];for(const previous of predecessors[at])if(hops[previous]<0){hops[previous]=hops[at]+1;queue[tail++]=previous;}}
  if(goalDistanceCache.size>=32)goalDistanceCache.delete(goalDistanceCache.keys().next().value!);
  goalDistanceCache.set(goal,hops);return hops;
}
function rememberBounded<T>(cache:Map<string,T>,key:string,value:T,limit:number):T {
  if(cache.size>=limit)cache.delete(cache.keys().next().value!);
  cache.set(key,value);return value;
}

export function findLivePath(from: FpsPoint, destination: FpsPoint, threats:readonly FpsPoint[]=[], caution=0): FpsPoint[] {
  const to=liveWalkable(destination)?destination:safeLivePoint(destination);
  // Physical motion can leave an actor within the extra navigation margin.
  // Its departure may use physical clearance; the rest of the graph keeps the margin.
  const fromHasMargin=liveWalkable(from);
  // No route can leave a solid through its interior. Reject this case before
  // searching every grid ring (for example an invalid caller-provided origin).
  if(!fromHasMargin&&!bodyPathClear(from,from,LIVE_ACTOR_RADIUS))return [];
  const departureClear=(target:FpsPoint)=>fromHasMargin?clear(from,target)
    :liveTerrainPathClear(from,target)&&bodyPathClear(from,target,LIVE_ACTOR_RADIUS);
  if (departureClear(to) && !threats.length) return [{ ...to }];
  const pathKey=threats.length?'':`${gridKey(from)}>${gridKey(to)}`;
  const cached=pathKey?staticPathCache.get(pathKey):undefined;
  if(cached)return cached.map(point=>({...point}));
  const nearest = (p: FpsPoint,departing=false) => {
    const key=`${departing&&!fromHasMargin?'physical':'margin'}:${gridKey(p)}`;
    const saved=endpointCache.get(key);if(saved!==undefined)return saved;
    let best=-1, cost=Infinity;
    const step=p.level==='canal'?1:2,cx=Math.round(p.x/step)*step,cz=Math.round(p.z/step)*step;
    const offset=Math.max(Math.abs(p.x-cx),Math.abs(p.z-cz));
    const limit=Math.ceil(Math.max(Math.abs(cx-34),Math.abs(cx+34),Math.abs(cz-42),Math.abs(cz+42))/step);
    const consider=(x:number,z:number)=>{
      const index=grid.get(gridKey({...p,x,z}));if(index===undefined)return;
      const node=nodes[index],d=distance(p,node);
      if((d<cost||d===cost&&index<best)&&(departing?departureClear(node):clear(p,node))){best=index;cost=d;}
    };
    if(p.level!=='canal'){
      for(const point of marketPassageNodes)consider(point.x,point.z);
      const rx=Math.round(p.x),rz=Math.round(p.z);
      for(let ox=-1;ox<=1;ox++)for(let oz=-1;oz<=1;oz++)consider(rx+ox,rz+oz);
    }
    for(let ring=0;ring<=limit;ring++){
      if(ring===0)consider(cx,cz);
      else {
        for(let x=cx-ring*step;x<=cx+ring*step;x+=step){consider(x,cz-ring*step);consider(x,cz+ring*step);}
        for(let z=cz-ring*step+step;z<cz+ring*step;z+=step){consider(cx-ring*step,z);consider(cx+ring*step,z);}
      }
      // Every node outside this square is farther away. Strict inequality keeps
      // the original grid-index tie break when an endpoint is exactly centred.
      if(cost<step*(ring+1)-offset)break;
    }
    return rememberBounded(endpointCache,key,best,1024);
  };
  const start=nearest(from,true), end=nearest(to);
  if(start<0 || end<0){if(pathKey)rememberBounded(staticPathCache,pathKey,[],256);return [];}
  // Static reverse reachability rejects disconnected destinations. Edge costs
  // use actual metres so fine passage/stair nodes do not incur an artificial
  // two-metre cost per one-metre step; Euclidean distance stays admissible.
  const remaining=goalDistances(end);
  if(remaining[start]<0){if(pathKey)rememberBounded(staticPathCache,pathKey,[],256);return [];}
  const parent=new Int32Array(nodes.length).fill(-1), cost=new Float64Array(nodes.length).fill(Infinity);
  const open:{node:number;score:number}[]=[];
  const compare=(a:{node:number;score:number},b:{node:number;score:number})=>a.score-b.score||remaining[a.node]-remaining[b.node]||a.node-b.node;
  const push=(item:{node:number;score:number})=>{let i=open.length;open.push(item);while(i>0){const p=(i-1)>>1;if(compare(open[p],item)<=0)break;open[i]=open[p];i=p;}open[i]=item;};
  const pop=()=>{const result=open[0],last=open.pop()!;if(open.length){let i=0;while(i*2+1<open.length){let c=i*2+1;if(c+1<open.length&&compare(open[c+1],open[c])<0)c++;if(compare(open[c],last)>=0)break;open[i]=open[c];i=c;}open[i]=last;}return result;};
  const closed=new Set<number>(), exposure=new Map<number,number>();
  cost[start]=0;parent[start]=start;push({node:start,score:distance(nodes[start],nodes[end])});
  while(open.length) {
    const {node}=pop();if(closed.has(node))continue;if(node===end)break;closed.add(node);
    for(const next of neighbors[node]) {
      if(closed.has(next)||remaining[next]<0)continue;
      if(!exposure.has(next))exposure.set(next,threats.reduce((sum,t)=>sum+(distance(t,nodes[next])<45&&liveSightline(t,nodes[next])?Math.max(0,caution)*3:0),0));
      const value=cost[node]+distance(nodes[node],nodes[next])+exposure.get(next)!;
      if(value<cost[next]){cost[next]=value;parent[next]=node;push({node:next,score:value+distance(nodes[next],nodes[end])});}
    }
  }
  if(parent[end]<0){if(pathKey)rememberBounded(staticPathCache,pathKey,[],256);return [];}
  const path:FpsPoint[]=[{...to}];
  for(let at=end;at!==start;at=parent[at]) path.push(nodes[at]);
  path.push(nodes[start]);path.reverse();
  const result:FpsPoint[]=[]; let anchor=from;
  for(let i=0;i<path.length;) {
    let far=i; while(far+1<path.length && (anchor===from?departureClear(path[far+1]):clear(anchor,path[far+1])) && (!threats.length || distance(anchor,path[far+1])<4)) far++;
    result.push({...path[far]});anchor=path[far];i=far+1;
  }
  if(pathKey)rememberBounded(staticPathCache,pathKey,result.map(point=>({...point})),256);
  return result;
}

export function safeLivePoint(point:FpsPoint):FpsPoint {
  const clamped = { x: Math.max(-34, Math.min(34, point.x)), z: Math.max(-43, Math.min(43, point.z)), level:point.level };
  if(liveWalkable(clamped))return {...clamped};
  const sameLevel=nodes.filter(p=>(p.level??'street')===(point.level??'street'));
  return {...sameLevel.reduce((best,node)=>distance(clamped,node)<distance(clamped,best)?node:best,sameLevel[0]??nodes[0])};
}

export function findLiveCover(from:FpsPoint,threat:FpsPoint,allies:readonly FpsPoint[],quality?:number,knownThreats:readonly FpsPoint[]=[]):FpsPoint|undefined {
  const candidates=LIVE_FPS_MAP.solids.filter(w=>!w.id.endsWith('wall')).flatMap(w=>[
    {x:w.minX-.9,z:w.minZ-.9},{x:w.maxX+.9,z:w.minZ-.9},
    {x:w.minX-.9,z:w.maxZ+.9},{x:w.maxX+.9,z:w.maxZ+.9},
  ]).map(p=>({...p,level:from.level})).filter(p=>liveWalkable(p)&&distance(from,p)<12&&!liveSightline(threat,p));
  let best:FpsPoint|undefined,bestScore=Infinity;
  for(const point of candidates){
    const allyPenalty=allies.filter(ally=>distance(point,ally)<2).length*5;
    const crossfire=quality===undefined?0:knownThreats.reduce((sum,t)=>sum+(liveSightline(t,point)?12:0),0)*quality;
    const score=distance(from,point)+allyPenalty+crossfire;
    if(score<bestScore){bestScore=score;best=point;}
  }
  return best;
}

export interface LiveWorldPoint extends FpsPoint {y:number}
export interface LiveWallIntersection {wall:LiveSolid;t:number}

type RadialShape={x:number;z:number;minY:number;maxY:number;radius:number;innerRadius?:number};
// The fountain is a round, open basin with a tiered centre. Its visible mesh is
// not a filled square wall: shots/sightlines pass over the low lip and through
// the water opening, while the stone ring and central tiers remain solid.
const FOUNTAIN_SHAPES:readonly RadialShape[]=[
  {x:23,z:21,minY:.03,maxY:.27,radius:2.125}, // stepped stone base
  {x:23,z:21,minY:.26,maxY:.86,radius:2.01,innerRadius:1.84}, // basin shell
  {x:23,z:21,minY:.76,maxY:.98,radius:2.05,innerRadius:1.70}, // scalloped rim
  {x:23,z:21,minY:.85,maxY:1.51,radius:.36}, // pedestal
  {x:23,z:21,minY:1.48,maxY:1.72,radius:.71}, // upper bowl
  {x:23,z:21,minY:1.75,maxY:2.17,radius:.20}, // finial
  {x:23,z:21,minY:2.04,maxY:2.36,radius:.16}, // stone spire
];

function radialShapeHit(from:LiveWorldPoint,to:LiveWorldPoint,shape:RadialShape):number|undefined {
  const dx=to.x-from.x,dy=to.y-from.y,dz=to.z-from.z;
  const cuts=[0,1];
  if(Math.abs(dy)>1e-10)for(const y of [shape.minY,shape.maxY]){const t=(y-from.y)/dy;if(t>0&&t<1)cuts.push(t);}
  const a=dx*dx+dz*dz,b=2*((from.x-shape.x)*dx+(from.z-shape.z)*dz);
  const addCircleRoots=(radius:number)=>{
    const c=(from.x-shape.x)**2+(from.z-shape.z)**2-radius*radius;
    if(a<1e-12)return;
    const discriminant=b*b-4*a*c;if(discriminant<0)return;
    const root=Math.sqrt(discriminant);for(const t of [(-b-root)/(2*a),(-b+root)/(2*a)])if(t>0&&t<1)cuts.push(t);
  };
  addCircleRoots(shape.radius);if(shape.innerRadius)addCircleRoots(shape.innerRadius);
  cuts.sort((left,right)=>left-right);
  for(let i=0;i<cuts.length-1;i++){
    const start=cuts[i],end=cuts[i+1],mid=(start+end)/2;
    const x=from.x+dx*mid-shape.x,z=from.z+dz*mid-shape.z,y=from.y+dy*mid,r2=x*x+z*z;
    if(y<shape.minY||y>shape.maxY||r2>shape.radius*shape.radius||(shape.innerRadius!==undefined&&r2<shape.innerRadius*shape.innerRadius))continue;
    return start;
  }
  return undefined;
}

function boxSegmentHit(from:LiveWorldPoint,to:LiveWorldPoint,wall:LiveSolid):number|undefined {
  let enter=0,exit=1;
  for(let axis=0;axis<3;axis++){
    const origin=axis===0?from.x:axis===1?from.z:from.y;
    const delta=axis===0?to.x-from.x:axis===1?to.z-from.z:to.y-from.y;
    const min=axis===0?wall.minX:axis===1?wall.minZ:wall.baseY??0;
    const max=axis===0?wall.maxX:axis===1?wall.maxZ:wall.height;
    if(Math.abs(delta)<1e-10){if(origin<min||origin>max)return undefined;continue;}
    const a=(min-origin)/delta,b=(max-origin)/delta;
    enter=Math.max(enter,Math.min(a,b));exit=Math.min(exit,Math.max(a,b));
    if(enter>exit)return undefined;
  }
  return enter<=exit?enter:undefined;
}

export function liveWallSegmentHit(from:LiveWorldPoint,to:LiveWorldPoint,wall:LiveSolid):number|undefined {
  if(wall.id==='b-fountain'){
    let nearest:number|undefined;
    for(const shape of FOUNTAIN_SHAPES){const hit=radialShapeHit(from,to,shape);if(hit!==undefined&&(nearest===undefined||hit<nearest))nearest=hit;}
    return nearest;
  }
  return boxSegmentHit(from,to,wall);
}

export function liveWallIntersections(from:LiveWorldPoint,to:LiveWorldPoint):LiveWallIntersection[] {
  return collisionSolidsAt(from,to).flatMap(wall=>{
    const t=liveWallSegmentHit(from,to,wall);return t===undefined?[]:[{wall,t}];
  }).sort((a,b)=>a.t-b.t);
}

export function liveSightline(a:FpsPoint,b:FpsPoint,eyeA=1.6+liveGroundHeight(a),eyeB=1.6+liveGroundHeight(b)):boolean {
  const from={x:a.x,y:eyeA,z:a.z},to={x:b.x,y:eyeB,z:b.z};
  const minX=Math.min(a.x,b.x),maxX=Math.max(a.x,b.x),minZ=Math.min(a.z,b.z),maxZ=Math.max(a.z,b.z),minY=Math.min(eyeA,eyeB),maxY=Math.max(eyeA,eyeB);
  for(const wall of collisionSolidsAt(a,b)){
    if(maxX<wall.minX||minX>wall.maxX||maxZ<wall.minZ||minZ>wall.maxZ||maxY<(wall.baseY??0)||minY>(wall.id==='b-fountain'?2.36:wall.height))continue;
    if(liveWallSegmentHit(from,to,wall)!==undefined)return false;
  }
  return true;
}

export function livePathLength(from:FpsPoint,to:FpsPoint):number {
  const path=findLivePath(from,to);if(!path.length)return Infinity;
  let total=0,previous=from;for(const point of path){total+=distance(previous,point);previous=point;}return total;
}

export function findLivePeek(from:FpsPoint,contact:FpsPoint):FpsPoint|undefined {
  if(liveSightline(from,contact))return undefined;
  const candidates:FpsPoint[]=[];
  for(const radius of [1.2,2,2.8])for(let i=0;i<12;i++){
    const p={x:from.x+Math.cos(i*Math.PI/6)*radius,z:from.z+Math.sin(i*Math.PI/6)*radius,level:from.level};
    if(liveWalkable(p)&&clear(from,p)&&liveSightline(p,contact))candidates.push(p);
  }
  return candidates.sort((a,b)=>distance(from,a)-distance(from,b))[0];
}

export function liveClearAngles(from:FpsPoint,toward:FpsPoint):{id:string;point:FpsPoint}[] {
  const dx=toward.x-from.x,dz=toward.z-from.z,len=Math.hypot(dx,dz)||1;
  return LIVE_FPS_MAP.solids.filter(w=>!w.id.endsWith('wall')).flatMap(w=>[
    {id:`${w.id}:sw`,point:{x:w.minX-.65,z:w.minZ-.65}},
    {id:`${w.id}:se`,point:{x:w.maxX+.65,z:w.minZ-.65}},
    {id:`${w.id}:nw`,point:{x:w.minX-.65,z:w.maxZ+.65}},
    {id:`${w.id}:ne`,point:{x:w.maxX+.65,z:w.maxZ+.65}},
  ]).map(c=>({...c,point:{...c.point,level:from.level}})).filter(({point:p})=>distance(from,p)>1&&distance(from,p)<7&&liveWalkable(p)&&liveSightline(from,p)&&((p.x-from.x)*dx+(p.z-from.z)*dz)/len>0)
    .sort((a,b)=>distance(from,a.point)-distance(from,b.point));
}


export interface LiveBoostSpot {
  id: string;
  name: string;
  site: 'A' | 'B' | 'Mid';
  x: number;
  z: number;
  height: number;
  team: 'ct' | 't' | 'both';
  yaw: number;
  description: string;
}

/** Owner removed artificial boosting props and their authored destinations. */
export const LIVE_BOOST_SPOTS: LiveBoostSpot[] = [];

export interface LiveElevationDrop {
  id: string;
  name: string;
  from: { minX: number; maxX: number; minZ: number; maxZ: number };
  landing: FpsPoint;
  minForwardDot: number;
}

/** Elevated ledges, parapets and window openings where actors can vault/jump down to accelerate rotations or escapes. */
export const LIVE_ELEVATION_DROPS: readonly LiveElevationDrop[] = [
  {
    id: 'mid-window-drop',
    name: 'Mid window drop',
    from: { minX: -1.4, maxX: 2.8, minZ: 17.1, maxZ: 20.4 },
    landing: { x: 0.6, z: 15.1 },
    minForwardDot: 0.35,
  },
  {
    id: 'b-apartments-west-drop',
    name: 'B apartments west drop',
    from: { minX: 30.4, maxX: 33.4, minZ: 14.8, maxZ: 17.6 },
    landing: { x: 28.0, z: 17.0 },
    minForwardDot: 0.35,
  },
  {
    id: 'b-apartments-north-drop',
    name: 'B apartments north drop',
    from: { minX: 32.2, maxX: 33.4, minZ: 19.5, maxZ: 21.8 },
    landing: { x: 32.8, z: 23.6 },
    minForwardDot: 0.35,
  },
  {
    id: 'market-terrace-drop',
    name: 'Market gallery drop',
    from: { minX: 30.4, maxX: 33.4, minZ: -17.5, maxZ: -15.0 },
    landing: { x: 28.0, z: -15.8 },
    minForwardDot: 0.35,
  },
  {
    id: 'bridge-canal-drop',
    name: 'Bridge to canal bank drop',
    from: { minX: -1.6, maxX: 1.6, minZ: 2.9, maxZ: 5.6 },
    landing: { x: 3.1, z: 4.2, level: 'canal' },
    minForwardDot: 0.35,
  },
];

export interface LiveJumpablePerch {
  id: string;
  name: string;
  top: FpsPoint;
  height: number;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  approach: FpsPoint;
  approaches: readonly FpsPoint[];
}

/** Climbable street crates and benches discovered from real map solids (height <= crouch-jump reach, clear overhead). */
export const LIVE_JUMPABLE_PERCHES: readonly LiveJumpablePerch[] = LIVE_FPS_MAP.solids.flatMap(w => {
  if ((w.baseY ?? 0) !== 0 || w.height < .4 || w.height > .84) return [];
  if (/wall|quay|port-|spawn-|canal-|restaurant-table/.test(w.id)) return [];
  if (w.maxX - w.minX < .85 || w.maxZ - w.minZ < .85) return [];
  const x = Number(((w.minX + w.maxX) / 2).toFixed(2));
  const z = Number(((w.minZ + w.maxZ) / 2).toFixed(2));
  const overhead = LIVE_FPS_MAP.solids.some(o => o !== w && (o.baseY ?? 0) >= w.height && (o.baseY ?? 0) < w.height + 1.85
    && o.maxX > w.minX && o.minX < w.maxX && o.maxZ > w.minZ && o.minZ < w.maxZ);
  if (overhead) return [];
  const approaches = [
    { x, z: Number((w.minZ - .72).toFixed(2)) },
    { x, z: Number((w.maxZ + .72).toFixed(2)) },
    { x: Number((w.minX - .72).toFixed(2)), z },
    { x: Number((w.maxX + .72).toFixed(2)), z },
  ].filter(a => liveWalkable(a));
  if (!approaches.length) return [];
  return [{
    id: w.id,
    name: liveVillageAsset(w.id).purpose,
    top: { x, z },
    height: w.height,
    minX: w.minX,
    maxX: w.maxX,
    minZ: w.minZ,
    maxZ: w.maxZ,
    approach: approaches[0],
    approaches,
  }];
});
