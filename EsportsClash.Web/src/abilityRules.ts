import type { AramChampionUnit, ChampionKit, ItemDef } from './types';
import { abilityRank } from './skillProgression.ts';

export type DamagingAbilitySlot = 'innate' | 'skill1' | 'skill2' | 'ultimate';

export interface AbilityRatioInfo {
  adRatio: number;
  apRatio: number;
  adPercent: number;
  apPercent: number;
  ratioDesc: string;
}

/** Every damaging standard ability receives a modest, role-authored item ratio. */
export const MIN_ABILITY_RATIO = 0.15;
export const MAX_ABILITY_RATIO = 0.25;

export function getAbilityRatios(
  champion: Pick<ChampionKit, 'primaryRole' | 'secondaryRole'>,
  skill?: { adRatio?: number; apRatio?: number }
): AbilityRatioInfo {
  const roleRatios: Record<ChampionKit['primaryRole'], { adRatio: number; apRatio: number }> = {
    Mage: { adRatio: .15, apRatio: .25 },
    Marksman: { adRatio: .25, apRatio: .15 },
    Assassin: { adRatio: .23, apRatio: .18 },
    Fighter: { adRatio: .22, apRatio: .16 },
    Tank: { adRatio: .18, apRatio: .15 },
    Support: { adRatio: .15, apRatio: .20 },
  };
  const defaults = roleRatios[champion.primaryRole];
  const clampRatio = (ratio: number) => Math.max(MIN_ABILITY_RATIO, Math.min(MAX_ABILITY_RATIO, ratio));
  const adRatio = clampRatio(skill?.adRatio ?? defaults.adRatio);
  const apRatio = clampRatio(skill?.apRatio ?? defaults.apRatio);
  const adPercent = Math.round(adRatio * 100);
  const apPercent = Math.round(apRatio * 100);
  return {
    adRatio,
    apRatio,
    adPercent,
    apPercent,
    ratioDesc: `(+${adPercent}% AD, +${apPercent}% AP)`,
  };
}

export function abilityDamageFromStats(
  rawDamage: number,
  champion: Pick<ChampionKit, 'primaryRole' | 'secondaryRole' | 'skill1' | 'skill2' | 'ultimate'>,
  slot: DamagingAbilitySlot,
  bonusAd: number,
  bonusAp: number,
  ratioOverride?: { adRatio: number; apRatio: number }
): number {
  if (slot === 'innate' || rawDamage <= 0) return rawDamage;
  const skill = champion[slot];
  const ratios = ratioOverride ?? getAbilityRatios(champion, skill);
  return rawDamage + bonusAd * ratios.adRatio + bonusAp * ratios.apRatio;
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
  if (unit.champion.ultimate.catalogCooldownOverride !== undefined) return unit.champion.ultimate.catalogCooldownOverride;
  if(unit.champion.abilityRuleset)return unit.champion.ultimate.cooldown;
  if (unit.champion.name === 'Raijin') return [3, 2.3, 1.6, 1][abilityRank(unit.level, 'ultimate') - 1];
  return unit.level >= 18 ? 35 : unit.level >= 16 ? 45 : unit.level >= 11 ? 60 : 75;
};

export const isSelfOrAllySecondSkill = (name: string): boolean =>
  ['Valkira', 'Cinderlock', 'Cinderbloom', 'Renn', 'Zal', 'Hweilin', 'Aetheris', 'Tequoia', 'Cloudtail'].includes(name);

export const wantsManaItem = (item: ItemDef): boolean =>
  (item.stats.mana ?? 0) > 0 || (item.stats.manaRegen ?? 0) > 0;
