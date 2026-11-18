import {FPS_UTILITY_BRAIN_LIMITS, FPS_UTILITY_BRAIN_VERSION, consolidateFpsUtilityBrain, createFpsUtilityBrain, loadFpsUtilityBrain, type FpsUtilityBrain, type FpsUtilitySpot, type FpsUtilityThrowMemory} from './fpsUtilityBrain.ts';

/**
 * Utility-brain experience for the automatic-learning worker and approved bundles.
 *
 * The utility learner is shared by both teams of a simulation, so a round's experience is the change
 * it made to the brain: changed/added throw memories and launch spots (in the learner's own
 * most-recently-used order) plus keys that left the working set (archived on replay, never dropped). Replaying the deltas in order rebuilds the learner's brain
 * exactly, without storing a full brain for every round.
 */

/** Same bound as the browser copy (fpsUtilityBrainStorage.ts). */
export const FPS_UTILITY_BUNDLE_MAX_BYTES = 8000000;
const MAX_SPOTS = 200;
const MAX_ROUND_THROWS = 10000;

export interface FpsUtilityExperience {
  id: string;
  /** Throws and on-target smokes scored this round. */
  throws: number;
  successes: number;
  entries: Record<string, FpsUtilityThrowMemory>;
  spots: Record<string, FpsUtilitySpot>;
  removedEntries: string[];
  removedSpots: string[];
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical((value as Record<string, unknown>)[key])).join(',') + '}';
  return JSON.stringify(value);
}

/**
 * Strict validator for a brain inside an approved or training bundle: it must already be in the
 * loader's canonical form (nothing dropped or repaired) and within the size bound.
 */
export function validFpsUtilityBundleBrain(raw: unknown): FpsUtilityBrain | undefined {
  let text: string;
  try { text = JSON.stringify(raw); } catch { return; }
  if (!text || text.length > FPS_UTILITY_BUNDLE_MAX_BYTES) return;
  const brain = loadFpsUtilityBrain(raw);
  if (!brain || canonical(brain) !== canonical(raw)) return;
  return brain;
}

const keysOf = (value: object) => Object.keys(value);

/** The change one round made to the shared brain. */
export function diffFpsUtilityBrain(id: string, before: FpsUtilityBrain | undefined, after: FpsUtilityBrain): FpsUtilityExperience {
  const previous = before ?? createFpsUtilityBrain();
  const changed = <T>(from: Record<string, T>, to: Record<string, T>) => {
    // Keys keep the learner's most-recently-used order (a changed memory is re-inserted last). The
    // longest leading run of untouched keys that is still in its original order stays in place; every
    // key after it is replayed (deleted and re-appended), so the receiving brain ends in the same order
    // and later evicts the same memories.
    const out: Record<string, T> = {};
    const fromKeys = keysOf(from), toKeys = keysOf(to);
    const position = new Map(fromKeys.map((key, index) => [key, index]));
    let last = -1, moved = false;
    for (const key of toKeys) {
      const index = position.get(key);
      if (!moved && (index === undefined || index < last || canonical(from[key]) !== canonical(to[key]))) moved = true;
      if (moved) out[key] = to[key]; else last = index!;
    }
    return {out, removed: fromKeys.filter(key => !(key in to))};
  };
  const entries = changed(previous.entries, after.entries), spots = changed(previous.spots, after.spots);
  return {id, throws: Math.max(0, after.throws - previous.throws), successes: Math.max(0, after.successes - previous.successes),
    entries: entries.out, spots: spots.out, removedEntries: entries.removed, removedSpots: spots.removed};
}

const count = (v: unknown, max: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= max;
const keyList = (v: unknown, max: number): v is string[] => Array.isArray(v) && v.length <= max && v.every(k => typeof k === 'string' && k.length > 0 && k.length <= 120);

/** Validates an untrusted experience record; any malformed memory rejects the whole record. */
export function loadFpsUtilityExperience(raw: unknown): FpsUtilityExperience | undefined {
  if (!raw || typeof raw !== 'object') return;
  const value = raw as Partial<FpsUtilityExperience>;
  if (typeof value.id !== 'string' || !value.id || value.id.length > 128) return;
  if (!count(value.throws, MAX_ROUND_THROWS) || !count(value.successes, value.throws)) return;
  if (!value.entries || typeof value.entries !== 'object' || Array.isArray(value.entries)) return;
  if (!value.spots || typeof value.spots !== 'object' || Array.isArray(value.spots)) return;
  if (!keyList(value.removedEntries, FPS_UTILITY_BRAIN_LIMITS.entries * 2) || !keyList(value.removedSpots, MAX_SPOTS * 2)) return;
  const entryKeys = keysOf(value.entries), spotKeys = keysOf(value.spots);
  if (entryKeys.length > FPS_UTILITY_BRAIN_LIMITS.entries || spotKeys.length > MAX_SPOTS) return;
  const probe = loadFpsUtilityBrain({version: FPS_UTILITY_BRAIN_VERSION, revision: 0, throws: 0, successes: 0, entries: value.entries, spots: value.spots});
  if (!probe || keysOf(probe.entries).length !== entryKeys.length || keysOf(probe.spots).length !== spotKeys.length) return;
  return {id: value.id, throws: value.throws, successes: value.successes, entries: probe.entries, spots: probe.spots,
    removedEntries: [...value.removedEntries], removedSpots: [...value.removedSpots]};
}

/** Applies one round of experience in place and returns the bounded brain. */
export function applyFpsUtilityExperience(brain: FpsUtilityBrain, raw: unknown): FpsUtilityBrain {
  const experience = loadFpsUtilityExperience(raw);
  if (!experience) throw Error('Invalid utility experience');
  // A memory leaving the working set is archived, never dropped (the learner did the same).
  consolidateFpsUtilityBrain(brain, experience.removedEntries, experience.removedSpots);
  for (const [key, entry] of Object.entries(experience.entries)) {
    delete brain.entries[key]; brain.entries[key] = entry;
    if (brain.archive?.[key]) { delete brain.archive[key]; if (!keysOf(brain.archive).length) delete brain.archive; }
  }
  for (const [key, spot] of Object.entries(experience.spots)) {
    delete brain.spots[key]; brain.spots[key] = spot;
    if (brain.spotArchive?.[key]) { delete brain.spotArchive[key]; if (!keysOf(brain.spotArchive).length) delete brain.spotArchive; }
  }
  consolidateFpsUtilityBrain(brain);
  brain.revision += experience.throws; brain.throws += experience.throws;
  brain.successes = Math.min(brain.throws, brain.successes + experience.successes);
  return brain;
}

/** Owner-facing numbers for reports: how often the brain's smokes landed, and how much it remembers. */
export function summarizeFpsUtilityBrain(brain: FpsUtilityBrain | undefined) {
  if (!brain) return null;
  return {throws: brain.throws, successes: brain.successes, onTargetRate: brain.throws ? brain.successes / brain.throws : null,
    remembered: keysOf(brain.entries).length, spots: keysOf(brain.spots).length,
    archived: keysOf(brain.archive ?? {}).length + keysOf(brain.spotArchive ?? {}).length, aggregated: keysOf(brain.aggregates ?? {}).length};
}
