import type { AramChampionUnit, ChampionKit, ItemDef } from './types';
import { abilityRank } from './skillProgression.ts';

export type DamagingAbilitySlot = 'innate' | 'skill1' | 'skill2' | 'ultimate';

export function abilityDamageFromStats(
  rawDamage: number,
  champion: Pick<ChampionKit, 'primaryRole' | 'secondaryRole' | 'skill1' | 'skill2' | 'ultimate'>,
  slot: DamagingAbilitySlot,
  bonusAd: number,
  bonusAp: number
): number {
  if (slot === 'innate' || rawDamage <= 0) return rawDamage;
  const skill = champion[slot];
  const isMage = champion.primaryRole === 'Mage' || champion.secondaryRole === 'Mage';
  const isPhysicalRole = champion.primaryRole === 'Assassin'
    || champion.primaryRole === 'Fighter'
    || champion.primaryRole === 'Marksman';
  const adRatio = skill.adRatio ?? (isPhysicalRole ? 0.36 : 0.18);
  const apRatio = skill.apRatio ?? (isMage ? 0.42 : 0.25);
  return rawDamage + bonusAd * adRatio + bonusAp * apRatio;
}

export function abilityItemStats(unit: Pick<AramChampionUnit, 'items'>): { bonusAd: number; bonusAp: number } {
  return unit.items.reduce((total, item) => ({
    bonusAd: total.bonusAd + (item.stats.ad ?? 0),
    bonusAp: total.bonusAp + (item.stats.ap ?? 0),
  }), { bonusAd: 0, bonusAp: 0 });
}

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
