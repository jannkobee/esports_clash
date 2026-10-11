import type { ChampionKit, LaneStructure, StructureType } from './types';
import { PROPELLA_ATTACK_RANGE } from './propellaRules.ts';

const AUTHORED_ATTACK_RANGES: Readonly<Record<string, number>> = {
  Skybreaker: PROPELLA_ATTACK_RANGE,
  Solenne: 205,
  Aetherbolt: 205,
  Corsara: 190,
  Nullweaver: 175,
  Faelith: 180,
  Oathmute: 185,
  Cloudtail: 58,
  Stonebranch: 62,
  Wraithhook: 140,
  Voltgrip: 62,
  Mirehook: 58,
  Brewmaw: 60,
  Soulscourge: 180,
  Cinderbloom: 50,
  Cinderlock: 50,
  Croakwell: 65,
  Astra: 195,
  Tequoia: 190,
  Kindra: 185,
  'Kindra & Grim': 185,
  Cora: 180,
  Zal: 170,
  Raijin: 165,
  Kyumi: 145,
  Sylla: 130,
  Buck: 95,
  Renn: 65,
  Kazemaru: 55,
  Inai: 55,
  Kage: 50,
  Xin: 50,
  Kaolin: 50,
  Valkira: 50,
  Solana: 40,
};

export const STRUCTURE_HIT_RADIUS: Readonly<Record<StructureType, number>> = {
  outer_tower: 32,
  inner_tower: 32,
  nexus_tower: 32,
  barracks: 35,
  nexus: 58,
};

/**
 * Converts the kit's compact range rating only when an avatar does not have an
 * authored world-space override. Card ratings never enter physical reach.
 */
export function getChampionBasicAttackRange(
  champion: Pick<ChampionKit, 'name' | 'range'>
): number {
  const authored = AUTHORED_ATTACK_RANGES[champion.name];
  if (authored !== undefined) return authored;
  const kitRange = Number.isFinite(champion.range) ? Math.max(1, champion.range) : 1.5;
  const worldRange = kitRange >= 4 ? kitRange * 35 : kitRange * 30;
  return Math.round(Math.max(40, Math.min(205, worldRange)));
}

/**
 * Structure distance is center-to-center, so the visible contact radius is
 * added to weapon reach. An armed tower or Nexus caps that reach at its own
 * targeting radius: a champion can never damage it from a retaliation-proof
 * pocket. Unarmed barracks retain edge-aware contact without that cap.
 */
export function getStructureBasicAttackReach(
  attackRange: number,
  structure: Pick<LaneStructure, 'type' | 'range'>
): number {
  const edgeAwareReach = Math.max(0, attackRange) + STRUCTURE_HIT_RADIUS[structure.type];
  const isDefensiveStructure = structure.type.includes('tower') || structure.type === 'nexus';
  return isDefensiveStructure && structure.range > 0
    ? Math.min(edgeAwareReach, structure.range)
    : edgeAwareReach;
}

export function canBasicAttackStructure(
  attacker: { x: number; y: number; attackRange: number },
  structure: Pick<LaneStructure, 'x' | 'y' | 'type' | 'range'>
): boolean {
  return Math.hypot(structure.x - attacker.x, structure.y - attacker.y)
    <= getStructureBasicAttackReach(attacker.attackRange, structure);
}

