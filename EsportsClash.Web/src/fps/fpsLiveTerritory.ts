import type { FpsTendencyValues } from './fpsIdentity.ts';
import type { LiveEnemyEconomyRead } from './fpsLiveEconomyRead.ts';
import {
  influenceCellIndex,
  sampleInfluenceDanger,
  sampleInfluenceUncertainty,
  type LiveTeamInfluenceGrid,
} from './fpsLiveInfluenceMap.ts';
import type { LiveIntelAssessment, LiveIntelBelief } from './fpsLiveIntel.ts';
import { distance } from './fpsLiveMap.ts';
import type { LiveMapRuntime } from './fpsLiveMapTypes.ts';
import type { LiveDefensePlay } from './fpsLivePlays.ts';
import type { FpsPosition } from './fpsPlayerArchitecture.ts';
import type { FpsRoundDuty } from './fpsRoundResponsibilities.ts';
import type { FpsPoint } from './fpsSpatialWorld.ts';

export type LiveZoneId =
  | 'A_SITE'
  | 'A_FORWARD'
  | 'A_DEEP'
  | 'MID_CONTROL'
  | 'B_SITE'
  | 'B_FORWARD'
  | 'B_DEEP';

export type LiveZoneStatus = 'unknown' | 'contested' | 'cleared' | 'stale';

export interface LiveControlZone {
  id: LiveZoneId;
  area: 'A' | 'B' | 'Mid';
  depth: 'site' | 'forward' | 'deep';
  anchor: FpsPoint;
  fallback: FpsPoint;
  watch: FpsPoint;
  wrapTarget?: FpsPoint;
}

export interface LiveTerritoryAssignment {
  actorId: string;
  zoneId: LiveZoneId;
  role: 'pair_lead' | 'pair_trade' | 'info_creep' | 'deep_flank' | 'hold';
  point: FpsPoint;
  fallback: FpsPoint;
  watch: FpsPoint;
  partnerId?: string;
  until: number;
  creep: boolean;
  reason: string;
}

export interface LiveZoneRecord {
  status: LiveZoneStatus;
  clearedAt: number;
  lastContestedAt: number;
  clearedBy?: string;
}

export interface LiveTeamTerritoryState {
  zones: Record<LiveZoneId, LiveZoneRecord>;
  assignments: Map<string, LiveTerritoryAssignment>;
  lastPlanAt: number;
  lastZoneRefreshAt: number;
  clearedLanes: Set<'A' | 'B' | 'Mid'>;
}

const ALL_ZONE_IDS: readonly LiveZoneId[] = [
  'A_SITE',
  'A_FORWARD',
  'A_DEEP',
  'MID_CONTROL',
  'B_SITE',
  'B_FORWARD',
  'B_DEEP',
];

const unit = (t: FpsTendencyValues | undefined, key: string, fallback = 50): number =>
  (t?.[key] ?? fallback) / 100;

