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
}

export const KAELEN_ELEMENTS: readonly KaelenElement[] = ['ice', 'wind', 'fire'];

export const KAELEN_INVOKED_SPELLS: readonly KaelenInvokedSpell[] = [
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
];

const ELEMENT_ORDER: Record<KaelenElement, number> = { ice: 0, wind: 1, fire: 2 };

export function appendKaelenOrb(orbs: readonly KaelenElement[], element: KaelenElement): KaelenElement[] {
  return [...orbs, element].slice(-3);
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
