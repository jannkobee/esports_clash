export type KaelenElement = 'ice' | 'wind' | 'fire';
export type KaelenSpellControl = 'stun' | 'root' | 'knockup' | 'knockback' | 'none';

export interface KaelenInvokedSpell {
  id: string;
  name: string;
  recipe: readonly [KaelenElement, KaelenElement, KaelenElement];
  cooldown: number;
  damage: number;
  radius: number;
  control: KaelenSpellControl;
  controlDuration: number;
  shape: 'burst' | 'line' | 'snowball' | 'meteor' | 'self';
  range: number;
  mana: number;
  delay: number;
  speed: number;
  description: string;
  comboTip: string;
  color: string;
}

export interface KaelenOrbStats {
  healthRegen: number;
  moveSpeed: number;
  spellAmp: number;
  damageAmp: number;
}

export type KaelenOrbCounts = Record<KaelenElement, number>;

export const KAELEN_ELEMENTS: readonly KaelenElement[] = ['ice', 'wind', 'fire'];
const ORB_RANK_MILESTONES = [1, 4, 7, 9, 12, 14, 17] as const;

export function kaelenOrbRankAtLevel(level: number): number {
  const cappedLevel = Math.min(18, Math.max(1, level));
  return ORB_RANK_MILESTONES.filter(milestone => cappedLevel >= milestone).length;
}

export function kaelenOrbCounts(orbs: readonly KaelenElement[]): KaelenOrbCounts {
  return orbs.slice(-3).reduce<KaelenOrbCounts>((counts, element) => {
    counts[element] += 1;
    return counts;
  }, { ice: 0, wind: 0, fire: 0 });
}

export function kaelenOrbStatBonuses(level: number, counts: KaelenOrbCounts): KaelenOrbStats {
  const rankScale = 1 + (kaelenOrbRankAtLevel(level) - 1) * 0.25;
  return {
    healthRegen: counts.ice * 0.2 * rankScale,
    moveSpeed: counts.wind * rankScale,
    spellAmp: counts.fire * 0.01 * rankScale,
    damageAmp: counts.fire * 0.01 * rankScale
  };
}

const SPELL_BASES = [
  { id: 'glacier-lock', name: 'Glacier Lock', recipe: ['ice', 'ice', 'ice'], cooldown: 12, damage: 180, radius: 75, control: 'stun', controlDuration: 0.8 },
  { id: 'rime-gale', name: 'Rime Gale', recipe: ['ice', 'ice', 'wind'], cooldown: 10, damage: 160, radius: 90, control: 'root', controlDuration: 0.8 },
  { id: 'sleetflare', name: 'Sleetflare', recipe: ['ice', 'ice', 'fire'], cooldown: 11, damage: 210, radius: 100, control: 'root', controlDuration: 1 },
  { id: 'whiteout-step', name: 'Whiteout Step', recipe: ['ice', 'wind', 'wind'], cooldown: 9, damage: 125, radius: 70, control: 'none', controlDuration: 0 },
  { id: 'primal-tempest', name: 'Primal Tempest', recipe: ['ice', 'wind', 'fire'], cooldown: 14, damage: 220, radius: 120, control: 'knockup', controlDuration: 0.8 },
  { id: 'emberfrost-lance', name: 'Emberfrost Lance', recipe: ['ice', 'fire', 'fire'], cooldown: 8, damage: 245, radius: 45, control: 'root', controlDuration: 0.7 },
  { id: 'skyshatter', name: 'Skyshatter', recipe: ['wind', 'wind', 'wind'], cooldown: 13, damage: 150, radius: 100, control: 'knockup', controlDuration: 0.75 },
  { id: 'ashen-cyclone', name: 'Ashen Cyclone', recipe: ['wind', 'wind', 'fire'], cooldown: 15, damage: 190, radius: 115, control: 'knockup', controlDuration: 0.8 },
  { id: 'sirocco-flare', name: 'Sirocco Flare', recipe: ['wind', 'fire', 'fire'], cooldown: 16, damage: 205, radius: 90, control: 'knockback', controlDuration: 0 },
  { id: 'solar-pike', name: 'Solar Pike', recipe: ['fire', 'fire', 'fire'], cooldown: 17, damage: 270, radius: 38, control: 'none', controlDuration: 0 }
] as const;

