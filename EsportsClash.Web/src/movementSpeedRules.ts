export const ORDINARY_MOVEMENT_BASE_SPEED = 85;
export const TOWER_EVACUATION_BASE_SPEED = 105;
export const STEALTH_MOVEMENT_BONUS = 60;
export const WARHORN_AURA_MOVEMENT_BONUS = 20;

export interface RetreatSpeedInput {
  bootsMoveSpeed?: number;
  orbMoveSpeed?: number;
  stealthActive?: boolean;
  warhornAuraActive?: boolean;
  emergencyTowerEvacuation?: boolean;
}

export interface RetreatSpeedBreakdown {
  base: number;
  boots: number;
  orbs: number;
  stealth: number;
  warhornAura: number;
  total: number;
}

/**
 * Movement remains simulation-owned. Ordinary retreat uses the same base pace
 * as normal lane and terrain routing. Tower evacuation keeps its direct
 * outward route and existing base pace, but no longer grants a failed diver
 * an extra rescue sprint.
 */
export function retreatSpeedBreakdown(input: RetreatSpeedInput): RetreatSpeedBreakdown {
  const emergency = input.emergencyTowerEvacuation === true;
  const breakdown = {
    base: emergency ? TOWER_EVACUATION_BASE_SPEED : ORDINARY_MOVEMENT_BASE_SPEED,
    boots: Math.max(0, input.bootsMoveSpeed ?? 0),
    orbs: Math.max(0, input.orbMoveSpeed ?? 0),
    stealth: input.stealthActive ? STEALTH_MOVEMENT_BONUS : 0,
    warhornAura: input.warhornAuraActive ? WARHORN_AURA_MOVEMENT_BONUS : 0,
  };

  return {
    ...breakdown,
    total: breakdown.base + breakdown.boots + breakdown.orbs + breakdown.stealth
      + breakdown.warhornAura,
  };
}

