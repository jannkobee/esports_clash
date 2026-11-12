import { FPS_MECHANICS_COMPATIBILITY, applyFpsMechanicsRound, createFpsMechanicsModel, loadFpsMechanicsModel, type FpsMechanicsModel, type FpsMechanicsRound } from './fpsLiveMechanicsLearning.ts';
import type { FpsLearningStorage } from './fpsLiveLearningStorage.ts';

export const FPS_MECHANICS_STORAGE_KEY=`hexatrick:fps-combat-learning:v1:${FPS_MECHANICS_COMPATIBILITY}`;
export function readFpsMechanicsLearning(storage: FpsLearningStorage|undefined=browserStorage()):FpsMechanicsModel|undefined {
  try{const text=storage?.getItem(FPS_MECHANICS_STORAGE_KEY);return text&&text.length<30000?loadFpsMechanicsModel(JSON.parse(text)):undefined;}catch{return;}
}
function browserStorage():FpsLearningStorage|undefined {try{return typeof window==='undefined'?undefined:window.localStorage;}catch{return;}}
export function saveFpsMechanicsRound(round:FpsMechanicsRound,storage: FpsLearningStorage|undefined=browserStorage()):FpsMechanicsModel|undefined {
  if(!storage)return;
  try{const model=readFpsMechanicsLearning(storage)??createFpsMechanicsModel();applyFpsMechanicsRound(model,round);storage.setItem(FPS_MECHANICS_STORAGE_KEY,JSON.stringify(model));return model;}catch{return;}
}
export function resetFpsMechanicsLearning(storage: FpsLearningStorage|undefined=browserStorage()):void {try{storage?.removeItem(FPS_MECHANICS_STORAGE_KEY);}catch{/* Local persistence is optional. */}}
