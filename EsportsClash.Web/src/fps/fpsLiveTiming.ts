import {
  influenceCellIndex,
  sampleInfluenceUncertainty,
  type LiveTeamInfluenceGrid,
} from './fpsLiveInfluenceMap.ts';
import type { LiveIntelContact } from './fpsLiveIntel.ts';
import { distance } from './fpsLiveMap.ts';
import type { LiveMapRuntime } from './fpsLiveMapTypes.ts';
import { LIVE_RUN_SPEED } from './fpsLiveMovement.ts';
import type { FpsPoint } from './fpsSpatialWorld.ts';

export interface LiveRotationWindow {
  site: 'A' | 'B';
  opensAt: number;
  closesAt: number;
  reason: string;
  trigger: 'pick' | 'fake' | 'cleared_lane';
}

export interface LiveFlankTimingState {
  holdPoint: FpsPoint;
  targetPoint: FpsPoint;
  armedAt: number;
  releaseUntil: number;
  triggered: boolean;
  reason: string;
}

export interface LivePunishWindow {
  point: FpsPoint;
  at: number;
  until: number;
  cue: 'reload' | 'utility' | 'sniper_shot';
  reason: string;
}

export interface LiveFadeStage {
  smokeId?: number;
  point: FpsPoint;
  expiresAt: number;
  kind: 'smoke' | 'fire';
}

export interface LiveTeamTimingState {
  exploitWindow?: LiveRotationWindow;
  lastChaosAt: number;
  lastChaosArea?: 'A' | 'B' | 'Mid';
  lastKillAt: number;
  lastKillArea?: 'A' | 'B' | 'Mid';
}

export function createTeamTimingState(): LiveTeamTimingState {
  return {
    lastChaosAt: -100,
    lastKillAt: -100,
  };
}

/**
 * Travel duration (seconds) a rotating defender needs to cross between sites on the current map.
 */
export function computeRotationTravelSeconds(
  runtime: LiveMapRuntime,
  fromSite: 'A' | 'B',
  toSite: 'A' | 'B',
): number {
  const len = runtime.pathLength(runtime.definition.sites[fromSite], runtime.definition.sites[toSite]);
  const raw = Number.isFinite(len) ? len / LIVE_RUN_SPEED : 8;
  return Math.max(4.5, Math.min(13, raw));
}

/**
 * Opens an explicit rotation travel-time exploit window (e.g., after an opening pick, fake execute,
 * or cleared off-site lane) before rotating opponents can arrive and stabilize.
 */
export function openRotationExploitWindow(
  state: LiveTeamTimingState,
  runtime: LiveMapRuntime,
  targetSite: 'A' | 'B',
  trigger: 'pick' | 'fake' | 'cleared_lane',
  now: number,
  reason: string,
): LiveRotationWindow {
  const otherSite: 'A' | 'B' = targetSite === 'A' ? 'B' : 'A';
  const rotSeconds = computeRotationTravelSeconds(runtime, otherSite, targetSite);
  const window: LiveRotationWindow = {
    site: targetSite,
    opensAt: now,
    closesAt: now + Math.max(3.8, rotSeconds - 1.4),
    reason,
    trigger,
  };
  state.exploitWindow = window;
  return window;
}

/**
 * Stamps lawful distraction chaos (execute gunfire, utility execute pop, bomb plant, retake clash)
 * so armed lurkers and deep flankers release into turned backs on timing.
 */
export function recordTeamChaos(
  state: LiveTeamTimingState,
  area: 'A' | 'B' | 'Mid',
  now: number,
): void {
  state.lastChaosAt = now;
  state.lastChaosArea = area;
}

/**
 * Determines whether an armed lurk/flank timing hold should release now:
 * requires fresh distraction chaos AFTER `flank.armedAt + 0.6` on another area, bomb plant,
 * low round clock, or bounded patience cap (9.5 s).
 */
export function shouldReleaseFlankTiming(
  flank: LiveFlankTimingState,
  teamTiming: LiveTeamTimingState,
  flankArea: 'A' | 'B' | 'Mid',
  bombPlanted: boolean,
  remaining: number,
  now: number,
): boolean {
  if (flank.triggered && now < flank.releaseUntil) return true;
  if (bombPlanted || remaining < 24) return true;
  if (
    teamTiming.lastChaosAt >= flank.armedAt + 0.6 &&
    now - teamTiming.lastChaosAt < 3.5 &&
    teamTiming.lastChaosArea !== flankArea
  ) {
    return true;
  }
  if (now - flank.armedAt > 9.5) return true;
  return false;
}

/**
 * Evaluates whether a close-range lawful audio cue (enemy reload, grenade pin pull, or sniper bolt shot)
 * opens a short vulnerability punish swing before the opponent can reset.
 */
