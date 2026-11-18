import type { FpsPoint } from './fpsSpatialWorld.ts';
import type { LiveIntelBelief } from './fpsLiveIntel.ts';
import { liveSmokeOccludes, type LiveSmokeVolume } from './fpsLiveBrain.ts';
import { distance, FONTESSA_MAP_RUNTIME } from './fpsLiveMap.ts';
import type { LiveMapRuntime } from './fpsLiveMapTypes.ts';
import type { FpsOpponentPattern } from './fpsOpponentPatterns.ts';

const clamp = (x: number, min: number, max: number) => Math.max(min, Math.min(max, x));
const angle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const heading = (a: FpsPoint, b: FpsPoint) => Math.atan2(b.x - a.x, b.z - a.z);

function deterministicUnitHash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

export interface PeripheralNoticeObserver extends FpsPoint {
  yaw: number;
  blinded?: number;
  crouch?: boolean;
  jumpY?: number;
}

export interface PeripheralNoticeTarget extends FpsPoint {
  crouch?: boolean;
  jumpY?: number;
  speed?: number;
  lastShot?: number;
}

export interface PeripheralNoticeOptions {
  awareness?: number;
  positioning?: number;
  attentionDebt?: number;
  now?: number;
  targetSpeed?: number;
  sinceTargetShot?: number;
  teammateEngagingTarget?: boolean;
  smokes?: readonly LiveSmokeVolume[];
  eyeY?: number;
  targetY?: number;
}

export interface PeripheralNoticeResult {
  noticed: boolean;
  peripheral: boolean;
  angularOffset: number;
}

/**
 * Evaluates whether an observer detects a target in central (`<= 0.82 rad`) or peripheral
 * (`0.82 .. 1.40 rad`) vision using strictly lawful line-of-sight, smoke occlusion, and physical
 * salience cues (close proximity, transverse movement, muzzle flash, or nearby teammate tracer fire).
 */
export function canPeripherallyNotice(
  observer: PeripheralNoticeObserver,
  target: PeripheralNoticeTarget,
  options: PeripheralNoticeOptions = {},
  runtime: LiveMapRuntime = FONTESSA_MAP_RUNTIME,
): PeripheralNoticeResult {
  const angularOffset = Math.abs(angle(heading(observer, target) - observer.yaw));
  const d = distance(observer, target);
  if ((observer.blinded ?? 0) >= 0.2 || d > 55) {
    return { noticed: false, peripheral: false, angularOffset };
  }

  const awareness = clamp(options.awareness ?? 0.5, 0, 1);
  const positioning = clamp(options.positioning ?? awareness, 0, 1);
  const attentionDebt = clamp(options.attentionDebt ?? 0, 0, 1);
  const effectiveAwareness = clamp(awareness * 0.85 + positioning * 0.15, 0, 1);
  const maxCone = clamp(
    0.82 + (0.32 + effectiveAwareness * 0.26) * (1 - attentionDebt * 0.45),
    0.82,
    1.40,
  );

  if (angularOffset > maxCone) {
    return { noticed: false, peripheral: false, angularOffset };
  }

  const obsFeet = observer.jumpY ?? runtime.terrain.groundHeight(observer);
  const tgtFeet = target.jumpY ?? runtime.terrain.groundHeight(target);
  const eyeY = options.eyeY ?? obsFeet + (observer.crouch ? 1.08 : 1.6);
  const targetY = options.targetY ?? tgtFeet + (target.crouch ? 1.12 : 1.54);

  if (!runtime.sightline(observer, target, eyeY, targetY)) {
    return { noticed: false, peripheral: false, angularOffset };
  }

  const now = options.now ?? 0;
  if (
    options.smokes?.some(
      s => s.expires > now && liveSmokeOccludes(observer, target, eyeY, targetY, s, now),
    )
  ) {
    return { noticed: false, peripheral: false, angularOffset };
  }

  if (angularOffset <= 0.82) {
    return { noticed: true, peripheral: false, angularOffset };
  }

  const targetSpeed = options.targetSpeed ?? target.speed ?? 0;
  const sinceTargetShot =
    options.sinceTargetShot ??
    (options.now !== undefined && target.lastShot !== undefined
      ? Math.max(0, options.now - target.lastShot)
      : Infinity);

  const closeProximity = d <= 7.5 + effectiveAwareness * 4.5 && attentionDebt < 0.88;
  const movementSalience =
    targetSpeed > 1.35 && d <= (16 + effectiveAwareness * 8) * (1 - attentionDebt * 0.35);
  const muzzleSalience =
    sinceTargetShot < 0.35 && d <= (24 + effectiveAwareness * 8) * (1 - attentionDebt * 0.3);
  const tracerCue = Boolean(options.teammateEngagingTarget) && d <= 28;

  const noticed = closeProximity || movementSalience || muzzleSalience || tracerCue;
  return { noticed, peripheral: noticed, angularOffset };
}

