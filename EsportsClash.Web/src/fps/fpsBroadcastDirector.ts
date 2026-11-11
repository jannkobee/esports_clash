import { LIVE_FPS_MAP, distance, liveSightline } from './fpsLiveMap.ts';
import { segmentHitsWall } from './fpsSpatialWorld.ts';
import type { LivePlayer, LiveSnapshot } from './fpsLiveSimulation.ts';
import type { FpsTeamId } from './types.ts';

export type LiveCameraMode = 'director' | 'first' | 'third' | 'overview';

export interface CameraPose {
  position: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
  fov: number;
}

export interface NormalizedViewport {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BombPlantPipState {
  active: boolean;
  phase: 'settling' | 'planting' | 'planted';
  planterId?: string;
  planterName?: string;
  team?: FpsTeamId;
  site?: 'A' | 'B';
  progress: number;
  duration: number;
  planterHp?: number;
  spot: { x: number; z: number };
}

export interface DirectorState {
  round: number;
  followedId: string;
  cutAt: number;
  lastKillsById: Record<string, number>;
  lastKillEventId: number;
  lastKillAtById: Record<string, number>;
  lastKillHeadshotById: Record<string, boolean>;
  lastKillCutAt: number;
  bombPlantSettledUntil: number;
  bombPlantSettleSite?: 'A' | 'B';
  bombPlantSettleSpot?: { x: number; z: number };
  bombPlantSettlePlanterId?: string;
  bombPlantSettlePlanterName?: string;
  bombPlantSettleTeam?: FpsTeamId;
  lastBombStatus?: LiveSnapshot['bomb']['status'];
}

export interface DirectorDecision {
  followedId: string;
  effectiveMode: Exclude<LiveCameraMode, 'director'>;
  pip: BombPlantPipState;
}

export const PLANT_CHANNEL_DURATION = 3.2;
export const PLANT_SETTLE_WINDOW = 1.2;
export const DIRECTOR_MIN_CUT_INTERVAL = 1.2;
export const DIRECTOR_POST_KILL_BEAT = 1.4;
export const THIRD_PERSON_BACK_OFFSET = 2.15;
export const THIRD_PERSON_RIGHT_OFFSET = 0.52;
export const THIRD_PERSON_MIN_BACK = 0.22;
export const THIRD_PERSON_LOOK_AHEAD = 3.4;

const MAP_LIMIT_X = 33.5;
const MAP_LIMIT_Z = 42.5;

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

export function createDirectorState(): DirectorState {
  return {
    round: 0,
    followedId: '',
    cutAt: -100,
    lastKillsById: {},
    lastKillEventId: 0,
    lastKillAtById: {},
    lastKillHeadshotById: {},
    lastKillCutAt: -100,
    bombPlantSettledUntil: -100,
  };
}

export function isPlantingAction(action: string): boolean {
  return action === 'Planting' || action === 'Settling to plant';
}

export function isActivelyPlanting(player: Pick<LivePlayer, 'hp' | 'bomb' | 'attacking' | 'action' | 'channel'>): boolean {
  return player.hp > 0 && player.bomb && player.attacking && (isPlantingAction(player.action) || player.channel > 0);
}

export function resolveBombSite(spot: { x: number; z: number }): 'A' | 'B' {
  return distance(spot, LIVE_FPS_MAP.sites.A) <= distance(spot, LIVE_FPS_MAP.sites.B) ? 'A' : 'B';
}

function resetForNewMatch(state: DirectorState, snapshot: LiveSnapshot): void {
  state.round = snapshot.round;
  state.followedId = '';
  state.cutAt = -100;
  state.lastKillsById = {};
  state.lastKillEventId = 0;
  state.lastKillAtById = {};
  state.lastKillHeadshotById = {};
  state.lastKillCutAt = -100;
  state.bombPlantSettledUntil = -100;
  state.bombPlantSettleSite = undefined;
  state.bombPlantSettleSpot = undefined;
  state.bombPlantSettlePlanterId = undefined;
  state.bombPlantSettlePlanterName = undefined;
  state.bombPlantSettleTeam = undefined;
  state.lastBombStatus = snapshot.bomb.status;
}

function syncDirectorKillEvents(snapshot: LiveSnapshot, state: DirectorState): void {
  for (const event of snapshot.events) {
    if (event.id <= state.lastKillEventId) continue;
    if (event.kind === 'kill' && event.actorId) {
      state.lastKillAtById[event.actorId] = event.time;
      state.lastKillHeadshotById[event.actorId] = Boolean(event.headshot);
      if (event.time > state.lastKillCutAt) {
        state.lastKillCutAt = event.time;
      }
    }
    state.lastKillEventId = event.id;
  }

  for (const player of snapshot.players) {
    const prevKills = state.lastKillsById[player.id];
    if (prevKills !== undefined && player.kills > prevKills) {
      if ((state.lastKillAtById[player.id] ?? -100) < snapshot.time - 0.15) {
        state.lastKillAtById[player.id] = snapshot.time;
        state.lastKillCutAt = Math.max(state.lastKillCutAt, snapshot.time);
      }
    }
    state.lastKillsById[player.id] = player.kills;
  }
}

/**
 * In-broadcast Picture-in-Picture strictly mirrors active bomb plants (and a brief confirmation
 * beat right when the C4 locks in) and nothing else — never defuses, combat, or idle holds.
 */
export function selectBombPlantPip(snapshot: LiveSnapshot, state: DirectorState): BombPlantPipState {
  if (snapshot.phase !== 'live') {
    state.bombPlantSettledUntil = -100;
    state.lastBombStatus = snapshot.bomb.status;
    return { active: false, phase: 'planting', progress: 0, duration: PLANT_CHANNEL_DURATION, spot: { x: 0, z: 0 } };
  }

  const activePlanter = snapshot.players.find((p) => isActivelyPlanting(p));

  const plantEvent = snapshot.events.find(
    (e) => e.kind === 'objective' && e.text.includes('planted at') && snapshot.time - e.time <= PLANT_SETTLE_WINDOW,
  );
  const justPlanted =
    snapshot.bomb.status === 'planted' &&
    ((state.lastBombStatus !== undefined && state.lastBombStatus !== 'planted') || Boolean(plantEvent));

  if (justPlanted) {
    const site = snapshot.bomb.site ?? resolveBombSite(snapshot.bomb);
    state.bombPlantSettledUntil = snapshot.time + PLANT_SETTLE_WINDOW;
    state.bombPlantSettleSite = site;
    state.bombPlantSettleSpot = { x: snapshot.bomb.x, z: snapshot.bomb.z };
    if (plantEvent?.actorId) {
      const planter = snapshot.players.find((p) => p.id === plantEvent.actorId);
      state.bombPlantSettlePlanterId = plantEvent.actorId;
      state.bombPlantSettlePlanterName = planter?.name ?? state.bombPlantSettlePlanterName;
      state.bombPlantSettleTeam = planter?.team ?? plantEvent.team ?? snapshot.attackTeam;
    }
  }
  state.lastBombStatus = snapshot.bomb.status;

  if (activePlanter) {
    const site = resolveBombSite(activePlanter);
    state.bombPlantSettlePlanterId = activePlanter.id;
    state.bombPlantSettlePlanterName = activePlanter.name;
    state.bombPlantSettleTeam = activePlanter.team;
    state.bombPlantSettleSite = site;
    state.bombPlantSettleSpot = { x: activePlanter.x, z: activePlanter.z };
    return {
      active: true,
      phase: activePlanter.action === 'Settling to plant' && activePlanter.channel <= 0 ? 'settling' : 'planting',
      planterId: activePlanter.id,
      planterName: activePlanter.name,
      team: activePlanter.team,
      site,
      progress: clamp(activePlanter.channel / PLANT_CHANNEL_DURATION, 0, 1),
      duration: PLANT_CHANNEL_DURATION,
      planterHp: activePlanter.hp,
      spot: { x: activePlanter.x, z: activePlanter.z },
    };
  }

  if (snapshot.bomb.status === 'planted' && snapshot.time <= state.bombPlantSettledUntil) {
    return {
      active: true,
      phase: 'planted',
      planterId: state.bombPlantSettlePlanterId,
      planterName: state.bombPlantSettlePlanterName,
      team: state.bombPlantSettleTeam ?? snapshot.attackTeam,
      site: state.bombPlantSettleSite ?? snapshot.bomb.site ?? resolveBombSite(snapshot.bomb),
      progress: 1,
      duration: PLANT_CHANNEL_DURATION,
      spot: state.bombPlantSettleSpot ?? { x: snapshot.bomb.x, z: snapshot.bomb.z },
    };
  }

  return { active: false, phase: 'planting', progress: 0, duration: PLANT_CHANNEL_DURATION, spot: { x: 0, z: 0 } };
}

/**
 * Scores an alive player strictly by kill potential, active gunfights, recent kill momentum,
 * and crosshair convergence on exposed opponents, while demoting active bomb planters so the
 * main broadcast camera stays on the fragging action.
 */
export function scoreDirectorKillPriority(
  player: LivePlayer,
  snapshot: LiveSnapshot,
  state: DirectorState,
  existingId: string,
): number {
  if (player.hp <= 0) return -999;

  const enemies = snapshot.players.filter((e) => e.hp > 0 && e.team !== player.team);
  const lookX = Math.sin(player.yaw);
  const lookZ = Math.cos(player.yaw);

  let duelScore = 0;
  let nearestThreat = 999;

  for (const enemy of enemies) {
    const dist = distance(player, enemy);
    if (dist < nearestThreat) nearestThreat = dist;

    if (dist < 38 && liveSightline(player, enemy)) {
      const invLen = dist > 0.01 ? 1 / dist : 0;
      const aimDot = (enemy.x - player.x) * invLen * lookX + (enemy.z - player.z) * invLen * lookZ;
      const sightBase = 5.8 + clamp((34 - dist) / 34, 0, 1) * 2.2;
      const aimBonus = aimDot > 0.9 ? 2.6 : aimDot > 0.72 ? 1.3 : 0;
      const finishBonus = enemy.hp <= 45 ? 2.1 : 0;
      const mutualShot = snapshot.time - enemy.lastShot < 0.9 ? 1.8 : 0;
      const candidateDuel = sightBase + aimBonus + finishBonus + mutualShot;
      if (candidateDuel > duelScore) duelScore = candidateDuel;
    } else if (dist < 11) {
      // Tight pre-contact corner tension before a swing.
      const proximityScore = (1 - dist / 11) * 2.8;
      if (proximityScore > duelScore) duelScore = proximityScore;
    }
  }

  const shotAge = snapshot.time - player.lastShot;
  const firingScore = shotAge >= 0 && shotAge <= 1.15 ? 5.6 * (1 - shotAge / 1.15) : 0;

  const killAge = snapshot.time - (state.lastKillAtById[player.id] ?? -100);
  let killMomentum = 0;
  if (killAge >= 0 && killAge <= 2.2) {
    killMomentum = 4.6 * (1 - killAge / 2.2);
    if (state.lastKillHeadshotById[player.id]) killMomentum += 0.9;
    if (nearestThreat < 22) killMomentum += 1.4;
  }

  let combatRoleBonus = 0;
  if (player.action === 'Engaging' || player.action === 'Trading') combatRoleBonus = 1.9;
  else if (player.action === 'Peeking' || player.action === 'Clearing' || player.action === 'Flanking') combatRoleBonus = 1.3;
  else if (player.action === 'Defusing' && snapshot.bomb.status === 'planted') combatRoleBonus = nearestThreat < 18 ? 2.6 : 1.1;

  // Keep bomb planters off the main broadcast camera unless literally nobody else can fight.
  const planterPenalty = isActivelyPlanting(player) ? -14 : 0;

  // Slight sticky bonus prevents jitter between two equally quiet players walking up a lane.
  const stickyBonus = player.id === existingId && planterPenalty === 0 ? 1.1 : 0;

  // Mild preference toward active entry / sniper riflers when idle.
  const roleBias = player.role === 'entry' || player.role === 'sniper' || player.role === 'trade' ? 0.25 : 0;

  return duelScore + firingScore + killMomentum + combatRoleBonus + planterPenalty + stickyBonus + roleBias;
}

function findLivingKillerOf(victimId: string, snapshot: LiveSnapshot): LivePlayer | undefined {
  for (let i = snapshot.events.length - 1; i >= 0; i--) {
    const ev = snapshot.events[i];
    if (ev.kind === 'kill' && ev.targetId === victimId && snapshot.time - ev.time <= 1.8 && ev.actorId) {
      const killer = snapshot.players.find((p) => p.id === ev.actorId && p.hp > 0);
      if (killer) return killer;
    }
  }
  return undefined;
}

function pickDirectorFollowedPlayer(snapshot: LiveSnapshot, state: DirectorState): LivePlayer {
  const players = snapshot.players;
  const alive = players.filter((p) => p.hp > 0);
  if (alive.length === 0) {
    return players[0];
  }

  const existing = players.find((p) => p.id === state.followedId);

  // Never keep the main camera stranded on a bomb planter while another alive player can frag.
  const nonPlanters = alive.filter((p) => !isActivelyPlanting(p));
  const pool = nonPlanters.length > 0 ? nonPlanters : alive;

  const ranked = [...pool]
    .map((p) => ({
      player: p,
      score: scoreDirectorKillPriority(p, snapshot, state, state.followedId),
    }))
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];

