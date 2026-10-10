import type { AramChampionUnit, LaneStructure, BushPatch } from './types';
import { hasPlayerTrait } from './playerTraits.ts';

export interface AvatarDiveLimits {
  role: string;
  minHealthFraction: number;
  minHealthRaw: number;
  maxTargetHealthFraction: number;
  canSoloDiveWithoutMinions: boolean;
  isSquishyRanged: boolean;
  diveBurstRequired: boolean;
}

/**
 * Returns role-specific avatar durability and execution limits for tower diving.
 */
export function getAvatarDiveLimits(role: string): AvatarDiveLimits {
  switch (role) {
    case 'Tank':
      return {
        role,
        minHealthFraction: 0.40,
        minHealthRaw: 650,
        maxTargetHealthFraction: 0.38,
        canSoloDiveWithoutMinions: true,
        isSquishyRanged: false,
        diveBurstRequired: false,
      };
    case 'Fighter':
      return {
        role,
        minHealthFraction: 0.45,
        minHealthRaw: 600,
        maxTargetHealthFraction: 0.35,
        canSoloDiveWithoutMinions: true,
        isSquishyRanged: false,
        diveBurstRequired: false,
      };
    case 'Assassin':
      return {
        role,
        minHealthFraction: 0.45,
        minHealthRaw: 550,
        maxTargetHealthFraction: 0.32,
        canSoloDiveWithoutMinions: true,
        isSquishyRanged: false,
        diveBurstRequired: true,
      };
    case 'Marksman':
      return {
        role,
        minHealthFraction: 0.60,
        minHealthRaw: 700,
        maxTargetHealthFraction: 0.18,
        canSoloDiveWithoutMinions: false,
        isSquishyRanged: true,
        diveBurstRequired: false,
      };
    case 'Mage':
      return {
        role,
        minHealthFraction: 0.58,
        minHealthRaw: 620,
        maxTargetHealthFraction: 0.20,
        canSoloDiveWithoutMinions: false,
        isSquishyRanged: true,
        diveBurstRequired: true,
      };
    case 'Support':
    default:
      return {
        role,
        minHealthFraction: 0.55,
        minHealthRaw: 580,
        maxTargetHealthFraction: 0.22,
        canSoloDiveWithoutMinions: false,
        isSquishyRanged: true,
        diveBurstRequired: false,
      };
  }
}

export interface TowerDiveSituation {
  diver: AramChampionUnit;
  target: AramChampionUnit;
  tower: LaneStructure;
  alliedMinionsUnderTower: number;
  defendersUnderTower: number;
  attackersUnderTower: number;
}

/**
 * Comprehensive evaluation of whether a champion should execute or continue a tower dive,
 * respecting avatar limits (durability, burst, role) and player card attributes (IQ, traits).
 */
export function evaluateTowerDive(situation: TowerDiveSituation): { canDive: boolean; reason?: string } {
  const { diver, target, tower, alliedMinionsUnderTower, defendersUnderTower, attackersUnderTower } = situation;

  if (!target.isAlive) {
    return { canDive: false, reason: 'Target is already eliminated' };
  }

  // Invulnerability or massive shields make diving suicidal
  if (target.zhonyaActive || (target.untargetableTimer ?? 0) > 0) {
    return { canDive: false, reason: 'Target is golden in Zhonya stasis / untargetable' };
  }
  if (target.shield >= target.hp * 0.75) {
    return { canDive: false, reason: 'Target has protective barrier/shield absorbing lethal' };
  }

  const role = diver.champion.primaryRole;
  const limits = getAvatarDiveLimits(role);
  const diverHpRatio = diver.hp / diver.maxHp;
  const targetHpRatio = target.hp / target.maxHp;
  const iq = diver.player?.stats?.iq ?? 75;
  const hasAggroDiverTrait = hasPlayerTrait(diver.player, 'Aggro Diver');

  // 1. Raw HP Check: Turrets deal 288-396 true damage per shot.
  // Diver must be able to survive at least 2 turret shots.
  const minRequiredHp = hasAggroDiverTrait ? Math.max(480, limits.minHealthRaw * 0.85) : limits.minHealthRaw;
  if (diver.hp < minRequiredHp || diverHpRatio < (hasAggroDiverTrait ? 0.30 : limits.minHealthFraction)) {
    return { canDive: false, reason: 'Diver HP too low to withstand turret true damage shots' };
  }

  // 2. Target Lethality Check:
  const allowedTargetHp = hasAggroDiverTrait ? 0.38 : limits.maxTargetHealthFraction;
  if (targetHpRatio > allowedTargetHp) {
    return { canDive: false, reason: 'Target HP too healthy for a lethal dive' };
  }

  // 3. Defenders vs Attackers:
  // Diving outnumbered under an enemy turret is throwing the game
  if (defendersUnderTower > attackersUnderTower) {
    return { canDive: false, reason: 'Outnumbered under enemy turret' };
  }

  // 4. Minion Wave Buffer:
  // Diving with 0 minions requires either an Aggro Diver or very low target with healthy diver
  if (alliedMinionsUnderTower === 0) {
    if (limits.isSquishyRanged) {
      // Squishy mages and marksmen should never dive into turret range with 0 minions
      return { canDive: false, reason: 'Squishy ranged avatar cannot dive without minion wave buffer' };
    }
    if (!hasAggroDiverTrait && iq >= 70 && targetHpRatio > 0.18) {
      // High IQ player refuses to dive without wave crash unless target is 1-hit execute
      return { canDive: false, reason: 'High IQ player holds until minion wave crashes' };
    }
  }

  // 5. Cooldown & Burst Check:
  // Assassins and mages must have ability resources ready to burst the target down
  if (limits.diveBurstRequired) {
    const hasBurstReady = (diver.cd1 <= 0 && diver.mana >= 35) || (diver.level >= 6 && diver.cdUlt <= 0 && diver.mana >= 80);
    if (!hasBurstReady && targetHpRatio > 0.12) {
      return { canDive: false, reason: 'Burst cooldowns not ready to execute target quickly' };
    }
  }

  // 6. Aggro Diver Trait vs Normal Players:
  // Normal players only dive if target is low and conditions are favorable
  if (!hasAggroDiverTrait) {
    if (targetHpRatio > 0.22 && alliedMinionsUnderTower < 2) {
      return { canDive: false, reason: 'Non-diver requires wave advantage and critically low target' };
    }
  }

  return { canDive: true };
}

