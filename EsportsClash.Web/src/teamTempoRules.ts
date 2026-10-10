export function shouldFollowUpControl(input: {
  healthFraction: number; caughtEnemies: number; freeThreats: number; nearbyAllies: number;
  distanceToCatch: number; attackRange: number; readyCastRange: number;
  controlSeconds: number; moveSpeed: number;
  iq: number; teamfight: number; losingFight: boolean;
  underEnemyTower: boolean; takingTowerFire: boolean; abortingDive: boolean;
}): boolean {
  const { healthFraction, caughtEnemies, freeThreats, nearbyAllies, distanceToCatch,
    attackRange, readyCastRange, controlSeconds, moveSpeed, iq, teamfight, losingFight,
    underEnemyTower, takingTowerFire, abortingDive } = input;
  if (caughtEnemies === 0 || distanceToCatch > 650 || healthFraction <= 0.10
    || underEnemyTower || takingTowerFire || abortingDive) return false;
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

export function shouldSeekHealthRelic(input: {
  healthFraction: number; missingHealth: number; healAmount: number;
  distance: number; enemyDistanceToRelic: number; enemyDistanceToUnit: number;
  followUpEngage: boolean; pushWindow: boolean; underEnemyTower: boolean;
}): boolean {
  const { healthFraction, missingHealth, healAmount, distance, enemyDistanceToRelic,
    enemyDistanceToUnit, followUpEngage, pushWindow, underEnemyTower } = input;
  if (underEnemyTower || enemyDistanceToRelic < 185 || missingHealth < healAmount * 0.55) return false;
  if (followUpEngage && healthFraction >= 0.12) return false;
  if (healthFraction < 0.25) return distance <= 240 && enemyDistanceToUnit > 110;
  if (pushWindow || enemyDistanceToUnit < 200) return false;
  return healthFraction < 0.52 && distance <= 180;
}

export function shouldPushWithWave(input: {
  healthFraction: number; iq: number; lan: number; coachMacro: number;
  alliedWaveCount: number; enemyWaveCount: number; waveFrontDistance: number;
  structureDistance: number; nearbyAllies: number; nearbyEnemies: number;
  winningFightWindow: boolean;
}): boolean {
  const { healthFraction, iq, lan, coachMacro, alliedWaveCount, enemyWaveCount,
    waveFrontDistance, structureDistance, nearbyAllies, nearbyEnemies, winningFightWindow } = input;
  if (healthFraction < 0.43 || alliedWaveCount < 2 || waveFrontDistance > 360
    || structureDistance > 650 || nearbyEnemies > nearbyAllies + 1) return false;
  const macroRead = iq * 0.42 + lan * 0.38 + coachMacro * 1.5;
  return winningFightWindow || (macroRead >= 65 && alliedWaveCount >= enemyWaveCount)
    || (macroRead >= 52 && alliedWaveCount >= enemyWaveCount + 2);
}

export function laneAdvanceLimit(input: {
  team: 'blue' | 'red'; waveFrontX?: number; waveCount: number;
  structureX?: number; structureRange?: number;
  exposedNexus: boolean; objectiveFight: boolean;
}): number {
  const direction = input.team === 'blue' ? 1 : -1;
  if (input.exposedNexus || input.objectiveFight) return direction > 0 ? Infinity : -Infinity;
  if (input.waveCount > 0 && input.waveFrontX !== undefined)
    return input.waveFrontX + direction * 65;
  if (input.structureX !== undefined && input.structureRange !== undefined)
    return input.structureX - direction * (input.structureRange + 28);
  return direction > 0 ? Infinity : -Infinity;
}

export function wouldOverstep(team: 'blue' | 'red', x: number, limit: number): boolean {
  return (team === 'blue' ? 1 : -1) * (x - limit) > 10;
}