  // If the observed player just got eliminated, immediately snap to their living killer (or top frag focus).
  if (!existing || existing.hp <= 0) {
    const killer = existing ? findLivingKillerOf(existing.id, snapshot) : undefined;
    const next = killer && !isActivelyPlanting(killer) ? killer : best.player;
    if (state.followedId !== next.id) {
      state.followedId = next.id;
      state.cutAt = snapshot.time;
    }
    return next;
  }

  // Immediately pull main camera off an active bomb planter (PIP covers the plant).
  if (isActivelyPlanting(existing) && nonPlanters.length > 0) {
    state.followedId = best.player.id;
    state.cutAt = snapshot.time;
    return best.player;
  }

  const existingEntry = ranked.find((entry) => entry.player.id === existing.id);
  const existingScore = existingEntry?.score ?? scoreDirectorKillPriority(existing, snapshot, state, state.followedId);
  const sinceCut = snapshot.time - state.cutAt;

  // Immediate killer spotlight when another player scores a fresh kill while our subject isn't locked in a direct duel.
  const bestKillAge = snapshot.time - (state.lastKillAtById[best.player.id] ?? -100);
  const urgentKillCut =
    best.player.id !== existing.id &&
    bestKillAge >= 0 &&
    bestKillAge <= 0.45 &&
    existingScore < 7.0 &&
    sinceCut >= 0.4;

