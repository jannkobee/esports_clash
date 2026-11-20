import type {FpsPoint} from './fpsSpatialWorld.ts';
import {planLiveSmokes, liveSmokeRequest} from './fpsSmokePlanner.ts';
import type {LiveMapRuntime, LiveSolid} from './fpsLiveMapTypes.ts';
import {LIVE_THROW_PHYSICS, LIVE_UTILITY_FUSES, LIVE_UTILITY_RULES, computeLiveThrowAngles, grenadeHitHorizontalSurface, launchLiveGrenade, liveGrenadeSightline, predictLiveGrenade, stepLiveGrenade, type LiveGrenade, type LiveGrenadeKind, type LiveThrowStyle} from './fpsLiveGrenades.ts';

/**
 * Utility brain: bots calculate their own throws and remember what happened.
 *
 * Nothing here simulates the future. A throw is planned the way a player would plan it: judge the
 * distance and height, look at the buildings and objects in the way, pick a throw that can clear
 * them, and aim. Bounces and rolls are not predicted, so throws can and do fail. After each throw
 * the actual landing is compared with the intended spot and stored; the next throw from the same
 * spot to the same target starts from that correction. Repeated successes are discovered lineups.
 */

export const FPS_UTILITY_BRAIN_VERSION = 1;
export const FPS_UTILITY_BRAIN_LIMITS = Object.freeze({
  entries: 800, maxAimOffset: 9, launchCell: .75, targetCell: 1, successRadius: 2, floorTolerance: .6,
  /** A remembered throw this unreliable is replaced by another throw type. */
  exploreAfterAttempts: 4, exploreBelowSuccessRate: .25,
  /** A throw still closing in (best miss under this) keeps being refined instead of being dropped. */
  closingError: 4, closingAttempts: 7,
});

/**
 * What counts as a good throw for each grenade. Smokes must come to rest near the spot; fire and HE
 * are judged where they first touch the floor; flashes where they pop, which must be in the air near
 * the spot with a clear line of sight down to it.
 */
export const FPS_UTILITY_KIND_RULES: Readonly<Record<LiveGrenadeKind, {successRadius: number; rollback: boolean}>> = Object.freeze({
  smoke: {successRadius: 2, rollback: true},
  flash: {successRadius: 3.5, rollback: false},
  incendiary: {successRadius: 2, rollback: false},
  he: {successRadius: 2.5, rollback: false},
});
/** Flash pop height window above the intended spot's floor. */
export const FPS_FLASH_POP_WINDOW = Object.freeze({min: -.6, max: 6});
const kindOfKey = (key: string): LiveGrenadeKind => {
  const kind = key.split(':')[1];
  return kind === 'flash' || kind === 'incendiary' || kind === 'he' ? kind : 'smoke';
};
/** Height above the floor that a throw is aimed to arrive at; mirrors launchLiveGrenade. */
const arrivalHeight = (kind: LiveGrenadeKind, style: LiveThrowStyle) => kind === 'flash' ? (style === 'underhand' ? .95 : 1.6) : .12;

export interface FpsUtilityThrowMemory {
  style: LiveThrowStyle;
  flight: number;
  /** Learned aim point relative to the intended target. */
  aimDx: number; aimDz: number;
  attempts: number; successes: number;
  /** Planar landing error of the most recent attempt; 99 when it landed on the wrong floor. */
  lastError: number;
  /** Throw types already found unreliable from this spot. */
  rejected: LiveThrowStyle[];
  /** Correction step size; grows while tries improve, shrinks when they get worse. */
  step?: number;
  /** Best on-target-floor attempt so far: its aim offset and its miss. New tries search outward from it. */
  prevAimDx?: number; prevAimDz?: number; bestMissX?: number; bestMissZ?: number;
  /** Corrections from the best aim that fell onto the wrong floor in a row (a lip or ledge is in the way). */
  wrongFloor?: number;
  /** How many different arcs were tried to get past such a lip. */
  flightShifts?: number;
  /** Tries in a row that did not beat the best one. */
  stale?: number;
  /** Throws that sailed past the spot and off its level before any reached it. */
  overshoots?: number;
  /** The best throw kept while other arcs are tried; returned to if none of them does better. */
  anchor?: {aimDx: number; aimDz: number; missX: number; missZ: number; flight: number; error: number};
}
export interface FpsUtilityBrain {
  version: typeof FPS_UTILITY_BRAIN_VERSION;
  revision: number;
  throws: number;
  successes: number;
  entries: Record<string, FpsUtilityThrowMemory>;
  /** Launch spots that produced on-target smokes for a tactical smoke target, discovered by playing. */
  spots: Record<string, FpsUtilitySpot>;
  /**
   * Consolidated memories that left the bounded working set. Nothing learned is deleted: an archived
   * throw keeps its learned style, flight and aim (search scratch fields are dropped) and is revived
   * the next time that throw is used. Present only when non-empty, so older brains stay canonical.
   */
  archive?: Record<string, FpsUtilityThrowMemory>;
  /** Launch spots that left the working set, kept the same way. */
  spotArchive?: Record<string, FpsUtilitySpot>;
  /** Per-target, per-style totals folded from the oldest archived memories once the archive is very large. */
  aggregates?: Record<string, FpsUtilityAggregate>;
}
export interface FpsUtilityAggregate { attempts: number; successes: number; memories: number }
/** Bounds for the consolidated tiers (generous: archived memories cost no per-tick work). */
export const FPS_UTILITY_ARCHIVE_LIMITS = Object.freeze({archive: 20000, spots: 200, spotArchive: 20000});
export interface FpsUtilitySpot { x: number; z: number; level?: FpsPoint['level']; successes: number }

export function createFpsUtilityBrain(): FpsUtilityBrain {
  return {version: FPS_UTILITY_BRAIN_VERSION, revision: 0, throws: 0, successes: 0, entries: {}, spots: {}};
}

/** The learned part of a memory: style, flight, aim and its record (search scratch dropped). */
function compactFpsThrowMemory(e: FpsUtilityThrowMemory): FpsUtilityThrowMemory {
  return {style: e.style, flight: e.flight, aimDx: e.aimDx, aimDz: e.aimDz, attempts: e.attempts, successes: e.successes, lastError: e.lastError, rejected: [...e.rejected]};
}
/** `map:kind:target:style`: the aggregate bucket for a throw key (launch cell folded away). */
function aggregateKey(key: string, style: string): string {
  const [map, kind, rest = ''] = key.split(':');
  return `${map}:${kind}:${rest.split('>')[1] ?? ''}:${style}`;
}
/**
 * Moves throw memories and spots beyond the working-set bounds into the archive (oldest first), and
 * folds the oldest archived memories into per-target totals only when the archive itself is full.
 * Deterministic, so replaying a learner's round deltas reproduces the same tiers.
 */
