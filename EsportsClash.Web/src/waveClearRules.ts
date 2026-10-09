import type { MinionType } from './types';

/**
 * Calculates the Demolition Crash Multiplier when allied minions crash into an enemy structure.
 * - 0 minions: 0.28x (Backdoor Protection penalty - towers are fortified)
 * - 1 minion: 1.0x (Standard siege)
 * - 2+ minions: +22% per additional minion
 * - Cannon / Catapult minion: +30% siege fortification shred
 * Capped at 2.5x (Double to 2.5x damage fast push!)
 */
export function getMinionCrashMultiplier(alliedMinions: { type: MinionType }[]): number {
  if (alliedMinions.length === 0) return 0.28;
  const count = alliedMinions.length;
  const hasCannon = alliedMinions.some((m) => m.type === 'cannon');
  const bonus = (count - 1) * 0.22 + (hasCannon ? 0.30 : 0);
  return Math.min(2.5, 1.0 + bonus);
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
  lan: number
): boolean {
  if (cd > 0 || mana < 45 || clusteredMinionsCount < 2) return false;
  const isWaveclearRole = role === 'Mage' || role === 'Marksman' || role === 'Fighter';
  if (!isWaveclearRole) return false;
  const skillPriority = iq * 0.45 + lan * 0.55;
  return skillPriority >= 45 || mana >= 70;
}
