import {Anchor, Crown, Ghost, RefreshCw, Shield, Shuffle, Zap, type LucideIcon} from 'lucide-react';
import type {FpsCtPosition, FpsTPosition} from '../../fps/fpsIdentity';
import {fpsScale10} from '../../fps/fpsScale10';

export type Side = 't' | 'ct';
export type Position = FpsTPosition | FpsCtPosition;
export type AttributeKey = 'rifling' | 'sniping' | 'entry' | 'utility' | 'positioning' | 'shotcalling';

/** The six attributes in radar order: aim on the upper half, game sense on the lower half. */
export const ATTRIBUTES: {key: AttributeKey; label: string; short: string}[] = [
  {key: 'rifling', label: 'Rifling', short: 'RIF'},
  {key: 'entry', label: 'Entry', short: 'ENT'},
  {key: 'utility', label: 'Utility', short: 'UTL'},
  {key: 'shotcalling', label: 'Shotcalling', short: 'CAL'},
  {key: 'positioning', label: 'Positioning', short: 'POS'},
  {key: 'sniping', label: 'Sniping', short: 'SNP'},
];

/**
 * Position metadata for the tactics board. `weights` mirror FpsPlayerArchitecture::recommendedAssignments on the
 * server, so the strength fit shown here is the same capability score the server suggests roles from.
 * `x`/`y` place the position on the schematic board (percent), sites at the top.
 */
export const POSITIONS: Record<Position, {side: Side; label: string; short: string; icon: LucideIcon; job: string; weights: Partial<Record<AttributeKey, number>>; x: number; y: number}> = {
  T_ENTRY: {side: 't', label: 'Entry Rifler', short: 'Entry', icon: Zap, job: 'First through the door', weights: {entry: .6, rifling: .4}, x: 27, y: 38},
  T_SUPPORT: {side: 't', label: 'Support Rifler', short: 'Support', icon: Shield, job: 'Flashes and trades the entry', weights: {utility: .7, shotcalling: .3}, x: 38, y: 58},
  T_IGL: {side: 't', label: 'In-Game Leader', short: 'IGL', icon: Crown, job: 'Calls the round', weights: {shotcalling: 1}, x: 52, y: 76},
  T_FLEX: {side: 't', label: 'Flex', short: 'Flex', icon: Shuffle, job: 'Fills the gap, holds the AWP', weights: {rifling: .4, sniping: .3, positioning: .3}, x: 60, y: 50},
  T_LURKER: {side: 't', label: 'Lurker', short: 'Lurker', icon: Ghost, job: 'Works the far side alone', weights: {positioning: .7, rifling: .3}, x: 82, y: 40},
  CT_ANCHOR_A: {side: 'ct', label: 'A Anchor', short: 'A Anchor', icon: Anchor, job: 'Holds A to the last bullet', weights: {positioning: .6, utility: .4}, x: 20, y: 22},
  CT_IGL: {side: 'ct', label: 'In-Game Leader', short: 'IGL', icon: Crown, job: 'Reads the attack, calls rotations', weights: {shotcalling: 1}, x: 38, y: 44},
  CT_ROTATOR: {side: 'ct', label: 'Rotator', short: 'Rotator', icon: RefreshCw, job: 'Plays mid, rotates first', weights: {positioning: .65, rifling: .35}, x: 52, y: 62},
  CT_FLEX: {side: 'ct', label: 'Flex', short: 'Flex', icon: Shuffle, job: 'Adapts to the read, holds the AWP', weights: {rifling: .4, sniping: .3, positioning: .3}, x: 64, y: 40},
  CT_ANCHOR_B: {side: 'ct', label: 'B Anchor', short: 'B Anchor', icon: Anchor, job: 'Holds B to the last bullet', weights: {positioning: .6, utility: .4}, x: 80, y: 22},
};

export const SIDE_POSITIONS: Record<Side, Position[]> = {
  t: ['T_ENTRY', 'T_SUPPORT', 'T_IGL', 'T_FLEX', 'T_LURKER'],
  ct: ['CT_ANCHOR_A', 'CT_IGL', 'CT_ROTATOR', 'CT_FLEX', 'CT_ANCHOR_B'],
};

/** Strength fit for a position on the 1–10 scale (capability only; the assigned identity comes from personality). */
export function positionFit(stats: Partial<Record<string, number>> | undefined, position: Position): number {
  if (!stats) return 0;
  let score = 0;
  for (const [key, weight] of Object.entries(POSITIONS[position].weights)) score += (stats[key] ?? 50) * (weight ?? 0);
  return fpsScale10(score);
}

/** Rarity tier for a 1–10 rating: the colour language used on cards, badges and radar fills. */
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export function rarityOf(level: number): Rarity {
  return level >= 9 ? 'legendary' : level >= 7 ? 'epic' : level >= 5 ? 'rare' : level >= 3 ? 'uncommon' : 'common';
}
export const RARITY_LABELS: Record<Rarity, string> = {common: 'Prospect', uncommon: 'Pro', rare: 'Star', epic: 'Elite', legendary: 'Legend'};

/** The six attributes on the 1–10 scale; missing values stay undefined. */
export function scaledAttributes(stats?: Partial<Record<string, number>>): Partial<Record<AttributeKey, number>> {
  const out: Partial<Record<AttributeKey, number>> = {};
  for (const {key} of ATTRIBUTES) if (Number.isFinite(stats?.[key])) out[key] = fpsScale10(stats![key]!);
  return out;
}