export function consolidateFpsUtilityBrain(brain: FpsUtilityBrain, evictedEntries: readonly string[] = [], evictedSpots: readonly string[] = []): void {
  const A = FPS_UTILITY_ARCHIVE_LIMITS;
  const archiveEntry = (key: string) => {
    const entry = brain.entries[key];
    if (!entry) return;
    delete brain.entries[key];
    const archive = brain.archive ??= {};
    delete archive[key]; archive[key] = compactFpsThrowMemory(entry);
  };
  const archiveSpot = (key: string) => {
    const spot = brain.spots[key];
    if (!spot) return;
    delete brain.spots[key];
    const archive = brain.spotArchive ??= {};
    const kept = archive[key];
    delete archive[key]; archive[key] = kept && kept.successes > spot.successes ? kept : {...spot};
  };
  for (const key of evictedEntries) archiveEntry(key);
  for (const key of evictedSpots) archiveSpot(key);
  const entryKeys = Object.keys(brain.entries);
  for (const key of entryKeys.slice(0, Math.max(0, entryKeys.length - FPS_UTILITY_BRAIN_LIMITS.entries))) archiveEntry(key);
  const spotKeys = Object.keys(brain.spots);
  for (const key of spotKeys.slice(0, Math.max(0, spotKeys.length - A.spots))) archiveSpot(key);
  if (brain.archive) {
    const keys = Object.keys(brain.archive);
    for (const key of keys.slice(0, Math.max(0, keys.length - A.archive))) {
      const e = brain.archive[key]; delete brain.archive[key];
      const bucket = (brain.aggregates ??= {})[aggregateKey(key, e.style)] ??= {attempts: 0, successes: 0, memories: 0};
      bucket.attempts += e.attempts; bucket.successes += e.successes; bucket.memories++;
    }
    if (!Object.keys(brain.archive).length) delete brain.archive;
  }
  // One spot key per (map, kind, assignment, target): bounded by the maps themselves.
  if (brain.spotArchive && Object.keys(brain.spotArchive).length > A.spotArchive) throw Error('Utility spot archive bound exceeded');
  if (brain.spotArchive && !Object.keys(brain.spotArchive).length) delete brain.spotArchive;
}
/** A working-set memory, or an archived one (learning revives it into the working set). */
export function fpsUtilityMemory(brain: FpsUtilityBrain | undefined, key: string): FpsUtilityThrowMemory | undefined {
  return brain?.entries[key] ?? brain?.archive?.[key];
}
export function fpsUtilitySpot(brain: FpsUtilityBrain | undefined, key: string): FpsUtilitySpot | undefined {
  return brain?.spots[key] ?? brain?.spotArchive?.[key];
}

const STYLES = new Set(Object.keys(LIVE_THROW_PHYSICS));
const finite = (v: unknown, lo: number, hi: number): v is number => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;

/** Validates untrusted stored brains; anything malformed is dropped rather than repaired. */
export function loadFpsUtilityBrain(raw: unknown): FpsUtilityBrain | undefined {
  if (!raw || typeof raw !== 'object') return;
  const value = raw as Partial<FpsUtilityBrain>;
  if (value.version !== FPS_UTILITY_BRAIN_VERSION || !value.entries || typeof value.entries !== 'object') return;
  const brain = createFpsUtilityBrain();
  brain.revision = finite(value.revision, 0, 1e9) ? value.revision : 0;
  brain.throws = finite(value.throws, 0, 1e9) ? value.throws : 0;
  brain.successes = finite(value.successes, 0, brain.throws) ? value.successes : 0;
  for (const [key, entry] of Object.entries(value.entries)) {
    if (key.length > 120 || !entry || typeof entry !== 'object') continue;
    const e = entry as FpsUtilityThrowMemory, max = FPS_UTILITY_BRAIN_LIMITS.maxAimOffset;
    if (!STYLES.has(e.style) || !finite(e.flight, .42, 3.4) || !finite(e.aimDx, -max, max) || !finite(e.aimDz, -max, max)
      || !finite(e.attempts, 1, 1e6) || !finite(e.successes, 0, e.attempts) || !finite(e.lastError, 0, 99)) continue;
    brain.entries[key] = {style: e.style, flight: e.flight, aimDx: e.aimDx, aimDz: e.aimDz, attempts: e.attempts, successes: e.successes,
      lastError: e.lastError, rejected: Array.isArray(e.rejected) ? e.rejected.filter(s => STYLES.has(s)).slice(0, 8) as LiveThrowStyle[] : [],
      ...(finite(e.step, .05, 1) ? {step: e.step} : {}),
      ...(finite(e.wrongFloor, 0, 1e6) ? {wrongFloor: e.wrongFloor} : {}),
      ...(finite(e.flightShifts, 0, 16) ? {flightShifts: e.flightShifts} : {}),
      ...(finite(e.stale, 0, 1e6) ? {stale: e.stale} : {}),
      ...(finite(e.overshoots, 0, 1e6) ? {overshoots: e.overshoots} : {}),
      ...(e.anchor && typeof e.anchor === 'object' && finite(e.anchor.aimDx, -max, max) && finite(e.anchor.aimDz, -max, max) && finite(e.anchor.missX, -50, 50)
        && finite(e.anchor.missZ, -50, 50) && finite(e.anchor.flight, .42, 3.4) && finite(e.anchor.error, 0, 99)
        ? {anchor: {aimDx: e.anchor.aimDx, aimDz: e.anchor.aimDz, missX: e.anchor.missX, missZ: e.anchor.missZ, flight: e.anchor.flight, error: e.anchor.error}} : {}),
      ...(finite(e.prevAimDx, -max, max) && finite(e.prevAimDz, -max, max) && finite(e.bestMissX, -50, 50) && finite(e.bestMissZ, -50, 50)
        ? {prevAimDx: e.prevAimDx, prevAimDz: e.prevAimDz, bestMissX: e.bestMissX, bestMissZ: e.bestMissZ} : {})};
  }
  const loadSpots = (from: unknown, into: Record<string, FpsUtilitySpot>) => {
    if (from && typeof from === 'object') for (const [key, spot] of Object.entries(from)) {
      if (key.length > 120 || !spot || typeof spot !== 'object') continue;
      const v = spot as FpsUtilitySpot;
      if (!finite(v.x, -80, 80) || !finite(v.z, -80, 80) || !finite(v.successes, 1, 1e6)) continue;
      into[key] = {x: v.x, z: v.z, ...(v.level ? {level: v.level} : {}), successes: v.successes};
    }
  };
  loadSpots(value.spots, brain.spots);
  if (value.archive && typeof value.archive === 'object') {
    const archive: Record<string, FpsUtilityThrowMemory> = {}, max = FPS_UTILITY_BRAIN_LIMITS.maxAimOffset;
    for (const [key, entry] of Object.entries(value.archive)) {
      const e = entry as FpsUtilityThrowMemory;
      if (key.length > 120 || !e || typeof e !== 'object' || !STYLES.has(e.style) || !finite(e.flight, .42, 3.4) || !finite(e.aimDx, -max, max) || !finite(e.aimDz, -max, max)
        || !finite(e.attempts, 1, 1e6) || !finite(e.successes, 0, e.attempts) || !finite(e.lastError, 0, 99)) continue;
      archive[key] = compactFpsThrowMemory({...e, rejected: Array.isArray(e.rejected) ? e.rejected.filter(s => STYLES.has(s)).slice(0, 8) as LiveThrowStyle[] : []});
    }
    if (Object.keys(archive).length) brain.archive = archive;
  }
  if (value.spotArchive && typeof value.spotArchive === 'object') {
    const archive: Record<string, FpsUtilitySpot> = {};
    loadSpots(value.spotArchive, archive);
    if (Object.keys(archive).length) brain.spotArchive = archive;
  }
  if (value.aggregates && typeof value.aggregates === 'object') {
    const aggregates: Record<string, FpsUtilityAggregate> = {};
    for (const [key, a] of Object.entries(value.aggregates)) {
      if (key.length > 160 || !a || typeof a !== 'object' || !finite(a.attempts, 0, 1e9) || !finite(a.successes, 0, a.attempts) || !finite(a.memories, 1, 1e9)) continue;
      aggregates[key] = {attempts: a.attempts, successes: a.successes, memories: a.memories};
    }
    if (Object.keys(aggregates).length) brain.aggregates = aggregates;
  }
  // Older or oversized stores are consolidated, never truncated.
  consolidateFpsUtilityBrain(brain);
  return brain;
}

