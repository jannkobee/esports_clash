import {FPS_MOVEMENT_COMPATIBILITY,applyFpsMovementRound,createFpsMovementModel,loadFpsMovementModel,type FpsMovementModel,type FpsMovementRound} from './fpsLiveMovementLearning.ts';
import type {FpsLearningStorage} from './fpsLiveLearningStorage.ts';

export const FPS_MOVEMENT_STORAGE_KEY=`hexatrick:fps-movement-learning:v1:${FPS_MOVEMENT_COMPATIBILITY}`;

export function readFpsMovementLearning(storage:FpsLearningStorage|undefined=browserStorage()):FpsMovementModel|undefined {
  try {
    const text=storage?.getItem(FPS_MOVEMENT_STORAGE_KEY);
    return text&&text.length<60000?loadFpsMovementModel(JSON.parse(text)):undefined;
  } catch {return;}
}

function browserStorage():FpsLearningStorage|undefined {
  try {return typeof window==='undefined'?undefined:window.localStorage;} catch {return;}
}

export function saveFpsMovementRound(round:FpsMovementRound,storage:FpsLearningStorage|undefined=browserStorage()):FpsMovementModel|undefined {
  if(!storage)return;
  try {
    const model=readFpsMovementLearning(storage)??createFpsMovementModel();
    applyFpsMovementRound(model,round);storage.setItem(FPS_MOVEMENT_STORAGE_KEY,JSON.stringify(model));return model;
  } catch {return;}
}

export function resetFpsMovementLearning(storage:FpsLearningStorage|undefined=browserStorage()):void {
  try {storage?.removeItem(FPS_MOVEMENT_STORAGE_KEY);} catch {/* Local persistence is optional. */}
}