export function evaluateAudioPunishWindow(
  actor: {
    x: number;
    z: number;
    hp: number;
    ammo: number;
    reload: number;
    blinded: number;
    bomb: boolean;
    weaponCategory: string;
    opportunityBias: number;
  },
  contact: LiveIntelContact,
  now: number,
): LivePunishWindow | undefined {
  const cue: LivePunishWindow['cue'] | undefined =
    contact.source === 'reload'
      ? 'reload'
      : contact.source === 'utility'
        ? 'utility'
        : contact.source === 'gunfire' && contact.weaponHint === 'sniper'
          ? 'sniper_shot'
          : undefined;
  if (!cue) return undefined;
  if (actor.hp < 40 || actor.ammo <= 0 || actor.reload > 0 || actor.blinded >= 0.15 || actor.bomb || actor.weaponCategory === 'sniper') {
    return undefined;
  }
  const maxRange = cue === 'sniper_shot' ? 20 : 16;
  if (distance(actor, contact) > maxRange) return undefined;
  if (actor.opportunityBias < 0.2 && cue === 'utility') return undefined;

  const duration = cue === 'reload' ? 1.35 : cue === 'utility' ? 1.15 : 0.95;
  const reason =
    cue === 'reload'
      ? 'Heard enemy reload — swing on reload timing'
      : cue === 'utility'
        ? 'Heard grenade pin nearby — catch thrower with utility out'
        : 'Enemy AWP fired nearby — punish between bolt cycles';

  return {
    point: { x: contact.x, z: contact.z, level: contact.level },
    at: now + 0.08,
    until: now + duration,
    cue,
    reason,
  };
}

/**
 * Finds an active smoke or incendiary barrier along the path to `goal` expiring within 0.15–2.6s,
 * returning a safe edge staging point just behind the barrier so the actor bursts on the fade tick.
 */
export function findExpiringBarrierStage(
  actor: FpsPoint,
  goal: FpsPoint | undefined,
  smokes: readonly { id: number; x: number; z: number; level?: FpsPoint['level']; radius: number; expires: number }[],
  fires: readonly { x: number; z: number; level?: FpsPoint['level']; radius: number; expires: number }[],
  now: number,
): LiveFadeStage | undefined {
  if (!goal || distance(actor, goal) < 3) return undefined;
  const gx = goal.x - actor.x;
  const gz = goal.z - actor.z;
  const gLen = Math.hypot(gx, gz) || 1;

  for (const s of smokes) {
    const rem = s.expires - now;
    if (rem <= 0.15 || rem > 2.6) continue;
    const d = distance(actor, s);
    if (d > 14 || d < s.radius) continue;
    const dot = ((s.x - actor.x) * gx + (s.z - actor.z) * gz) / (Math.max(1e-4, d) * gLen);
    if (dot < 0.45) continue;
    const back = Math.max(0.5, d - s.radius - 1.35);
    return {
      smokeId: s.id,
      point: {
        x: actor.x + ((s.x - actor.x) / Math.max(1e-4, d)) * back,
        z: actor.z + ((s.z - actor.z) / Math.max(1e-4, d)) * back,
        level: actor.level,
      },
      expiresAt: s.expires,
      kind: 'smoke',
    };
  }

  for (const f of fires) {
    const rem = f.expires - now;
    if (rem <= 0.15 || rem > 2.4) continue;
    const d = distance(actor, f);
    if (d > 12 || d < f.radius + 0.4) continue;
    const dot = ((f.x - actor.x) * gx + (f.z - actor.z) * gz) / (Math.max(1e-4, d) * gLen);
    if (dot < 0.45) continue;
    const back = Math.max(0.5, d - f.radius - 1.4);
    return {
      point: {
        x: actor.x + ((f.x - actor.x) / Math.max(1e-4, d)) * back,
        z: actor.z + ((f.z - actor.z) / Math.max(1e-4, d)) * back,
        level: actor.level,
      },
      expiresAt: f.expires,
      kind: 'fire',
    };
  }

  return undefined;
}

/**
 * Classifies timing-gap caution at `point` from the team's lawful influence clearance clock:
 * - `'fresh'`: cleared within 5 s (safe fast movement)
 * - `'gap_danger'`: unwatched > 14 s (opponents could have crept through -> creep / re-clear)
 */
export function zoneTimingGapCaution(
  grid: LiveTeamInfluenceGrid,
  point: FpsPoint,
  now: number,
): 'fresh' | 'normal' | 'gap_danger' {
  const idx = influenceCellIndex(grid, point);
  const age = Math.max(0, now - grid.lastClearedAt[idx]);
  if (age < 5) return 'fresh';
  if (age > 14 || sampleInfluenceUncertainty(grid, point, now) >= 0.5) return 'gap_danger';
  return 'normal';
}
