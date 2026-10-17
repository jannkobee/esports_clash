import { segmentHitsCircle, type Point } from './skillshotRules.ts';
import { capBaseLaneAdvance, isInsideEnemyWellBeam } from './baseSafetyRules.ts';

/** Optional fight priority cannot release a wave leash across a live turret zone. */
export function isTeamfightApproachSafe(from: Point & { team?: 'blue' | 'red' }, to: Point,
  enemyStructures: readonly (Point & { type: string; range: number; isAlive: boolean })[],
): boolean {
  return !(from.team && isInsideEnemyWellBeam(from.team, to))
    && !enemyStructures.some(structure => structure.isAlive
    && (structure.type.includes('tower') || structure.type === 'nexus')
    && segmentHitsCircle(from, to, structure, structure.range + 28));
}

/** Tempo may defer optional macro work, never authorize combat or override recovery. */
export function shouldPrioritizeTeamfight(input: {
  dangerousFight: boolean; lowHealth: boolean; takingTowerFire: boolean;
  targetDistance: number; attackRange: number; readyCastRange: number;
  canReinforceAlly: boolean;
}): boolean {
  if (input.dangerousFight || input.lowHealth || input.takingTowerFire) return false;
  // The caller supplies Infinity for invisible, unavailable, or tower-protected targets.
  // This is an opportunity radius, not additional attack/cast reach.
  const opportunityRange = Math.min(400, Math.max(190, input.attackRange * 1.5, input.readyCastRange));
  return input.canReinforceAlly || input.targetDistance <= opportunityRange;
}

export function shouldFollowUpControl(input: {
  healthFraction: number; caughtEnemies: number; freeThreats: number; nearbyAllies: number;
  distanceToCatch: number; attackRange: number; readyCastRange: number;
  controlSeconds: number; moveSpeed: number;
  iq: number; teamfight: number; losingFight: boolean;
  underEnemyTower: boolean; takingTowerFire: boolean;
}): boolean {
  const { healthFraction, caughtEnemies, freeThreats, nearbyAllies, distanceToCatch,
    attackRange, readyCastRange, controlSeconds, moveSpeed, iq, teamfight, losingFight,
    underEnemyTower, takingTowerFire } = input;
  if (caughtEnemies === 0 || distanceToCatch > 650 || healthFraction <= 0.10
    || underEnemyTower || takingTowerFire) return false;
  const decisiveCatch = caughtEnemies >= 3 && freeThreats <= 1;
  const canContributeAtLowHealth = attackRange >= 100 || readyCastRange >= 150
    || distanceToCatch <= Math.max(attackRange + 45, 135);
  const timeToContribute = Math.max(0, distanceToCatch - Math.max(attackRange, readyCastRange))
    / Math.max(60, moveSpeed);
  if (healthFraction < 0.25)
    return decisiveCatch && canContributeAtLowHealth
      && timeToContribute <= controlSeconds - 0.15
      && (freeThreats === 0 || (healthFraction >= 0.19 && nearbyAllies >= 2));
  if (freeThreats > nearbyAllies + 1 || (losingFight && !decisiveCatch)) return false;
  if (decisiveCatch) return true;
  const read = iq * 0.55 + teamfight * 0.45;
  return caughtEnemies >= 2 ? read >= 56 : read >= 78 && healthFraction >= 0.45;
}

/**
 * Starts a real teamfight without requiring crowd control to have landed first.
 * This is deliberately a grouped, visible commitment window: card IQ/TF and
 * cooldown readiness influence the call, while health, numbers, and turret
 * safety remain hard gates.
 */
export function shouldStartProactiveAllIn(input: {
  healthFraction: number; alliedAverageHealth: number; enemyAverageHealth: number;
  groupedAllies: number; groupedEnemies: number; readyContributors: number;
  targetDistance: number; approachSafe: boolean; targetUnderEnemyTower: boolean;
  towerRiskAcceptable?: boolean; takingTowerFire: boolean; losingFight: boolean;
  iq: number; teamfight: number;
}): boolean {
  const { healthFraction, alliedAverageHealth, enemyAverageHealth, groupedAllies,
    groupedEnemies, readyContributors, targetDistance, approachSafe,
    targetUnderEnemyTower, towerRiskAcceptable, takingTowerFire, losingFight, iq,
    teamfight } = input;
  if (!Number.isFinite(targetDistance) || targetDistance > 500 || !approachSafe
    || (targetUnderEnemyTower && !towerRiskAcceptable) || takingTowerFire) return false;
  if (healthFraction < 0.5 || alliedAverageHealth < 0.56
    || groupedAllies < 3 || groupedEnemies < 3 || groupedAllies < groupedEnemies) return false;
  const healthEdge = alliedAverageHealth - enemyAverageHealth;
  if (healthEdge < -0.1) return false;
  const fullClash = groupedAllies >= 4 && groupedEnemies >= 4;
  // A local survival read may look bad for the frontliner in an otherwise
  // healthy 5v5. Only a clear team-health edge may override it in smaller fights.
  if (losingFight && !fullClash && healthEdge < 0.08) return false;
  if (readyContributors < Math.ceil(groupedAllies * 0.6)) return false;

  const readiness = readyContributors / groupedAllies;
  const callScore = iq * 0.3 + teamfight * 0.7 + readiness * 18
    + Math.max(-8, Math.min(12, healthEdge * 80)) + (fullClash ? 8 : 0);
  return callScore >= 68;
}

