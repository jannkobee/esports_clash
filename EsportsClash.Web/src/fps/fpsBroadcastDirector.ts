import { LIVE_FPS_MAP, distance, liveSightline } from './fpsLiveMap.ts';
import { segmentHitsWall } from './fpsSpatialWorld.ts';
import { LIVE_TERRAIN_SOLIDS } from './fpsLiveTerrain.ts';
import type { LivePlayer, LiveSnapshot } from './fpsLiveSimulation.ts';
import type { FpsTeamId } from './fpsTypes.ts';

export type LiveCameraMode = 'director' | 'first' | 'third' | 'cinematic' | 'tactical' | 'free';

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
  fightLockId?: string;
  fightLockUntil: number;
  bombPlantSettledUntil: number;
  bombPlantSettleSite?: 'A' | 'B';
  bombPlantSettleSpot?: { x: number; z: number };
  bombPlantSettlePlanterId?: string;
  bombPlantSettlePlanterName?: string;
  bombPlantSettleTeam?: FpsTeamId;
  lastBombStatus?: LiveSnapshot['bomb']['status'];
  wideUntil?:number;
  widePoints?:{x:number;z:number}[];
  wideCooldownUntil?:number;
  wideEpisodeActive?:boolean;
  wideQuietSince?:number;
  lastFollowedAtById: Record<string, number>;
  lastFollowedTeam?: FpsTeamId;
  lastPhase?: LiveSnapshot['phase'];
}

export interface DirectorDecision {
  followedId: string;
  effectiveMode: Exclude<LiveCameraMode, 'director'>;
  pip: BombPlantPipState;
  engagements?:{x:number;z:number}[];
}

/** Spectator-only grouping: connected exchanges form one fight, not one fight per pair. */
function simultaneousFights(snapshot:LiveSnapshot,preview?:LiveSnapshot):{x:number;z:number;points:{x:number;z:number}[]}[] {
  const alive=snapshot.players.filter(p=>p.hp>0);
  const groups:{ids:Set<string>;x:number;z:number;weight:number}[]=[];
  for(let i=0;i<alive.length;i++)for(let j=i+1;j<alive.length;j++){
    const a=alive[i],b=alive[j],range=distance(a,b);
    if(a.team===b.team||range>32)continue;
    const imminent=preview?.events.some(e=>e.kind==='kill'&&e.time>snapshot.time&&e.time<snapshot.time+.9
      &&((e.actorId===a.id&&e.targetId===b.id)||(e.actorId===b.id&&e.targetId===a.id)));
    const shooting=snapshot.time-a.lastShot<.65||snapshot.time-b.lastShot<.65;
    if(!(imminent||shooting)||!liveSightline(a,b,(a.crouch?1.08:1.6)+(a.jumpY??0),(b.crouch?1.08:1.6)+(b.jumpY??0)))continue;
    const x=(a.x+b.x)/2,z=(a.z+b.z)/2,weight=imminent?3:1;
    const touching=groups.filter(g=>g.ids.has(a.id)||g.ids.has(b.id)||distance(g,{x,z})<10);
    if(!touching.length){groups.push({ids:new Set([a.id,b.id]),x,z,weight});continue;}
    const group=touching[0];group.ids.add(a.id);group.ids.add(b.id);
    group.x=(group.x*group.weight+x*weight)/(group.weight+weight);group.z=(group.z*group.weight+z*weight)/(group.weight+weight);group.weight+=weight;
    for(const other of touching.slice(1)){
      for(const id of other.ids)group.ids.add(id);
      group.x=(group.x*group.weight+other.x*other.weight)/(group.weight+other.weight);
      group.z=(group.z*group.weight+other.z*other.weight)/(group.weight+other.weight);group.weight+=other.weight;
      groups.splice(groups.indexOf(other),1);
    }
  }
  return groups.sort((a,b)=>b.weight-a.weight).slice(0,2).map(g=>({x:g.x,z:g.z,points:alive.filter(p=>g.ids.has(p.id)).map(p=>({x:p.x,z:p.z}))}));
}

