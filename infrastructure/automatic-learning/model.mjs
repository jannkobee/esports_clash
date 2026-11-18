import {createHash} from 'node:crypto';
import {readFileSync,readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {FPS_LEARNING_COMPATIBILITY,createFpsLearningModel,loadFpsLearningModel,applyFpsLearningRound} from '../../EsportsClash.Web/src/fps/fpsLiveLearning.ts';
import {FPS_MECHANICS_COMPATIBILITY,createFpsMechanicsModel,loadFpsMechanicsModel,applyFpsMechanicsRound} from '../../EsportsClash.Web/src/fps/fpsLiveMechanicsLearning.ts';
import {FPS_MOVEMENT_COMPATIBILITY,createFpsMovementModel,loadFpsMovementModel,applyFpsMovementRound} from '../../EsportsClash.Web/src/fps/fpsLiveMovementLearning.ts';
import {seedFpsUtilityBrain} from '../../EsportsClash.Web/src/fps/fpsUtilityBrainStorage.ts';
import {FPS_UTILITY_BRAIN_VERSION} from '../../EsportsClash.Web/src/fps/fpsUtilityBrain.ts';
import {existsSync} from 'node:fs';
import {createFpsTeamPlaybook,loadFpsTeamPlaybook,applyFpsPlaybookRound,createFpsOpponentModel,loadFpsOpponentModel,recordFpsOpponentRound} from '../../EsportsClash.Web/src/fps/fpsLivePlaybook.ts';
import {listLiveMaps} from '../../EsportsClash.Web/src/fps/fpsLiveMapRegistry.ts';
import {validFpsUtilityBundleBrain,applyFpsUtilityExperience,summarizeFpsUtilityBrain} from '../../EsportsClash.Web/src/fps/fpsUtilityLearningExperience.ts';
export const root=fileURLToPath(new URL('../../',import.meta.url));
export const sha=value=>createHash('sha256').update(typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value)).digest('hex');
/**
 * Source hash of the simulation, kept on bundles as provenance only. Compatibility is decided per
 * learner by its own schema/compatibility key (`learnerSchemas`), so editing simulation code no
 * longer invalidates learned models.
 */
export function engineHash(){
  const directory=root+'EsportsClash.Web/src/fps/';
  return sha(readdirSync(directory).filter(n=>n.endsWith('.ts')).sort().map(n=>n+'\n'+readFileSync(directory+n,'utf8')).join('\n'));
}
// The utility brain is optional in v2 bundles (bundles approved before it existed stay valid); the
// built-in baseline uses the committed seed brain, which is also what clients fall back to.
export const learnerSchemas=()=>({navigation:FPS_LEARNING_COMPATIBILITY,combat:FPS_MECHANICS_COMPATIBILITY,movement:FPS_MOVEMENT_COMPATIBILITY,utility:FPS_UTILITY_BRAIN_VERSION});
const LEARNERS={
  navigation:{load:loadFpsLearningModel,create:createFpsLearningModel},
  combat:{load:loadFpsMechanicsModel,create:createFpsMechanicsModel},
  movement:{load:loadFpsMovementModel,create:createFpsMovementModel},
};
export function baseline(){return {version:2,engine:engineHash(),schemas:learnerSchemas(),navigation:createFpsLearningModel(),combat:createFpsMechanicsModel(),movement:createFpsMovementModel(),utility:seedFpsUtilityBrain()};}
/**
 * Explicit per-learner migration. A learner whose checkpoint still validates is kept unchanged; one
 * that no longer validates (its schema changed) is forked from its built-in prior. The caller must
 * archive the original bundle first: nothing is silently reset or lost.
 */
export function migrateBundle(value){
  if(!value||typeof value!=='object')throw Error('Cannot migrate a missing learning bundle');
  const forked=[],bundle={version:2,engine:engineHash(),schemas:learnerSchemas()};
  for(const [kind,learner] of Object.entries(LEARNERS)){
    const loaded=learner.load(value[kind]);
    if(loaded)bundle[kind]=loaded;else{bundle[kind]=learner.create();forked.push(kind);}
  }
  if(value.utility!==undefined&&validFpsUtilityBundleBrain(value.utility))bundle.utility=structuredClone(value.utility);
  else{bundle.utility=seedFpsUtilityBrain();if(value.utility!==undefined)forked.push('utility');}
  // Playbooks migrate per map: a book that no longer validates forks from the seed plays.
  if(value.playbooks&&typeof value.playbooks==='object'){
    bundle.playbooks={};
    for(const [map,book] of Object.entries(value.playbooks)){const loaded=loadFpsTeamPlaybook(book);if(loaded&&loaded.map===map)bundle.playbooks[map]=loaded;else forked.push('playbook:'+map);}
  }
  if(value.opponents!==undefined){const loaded=loadFpsOpponentModel(value.opponents);if(loaded)bundle.opponents=loaded;else forked.push('opponents');}
  return {bundle,forked};
}
export const utilityOf=bundle=>bundle?.utility??seedFpsUtilityBrain();
export const utilitySummary=bundle=>summarizeFpsUtilityBrain(utilityOf(bundle));
export function upgradeTrainingBundle(value){
  if(value?.version===1&&/^[a-f0-9]{64}$/.test(value.engine)){
    const navigation=loadFpsLearningModel(value.navigation),combat=loadFpsMechanicsModel(value.combat);
    if(!navigation||!combat)throw Error('Cannot migrate invalid navigation/combat checkpoints');
    // Preserve validated prior learning; the new movement model starts at its bounded built-in prior.
    return {version:2,engine:engineHash(),navigation,combat,movement:createFpsMovementModel(),utility:seedFpsUtilityBrain()};
  }
  const bundle=validateBundle(value);
  // Training state learns utility too; a v2 bundle from before the utility brain starts from the seed.
  bundle.utility??=seedFpsUtilityBrain();
  return bundle;
}
export function isUntrainedBundle(value){
  return (value?.navigation?.updates??0)===0&&(value?.combat?.updates??0)===0&&(value?.movement?.updates??0)===0
    &&(value?.utility===undefined||sha(value.utility)===sha(seedFpsUtilityBrain()));
}
/** Structural/learner validation. `engine` is provenance only and is not compared. */
export function validateBundle(value){
  if(value?.version!==2||typeof value.engine!=='string'||!/^[a-f0-9]{64}$/.test(value.engine)||!loadFpsLearningModel(value.navigation)||!loadFpsMechanicsModel(value.combat)||!loadFpsMovementModel(value.movement)
    ||(value.utility!==undefined&&!validFpsUtilityBundleBrain(value.utility))||!validPlaybooks(value))throw Error('Incompatible or invalid learning bundle');
  return structuredClone(value);
}
/** Key-order-independent JSON: nothing may be dropped or repaired, but field order does not matter. */
const canonical=value=>Array.isArray(value)?'['+value.map(canonical).join(',')+']'
  :value&&typeof value==='object'?'{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}':JSON.stringify(value);