export function shouldSeekHealthRelic(input: {
  healthFraction: number; missingHealth: number; healAmount: number;
  distance: number; enemyDistanceToRelic: number; enemyDistanceToUnit: number;
  followUpEngage: boolean; pushWindow: boolean; underEnemyTower: boolean;
  activeFight?: boolean;
}): boolean {
  const { healthFraction, missingHealth, healAmount, distance, enemyDistanceToRelic,
    enemyDistanceToUnit, followUpEngage, pushWindow, underEnemyTower } = input;
  if (underEnemyTower || enemyDistanceToRelic < 185 || missingHealth < healAmount * 0.55) return false;
  if (followUpEngage && healthFraction >= 0.12) return false;
  if (healthFraction < 0.25) return distance <= 240 && enemyDistanceToUnit > 110;
  if (input.activeFight || pushWindow || enemyDistanceToUnit < 200) return false;
  return healthFraction < 0.52 && distance <= 180;
}

export function shouldPushWithWave(input: {
  healthFraction: number; iq: number; lan: number; coachMacro: number;
  alliedWaveCount: number; enemyWaveCount: number; waveFrontDistance: number;
  structureDistance: number; nearbyAllies: number; nearbyEnemies: number;
  winningFightWindow: boolean;
  activeFight?: boolean;
}): boolean {
  const { healthFraction, iq, lan, coachMacro, alliedWaveCount, enemyWaveCount,
    waveFrontDistance, structureDistance, nearbyAllies, nearbyEnemies, winningFightWindow } = input;
  if (input.activeFight || healthFraction < 0.43 || alliedWaveCount < 2 || waveFrontDistance > 360
    || structureDistance > 650 || nearbyEnemies > nearbyAllies + 1) return false;
  const macroRead = iq * 0.42 + lan * 0.38 + coachMacro * 1.5;
  return winningFightWindow || (macroRead >= 65 && alliedWaveCount >= enemyWaveCount)
    || (macroRead >= 52 && alliedWaveCount >= enemyWaveCount + 2);
}

export function shouldCoordinateObjectiveRecall(input: {
  secondsUntilObjective: number;
  livingAllies: number;
  safeRecallers: number;
  activeThreat: boolean;
  activePush: boolean;
}): boolean {
  const { secondsUntilObjective, livingAllies, safeRecallers, activeThreat, activePush } = input;
  return secondsUntilObjective >= 45 && secondsUntilObjective <= 60
    && livingAllies >= 3 && safeRecallers >= 3
    && !activeThreat && !activePush;
}

export function shouldStageForObjective(input: {
  secondsUntilObjective: number;
  healthFraction: number;
  lanePriority: boolean;
  nearbyEnemies: number;
  activeFight: boolean;
}): boolean {
  const { secondsUntilObjective, healthFraction, lanePriority, nearbyEnemies, activeFight } = input;
  return secondsUntilObjective >= 0 && secondsUntilObjective <= 25
    && healthFraction >= 0.5 && lanePriority && nearbyEnemies === 0 && !activeFight;
}

export function laneAdvanceLimit(input: {
  team: 'blue' | 'red'; waveFrontX?: number; waveCount: number;
  structureX?: number; structureRange?: number;
  exposedNexus: boolean; objectiveFight: boolean;
  attackRange?: number;
  structureApproachUnsafe?: boolean;
}): number {
  const direction = input.team === 'blue' ? 1 : -1;
  const cap = (limit: number) => capBaseLaneAdvance(input.team, limit, input.attackRange ?? 50);
  if (input.structureApproachUnsafe && input.structureX !== undefined && input.structureRange !== undefined)
    return cap(input.structureX - direction * (input.structureRange + 28));
  if (input.exposedNexus || input.objectiveFight) return cap(direction > 0 ? Infinity : -Infinity);
  if (input.waveCount > 0 && input.waveFrontX !== undefined)
    return cap(input.waveFrontX + direction * 65);
  if (input.structureX !== undefined && input.structureRange !== undefined)
    return cap(input.structureX - direction * (input.structureRange + 28));
  return cap(direction > 0 ? Infinity : -Infinity);
}

export function wouldOverstep(team: 'blue' | 'red', x: number, limit: number): boolean {
  return (team === 'blue' ? 1 : -1) * (x - limit) > 10;
}