export interface SmartDefenseHoldTraits {
  forwardPositioning: number;
  crossfirePreference: number;
  angleIsolation: number;
  opponentAdaptation: number;
  positionConcealment: number;
  positioningSkill: number;
  teamUnderstanding: number;
}

export interface SmartDefenseHoldContext {
  actor: {
    id: string;
    slot: number;
    x: number;
    z: number;
    level?: FpsPoint['level'];
    weaponCategory?: string;
    currentGoal?: FpsPoint;
  };
  site: 'A' | 'B';
  round: number;
  holds: readonly FpsPoint[];
  entries: readonly FpsPoint[];
  mates: readonly {
    id: string;
    slot: number;
    x: number;
    z: number;
    goal?: FpsPoint;
    watchPoint?: FpsPoint;
  }[];
  claimedHolds?: readonly FpsPoint[];
  beliefs?: readonly LiveIntelBelief[];
  patterns?: readonly FpsOpponentPattern[];
  recentDeathPoints?: readonly FpsPoint[];
  traits?: Partial<SmartDefenseHoldTraits>;
}

/**
 * Selects an un-scripted, weapon-aware, crossfire-coherent CT hold position on a site
 * using only lawful team positions, observed opponent patterns, and recent own death locations.
 */
export function selectSmartDefenseHold(
  context: SmartDefenseHoldContext,
  runtime: LiveMapRuntime = FONTESSA_MAP_RUNTIME,
): FpsPoint {
  const { actor, round, holds, entries, mates } = context;
  if (!holds.length) return { x: actor.x, z: actor.z, level: actor.level };
  if (holds.length === 1) return holds[0];

  const traits: SmartDefenseHoldTraits = {
    forwardPositioning: clamp(context.traits?.forwardPositioning ?? 0.5, 0, 1),
    crossfirePreference: clamp(context.traits?.crossfirePreference ?? 0.5, 0, 1),
    angleIsolation: clamp(context.traits?.angleIsolation ?? 0.5, 0, 1),
    opponentAdaptation: clamp(context.traits?.opponentAdaptation ?? 0.5, 0, 1),
    positionConcealment: clamp(context.traits?.positionConcealment ?? 0.5, 0, 1),
    positioningSkill: clamp(context.traits?.positioningSkill ?? 0.5, 0, 1),
    teamUnderstanding: clamp(context.traits?.teamUnderstanding ?? 0.5, 0, 1),
  };

  const claimedHolds = context.claimedHolds ?? [];
  const beliefs = context.beliefs ?? [];
  const patterns = context.patterns ?? [];
  const recentDeathPoints = context.recentDeathPoints ?? [];

  const minZ = Math.min(...holds.map(h => h.z));
  const maxZ = Math.max(...holds.map(h => h.z));
  const spanZ = Math.max(1, maxZ - minZ);
  const defendForwardSign = runtime.definition.tactical.spawnDirection.defendForwardSign;

  let bestHold = holds[0];
  let bestScore = -Infinity;

  for (let i = 0; i < holds.length; i++) {
    const hold = holds[i];
    let score = 0;

    const isCurrentGoal =
      !!actor.currentGoal && distance(actor.currentGoal, hold) < 0.75;
    const crowdedByMate = mates.some(
      m =>
        m.id !== actor.id &&
        ((m.goal && distance(m.goal, hold) < 3.5 && (!isCurrentGoal || m.slot < actor.slot)) ||
          (!m.goal && distance(m, hold) < 2.8 && (!isCurrentGoal || m.slot < actor.slot))),
    );
    const crowdedByClaim = claimedHolds.some(c => distance(c, hold) < 3.5 && !isCurrentGoal);

    if (crowdedByMate || crowdedByClaim) {
      score -= 8.0;
    } else if (isCurrentGoal) {
      score += 0.65;
    }

    const holdEyeY = runtime.terrain.groundHeight(hold) + 1.58;
    const visibleEntries = entries.filter(e =>
      runtime.sightline(hold, e, holdEyeY, runtime.terrain.groundHeight(e) + 1.58),
    );
    const exposedCount = visibleEntries.length;

    if (exposedCount > 0) {
      const ranges = visibleEntries.map(e => distance(hold, e));
      const maxRange = Math.max(...ranges);
      const minRange = Math.min(...ranges);
      const cat = actor.weaponCategory;

      if (cat === 'sniper') {
        score += maxRange >= 20 ? 0.8 + Math.min(0.35, (maxRange - 20) * 0.02) : -0.35;
      } else if (cat === 'shotgun' || cat === 'smg') {
        score += minRange <= 13 ? 0.7 + Math.max(0, (13 - minRange) * 0.03) : -0.35;
      } else {
        const hasMidRange = ranges.some(r => r >= 12 && r <= 26);
        score += hasMidRange ? 0.4 : 0.15;
      }
    } else {
      score -= 0.45;
    }

    const isoFactor = traits.angleIsolation * (0.4 + traits.positioningSkill * 0.6);
    if (exposedCount === 1) {
      score += 0.55 * isoFactor;
    } else if (exposedCount > 1) {
      score -= 0.45 * (exposedCount - 1) * isoFactor;
    }

    const cfWeight = traits.crossfirePreference * 0.6 + traits.teamUnderstanding * 0.4;
    let bestCrossfire = 0;
    for (const mate of mates) {
      if (mate.id === actor.id) continue;
      const matePos = mate.goal ?? mate;
      const pairDist = distance(hold, matePos);
      if (pairDist < 4 || pairDist > 28) continue;
      const mateEyeY = runtime.terrain.groundHeight(matePos) + 1.58;
      for (const entry of visibleEntries) {
        const entryEyeY = runtime.terrain.groundHeight(entry) + 1.58;
        if (!runtime.sightline(matePos, entry, mateEyeY, entryEyeY)) continue;
        const hx = entry.x - hold.x;
        const hz = entry.z - hold.z;
        const mx = entry.x - matePos.x;
        const mz = entry.z - matePos.z;
        const denom = Math.hypot(hx, hz) * Math.hypot(mx, mz);
        if (denom < 0.1) continue;
        const cos = (hx * mx + hz * mz) / denom;
        if (cos < 0.72) {
          const separation = clamp((0.72 - cos) / 0.85, 0.3, 1);
          const bonus = 0.95 * (0.35 + 0.65 * cfWeight) * separation;
          if (bonus > bestCrossfire) bestCrossfire = bonus;
        }
      }
    }
    score += bestCrossfire;

    const forwardUnit =
      defendForwardSign < 0 ? (maxZ - hold.z) / spanZ : (hold.z - minZ) / spanZ;
    score += (forwardUnit - 0.5) * (traits.forwardPositioning - traits.positionConcealment * 0.5) * 0.65;

    const nearbyDeaths = recentDeathPoints.filter(d => distance(d, hold) < 3.5).length;
    if (nearbyDeaths > 0) {
      score -= 0.85 * (0.4 + traits.opponentAdaptation * 0.6) * Math.min(2, nearbyDeaths);
    }

    if (
      visibleEntries.length > 0 &&
      patterns.some(
        p =>
          p.rounds.length >= 2 &&
          visibleEntries.some(e => distance(p, e) < 16),
      )
    ) {
      score += 0.5 * traits.opponentAdaptation;
    }

    for (const b of beliefs) {
      if (b.age < 6 && b.certainty > 0.35 && visibleEntries.some(e => distance(b, e) < 15)) {
        score += 0.35 * b.certainty;
      }
    }

    score += deterministicUnitHash(`${round}:${actor.id}:hold:${i}`) * 0.12;

    if (score > bestScore) {
      bestScore = score;
      bestHold = hold;
    }
  }

  return bestHold;
}