/** Optional per-map playbooks and the lawful opponent model must load exactly (no repair). */
function validPlaybooks(value){
  if(value.playbooks!==undefined){
    if(!value.playbooks||typeof value.playbooks!=='object'||Array.isArray(value.playbooks))return false;
    for(const [map,book] of Object.entries(value.playbooks)){const loaded=loadFpsTeamPlaybook(book);if(!loaded||loaded.map!==map||canonical(loaded)!==canonical(book))return false;}
  }
  if(value.opponents!==undefined){const loaded=loadFpsOpponentModel(value.opponents);if(!loaded||canonical(loaded)!==canonical(value.opponents))return false;}
  return true;
}
const MAP_IDS=new Set(listLiveMaps().map(m=>m.id));
export function applySample(bundle,record){
  if(record.kind==='navigation')applyFpsLearningRound(bundle.navigation,record.payload);
  else if(record.kind==='combat')applyFpsMechanicsRound(bundle.combat,record.payload);
  else if(record.kind==='movement')applyFpsMovementRound(bundle.movement,record.payload);
  else if(record.kind==='utility')bundle.utility=applyFpsUtilityExperience(structuredClone(utilityOf(bundle)),record.payload);
  else if(record.kind==='playbook'){
    const p=record.payload;
    if(!p||!MAP_IDS.has(p.map)||!p.round||typeof p.round.id!=='string'||!['attack','defense'].includes(p.round.side)||typeof p.round.playId!=='string'||typeof p.round.won!=='boolean')throw Error('Invalid playbook experience');
    bundle.playbooks??={};
    const book=bundle.playbooks[p.map]??=createFpsTeamPlaybook(p.map);
    applyFpsPlaybookRound(book,{id:p.round.id,side:p.round.side,playId:p.round.playId,won:p.round.won,...(typeof p.round.opponent==='string'?{opponent:p.round.opponent}:{}),...(p.round.variant&&typeof p.round.variant==='object'?{variant:p.round.variant}:{})});
    if(p.observed&&typeof p.observed.opponent==='string'){bundle.opponents??=createFpsOpponentModel();recordFpsOpponentRound(bundle.opponents,p.observed.opponent,p.observed.seen);}
  }
  else throw Error('Unknown learner');
}
export const modelsDirectory=()=>process.env.LEARNING_MODELS??root+'EsportsClash.Api/AutomaticLearning/models/';
/**
 * The approved bundle. `registry.json` (append-only promotion/rollback history) takes precedence over
 * the legacy single `active.json` pointer, which stays supported.
 */
export function activeManifest(directory=modelsDirectory()){
  if(existsSync(directory+'registry.json')){
    const registry=JSON.parse(readFileSync(directory+'registry.json','utf8'));
    return registryState(registry).active;
  }
  return JSON.parse(readFileSync(directory+'active.json','utf8'));
}
/** Folds the append-only registry: the last promote/rollback sets the active bundle; pause halts automatic promotion only. */
export function registryState(registry){
  if(registry?.version!==1||!Array.isArray(registry.events))throw Error('Invalid model registry');
  let active={bundle:null,sha256:null},paused=false;const promoted=new Map();
  for(const event of registry.events){
    if(event.action==='promote'){
      if(!/^[a-f0-9]{64}\.json$/.test(event.bundle)||!/^[a-f0-9]{64}$/.test(event.sha256))throw Error('Invalid registry promotion');
      promoted.set(event.bundle,event.sha256);active={bundle:event.bundle,sha256:event.sha256};
    }else if(event.action==='rollback'){
      if(event.bundle===null)active={bundle:null,sha256:null};
      else if(promoted.get(event.bundle)!==event.sha256)throw Error('Rollback target was never promoted');
      else active={bundle:event.bundle,sha256:event.sha256};
    }else if(event.action==='pause')paused=true;
    else if(event.action==='resume')paused=false;
    else throw Error('Unknown registry action');
  }
  return {active,paused,promoted:[...promoted.keys()]};
}
export function approved(){
  const directory=modelsDirectory();
  const manifest=activeManifest(directory);
  if(manifest.bundle===null)return baseline();
  if(!/^[a-f0-9]{64}\.json$/.test(manifest.bundle))throw Error('Invalid active manifest');
  const bytes=readFileSync(directory+manifest.bundle);
  if(sha(bytes)!==manifest.sha256)throw Error('Approved checksum mismatch');
  return validateBundle(JSON.parse(bytes));
}
