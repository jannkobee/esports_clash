import type { AramChampionUnit, ItemDef } from './types';
import { abilityRank } from './skillProgression.ts';

export const maxMana = (unit: Pick<AramChampionUnit, 'items'>): number =>
  100 + unit.items.reduce((sum, item) => sum + (item.stats.mana ?? 0), 0);

export const manaRegen = (unit: Pick<AramChampionUnit, 'items'>): number =>
  unit.items.reduce((sum, item) => sum + (item.stats.manaRegen ?? 0), 0);

export const skill1ManaCost = (unit: Pick<AramChampionUnit, 'champion'>): number =>
  unit.champion.name === 'Cinderlock' || unit.champion.name === 'Cinderbloom' ? 20 : 45;

export const ultimateManaCost = (unit: Pick<AramChampionUnit, 'champion' | 'level'>): number =>
  unit.champion.name === 'Raijin' ? 58 + 5 * (abilityRank(unit.level, 'ultimate') - 1) : 100;

export const ultimateBaseCooldown = (unit: Pick<AramChampionUnit, 'champion' | 'level'>): number => {
  if (unit.champion.name === 'Raijin') return [3, 2.3, 1.6, 1][abilityRank(unit.level, 'ultimate') - 1];
  return unit.level >= 18 ? 35 : unit.level >= 16 ? 45 : unit.level >= 11 ? 60 : 75;
};

export const isSelfOrAllySecondSkill = (name: string): boolean =>
  ['Valkira', 'Cinderlock', 'Cinderbloom', 'Renn', 'Zal', 'Hweilin', 'Aetheris', 'Tequoia', 'Cloudtail'].includes(name);

export const wantsManaItem = (item: ItemDef): boolean =>
  (item.stats.mana ?? 0) > 0 || (item.stats.manaRegen ?? 0) > 0;