  const tacticalCut =
    best.player.id !== existing.id &&
    sinceCut >= DIRECTOR_MIN_CUT_INTERVAL &&
    best.score > existingScore + 1.15;

  if (urgentKillCut || tacticalCut) {
    state.followedId = best.player.id;
    state.cutAt = snapshot.time;
    return best.player;
  }

  return existing;
}

export function chooseDirectorCameraMode(
  followed: LivePlayer,
  snapshot: LiveSnapshot,
  state: DirectorState,
): Exclude<LiveCameraMode, 'director'> {
  if (snapshot.phase === 'freeze' || snapshot.phase === 'finished') {
    return 'overview';
  }
  if (snapshot.phase === 'post') {
    const withinKillBeat = followed.hp > 0 && snapshot.time - state.lastKillCutAt <= DIRECTOR_POST_KILL_BEAT;
    return withinKillBeat ? 'first' : 'overview';
  }

  const recentShot = snapshot.time - followed.lastShot < 2.2;
  const activeCombatAction =
    followed.action === 'Engaging' ||
    followed.action === 'Peeking' ||
    followed.action === 'Clearing' ||
    followed.action === 'Trading' ||
    followed.action === 'Flanking';

  const enemies = snapshot.players.filter((e) => e.hp > 0 && e.team !== followed.team);
  const hasSightline = enemies.some((e) => distance(followed, e) < 35 && liveSightline(followed, e));
  const imminentContact = enemies.some((e) => distance(followed, e) < 11.5);

  if (recentShot || hasSightline || activeCombatAction || imminentContact) {
    return 'first';
  }
  return 'third';
}

