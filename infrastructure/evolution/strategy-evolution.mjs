import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir,open,rename} from 'node:fs/promises';
import {join} from 'node:path';
import {AI_STRATEGY_BOUNDS,DEFAULT_AI_STRATEGY,loadAIStrategyConfig} from '../../EsportsClash.Web/src/aiStrategyConfig.ts';

export const digest=value=>createHash('sha256').update(typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value)).digest('hex');
export const ACCEPTANCE=Object.freeze({version:1,minimumIndependentSeeds:32,minimumDrafts:2,
  confidence:.95,minimumWinDelta:0,maximumExtraTeamDeathCases:0,
  requireTerminal:true,requireRepeatedControls:true,requireHistoricalOpponents:true});
export const configHash=config=>digest(loadAIStrategyConfig(config)??(()=>{throw Error('Invalid strategy configuration');})());

export function observeStrategyPair(plan,item,rawHash,envelope){
  if(envelope.sourceHash!==plan.sourceHash||envelope.candidateHash!==plan.candidateHash
    ||JSON.stringify(envelope.item)!==JSON.stringify(item))throw Error('Raw envelope provenance mismatch');
  const {control:a,repeat:b,challenger:c}=envelope;
  const base={...item,candidateHash:plan.candidateHash,sourceHash:plan.sourceHash,rawHash};
  if(![a,b,c].every(e=>e?.status==='terminal'))return{...base,status:'incomplete'};
  const team=item.swapped?'red':'blue';
  for(const episode of [a,b,c]){
    if(!['blue','red'].includes(episode.result?.winner)||!Array.isArray(episode.result?.stats)
      ||episode.result.stats.length!==10||!episode.states?.at(-1)?.finished
      ||!episode.result.stats.every(u=>['blue','red'].includes(u.team)&&Number.isInteger(u.deaths)&&u.deaths>=0))
      throw Error('Malformed terminal episode');
  }
  const deaths=e=>e.result.stats.filter(u=>u.team===team).reduce((sum,u)=>sum+u.deaths,0);
  return{...base,status:'terminal',controlsMatch:JSON.stringify(a.states)===JSON.stringify(b.states)
    &&JSON.stringify(a.result)===JSON.stringify(b.result),
    winDelta:Number(c.result.winner===team)-Number(a.result.winner===team),teamDeathDelta:deaths(c)-deaths(a)};
}

export async function verifyStrategyArtifacts(rawFolder,evidence){
  for(const row of evidence.observations){
    if(!/^[a-f0-9]{64}$/.test(row.rawHash))throw Error('Invalid evidence filename');
    const bytes=await readFile(join(rawFolder,row.rawHash+'.evidence.json'));
    if(digest(bytes)!==row.rawHash)throw Error('Raw strategy evidence hash mismatch');
    const item=evidence.plan.evaluationCases.find(item=>item.seed===row.seed&&item.draft===row.draft
      &&item.swapped===row.swapped&&item.opponentHash===row.opponentHash);
    if(!item||JSON.stringify(observeStrategyPair(evidence.plan,item,row.rawHash,JSON.parse(bytes)))!==JSON.stringify(row))
      throw Error('Strategy metrics differ from raw matches');
  }
}

/** (1 + lambda) bounded, antithetic parameter proposals. Evaluation RNG is local. */
export function proposeStrategies(incumbent,seed,count=4){
  if(!loadAIStrategyConfig(incumbent)||!Number.isInteger(seed)||seed<1||seed>0xffffffff
    ||!Number.isInteger(count)||count<2||count>16)throw Error('Invalid evolution inputs');
  let state=seed>>>0;
  const random=()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return(state>>>0)/4294967296;};
  const keys=Object.keys(AI_STRATEGY_BOUNDS),out=[],seen=new Set([configHash(incumbent)]);
  for(let attempt=0;out.length<count&&attempt<256;attempt++){
    const direction=Object.fromEntries(keys.map(key=>[key,random()*2-1]));
    for(const sign of [-1,1]){
      const config={...incumbent};
      for(const key of keys){const[low,high]=AI_STRATEGY_BOUNDS[key];
        config[key]=Number(Math.max(low,Math.min(high,incumbent[key]+sign*direction[key]*(high-low)*.25)).toFixed(8));}
      const valid=loadAIStrategyConfig(config);if(!valid)continue;
      const hash=configHash(valid);if(!seen.has(hash)&&out.length<count){seen.add(hash);out.push({hash,config:valid});}
    }
  }
  if(out.length!==count)throw Error('Could not generate a distinct valid population');
  return out;
}