/** Derives 7 contiguous map control zones directly from static map geometry spanning BOTH halves (works on any map). */
export function buildMapControlZones(runtime: LiveMapRuntime): Record<LiveZoneId, LiveControlZone> {
  const t = runtime.definition.tactical;
  const sites = runtime.definition.sites;
  const atkSpawn = runtime.definition.spawns.attackers;
  const defSpawn = runtime.definition.spawns.defenders;
  const spanZ = defSpawn.z - atkSpawn.z || 1;
  const sideFrac = (p: FpsPoint): number => (p.z - atkSpawn.z) / spanZ; // 0 = T spawn, 0.5 = mid, 1 = CT spawn
  const reachableFromCT = (p: FpsPoint): boolean => Number.isFinite(runtime.pathLength(defSpawn, p));

  const pickReachable = (candidates: readonly (FpsPoint | undefined)[], fallback: FpsPoint): FpsPoint => {
    for (const raw of candidates) {
      if (!raw) continue;
      const safe = runtime.safePoint(raw);
      if (reachableFromCT(safe)) return safe;
    }
    return runtime.safePoint(fallback);
  };

  const blendToward = (from: FpsPoint, to: FpsPoint, alpha: number): FpsPoint =>
    runtime.safePoint({ x: from.x + (to.x - from.x) * alpha, z: from.z + (to.z - from.z) * alpha });

  const tMidWrap = pickReachable([t.mid.approach, blendToward(t.mid.control, atkSpawn, 0.55)], t.mid.approach);

  // Forward contest points sit at or slightly across mid into T-approach space (never stuck inside CT site doorways).
  const aBaseFwd = pickReachable([t.lurkPoints.A[0], t.A.rally[0], t.A.staging[0], t.A.entries[0]], sites.A);
  const bBaseFwd = pickReachable([t.lurkPoints.B[0], t.B.rally[0], t.B.staging[0], t.B.entries[0]], sites.B);
  const aForward = sideFrac(aBaseFwd) > 0.52
    ? pickReachable([blendToward(t.A.staging[0] ?? aBaseFwd, tMidWrap, 0.35), blendToward(aBaseFwd, atkSpawn, 0.3), aBaseFwd], aBaseFwd)
    : aBaseFwd;
  const bForward = sideFrac(bBaseFwd) > 0.52
    ? pickReachable([blendToward(t.B.staging[0] ?? bBaseFwd, tMidWrap, 0.35), blendToward(bBaseFwd, atkSpawn, 0.3), bBaseFwd], bBaseFwd)
    : bBaseFwd;

  // Deep points push genuinely across mid into T-side lanes/approaches so CTs can clear lanes and wrap behind executes.
  const aStage = pickReachable([t.A.staging[0], t.A.rally[0]], aForward);
  const bStage = pickReachable([t.B.staging[0], t.B.rally[0]], bForward);
  const aDeep = sideFrac(aStage) > 0.38
    ? pickReachable([blendToward(aStage, atkSpawn, 0.38), blendToward(aStage, tMidWrap, 0.55), aStage], aStage)
    : pickReachable([blendToward(aStage, atkSpawn, 0.35), blendToward(aStage, tMidWrap, 0.35), aStage], aStage);
  const bDeep = sideFrac(bStage) > 0.38
    ? pickReachable([blendToward(bStage, atkSpawn, 0.38), blendToward(bStage, tMidWrap, 0.35), bStage], bStage)
    : pickReachable([blendToward(bStage, atkSpawn, 0.35), blendToward(bStage, tMidWrap, 0.35), bStage], bStage);

  const midBase = pickReachable([t.mid.control], t.mid.control);
  const midControl = sideFrac(midBase) > 0.48
    ? pickReachable([blendToward(midBase, tMidWrap, 0.35), midBase], midBase)
    : midBase;

  return {
    A_SITE: {
      id: 'A_SITE',
      area: 'A',
      depth: 'site',
      anchor: runtime.safePoint(t.A.holds[0] ?? sites.A),
      fallback: runtime.safePoint(t.A.retakeStaging[0] ?? sites.A),
      watch: runtime.safePoint(t.A.entries[0] ?? sites.A),
    },
    A_FORWARD: {
      id: 'A_FORWARD',
      area: 'A',
      depth: 'forward',
      anchor: aForward,
      fallback: runtime.safePoint(t.A.holds[0] ?? t.A.retakeStaging[0] ?? sites.A),
      watch: aDeep,
      wrapTarget: tMidWrap,
    },
    A_DEEP: {
      id: 'A_DEEP',
      area: 'A',
      depth: 'deep',
      anchor: aDeep,
      fallback: aForward,
      watch: tMidWrap,
      wrapTarget: tMidWrap,
    },
    MID_CONTROL: {
      id: 'MID_CONTROL',
      area: 'Mid',
      depth: 'forward',
      anchor: midControl,
      fallback: runtime.safePoint(t.mid.window.hold),
      watch: tMidWrap,
      wrapTarget: tMidWrap,
    },
    B_SITE: {
      id: 'B_SITE',
      area: 'B',
      depth: 'site',
      anchor: runtime.safePoint(t.B.holds[0] ?? sites.B),
      fallback: runtime.safePoint(t.B.retakeStaging[0] ?? sites.B),
      watch: runtime.safePoint(t.B.entries[0] ?? sites.B),
    },
    B_FORWARD: {
      id: 'B_FORWARD',
      area: 'B',
      depth: 'forward',
      anchor: bForward,
      fallback: runtime.safePoint(t.B.holds[0] ?? t.B.retakeStaging[0] ?? sites.B),
      watch: bDeep,
      wrapTarget: tMidWrap,
    },
    B_DEEP: {
      id: 'B_DEEP',
      area: 'B',
      depth: 'deep',
      anchor: bDeep,
      fallback: bForward,
      watch: tMidWrap,
      wrapTarget: tMidWrap,
    },
  };
}