export function evaluateBroadcastDirector(
  snapshot: LiveSnapshot,
  state: DirectorState,
  mode: LiveCameraMode,
  selectedId: string,
): DirectorDecision {
  if (snapshot.time < state.cutAt - 0.5 || (snapshot.round === 1 && state.round > 1)) {
    resetForNewMatch(state, snapshot);
  }
  if (snapshot.round !== state.round) {
    state.round = snapshot.round;
    state.cutAt = -100;
    state.lastKillCutAt = -100;
    state.bombPlantSettledUntil = -100;
    state.lastBombStatus = snapshot.bomb.status;
  }

  syncDirectorKillEvents(snapshot, state);
  const pip = selectBombPlantPip(snapshot, state);

  const players = snapshot.players;
  const alive = players.filter((p) => p.hp > 0);

  let followed: LivePlayer;
  if (mode === 'director') {
    followed = pickDirectorFollowedPlayer(snapshot, state);
  } else {
    const selectedPlayer = players.find((p) => p.id === selectedId);
    followed =
      selectedPlayer && selectedPlayer.hp > 0
        ? selectedPlayer
        : alive.find((p) => p.team === selectedPlayer?.team) ?? alive[0] ?? players[0];
    state.followedId = followed.id;
  }

  const effectiveMode = mode === 'director' ? chooseDirectorCameraMode(followed, snapshot, state) : mode;

  return {
    followedId: followed.id,
    effectiveMode,
    pip,
  };
}