const cell = (v: number, size: number) => Math.round(v / size);
/** One memory per launch spot (75cm) and target spot (1m), per map, utility kind and floor level. */
export function fpsUtilityThrowKey(mapId: string, kind: LiveGrenadeKind, from: FpsPoint, target: FpsPoint): string {
  const L = FPS_UTILITY_BRAIN_LIMITS;
  return `${mapId}:${kind}:${cell(from.x, L.launchCell)},${cell(from.z, L.launchCell)},${from.level ?? ''}>${cell(target.x, L.targetCell)},${cell(target.z, L.targetCell)},${target.level ?? ''}`;
}

/** Best remembered throw from an adjacent launch cell to an adjacent target cell (successes first). */
function nearestFpsThrowMemory(brain: FpsUtilityBrain, mapId: string, kind: LiveGrenadeKind, from: FpsPoint, target: FpsPoint): FpsUtilityThrowMemory | undefined {
  const L = FPS_UTILITY_BRAIN_LIMITS;
  let best: FpsUtilityThrowMemory | undefined, bestScore = -Infinity;
  for (let fx = -1; fx <= 1; fx++) for (let fz = -1; fz <= 1; fz++) for (let tx = -1; tx <= 1; tx++) for (let tz = -1; tz <= 1; tz++) {
    if (!fx && !fz && !tx && !tz) continue;
    const entry = brain.entries[fpsUtilityThrowKey(mapId, kind,
      {x: from.x + fx * L.launchCell, z: from.z + fz * L.launchCell, level: from.level},
      {x: target.x + tx * L.targetCell, z: target.z + tz * L.targetCell, level: target.level})];
    if (!entry || entry.successes === 0) continue;
    const score = entry.successes / entry.attempts - (Math.abs(fx) + Math.abs(fz) + Math.abs(tx) + Math.abs(tz)) * .05;
    if (score > bestScore) { best = entry; bestScore = score; }
  }
  return best;
}

export type FpsThrowSource = 'calculated' | 'remembered' | 'exploring';
export interface FpsThrowPlan {
  key: string;
  style: LiveThrowStyle;
  aimTarget: FpsPoint;
  flightTime: number;
  launchYaw: number;
  launchPitch: number;
  source: FpsThrowSource;
  /** What the thrower judged about the path: open line, arcing over cover, or under an overhang. */
  path: 'open' | 'over-cover' | 'under-overhang';
  distance: number;
}

/** Throw types a player reaches for at each distance. Blocked paths fall through to higher arcs. */
export function fpsThrowStylesForDistance(distance: number): LiveThrowStyle[] {
  if (distance < 8) return ['underhand', 'medium', 'standard', 'overhead'];
  if (distance < 13) return ['medium', 'standard', 'underhand', 'overhead', 'jump'];
  if (distance <= 24) return ['standard', 'overhead', 'medium', 'walk', 'jump'];
  if (distance <= 30) return ['walk', 'overhead', 'jump', 'standard'];
  if (distance <= 36) return ['jump', 'walk-jump', 'walk'];
  return ['walk-jump', 'run-jump', 'jump'];
}

const JUMP_STYLES = new Set<LiveThrowStyle>(['jump', 'crouch-jump', 'walk-jump', 'run-jump']);
/** Release height for a throw type; mirrors how the body releases it in launchLiveGrenade. */
function releaseHeight(style: LiveThrowStyle, height: number, floor: number): number {
  if (style === 'underhand') return Math.max(floor + .35, height - .45);
  if (style === 'medium') return Math.max(floor + .45, height - .22);
  if (style === 'crouch') return Math.max(floor + .1, height - .53);
  if (JUMP_STYLES.has(style)) return Math.max(height + .35, floor + 1.9);
  return height;
}
/** Comfortable flight-time range for each throw type. */
function flightRange(style: LiveThrowStyle, kind: LiveGrenadeKind = 'smoke'): [number, number] {
  // A flash is lobbed so it reaches the spot as the fuse ends, even on short throws.
  if (style === 'underhand') return [.42, kind === 'flash' ? 1.6 : 1.35];
  if (style === 'medium') return [.55, kind === 'flash' ? 1.8 : 1.75];
  if (style === 'overhead') return [1.8, 3.2];
  if (JUMP_STYLES.has(style)) return [1.4, 3.15];
  return [.65, 2.45];
}
function naturalFlight(style: LiveThrowStyle, distance: number): number {
  const phys = LIVE_THROW_PHYSICS[style];
  if (style === 'overhead') return distance / 15 + .25;
  if (JUMP_STYLES.has(style)) return distance / 15.5 + .24;
  return distance / phys.speed + (style === 'underhand' ? .14 : style === 'medium' ? .18 : .22);
}

/** A blocker at path fraction s that the arc must pass either below (bottom) or above (top). */
interface Band { s: number; bottom: number; top: number }

/** Fraction range of the segment from→to that passes over an (expanded) solid's footprint. */
function segmentSpan(from: FpsPoint, to: FpsPoint, w: LiveSolid, pad: number): [number, number] | undefined {
  const dx = to.x - from.x, dz = to.z - from.z;
  let t0 = 0, t1 = 1;
  for (const [o, d, lo, hi] of [[from.x, dx, w.minX - pad, w.maxX + pad], [from.z, dz, w.minZ - pad, w.maxZ + pad]] as const) {
    if (Math.abs(d) < 1e-9) { if (o < lo || o > hi) return; continue; }
    let a = (lo - o) / d, b = (hi - o) / d;
    if (a > b) [a, b] = [b, a];
    t0 = Math.max(t0, a); t1 = Math.min(t1, b);
    if (t0 > t1) return;
  }
  return [t0, t1];
}

/**
 * What a player sees between themselves and the target: each building, wall, awning or roof becomes a
 * band of heights the arc cannot pass through. Only static, visible map geometry is used.
 */
function readPath(from: FpsPoint, to: FpsPoint, runtime: LiveMapRuntime): Band[] {
  const out: Band[] = [];
  // Decks, bridges and platforms the thrower stands on or the smoke lands on are floors, not cover.
  const floorTop = Math.max(runtime.terrain.groundHeight(from), runtime.terrain.groundHeight(to)) + .35;
  for (const w of runtime.collisionSolidsAt(from, to, .3)) {
    if (w.height <= floorTop) continue;
    const span = segmentSpan(from, to, w, .18);
    if (!span) continue;
    // Padding only widens real crossings mid-path: a wall the line never touches that merely sits
    // beside the spot (e.g. Fontessa's B flash point 0.2m off a container corner) is not in the way.
    if (span[1] >= .95 && !segmentSpan(from, to, w, 0)) continue;
    const s0 = Math.max(.02, span[0]), s1 = Math.min(.98, span[1]);
    if (s1 <= s0) continue;
    for (let i = 0; i <= 4; i++) out.push({s: s0 + (s1 - s0) * i / 4, bottom: (w.baseY ?? 0) - .35, top: w.height + .45});
  }
  return out;
}

