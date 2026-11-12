import { hasFpsLineOfSight, segmentHitsWall, type FpsPoint, type FpsWall } from './fpsSpatialWorld.ts';

export interface LiveSolid extends FpsWall { id: string; height: number; color: string; bulletPenetration?:number }
const solid = (id: string, x: number, z: number, width: number, depth: number, height: number, color: string,bulletPenetration=0): LiveSolid =>
({ id, minX: x-width/2, maxX: x+width/2, minZ: z-depth/2, maxZ: z+depth/2, height, color,bulletPenetration });

/** Original collision layout inspired by the tactical depth and non-linear routing of Inferno.
* Movement/navigation use these solid bounds. Sight and bullets clip by solid height, with the B
* Fountain's radial model geometry replacing its conservative movement rectangle.
* The custom map combines chicanes, Underpass, Banana, B Fountain, A Pit and Warehouse Gallery. */
export const LIVE_FPS_MAP = {
id: 'breakwater-live-v4', name: 'Breakwater Yard', width: 72, depth: 92,
spawns:{attackers:{x:0,z:-33},defenders:{x:0,z:41}},
sites: { A: { x: -23, z: 21 }, B: { x: 23, z: 21 } } satisfies Record<string, FpsPoint>,
solids: [
// Outer perimeter boundary
solid('west-wall', -36.5, 0, 1, 94, 5, '#6e807e'),
solid('east-wall', 36.5, 0, 1, 94, 5, '#6e807e'),
solid('south-wall', 0, -46.5, 74, 1, 5, '#6e807e'),
solid('north-wall', 0, 46.5, 74, 1, 5, '#6e807e'),

// Architectural piers share rendering, sight, bullet and movement geometry.
solid('banana-arch-pillar-l', 16.7, 7, .7, 1.2, 3.3, '#a89d87'),
solid('banana-arch-pillar-r', 23.3, 7, .7, 1.2, 3.3, '#a89d87'),
solid('port-arch-pillar-l', -6.6, 22, .65, 1.2, 3.5, '#9e937d'),
solid('port-arch-pillar-r', -1.4, 22, .65, 1.2, 3.5, '#9e937d'),
solid('church-arch-pillar-l', 19.2, 32, .7, 1.2, 3.3, '#968c78'),
solid('church-arch-pillar-r', 24.8, 32, .7, 1.2, 3.3, '#968c78'),
solid('underpass-sluice-jamb-l', -6.35, -10, .45, .9, 2.3, '#77807b'),
solid('underpass-sluice-jamb-r', -3.15, -10, .45, .9, 2.3, '#77807b'),

// T Spawn approach screen & harbor buildings
solid('loading-office', -22, -27, 8, 6, 4, '#b6aa91'),
solid('pump-house', 22, -27, 8, 6, 4, '#b6aa91'),
solid('mid-approach-screen', 0, -25, 4, 3, 3, '#859596'),

// Central Mid & Underpass (The Sluice)
// Mid lane runs along x: 0; Second Mid runs along x: -8
solid('mid-west-lower', -4.75, -15, 3.5, 6, 7, '#b6ac92'),
solid('mid-west-upper', -4.75, -5, 3.5, 6, 7, '#b6ac92'),
// Gap between z: -12 and z: -8 is the Underpass sluice connecting Second Mid to Mid!

// Apartments / Warehouse Gallery block (x: -16 to -7)
// Flanking upper route into A Balcony and Short
solid('apartments-south', -12.5, -12, 5, 12, 8, '#b6ac92'),
solid('apartments-north', -11.5, 14, 9, 16, 7, '#b0a38a'),

// East Mid Warehouse: separates Mid from Banana Slipway
solid('customs-warehouse-east', 8.5, -10, 11, 16, 8, '#98aaa8'),
solid('freight-office-east', 9.5, 14, 13, 16, 7, '#90a6ac'),

// Banana Slipway: curved approach to B with Logs, Car, and Sandbag bastion
solid('b-logs', 14, -11, 3, 4, 1.8, '#a36f50',.42),
solid('b-car', 18, -2, 4, 5, 2.4, '#537778'),
solid('b-sandbags', 24, 4, 4, 2.5, 1.3, '#c3a574'),

// Containers & outer gate walls
solid('west-container', -25, 1, 6, 14, 3, '#537778',.28),
solid('east-container', 25, 3, 6, 14, 3, '#a36f50',.38),
solid('west-outer-gate', -35, 4, 2, 8, 3.5, '#9e9682'),
solid('east-outer-gate', 35, 6, 2, 8, 3.5, '#8da1a8'),
solid('west-lane-dogleg', -32, -15, 8, 3, 3, '#9e9682'),
solid('east-lane-dogleg', 32, -13, 8, 3, 3, '#8da1a8'),
solid('west-staging-cover', -17, -20, 3, 3, 2.4, '#697c79'),
solid('east-staging-cover', 18, -20, 3, 3, 2.4, '#947c5f'),

// A Site Courtyard & Pit
solid('a-generator', -33, 12, 3, 5, 2.5, '#627577'),
solid('a-pit-revetment', -30, 16, 3, 1.5, 1.2, '#8b927f'),
solid('a-crates', -28, 20, 5, 5, 2.7, '#9a805a',.38),
solid('a-screen', -17, 28, 5, 3, 3.5, '#536b71'),
solid('a-retake-cover', -11, 34, 4, 3, 2.5, '#8b927f'),
// The terracotta loggia used to be render-only: actors and bullets passed through it.
// Render these exact volumes in the viewer, with no separate scenery wall.
solid('a-loggia-wall', -23, 26.42, 9.6, .15, 3.2, '#b86455'),
solid('a-loggia-west-column', -27.5, 26, .45, .45, 2.8, '#cfc3a7'),
solid('a-loggia-center-column', -23, 26, .45, .45, 2.8, '#cfc3a7'),
solid('a-loggia-east-column', -18.5, 26, .45, .45, 2.8, '#cfc3a7'),

// B Site Basin & Central Fountain
solid('b-fountain', 23, 21, 4.6, 4.6, 1.5, '#6e807e'),
solid('b-coffins', 15, 26, 3, 4.5, 2.8, '#a77a55',.38),
solid('b-screen', 17, 28, 5, 3, 3.5, '#b5a36d'),
solid('b-dark-wall', 30, 24, 4, 3, 3, '#a99267'),
solid('b-retake-cover', 27, 34, 4, 3, 2.5, '#8b927f'),

// Mid Backstop & North Divider (Speedway & Customs Yard)
solid('mid-backstop', 0, 18.5, 6, 3, 4, '#7f9496'),
solid('north-divider', 0, 33, 8, 6, 4, '#a9a291'),
]
};