export function computeOverviewCameraPose(): CameraPose {
  return {
    position: { x: 0, y: 68, z: -52 },
    target: { x: 0, y: 0, z: 2 },
    fov: 0.95,
  };
}

/**
 * Computes a tight over-the-back / right-shoulder third-person chase camera close to the
 * operative model, pulling forward cleanly before intersecting any map solid.
 */
export function computeThirdPersonCameraPose(player: LivePlayer): CameraPose {
  const dx = Math.sin(player.yaw);
  const dz = Math.cos(player.yaw);
  // Babylon LHS (+X right, +Z forward): right axis from yaw is (cos(yaw), -sin(yaw)).
  const rx = Math.cos(player.yaw);
  const rz = -Math.sin(player.yaw);

  const clampedX = clamp(player.x, -MAP_LIMIT_X, MAP_LIMIT_X);
  const clampedZ = clamp(player.z, -MAP_LIMIT_Z, MAP_LIMIT_Z);
  const jumpOffset = player.jumpY ?? 0;

  let backOffset = THIRD_PERSON_BACK_OFFSET;
  let shoulderOffset = THIRD_PERSON_RIGHT_OFFSET;

  const isBlocked = (back: number, right: number): boolean => {
    const camX = clamp(clampedX - dx * back + rx * right, -MAP_LIMIT_X, MAP_LIMIT_X);
    const camZ = clamp(clampedZ - dz * back + rz * right, -MAP_LIMIT_Z, MAP_LIMIT_Z);
    return LIVE_FPS_MAP.solids.some((w) => segmentHitsWall(player, { x: camX, z: camZ }, w, 0.22));
  };

  while (backOffset > THIRD_PERSON_MIN_BACK && isBlocked(backOffset, shoulderOffset)) {
    backOffset = Math.max(THIRD_PERSON_MIN_BACK, backOffset - 0.1);
    if (backOffset < 0.9) {
      shoulderOffset = THIRD_PERSON_RIGHT_OFFSET * clamp((backOffset - THIRD_PERSON_MIN_BACK) / 0.76, 0.25, 1);
    }
  }

  if (isBlocked(backOffset, shoulderOffset)) {
    shoulderOffset = 0;
    while (backOffset > 0.06 && isBlocked(backOffset, 0)) {
      backOffset = Math.max(0.06, backOffset - 0.06);
    }
  }

  const tightLift = backOffset < 0.78 ? (0.78 - backOffset) * 0.44 : 0;
  const baseEyeY = (player.crouch ? 1.24 : 1.64) + jumpOffset + tightLift;
  const camX = clamp(clampedX - dx * backOffset + rx * shoulderOffset, -MAP_LIMIT_X, MAP_LIMIT_X);
  const camZ = clamp(clampedZ - dz * backOffset + rz * shoulderOffset, -MAP_LIMIT_Z, MAP_LIMIT_Z);

  const targetX = clamp(clampedX + dx * THIRD_PERSON_LOOK_AHEAD + rx * (shoulderOffset * 0.35), -MAP_LIMIT_X - 2, MAP_LIMIT_X + 2);
  const targetZ = clamp(clampedZ + dz * THIRD_PERSON_LOOK_AHEAD + rz * (shoulderOffset * 0.35), -MAP_LIMIT_Z - 2, MAP_LIMIT_Z + 2);
  const targetY = (player.crouch ? .92 : 1.28) + jumpOffset;

  return {
    position: { x: camX, y: baseEyeY, z: camZ },
    target: { x: targetX, y: targetY, z: targetZ },
    fov: 1.08,
  };
}