export interface ComplementaryWatchTraits {
  communication: number;
  teammateCover: number;
  informationReading: number;
  awareness: number;
}

export interface ComplementaryWatchContext {
  actor: FpsPoint & {
    id?: string;
    slot?: number;
    crouch?: boolean;
    jumpY?: number;
    goal?: FpsPoint;
  };
  site: 'A' | 'B';
  entries: readonly FpsPoint[];
  midSplit?: FpsPoint;
  mates?: readonly (FpsPoint & { id?: string; watchPoint?: FpsPoint })[];
  beliefs?: readonly LiveIntelBelief[];
  knownSmokes?: readonly LiveSmokeVolume[];
  patterns?: readonly FpsOpponentPattern[];
  now?: number;
  round?: number;
  traits?: Partial<ComplementaryWatchTraits>;
}

/**
 * Chooses a watch point for a site defender that is physically visible (never staring into a brick wall),
 * avoids holding a smoked choke when an open avenue exists, and complements a site partner's watch angle.
 */
export function selectComplementaryWatchPoint(
  context: ComplementaryWatchContext,
  runtime: LiveMapRuntime = FONTESSA_MAP_RUNTIME,
): FpsPoint {
  const { actor, entries, midSplit } = context;
  const patterns = context.patterns ?? [];
  const beliefs = context.beliefs ?? [];
  const knownSmokes = context.knownSmokes ?? [];
  const mates = context.mates ?? [];
  const now = context.now ?? 0;
  const round = context.round ?? 1;

  const communication = clamp(context.traits?.communication ?? 0.5, 0, 1);
  const teammateCover = clamp(context.traits?.teammateCover ?? 0.5, 0, 1);
  const informationReading = clamp(context.traits?.informationReading ?? 0.5, 0, 1);

  const rawCandidates: FpsPoint[] = [
    ...entries,
    ...(midSplit ? [midSplit] : []),
    ...patterns
      .filter(p => ((p.elevatedRounds?.length ?? 0) >= 1 || p.rounds.length >= 2) && distance(actor, p) < 30)
      .map(p => ({ x: p.x, z: p.z, ...(p.level ? { level: p.level } : {}) })),
  ];

  const candidates = rawCandidates.filter(
    (c, idx) => rawCandidates.findIndex(o => distance(o, c) < 1.0 && o.level === c.level) === idx,
  );
  if (!candidates.length) {
    return runtime.definition.sites[context.site];
  }

  const obsFeet = Math.max(actor.jumpY ?? 0, runtime.terrain.groundHeight(actor));
  const eyeY = obsFeet + (actor.crouch ? 1.08 : 1.6);
  const holdPos = actor.goal && distance(actor, actor.goal) <= 3.0 ? actor.goal : actor;
  const holdEyeY = runtime.terrain.groundHeight(holdPos) + 1.58;

  let best = candidates[0];
  let bestScore = -Infinity;

  for (let i = 0; i < candidates.length; i++) {
    const w = candidates[i];
    const targetY = runtime.terrain.groundHeight(w) + 1.55;
    let score = actor.slot !== undefined && entries.length > 0 && i === actor.slot % entries.length ? 0.25 : 0;

    const visibleFromActor =
      distance(actor, w) > 1.2 && runtime.sightline(actor, w, eyeY, targetY);
    const visibleFromHold =
      holdPos !== actor &&
      distance(holdPos, w) > 1.2 &&
      runtime.sightline(holdPos, w, holdEyeY, targetY);

    if (visibleFromActor) {
      score += 2.2;
    } else if (visibleFromHold) {
      score += 0.8;
    } else {
      score -= 2.0;
    }

    const smoked = knownSmokes.some(
      s =>
        s.expires - now > 2.5 &&
        (distance(s, w) < s.radius + 0.8 ||
          liveSmokeOccludes(actor, w, eyeY, targetY, s, now)),
    );
    if (smoked) {
      score -= 0.9;
    }

    let freshIntelBonus = 0;
    let confirmedPushAtW = false;
    for (const b of beliefs) {
      const dBelief = distance(b, w);
      if (b.age < 5 && dBelief < 14) {
        const proximity = Math.max(0, 1 - dBelief / 14) ** 2;
        const bonus =
          1.8 * b.certainty * proximity * (0.5 + informationReading * 0.5);
        if (bonus > freshIntelBonus) freshIntelBonus = bonus;
        if (b.age < 3.5 && b.certainty >= 0.6 && dBelief < 7) {
          confirmedPushAtW = true;
        }
      }
    }
    score += freshIntelBonus;

    const partnerWatching = mates.some(
      m =>
        (m.id === undefined || m.id !== actor.id) &&
        distance(actor, m) < 20 &&
        !!m.watchPoint &&
        distance(m.watchPoint, w) < 4,
    );
    if (partnerWatching) {
      const coverWeight = communication * 0.6 + teammateCover * 0.4;
      const urgencyScale = confirmedPushAtW ? 0.2 : 1.0;
      score -= 1.1 * (0.4 + coverWeight * 0.6) * urgencyScale;
    }

    const matchingPattern = patterns.find(p => distance(p, w) < 10 && p.rounds.length >= 1);
    if (matchingPattern) {
      score += 0.45 * informationReading * Math.min(2, matchingPattern.rounds.length);
    }

    score += deterministicUnitHash(`${round}:${actor.id ?? actor.slot ?? 0}:watch:${i}`) * 0.05;

    if (score > bestScore) {
      bestScore = score;
      best = w;
    }
  }

  return { x: best.x, z: best.z, ...(best.level ? { level: best.level } : {}) };
}

