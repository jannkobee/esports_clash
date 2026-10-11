import type { ChampionKit } from './types.ts';

/**
 * Ability cast-type groups, modeled on Dota 2's "Abilities by type":
 *  - unit:          Target Unit. Needs one eligible avatar (enemy or ally) in cast range.
 *  - point_or_unit: Target Point or Unit. Dashes, blinks and leaps aimed at a unit OR open ground.
 *  - area:          Target Area. Aimed at a ground point or direction (skillshots, zones, beams);
 *                   no unit has to be selected.
 *  - no_target:     No Target. Activates on or around the caster; usable at will.
 *  - toggle:        Toggle. Switches a stance or mode on and off.
 */
export type AbilityCastType = 'unit' | 'point_or_unit' | 'area' | 'no_target' | 'toggle';
export type CastSlot = 'skill1' | 'skill2' | 'ultimate';

export const CAST_TYPE_LABELS: Record<AbilityCastType, string> = {
  unit: 'Target Unit',
  point_or_unit: 'Target Point or Unit',
  area: 'Target Area',
  no_target: 'No Target',
  toggle: 'Toggle',
};

export const CAST_TYPE_DETAILS: Record<AbilityCastType, string> = {
  unit: 'Needs one eligible avatar inside cast range; dodgeable projectiles can still miss.',
  point_or_unit: 'Aimed at a unit or at open ground; it can be used to reposition without a target.',
  area: 'Aimed at a ground point or direction; no unit target is required.',
  no_target: 'Activates on or around the caster, so it can be used at will without a target.',
  toggle: 'Switches a stance or mode on and off rather than firing once.',
};

const U = 'unit', P = 'point_or_unit', A = 'area', N = 'no_target', T = 'toggle';
type Triple = readonly [AbilityCastType, AbilityCastType, AbilityCastType];

// [skill1, skill2, ultimate] for every playable avatar.
export const ABILITY_CAST_TYPES: Record<string, Triple> = {
  Solana: [U, U, A], Astra: [A, N, P], Kyumi: [A, U, P], Buck: [A, A, A],
  Valkira: [N, N, U], Kage: [A, P, U], Kazemaru: [A, A, U], Kindra: [N, A, N],
  Cora: [A, N, A], Renn: [P, U, N], Sylla: [A, N, N], Tequoia: [U, A, U],
  Zal: [A, U, U], Xin: [U, N, P], Raijin: [N, U, N], Kaolin: [A, P, N],
  Inai: [A, A, P], Veyara: [A, P, A], Cinderbloom: [U, N, U], Solenne: [U, U, A],
  Croakwell: [U, A, N], Soulscourge: [A, N, N], Stonewake: [A, N, N], Mirehook: [A, N, U],
  Nullweaver: [A, A, A], Voltgrip: [A, U, N], Aetherbolt: [A, P, A], Corsara: [A, A, A],
  Brewmaw: [A, U, A], Wraithhook: [A, N, N], Kaelen: [N, N, N], Hweilin: [A, A, A],
  Jaxon: [A, P, T], Valerie: [P, N, U], Jinxy: [T, A, A], Paxi: [A, N, U],
  Batrix: [P, A, U], Quillback: [U, N, N], Aetheris: [U, U, N], Faelith: [A, U, U],
  Oathmute: [A, U, N], Cloudtail: [A, N, N], Stonebranch: [A, P, A], Stepstone: [U, N, U],
  Skybreaker: [A, N, A],
  // Legacy kit name that older saves may still reference.
  Cinderlock: [U, N, U],
};

const SLOT_INDEX: Record<CastSlot, 0 | 1 | 2> = { skill1: 0, skill2: 1, ultimate: 2 };

export function getAbilityCastType(championName: string, slot: CastSlot): AbilityCastType {
  return ABILITY_CAST_TYPES[championName]?.[SLOT_INDEX[slot]] ?? 'unit';
}

/** True when the ability can fire with no unit selected (area, no-target, toggle or open-ground dash). */
export function canCastWithoutUnitTarget(castType: AbilityCastType): boolean {
  return castType !== 'unit';
}

/** Stamps `castType` onto every skill so the UI and AI read one source of truth. */
export function applyAbilityCastTypes(champions: ChampionKit[]): void {
  for (const champion of champions) {
    for (const slot of ['skill1', 'skill2', 'ultimate'] as const) {
      champion[slot].castType = getAbilityCastType(champion.name, slot);
    }
  }
}

export interface NoTargetMobilityState {
  healthFraction: number;
  targetDistance: number;
  targetHealthFraction: number;
  targetUnderEnemyTurret: boolean;
  nearbyAllies: number;
  nearbyEnemies: number;
}

/**
 * Raijin's Ball Lightning is a no-target ability, so it is used at will: to close a gap
 * or to finish a wounded champion (leaving a fight is handled by the retreat rule). It never
 * dashes at a target sitting under an enemy turret, so protected tower-dive limits keep control.
 */
export function shouldCastNoTargetMobilityUltimate(state: NoTargetMobilityState): boolean {
  if (state.targetUnderEnemyTurret) return false;
  const finish = state.targetHealthFraction < 0.3 && state.targetDistance <= 460;
  const gapClose = state.targetDistance >= 190 && state.targetDistance <= 460
    && state.healthFraction >= 0.55 && state.nearbyAllies + 1 >= state.nearbyEnemies;
  return finish || gapClose;
}

