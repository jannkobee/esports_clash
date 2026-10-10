// Player Card Unique Traits & Combat PlayStyle System
// Gives distinct cards game-changing behaviors that make every athlete play uniquely.

import type { AramChampionUnit, PlayerCard } from './types';

export type PlayerTraitKey =
  | 'Aggro Diver'
  | 'Clutch King'
  | 'Baron Steal'
  | 'One-Tap God'
  | 'Laning Demon'
  | 'Unkillable Demon'
  | 'Ice in Veins'
  | 'Vision Master'
  | 'Shotcaller'
  | 'Golden Flash';

export interface TraitDefinition {
  id: PlayerTraitKey;
  name: string;
  badge: string;
  icon: string;
  description: string;
  color: string;
}

export const PLAYER_TRAITS: Record<PlayerTraitKey, TraitDefinition> = {
  'Aggro Diver': {
    id: 'Aggro Diver',
    name: 'Aggro Diver',
    badge: 'Aggro Diver',
    icon: '⚡',
    description: 'Chases a wounded enemy under their turret when the dive is survivable, then looks for a safe way out.',
    color: '#f97316'
  },
  'Clutch King': {
    id: 'Clutch King',
    name: 'Clutch King',
    badge: 'Clutch King',
    icon: '👑',
    description: 'When wounded in an active fight, commits to the current attack or skill sequence instead of immediately retreating.',
    color: '#fbbf24'
  },
  'Baron Steal': {
    id: 'Baron Steal',
    name: 'Baron Steal',
    badge: 'Baron Steal',
    icon: '🎯',
    description: 'Rotates toward a contested objective as it gets low and watches for an ordinary last-hit opening.',
    color: '#38bdf8'
  },
  'One-Tap God': {
    id: 'One-Tap God',
    name: 'One-Tap God',
    badge: 'One-Tap God',
    icon: '💥',
    description: 'Finds an exposed marksman or mage, approaches from a safe angle, and spends a ready burst combo on that target.',
    color: '#ec4899'
  },
  'Laning Demon': {
    id: 'Laning Demon',
    name: 'Laning Demon',
    badge: 'Laning Demon',
    icon: '🔥',
    description: 'Secures last hits, clears the opposing wave, and escorts a friendly wave into the turret before pushing.',
    color: '#ef4444'
  },
  'Unkillable Demon': {
    id: 'Unkillable Demon',
    name: 'Unkillable Demon',
    badge: 'Unkillable Demon',
    icon: '🛡️',
    description: 'At low health, retreats through cover, baits a committed enemy skill, and re-enters if the enemy wastes it.',
    color: '#a855f7'
  },
  'Ice in Veins': {
    id: 'Ice in Veins',
    name: 'Ice in Veins',
    badge: 'Ice in Veins',
    icon: '❄️',
    description: 'Keeps a chosen fight plan through crowd control and resumes the combo as soon as control ends.',
    color: '#06b6d4'
  },
  'Vision Master': {
    id: 'Vision Master',
    name: 'Vision Master',
    badge: 'Vision Master',
    icon: '👁️',
    description: 'Uses an available ward to scout an unobserved objective pit or flank before the team commits.',
    color: '#10b981'
  },
  'Shotcaller': {
    id: 'Shotcaller',
    name: 'Shotcaller',
    badge: 'Shotcaller',
    icon: '📢',
    description: 'Calls the same objective or fight target for nearby allies and waits for the group before engaging.',
    color: '#8b5cf6'
  },
  'Golden Flash': {
    id: 'Golden Flash',
    name: 'Golden Flash',
    badge: 'Golden Flash',
    icon: '⚡',
    description: 'Reads visible skillshots using the card\'s ordinary dodge mechanics; a distinct sidestep move is planned.',
    color: '#eab308'
  }
};

/**
 * Checks whether a player card possesses a specific combat trait (via badges or personality).
 */
export function hasPlayerTrait(player: PlayerCard, trait: PlayerTraitKey): boolean {
  if (!player) return false;
  if (player.badges && player.badges.some(b => b.toLowerCase() === trait.toLowerCase())) {
    return true;
  }
  if (player.personality) {
    const p = player.personality.toLowerCase();
    if (trait === 'Aggro Diver' && (p.includes('aggro') || p.includes('diver'))) return true;
    if (trait === 'Clutch King' && (p.includes('clutch') || p.includes('ice-cold'))) return true;
    if (trait === 'Shotcaller' && (p.includes('shotcall') || p.includes('tactical'))) return true;
    if (trait === 'Unkillable Demon' && (p.includes('demon') || p.includes('unkillable'))) return true;
  }
  return false;
}

