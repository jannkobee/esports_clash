import type { ChampionKit } from './types';
import { getChampionBasicAttackRange } from './basicAttackRangeRules.ts';

export const KINDRA_HUNT_DURATION = 5;
export const KINDRA_HUNT_RANGE_MULTIPLIER = 1.15;
export const KINDRA_HUNT_DAMAGE_MULTIPLIER = 1.15;
export const KINDRA_LOW_HEALTH_THRESHOLD = 0.40;
export const BUCK_SMOKE_RADIUS = 55;
export const BUCK_SMOKE_DURATION = 2.5;
export const BUCK_SMOKE_MELEE_RANGE = 55;
export const LAMBS_RESPITE_RADIUS = 65;
export const LAMBS_RESPITE_DURATION = 4;
export const LAMBS_RESPITE_HEALTH_FLOOR = 0.10;
export const LAMBS_RESPITE_BASE_HEAL = 450;

export function isKindra(championName: string): boolean {
  return championName === 'Kindra' || championName === 'Kindra & Grim';
}

export function shouldTriggerKindraHunt(
  championName: string,
  targetType: 'champion' | 'minion' | 'structure' | 'camp' | 'dragon',
  targetHealthFraction = 1,
): boolean {
  if (!isKindra(championName)) return false;
  if (targetType === 'camp' || targetType === 'dragon') return true;
  return targetType === 'champion' && targetHealthFraction <= KINDRA_LOW_HEALTH_THRESHOLD;
}

export function getAbilityAdjustedBasicAttackRange(
  champion: Pick<ChampionKit, 'name' | 'range'>,
  kindraHuntSeconds: number,
  insideEnemySmoke: boolean,
): number {
  const baseRange = getChampionBasicAttackRange(champion);
  const huntedRange = isKindra(champion.name) && kindraHuntSeconds > 0
    ? baseRange * KINDRA_HUNT_RANGE_MULTIPLIER
    : baseRange;
  return insideEnemySmoke ? Math.min(huntedRange, BUCK_SMOKE_MELEE_RANGE) : huntedRange;
}

export function getKindraHuntDamageMultiplier(championName: string, huntSeconds: number): number {
  return isKindra(championName) && huntSeconds > 0 ? KINDRA_HUNT_DAMAGE_MULTIPLIER : 1;
}

export function getLambsRespiteMinimumHealth(maxHealth: number): number {
  return Math.round(Math.max(0, maxHealth) * LAMBS_RESPITE_HEALTH_FLOOR);
}

export function getLambsRespiteExpiryHeal(rankMultiplier: number): number {
  return LAMBS_RESPITE_BASE_HEAL * Math.max(0, rankMultiplier);
}
