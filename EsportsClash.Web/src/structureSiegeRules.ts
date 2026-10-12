export interface StructureAttackBreakdown {
  baseAttackDamage: number;
  persistentAttackBonus?: number;
  criticalBonus?: number;
  championOnHitBonus?: number;
  temporaryCombatMultiplier?: number;
}

/**
 * Structures receive the attacker's authored AD, item AD already folded into
 * that value, and persistent team/buff AD. Champion-combat procs are excluded:
 * they must not randomly burst a building or prime themselves on one.
 */
export function structureBasicAttackDamage(input: StructureAttackBreakdown): number {
  return Math.max(1, input.baseAttackDamage + (input.persistentAttackBonus ?? 0));
}

export function activeSiegeMultiplier(
  buff: { team: 'blue' | 'red'; expiresAt: number; siegeMultiplier: number } | null,
  attackerTeam: 'blue' | 'red',
  now: number,
): number {
  return buff?.team === attackerTeam && now <= buff.expiresAt ? buff.siegeMultiplier : 1;
}

export interface StructureDpsAttacker {
  attackDamage: number;
  attacksPerSecond: number;
  marksman?: boolean;
}

/** Deterministic audit helper; it is not used as a gameplay clock. */
export function estimateStructureTimeToDestroy(
  health: number,
  attackers: readonly StructureDpsAttacker[],
  waveMultiplier: number,
  platingMultiplier: number,
  minionDps = 0,
  siegeMultiplier = 1,
): number {
  const championDps = attackers.reduce((total, attacker) => total
    + attacker.attackDamage * attacker.attacksPerSecond * (attacker.marksman ? 1.25 : 1), 0)
    * waveMultiplier * siegeMultiplier;
  const appliedDps = (championDps + minionDps) * platingMultiplier;
  return appliedDps > 0 ? health / appliedDps : Infinity;
}