/**
 * Calculates a throw from distance, height and the blockers in the way. Returns undefined when no
 * throw type the player knows can clear the path within its range.
 */
export function calculateLiveThrow(
  kind: LiveGrenadeKind, from: FpsPoint, target: FpsPoint, height: number, runtime: LiveMapRuntime,
  brain?: FpsUtilityBrain, avoid: readonly LiveThrowStyle[] = [], prefer?: LiveThrowStyle,
): FpsThrowPlan | undefined {
  if (!Number.isFinite(from.x + from.z + target.x + target.z + height)) return;
  const key = fpsUtilityThrowKey(runtime.id, kind, from, target);
  // Standing half a metre off a practised spot should still recall it: fall back to the best neighbour.
  const memory = fpsUtilityMemory(brain, key) ?? (brain ? nearestFpsThrowMemory(brain, runtime.id, kind, from, target) : undefined);
  const L = FPS_UTILITY_BRAIN_LIMITS;
  // Keep refining a throw that is closing in; only abandon one that keeps missing badly.
  // A throw that got close, or is still trying other arcs past a lip, is not given up yet.
  const closing = !!memory && (memory.lastError <= L.closingError && memory.attempts < L.closingAttempts || !!memory.anchor && memory.attempts < L.closingAttempts * 2
    || (memory.overshoots ?? 0) > 0 && (memory.overshoots ?? 0) <= 4 && memory.lastError === 99);
  const unreliable = !!memory && !closing && memory.attempts >= L.exploreAfterAttempts && memory.successes / memory.attempts < L.exploreBelowSuccessRate && memory.lastError > FPS_UTILITY_KIND_RULES[kind].successRadius;
  const rejected = new Set<LiveThrowStyle>([...avoid, ...(memory?.rejected ?? []), ...(unreliable && memory ? [memory.style] : [])]);
  const remembered = (source: FpsThrowSource) => {
    if (!memory) return;
    for (const scale of [1, .75, .5]) {
      const aimTarget = {x: target.x + memory.aimDx * scale, z: target.z + memory.aimDz * scale, level: target.level};
      const plan = planWithStyle(kind, key, memory.style, memory.flight, from, aimTarget, target, height, runtime, source);
      if (plan) return plan;
    }
  };
  if (memory && !rejected.has(memory.style)) {
    const plan = remembered('remembered');
    if (plan) return plan;
  }
  const d = Math.hypot(target.x - from.x, target.z - from.z);
  const styles = fpsThrowStylesForDistance(d);
  // A body position (already airborne, or a deliberate underhand pop) is tried first when it can work.
  const order = prefer && !styles.includes(prefer) ? [prefer, ...styles] : prefer ? [prefer, ...styles.filter(s => s !== prefer)] : styles;
  for (const style of order) {
    if (rejected.has(style)) continue;
    const plan = planWithStyle(kind, key, style, undefined, from, target, target, height, runtime, memory ? 'exploring' : 'calculated');
    if (plan) return plan;
  }
  // Every remembered option failed here: start over rather than never throwing from this spot again.
  // The current memory's own correction is reused, so a restart still learns instead of repeating itself.
  if (memory?.rejected.length) {
    for (const style of styles) {
      if (avoid.includes(style)) continue;
      const plan = style === memory.style ? remembered('exploring') : planWithStyle(kind, key, style, undefined, from, target, target, height, runtime, 'exploring');
      if (plan) return plan;
    }
  }
}

function planWithStyle(
  kind: LiveGrenadeKind, key: string, style: LiveThrowStyle, rememberedFlight: number | undefined, from: FpsPoint, aim: FpsPoint, target: FpsPoint,
  height: number, runtime: LiveMapRuntime, source: FpsThrowSource,
): FpsThrowPlan | undefined {
  // A remembered throw is trusted over the rough blocker estimate: it has actually been thrown.
  const trustExperience = rememberedFlight !== undefined;
  const phys = LIVE_THROW_PHYSICS[style], g = LIVE_UTILITY_RULES.gravity;
  const floor = runtime.terrain.groundHeight(from), y0 = releaseHeight(style, height, floor);
  const targetY = runtime.terrain.groundHeight(target) + arrivalHeight(kind, style);
  const dx = aim.x - from.x, dz = aim.z - from.z, d = Math.hypot(dx, dz);
  if (d < .3) return;
  const reach = phys.maxRange + Math.max(0, (y0 - targetY) * 1.6);
  if (d > reach) return;
  // Remembered flight times may sit outside a style's comfortable range: they were learned by throwing.
  const [lo, styleMax] = trustExperience ? [.42, 3.4] as const : flightRange(style, kind);
  // Fire must reach its landing surface before the airborne expiry. Leave a physics tick
  // for floor contact. A longer saved throw must be recalculated against today's geometry.
  const hi = kind === 'incendiary' ? Math.min(styleMax, LIVE_UTILITY_FUSES.fireAirFuse - 1 / 30) : styleMax;
  if (kind === 'incendiary' && rememberedFlight !== undefined && rememberedFlight > hi) return;
  const bands = readPath(from, aim, runtime);
  // y(s) = y0 + (targetY - y0)s + g T^2 s(1 - s) / 2, rising with flight time T at every s.
  // Each band forbids the flight times whose arc would pass through it at that s.
  const tFor = (y: number, s: number) => Math.sqrt(Math.max(0, 2 * (y - y0 - (targetY - y0) * s) / (g * s * (1 - s))));
  const forbidden = bands.map(band => [tFor(band.bottom, band.s), tFor(band.top, band.s)] as const).filter(([a, b]) => b > a);
  const speedAt = (t: number) => Math.hypot(d / t, (targetY - y0 + .5 * g * t * t) / t);
  const allowed = (t: number) => speedAt(t) <= phys.maxLaunchSpeed && (trustExperience || !forbidden.some(([a, b]) => t > a && t < b));
  // A flash should reach the spot as its fuse runs out, so it pops there in the air.
  // Start fire on the lowest available path and raise it only when the map requires it.
  const defaultTime = kind === 'incendiary' ? lo : kind === 'flash' ? LIVE_UTILITY_FUSES.flashFuse : naturalFlight(style, d);
  const preferred = Math.max(lo, Math.min(hi, rememberedFlight ?? defaultTime));
  let T: number | undefined;
  for (let step = 0; step <= Math.ceil((hi - lo) / .04); step++) {
    for (const t of step === 0 ? [preferred] : [preferred + step * .04, preferred - step * .04]) {
      if (t >= lo - 1e-9 && t <= hi + 1e-9 && allowed(t)) { T = t; break; }
    }
    if (T !== undefined) break;
  }
  if (T === undefined) return;
  const vy = (targetY - y0 + .5 * g * T * T) / T, vh = d / T;
  // Smokes skid after landing; a first attempt aims a little short. Memory replaces this guess.
  // Fire bursts on contact, HE is judged on contact and flashes pop in the air: no rollback.
  const rollback = rememberedFlight === undefined && FPS_UTILITY_KIND_RULES[kind].rollback ? Math.min(2.2, vh * .07) : 0;
  const aimTarget: FpsPoint = {x: aim.x - dx / d * rollback, z: aim.z - dz / d * rollback, level: target.level};
  const angles = computeLiveThrowAngles({vx: dx / d * vh, vy, vz: dz / d * vh});
  const path = forbidden.some(([a]) => T! <= a && a > 0) ? 'under-overhang' : forbidden.some(([, b]) => T! >= b) ? 'over-cover' : 'open';
  return {key, style, aimTarget, flightTime: T, launchYaw: angles.yaw, launchPitch: angles.pitch, source, path, distance: d};
}

