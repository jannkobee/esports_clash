import type { AramChampionUnit } from './types';

/** Recovery intent persists while walking to cover, even during recall cooldown. */
export function shouldKeepRecallPlan(s: {
  healthFraction: number;
  manaFraction: number;
  manaDependent: boolean;
  lowHealth: boolean;
  dangerousFight: boolean;
  shopping: boolean;
  objectiveReset: boolean;
  previousIntent: boolean;
  inWell: boolean;
  followUp: boolean;
  combatCommit: boolean;
  pushWindow: boolean;
  objectiveCall: boolean;
}): boolean {
  if (s.inWell || s.followUp || s.combatCommit) return false;
  if (s.dangerousFight || s.lowHealth) return true;
  // Healthy conversions take precedence over optional resource/shopping resets.
  if (s.pushWindow || s.objectiveCall) return false;
  const needsMana = s.manaDependent && s.manaFraction <= 0.2;
  const stillRecovering = s.previousIntent
    && (s.healthFraction < 0.55 || (s.manaDependent && s.manaFraction < 0.45) || s.shopping);
  return needsMana || s.shopping || s.objectiveReset || stillRecovering;
}

/** Attack animation alone also describes last-hitting, camps, and structure hits. */
export function chooseNearbyFightingAlly(
  unit: AramChampionUnit, allies: readonly AramChampionUnit[],
  enemies: readonly AramChampionUnit[], second: number,
): AramChampionUnit | undefined {
  return allies.filter(ally => ally.id !== unit.id && ally.isAlive && !ally.isRecalling
    && !ally.recallIntent && !ally.diveAborting && ally.committedState !== 'retreat'
    && !ally.blackHole && !ally.corsaraBarrage && !ally.monkeySpin
    && Math.hypot(ally.x - unit.x, ally.y - unit.y) <= 500
    && enemies.some(enemy => enemy.isAlive && Math.hypot(enemy.x - ally.x, enemy.y - ally.y) <= 250
      && ((ally.lastEnemyDamage?.attackerId === enemy.id
        && second - ally.lastEnemyDamage.second >= 0 && second - ally.lastEnemyDamage.second <= 2.5)
        || (enemy.lastEnemyDamage?.attackerId === ally.id
          && second - enemy.lastEnemyDamage.second >= 0 && second - enemy.lastEnemyDamage.second <= 2.5))))
    .sort((a, b) => Math.hypot(a.x - unit.x, a.y - unit.y)
      - Math.hypot(b.x - unit.x, b.y - unit.y) || a.id.localeCompare(b.id))[0];
}