const SPELL_DETAILS: Record<string, Omit<KaelenInvokedSpell, 'id' | 'name' | 'recipe' | 'cooldown' | 'damage' | 'radius' | 'control' | 'controlDuration'>> = {
  'glacier-lock': { shape: 'burst', range: 300, mana: 25, delay: 0.25, speed: 0, color: '#7dd3fc', description: 'Mark a ground circle, then shatter it after 0.25s. Enemies still inside take one hit and are stunned for 0.8s.', comboTip: 'Use the stun to set up Solar Meteor or a narrow Emberfrost Lance.' },
  'rime-gale': { shape: 'snowball', range: 360, mana: 25, delay: 0, speed: 230, color: '#e0f2fe', description: 'Roll a growing snowball along the aimed line. Its hit radius grows from 22 to 48; each enemy can be struck once and rooted for 0.8s. It does not carry or move Arsenaldo.', comboTip: 'Roll through grouped enemies, then detonate Sleetflare where they stop.' },
  'sleetflare': { shape: 'burst', range: 320, mana: 30, delay: 0.45, speed: 0, color: '#c4b5fd', description: 'Telegraph a frostfire field for 0.45s, then deal one area hit and root enemies inside for 1s.', comboTip: 'Follow a snowball root; finish with Emberfrost Lance.' },
  'whiteout-step': { shape: 'self', range: 0, mana: 25, delay: 0, speed: 0, color: '#a7f3d0', description: 'Burst cold wind around Arsenaldo, damaging nearby enemies and restoring 80 health, capped at maximum health. No teleport, dash, or invulnerability.', comboTip: 'A close-range recovery tool before Sirocco Flare pushes divers away.' },
  'primal-tempest': { shape: 'burst', range: 320, mana: 35, delay: 0.4, speed: 0, color: '#c084fc', description: 'Combine all three elements into a ground eruption after 0.4s. Damage and knock enemies airborne for 0.8s.', comboTip: 'Lift a cluster before dropping Solar Meteor.' },
  'emberfrost-lance': { shape: 'line', range: 400, mana: 25, delay: 0, speed: 480, color: '#fda4af', description: 'Launch a narrow piercing frostfire lance. Each enemy crossed takes one hit and a 0.7s root; sidestepping the aimed line avoids it.', comboTip: 'Reliable follow-through after Glacier Lock or Sleetflare.' },
  'skyshatter': { shape: 'line', range: 360, mana: 25, delay: 0, speed: 300, color: '#a5f3fc', description: 'Send a piercing wind front down the aimed line, damaging each enemy once and lifting them for 0.75s.', comboTip: 'Set up an Ashen Cyclone across the landing area.' },
  'ashen-cyclone': { shape: 'burst', range: 340, mana: 30, delay: 0.55, speed: 0, color: '#fdba74', description: 'Telegraph a burning cyclone for 0.55s, then damage the area and knock enemies up for 0.8s. This is one eruption, not repeated damage ticks.', comboTip: 'Chain after Skyshatter, then finish with a meteor.' },
  'sirocco-flare': { shape: 'line', range: 320, mana: 30, delay: 0, speed: 370, color: '#fb923c', description: 'Send a broad flame front through enemies. Each takes one hit and is pushed 58 units away from the cast origin; terrain still blocks displacement.', comboTip: 'Peel enemies off Arsenaldo after Whiteout Step. Avoid pushing enemies out of an allied meteor.' },
  'solar-pike': { shape: 'meteor', range: 420, mana: 35, delay: 0.8, speed: 0, color: '#f97316', description: 'Mark the ground for 0.8s, then drop a blazing meteor for one area impact. The landing point is fixed at cast time: enemies can walk out.', comboTip: 'Follow Glacier Lock or Primal Tempest so the target cannot easily leave the impact circle.' },
};