/**
 * Checks whether a unit should execute an aggressive tower dive.
 */
export function canAggroDive(
  unit: AramChampionUnit,
  target: AramChampionUnit,
  nearestTowerDist: number,
  context?: {
    alliedMinionsUnderTower?: number;
    defendersUnderTower?: number;
    attackersUnderTower?: number;
  }
): boolean {
  if (!hasPlayerTrait(unit.player, 'Aggro Diver')) return false;
  if (!target.isAlive) return false;
  if (target.zhonyaActive || (target.untargetableTimer ?? 0) > 0) return false;

  const targetHpRatio = target.hp / target.maxHp;
  const unitHpRatio = unit.hp / unit.maxHp;

  // Base Aggro Diver condition: enemy is low (<38%), diver has reasonable health (>30%), and target is near the tower (<320px)
  if (targetHpRatio > 0.38 || unitHpRatio < 0.30 || nearestTowerDist > 320) return false;

  // Tactical and avatar limits when context is available:
  if (context) {
    if ((context.defendersUnderTower ?? 1) > (context.attackersUnderTower ?? 1)) {
      return false;
    }
    const role = unit.champion?.primaryRole;
    if ((role === 'Mage' || role === 'Marksman' || role === 'Support') && (context.alliedMinionsUnderTower ?? 0) === 0 && targetHpRatio > 0.15) {
      return false;
    }
  }

  return true;
}

/**
 * Checks whether Clutch King holds the fight instead of retreating.
 */
export function shouldHoldClutchFight(
  unit: AramChampionUnit,
  localEnemiesCount: number
): boolean {
  if (!hasPlayerTrait(unit.player, 'Clutch King')) return false;
  if (unit.clutchCommitActive) return false;
  const hpRatio = unit.hp / unit.maxHp;
  // Trigger when low HP (<32%) and in active combat with at least 1 enemy nearby
  return hpRatio <= 0.32 && localEnemiesCount >= 1;
}

/**
 * Checks if unit can attempt an epic objective snipe / steal.
 */
export function canAttemptObjectiveSnipe(
  unit: AramChampionUnit,
  bossHpRatio: number,
  distToBoss: number
): boolean {
  if (!hasPlayerTrait(unit.player, 'Baron Steal')) return false;
  return bossHpRatio <= 0.32 && distToBoss <= 450;
}

/**
 * Checks whether One-Tap God should hunt an exposed carry.
 */
export function shouldHuntExposedCarry(
  unit: AramChampionUnit,
  candidate: AramChampionUnit,
  candidateAllies: AramChampionUnit[]
): boolean {
  if (!hasPlayerTrait(unit.player, 'One-Tap God') || unit.player.stats.iq < 60) return false;
  const isSquishy = candidate.champion.primaryRole === 'Marksman' || candidate.champion.primaryRole === 'Mage';
  return isSquishy && !candidateAllies.some(ally => ally.id !== candidate.id && ally.isAlive
    && Math.hypot(ally.x - candidate.x, ally.y - candidate.y) < 150);
}

/**
 * Checks whether Laning Demon should focus the early wave before pushing.
 */
export function shouldLaningDemonClearWave(
  unit: AramChampionUnit,
  matchSeconds: number,
  hasEnemyWave: boolean
): boolean {
  return hasPlayerTrait(unit.player, 'Laning Demon') && matchSeconds <= 240 && hasEnemyWave;
}

/**
 * Ice in Veins keeps the existing target in mind while crowd controlled.
 */
export function shouldHoldFightPlan(unit: AramChampionUnit): boolean {
  return hasPlayerTrait(unit.player, 'Ice in Veins') && unit.isAlive && unit.hp > 0;
}

/**
 * Unkillable Demon tries to bait a skill when wounded; damage is unchanged.
 */
export function shouldBaitEnemySkill(unit: AramChampionUnit, enemiesNearby: number): boolean {
  return hasPlayerTrait(unit.player, 'Unkillable Demon')
    && unit.hp / unit.maxHp <= 0.35 && enemiesNearby > 0;
}

