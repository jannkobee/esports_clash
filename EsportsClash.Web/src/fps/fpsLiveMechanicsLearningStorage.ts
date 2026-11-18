import { FPS_MECHANICS_COMPATIBILITY, applyFpsMechanicsRound, createFpsMechanicsModel, loadFpsMechanicsModel, type FpsMechanicsModel, type FpsMechanicsRound } from './fpsLiveMechanicsLearning.ts';
import { browserFpsLearningStorage, readStoredFpsModel, saveStoredFpsRound, startNewFpsLearningSlot, type FpsLearningStorage } from './fpsLearningCache.ts';

export const FPS_MECHANICS_STORAGE_KEY=`hexatrick:fps-combat-learning:v1:${FPS_MECHANICS_COMPATIBILITY}`;
export function readFpsMechanicsLearning(storage:FpsLearningStorage|undefined=browserFpsLearningStorage()):FpsMechanicsModel|undefined {
  return readStoredFpsModel(storage,FPS_MECHANICS_STORAGE_KEY,loadFpsMechanicsModel);
}
export function saveFpsMechanicsRound(round:FpsMechanicsRound,storage:FpsLearningStorage|undefined=browserFpsLearningStorage()):FpsMechanicsModel|undefined {
  return saveStoredFpsRound(storage,FPS_MECHANICS_STORAGE_KEY,loadFpsMechanicsModel,createFpsMechanicsModel,applyFpsMechanicsRound,round);
}
/** Starts a new local experiment; the previous local model is kept under a dated slot key. */
export function resetFpsMechanicsLearning(storage:FpsLearningStorage|undefined=browserFpsLearningStorage()):void {startNewFpsLearningSlot(storage,FPS_MECHANICS_STORAGE_KEY);}
