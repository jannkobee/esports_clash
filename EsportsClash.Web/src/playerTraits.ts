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
    description: 'Fearlessly dives enemy towers to execute low-HP targets (<38% HP) with a bonus dive shield and movespeed.',
    color: '#f97316'
  },
  'Clutch King': {
    id: 'Clutch King',
    name: 'Clutch King',
    badge: 'Clutch King',
    icon: '👑',
    description: 'Refuses to retreat when low HP (<32%). Triggers Clutch Surge: barrier, +25% attack speed, +30% crit, and outplay bonus when outnumbered.',
    color: '#fbbf24'
  },
  'Baron Steal': {
    id: 'Baron Steal',
    name: 'Baron Steal',
    badge: 'Baron Steal',
    icon: '🎯',
    description: 'Specializes in epic objective snipes. Sprints to the pit and delivers a +50% true damage execute burst on monsters below 20% HP.',
    color: '#38bdf8'
  },
  'One-Tap God': {
    id: 'One-Tap God',
    name: 'One-Tap God',
    badge: 'One-Tap God',
    icon: '💥',
    description: 'Bypasses frontline tanks to lock onto squishy carries (Marksman/Mage). Deals +25% critical burst against isolated enemies.',
    color: '#ec4899'
  },
  'Laning Demon': {
    id: 'Laning Demon',
    name: 'Laning Demon',
    badge: 'Laning Demon',
    icon: '🔥',
    description: 'Dominates the lane wave early. Deals +20% damage to minions/structures and applies a stacking attack speed slow to opponents.',
    color: '#ef4444'
  },
  'Unkillable Demon': {
    id: 'Unkillable Demon',
    name: 'Unkillable Demon',
    badge: 'Unkillable Demon',
    icon: '🛡️',
    description: 'Slippery survivalist. When below 35% HP, gains +35% move speed and 35% damage evasion, baiting enemy cooldowns.',
    color: '#a855f7'
  },
  'Ice in Veins': {
    id: 'Ice in Veins',
    name: 'Ice in Veins',
    badge: 'Ice in Veins',
    icon: '❄️',
    description: 'Innate tenacity. Reduces all incoming crowd control durations by 40% and maintains flawless decision-making under high pressure.',
    color: '#06b6d4'
  },
  'Vision Master': {
    id: 'Vision Master',
    name: 'Vision Master',
    badge: 'Vision Master',
    icon: '👁️',
    description: 'Proactively places deep vision wards directly in the Dragon and Golem pits, preventing enemy sneak attempts.',
    color: '#10b981'
  },
  'Shotcaller': {
    id: 'Shotcaller',
    name: 'Shotcaller',
    badge: 'Shotcaller',
    icon: '📢',
    description: 'Tactical captain. Sounds a Rally Call during teamfights and objective contests, giving nearby allies +25 move speed and fast regrouping.',
    color: '#8b5cf6'
  },
  'Golden Flash': {
    id: 'Golden Flash',
    name: 'Golden Flash',
    badge: 'Golden Flash',
    icon: '⚡',
    description: 'Peak mechanical reaction time. Gains +15% dodge odds and instant disengage positioning when collapsed upon.',
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
  nearestTowerDist: number
): boolean {
  if (!hasPlayerTrait(unit.player, 'Aggro Diver')) return false;
  if (!target.isAlive) return false;
  const targetHpRatio = target.hp / target.maxHp;
  const unitHpRatio = unit.hp / unit.maxHp;

  // Dive condition: enemy is low (<38%), diver has reasonable health (>30%), and target is near the tower (<320px)
  return targetHpRatio <= 0.38 && unitHpRatio >= 0.30 && nearestTowerDist <= 320;
}

/**
 * Checks whether Clutch King activates Clutch Surge when dropped low in combat.
 */
export function shouldTriggerClutchSurge(
  unit: AramChampionUnit,
  localEnemiesCount: number
): boolean {
  if (!hasPlayerTrait(unit.player, 'Clutch King')) return false;
  if (unit.clutchSurgeActive) return false;
  const hpRatio = unit.hp / unit.maxHp;
  // Trigger when low HP (<32%) and in active combat with at least 1 enemy nearby
  return hpRatio <= 0.32 && localEnemiesCount >= 1;
}

/**
 * Calculates Clutch Surge combat bonuses (scales with card CLU attribute).
 */
export function getClutchSurgeBonuses(unit: AramChampionUnit, isOutnumbered: boolean) {
  const clu = Math.max(50, Math.min(99, unit.player.stats.clu ?? 75)) / 99;
  return {
    shieldAmount: Math.round(unit.maxHp * (0.16 + clu * 0.08)), // 20-24% Max HP shield
    aspdMultiplier: 1.25 + clu * 0.10,                          // +25-35% Attack Speed
    critBonus: 0.30 + clu * 0.15,                               // +30-45% Crit Chance
    damageMultiplier: isOutnumbered ? 1.20 + clu * 0.08 : 1.10   // 1vX outplay bonus damage
  };
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
 * Returns bonus execute damage for Baron Steal specialists against epic bosses.
 */
export function getObjectiveSmiteBonus(
  unit: AramChampionUnit,
  bossHp: number,
  bossMaxHp: number
): number {
  if (!hasPlayerTrait(unit.player, 'Baron Steal')) return 0;
  const ratio = bossHp / bossMaxHp;
  if (ratio <= 0.22) {
    // Delivers high true-damage smite execute (+50% bonus damage)
    return Math.round(unit.champion.ad * 1.5 + unit.player.stats.clu * 4);
  }
  return 0;
}

/**
 * Checks whether One-Tap God should prioritize target squishy carries.
 */
export function getOneTapTargetPriority(
  unit: AramChampionUnit,
  candidate: AramChampionUnit
): number {
  if (!hasPlayerTrait(unit.player, 'One-Tap God')) return 0;
  const isSquishy = candidate.champion.primaryRole === 'Marksman' || candidate.champion.primaryRole === 'Mage';
  return isSquishy ? 280 : 0;
}

/**
 * Checks whether Laning Demon deals bonus wave/tower damage early game.
 */
export function getLaningDemonDamageMultiplier(
  unit: AramChampionUnit,
  targetType: 'minion' | 'structure',
  matchSeconds: number
): number {
  if (!hasPlayerTrait(unit.player, 'Laning Demon')) return 1.0;
  // Active in the early-to-mid laning phase (<240s)
  if (matchSeconds <= 240 && (targetType === 'minion' || targetType === 'structure')) {
    return 1.22; // +22% damage
  }
  return 1.0;
}

/**
 * Tenacity reduction multiplier for Ice in Veins (reduces incoming CC durations).
 */
export function getTenacityMultiplier(unit: AramChampionUnit): number {
  if (hasPlayerTrait(unit.player, 'Ice in Veins')) {
    return 0.60; // 40% reduction
  }
  return 1.0;
}

/**
 * Unkillable Demon evasion chance when low HP (<35%).
 */
export function getUnkillableDodgeChance(unit: AramChampionUnit): number {
  if (!hasPlayerTrait(unit.player, 'Unkillable Demon')) return 0;
  if (unit.hp / unit.maxHp <= 0.35) {
    return 0.35; // 35% chance to evade/bait
  }
  return 0;
}