export interface CombatOrientationAlly extends FpsPoint {
  id: string;
  lastShot: number;
  damageAt: number;
  target?: string;
  aimPoint?: FpsPoint;
  contact?: FpsPoint;
  contactAt?: number;
}

export interface CombatOrientationResult {
  point: FpsPoint;
  eyeY: number;
  reason: string;
}

/**
 * When an actor has no personal visible target or fresh (<1.2s) personal sight contact,
 * checks if a nearby teammate (<18m) is actively firing or taking damage and returns that
 * teammate's active threat point so preAim turns toward the fight immediately.
 */
export function evaluateTeammateCombatOrientation(
  actor: FpsPoint & {
    id: string;
    crouch?: boolean;
    jumpY?: number;
    target?: string;
    contact?: FpsPoint;
    contactAt?: number;
  },
  allies: readonly CombatOrientationAlly[],
  time: number,
  runtime: LiveMapRuntime = FONTESSA_MAP_RUNTIME,
): CombatOrientationResult | undefined {
  if (actor.target) return undefined;
  if (actor.contact && actor.contactAt !== undefined && time - actor.contactAt < 1.2) {
    return undefined;
  }

  const obsFeet = actor.jumpY ?? runtime.terrain.groundHeight(actor);
  const eyeY = obsFeet + (actor.crouch ? 1.08 : 1.6);

  const candidates = allies
    .filter(
      ally =>
        ally.id !== actor.id &&
        distance(actor, ally) < 18 &&
        (time - ally.lastShot < 0.75 || time - ally.damageAt < 0.9) &&
        Boolean(ally.aimPoint ?? ally.contact),
    )
    .sort((a, b) => distance(actor, a) - distance(actor, b));

  for (const ally of candidates) {
    const threat = ally.aimPoint ?? ally.contact;
    if (!threat) continue;
    const threatEyeY = runtime.terrain.groundHeight(threat) + 1.58;
    const canSeeThreat = runtime.sightline(actor, threat, eyeY, threatEyeY);
    if (canSeeThreat || distance(actor, ally) < 14) {
      return {
        point: { x: threat.x, z: threat.z, ...(threat.level ? { level: threat.level } : {}) },
        eyeY: threatEyeY,
        reason: 'Orient toward teammate active engagement',
      };
    }
  }

  return undefined;
}