/**
 * Selects an unobstructed 3/4 tactical camera angle framing the bomb planter and the C4 spot
 * for the secondary Picture-in-Picture viewport.
 */
export function computeBombPlantPipPose(
  pip: BombPlantPipState,
  players: readonly LivePlayer[],
): CameraPose {
  const planter = pip.planterId ? players.find((p) => p.id === pip.planterId && p.hp > 0) : undefined;
  const spot = planter ? { x: planter.x, z: planter.z } : pip.spot;
  const baseYaw = planter ? planter.yaw : 0;
  const jumpOffset = planter?.jumpY ?? 0;

  // Prefer 3/4 front-diagonal angles so the viewer sees the crouched operative planting and site context.
  const angleOffsets = [
    2.35, -2.35, 1.57, -1.57, 2.85, -2.85, 0.9, -0.9, 0.35, -0.35, Math.PI, 0,
  ];
  const radii = [3.1, 2.4, 1.75];

  for (const r of radii) {
    for (const delta of angleOffsets) {
      const theta = baseYaw + delta;
      const cx = spot.x + Math.sin(theta) * r;
      const cz = spot.z + Math.cos(theta) * r;
      if (Math.abs(cx) > MAP_LIMIT_X || Math.abs(cz) > MAP_LIMIT_Z) continue;
      const camPt = { x: cx, z: cz };
      const blocked = LIVE_FPS_MAP.solids.some((w) => segmentHitsWall(spot, camPt, w, 0.28));
      if (!blocked) {
        return {
          position: { x: cx, y: 2.35 + jumpOffset * 0.4, z: cz },
          target: { x: spot.x, y: (planter?.crouch ? 0.68 : 0.95) + jumpOffset, z: spot.z },
          fov: 0.9,
        };
      }
    }
  }

  // Fallback high overhead close-angle on the site if surrounded tightly by site props.
  const fx = clamp(spot.x + 0.9, -MAP_LIMIT_X, MAP_LIMIT_X);
  const fz = clamp(spot.z - 1.4, -MAP_LIMIT_Z, MAP_LIMIT_Z);
  return {
    position: { x: fx, y: 3.9, z: fz },
    target: { x: spot.x, y: 0.65, z: spot.z },
    fov: 0.92,
  };
}

export function domRectToBabylonViewport(
  rect: { left: number; top: number; width: number; height: number },
  canvasRect: { left: number; top: number; width: number; height: number },
): NormalizedViewport | null {
  if (canvasRect.width <= 0 || canvasRect.height <= 0 || rect.width <= 2 || rect.height <= 2) {
    return null;
  }
  const left = clamp((rect.left - canvasRect.left) / canvasRect.width, 0, 1);
  const bottom = clamp(1 - (rect.top + rect.height - canvasRect.top) / canvasRect.height, 0, 1);
  const right = clamp((rect.left + rect.width - canvasRect.left) / canvasRect.width, 0, 1);
  const top = clamp(1 - (rect.top - canvasRect.top) / canvasRect.height, 0, 1);
  const width = Math.max(0, right - left);
  const height = Math.max(0, top - bottom);
  if (width <= 0.01 || height <= 0.01) {
    return null;
  }
  return { x: left, y: bottom, width, height };
}
