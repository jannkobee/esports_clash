import type { FpsPoint, FpsWall } from './fpsSpatialWorld.ts';

/** One source for the walkable stair treads, rendered stone and ballistic floor. */
export const LIVE_B_APARTMENTS = Object.freeze({
  minX: 30.4, maxX: 33.4, stairStart: 8, stairEnd: 14, endZ: 21.8,
  height: 1.8, steps: 10, hold: { x: 32, z: 18.6 },
});
/** The CT lookout is entered from the rear stairs, never through a painted wall. */
export const LIVE_MID_WINDOW = Object.freeze({
  minX:-4.5,maxX:4.5,minZ:17,maxZ:26.5,height:1.8,
  frontZ:17,openingHalfWidth:2.1,sillY:2.82,lintelY:4.65,roofY:5.4,
  stairMinX:-4.4,stairMaxX:-1.8,stairStart:18,stairEnd:22.4,steps:12,
  hold:{x:0,z:18.6},watch:{x:0,z:6},rearApproach:{x:2.8,z:29},
  sideDoor:{x:-4.5,z:24},sideLanding:{x:-5.8,z:24},sideApproach:{x:-16.2,z:24},tApproach:{x:-3.1,z:15.8},
});
export const LIVE_MID_PASSAGE=Object.freeze({minX:-7.2,maxX:-4.5,minZ:22.2,maxZ:26.5,height:1.8,
  stairMinZ:22.5,stairMaxZ:26.1,stairStart:-7.2,stairEnd:-15.3,steps:12});
