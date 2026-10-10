export const PROPELLA_MAX_ROTOR_STACKS = 6;
export const PROPELLA_ROTOR_STACK_SECONDS = 3.5;
export const PROPELLA_OVERDRIVE_SECONDS = 5;
export const PROPELLA_ATTACK_RANGE = 180;

export function propellaRotorStacksAfterAttack(currentStacks: number): number {
  return Math.min(PROPELLA_MAX_ROTOR_STACKS, Math.max(0, Math.floor(currentStacks)) + 1);
}

export function propellaAttackSpeedBonus(
  rotorStacks: number,
  overdriveActive: boolean,
  gunshipActive: boolean
): number {
  const stacks = Math.min(PROPELLA_MAX_ROTOR_STACKS, Math.max(0, Math.floor(rotorStacks)));
  return stacks * 0.025 + (overdriveActive ? 0.35 : 0) + (gunshipActive ? 0.45 : 0);
}

export function propellaFlakSplashRatio(level: number, gunshipActive: boolean): number {
  const safeLevel = Math.min(18, Math.max(1, Math.floor(level)));
  return 0.18 + safeLevel * 0.005 + (gunshipActive ? 0.12 : 0);
}

export function propellaGunshipDurationAtRank(rank: number): number {
  return 7 + Math.min(4, Math.max(1, Math.floor(rank)));
}
