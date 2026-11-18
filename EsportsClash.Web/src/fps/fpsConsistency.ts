import { fpsBehaviorPreferences, type FpsPersonality } from './fpsPlayerArchitecture.ts';
import { fpsRated, type FpsRated } from './fpsScale10.ts';

/**
 * Consistency: a hidden per-player capability trait (owner decision, 2026-11-17), not a seventh
 * attribute and not a tendency. Tendencies change decisions only; consistency changes how much a
 * player's execution varies — the spread of their hand noise from shot to shot and their form from
 * match to match. It never adds a deterministic accuracy, damage or reaction bonus.
 *
 * Derived from private DNA and personality, mirrored exactly by the server
 * (FpsPlayerArchitecture::deriveConsistency; shared vectors in tests/Fixtures/fps-tendency-vectors.json):
 *
 *   10 + .30·emotionalStability + .25·(100 − confidenceVolatility) + .15·tacticalDiscipline
 *      + .05·preparationPreference + .15·(100 − pressureSensitivity·100)
 *
 * Weights sum to 0.9, so the result spans 10..100 (clamped, rounded). Managers see only the 1–10
 * level and its label (`fpsConsistencyRated`); the 0–100 number and DNA stay private.
 */
type ConsistencyDna = { emotionalStability: number; confidenceVolatility: number; tacticalDiscipline: number; preparationPreference: number };

export function deriveFpsConsistency(personality: FpsPersonality, dna?: Partial<ConsistencyDna>): number {
  const d: ConsistencyDna = { emotionalStability: 50, confidenceVolatility: 50, tacticalDiscipline: 50, preparationPreference: 50, ...dna };
  const press = fpsBehaviorPreferences(personality).pressureSensitivity * 100;
  const value = 10 + 0.30 * d.emotionalStability + 0.25 * (100 - d.confidenceVolatility) + 0.15 * d.tacticalDiscipline + 0.05 * d.preparationPreference + 0.15 * (100 - press);
  return Math.round(Math.max(0, Math.min(100, value)));
}

/** Manager-facing level: whole number 1–10 with its skill-scale label (see fpsScale10.ts). */
export function fpsConsistencyRated(value: number): FpsRated {
  return fpsRated(value, 'skill');
}
export function fpsConsistencyLabel(value: number): string {
  return fpsConsistencyRated(value).label;
}

/** Bounds of the per-match form roll: noise magnitude varies by at most ±FORM_SPREAD × (1 − consistency). */
export const FPS_FORM_SPREAD = 0.3;

/**
 * Seeded per-match execution form for one player: a multiplier on execution noise magnitude only
 * (1 = usual). Its spread scales with (1 − consistency), so steady players vary little between matches
 * and streaky players have good and bad days. Bounded to [1 − FPS_FORM_SPREAD, 1 + FPS_FORM_SPREAD].
 */
export function fpsMatchFormNoiseScale(consistency01: number, seed: number, playerId: string): number {
  let hash = 2166136261 ^ (seed >>> 0);
  for (const char of `${playerId}:fps-form-v1`) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b) >>> 0;
  hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b) >>> 0;
  const roll = (((hash ^ (hash >>> 16)) >>> 0) / 4294967295) * 2 - 1;
  const spread = FPS_FORM_SPREAD * (1 - Math.max(0, Math.min(1, consistency01)));
  return 1 + roll * spread;
}