export const LIVE_BRIDGE={minX:-1.6,maxX:1.6,deckY:1,parapetY:1.85,southApproach:-6.2,northEnd:5.6};
export const LIVE_STEP_HEIGHT = .24;
export interface LiveTerrainSolid extends FpsWall { id: string; height: number; color: string; baseY?: number }
const apartment = LIVE_B_APARTMENTS;
const treadDepth = (apartment.stairEnd - apartment.stairStart) / apartment.steps;
export interface LiveGroundRect {minX:number;maxX:number;minZ:number;maxZ:number}
interface GroundPatch extends LiveGroundRect {height:number;id?:string;suspended?:boolean;canal?:boolean;streetOnly?:boolean}
const contains=(r:LiveGroundRect,p:FpsPoint)=>p.x>=r.minX&&p.x<=r.maxX&&p.z>=r.minZ&&p.z<=r.maxZ;
export const LIVE_CANAL_BANK={minX:-20.5,maxX:30.4,minZ:2.9,maxZ:5.6,height:-1.2};
const canalAccess=[{minX:18.8,maxX:21.2,minZ:5.6,maxZ:9.6},{minX:-20.5,maxX:-18.5,minZ:5.6,maxZ:10.4},{minX:28.4,maxX:30.4,minZ:4.4,maxZ:8.4}];
const canalFootprint=[LIVE_CANAL_BANK,...canalAccess];
export const liveCanalArea=(p:FpsPoint)=>canalFootprint.some(r=>contains(r,p));
/** Cut the actual depression out of every paving/landscape overlay. */
export function liveCutPavingRect(rect:LiveGroundRect):LiveGroundRect[]{
 let parts=[rect];
 for(const hole of [{minX:-200,maxX:200,minZ:LIVE_CANAL.minZ,maxZ:LIVE_CANAL.maxZ},LIVE_PORT,LIVE_CANAL_BANK,
   {minX:18.8,maxX:21.2,minZ:5.6,maxZ:9.2},{minX:-20.5,maxX:-18.5,minZ:5.6,maxZ:9.2},{minX:28.4,maxX:30.4,minZ:4.4,maxZ:8.4}]){
  parts=parts.flatMap(r=>{
   const a=Math.max(r.minX,hole.minX),b=Math.min(r.maxX,hole.maxX),c=Math.max(r.minZ,hole.minZ),d=Math.min(r.maxZ,hole.maxZ);
   if(a>=b||c>=d)return [r];
   return [{...r,maxX:a},{...r,minX:b},{minX:a,maxX:b,minZ:r.minZ,maxZ:c},{minX:a,maxX:b,minZ:d,maxZ:r.maxZ}].filter(p=>p.maxX-p.minX>.001&&p.maxZ-p.minZ>.001);
  });
 }
 return parts;
}
// A five-metre urban canal, bounded by masonry quays rather than exposed riverbanks.
// The harbor is scenery beyond the northern play boundary; CT gathers on its dry quay.
export const LIVE_CANAL={minX:-115,maxX:115,minZ:-2.2,maxZ:2.8,waterY:-1.6,bedY:-2.5};
export const LIVE_PORT={minX:-115,maxX:115,minZ:44.5,maxZ:125,waterY:-1.6,bedY:-3};
export const LIVE_CANAL_CROSSINGS=[{minX:-33,maxX:-29},{minX:-21,maxX:-16},{minX:-1.6,maxX:1.6},{minX:18,maxX:21.8},{minX:28.7,maxX:33.4}];
// Compatibility for existing physics callers and saved diagnostic fixtures.
export const LIVE_RIVER=LIVE_CANAL;
export const LIVE_RIVER_BRIDGES=LIVE_CANAL_CROSSINGS;
export const LIVE_OBJECT_PERCHES:readonly {id:string;x:number;z:number}[]=[];
const groundPatches:GroundPatch[]=[
  {...LIVE_MID_WINDOW,minX:-1.68,maxZ:20.5,id:'mid-window-room-floor'},
  {minX:-4.5,maxX:1.2,minZ:22.4,maxZ:26.5,height:1.8,id:'mid-window-upper-gallery'},
  {minX:-1.68,maxX:1.2,minZ:20.5,maxZ:22.4,height:1.8,id:'mid-window-upper-hall'},
  ...Array.from({length:12},(_,i)=>({minX:1.2,maxX:4.5,minZ:20.5+i*.5,maxZ:20.5+(i+1)*.5,
    height:(12-i)*.15,id:`mid-window-ct-interior-stair-${i}`})),
  {...LIVE_MID_PASSAGE,id:'mid-window-side-passage-floor'},
  ...Array.from({length:12},(_,i)=>({minX:-7.2-(i+1)*.675,maxX:-7.2-i*.675,minZ:22.5,maxZ:26.1,
    height:(12-i)*.15,id:`mid-window-side-stair-${i}`})),
  ...Array.from({length:LIVE_MID_WINDOW.steps},(_,i)=>({
    minX:LIVE_MID_WINDOW.stairMinX,maxX:LIVE_MID_WINDOW.stairMaxX,
    minZ:LIVE_MID_WINDOW.stairStart+i*(LIVE_MID_WINDOW.stairEnd-LIVE_MID_WINDOW.stairStart)/LIVE_MID_WINDOW.steps,
    maxZ:LIVE_MID_WINDOW.stairStart+(i+1)*(LIVE_MID_WINDOW.stairEnd-LIVE_MID_WINDOW.stairStart)/LIVE_MID_WINDOW.steps,
    height:(i+1)*.15,id:`mid-window-rear-stair-${i}`,
  })),
  {...LIVE_CANAL_BANK,id:'canal-bank-floor',canal:true},
  ...Array.from({length:6},(_,i)=>({minX:18.8,maxX:21.2,minZ:5.6+i*.6,maxZ:5.6+(i+1)*.6,height:-1.2+(i+1)*.2,canal:true,id:`canal-market-north-stair-${i}`})),
  ...[{minX:-21,maxX:-16},{minX:18,maxX:21.8}].flatMap((r,k)=>[
    {...r,minZ:2.8,maxZ:4.2,height:0,canal:true,id:`canal-stair-landing-${k}`},
    ...Array.from({length:6},(_,i)=>({minX:r.maxX+i*.55,maxX:r.maxX+(i+1)*.55,minZ:2.9,maxZ:4.2,height:-(i+1)*.2,canal:true,id:`canal-stair-side-${k}-${i}`})),
  ]),
  ...Array.from({length:6},(_,i)=>({minX:-20.5,maxX:-18.5,minZ:5.6+i*.6,maxZ:5.6+(i+1)*.6,height:-1.2+(i+1)*.2,canal:true,id:`canal-west-stair-${i}`})),
  ...Array.from({length:6},(_,i)=>({minX:28.4,maxX:30.4,minZ:4.4+i*.6,maxZ:4.4+(i+1)*.6,height:-1.2+(i+1)*.2,canal:true,id:`canal-apartment-stair-${i}`})),
  ...LIVE_RIVER_BRIDGES.filter(p=>p.minX!==-1.6).map(p=>({...p,minZ:LIVE_RIVER.minZ,maxZ:LIVE_RIVER.maxZ,height:0,suspended:true})),
  ...Array.from({length:5},(_,i)=>({minX:-1.6,maxX:1.6,minZ:LIVE_BRIDGE.southApproach+i*.8,maxZ:LIVE_BRIDGE.southApproach+(i+1)*.8,height:(i+1)*.2,id:`bridge-south-stair-${i}`})),
  {minX:-1.6,maxX:1.6,minZ:LIVE_RIVER.minZ,maxZ:5.6,height:1,suspended:true,id:'bridge-central-deck'},
  ...Array.from({length:5},(_,i)=>({minX:-1.6,maxX:1.6,minZ:5.6+i*.8,maxZ:5.6+(i+1)*.8,height:(5-i)*.2,id:`bridge-north-stair-${i}`})),
  ...Array.from({length:10},(_,i)=>({minX:30.4,maxX:33.4,minZ:-34+i*.6,maxZ:-34+(i+1)*.6,height:(i+1)*.18})),
  {minX:30.4,maxX:33.4,minZ:-28,maxZ:apartment.endZ,height:1.8},
  ...Array.from({length:apartment.steps},(_,i)=>({minX:28.4,maxX:30.4,
    minZ:apartment.stairStart+i*treadDepth,maxZ:apartment.stairStart+(i+1)*treadDepth,height:apartment.height*(i+1)/apartment.steps})),
  {minX:28.4,maxX:33.4,minZ:14,maxZ:14.8,height:1.8},
  ...Array.from({length:3},(_,i)=>({minX:-25.2,maxX:-20.8,minZ:24.9+i*.46,maxZ:24.9+(i+1)*.46,height:(i+1)*.15})),
];
/** Segmented masonry vaults: the underside remains an open, shared collision arch. */
export const LIVE_BRIDGE_VAULTS:readonly LiveTerrainSolid[]=[
 ...[[LIVE_RIVER.minZ,LIVE_RIVER.maxZ],[2.9,5.6]].flatMap(([start,end],span)=>Array.from({length:18},(_,i)=>{
  const z0=start+(end-start)*i/18,z1=start+(end-start)*(i+1)/18;
  const arch=(z:number)=>(span===0?-2.1:-.1)+Math.sqrt(Math.max(0,1-((z-(start+end)/2)/((end-start)/2))**2))*(span===0?2.82:.82);
  return {id:`bridge-vault-${span}-${i}`,minX:-1.6,maxX:1.6,minZ:z0,maxZ:z1,
    baseY:Math.min(arch(z0),arch(z1)),height:.82,color:'#a27e64'};
 })),
];
export const LIVE_TERRAIN_SOLIDS: readonly LiveTerrainSolid[] = [
  ...groundPatches.map((patch,i)=>({...patch,id:patch.id??`village-terrace-stone-${i}`,color:patch.canal?'#a3a28b':'#c5b79b',
    baseY:patch.suspended?patch.height-.18:patch.canal?-1.4:0})),
  ...LIVE_BRIDGE_VAULTS,
  ...groundPatches.filter(p=>p.id?.startsWith('bridge-')&&p.id.includes('stair')).flatMap(p=>[-1,1].map(side=>({
    id:`${p.id}-cheek-${side}`,minX:side*1.7-.12,maxX:side*1.7+.12,minZ:p.minZ,maxZ:p.maxZ,baseY:0,height:p.height+.85,color:'#a47d64'}))),
  ...[LIVE_RIVER.minZ,2.85,5.6].map(z=>({id:`bridge-springing-${z}`,minX:-1.6,maxX:1.6,minZ:z-.1,maxZ:z+.1,baseY:LIVE_RIVER.bedY,height:z<0?-2.05:-.1,color:'#a7977b'})),
  ...[{id:'canal-quay-bakery',minX:-7.5,maxX:-2,minZ:-8,maxZ:-2},{id:'canal-quay-east-homes',minX:3,maxX:14,minZ:-18,maxZ:-2},
    {id:'canal-quay-apartment-crossing',minX:30.4,maxX:33.4,minZ:LIVE_RIVER.minZ,maxZ:LIVE_RIVER.maxZ}].map(r=>({...r,baseY:LIVE_RIVER.bedY,height:0,color:'#929783'})),
  { id: 'b-apartments-roof', minX:30.15,maxX:37.5,minZ:13.7,maxZ:22.3,
    baseY:4.35,height:4.52,color:'#b16d4e' },
];