/** All tactical positions are in traversable space, shared by the HUD and the AI. */
export const LIVE_TACTICAL = {
A: {
staging:[{x:-20,z:-12},{x:-30,z:-12}],
rally:[{x:-19,z:-7},{x:-31,z:-7}],
entries:[{x:-18,z:9},{x:-30,z:7}],
flash:{x:-21,z:14},smoke:{x:-21,z:31},
holds:[{x:-23,z:29},{x:-31,z:25},{x:-14,z:23}],
postPlant:[{x:-20,z:15},{x:-30,z:14},{x:-23,z:28},{x:-13,z:24},{x:-19,z:9}],
},
B: {
staging:[{x:20,z:-12},{x:31,z:-10}],
rally:[{x:19,z:-7},{x:31,z:-7}],
entries:[{x:20,z:10},{x:31,z:9}],
flash:{x:21,z:15},smoke:{x:24,z:31},
holds:[{x:23,z:29},{x:32,z:26},{x:18,z:24}],
postPlant:[{x:22,z:14},{x:32,z:15},{x:23,z:28},{x:19,z:26},{x:19,z:8}],
}
};
/** Repeatable attack-side smoke setups. Throws release from the named staging point. */
export const LIVE_SMOKE_LINEUPS = [
{ id:'b-speedway',site:'B',name:'Banana to Speedway',position:{x:20,z:8},target:{x:18,z:25} },
{ id:'b-church',site:'B',name:'B choke to Church',position:{x:23,z:9},target:{x:27,z:24} },
{ id:'a-arch',site:'A',name:'A main to Arch',position:{x:-19,z:8},target:{x:-16,z:24} },
{ id:'a-library',site:'A',name:'A outer to Library',position:{x:-29,z:9},target:{x:-11,z:30} },
] as const;
export const LIVE_MID={
approach:{x:0,z:-21},
control:{x:0,z:1},
underpass:{west:{x:-8,z:-10},east:{x:0,z:-10}},
splits:{A:{x:-19,z:5},B:{x:19,z:5}}
};
export const LIVE_CHOKES=[
{name:'A main',center:{x:-19,z:7},width:6,axis:'x'},
{name:'A outer',center:{x:-31,z:7},width:6,axis:'x'},
{name:'B main',center:{x:19,z:8},width:6,axis:'x'},
{name:'B outer',center:{x:31,z:9},width:6,axis:'x'},
{name:'Mid gate',center:{x:0,z:-12},width:6,axis:'x'},
] as const;
export const LIVE_CALLOUTS = [
{name:'Harbor gates',x:0,z:-38},
{name:'Banana slipway',x:18,z:-16},
{name:'Banana logs',x:14,z:-11},
{name:'Banana car',x:18,z:-2},
{name:'Banana sandbags',x:24,z:4},
{name:'B choke',x:20,z:8},
{name:'B basin fountain',x:23,z:21},
{name:'Coffins stack',x:15,z:26},
{name:'Dark alcove',x:31,z:28},
{name:'Church ruins',x:23,z:36},
{name:'Speedway dock',x:12,z:35},
{name:'Customs yard',x:0,z:39},
{name:'Port arch',x:-4,z:22},
{name:'Patio short',x:-12,z:8},
{name:'Warehouse gallery',x:-12,z:-4},
{name:'A balcony',x:-16,z:14},
{name:'Cargo alley',x:-20,z:-10},
{name:'Pit revetment',x:-30,z:14},
{name:'Warehouse A site',x:-23,z:21},
{name:'Graveyard',x:-24,z:30},
{name:'Mid lane',x:0,z:-8},
{name:'Second mid canal',x:-8,z:-16},
{name:'Underpass sluice',x:-5,z:-10},
{name:'Top mid bench',x:0,z:2},
];
export function liveCallout(p:FpsPoint):string {
return [...LIVE_CALLOUTS].sort((a,b)=>distance(p,a)-distance(p,b))[0].name;
}