export interface AbortDiveCheck {
  diver: AramChampionUnit;
  target?: AramChampionUnit | null;
  tower: LaneStructure;
  alliedMinionsUnderTower: number;
  defendersUnderTower: number;
  diveDuration: number;
  takingTurretFire: boolean;
}

/**
 * Checks whether an in-progress tower dive has failed and must be aborted immediately
 * to avoid throwing the game and getting executed by the turret.
 */
export function shouldAbortTowerDive(check: AbortDiveCheck): { shouldAbort: boolean; reason: string } {
  const { diver, target, tower, alliedMinionsUnderTower, defendersUnderTower, diveDuration, takingTurretFire } = check;

  // 1. Target eliminated -> Dive finished, evacuate immediately!
  if (!target || !target.isAlive) {
    return { shouldAbort: true, reason: 'Target eliminated - evacuating turret zone' };
  }

  // 2. Target became invulnerable or heavily protected -> Dive failed!
  if (target.zhonyaActive || (target.untargetableTimer ?? 0) > 0) {
    return { shouldAbort: true, reason: 'Target entered Golden Stasis (Zhonya) - dive failed' };
  }
  if (target.shield >= target.hp * 0.8 && target.hp > 150) {
    return { shouldAbort: true, reason: 'Target gained heavy shield - cannot execute' };
  }

  // 3. Target escaped beyond reasonable reach
  const distToTarget = Math.hypot(target.x - diver.x, target.y - diver.y);
  if (distToTarget > diver.champion.range * 45 + 160) {
    return { shouldAbort: true, reason: 'Target retreated deeper into base - out of reach' };
  }

  // 4. Diver taking turret fire and HP dropping below safety threshold
  const diverHpRatio = diver.hp / diver.maxHp;
  const isTank = diver.champion.primaryRole === 'Tank';
  const emergencyHpThreshold = isTank ? 0.35 : 0.48;

  if (takingTurretFire && (diverHpRatio < emergencyHpThreshold || diver.hp < 480)) {
    return { shouldAbort: true, reason: 'Taking critical turret true damage - emergency evacuation' };
  }

  // 5. Dive timeout: After 2.6 seconds under tower, staying longer is throwing
  if (diveDuration >= 2.6) {
    return { shouldAbort: true, reason: 'Dive window exceeded 2.6s - disengaging before next shot' };
  }

  // 6. Minions wiped while diver is under tower
  if (alliedMinionsUnderTower === 0 && takingTurretFire && target.hp / target.maxHp > 0.15) {
    return { shouldAbort: true, reason: 'Minion wave dead and turret locked on diver' };
  }

  // 7. Diver suddenly outnumbered under tower
  if (defendersUnderTower >= 2 && !isTank && diverHpRatio < 0.65) {
    return { shouldAbort: true, reason: 'Enemy reinforcements arrived under tower' };
  }

  return { shouldAbort: false, reason: '' };
}

/**
 * Calculates the emergency evacuation target position and direction away from an enemy turret,
 * pulling the diver toward safety in lane and their allied side.
 */
export function getTurretEvacuationVector(
  diver: { x: number; y: number; team: 'blue' | 'red' },
  tower: { x: number; y: number; range: number },
  laneY: number = 360
): { targetX: number; targetY: number; escapeDirX: number } {
  const escapeDirX = diver.team === 'blue' ? -1 : 1;
  // Move well outside the turret range with safety buffer
  const safeDistance = tower.range + 75;
  const targetX = tower.x + escapeDirX * safeDistance;
  // Pull slightly toward lane center for clean regrouping
  const targetY = laneY + (diver.y - laneY) * 0.4;

  return { targetX, targetY, escapeDirX };
}

/**
 * Determines whether a retreat bush is safe from enemy towers.
 * A bush located inside or directly next to an enemy tower's attack range is a death trap.
 */
export function isBushSafeFromTowers(
  bush: Pick<BushPatch, 'x' | 'y'>,
  enemyStructures: readonly LaneStructure[]
): boolean {
  return !enemyStructures.some(st =>
    st.isAlive && Math.hypot(bush.x - st.x, bush.y - st.y) <= st.range + 45
  );
}

/**
 * Calculates a perimeter tether point outside an enemy turret's range,
 * allowing non-diving champions to poke or hold without wandering into turret fire.
 */
export function getTurretPerimeterHoldPoint(
  unit: { x: number; y: number; team: 'blue' | 'red' },
  tower: { x: number; y: number; range: number },
  laneY: number = 360
): { x: number; y: number } {
  const safeDirX = unit.team === 'blue' ? -1 : 1;
  const safeDist = tower.range + 28;
  const perimeterX = tower.x + safeDirX * safeDist;
  const clampedX = unit.team === 'blue' ? Math.min(unit.x, perimeterX) : Math.max(unit.x, perimeterX);
  return { x: clampedX, y: unit.y };
}
