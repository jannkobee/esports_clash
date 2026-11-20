// Real-match experience: pull finished-match submissions for club lineages from the API, apply them
// with the same learners used in training, and publish each changed club lineage back as a new
// immutable version. Enabled when LEARNING_API_URL and LEARNING_API_TOKEN are set.
import {loadFpsUtilityExperience} from '../../EsportsClash.Web/src/fps/fpsUtilityLearningExperience.ts';
import {modelKey} from './store.mjs';

/** Turn one API experience row into worker records (ids are stable, so the ledger deduplicates). */
export function experienceRecords(row){
  const records=[],lineage=row.lineage,map=row.payload?.map;
  const official=/^worker:official-club-[0-9]{1,18}$/.test(lineage);
  if((!official&&!/^club:[0-9]{1,18}$/.test(lineage))||typeof map!=='string')throw Error('Invalid experience row');
  for(const [i,r] of (row.payload.rounds??[]).entries()){
    const id=`api:${row.id}:play:${i}`;
    records.push({id,kind:'playbook',lineage,payload:{id,map,round:{id,side:r.side,playId:r.play_id,won:r.won,...(r.opponent?{opponent:r.opponent}:{}),...(official&&r.variant?{variant:r.variant}:{})},
      ...(r.opponent&&r.observed?{observed:{opponent:r.opponent,seen:{opponentAttacked:!!r.observed.opponentAttacked,...(r.observed.plantSite?{plantSite:r.observed.plantSite}:{}),
        ...(r.observed.firstBlood?{firstBlood:r.observed.firstBlood}:{}),earlyRush:!!r.observed.earlyRush,slowDefault:!!r.observed.slowDefault,heavyUtility:!!r.observed.heavyUtility,
        saved:!!r.observed.saved,passiveAnchors:!!r.observed.passiveAnchors}}}:{})}});
  }
  for(const [i,u] of (row.payload.utility??[]).entries()){
    const payload=loadFpsUtilityExperience({...u,id:`api:${row.id}:utility:${i}`});
    if(!payload)throw Error('Invalid utility experience');
    records.push({id:payload.id,kind:'utility',lineage,payload});
  }
  return records;
}
/** Apply a batch of rows; a row with an unknown play or invalid delta is skipped whole and reported. */
export function ingestExperience(store,rows){
  const changed=new Set(),rejected=[];
  for(const row of rows){
    try{
      const records=experienceRecords(row);
      store.transaction(()=>{
        for(const record of records)store.appendInTransaction(record,true);
        store.set('experienceToPublish',[...new Set([...(store.get('experienceToPublish')??[]),row.lineage])]);
        store.set('experienceAfter',Math.max(store.get('experienceAfter')??0,row.id));
      });
      changed.add(row.lineage);
    }
    catch(error){
      rejected.push({id:row.id,reason:String(error.message)});
      store.set('experienceAfter',Math.max(store.get('experienceAfter')??0,row.id));
    }
  }
  return {changed:[...changed],rejected};
}
export async function pullAndPublish(store,{url=process.env.LEARNING_API_URL,token=process.env.LEARNING_API_TOKEN,fetchImpl=fetch}={}){
  if(!url||!token)return null;
  const base=url.replace(/\/$/,''),headers={Authorization:`Bearer ${token}`,Accept:'application/json'};
  const response=await fetchImpl(`${base}/fps/lineage-experience?after=${store.get('experienceAfter')??0}`,{headers,signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error('Experience pull failed: '+response.status);
  const {experience=[]}=await response.json();
  const result=ingestExperience(store,experience);
  for(const lineage of store.get('experienceToPublish')??[]){
    const bundle=store.get(modelKey(lineage)),parent=store.snapshotModel('real-match',lineage);
    const body=JSON.stringify({kind:'bundle',payload:JSON.stringify(bundle),origin:'real-match',promote:true,reason:'real-match experience',metrics:{parent}});
    const publish=await fetchImpl(`${base}/fps/lineages/${encodeURIComponent(lineage)}/versions`,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body,signal:AbortSignal.timeout(15000)});
    if(!publish.ok)throw Error(`Publishing ${lineage} failed: ${publish.status}`);
    store.set('experienceToPublish',store.get('experienceToPublish').filter(key=>key!==lineage));
  }
  return result;
}