export function createTeamTerritoryState(now = 0): LiveTeamTerritoryState {
  const zones = {} as Record<LiveZoneId, LiveZoneRecord>;
  for (const id of ALL_ZONE_IDS) {
    zones[id] = { status: 'unknown', clearedAt: -100, lastContestedAt: -100 };
  }
  return {
    zones,
    assignments: new Map(),
    lastPlanAt: now,
    lastZoneRefreshAt: now,
    clearedLanes: new Set(),
  };
}

/**
 * Refreshes lawful zone clearance / contestation from team influence grid and active beliefs.
 * Returns forward/deep zone IDs that newly flipped to `'cleared'` on this refresh.
 */
export function refreshTeamTerritoryZones(
  state: LiveTeamTerritoryState,
  zones: Readonly<Record<LiveZoneId, LiveControlZone>>,
  grid: LiveTeamInfluenceGrid,
  beliefs: readonly LiveIntelBelief[],
  allies: readonly { id: string; x: number; z: number; level?: FpsPoint['level'] }[],
  now: number,
  roundLiveAt = 0,
): LiveZoneId[] {
  state.lastZoneRefreshAt = now;
  const newlyCleared: LiveZoneId[] = [];
  state.clearedLanes.clear();

  for (const id of ALL_ZONE_IDS) {
    const zone = zones[id];
    const rec = state.zones[id];
    const hasContact =
      beliefs.some(b => b.age < 4.5 && b.certainty >= 0.35 && distance(b, zone.anchor) < 14) ||
      sampleInfluenceDanger(grid, zone.anchor, now) >= 0.45;

    if (hasContact) {
      rec.status = 'contested';
      rec.lastContestedAt = now;
      continue;
    }

    const idx = influenceCellIndex(grid, zone.anchor);
    const cellClearedAt = grid.lastClearedAt[idx];
    const nearAlly = allies.find(a => distance(a, zone.anchor) < 10);
    // resetLiveInfluenceGrid initializes lastClearedAt to roundLiveAt everywhere — require an actual
    // live-round observation (> roundLiveAt + 0.3) or a physically present ally to mark a zone cleared.
    const gridClearedThisRound =
      cellClearedAt > roundLiveAt + 0.3 &&
      cellClearedAt > rec.lastContestedAt &&
      now - cellClearedAt < 5.5 &&
      sampleInfluenceUncertainty(grid, zone.anchor, now) < 0.08;
    const recentlyObserved = (nearAlly && now - rec.lastContestedAt > 4) || gridClearedThisRound;

    if (recentlyObserved) {
      const wasCleared = rec.status === 'cleared';
      rec.status = 'cleared';
      rec.clearedAt = nearAlly ? now : cellClearedAt;
      if (nearAlly) rec.clearedBy = nearAlly.id;
      if (!wasCleared && zone.depth !== 'site') newlyCleared.push(id);
    } else if (rec.status === 'cleared' && now - rec.clearedAt > 14) {
      rec.status = 'stale';
    }

    if (zone.depth !== 'site' && rec.status === 'cleared') {
      state.clearedLanes.add(zone.area);
    }
  }

  return newlyCleared;
}

export interface DefenseTerritoryActor {
  id: string;
  slot: number;
  position?: FpsPosition;
  duty: FpsRoundDuty;
  home: 'A' | 'B';
  hp: number;
  weaponCategory: string;
  forward: number;
  aggression: number;
  lurking: number;
  x: number;
  z: number;
}

/**
 * Composes an unscripted round-opening CT map-control plan spanning A Main, Mid, and B Main
 * using lawful opponent economy reads, first-blood trends, IGL tendencies, and playbook tendencies.
 */