/** Each paired seed is one independent observation, regardless of sides/drafts. */
export function assessStrategy(plan,observations){
  return assessWithRules(plan,observations,ACCEPTANCE);
}
export const ARENA_ACCEPTANCE=Object.freeze({...ACCEPTANCE,version:2,maximumExtraTeamDeathCases:null});
export function assessArena(plan,observations){return assessWithRules(plan,observations,ARENA_ACCEPTANCE);}
function assessWithRules(plan,observations,rules){
  if(JSON.stringify(plan.acceptance)!==JSON.stringify(rules))throw Error('Acceptance contract changed');
  const planned=new Set(plan.evaluationCases.map(c=>`${c.seed}:${c.draft}:${c.swapped}:${c.opponentHash}`));
  if(planned.size!==plan.evaluationCases.length)throw Error('Duplicate planned evaluation world');
  const seen=new Set(),clusters=new Map(),drafts=new Set(),opponents=new Set(),sides={original:[],swapped:[]};let missing=0,unsafe=0,invalid=0;
  const reasons=[];
  if(plan.seedReservationVerified!==true)reasons.push('independent-seed-reservation-unverified');
  for(const row of observations){
    const key=`${row.seed}:${row.draft}:${row.swapped}:${row.opponentHash}`;
    if(!planned.has(key)||seen.has(key))throw Error('Unplanned or duplicate evaluation observation');seen.add(key);
    if(row.status!=='terminal'){missing++;continue;}
    if(row.sourceHash!==plan.sourceHash||row.candidateHash!==plan.candidateHash||row.controlsMatch!==true
      ||![-1,0,1].includes(row.winDelta)||!Number.isInteger(row.teamDeathDelta)
      ||!row.rawHash||!/^[a-f0-9]{64}$/.test(row.rawHash)){invalid++;continue;}
    if(row.teamDeathDelta>0)unsafe++;
    if(!clusters.has(row.seed))clusters.set(row.seed,[]);clusters.get(row.seed).push(row.winDelta);
    sides[row.swapped?'swapped':'original'].push(row.winDelta);
    drafts.add(row.draft);opponents.add(row.opponentHash);
  }
  missing+=planned.size-seen.size;
  const values=[...clusters.values()].map(v=>v.reduce((a,b)=>a+b,0)/v.length);
  const mean=values.length?values.reduce((a,b)=>a+b,0)/values.length:null;
  const radius=values.length?2*Math.sqrt(Math.log(2/(1-ACCEPTANCE.confidence))/(2*values.length)):null;
  if(missing)reasons.push('incomplete-full-matches');
  if(invalid)reasons.push('invalid-or-unstable-evidence');
  const deathGate=rules.maximumExtraTeamDeathCases!==null&&unsafe>rules.maximumExtraTeamDeathCases;
  if(deathGate)reasons.push('team-survival-regression');
  if(values.length<ACCEPTANCE.minimumIndependentSeeds)reasons.push('insufficient-independent-seeds');
  if(drafts.size<ACCEPTANCE.minimumDrafts)reasons.push('insufficient-draft-diversity');
  if([...new Set(plan.evaluationCases.map(c=>c.opponentHash))].some(hash=>!opponents.has(hash)))reasons.push('missing-opponent-coverage');
  if(mean===null||mean-radius<=ACCEPTANCE.minimumWinDelta)reasons.push('improvement-not-established');
  const bySide=Object.fromEntries(Object.entries(sides).map(([key,values])=>[key,{measured:values.length,
    winDelta:values.length?values.reduce((a,b)=>a+b,0)/values.length:null}]));
  const sideRegression=Object.values(bySide).some(side=>side.winDelta!==null&&side.winDelta<0);
  if(sideRegression)reasons.push('side-regression');
  const status=invalid||deathGate||sideRegression||(mean!==null&&mean+radius<0)?'reject':reasons.length?'inconclusive':'promote';
  return{status,reasons,bySide,independentSeeds:values.length,planned:planned.size,measured:[...clusters.values()].reduce((n,rows)=>n+rows.length,0),
    winDelta:mean===null?null:{estimate:mean,lower:Math.max(-1,mean-radius),upper:Math.min(1,mean+radius),
      confidence:ACCEPTANCE.confidence,method:'seed-cluster-hoeffding',assumption:'Independent planned seeds; sides clustered'},
    extraTeamDeathCases:unsafe,productionEligible:false};
}