export const LIVE_ACTOR_RADIUS = .35;
export const distance = (a: FpsPoint, b: FpsPoint) => Math.hypot(a.x-b.x, a.z-b.z);
const clear = (a: FpsPoint, b: FpsPoint) => !LIVE_FPS_MAP.solids.some(w => segmentHitsWall(a,b,w,LIVE_ACTOR_RADIUS+.08));
export const liveWalkable=(point:FpsPoint)=>Math.abs(point.x)<=34 && Math.abs(point.z)<=43 && clear(point,point);
const nodes: FpsPoint[] = [];
const grid = new Map<string, number>();
for (let z = -42; z <= 42; z += 2) for (let x = -34; x <= 34; x += 2) {
  const point = { x, z };
  if (clear(point, point)) { grid.set(`${x},${z}`, nodes.length); nodes.push(point); }
}
const neighbors = nodes.map(p => [[2, 0], [-2, 0], [0, 2], [0, -2]].flatMap(([x, z]) => {
  const next = grid.get(`${p.x + x},${p.z + z}`);
  return next !== undefined && clear(p, nodes[next]) ? [next] : [];
}));

export function findLivePath(from: FpsPoint, destination: FpsPoint, threats:readonly FpsPoint[]=[], caution=0): FpsPoint[] {
  const to=liveWalkable(destination)?destination:safeLivePoint(destination);
  // Physical motion can leave an actor within the extra navigation margin.
  // Its departure may use physical clearance; the rest of the graph keeps the margin.
  const fromHasMargin=liveWalkable(from);
  const departureClear=(target:FpsPoint)=>fromHasMargin?clear(from,target)
    :!LIVE_FPS_MAP.solids.some(w=>segmentHitsWall(from,target,w,LIVE_ACTOR_RADIUS));
  if (departureClear(to) && !threats.length) return [{ ...to }];
  const nearest = (p: FpsPoint,departing=false) => {
    let best=-1, cost=Infinity;
    nodes.forEach((node,index) => {
      const d=distance(p,node);
      if(d<cost && (departing?departureClear(node):clear(p,node))) { best=index; cost=d; }
    });
    return best;
  };
  const start=nearest(from,true), end=nearest(to);
  if(start<0 || end<0) return [];
  const parent=new Int32Array(nodes.length).fill(-1), cost=new Float64Array(nodes.length).fill(Infinity);
  const open:{node:number;score:number}[]=[];
  const push=(item:{node:number;score:number})=>{let i=open.length;open.push(item);while(i>0){const p=(i-1)>>1;if(open[p].score<=item.score)break;open[i]=open[p];i=p;}open[i]=item;};
  const pop=()=>{const result=open[0],last=open.pop()!;if(open.length){let i=0;while(i*2+1<open.length){let c=i*2+1;if(c+1<open.length&&open[c+1].score<open[c].score)c++;if(open[c].score>=last.score)break;open[i]=open[c];i=c;}open[i]=last;}return result;};
  const closed=new Set<number>(), exposure=new Map<number,number>();
  cost[start]=0;parent[start]=start;push({node:start,score:distance(nodes[start],nodes[end])});
  while(open.length) {
    const {node}=pop();if(closed.has(node))continue;if(node===end)break;closed.add(node);
    for(const next of neighbors[node]) {
      if(closed.has(next))continue;
      if(!exposure.has(next))exposure.set(next,threats.reduce((sum,t)=>sum+(distance(t,nodes[next])<45&&liveSightline(t,nodes[next])?Math.max(0,caution)*5:0),0));
      const value=cost[node]+2+exposure.get(next)!;
      if(value<cost[next]){cost[next]=value;parent[next]=node;push({node:next,score:value+distance(nodes[next],nodes[end])});}
    }
  }
  if(parent[end]<0) return [];
  const path:FpsPoint[]=[{...to}];
  for(let at=end;at!==start;at=parent[at]) path.push(nodes[at]);
  path.push(nodes[start]);path.reverse();
  const result:FpsPoint[]=[]; let anchor=from;
  for(let i=0;i<path.length;) {
    let far=i; while(far+1<path.length && (anchor===from?departureClear(path[far+1]):clear(anchor,path[far+1])) && (!threats.length || distance(anchor,path[far+1])<4)) far++;
    result.push({...path[far]});anchor=path[far];i=far+1;
  }
  return result;
}