export interface FpsThrowOutcome {
  key: string; plan: FpsThrowPlan; intended: FpsPoint; landing: FpsPoint & {y: number}; targetFloor: number;
  /** Where the thrower stood, and the tactical smoke target it served, so working spots are remembered. */
  spot?: FpsPoint; spotKey?: string;
  /**
   * Flashes only: whether the thrower could see the spot from the pop (eye height above it). A pop
   * behind a wall or roof is not a working flash even when it is close.
   */
  sight?: boolean;
  /**
   * Whether the grenade achieved its tactical purpose when judged against real match enemies
   * (e.g., blinded/turned an enemy on a combat flash or dealt damage/displaced on HE/molly).
   * Undefined during solo practice or uncontested throws.
   */
  tacticalAchieved?: boolean;
}
export interface FpsThrowLesson { success: boolean; error: number; onTargetFloor: boolean }

/**
 * Scores one throw for its kind. `landing` is where a smoke came to rest, where fire or HE first
 * touched the floor, or where a flash popped. `onTargetFloor` means it reached the intended level
 * (for a flash: popped in the air window above the spot with sight to it).
 */
export function scoreFpsThrow(kind: LiveGrenadeKind, outcome: Pick<FpsThrowOutcome, 'intended' | 'landing' | 'targetFloor' | 'sight'>): FpsThrowLesson {
  const {intended, landing} = outcome;
  const error = Math.hypot(intended.x - landing.x, intended.z - landing.z), dy = landing.y - outcome.targetFloor;
  const onTargetFloor = kind === 'flash'
    ? dy >= FPS_FLASH_POP_WINDOW.min && dy <= FPS_FLASH_POP_WINDOW.max && outcome.sight !== false
    : Math.abs(dy) <= FPS_UTILITY_BRAIN_LIMITS.floorTolerance + .2;
  return {success: onTargetFloor && error <= FPS_UTILITY_KIND_RULES[kind].successRadius, error, onTargetFloor};
}

/** Learn from where a throw actually landed. Mutates the brain; returns what was learned. */
export function learnFpsThrowOutcome(brain: FpsUtilityBrain, outcome: FpsThrowOutcome): FpsThrowLesson {
  const L = FPS_UTILITY_BRAIN_LIMITS, {plan, intended, landing} = outcome;
  const kind = kindOfKey(outcome.key);
  const ex = intended.x - landing.x, ez = intended.z - landing.z;
  const {success, error, onTargetFloor} = scoreFpsThrow(kind, outcome);
  const successRadius = FPS_UTILITY_KIND_RULES[kind].successRadius;
  let entry = brain.entries[outcome.key];
  if (!entry && brain.archive?.[outcome.key]) {
    // Revive an archived throw into the working set; it continues from what it had learned.
    entry = {...brain.archive[outcome.key], rejected: [...brain.archive[outcome.key].rejected]};
    delete brain.archive[outcome.key];
    if (!Object.keys(brain.archive).length) delete brain.archive;
  }
  const aimDx = plan.aimTarget.x - intended.x, aimDz = plan.aimTarget.z - intended.z;
  if (!entry || entry.style !== plan.style) {
    const rejected = entry ? [...new Set([...entry.rejected, ...(entry.style !== plan.style && entry.successes / entry.attempts < L.exploreBelowSuccessRate ? [entry.style] : [])])] : [];
    entry = {style: plan.style, flight: plan.flightTime, aimDx, aimDz, attempts: 0, successes: 0, lastError: 99, rejected};
  }
  delete brain.entries[outcome.key];
  const prevStale = entry.stale ?? 0, prevStep = entry.step;
  entry.attempts++;
  if (success) entry.successes++;
  const clampOffset = (v: number) => Math.max(-L.maxAimOffset, Math.min(L.maxAimOffset, v));
  const hasBest = entry.prevAimDx !== undefined && entry.prevAimDz !== undefined;
  if (onTargetFloor) {
    entry.wrongFloor = 0;
    if (!hasBest || error < entry.lastError) {
      // Best try so far: keep it, and take bigger steps while tries keep improving.
      entry.prevAimDx = aimDx; entry.prevAimDz = aimDz; entry.bestMissX = ex; entry.bestMissZ = ez; entry.lastError = error;
      entry.step = hasBest ? Math.min(.85, (entry.step ?? .7) * 1.2) : (entry.step ?? .7);
      entry.flight = plan.flightTime;
      entry.stale = 0;
    } else {
      // Worse than the best (bounces are not linear): search closer to what worked.
      entry.step = Math.max(.1, (entry.step ?? .7) * .5);
      entry.stale = (entry.stale ?? 0) + 1;
      // Four tries without beating the best on a bouncy spot: the aim is not the problem, the arc is.
      if (entry.stale >= 4 && entry.lastError > successRadius) {
        if (!entry.anchor || entry.lastError < entry.anchor.error) entry.anchor = {aimDx: entry.prevAimDx!, aimDz: entry.prevAimDz!, missX: entry.bestMissX ?? 0, missZ: entry.bestMissZ ?? 0, flight: entry.flight, error: entry.lastError};
        if ((entry.flightShifts ?? 0) < LIP_PROBES.length) { entry.stale = 0; tryNextArc(entry); }
      }
    }
  } else if (hasBest) {
    // An exploratory try caught a roof or ledge: go back toward the best aim with a smaller step.
    entry.step = Math.max(.1, (entry.step ?? .7) * .5);
    entry.wrongFloor = (entry.wrongFloor ?? 0) + 1;
    // Twice in a row the correction dropped off the target's level: a lip or sill sits between the
    // best throw and the spot, and moving the aim alone cannot pass it.
    if (entry.wrongFloor >= 2 && entry.lastError > successRadius) {
      if (!entry.anchor || entry.lastError < entry.anchor.error) entry.anchor = {aimDx: entry.prevAimDx!, aimDz: entry.prevAimDz!, missX: entry.bestMissX ?? 0, missZ: entry.bestMissZ ?? 0, flight: entry.flight, error: entry.lastError};
      tryNextArc(entry);
    }
  } else if (entry.anchor && (entry.flightShifts ?? 0) < LIP_PROBES.length) {
    // A different arc tried from the best throw never reached the level either: try the next one.
    tryNextArc(entry);
  } else if (entry.anchor) {
    // Out of arcs to try: go back to refining the best throw found.
    const a = entry.anchor;
    entry.prevAimDx = a.aimDx; entry.prevAimDz = a.aimDz; entry.bestMissX = a.missX; entry.bestMissZ = a.missZ; entry.flight = a.flight; entry.lastError = a.error; entry.step = .25;
    delete entry.anchor;
  } else {
    // Never reached the target floor from here. Near the target, something sits over it: flatten the arc.
    // Short of the target, cover is in the way: arc higher. Out of options, drop this throw type.
    entry.lastError = 99;
    const [lo, hi] = flightRange(plan.style, kind);
    // Did it go past the spot (over the level and off its far side) or stop short of it?
    const along = -(ex * Math.sin(plan.launchYaw) + ez * Math.cos(plan.launchYaw));
    if (error >= 3 && along > 1.5) {
      // Sailed past: the player saw where it went, so aim back toward the spot with the same arc.
      entry.aimDx = clampOffset(aimDx + ex * .5); entry.aimDz = clampOffset(aimDz + ez * .5);
      entry.flight = plan.flightTime;
      entry.overshoots = (entry.overshoots ?? 0) + 1;
      if (entry.overshoots > 4) entry.rejected = [...new Set([...entry.rejected, plan.style])];
    } else {
      const next = plan.flightTime + (error < 3 ? -.3 : .3);
      if (next >= lo && next <= hi) entry.flight = next;
      else entry.rejected = [...new Set([...entry.rejected, plan.style])];
    }
  }
  if (entry.prevAimDx !== undefined && entry.prevAimDz !== undefined) {
    // Dead-on throws stay put; otherwise try the best aim moved toward its miss.
    // Once a throw from here has worked, repeat it exactly: bouncy landings punish small changes.
    const step = entry.lastError <= successRadius ? 0 : (entry.step ?? .7);
    entry.aimDx = clampOffset(entry.prevAimDx + (entry.bestMissX ?? 0) * step);
    entry.aimDz = clampOffset(entry.prevAimDz + (entry.bestMissZ ?? 0) * step);
  }
  if (kind === 'flash' && outcome.tacticalAchieved === false) {
    entry.stale = prevStale + 1;
    entry.step = Math.min(1, Math.max(0.25, (prevStep ?? 0.4) * 1.15));
    if (entry.stale >= 3) {
      if (!entry.anchor || entry.lastError < entry.anchor.error) {
        entry.anchor = {
          aimDx: entry.prevAimDx ?? aimDx,
          aimDz: entry.prevAimDz ?? aimDz,
          missX: (entry.bestMissX || ex) || 1.2,
          missZ: (entry.bestMissZ || ez) || 0,
          flight: entry.flight,
          error: entry.lastError,
        };
      }
      const nextStep = entry.step;
      if ((entry.flightShifts ?? 0) < LIP_PROBES.length) {
        tryNextArc(entry);
        entry.step = nextStep;
      }
      if (entry.aimDx === aimDx && entry.aimDz === aimDz) {
        entry.aimDx = clampOffset(aimDx + (entry.anchor.missX || 1.2) * nextStep);
        entry.aimDz = clampOffset(aimDz + (entry.anchor.missZ || 0) * nextStep);
      }
    }
  } else if (outcome.tacticalAchieved === true) {
    entry.stale = 0;
    entry.lastError = Math.min(entry.lastError, 1.2);
    entry.prevAimDx = aimDx;
    entry.prevAimDz = aimDz;
    entry.aimDx = aimDx;
    entry.aimDz = aimDz;
    entry.flight = plan.flightTime;
    delete entry.anchor;
  }
  brain.entries[outcome.key] = entry;
  consolidateFpsUtilityBrain(brain);
  if (success && outcome.spot && outcome.spotKey) rememberFpsThrowSpot(brain, outcome.spotKey, outcome.spot);
  brain.throws++; if (success) brain.successes++; brain.revision++;
  return {success, error, onTargetFloor};
}

