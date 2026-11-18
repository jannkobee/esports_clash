import { FPS_LEARNING_COMPATIBILITY, loadFpsLearningModel, createFpsLearningModel, applyFpsLearningRound, type FpsLearningModel, type FpsLearningRound } from './fpsLiveLearning.ts';
import { browserFpsLearningStorage, readStoredFpsModel, saveStoredFpsRound, startNewFpsLearningSlot, type FpsLearningStorage } from './fpsLearningCache.ts';

export { browserFpsLearningStorage, type FpsLearningStorage };
export const FPS_LEARNING_STORAGE_KEY=`hexatrick:fps-learning:v1:${FPS_LEARNING_COMPATIBILITY}`;
export function readFpsLearning(storage=browserFpsLearningStorage()):FpsLearningModel|undefined {
  return readStoredFpsModel(storage,FPS_LEARNING_STORAGE_KEY,loadFpsLearningModel);
}
/** Merge completed experience onto the latest saved model, without mutating the
 * checkpoint pinned to a running match. The round ID prevents duplicate commits. */
export function saveFpsLearningRound(round:FpsLearningRound,storage=browserFpsLearningStorage()):FpsLearningModel|undefined {
  return saveStoredFpsRound(storage,FPS_LEARNING_STORAGE_KEY,loadFpsLearningModel,createFpsLearningModel,applyFpsLearningRound,round);
}
/** Starts a new local experiment; the previous local model is kept under a dated slot key. */
export function resetFpsLearning(storage=browserFpsLearningStorage()):void {startNewFpsLearningSlot(storage,FPS_LEARNING_STORAGE_KEY);}
