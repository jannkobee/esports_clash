const MAX_SEED=2147483647;
let previousSeed:number|undefined;
// Preserve the last allocation when this module itself is hot-replaced.
if(import.meta.hot)previousSeed=import.meta.hot.data.previousSeed;

export function freshFpsExhibitionSeed(exclude?:number,random:()=>number=()=>crypto.getRandomValues(new Uint32Array(1))[0]):number {
  let seed=1+(random()>>>0)%MAX_SEED;
  // Bound retries even if a random source repeats; never repeat the previous live run.
  while(seed===exclude||seed===previousSeed)seed=seed%MAX_SEED+1;
  previousSeed=seed;
  if(import.meta.hot)import.meta.hot.data.previousSeed=seed;
  return seed;
}