/**
 * Arcs a player tries to get past a lip: [flight-time change, how far past the best aim to throw,
 * in units of its miss]. Flatter throws aimed long come back off a far wall into a window or under
 * an awning; higher ones drop over a ledge.
 */
const LIP_PROBES: readonly (readonly [number, number])[] = [[-.3, 0], [-.3, 1], [-.55, 1.5], [.3, 0], [-.55, 0], [.55, 0], [-.8, 1.5], [-.3, 2]];
function tryNextArc(entry: FpsUtilityThrowMemory): void {
  const a = entry.anchor!, shifts = entry.flightShifts ?? 0, [delta, push] = LIP_PROBES[shifts], max = FPS_UTILITY_BRAIN_LIMITS.maxAimOffset;
  entry.flightShifts = shifts + 1;
  entry.flight = Math.max(.45, Math.min(3.3, a.flight + delta));
  entry.aimDx = Math.max(-max, Math.min(max, a.aimDx - a.missX * push));
  entry.aimDz = Math.max(-max, Math.min(max, a.aimDz - a.missZ * push));
  entry.wrongFloor = 0; entry.step = .7; entry.lastError = 99;
  // The new arc lands differently: its first on-level try becomes the new best to search from.
  delete entry.prevAimDx; delete entry.prevAimDz; delete entry.bestMissX; delete entry.bestMissZ;
}

export interface FpsUtilityLearningOptions { mode?: 'learn' | 'frozen'; model?: unknown; onRound?: (brain: FpsUtilityBrain) => void }
export interface FpsUtilityLearningStats { revision: number; throws: number; successes: number; remembered: number; thisMatch: {throws: number; successes: number; remembered: number; discovered: number; kinds: Partial<Record<LiveGrenadeKind, {throws: number; successes: number}>>} }

/** Per-simulation learner. Frozen mode plans from the brain but never changes it. */
export class FpsUtilityLearner {
  readonly brain: FpsUtilityBrain;
  readonly options: FpsUtilityLearningOptions;
  private match = {throws: 0, successes: 0, remembered: 0, discovered: 0, kinds: {} as Partial<Record<LiveGrenadeKind, {throws: number; successes: number}>>};
  private changed = false;
  constructor(options: FpsUtilityLearningOptions = {}) {
    this.options = options;
    this.brain = loadFpsUtilityBrain(options.model) ?? createFpsUtilityBrain();
  }
  plan(kind: LiveGrenadeKind, from: FpsPoint, target: FpsPoint, height: number, runtime: LiveMapRuntime, avoid?: readonly LiveThrowStyle[], prefer?: LiveThrowStyle): FpsThrowPlan | undefined {
    return calculateLiveThrow(kind, from, target, height, runtime, this.brain, avoid, prefer);
  }
  /** Score the throw; in learn mode the correction is stored immediately so the next throw benefits. */
  record(outcome: FpsThrowOutcome): FpsThrowLesson {
    const before = fpsUtilityMemory(this.brain, outcome.key);
    const firstSuccess = !before || before.successes === 0;
    const lesson = this.options.mode === 'frozen' ? scoreOnly(outcome) : learnFpsThrowOutcome(this.brain, outcome);
    this.match.throws++;
    if (lesson.success) this.match.successes++;
    const byKind = this.match.kinds[kindOfKey(outcome.key)] ??= {throws: 0, successes: 0};
    byKind.throws++; if (lesson.success) byKind.successes++;
    if (outcome.plan.source === 'remembered') this.match.remembered++;
    if (lesson.success && firstSuccess) this.match.discovered++;
    if (this.options.mode !== 'frozen') this.changed = true;
    return lesson;
  }
  completeRound(): void {
    if (!this.changed) return;
    this.changed = false;
    try { this.options.onRound?.(this.checkpoint()); } catch { /* Persistence is optional and must not interrupt a round. */ }
  }
  checkpoint(): FpsUtilityBrain { return loadFpsUtilityBrain(this.brain)!; }
  stats(): FpsUtilityLearningStats {
    return {revision: this.brain.revision, throws: this.brain.throws, successes: this.brain.successes, remembered: Object.keys(this.brain.entries).length, thisMatch: {...this.match, kinds: Object.fromEntries(Object.entries(this.match.kinds).map(([k, v]) => [k, {...v}]))}};
  }
}
function scoreOnly(outcome: FpsThrowOutcome): FpsThrowLesson {
  return scoreFpsThrow(kindOfKey(outcome.key), outcome);
}