export const liveRiverWater=(p:FpsPoint)=>p.z>LIVE_RIVER.minZ&&p.z<LIVE_RIVER.maxZ&&!LIVE_RIVER_BRIDGES.some(b=>p.x>=b.minX&&p.x<=b.maxX);
// Static terrain is indexed once. The exact tread/ledge bounds still determine
// height; cells only narrow which patches a moving actor needs to inspect.
const patchCells:GroundPatch[][]=Array.from({length:18*24},()=>[]);
for(const patch of groundPatches)for(let z=Math.floor((patch.minZ+46)/4);z<=Math.floor((patch.maxZ+46)/4);z++)
  for(let x=Math.floor((patch.minX+36)/4);x<=Math.floor((patch.maxX+36)/4);x++)
    if(x>=0&&x<18&&z>=0&&z<24)patchCells[z*18+x].push(patch);
export function liveGroundHeight(point:FpsPoint):number {
 const inBank=contains(LIVE_CANAL_BANK,point);
 let h=point.z>=LIVE_RIVER.minZ&&point.z<=LIVE_RIVER.maxZ?LIVE_RIVER.bedY:inBank?-1.2:0;
 // Access stairs cut below street grade; don't clamp their negative treads to zero.
 if(canalAccess.some(r=>contains(r,point)))h=-1.2;
 const x=Math.floor((point.x+36)/4),z=Math.floor((point.z+46)/4);
 if(x<0||x>=18||z<0||z>=24)return h;
 for(const patch of patchCells[z*18+x])if(contains(patch,point)&&!(point.level==='canal'&&(patch.suspended||patch.streetOnly)))h=Math.max(h,patch.height);
 if(h<-.001&&!inBank&&!groundPatches.some(p=>p.canal&&contains(p,point)))h=0;
 return h;
}
export function liveOnStairs(point:FpsPoint):boolean {
 const x=Math.floor((point.x+36)/4),z=Math.floor((point.z+46)/4);
 if(x<0||x>=18||z<0||z>=24)return false;
 return patchCells[z*18+x].some(p=>contains(p,point)&&!p.suspended&&(p.maxZ-p.minZ<.65||p.id?.includes('stair-')));
}
/** Physical effects select the floor below them rather than a deck above them. */
export function liveFloorAt(point:FpsPoint,y:number):number {
 const upper=liveGroundHeight({...point,level:undefined});
 return liveCanalArea(point)&&y<upper-.05?liveGroundHeight({...point,level:'canal'}):upper;
}
export function liveTerrainLevelAllowed(point:FpsPoint):boolean {
 if(point.level==='canal')return liveCanalArea(point);
 return !contains(LIVE_CANAL_BANK,point)||liveGroundHeight(point)>=-.001;
}
export function liveTerrainConnector(a:FpsPoint,b:FpsPoint):boolean {
 return a.x===b.x&&a.z===b.z&&liveTerrainLevelAllowed(a)&&liveTerrainLevelAllowed(b)
  &&Math.abs(liveGroundHeight(a)-liveGroundHeight(b))<=LIVE_STEP_HEIGHT;
}
const terraceBounds=[{minX:28.4,maxX:33.4,minZ:-34,maxZ:21.8},{minX:-25.2,maxX:-20.8,minZ:24.9,maxZ:26.28},{minX:-34,maxX:34,minZ:-10.2,maxZ:11.6},
  {minX:-19,maxX:4.7,minZ:7.8,maxZ:29.2}];

