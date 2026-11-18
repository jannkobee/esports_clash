import {FPS_MOVEMENT_COMPATIBILITY,applyFpsMovementRound,createFpsMovementModel,loadFpsMovementModel,type FpsMovementModel,type FpsMovementRound} from './fpsLiveMovementLearning.ts';
import {browserFpsLearningStorage,readStoredFpsModel,saveStoredFpsRound,startNewFpsLearningSlot,type FpsLearningStorage} from './fpsLearningCache.ts';

export const FPS_MOVEMENT_STORAGE_KEY=`hexatrick:fps-movement-learning:v1:${FPS_MOVEMENT_COMPATIBILITY}`;
export function readFpsMovementLearning(storage:FpsLearningStorage|undefined=browserFpsLearningStorage()):FpsMovementModel|undefined {
  return readStoredFpsModel(storage,FPS_MOVEMENT_STORAGE_KEY,loadFpsMovementModel);
}
export function saveFpsMovementRound(round:FpsMovementRound,storage:FpsLearningStorage|undefined=browserFpsLearningStorage()):FpsMovementModel|undefined {
  return saveStoredFpsRound(storage,FPS_MOVEMENT_STORAGE_KEY,loadFpsMovementModel,createFpsMovementModel,applyFpsMovementRound,round);
}
/** Starts a new local experiment; the previous local model is kept under a dated slot key. */
export function resetFpsMovementLearning(storage:FpsLearningStorage|undefined=browserFpsLearningStorage()):void {startNewFpsLearningSlot(storage,FPS_MOVEMENT_STORAGE_KEY);}
