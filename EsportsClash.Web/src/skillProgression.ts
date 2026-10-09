export type AbilitySlot = 'innate' | 'skill1' | 'skill2' | 'ultimate';

export const LEVEL_CAP = 18;
export const MAX_SKILL_RANKS: Record<AbilitySlot, number> = {
  innate: 1,
  skill1: 7,
  skill2: 7,
  ultimate: 4
};

// Skill milestones across 18 levels:
// Innate: always active (level 1-18)
// Skill 1: 7 levels (ranks 1 to 7 at milestones [1, 4, 7, 9, 12, 14, 17])
// Skill 2: 7 levels (ranks 1 to 7 at milestones [2, 5, 8, 10, 13, 15, 18])
// Ultimate: 4 levels (ranks 1 to 4 at milestones [6, 11, 16, 18])
// Total allocated points across 18 levels = 7 + 7 + 4 = 18 points.
const SKILL1_MILESTONES = [1, 4, 7, 9, 12, 14, 17];
const SKILL2_MILESTONES = [2, 5, 8, 10, 13, 15, 18];
const ULTIMATE_MILESTONES = [6, 11, 16, 18];

export function abilityRank(level: number, slot: AbilitySlot): number {
  const cappedLevel = Math.min(LEVEL_CAP, Math.max(1, level));
  if (slot === 'innate') return 1;
  if (slot === 'ultimate') {
    return ULTIMATE_MILESTONES.filter(milestone => cappedLevel >= milestone).length;
  }
  const milestones = slot === 'skill1' ? SKILL1_MILESTONES : SKILL2_MILESTONES;
  return milestones.filter(milestone => cappedLevel >= milestone).length;
}

export function abilityDamageMultiplier(level: number, slot: AbilitySlot): number {
  if (slot === 'innate') return 1.0;
  const rank = abilityRank(level, slot);
  if (rank === 0) return 0;
  if (slot === 'ultimate') {
    // 4 Ranks: Rank 1 -> 0.55, Rank 2 -> 0.80, Rank 3 -> 1.05, Rank 4 -> 1.30
    const ultTable = [0, 0.55, 0.80, 1.05, 1.30];
    return ultTable[rank] ?? 1.30;
  }
  // 7 Ranks: Rank 1 -> 0.40, Rank 2 -> 0.55, Rank 3 -> 0.70, Rank 4 -> 0.85, Rank 5 -> 1.00, Rank 6 -> 1.15, Rank 7 -> 1.30
  const basicTable = [0, 0.40, 0.55, 0.70, 0.85, 1.00, 1.15, 1.30];
  return basicTable[rank] ?? 1.30;
}

export function abilityCooldownMultiplier(level: number, slot: AbilitySlot): number {
  if (slot === 'innate') return 1.0;
  const rank = abilityRank(level, slot);
  if (rank === 0) return 1.30;
  if (slot === 'ultimate') {
    // 4 Ranks: Rank 1 -> 1.15, Rank 2 -> 1.00, Rank 3 -> 0.85, Rank 4 -> 0.70
    const ultCdTable = [1.20, 1.15, 1.00, 0.85, 0.70];
    return ultCdTable[rank] ?? 0.70;
  }
  // 7 Ranks: Rank 1 -> 1.30, Rank 2 -> 1.20, Rank 3 -> 1.10, Rank 4 -> 1.00, Rank 5 -> 0.90, Rank 6 -> 0.80, Rank 7 -> 0.70
  const basicCdTable = [1.35, 1.30, 1.20, 1.10, 1.00, 0.90, 0.80, 0.70];
  return basicCdTable[rank] ?? 0.70;
}
