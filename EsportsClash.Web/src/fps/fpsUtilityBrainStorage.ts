import seed from './fps-utility-brain.json' with { type: 'json' };
import { createFpsUtilityBrain, loadFpsUtilityBrain, FPS_UTILITY_BRAIN_VERSION, type FpsUtilityBrain } from './fpsUtilityBrain.ts';
import { browserFpsLearningStorage, readStoredFpsModel, startNewFpsLearningSlot, type FpsLearningStorage } from './fpsLearningCache.ts';

export const FPS_UTILITY_BRAIN_STORAGE_KEY = `hexatrick:fps-utility-brain:v${FPS_UTILITY_BRAIN_VERSION}`;

/** The committed starting brain (src/fps/fps-utility-brain.json), grown offline by scripts/train-utility-brain.mjs. */
export function seedFpsUtilityBrain(): FpsUtilityBrain {
  return loadFpsUtilityBrain(seed) ?? createFpsUtilityBrain();
}
/** This browser's brain, falling back to the committed seed (an unreadable store is quarantined, not dropped). */
export function readFpsUtilityBrain(storage: FpsLearningStorage | undefined = browserFpsLearningStorage()): FpsUtilityBrain {
  return readStoredFpsModel(storage, FPS_UTILITY_BRAIN_STORAGE_KEY, loadFpsUtilityBrain) ?? seedFpsUtilityBrain();
}
export function saveFpsUtilityBrain(brain: FpsUtilityBrain, storage: FpsLearningStorage | undefined = browserFpsLearningStorage()): void {
  try { storage?.setItem(FPS_UTILITY_BRAIN_STORAGE_KEY, JSON.stringify(brain)); } catch { /* Local persistence is optional. */ }
}
/** Starts a new local experiment from the seed; the previous local brain is kept under a dated slot key. */
export function resetFpsUtilityBrain(storage: FpsLearningStorage | undefined = browserFpsLearningStorage()): void {
  startNewFpsLearningSlot(storage, FPS_UTILITY_BRAIN_STORAGE_KEY);
}