/**
 * Where the thrower expects the grenade to go off, from their own plan only (no flight simulation):
 * a smoke, fire or HE at the intended spot's floor; a flash along its planned arc when the fuse ends.
 * Used for teammate-safety checks, which therefore share the thrower's blind spots about bounces.
 */
export function fpsBelievedDetonation(kind: LiveGrenadeKind, plan: FpsThrowPlan, from: FpsPoint, intended: FpsPoint, height: number, runtime: LiveMapRuntime): LiveGrenade {
  const floorAt = runtime.terrain.groundHeight(intended);
  let x = intended.x, z = intended.z, y = floorAt + .09;
  if (kind === 'flash') {
    const T = plan.flightTime, s = Math.min(1, LIVE_UTILITY_FUSES.flashFuse / Math.max(.2, T));
    const y0 = releaseHeight(plan.style, height, runtime.terrain.groundHeight(from)), y1 = floorAt + arrivalHeight('flash', plan.style);
    x = from.x + (intended.x - from.x) * s; z = from.z + (intended.z - from.z) * s;
    y = s >= 1 ? y1 : y0 + (y1 - y0) * s + LIVE_UTILITY_RULES.gravity * T * T * s * (1 - s) / 2;
  }
  return {id: -1, kind, actorId: '', team: 'blue', x, y, z, level: intended.level, vx: 0, vy: 0, vz: 0, releaseAt: 0, detonateAt: 0, coordinated: false};
}

export interface FpsFlashAllyEye {x: number; z: number; yaw: number; crouch?: boolean; jumpY?: number}
/**
 * Pop-flash teammate safety (same rule the pop-flash solver used): a busy teammate within 12m who can
 * see the expected pop and faces it would be blinded. Returns a hazard score; 18 or more refuses the throw.
 */
export function fpsFlashAllyHazard(pop: FpsPoint & {y: number}, allies: readonly FpsFlashAllyEye[], runtime: LiveMapRuntime): number {
  let hazard = 0;
  for (const a of allies) {
    const eyeY = runtime.terrain.groundHeight(a) + (a.crouch ? 1.08 : 1.6) + (a.jumpY ?? 0);
    const allyDist = Math.hypot(Math.hypot(a.x - pop.x, a.z - pop.z), pop.y - eyeY);
    if (allyDist >= 12 || !liveGrenadeSightline(pop, {x: a.x, y: eyeY, z: a.z}, runtime)) continue;
    const facing = Math.cos(Math.atan2(pop.x - a.x, pop.z - a.z) - a.yaw);
    if (facing > .25) hazard += (facing > .45 ? 28 : 18) * facing;
  }
  return hazard;
}
export const FPS_FLASH_ALLY_HAZARD_LIMIT = 18;

export interface FpsPopFlashCandidateScore {
  range: number;
  occludedCount: number;
  surpriseBonus: number;
  effectiveScore: number;
}
/**
 * Evaluates a candidate flash pop point thrown from `from` against a believed `enemyEye`.
 * Rewards true pop-flashes whose early/mid flight is occluded from the enemy's sightline so the
 * flash only emerges near detonation (`< 0.25s` to react).
 */
export function scoreFpsPopFlashCandidate(
  from: FpsPoint & {y?: number; handY?: number},
  pop: FpsPoint & {y: number},
  enemyEye: {x: number; y: number; z: number},
  runtime: LiveMapRuntime,
  busyAllies: readonly FpsFlashAllyEye[] = [],
): FpsPopFlashCandidateScore | undefined {
  const sight = liveGrenadeSightline(pop, enemyEye, runtime);
  const range = Math.hypot(pop.x - enemyEye.x, pop.y - enemyEye.y, pop.z - enemyEye.z);
  if (!sight || range > 9.5) return undefined;
  if (fpsFlashAllyHazard(pop, busyAllies, runtime) >= FPS_FLASH_ALLY_HAZARD_LIMIT) return undefined;
  const handY = from.handY ?? from.y ?? (runtime.terrain.groundHeight(from) + 1.55);
  let occludedCount = 0;
  for (const s of [0.25, 0.50, 0.72]) {
    const samplePt = {
      x: from.x + (pop.x - from.x) * s,
      y: handY + (pop.y - handY) * s + 0.5 * 18 * 1.5 * 1.5 * s * (1 - s),
      z: from.z + (pop.z - from.z) * s,
    };
    if (!liveGrenadeSightline(samplePt, enemyEye, runtime)) occludedCount++;
  }
  const surpriseBonus = occludedCount * 2.2;
  return {range, occludedCount, surpriseBonus, effectiveScore: surpriseBonus - range * 0.45};
}

/** First floor (or horizontal top) contact of a thrown grenade, used to score fire and HE. Practice only. */
export function fpsFirstFloorContact(grenade: LiveGrenade, runtime: LiveMapRuntime, maxTime = 3.4): LiveGrenade {
  const sim: LiveGrenade = {...grenade};
  for (let at = 0; at < maxTime - 1e-8; at += 1 / 30) {
    const before = {x: sim.x, y: sim.y, z: sim.z, level: sim.level, vy: sim.vy};
    stepLiveGrenade(sim, 1 / 30, runtime);
    if (grenadeHitHorizontalSurface(before, sim, runtime)) return sim;
  }
  return sim;
}

/**
 * When no throw clears the blockers from where the bot stands, it looks around for a nearby spot that
 * gives a throw it can calculate, preferring an open lane and short steps. Only walkable spots count.
 */
export function findFpsThrowSpot(
  kind: LiveGrenadeKind, around: FpsPoint, target: FpsPoint, runtime: LiveMapRuntime, brain?: FpsUtilityBrain, radius = 8,
): {spot: FpsPoint; plan: FpsThrowPlan} | undefined {
  let best: {spot: FpsPoint; plan: FpsThrowPlan; score: number} | undefined;
  for (let r = 1; r <= radius; r++) for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2, spot: FpsPoint = {x: around.x + Math.sin(a) * r, z: around.z + Math.cos(a) * r, level: around.level};
    if (!runtime.walkable(spot)) continue;
    const yaw = Math.atan2(target.x - spot.x, target.z - spot.z);
    const hand = {level: spot.level, x: spot.x + Math.sin(yaw) * .2 + Math.cos(yaw) * .16, z: spot.z + Math.cos(yaw) * .2 - Math.sin(yaw) * .16};
    const plan = calculateLiveThrow(kind, hand, target, 1.55 + runtime.terrain.groundHeight(spot), runtime, brain);
    if (!plan || fpsThrowSpotFailing(brain, plan)) continue;
    const score = r + (plan.path === 'open' ? 0 : 1.5) + (plan.source === 'remembered' ? -2 : 0);
    if (!best || score < best.score) best = {spot, plan, score};
  }
  return best && {spot: best.spot, plan: best.plan};
}
/** Spots are remembered per smoke assignment (both sides may smoke the same crossing from opposite ends). */
export const fpsUtilitySpotKey = (mapId: string, kind: LiveGrenadeKind, assignment: string, target: FpsPoint) => `${mapId}:${kind}:${assignment}:${Math.round(target.x)},${Math.round(target.z)},${target.level ?? ''}`;
/** Remember a spot that worked for this smoke target. */
export function rememberFpsThrowSpot(brain: FpsUtilityBrain, key: string, spot: FpsPoint): void {
  if (!brain.spots[key] && brain.spotArchive?.[key]) {
    brain.spots[key] = brain.spotArchive[key]; delete brain.spotArchive[key];
    if (!Object.keys(brain.spotArchive).length) delete brain.spotArchive;
  }
  const existing = brain.spots[key];
  if (existing && Math.hypot(existing.x - spot.x, existing.z - spot.z) < 1) existing.successes++;
  else if (!existing || existing.successes <= 1) brain.spots[key] = {x: Math.round(spot.x * 100) / 100, z: Math.round(spot.z * 100) / 100, ...(spot.level ? {level: spot.level} : {}), successes: 1};
  consolidateFpsUtilityBrain(brain);
}

