import type { AramChampionUnit, LaneStructure, BushPatch } from './types';
import { getChampionBasicAttackRange } from './basicAttackRangeRules.ts';

export interface TowerDiveRiskSituation {
  diver: AramChampionUnit;
  target?: AramChampionUnit;
  tower: LaneStructure;
  alliedMinionsUnderTower: number;
  defendersUnderTower: number;
  attackersUnderTower: number;
  takingTurretFire: boolean;
}

export interface TowerDiveRisk {
  shouldCommit: boolean;
  risk: number;
  expectedEliminationSeconds: number;
  expectedSurvivalSeconds: number;
  reason: string;
}

/**
 * A compact pre-engagement risk read, not a forced evacuation controller.
 * Turret damage remains real; IQ and the current local team state only affect
 * how much of a marginal risk a player is willing to accept.
 */
export function assessTowerDiveRisk(situation: TowerDiveRiskSituation): TowerDiveRisk {
  const { diver, target, tower, alliedMinionsUnderTower, defendersUnderTower,
    attackersUnderTower, takingTurretFire } = situation;
  const unavailable = (reason: string): TowerDiveRisk => ({ shouldCommit: false, risk: Infinity,
    expectedEliminationSeconds: Infinity, expectedSurvivalSeconds: 0, reason });
  if (!target?.isAlive || target.zhonyaActive || (target.untargetableTimer ?? 0) > 0) {
    return unavailable('target unavailable');
  }

  const distance = Math.hypot(target.x - diver.x, target.y - diver.y);
  const attackRange = getChampionBasicAttackRange(diver.champion);
  const approachSeconds = Math.max(0, distance - attackRange) / 85;
  const burstReady = (diver.cd1 <= 0 && diver.mana >= 35 ? diver.champion.skill1.damage : 0)
    + (diver.cd2 <= 0 && diver.mana >= 35 ? diver.champion.skill2.damage : 0)
    + (diver.level >= 6 && diver.cdUlt <= 0 && diver.mana >= 80 ? diver.champion.ultimate.damage : 0);
  const alliedPressure = Math.max(0, attackersUnderTower - 1) * Math.max(65, diver.champion.ad * .65);
  const targetEffectiveHp = target.hp + target.shield;
  const damagePerSecond = Math.max(45, diver.champion.ad + burstReady * .55 + alliedPressure);
  const expectedEliminationSeconds = approachSeconds + targetEffectiveHp / damagePerSecond;
  const turretDps = takingTurretFire ? tower.ad * 1.8 : tower.ad * (alliedMinionsUnderTower > 0 ? .32 : .9);
  const defenderPressure = Math.max(0, defendersUnderTower - Math.max(0, attackersUnderTower - 1)) * 55;
  const expectedSurvivalSeconds = (diver.hp + diver.shield) / Math.max(1, turretDps + defenderPressure);
  const iq = Math.max(1, Math.min(99, diver.player?.stats?.iq ?? 75));
  const traitIds = [diver.player?.primaryPersonality, diver.player?.secondaryPersonality]
    .filter(trait => !!trait);
  // The authored personality IDs drive gameplay. Normalize legacy display text
  // too so incomplete older cards remain deterministic during migration.
  const traits = [...traitIds, (diver.player?.personality ?? '').toLowerCase().replace(/[ /-]+/g, '_')].join('|');
  const riskTolerance = .72 + (100 - iq) * .004
    + (traits.includes('overconfident') || traits.includes('limit_tester') ? .18 : 0)
    + (traits.includes('clutch_performer') && targetEffectiveHp <= diver.champion.ad * 3 ? .14 : 0)
    - (traits.includes('survivalist') || traits.includes('cold_as_ice') ? .14 : 0);
  const risk = expectedEliminationSeconds / Math.max(.15, expectedSurvivalSeconds);
  const meaningfulWindow = expectedEliminationSeconds <= 5.5 && distance <= attackRange + 240;
  return {
    shouldCommit: meaningfulWindow && risk <= riskTolerance,
    risk,
    expectedEliminationSeconds,
    expectedSurvivalSeconds,
    reason: meaningfulWindow && risk <= riskTolerance ? 'favorable local damage window'
      : !meaningfulWindow ? 'target cannot be pressured soon enough' : 'survival window is too short',
  };
}

/** Keeps general retreat routing from selecting a bush that is already a turret death trap. */
export function isBushSafeFromTowers(
  bush: Pick<BushPatch, 'x' | 'y'>,
  enemyStructures: readonly LaneStructure[]
): boolean {
  return !enemyStructures.some(st =>
    st.isAlive && Math.hypot(bush.x - st.x, bush.y - st.y) <= st.range + 45
  );
}

/** A non-committing unit may hold a normal perimeter rather than drifting into fire. */
export function getTurretPerimeterHoldPoint(
  unit: { x: number; y: number; team: 'blue' | 'red' },
  tower: { x: number; y: number; range: number },
): { x: number; y: number } {
  const safeDirX = unit.team === 'blue' ? -1 : 1;
  const perimeterX = tower.x + safeDirX * (tower.range + 28);
  return { x: unit.team === 'blue' ? Math.min(unit.x, perimeterX) : Math.max(unit.x, perimeterX), y: unit.y };
}
