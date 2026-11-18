import {loadFpsLearningModel} from './fpsLiveLearning.ts';
import {loadFpsMechanicsModel} from './fpsLiveMechanicsLearning.ts';
import {loadFpsMovementModel} from './fpsLiveMovementLearning.ts';
import {loadFpsUtilityBrain} from './fpsUtilityBrain.ts';
import {browserFpsLearningStorage,hydrateFpsLearningStorage} from './fpsLearningCache.ts';
import {loadFpsOpponentModel,loadFpsTeamPlaybook,type FpsOpponentModel,type FpsTeamPlaybook} from './fpsLivePlaybook.ts';
const key='hexatrick:approved-fps-bundle:v2';
export function compatibleApproved(raw:unknown){
  if(!raw||typeof raw!=='object')return;
  const value=raw as {version?:number;navigation?:unknown;combat?:unknown;movement?:unknown;utility?:unknown;playbooks?:Record<string,unknown>;opponents?:unknown};
  if(value.version!==2)return;
  const navigation=loadFpsLearningModel(value.navigation),combat=loadFpsMechanicsModel(value.combat),movement=loadFpsMovementModel(value.movement);
  // Utility brain, playbooks and opponent model are optional so older bundles stay valid; an invalid
  // playbook is simply not used (the archetype choosers then run as before).
  const playbooks:Record<string,FpsTeamPlaybook>={};
  if(value.playbooks&&typeof value.playbooks==='object')for(const [map,book] of Object.entries(value.playbooks)){const loaded=loadFpsTeamPlaybook(book);if(loaded&&loaded.map===map)playbooks[map]=loaded;}
  const opponents:FpsOpponentModel|undefined=loadFpsOpponentModel(value.opponents);
  if(navigation&&combat&&movement)return {navigation,combat,movement,utility:loadFpsUtilityBrain(value.utility),playbooks,...(opponents?{opponents}:{})};
}
export type FpsApprovedModels=NonNullable<ReturnType<typeof compatibleApproved>>;
const apiBase=()=>(import.meta.env?.VITE_API_URL??'/backend/api/v1').replace(/\/$/,'');
export async function fetchApprovedLearning(){
  let cached:unknown;
  try{cached=JSON.parse(localStorage.getItem(key)??'null');}catch{/* Optional storage. */}
  try{
    const response=await fetch(apiBase()+'/automatic-learning/approved',{signal:AbortSignal.timeout(5000),cache:'no-store'});
    if(!response.ok)throw Error('Model unavailable');
    const value=await response.json();
    if(value.bundle===null){try{localStorage.removeItem(key);}catch{}return undefined;}
    const bundle=compatibleApproved(value.bundle);if(!bundle)throw Error('Incompatible model');
    try{localStorage.setItem(key,JSON.stringify(value.bundle));}catch{}
    return bundle;
  }catch{return compatibleApproved(cached);}
}

/** A team's learned state at match start: its lineage's current versions (server source of truth). */
export interface FpsTeamLearning {
  lineage:string;
  /** Learned models for this team, or the approved/built-in fallback when the lineage has none. */
  models?:FpsApprovedModels;
  /** Raw playbook/opponent payloads, validated by their own loaders where used. */
  playbook?:unknown;opponents?:unknown;
  versions:Partial<Record<'bundle'|'utility'|'playbook'|'opponents',number>>;
  source:'server'|'cache'|'approved';
}
export const FPS_LINEAGE_KEY_PATTERN=/^(club:[0-9]{1,18}|worker:[a-z0-9-]{1,60}|exhibition:[a-z0-9-]{1,60})$/;
export const fpsClubLineageKey=(clubId:number|string)=>`club:${clubId}`;
const lineageCacheKey=(lineage:string)=>`hexatrick:fps-lineage:v1:${lineage}`;

/** Parse a `/fps/lineages/{key}/current` response into this team's models. */
export function teamLearningFromLineage(lineage:string,raw:unknown,fallback?:FpsApprovedModels,source:FpsTeamLearning['source']='server'):FpsTeamLearning {
  const kinds=(raw&&typeof raw==='object'?(raw as {kinds?:Record<string,{version?:number;payload?:unknown}>}).kinds:undefined)??{};
  const versions:FpsTeamLearning['versions']={};
  for(const kind of ['bundle','utility','playbook','opponents'] as const)if(typeof kinds[kind]?.version==='number')versions[kind]=kinds[kind].version;
  const bundle=compatibleApproved(kinds.bundle?.payload);
  const utility=loadFpsUtilityBrain(kinds.utility?.payload);
  const base=bundle??fallback;
  const models=base?{...base,utility:utility??base.utility}:undefined;
  if(!bundle&&!utility&&kinds.playbook===undefined&&kinds.opponents===undefined)return {lineage,models:fallback,versions,source:'approved'};
  return {lineage,models,playbook:kinds.playbook?.payload,opponents:kinds.opponents?.payload,versions,source};
}

/**
 * Fetch one team's lineage once at match start and pin it for the match. Network failure uses the
 * last cached copy of that lineage, then the approved bundle (`fallback`).
 */
export async function fetchTeamLearning(lineage:string,fallback?:FpsApprovedModels):Promise<FpsTeamLearning> {
  if(!FPS_LINEAGE_KEY_PATTERN.test(lineage))return {lineage,models:fallback,versions:{},source:'approved'};
  await hydrateFpsLearningStorage();
  const storage=browserFpsLearningStorage();
  try{
    const response=await fetch(`${apiBase()}/fps/lineages/${encodeURIComponent(lineage)}/current`,{signal:AbortSignal.timeout(5000),cache:'no-store'});
    if(!response.ok)throw Error('Lineage unavailable');
    const text=await response.text();
    const learning=teamLearningFromLineage(lineage,JSON.parse(text),fallback);
    try{storage?.setItem(lineageCacheKey(lineage),text);}catch{/* cache only */}
    return learning;
  }catch{
    try{const cached=storage?.getItem(lineageCacheKey(lineage));if(cached)return teamLearningFromLineage(lineage,JSON.parse(cached),fallback,'cache');}catch{/* fall through */}
    return {lineage,models:fallback,versions:{},source:'approved'};
  }
}
