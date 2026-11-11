import { FPS_LEARNING_COMPATIBILITY, loadFpsLearningModel, createFpsLearningModel, applyFpsLearningRound, type FpsLearningModel, type FpsLearningRound } from './fpsLiveLearning.ts';

export const FPS_LEARNING_STORAGE_KEY=`hexatrick:fps-learning:v1:${FPS_LEARNING_COMPATIBILITY}`;
export interface FpsLearningStorage {getItem(key:string):string|null;setItem(key:string,value:string):void;removeItem(key:string):void}
export function browserFpsLearningStorage():FpsLearningStorage|undefined {try{return typeof window==='undefined'?undefined:window.localStorage;}catch{return;}}
export function readFpsLearning(storage=browserFpsLearningStorage()):FpsLearningModel|undefined {
  try{const text=storage?.getItem(FPS_LEARNING_STORAGE_KEY);return text&&text.length<100000?loadFpsLearningModel(JSON.parse(text)):undefined;}catch{return;}
}
/** Merge completed experience onto the latest saved model, without mutating the
 * checkpoint pinned to a running match. The round ID prevents duplicate commits. */
export function saveFpsLearningRound(round:FpsLearningRound,storage=browserFpsLearningStorage()):FpsLearningModel|undefined {
  if(!storage)return;
  try{const model=readFpsLearning(storage)??createFpsLearningModel();applyFpsLearningRound(model,round);storage.setItem(FPS_LEARNING_STORAGE_KEY,JSON.stringify(model));return model;}catch{return;}
}
export function resetFpsLearning(storage=browserFpsLearningStorage()):void {try{storage?.removeItem(FPS_LEARNING_STORAGE_KEY);}catch{/* Storage is optional. */}}