/** Directed clearance: stairs ascend, drops descend, sheer sides cannot be climbed. */
export function liveTerrainPathClear(from: FpsPoint, to: FpsPoint, feetY?: number,allowJump=false): boolean {
  if((from.level??'street')!==(to.level??'street'))return liveTerrainConnector(from,to);
  if(!liveTerrainLevelAllowed(from)||!liveTerrainLevelAllowed(to))return false;
  if(!terraceBounds.some(patch=>Math.max(from.x,to.x)>=patch.minX&&Math.min(from.x,to.x)<=patch.maxX
    &&Math.max(from.z,to.z)>=patch.minZ&&Math.min(from.z,to.z)<=patch.maxZ))return true;
  const dx=to.x-from.x,dz=to.z-from.z;
  if(Math.abs(dx)+Math.abs(dz)<1e-10)return !liveRiverWater(to);
  const cuts=[0,1],minX=Math.min(from.x,to.x),maxX=Math.max(from.x,to.x),minZ=Math.min(from.z,to.z),maxZ=Math.max(from.z,to.z);
  const cut=(t:number)=>{if(t>0&&t<1)cuts.push(t);};
  for(const patch of groundPatches){
    if(maxX<patch.minX||minX>patch.maxX||maxZ<patch.minZ||minZ>patch.maxZ)continue;
    if(Math.abs(dx)>1e-10){cut((patch.minX-from.x)/dx);cut((patch.maxX-from.x)/dx);}
    if(Math.abs(dz)>1e-10){cut((patch.minZ-from.z)/dz);cut((patch.maxZ-from.z)/dz);}
  }
  if(maxZ>LIVE_RIVER.minZ&&minZ<LIVE_RIVER.maxZ){
    if(Math.abs(dz)>1e-10){cut((LIVE_RIVER.minZ-from.z)/dz);cut((LIVE_RIVER.maxZ-from.z)/dz);}
    if(Math.abs(dx)>1e-10)for(const bridge of LIVE_RIVER_BRIDGES){cut((bridge.minX-from.x)/dx);cut((bridge.maxX-from.x)/dx);}
  }
  cuts.sort((a,b)=>a-b);
  let count=1;
  for(let i=1;i<cuts.length;i++)if(cuts[i]-cuts[count-1]>1e-10)cuts[count++]=cuts[i];
  cuts.length=count;
  let support = Math.max(liveGroundHeight(from), feetY ?? -Infinity);
  const allowed=allowJump?.6:LIVE_STEP_HEIGHT;
  for(let i=0;i<cuts.length;i++){
    const t=i===cuts.length-1?1:(cuts[i]+cuts[i+1])/2,point={x:from.x+dx*t,z:from.z+dz*t,level:from.level},ground=liveGroundHeight(point);
    if(liveRiverWater(point)||!liveTerrainLevelAllowed(point))return false;
    if (ground > support + allowed + 1e-6) return false;
    support = Math.max(ground, feetY ?? -Infinity);
  }
  return true;
}