const immutable=async(path,value)=>{
  const bytes=JSON.stringify(value,null,2)+'\n';
  try{await writeFile(path,bytes,{flag:'wx'});}catch(error){if(error.code!=='EEXIST'||await readFile(path,'utf8')!==bytes)throw error;}
};

/** Internal research champion only. The game never reads this registry.
 * Serialized updates, content-addressed history and append-only rollback audit. */
export async function registry(root,operation){
  await mkdir(join(root,'policies'),{recursive:true});await mkdir(join(root,'events'),{recursive:true});
  const lock=await open(join(root,'.lock'),'wx');
  try{
    const api={
      async current(){
        try{const current=JSON.parse(await readFile(join(root,'champion.json'),'utf8'));
          if(configHash(current.config)!==current.hash)throw Error('Incumbent policy hash mismatch');
          const archived=JSON.parse(await readFile(join(root,'policies',current.hash+'.json'),'utf8'));
          if(JSON.stringify(archived)!==JSON.stringify(current))throw Error('Incumbent archive mismatch');return current;}
        catch(error){if(error.code!=='ENOENT')throw error;const initial={hash:configHash(DEFAULT_AI_STRATEGY),config:DEFAULT_AI_STRATEGY,
          provenance:'Existing hardcoded default; no claimed learned improvement'};
          await immutable(join(root,'policies',initial.hash+'.json'),initial);await immutable(join(root,'champion.json'),initial);return initial;}
      },
      async transition(config,evidence,action='promote',rawFolder){
        const prior=await api.current(),hash=configHash(config);
        if(action==='promote'&&evidence?.assessment?.status!=='promote')throw Error('Unqualified challenger cannot replace incumbent');
        if(!['promote','rollback'].includes(action))throw Error('Invalid registry transition');
        let next;
        if(action==='rollback'){
          next=JSON.parse(await readFile(join(root,'policies',hash+'.json'),'utf8'));
          if(configHash(next.config)!==hash)throw Error('Historical policy hash mismatch');
        }else{
          if(evidence.plan?.candidateHash!==hash||evidence.plan?.incumbentHash!==prior.hash)throw Error('Stale or mismatched promotion evidence');
          if(!rawFolder)throw Error('Promotion requires independently verified raw artifacts');
          await verifyStrategyArtifacts(rawFolder,evidence);
          const recomputed=assessStrategy(evidence.plan,evidence.observations);
          if(recomputed.status!=='promote'||JSON.stringify(recomputed)!==JSON.stringify(evidence.assessment))throw Error('Promotion assessment mismatch');
          next={hash,config,parent:prior.hash,evidenceHash:digest(evidence)};
          await immutable(join(root,'policies',hash+'.json'),next);
        }
        const event={action,prior:prior.hash,next:hash,evidenceHash:digest(evidence),at:new Date().toISOString()};
        await immutable(join(root,'events',digest(event)+'.json'),event);
        const temporary=join(root,'champion.next');await writeFile(temporary,JSON.stringify(next,null,2)+'\n');
        await rename(temporary,join(root,'champion.json'));return next;
      }
    };
    return await operation(api);
  }finally{await lock.close();await import('node:fs/promises').then(fs=>fs.unlink(join(root,'.lock')));}
}