export function composeFreeDefenseTerritory(ctx: {
  zones: Readonly<Record<LiveZoneId, LiveControlZone>>;
  state: LiveTeamTerritoryState;
  allies: readonly DefenseTerritoryActor[];
  defensePlay: LiveDefensePlay;
  enemyRead: LiveEnemyEconomyRead;
  callerTendencies?: FpsTendencyValues;
  firstBloods?: { A: number; B: number; Mid: number };
  isPistol?: boolean;
  liveElapsed: number;
  now: number;
  roundSeed: number;
}): LiveTerritoryAssignment[] {
  const { zones, state, allies, defensePlay, enemyRead, callerTendencies, firstBloods, isPistol, now, roundSeed } = ctx;
  state.assignments.clear();
  state.lastPlanAt = now;
  if (allies.length < 4) return [];

  const mapCtrl = unit(callerTendencies, 'mapControlCalling');
  const infoDemand = unit(callerTendencies, 'informationDemand');
  const risk = unit(callerTendencies, 'riskCalling');
  const frontLead = unit(callerTendencies, 'leadFromFront');

  const antiEco = enemyRead.antiEcoWindow || enemyRead.tier === 'broke_eco';
  const lowUtil = enemyRead.lowUtilityLikely && enemyRead.tier !== 'pistol';
  const awpThreat = enemyRead.awpLikely;

  const scoreA =
    0.85 +
    (firstBloods ? firstBloods.A * 0.14 : 0) +
    (defensePlay.stack === 'A' ? -0.3 : 0.1) +
    (antiEco ? 0.25 : 0) +
    (lowUtil ? 0.2 : 0) +
    (mapCtrl - 0.5) * 0.45 +
    ((roundSeed % 7) - 3) * 0.06;

  const scoreMid =
    0.95 +
    (defensePlay.midPushPair ? 0.55 : 0) +
    (defensePlay.flexMid ? 0.2 : 0) +
    (firstBloods ? firstBloods.Mid * 0.18 : 0) +
    (antiEco ? 0.15 : 0) +
    (awpThreat ? -0.22 : 0) +
    (infoDemand + mapCtrl - 1) * 0.45 +
    (((roundSeed >> 3) % 7) - 3) * 0.06;

  const scoreB =
    0.85 +
    (defensePlay.aggressivePair ? 0.55 : 0) +
    (firstBloods ? firstBloods.B * 0.14 : 0) +
    (antiEco ? -0.25 : 0) +
    (lowUtil ? 0.18 : 0) +
    (frontLead + risk - 1) * 0.4 +
    (((roundSeed >> 6) % 7) - 3) * 0.06;

  const rawCandidates: { zoneId: LiveZoneId; area: 'A' | 'B' | 'Mid'; score: number }[] = [
    { zoneId: 'A_FORWARD', area: 'A', score: scoreA },
    { zoneId: 'MID_CONTROL', area: 'Mid', score: scoreMid },
    { zoneId: 'B_FORWARD', area: 'B', score: scoreB },
  ];
  const candidates = rawCandidates.sort((a, b) => b.score - a.score);

  const primary = candidates[0];
  const secondary = candidates[1];

  // Cap opening map-control pushers at 2 CTs on rifle rounds (1 on pistol unless explicit aggressivePair)
  // so 3 CTs always anchor structured site crossfires instead of draining sites on tick 0.
  const maxAssigned = isPistol && !defensePlay.aggressivePair ? 1 : 2;
  const wantsPairPush =
    maxAssigned >= 2 &&
    (defensePlay.aggressivePair ||
      defensePlay.midPushPair ||
      (primary.score >= 1.0 && (mapCtrl + risk + (lowUtil ? 0.18 : 0) + (antiEco ? 0.15 : 0)) >= 1.04));

  const used = new Set<string>();
  const siteGuardA = allies.filter(a => a.home === 'A').sort((a, b) => Number(b.duty === 'anchor') - Number(a.duty === 'anchor') || a.slot - b.slot)[0];
  const siteGuardB = allies.filter(a => a.home === 'B').sort((a, b) => Number(b.duty === 'anchor') - Number(a.duty === 'anchor') || a.slot - b.slot)[0];
  if (siteGuardA && defensePlay.stack !== 'B') used.add(siteGuardA.id);
  if (siteGuardB && defensePlay.stack !== 'A') used.add(siteGuardB.id);

  const mobilePool = allies
    .filter(a => !used.has(a.id) && a.hp >= 60)
    .sort((a, b) => {
      const aHomeMatch = a.home === primary.area ? 0.35 : 0;
      const bHomeMatch = b.home === primary.area ? 0.35 : 0;
      return (b.forward + b.aggression + bHomeMatch) - (a.forward + a.aggression + aHomeMatch) || a.slot - b.slot;
    });

  const result: LiveTerritoryAssignment[] = [];
  const primaryZone = zones[primary.zoneId];
  const pushDuration = antiEco ? 24 : 28;

  if (wantsPairPush && mobilePool.length >= 2) {
    const lead = mobilePool[0];
    const trade = mobilePool[1];
    used.add(lead.id);
    used.add(trade.id);
    const reason =
      primary.area === 'A'
        ? `Paired A Main crunch${antiEco ? ' (anti-eco range control)' : ''} — claim space & fall back on heavy contact`
        : primary.area === 'Mid'
          ? 'Paired Mid fight — contest Mid control with instant trade support'
          : `Paired B Main crunch${antiEco ? ' (spaced anti-eco check)' : ''} — contest early lane together`;

    const leadTask: LiveTerritoryAssignment = {
      actorId: lead.id,
      zoneId: primary.zoneId,
      role: 'pair_lead',
      point: primaryZone.anchor,
      fallback: primaryZone.fallback,
      watch: primaryZone.watch,
      partnerId: trade.id,
      until: now + pushDuration,
      creep: antiEco && primary.area !== 'Mid',
      reason,
    };
    const tradeTask: LiveTerritoryAssignment = {
      actorId: trade.id,
      zoneId: primary.zoneId,
      role: 'pair_trade',
      point: primaryZone.anchor,
      fallback: primaryZone.fallback,
      watch: primaryZone.watch,
      partnerId: lead.id,
      until: now + pushDuration,
      creep: antiEco && primary.area !== 'Mid',
      reason: `Trade behind ${lead.position ?? 'partner'} on ${primary.area} crunch`,
    };
    state.assignments.set(lead.id, leadTask);
    state.assignments.set(trade.id, tradeTask);
    result.push(leadTask, tradeTask);
  } else if (mobilePool.length >= 1 && (primary.score >= 0.9 || infoDemand >= 0.55)) {
    const scout = mobilePool[0];
    used.add(scout.id);
    const scoutTask: LiveTerritoryAssignment = {
      actorId: scout.id,
      zoneId: primary.zoneId,
      role: 'info_creep',
      point: primaryZone.anchor,
      fallback: primaryZone.fallback,
      watch: primaryZone.watch,
      until: now + 26,
      creep: true,
      reason: `Info-creep ${primary.area} forward lane for map control and sound`,
    };
    state.assignments.set(scout.id, scoutTask);
    result.push(scoutTask);
  }

  // Secondary quiet info-creep only if we haven't already committed 2 CTs to an opening crunch.
  const spare =
    result.length < maxAssigned
      ? allies.find(a => !used.has(a.id) && a.hp >= 65 && (a.position === 'CT_FLEX' || a.position === 'CT_ROTATOR' || a.forward > 0.58))
      : undefined;
  if (spare && secondary.score >= 0.92 && !awpThreat) {
    const secZone = zones[secondary.zoneId];
    const secTask: LiveTerritoryAssignment = {
      actorId: spare.id,
      zoneId: secondary.zoneId,
      role: 'info_creep',
      point: secZone.anchor,
      fallback: secZone.fallback,
      watch: secZone.watch,
      until: now + 24,
      creep: true,
      reason: `Creep ${secondary.area} edge to eliminate lane or pinch late`,
    };
    state.assignments.set(spare.id, secTask);
    result.push(secTask);
  }

  return result;
}