export const PLANT_CHANNEL_DURATION = 3.2;
export const PLANT_SETTLE_WINDOW = 1.2;
export const DIRECTOR_MIN_CUT_INTERVAL = 1.2;
export const DIRECTOR_POST_KILL_BEAT = 1.4;
export const DIRECTOR_PREDICTIVE_CUT_INTERVAL = 0.28;
export const DIRECTOR_FIGHT_LOCK_DURATION = 2.2;
export const DIRECTOR_WIDE_DURATION = 1.25;
export const DIRECTOR_WIDE_COOLDOWN = 12;
export const DIRECTOR_WIDE_RESET_DELAY = 2;
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
    fightLockUntil: -100,
    bombPlantSettledUntil: -100,
    lastFollowedAtById: {},
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
  state.fightLockId = undefined;
  state.fightLockUntil = -100;
  state.bombPlantSettledUntil = -100;
  state.bombPlantSettleSite = undefined;
  state.bombPlantSettleSpot = undefined;
  state.bombPlantSettlePlanterId = undefined;
  state.bombPlantSettlePlanterName = undefined;
  state.bombPlantSettleTeam = undefined;
  state.lastBombStatus = snapshot.bomb.status;
  state.wideUntil=0;state.widePoints=undefined;state.wideCooldownUntil=0;state.wideEpisodeActive=false;state.wideQuietSince=undefined;
  state.lastFollowedAtById = {};
  state.lastFollowedTeam = undefined;
  state.lastPhase = snapshot.phase;
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
      const enemyLookX = Math.sin(enemy.yaw);
      const enemyLookZ = Math.cos(enemy.yaw);
      const enemyAimDot = (player.x - enemy.x) * invLen * enemyLookX + (player.z - enemy.z) * invLen * enemyLookZ;
      const preFightBonus = dist < 23
        ? (aimDot > 0.74 ? 2.8 : aimDot > 0.52 ? 1.5 : 0) + (enemyAimDot > 0.72 ? 1.6 : 0)
        : 0;
      const candidateDuel = sightBase + aimBonus + finishBonus + mutualShot + preFightBonus;
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

  const rotDelta = Math.atan2(Math.sin(player.yaw), Math.cos(player.yaw));
  void rotDelta;
  let scopeBonus = 0;
  if ((player.equipped === 'sniper' || player.equipped === 'scout') && player.scopeState === 'scoped') {
    const clearLane = enemies.some((enemy) => {
      const dist = distance(player, enemy);
      if (dist > 44 || dist < 0.1) return false;
      const aimDot = ((enemy.x - player.x) * lookX + (enemy.z - player.z) * lookZ) / dist;
      return aimDot > 0.35 && liveSightline(player, enemy);
    });
    const watchingDirection = enemies.some((enemy) => {
      const dist = distance(player, enemy);
      if (dist > 48 || dist < 0.1) return false;
      const aimDot = ((enemy.x - player.x) * lookX + (enemy.z - player.z) * lookZ) / dist;
      return aimDot > 0.35;
    });
    scopeBonus = clearLane ? 2.2 : watchingDirection ? 0.55 : 0.35;
  }

  const utilCount = player.flash + player.smoke + player.incendiary + player.he;
  const recentThrow = player.throwAt !== undefined && snapshot.time - player.throwAt < 1.15;
  const liningUtility = Boolean(player.utilityPrep) || player.action === 'Throwing utility' || recentThrow || player.action.toLowerCase().includes('smoke');
  const utilityExecuteBonus = liningUtility && nearestThreat < 54 ? 1.85 : 0;

  let combatRoleBonus = 0;
  if (player.action === 'Engaging' || player.action === 'Trading') combatRoleBonus = 1.9;
  else if (player.action === 'Peeking' || player.action === 'Clearing' || player.action === 'Flanking') combatRoleBonus = 1.35;
  else if (player.action === 'Defusing' && snapshot.bomb.status === 'planted') combatRoleBonus = nearestThreat < 18 ? 2.8 : 1.25;
  else if (snapshot.bomb.status === 'planted' && (player.action === 'Retaking' || player.action === 'Holding post-plant')) combatRoleBonus = 1.35;

  const targetSite = snapshot.teams[snapshot.attackTeam]?.site ?? snapshot.bomb.site ?? 'A';
  const siteDist = distance(player, LIVE_FPS_MAP.sites[targetSite]);
  const attackPushBonus = player.attacking && nearestThreat > 11 && siteDist < 26
    ? clamp((26 - siteDist) / 26, 0, 1) * (player.role === 'entry' || player.bomb ? 0.85 : 0.55)
    : 0;
  const sidearmStarBonus = (player.equipped === 'deagle' || player.equipped === 'tec9' || player.equipped === 'fiveseven' || player.equipped === 'cz75') && nearestThreat < 26 ? 0.42 : 0;

  const frontLineScore = nearestThreat < 42 ? clamp((42 - nearestThreat) / 42, 0, 1) * 3.1 : 0;

  // Keep bomb planters off the main broadcast camera unless literally nobody else can fight.
  const planterPenalty = isActivelyPlanting(player) ? -14 : 0;

  // Decay stickiness when dwelling on a quiet player so the observer alternates across both teams and storylines.
  const dwellTime = player.id === existingId ? Math.max(0, snapshot.time - state.cutAt) : 0;
  const existingDwell = Math.max(0, snapshot.time - state.cutAt);
  const isQuietSubject = duelScore === 0 && firingScore === 0 && killMomentum === 0 && !liningUtility;
  const stickyBonus = player.id === existingId && planterPenalty === 0 && !(isQuietSubject && dwellTime > 3.2) ? 1.05 : 0;
  const stagnationPenalty = player.id === existingId && isQuietSubject && dwellTime > 3.2 ? -Math.min(2.8, (dwellTime - 3.2) * 0.72) : 0;
  const lastVisitAge = snapshot.time - (state.lastFollowedAtById[player.id] ?? -100);
  const revisitPenalty = player.id !== existingId && duelScore === 0 && firingScore === 0 && !liningUtility && lastVisitAge >= 0 && lastVisitAge < 9
    ? -0.95 * (1 - lastVisitAge / 9)
    : 0;
  const teamContrastBonus = player.id !== existingId && isQuietSubject && state.lastFollowedTeam && player.team !== state.lastFollowedTeam && existingDwell > 2.4 && utilCount >= 0
    ? 0.58
    : 0;

  // Mild preference toward active entry / sniper / playmakers when idle, balanced across teams.
  const roleBias = player.role === 'entry' || player.role === 'sniper' || player.role === 'trade' ? 0.25 : 0;

  return duelScore + firingScore + killMomentum + combatRoleBonus + frontLineScore + scopeBonus + utilityExecuteBonus + attackPushBonus + sidearmStarBonus + planterPenalty + stickyBonus + stagnationPenalty + revisitPenalty + teamContrastBonus + roleBias;
}

