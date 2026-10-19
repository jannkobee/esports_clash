export type VisualRelease = { avatar_id:string;variant:'current'|'claude';id:number;sha256:string;version:number };
export function visualReleaseUrl(release:VisualRelease,base=import.meta.env?.VITE_API_URL??'/backend/api/v1') {
  if(!Number.isSafeInteger(release.id)||release.id<1||!/^[a-f0-9]{64}$/.test(release.sha256))return undefined;
  return `${base.replace(/\/$/,'')}/avatar-visuals/assets/${release.id}/${release.sha256}.glb`;
}
/** Diagnostic only: public reports cannot authorize automatic rollback. */
export function reportVisualHealth(release:VisualRelease,kind:'load'|'decode'|'shader'|'texture'|'animation'|'performance') {
  if(typeof window==='undefined'||!window.location||!visualReleaseUrl(release))return;
  const base=import.meta.env?.VITE_API_URL??'/backend/api/v1';
  void fetch(`${base.replace(/\/$/,'')}/avatar-visuals/health`,{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({release_id:release.id,sha256:release.sha256,kind}),keepalive:true,signal:AbortSignal.timeout(3000)}).catch(()=>{});
}
export function validateVisualReleases(releases:unknown):ReadonlyMap<string,VisualRelease> {
  if(!Array.isArray(releases))return new Map();
  return new Map(releases.filter((r:VisualRelease)=>r&&/^c_[a-z0-9_]+$/.test(r.avatar_id)
    &&['current','claude'].includes(r.variant)&&visualReleaseUrl(r)).map((r:VisualRelease)=>[`${r.avatar_id}:${r.variant}`,r]));
}
/** Each renderer retains one release snapshot; active scenes never refresh it. */
export async function loadVisualReleases():Promise<ReadonlyMap<string,VisualRelease>> {
  try {
    const base=import.meta.env?.VITE_API_URL??'/backend/api/v1';
    const response=await fetch(`${base.replace(/\/$/,'')}/avatar-visuals`,{signal:AbortSignal.timeout(3000)});
    if(!response.ok)return new Map();
    const {releases}=await response.json();
    return validateVisualReleases(releases);
  } catch { return new Map(); }
}