/**
 * Dynamic mid-round "Take Empty Space": if a CT holds a completely quiet lane while time runs or
 * enemy activity appears elsewhere, advance `SITE -> FORWARD -> DEEP -> FLANK_WRAP` rather than sitting idle.
 */
export function evaluateEmptySpaceExpansion(ctx: {
  zones: Readonly<Record<LiveZoneId, LiveControlZone>>;
  state: LiveTeamTerritoryState;
  actor: {
    id: string;
    home: 'A' | 'B';
    position?: FpsPosition;
    duty: FpsRoundDuty;
    hp: number;
    weaponCategory: string;
    x: number;
    z: number;
    forward: number;
    lurking: number;
    initiative: number;
  };
  allies: readonly { id: string; home: 'A' | 'B'; x: number; z: number }[];
  assessment: LiveIntelAssessment;
  advantage: number;
  liveElapsed: number;
  remaining: number;
  now: number;
}): LiveTerritoryAssignment | undefined {
  const { zones, state, actor, allies, assessment, advantage, liveElapsed, remaining, now } = ctx;
  if (liveElapsed < 9 || remaining <= 24 || actor.hp < 48 || actor.weaponCategory === 'sniper') return undefined;
  // Lane must be quiet!
  if (assessment[actor.home].strength >= 0.25) return undefined;

  const otherSite: 'A' | 'B' = actor.home === 'A' ? 'B' : 'A';
  const oppositeBusy = assessment[otherSite].strength >= 0.45 || assessment.Mid.strength >= 0.45;
  // Track 8 Man-Advantage discipline: when up >= 2 without opposite-site pressure, hold paired crossfires rather than solo wandering.
  if (advantage >= 2 && !oppositeBusy) return undefined;

  const aliveIds = new Set(allies.map(a => a.id));
  // Prune expired or dead assignments so lane uniqueness checks stay accurate.
  for (const [id, t] of state.assignments.entries()) {
    if (!aliveIds.has(id) || now >= t.until) state.assignments.delete(id);
  }

  // Never send a second solo expander down the same lane, and keep at least one live guard on site unless opposite is genuinely busy.
  const laneAlreadyClaimed = Array.from(state.assignments.values()).some(
    t => t.actorId !== actor.id && zones[t.zoneId].area === actor.home && t.until > now,
  );
  if (laneAlreadyClaimed) return undefined;

  const expandingIds = new Set(Array.from(state.assignments.keys()));
  const siteGuardsRemaining = allies.filter(
    a => a.id !== actor.id && a.home === actor.home && !expandingIds.has(a.id),
  ).length;
  const mobileRole = actor.position === 'CT_ROTATOR' || actor.position === 'CT_FLEX' || actor.duty !== 'anchor';
  const canLeave =
    siteGuardsRemaining >= 1 ||
    (oppositeBusy && allies.length >= 3) ||
    (mobileRole && (actor.forward + actor.initiative) >= 0.9 && liveElapsed >= 14);
  if (!canLeave) return undefined;

  const fwdId: LiveZoneId = actor.home === 'A' ? 'A_FORWARD' : 'B_FORWARD';
  const deepId: LiveZoneId = actor.home === 'A' ? 'A_DEEP' : 'B_DEEP';
  const fwdRec = state.zones[fwdId];
  const deepRec = state.zones[deepId];

  // Stage 3: forward zone is genuinely cleared and Ts are busy elsewhere (or deep already cleared) -> deep flank wrap behind the execute!
  if (
    fwdRec.status === 'cleared' &&
    (oppositeBusy || deepRec.status === 'cleared') &&
    deepRec.status !== 'contested' &&
    (actor.lurking >= 0.35 || actor.initiative >= 0.4 || oppositeBusy)
  ) {
    const deepZone = zones[deepId];
    const targetPoint = deepZone.wrapTarget ?? deepZone.anchor;
    const task: LiveTerritoryAssignment = {
      actorId: actor.id,
      zoneId: deepId,
      role: 'deep_flank',
      point: targetPoint,
      fallback: deepZone.fallback,
      watch: deepZone.watch,
      until: now + 22,
      creep: true,
      reason: `${actor.home} forward cleared while ${otherSite}/Mid busy — creeping deep flank wrap`,
    };
    state.assignments.set(actor.id, task);
    return task;
  }

  // Stage 2: forward zone genuinely cleared while lane remains quiet -> push into deep T-side lane to claim full lane control.
  if (
    fwdRec.status === 'cleared' &&
    (deepRec.status === 'unknown' || deepRec.status === 'stale') &&
    (siteGuardsRemaining >= 1 || oppositeBusy || mobileRole)
  ) {
    const deepZone = zones[deepId];
    const task: LiveTerritoryAssignment = {
      actorId: actor.id,
      zoneId: deepId,
      role: 'info_creep',
      point: deepZone.anchor,
      fallback: deepZone.fallback,
      watch: deepZone.watch,
      until: now + 18,
      creep: true,
      reason: `${actor.home} forward clear — advancing deep into T lane to shrink the map`,
    };
    state.assignments.set(actor.id, task);
    return task;
  }

  // Stage 1: expand from site -> forward choke if unchecked/stale.
  if (fwdRec.status === 'unknown' || fwdRec.status === 'stale') {
    const fwdZone = zones[fwdId];
    const task: LiveTerritoryAssignment = {
      actorId: actor.id,
      zoneId: fwdId,
      role: 'info_creep',
      point: fwdZone.anchor,
      fallback: fwdZone.fallback,
      watch: fwdZone.watch,
      until: now + 18,
      creep: !oppositeBusy,
      reason: `Quiet ${actor.home} lane — pushing forward to claim info and shrink the map`,
    };
    state.assignments.set(actor.id, task);
    return task;
  }

  return undefined;
}