export interface RetakeCohesionTraits {
  teamCoordination: number;
  teamStructure: number;
  callerRegroupPreference: number;
  playDiscipline: number;
  soloInitiative: number;
  retakeCommitment: number;
}

export interface RetakeCohesionContext {
  actor: FpsPoint & { id: string; slot: number; kit?: boolean };
  allies: readonly (FpsPoint & { id: string; slot: number; kit?: boolean })[];
  defuserId?: string;
  bomb: FpsPoint & { remaining: number; site?: 'A' | 'B' };
  livingEnemies: number;
  stagingPoints: readonly FpsPoint[];
  traits?: Partial<RetakeCohesionTraits>;
}

export interface RetakeCohesionDecision {
  shouldStage: boolean;
  point?: FpsPoint;
  watch?: FpsPoint;
  intent?: string;
}

/**
 * Evaluates whether a non-defuser CT defender should briefly stage at `retakeStaging`
 * while rotating teammates close the distance, governed by bomb clock slack and team/player identity.
 */
export function evaluateRetakeCohesion(
  context: RetakeCohesionContext,
  runtime: LiveMapRuntime = FONTESSA_MAP_RUNTIME,
): RetakeCohesionDecision {
  const { actor, allies, defuserId, bomb, livingEnemies, stagingPoints } = context;
  if (livingEnemies <= 0 || actor.id === defuserId || !stagingPoints.length || allies.length <= 1) {
    return { shouldStage: false };
  }

  const defuseNeeded = allies.some(a => a.kit) ? 5 : 10;
  const slack = bomb.remaining - defuseNeeded;
  if (slack <= 9.5) {
    return { shouldStage: false };
  }

  const readyNearSite = allies.filter(a => distance(a, bomb) < 19).length;
  const rotatingAllies = allies.some(a => {
    const d = distance(a, bomb);
    return d >= 19 && d < 42;
  });
  const wantedGroup = allies.length >= 4 ? 3 : 2;

  const traits: RetakeCohesionTraits = {
    teamCoordination: clamp(context.traits?.teamCoordination ?? 0.5, 0, 1),
    teamStructure: clamp(context.traits?.teamStructure ?? 0.5, 0, 1),
    callerRegroupPreference: clamp(context.traits?.callerRegroupPreference ?? 0.5, 0, 1),
    playDiscipline: clamp(context.traits?.playDiscipline ?? 0.5, 0, 1),
    soloInitiative: clamp(context.traits?.soloInitiative ?? 0.5, 0, 1),
    retakeCommitment: clamp(context.traits?.retakeCommitment ?? 0.5, 0, 1),
  };

  const maxWaitSlack = clamp(
    16.5 -
      (traits.teamStructure * 2.5 +
        traits.teamCoordination * 2.0 +
        traits.callerRegroupPreference * 2.0 +
        traits.playDiscipline * 2.0 -
        traits.soloInitiative * 3.0),
    10.0,
    18.0,
  );

  if (readyNearSite < wantedGroup && rotatingAllies && slack > maxWaitSlack) {
    const nearAllies = allies
      .filter(a => distance(a, bomb) < 24)
      .sort((a, b) => a.slot - b.slot || a.id.localeCompare(b.id));
    const rank = Math.max(
      0,
      nearAllies.findIndex(a => a.id === actor.id),
    );
    const sortedStaging = [...stagingPoints].sort(
      (a, b) => distance(actor, a) - distance(actor, b),
    );
    const chosen = sortedStaging[rank % sortedStaging.length] ?? sortedStaging[0];
    return {
      shouldStage: true,
      point: runtime.safePoint(chosen),
      watch: { x: bomb.x, z: bomb.z, ...(bomb.level ? { level: bomb.level } : {}) },
      intent: 'Stage for coordinated retake — wait for rotating teammates before breaching',
    };
  }

  return { shouldStage: false };
}
