import { loadIntelligencePolicy, type IntelligencePolicy } from './intelligencePolicy';
export interface IntelligenceRelease {id:string;policy:IntelligencePolicy;qualification?:'foundation'|'learning'|'qualified';source_hash?:string;run_id?:string;generation?:number}
let current:IntelligenceRelease|undefined;
export const intelligenceReleaseSnapshot=()=>current?structuredClone(current):undefined;
/** Fetch before a new match; an existing component keeps its frozen snapshot. */
export async function refreshIntelligenceRelease() {
  try {
    const response=await fetch(`${(import.meta.env.VITE_API_URL??'/backend/api/v1').replace(/\/$/,'')}/intelligence-policy`,
      {cache:'no-store',signal:AbortSignal.timeout(4000)});
    if(!response.ok)return;
    const raw=await response.json();
    if(!['arena-command-v1','safe-macro-v1'].includes(raw.engine)||(raw.id&&raw.source_hash!==import.meta.env.INTELLIGENCE_SOURCE_HASH)){current=undefined;return;}
    if(raw.id===null&&raw.policy===null){current=undefined;return;}
    const policy=loadIntelligencePolicy(raw.policy);
    if(policy&&/^[a-f0-9]{64}$/.test(raw.id)&&(policy.kind==='arena-actor'||raw.qualification==='qualified'))current={id:raw.id,policy,qualification:raw.qualification,source_hash:raw.source_hash,run_id:raw.run_id,generation:raw.generation};
    else current=undefined;
  } catch { /* Keep the last verified local snapshot during an API outage. */ }
}
