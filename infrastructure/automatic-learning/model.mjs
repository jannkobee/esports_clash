import {createHash} from 'node:crypto';
import {readFileSync,readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createFpsLearningModel,loadFpsLearningModel,applyFpsLearningRound} from '../../EsportsClash.Web/src/fps/fpsLiveLearning.ts';
import {createFpsMechanicsModel,loadFpsMechanicsModel,applyFpsMechanicsRound} from '../../EsportsClash.Web/src/fps/fpsLiveMechanicsLearning.ts';
export const root=fileURLToPath(new URL('../../',import.meta.url));
export const sha=value=>createHash('sha256').update(typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value)).digest('hex');
export function engineHash(){
  const directory=root+'EsportsClash.Web/src/fps/';
  return sha(readdirSync(directory).filter(n=>n.endsWith('.ts')).sort().map(n=>n+'\n'+readFileSync(directory+n,'utf8')).join('\n'));
}
export function baseline(){return {version:1,engine:engineHash(),navigation:createFpsLearningModel(),combat:createFpsMechanicsModel()};}
export function validateBundle(value,engine=engineHash()){
  if(value?.version!==1||value.engine!==engine||!loadFpsLearningModel(value.navigation)||!loadFpsMechanicsModel(value.combat))throw Error('Incompatible or invalid learning bundle');
  return structuredClone(value);
}
export function applySample(bundle,record){
  if(record.kind==='navigation')applyFpsLearningRound(bundle.navigation,record.payload);
  else if(record.kind==='combat')applyFpsMechanicsRound(bundle.combat,record.payload);
  else throw Error('Unknown learner');
}
export function approved(){
  const directory=root+'EsportsClash.Api/AutomaticLearning/models/';
  const manifest=JSON.parse(readFileSync(directory+'active.json','utf8'));
  if(manifest.bundle===null)return baseline();
  if(!/^[a-f0-9]{64}\.json$/.test(manifest.bundle))throw Error('Invalid active manifest');
  const bytes=readFileSync(directory+manifest.bundle);
  if(sha(bytes)!==manifest.sha256)throw Error('Approved checksum mismatch');
  return validateBundle(JSON.parse(bytes));
}
