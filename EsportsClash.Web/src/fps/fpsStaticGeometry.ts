import type {FpsPoint,FpsWall} from './fpsSpatialWorld.ts';

/** Immutable broad phase. Exact capsule/ray/height tests remain authoritative. */
export function createLiveGeometryIndex<T extends FpsWall>(solids:readonly T[],size=6){
  const cells=new Map<string,number[]>(),regions=new Map<string,readonly T[]>();
  let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;
  for(const [i,solid] of solids.entries()){
    const x0=Math.floor(solid.minX/size),x1=Math.floor(solid.maxX/size),z0=Math.floor(solid.minZ/size),z1=Math.floor(solid.maxZ/size);
    minX=Math.min(minX,x0);maxX=Math.max(maxX,x1);minZ=Math.min(minZ,z0);maxZ=Math.max(maxZ,z1);
    for(let x=x0;x<=x1;x++)for(let z=z0;z<=z1;z++){
      const key=`${x}:${z}`,cell=cells.get(key);if(cell)cell.push(i);else cells.set(key,[i]);
    }
  }
  const cellSolids=new Map([...cells].map(([key,ids])=>[key,Object.freeze(ids.map(i=>solids[i]))]));
  const empty:readonly T[]=Object.freeze([]);
  return (a:FpsPoint,b:FpsPoint=a,radius=0):readonly T[]=>{
    const x0=Math.max(minX,Math.floor((Math.min(a.x,b.x)-radius)/size)),x1=Math.min(maxX,Math.floor((Math.max(a.x,b.x)+radius)/size));
    const z0=Math.max(minZ,Math.floor((Math.min(a.z,b.z)-radius)/size)),z1=Math.min(maxZ,Math.floor((Math.max(a.z,b.z)+radius)/size));
    if(x0>x1||z0>z1)return empty;
    if(x0===x1&&z0===z1)return cellSolids.get(`${x0}:${z0}`)??empty;
    const key=`${x0}:${x1}:${z0}:${z1}`,cached=regions.get(key);if(cached)return cached;
    const indices=new Set<number>();
    for(let x=x0;x<=x1;x++)for(let z=z0;z<=z1;z++)for(const i of cells.get(`${x}:${z}`)??[])indices.add(i);
    const result=Object.freeze([...indices].sort((a,b)=>a-b).map(i=>solids[i]));
    if(regions.size>=512)regions.delete(regions.keys().next().value!);
    regions.set(key,result);return result;
  };
}
