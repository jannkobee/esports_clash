export type AbilitySlot = 'skill1' | 'skill2' | 'ultimate';

export function abilityRank(level: number, slot: AbilitySlot): number {
  if (slot === 'ultimate') return level < 6 ? 0 : level < 11 ? 1 : level < 16 ? 2 : 3;
  const milestones = slot === 'skill1' ? [3, 4, 5, 7, 9] : [3, 6, 8, 10, 12];
  return milestones.filter(milestone => level >= milestone).length;
}

export function abilityDamageMultiplier(level: number, slot: AbilitySlot): number {
  const rank = abilityRank(level, slot);
  if (rank === 0) return 0;
  return slot === 'ultimate' ? [0, 0.52, 0.82, 1.12][rank]
    : [0, 0.38, 0.54, 0.71, 0.9, 1.12][rank];
}

export function abilityCooldownMultiplier(level: number, slot: AbilitySlot): number {
  const rank = abilityRank(level, slot);
  if (slot === 'ultimate') return [1, 1.15, 1, 0.85][rank];
  return [1.4, 1.25, 1.12, 1, 0.9, 0.8][rank];
}