function predictsDirectorFight(player: LivePlayer, snapshot: LiveSnapshot): boolean {
  if (player.hp <= 0) return false;
  const lookX = Math.sin(player.yaw), lookZ = Math.cos(player.yaw);
  return snapshot.players.some((enemy) => {
    if (enemy.hp <= 0 || enemy.team === player.team) return false;
    const dist = distance(player, enemy);
    if (dist > 23 || !liveSightline(player, enemy)) return false;
    const invLen = dist > 0.01 ? 1 / dist : 0;
    const aimDot = (enemy.x - player.x) * invLen * lookX + (enemy.z - player.z) * invLen * lookZ;
    const enemyAimDot = Math.cos(Math.atan2(player.x - enemy.x, player.z - enemy.z) - enemy.yaw);
    return (dist < 15 && aimDot > 0.48) || (aimDot > 0.72 && enemyAimDot > 0.58);
  });
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

function pickFreezeDirectorPlayer(snapshot: LiveSnapshot, state: DirectorState): LivePlayer {
  const alive = snapshot.players.filter((p) => p.hp > 0);
  if (alive.length === 0) return snapshot.players[0];

  const existing = alive.find((p) => p.id === state.followedId);
  const sinceCut = snapshot.time - state.cutAt;
  const passInProgress = alive.find((p) => p.action === 'Passing a bought weapon' && p.id !== state.followedId);

  if (existing && state.cutAt >= 0 && sinceCut < (passInProgress ? 1.15 : 2.25)) {
    return existing;
  }

  const starterTeam: FpsTeamId = snapshot.round % 2 === 1 ? snapshot.attackTeam : (snapshot.attackTeam === 'blue' ? 'red' : 'blue');
  const scoreBuyer = (p: LivePlayer): number => {
    let score = 0;
    if (p.action === 'Passing a bought weapon') score += 2.6;
    else if (p.action === 'Coordinating equipment') score += 1.05;
    if (p.weapon === 'deagle' || p.equipped === 'deagle') score += 1.25;
    else if (p.weapon === 'sniper' || p.equipped === 'sniper') score += 1.15;
    else if (p.weapon === 'tec9' || p.weapon === 'fiveseven' || p.weapon === 'cz75' || p.weapon === 'p250') score += 0.9;
    else if (p.weapon === 'ak47' || p.weapon === 'm4a1_s' || p.weapon === 'scout') score += 0.65;
    if (p.bomb) score += 0.5;
    if (p.flash + p.smoke + p.incendiary + p.he >= 2) score += 0.55;
    if (p.role === 'entry' || p.role === 'sniper' || p.role === 'caller') score += 0.25;

    if (!state.lastFollowedTeam || state.cutAt < 0) {
      if (p.team === starterTeam) score += 1.8;
    } else if (p.team !== state.lastFollowedTeam) {
      score += 2.5;
    }

    const lastSeen = state.lastFollowedAtById[p.id] ?? -100;
    if (lastSeen >= snapshot.time - 14.5) score -= 2.2;
    if (p.id === state.followedId) score -= 1.8;
    return score;
  };

  const next = [...alive].sort((a, b) => scoreBuyer(b) - scoreBuyer(a) || a.id.localeCompare(b.id))[0]!;
  if (next.id !== state.followedId || state.cutAt < 0) {
    state.followedId = next.id;
    state.cutAt = snapshot.time;
  }
  return next;
}

function pickDirectorFollowedPlayer(snapshot: LiveSnapshot, state: DirectorState,preview?:LiveSnapshot): LivePlayer {
  if (snapshot.phase === 'freeze') {
    return pickFreezeDirectorPlayer(snapshot, state);
  }
  const players = snapshot.players;
  const alive = players.filter((p) => p.hp > 0);
  if (alive.length === 0) {
    return players[0];
  }

  const existing = players.find((p) => p.id === state.followedId);

  // Never keep the main camera stranded on a bomb planter while another alive player can frag.
  const nonPlanters = alive.filter((p) => !isActivelyPlanting(p));
  const pool = nonPlanters.length > 0 ? nonPlanters : alive;

  const tiePivot = (snapshot.round * 3 + Math.floor(Math.max(0, snapshot.time) / 4)) % 2;
  const ranked = [...pool]
    .map((p) => ({
      player: p,
      score: scoreDirectorKillPriority(p, snapshot, state, state.followedId),
    }))
    .sort((a, b) => b.score - a.score || Number(tiePivot ? a.player.attacking : !a.player.attacking) - Number(tiePivot ? b.player.attacking : !b.player.attacking));

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

  // Only the spectator reads the buffered future. AI never receives this preview.
  const upcoming=preview?.events.filter(event=>event.kind==='kill'&&event.actorId&&event.time>snapshot.time+.06&&event.time<=snapshot.time+1.15)
    .sort((a,b)=>a.time-b.time);
  const nextKill=upcoming?.find(event=>pool.some(player=>player.id===event.actorId));
  if(nextKill){
    const shooter=pool.find(player=>player.id===nextKill.actorId)!;
    if(shooter.id===existing.id||snapshot.time-state.cutAt>=.32){
      if(shooter.id!==existing.id){state.followedId=shooter.id;state.cutAt=snapshot.time;}
      state.fightLockId=shooter.id;state.fightLockUntil=nextKill.time+.55;
      return shooter;
    }
  }
  const lockedFight = players.find((p) => p.id === state.fightLockId && p.hp > 0 && !isActivelyPlanting(p));
  if (lockedFight && snapshot.time < state.fightLockUntil) return lockedFight;
  state.fightLockId = undefined;

  const existingEntry = ranked.find((entry) => entry.player.id === existing.id);
  const existingScore = existingEntry?.score ?? scoreDirectorKillPriority(existing, snapshot, state, state.followedId);
  const sinceCut = snapshot.time - state.cutAt;

  // Pre-cut to upcoming shot/utility/objective action in look-ahead buffer when currently watching quiet play.
  const upcomingShotActorId = preview?.shots?.find(shot => shot.time > snapshot.time && shot.time <= snapshot.time + 0.85 && pool.some(p => p.id === shot.actorId))?.actorId;
  const upcomingActionActorId = upcomingShotActorId ?? preview?.events.find(event => (event.kind === 'utility' || event.kind === 'objective') && event.actorId && event.time > snapshot.time + .04 && event.time <= snapshot.time + .85 && pool.some(p => p.id === event.actorId))?.actorId;
  if (upcomingActionActorId && existingScore < 4.5 && sinceCut >= 0.85) {
    const actor = pool.find(p => p.id === upcomingActionActorId)!;
    if (actor.id !== existing.id) {
      state.followedId = actor.id;
      state.cutAt = snapshot.time;
      return actor;
    }
  }

  // Immediate killer spotlight when another player scores a fresh kill while our subject isn't locked in a direct duel.
  const bestKillAge = snapshot.time - (state.lastKillAtById[best.player.id] ?? -100);
  const urgentKillCut =
    best.player.id !== existing.id &&
    bestKillAge >= 0 &&
    bestKillAge <= 0.45 &&
    existingScore < 7.0 &&
    sinceCut >= 0.4;

  const bestPredictsFight = predictsDirectorFight(best.player, snapshot);
  const predictiveCut = best.player.id !== existing.id && bestPredictsFight && !predictsDirectorFight(existing, snapshot)
    && sinceCut >= DIRECTOR_PREDICTIVE_CUT_INTERVAL;
  const staleRotate = sinceCut > 3.6 && existingScore < 3.6 && (best.score > existingScore + 0.18 || (sinceCut > 4.2 && best.score > existingScore - 0.12));
  const tacticalCut =
    best.player.id !== existing.id &&
    (staleRotate || (sinceCut >= (bestPredictsFight ? DIRECTOR_PREDICTIVE_CUT_INTERVAL : DIRECTOR_MIN_CUT_INTERVAL) &&
    best.score > existingScore + 1.15));

  if (urgentKillCut || predictiveCut || tacticalCut) {
    state.followedId = best.player.id;
    state.cutAt = snapshot.time;
    if (bestPredictsFight) {
      state.fightLockId = best.player.id;
      state.fightLockUntil = snapshot.time + DIRECTOR_FIGHT_LOCK_DURATION;
    }
    return best.player;
  }

  const activeExchange = snapshot.time - existing.lastShot < 0.85 || existing.action === 'Engaging' || existing.action === 'Trading';
  if (activeExchange && predictsDirectorFight(existing, snapshot)) {
    state.fightLockId = existing.id;
    state.fightLockUntil = snapshot.time + DIRECTOR_FIGHT_LOCK_DURATION;
  }

  return existing;
}

export function chooseDirectorCameraMode(
  followed: LivePlayer,
  snapshot: LiveSnapshot,
  state: DirectorState,
  preview?:LiveSnapshot,
): Exclude<LiveCameraMode, 'director'> {
  if (snapshot.phase === 'freeze') {
    return 'third';
  }
  if(snapshot.phase==='finished')return 'cinematic';
  if (snapshot.phase === 'post') {
    const withinKillBeat = followed.hp > 0 && snapshot.time - state.lastKillCutAt <= DIRECTOR_POST_KILL_BEAT;
    return withinKillBeat ? 'first' : 'cinematic';
  }

  const fights=simultaneousFights(snapshot,preview);
  const multiple=fights.length>=2&&distance(fights[0],fights[1])>10&&distance(fights[0],fights[1])<58;
  const newEpisode=multiple&&!state.wideEpisodeActive;
  if(multiple){state.wideEpisodeActive=true;state.wideQuietSince=undefined;}
  else{
    state.wideQuietSince??=snapshot.time;
    if(snapshot.time-state.wideQuietSince>=DIRECTOR_WIDE_RESET_DELAY)state.wideEpisodeActive=false;
  }
  const alive=snapshot.players.filter(p=>p.hp>0);
  const clutch=(['blue','red'] as const).some(team=>alive.filter(p=>p.team===team).length<=1);
  const imminentKill=preview?.events.some(event=>event.kind==='kill'&&event.time>snapshot.time&&event.time<=snapshot.time+1.05);
  const killBeat=snapshot.time>=state.lastKillCutAt&&snapshot.time-state.lastKillCutAt<=DIRECTOR_POST_KILL_BEAT;
  const closeCoverage=clutch||imminentKill||killBeat||followed.channel>0||followed.action==='Defusing';
  if(multiple&&!closeCoverage&&state.widePoints&&snapshot.time<(state.wideUntil??0)){
    state.widePoints=fights.flatMap(fight=>fight.points);
    return 'tactical';
  }
  // The deadline belongs to the cut, never to the latest frame of combat.
  // A continuing fight cannot restart the overview after its deadline/cooldown.
  state.wideUntil=0;state.widePoints=undefined;
  if(newEpisode&&!closeCoverage&&snapshot.time>=(state.wideCooldownUntil??0)){
    state.wideUntil=snapshot.time+DIRECTOR_WIDE_DURATION;
    state.wideCooldownUntil=state.wideUntil+DIRECTOR_WIDE_COOLDOWN;
    state.widePoints=fights.flatMap(fight=>fight.points);
    return 'tactical';
  }
  if(preview?.events.some(event=>event.kind==='kill'&&event.actorId===followed.id&&event.time>snapshot.time&&event.time<=snapshot.time+1.05))return 'first';
  const recentShot = snapshot.time - followed.lastShot < 2.2;
  const activeCombatAction =
    followed.action === 'Engaging' ||
    followed.action === 'Peeking' ||
    followed.action === 'Clearing' ||
    followed.action === 'Trading' ||
    followed.action === 'Flanking' ||
    followed.action === 'Retaking' ||
    followed.action === 'Defusing' ||
    followed.action === 'Holding' ||
    followed.action === 'Holding post-plant';

  const followedEyeY = (followed.crouch ? 1.08 : 1.6) + (followed.jumpY ?? 0);
  const enemies = snapshot.players.filter((e) => e.hp > 0 && e.team !== followed.team);
  const hasSightline = enemies.some((e) => distance(followed, e) < 38 && liveSightline(followed, e, followedEyeY, (e.crouch ? 1.08 : 1.6) + (e.jumpY ?? 0)));
  const previewDuel = preview?.events.some((event) => event.kind === 'kill' && (event.actorId === followed.id || event.targetId === followed.id) && event.time > snapshot.time && event.time <= snapshot.time + 1.4)
    || preview?.shots?.some((shot) => shot.actorId === followed.id && shot.time > snapshot.time && shot.time <= snapshot.time + 0.9);
  const imminentContact = Boolean(previewDuel) || enemies.some((e) => distance(followed, e) < 12.5);
  const recentThrow = followed.throwAt !== undefined && snapshot.time - followed.throwAt < 1.1;
  const scopedOrUtility = followed.scopeState === 'scoped' || Boolean(followed.utilityPrep) || recentThrow;

  if (preview || recentShot || hasSightline || activeCombatAction || imminentContact || scopedOrUtility) {
    return 'first';
  }
  return 'third';
}

export function evaluateBroadcastDirector(
  snapshot: LiveSnapshot,
  state: DirectorState,
  mode: LiveCameraMode,
  selectedId: string,
  preview?:LiveSnapshot,
): DirectorDecision {
  if (snapshot.time < state.cutAt - 0.5 || (snapshot.round === 1 && state.round > 1)) {
    resetForNewMatch(state, snapshot);
  }
  if (snapshot.round !== state.round) {
    state.round = snapshot.round;
    state.cutAt = -100;
    state.lastKillCutAt = -100;
    state.fightLockId = undefined;
    state.fightLockUntil = -100;
    state.bombPlantSettledUntil = -100;
    state.lastBombStatus = snapshot.bomb.status;
    state.wideUntil=0;state.widePoints=undefined;state.wideCooldownUntil=0;state.wideEpisodeActive=false;state.wideQuietSince=undefined;
    state.lastPhase = snapshot.phase;
    state.lastFollowedTeam = undefined;
  } else if (state.lastPhase && state.lastPhase !== snapshot.phase) {
    if (snapshot.phase === 'live') {
      state.cutAt = -100;
      state.lastFollowedTeam = undefined;
    }
    state.lastPhase = snapshot.phase;
  } else {
    state.lastPhase = snapshot.phase;
  }

  syncDirectorKillEvents(snapshot, state);
  const rawPip = selectBombPlantPip(snapshot, state);

  const players = snapshot.players;
  const alive = players.filter((p) => p.hp > 0);

  let followed: LivePlayer;
  if (mode === 'director') {
    followed = pickDirectorFollowedPlayer(snapshot, state,preview);
  } else {
    const selectedPlayer = players.find((p) => p.id === selectedId);
    followed =
      selectedPlayer && selectedPlayer.hp > 0
        ? selectedPlayer
        : alive.find((p) => p.team === selectedPlayer?.team) ?? alive[0] ?? players[0];
    state.followedId = followed.id;
  }
  state.lastFollowedAtById[followed.id] = snapshot.time;
  state.lastFollowedTeam = followed.team;

  if(mode!=='director')state.wideUntil=0;
  if(mode==='tactical')state.widePoints=simultaneousFights(snapshot,preview).flatMap(fight=>fight.points);
  const effectiveMode = mode === 'director' ? chooseDirectorCameraMode(followed, snapshot, state,preview) : mode;
  // Never display Bomb Plant PIP when the main camera is already following the bomb planter.
  const pip = rawPip.active && rawPip.planterId && followed.id === rawPip.planterId && (effectiveMode === 'first' || effectiveMode === 'third')
    ? { ...rawPip, active: false }
    : rawPip;

  return {
    followedId: followed.id,
    effectiveMode,
    pip,
    engagements:effectiveMode==='tactical'?state.widePoints:undefined,
  };
}

/** Post-round & landmark compositions: multi-angle framing across sites and mid, smooth drift, clear foregrounds. */
export function computeCinematicCameraPose(time:number,round:number,site?:'A'|'B'):CameraPose {
  const area=site??(round%2?'A':'B');
  const beat=Math.floor(time/4.5+round)%3;
  const target=beat===2&&!site?{x:0,y:1.5,z:4}:area==='A'?{x:-23,y:2.8,z:25.2}:{x:23,y:1.6,z:20.1};
  const candidates=beat===2&&!site
    ?[{x:-4.2,y:3.6,z:-5.5},{x:4.4,y:3.8,z:12.8}]
    :area==='A'
      ?[{x:-20.6,y:3.4,z:19.3},{x:-24.2,y:3.5,z:17.2},{x:-17.5,y:3.9,z:29.5}]
      :[{x:26.7,y:2.6,z:15.5},{x:19.8,y:2.6,z:16.2},{x:27.5,y:3.2,z:25.4}];
  if(round%2===0)candidates.reverse();
  const position=candidates.find(point=>liveSightline(point,target,point.y,target.y))??{...candidates[0],y:candidates[0].y+2};
  const drift=Math.sin(time*.38)*.32;
  const shifted={x:position.x+drift,y:position.y+Math.cos(time*.24)*.08,z:position.z};
  return {position:liveSightline(shifted,target,shifted.y,target.y)?shifted:position,target,fov:.82};
}

/**
 * Hero front-3/4 broadcast showcase cam for FREEZE/BUY PHASE: frames the buyer,
 * dropped weapons, and utility prep with a gentle orbital pan instead of static back walls.
 */
export function computeFreezeShowcasePose(player: LivePlayer, time: number): CameraPose {
  const clampedX = clamp(player.x, -MAP_LIMIT_X, MAP_LIMIT_X);
  const clampedZ = clamp(player.z, -MAP_LIMIT_Z, MAP_LIMIT_Z);
  const jumpOffset = player.jumpY ?? 0;
  const orbit = Math.sin(time * 0.52) * 0.48;
  const frontOffsets = [0.65, -0.65, 1.15, -1.15, 2.2, -2.2];
  const radii = [2.25, 1.85, 1.45];

  for (const radius of radii) {
    for (const baseOffset of frontOffsets) {
      const theta = player.yaw + baseOffset + orbit * 0.4;
      const cx = clamp(clampedX + Math.sin(theta) * radius, -MAP_LIMIT_X, MAP_LIMIT_X);
      const cz = clamp(clampedZ + Math.cos(theta) * radius, -MAP_LIMIT_Z, MAP_LIMIT_Z);
      const camY = (player.crouch ? 1.18 : 1.42) + jumpOffset;
      const blocked = [...LIVE_FPS_MAP.solids, ...LIVE_TERRAIN_SOLIDS].some(
        (w) => camY >= (w.baseY ?? 0) - 0.22 && camY <= w.height + 0.22 && segmentHitsWall(player, { x: cx, z: cz }, w, 0.24),
      );
      if (!blocked && Math.hypot(cx - clampedX, cz - clampedZ) >= 1.15) {
        return {
          position: { x: cx, y: camY, z: cz },
          target: { x: clampedX, y: (player.crouch ? 0.96 : 1.24) + jumpOffset, z: clampedZ },
          fov: 0.92,
        };
      }
    }
  }
  return computeThirdPersonCameraPose(player);
}

/** Oblique coverage fitted to the two exchanges, with space reserved for the HUD. */
export function computeTacticalCameraPose(points:readonly {x:number;z:number}[],aspect:number):CameraPose {
  const minX=Math.min(...points.map(p=>p.x))-7,maxX=Math.max(...points.map(p=>p.x))+7;
  const minZ=Math.min(...points.map(p=>p.z))-8,maxZ=Math.max(...points.map(p=>p.z))+8;
  const x=(minX+maxX)/2,z=(minZ+maxZ)/2;
  const half=Math.max((maxX-minX)/2/Math.max(.6,aspect),(maxZ-minZ)*.43+3)*1.22;
  const range=half/Math.tan(.49);
  return {position:{x,y:1.6+range*.85,z:z-range*.53},target:{x,y:1.6,z},fov:.98};
}

export function computeOverviewCameraPose(aspect=16/9): CameraPose {
  const halfHeight=Math.max(49,45/Math.max(.35,aspect))*1.15;
  return {
    position: { x: 0, y: halfHeight/Math.tan(.49), z: -9 },
    target: { x: 0, y: 0, z: 0 },
    fov: .98,
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
    const eyeY=(player.crouch?1.24:1.64)+jumpOffset;
    return [...LIVE_FPS_MAP.solids,...LIVE_TERRAIN_SOLIDS].some((w) => eyeY>=(w.baseY??0)-.22&&eyeY<=w.height+.22&&segmentHitsWall(player, { x: camX, z: camZ }, w, 0.22));
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
  const totalPitch = (player.pitch ?? 0) + (player.recoilPitch ?? 0);
  const baseEyeY = (player.crouch ? 1.24 : 1.64) + jumpOffset + tightLift - Math.max(0, Math.sin(totalPitch)) * 0.26;
  const camX = clamp(clampedX - dx * backOffset + rx * shoulderOffset, -MAP_LIMIT_X, MAP_LIMIT_X);
  const camZ = clamp(clampedZ - dz * backOffset + rz * shoulderOffset, -MAP_LIMIT_Z, MAP_LIMIT_Z);

  const horizLookAhead = THIRD_PERSON_LOOK_AHEAD * Math.max(0.35, Math.cos(totalPitch));
  const targetX = clamp(clampedX + dx * horizLookAhead + rx * (shoulderOffset * 0.35), -MAP_LIMIT_X - 2, MAP_LIMIT_X + 2);
  const targetZ = clamp(clampedZ + dz * horizLookAhead + rz * (shoulderOffset * 0.35), -MAP_LIMIT_Z - 2, MAP_LIMIT_Z + 2);
  const targetY = (player.crouch ? .92 : 1.28) + jumpOffset + Math.sin(totalPitch) * THIRD_PERSON_LOOK_AHEAD;

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