/** True when this spot has been tried enough and never landed a smoke on the target floor. */
export function fpsThrowSpotFailing(brain: FpsUtilityBrain | undefined, plan: FpsThrowPlan): boolean {
  const memory = brain?.entries[plan.key];
  if (!memory || memory.successes > 0 || memory.lastError < 3) return false;
  // Another throw type is still worth trying from here before moving.
  if (plan.source === 'exploring' && plan.style !== memory.style) return false;
  return memory.attempts >= 4 && (memory.rejected.length >= 1 || memory.attempts >= 8);
}

/**
 * Practice session, like drilling smokes on an empty server: for each tactical smoke target the bot
 * throws from its spot, sees where the smoke really lands (the game's own physics), and learns.
 * It moves to a new spot when one keeps failing. Returns how many targets ended on a working throw.
 */
export function practiceFpsSmokeTargets(
  brain: FpsUtilityBrain, runtime: LiveMapRuntime, targets: readonly FpsUtilityPracticeTarget[], throwsPerTarget = 12,
): {targets: number; mastered: number; throws: number} {
  return practiceFpsUtilityTargets(brain, runtime, targets, throwsPerTarget, 'smoke');
}
export interface FpsUtilityPracticeTarget {id: string; position: FpsPoint; target: FpsPoint}

/**
 * Practice for any grenade. Each throw is fed back through the game's own grenade physics and scored
 * the way live throws are: smokes where they rest, fire and HE where they first touch the floor,
 * flashes where they pop (with sight of the spot).
 */
export function practiceFpsUtilityTargets(
  brain: FpsUtilityBrain, runtime: LiveMapRuntime, targets: readonly FpsUtilityPracticeTarget[], throwsPerTarget = 12, kind: LiveGrenadeKind = 'smoke',
): {targets: number; mastered: number; throws: number} {
  const handOf = (pos: FpsPoint, target: FpsPoint): FpsPoint => {
    const yaw = Math.atan2(target.x - pos.x, target.z - pos.z);
    return {level: pos.level, x: pos.x + Math.sin(yaw) * .2 + Math.cos(yaw) * .16, z: pos.z + Math.cos(yaw) * .2 - Math.sin(yaw) * .16};
  };
  let mastered = 0, throws = 0;
  for (const item of targets) {
    const spotKey = fpsUtilitySpotKey(runtime.id, kind, item.id, item.target);
    const remembered = fpsUtilitySpot(brain, spotKey);
    let pos: FpsPoint = remembered ? {x: remembered.x, z: remembered.z, level: remembered.level} : item.position, last = false;
    const floor = runtime.terrain.groundHeight(item.target) + .09;
    const targetEye = {x: item.target.x, y: runtime.terrain.groundHeight(item.target) + 1.5, z: item.target.z};
    for (let k = 0; k < throwsPerTarget; k++) {
      let plan = calculateLiveThrow(kind, handOf(pos, item.target), item.target, 1.55 + runtime.terrain.groundHeight(pos), runtime, brain);
      if (!plan || fpsThrowSpotFailing(brain, plan)) {
        const found = findFpsThrowSpot(kind, pos, item.target, runtime, brain);
        if (found) { pos = found.spot; plan = found.plan; }
      }
      if (!plan) break;
      const height = 1.55 + runtime.terrain.groundHeight(pos);
      const thrown = launchLiveGrenade(-1, kind, 'practice', 'blue', handOf(pos, item.target), plan.aimTarget, 0, false, plan.style, height, {x: 0, z: 0}, plan.flightTime, runtime);
      const landing = kind === 'he' ? fpsFirstFloorContact(thrown, runtime, LIVE_UTILITY_FUSES.heFuse) : predictLiveGrenade(thrown, 0, runtime);
      const sight = kind === 'flash' ? liveGrenadeSightline(landing, targetEye, runtime) : undefined;
      last = learnFpsThrowOutcome(brain, {key: plan.key, plan, intended: item.target, landing, targetFloor: floor, spot: pos, spotKey, ...(sight !== undefined ? {sight} : {})}).success;
      throws++;
    }
    if (last) mastered++;
  }
  return {targets: targets.length, mastered, throws};
}

/**
 * Practice drills for flashes, fire and HE, taken from the map's own tactical points: attackers
 * flash and burn each site from its staging spots, defenders hit post-plant spots from retake
 * staging. Smokes practise the smokes the bots work out for themselves (fpsSmokePlanner), for both sides,
 * every site and Mid, so practice matches what is thrown in matches.
 */
export function fpsUtilityPracticeTargets(runtime: LiveMapRuntime, kind: LiveGrenadeKind): FpsUtilityPracticeTarget[] {
  if (kind === 'smoke') {
    const purposes = [[true, 'execute', 'A'], [true, 'execute', 'B'], [true, 'opening', 'A'], [true, 'opening', 'B'], [true, 'control', 'Mid'], [false, 'opening', 'A'], [false, 'opening', 'B'], [false, 'control', 'Mid']] as const;
    return purposes.flatMap(([attacking, purpose, area]) => planLiveSmokes(runtime, liveSmokeRequest(runtime, attacking, purpose, area)))
      .map(l => ({id: l.id, position: l.position, target: l.target}));
  }
  const out: FpsUtilityPracticeTarget[] = [];
  const tactical = runtime.definition.tactical;
  const add = (id: string, position: FpsPoint, target: FpsPoint) => {
    const d = Math.hypot(target.x - position.x, target.z - position.z);
    if (d < 5 || d > 30 || !runtime.walkable(position)) return;
    if (out.some(o => Math.hypot(o.position.x - position.x, o.position.z - position.z) < 1.5 && Math.hypot(o.target.x - target.x, o.target.z - target.z) < 1.5)) return;
    out.push({id, position, target});
  };
  for (const site of ['A', 'B'] as const) {
    const t = tactical[site];
    const goals = kind === 'flash' ? [t.flash, ...t.entries.slice(0, 2)] : [...t.holds.slice(0, 3), ...t.postPlant.slice(0, 1)];
    t.staging.slice(0, 3).forEach((from, i) => goals.forEach((goal, j) => add(`${site}:staging${i}>${kind}${j}`, from, goal)));
    t.retakeStaging.slice(0, 2).forEach((from, i) => t.postPlant.slice(0, 2).forEach((goal, j) => add(`${site}:retake${i}>${kind}${j}`, from, goal)));
  }
  return out.slice(0, 16);
}