export function safeLivePoint(point:FpsPoint):FpsPoint {
  const clamped = { x: Math.max(-34, Math.min(34, point.x)), z: Math.max(-43, Math.min(43, point.z)) };
  if(liveWalkable(clamped))return {...clamped};
  return {...nodes.reduce((best,node)=>distance(clamped,node)<distance(clamped,best)?node:best,nodes[0])};
}

export function findLiveCover(from:FpsPoint,threat:FpsPoint,allies:readonly FpsPoint[],quality?:number,knownThreats:readonly FpsPoint[]=[]):FpsPoint|undefined {
  const candidates=LIVE_FPS_MAP.solids.filter(w=>!w.id.endsWith('wall')).flatMap(w=>[
    {x:w.minX-.9,z:w.minZ-.9},{x:w.maxX+.9,z:w.minZ-.9},
    {x:w.minX-.9,z:w.maxZ+.9},{x:w.maxX+.9,z:w.maxZ+.9},
  ]).filter(p=>liveWalkable(p)&&distance(from,p)<12&&!liveSightline(threat,p));
  candidates.sort((a,b)=>{
    const score=(p:FpsPoint)=>{
      const dist=distance(from,p);
      const allyPenalty=allies.filter(ally=>distance(p,ally)<2).length*5;
      if(quality===undefined)return dist+allyPenalty;
      const crossfirePenalty=knownThreats.reduce((sum,t)=>sum+(liveSightline(t,p)?12:0),0)*(quality??0);
      return dist + allyPenalty + crossfirePenalty;
    };
    return score(a)-score(b);
  });
  return candidates[0];
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
  for(const [origin,delta,min,max] of [
    [from.x,to.x-from.x,wall.minX,wall.maxX],
    [from.z,to.z-from.z,wall.minZ,wall.maxZ],
    [from.y,to.y-from.y,0,wall.height],
  ]) {
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
  return LIVE_FPS_MAP.solids.flatMap(wall=>{
    const t=liveWallSegmentHit(from,to,wall);return t===undefined?[]:[{wall,t}];
  }).sort((a,b)=>a.t-b.t);
}

export function liveSightline(a:FpsPoint,b:FpsPoint,eyeA=1.6,eyeB=1.6):boolean {
  return liveWallIntersections({...a,y:eyeA},{...b,y:eyeB}).length===0;
}

export function livePathLength(from:FpsPoint,to:FpsPoint):number {
  const path=findLivePath(from,to);if(!path.length)return Infinity;
  let total=0,previous=from;for(const point of path){total+=distance(previous,point);previous=point;}return total;
}

export function findLivePeek(from:FpsPoint,contact:FpsPoint):FpsPoint|undefined {
  if(liveSightline(from,contact))return undefined;
  const candidates:FpsPoint[]=[];
  for(const radius of [1.2,2,2.8])for(let i=0;i<12;i++){
    const p={x:from.x+Math.cos(i*Math.PI/6)*radius,z:from.z+Math.sin(i*Math.PI/6)*radius};
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
  ]).filter(({point:p})=>distance(from,p)>1&&distance(from,p)<7&&liveWalkable(p)&&liveSightline(from,p)&&((p.x-from.x)*dx+(p.z-from.z)*dz)/len>0)
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

/** Tactical boost spots giving players vertical elevation and unexpected off-angles */
export const LIVE_BOOST_SPOTS: LiveBoostSpot[] = [
  { id: 'b-sandbags-boost', name: 'B Sandbags boost', site: 'B', x: 23.5, z: 4.0, height: 1.3, team: 'ct', yaw: Math.PI, description: 'Elevated off-angle holding Banana push' },
  { id: 'b-car-boost', name: 'B Car roof boost', site: 'B', x: 18.0, z: -1.5, height: 1.45, team: 'ct', yaw: -Math.PI / 2, description: 'High ground watching Banana approach' },
  { id: 'a-pit-ledge-boost', name: 'A Pit ledge boost', site: 'A', x: -29.8, z: 16.2, height: 1.2, team: 'ct', yaw: -Math.PI / 4, description: 'Revetment ledge watching A Long' },
  { id: 'a-balcony-boost', name: 'A Balcony railing boost', site: 'A', x: -16.0, z: 12.0, height: 2.35, team: 't', yaw: Math.PI / 2, description: 'Apartments upper gallery overlooking A Site' },
  { id: 'b-fountain-curb-boost', name: 'B Fountain curb boost', site: 'B', x: 23.0, z: 21.0, height: 0.9, team: 'both', yaw: 0, description: 'Basin curb headshot angle over B site cover' },
];