export const KAELEN_ORB_MANA = 5;
export const KAELEN_ACTION_INTERVAL = 0.18;
export const KAELEN_INVOKED_SPELLS: readonly KaelenInvokedSpell[] = SPELL_BASES.map(spell => ({
  ...spell, ...SPELL_DETAILS[spell.id],
  name: spell.id === 'rime-gale' ? 'Rimeball Roll' : spell.id === 'solar-pike' ? 'Solar Meteor' : spell.name,
  radius: spell.id === 'rime-gale' ? 48 : spell.id === 'solar-pike' ? 105
    : spell.id === 'skyshatter' ? 42 : spell.id === 'sirocco-flare' ? 55 : spell.radius,
}));

export const KAELEN_COMBOS = [
  { id: 'meteor', name: 'Frozen Starfall', spells: ['glacier-lock', 'solar-pike'], description: 'Stun the target, then land a delayed meteor.' },
  { id: 'snowball', name: 'Avalanche Break', spells: ['rime-gale', 'sleetflare', 'emberfrost-lance'], description: 'Roll into a group, root the landing area, then pierce the frozen line.' },
  { id: 'tempest', name: 'Stormfall', spells: ['skyshatter', 'ashen-cyclone', 'solar-pike'], description: 'Lift, erupt, then punish the landing with a meteor.' },
  { id: 'peel', name: 'Whiteout Reversal', spells: ['whiteout-step', 'sirocco-flare'], description: 'Recover at close range and push an approaching diver away.' },
  { id: 'convergence', name: 'Elemental Collapse', spells: ['primal-tempest', 'emberfrost-lance'], description: 'Lift a cluster and send a piercing finisher through it.' },
] as const;

export function chooseKaelenCombo(s: { healthFraction: number; enemyDistance: number; clusteredEnemies: number; cycle: number; cooldowns: Record<string, number> }) {
  const preferred = s.healthFraction < 0.6 && s.enemyDistance < 130 ? 'peel'
    : s.clusteredEnemies >= 3 ? (s.cycle % 2 ? 'tempest' : 'snowball') : 'meteor';
  const choices = [...KAELEN_COMBOS].sort((a, b) => Number(b.id === preferred) - Number(a.id === preferred));
  return choices.find(combo => combo.spells.every(id => (s.cooldowns[id] ?? 0) <= 0));
}

const ELEMENT_ORDER: Record<KaelenElement, number> = { ice: 0, wind: 1, fire: 2 };

export function appendKaelenOrb(orbs: readonly KaelenElement[], element: KaelenElement): KaelenElement[] {
  return [...orbs, element].slice(-3);
}

export function nextKaelenRecipeOrb(orbs: readonly KaelenElement[], recipe: readonly KaelenElement[]): KaelenElement {
  let prefix = Math.min(2, orbs.length);
  while (prefix > 0 && !orbs.slice(-prefix).every((orb, index) => orb === recipe[index])) prefix--;
  return recipe[prefix];
}

export function getKaelenInvokedSpell(orbs: readonly KaelenElement[]): KaelenInvokedSpell | undefined {
  if (orbs.length !== 3) return undefined;
  const recipe = [...orbs].sort((a, b) => ELEMENT_ORDER[a] - ELEMENT_ORDER[b]);
  return KAELEN_INVOKED_SPELLS.find(spell => spell.recipe.every((element, index) => element === recipe[index]));
}

export function appendKaelenInvokedSpell(
  slots: readonly string[],
  spellId: string
): string[] {
  return [...slots, spellId].slice(-2);
}

export function kaelenInvokeCooldownAtLevel(level: number): number {
  if (level >= 18) return 0;
  if (level >= 13) return 1;
  if (level >= 7) return 2;
  return 3;
}
