import type { MinionType } from './types';

export interface WaveClearProfile {
  radius: number; speed?: number; size?: number; collisionRadius?: number;
  halfWidth?: number; halfHeight?: number;
}

// Explicitly supported Skill 1 deliveries, matching the existing champion spell geometry.
// Hooks, buffs, toggles, mobility and spellbooks must not become a generic instant AoE.
const WAVE_CLEAR_PROFILES: Record<string, WaveClearProfile> = {
  Soulscourge: { radius: 75 },
  Stonewake: { radius: 90, halfWidth: 90, halfHeight: 32 },
  Nullweaver: { radius: 42, speed: 420, size: 11, collisionRadius: 17 },
  Oathmute: { radius: 72, speed: 440, size: 10, collisionRadius: 15 },
  Corsara: { radius: 85, speed: 570, size: 8, collisionRadius: 14 },
  Brewmaw: { radius: 90, speed: 390, size: 12, collisionRadius: 22 },
  Hweilin: { radius: 75, speed: 510, size: 10, collisionRadius: 16 },
  Jaxon: { radius: 60, speed: 640, size: 9, collisionRadius: 13 },
  Skybreaker: { radius: 105, speed: 660, size: 11, collisionRadius: 18 },
};

export function getWaveClearProfile(name: string): WaveClearProfile | undefined { return WAVE_CLEAR_PROFILES[name]; }

export function isInsideWaveClear(point: { x: number; y: number }, center: { x: number; y: number }, profile: WaveClearProfile): boolean {
  return profile.halfWidth !== undefined && profile.halfHeight !== undefined
    ? Math.abs(point.x - center.x) < profile.halfWidth && Math.abs(point.y - center.y) < profile.halfHeight
    : Math.hypot(point.x - center.x, point.y - center.y) <= profile.radius;
}

export interface WaveClearContext {
  supported: boolean; manaCost: number; maxMana: number; cooldownSeconds: number;
  damage: number; basicDamage: number; minionHealth: number[];
  nearbyEnemies: number; secondsUntilObjective: number;
  siegeOpportunity: boolean; teamfight: number; laningDemon: boolean; macroStyle: boolean;
}

/**
 * Calculates the Demolition Crash Multiplier when allied minions crash into an enemy structure.
 * - 0 minions: 0.28x (Backdoor Protection penalty - towers are fortified)
 * - 1 minion: 1.0x (Standard siege)
 * - 2+ minions: +5% per additional minion
 * - Cannon / Catapult minion: +10% siege support
 * Capped at 1.35x. The wave already contributes its own structure DPS, so a
 * full crash must not also multiply every champion's late-game item scaling.
 */
export function getMinionCrashMultiplier(alliedMinions: { type: MinionType }[]): number {
  if (alliedMinions.length === 0) return 0.28;
  const count = alliedMinions.length;
  const hasCannon = alliedMinions.some((m) => m.type === 'cannon');
  const bonus = (count - 1) * 0.05 + (hasCannon ? 0.10 : 0);
  return Math.min(1.35, 1.0 + bonus);
}

/**
 * Calculates amplified siege damage dealt by minions against enemy structures.
 * - Cannon / Catapult: 2.5x base AD (heavy artillery siege damage)
 * - Caster: 1.6x base AD (ranged magic bombardment)
 * - Melee: 1.3x base AD (frontline siege bashing)
 */
export function getMinionStructureDamage(type: MinionType, ad: number): number {
  if (type === 'cannon') return Math.round(ad * 2.5);
  if (type === 'caster') return Math.round(ad * 1.6);
  return Math.round(ad * 1.3);
}

/**
 * Macro decision: Determines whether a champion should prioritize clearing enemy waves
 * before hitting a structure or chasing distant enemies.
 *
 * Rules:
 * 1. If enemy minions are alive in range and attacking allied minions or blocking the path,
 *    clearing them is required so allied minions can crash and remove the backdoor penalty.
 * 2. If a structure is near but 0 allied minions are under it, hitting it yields only 28% damage (backdoor).
 *    Clearing the enemy wave allows allied minions to escort and trigger the Crash Multiplier!
 * 3. High IQ / LAN players always prioritize fast wave shove when enemy champions are not in immediate threat range.
 */
export function shouldPrioritizeWaveClear(
  iq: number,
  lan: number,
  hasMinionInRange: boolean,
  hasStructureInRange: boolean,
  alliedMinionsAtStructure: number,
  closestEnemyChampDist: number
): boolean {
  if (!hasMinionInRange) return false;

  // If no allied minions are at the structure, attacking structure is crippled by backdoor penalty.
  // Clearing the wave is 100% top priority!
  if (hasStructureInRange && alliedMinionsAtStructure === 0) {
    return true;
  }

  const macroScore = iq * 0.5 + lan * 0.5;
  // Skilled players recognize the wave window early; weaker players sometimes chase instead.
  if (closestEnemyChampDist > 160) return macroScore >= 48;
  return closestEnemyChampDist > 110 && macroScore >= 74;
}

/**
 * Determines whether a champion should expend a skill to rapidly vaporize a minion wave.
 * High LAN / Mages / Marksmen recognize minion clusters (>= 2 minions) and fast-shove with abilities.
 */
export function shouldCastWaveClearSkill(
  role: string,
  mana: number,
  cd: number,
  clusteredMinionsCount: number,
  iq: number,
  lan: number,
  context?: WaveClearContext
): boolean {
  if (context) {
    if (!context.supported || context.damage <= 0 || context.nearbyEnemies > 0
      || context.minionHealth.length < 2 || context.manaCost > mana) return false;
    // Keep the skill available for an imminent contest, regardless of card preferences.
    if (context.secondsUntilObjective >= 0 && context.secondsUntilObjective <= context.cooldownSeconds + 4) return false;
    const reserve = context.maxMana * (0.2 + Math.max(0, Math.min(100, iq)) * 0.001
      + Math.max(0, Math.min(100, context.teamfight)) * 0.001);
    if (mana - context.manaCost < reserve) return false;
    const useful = context.minionHealth.filter(hp => hp > context.basicDamage);
    if (useful.length < 2) return false;
    const kills = context.minionHealth.filter(hp => hp > 0 && hp <= context.damage).length;
    const usefulDamage = useful.reduce((sum, hp) => sum + Math.min(hp, context.damage), 0);
    if (kills < 2 && (usefulDamage < context.basicDamage * 3 || (!context.siegeOpportunity && useful.length < 3))) return false;
    const preference = iq * 0.45 + lan * 0.55 + (context.laningDemon ? 10 : 0) + (context.macroStyle ? 5 : 0);
    return cd <= 0 && preference >= 45;
  }
  if (cd > 0 || mana < 45 || clusteredMinionsCount < 2) return false;
  const isWaveclearRole = role === 'Mage' || role === 'Marksman' || role === 'Fighter';
  if (!isWaveclearRole) return false;
  const skillPriority = iq * 0.45 + lan * 0.55;
  return skillPriority >= 45 || mana >= 70;
}
