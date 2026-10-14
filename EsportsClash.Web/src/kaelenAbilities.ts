export type KaelenElement = 'ice' | 'wind' | 'fire';
export type KaelenSpellControl = 'stun' | 'root' | 'knockup' | 'knockback' | 'none';
export type KaelenSpellShape = 'burst' | 'line' | 'snowball' | 'meteor' | 'ally' | 'summon';

export interface KaelenInvokedSpell {
  id: string; name: string; recipe: readonly [KaelenElement, KaelenElement, KaelenElement];
  cooldown: number; damage: number; radius: number; control: KaelenSpellControl; controlDuration: number;
  shape: KaelenSpellShape; range: number; mana: number; delay: number; speed: number;
  description: string; comboTip: string; color: string;
  targeting: 'enemy' | 'ground' | 'ally' | 'summon';
  ratios?: { adRatio: number; apRatio: number };
  slow?: { amount: number; duration: number };
  zone?: { duration: number; tickInterval: number; tickDamage: number };
  debuff?: { duration: number; tickInterval: number; tickDamage: number; maxStacks?: number };
  shield?: { amount: number; duration: number; moveSpeed: number };
  summon?: { health: number; duration: number; attackDamage: number; attackInterval: number };
}

export interface KaelenOrbStats { healthRegen: number; moveSpeed: number; spellAmp: number; damageAmp: number; }
export type KaelenOrbCounts = Record<KaelenElement, number>;
export const KAELEN_ELEMENTS: readonly KaelenElement[] = ['ice', 'wind', 'fire'];
export const KAELEN_ORB_MANA = 5;
export const KAELEN_ACTION_INTERVAL = 0.18;
const ORB_RANK_MILESTONES = [1, 4, 7, 9, 12, 14, 17] as const;

export function kaelenOrbRankAtLevel(level: number) { return ORB_RANK_MILESTONES.filter(m => Math.min(18, Math.max(1, level)) >= m).length; }
export function kaelenOrbCounts(orbs: readonly KaelenElement[]): KaelenOrbCounts {
  return orbs.slice(-3).reduce<KaelenOrbCounts>((counts, element) => { counts[element] += 1; return counts; }, { ice: 0, wind: 0, fire: 0 });
}
export function kaelenOrbStatBonuses(level: number, counts: KaelenOrbCounts): KaelenOrbStats {
  const rankScale = 1 + (kaelenOrbRankAtLevel(level) - 1) * 0.25;
  return { healthRegen: counts.ice * .2 * rankScale, moveSpeed: counts.wind * rankScale,
    spellAmp: counts.fire * .01 * rankScale, damageAmp: counts.fire * .01 * rankScale };
}

// IDs and recipes are deliberately stable: saved loadouts and telemetry retain Kaelen's historical keys.
export const KAELEN_INVOKED_SPELLS: readonly KaelenInvokedSpell[] = [
  { id: 'glacier-lock', name: 'Hoarfrost Decree', recipe: ['ice','ice','ice'], cooldown: 12, damage: 145, radius: 52, control: 'root', controlDuration: .65, shape: 'burst', range: 340, mana: 25, delay: .18, speed: 0, targeting: 'enemy', ratios: { adRatio: .15, apRatio: .20 }, slow: { amount: .24, duration: 3.2 }, debuff: { duration: 3.2, tickInterval: 0, tickDamage: 0, maxStacks: 3 }, color: '#7dd3fc', description: 'Marks one enemy with a Frost Fracture sigil: 24% slow for 3.2s. Three subsequent allied champion hits consume the mark for a 0.65s root; each target has a short root lockout.', comboTip: 'Precision setup: let allies build Frost Fracture, then punish the root.' },
  { id: 'rime-gale', name: 'Celestial Undertow', recipe: ['ice','ice','wind'], cooldown: 13, damage: 165, radius: 68, control: 'knockup', controlDuration: .7, shape: 'line', range: 390, mana: 30, delay: .12, speed: 285, targeting: 'ground', ratios: { adRatio: .15, apRatio: .20 }, slow: { amount: .20, duration: 1.4 }, color: '#dbeafe', description: 'A broad advancing ribbon of frozen wind. Each enemy is lifted once for 0.7s, then slowed 20% for 1.4s.', comboTip: 'Initiate clustered enemies before placing delayed ground spells.' },
  { id: 'sleetflare', name: 'Fracture Bloom', recipe: ['ice','ice','fire'], cooldown: 14, damage: 155, radius: 108, control: 'none', controlDuration: 0, shape: 'burst', range: 340, mana: 30, delay: .4, speed: 0, targeting: 'ground', ratios: { adRatio: .18, apRatio: .22 }, slow: { amount: .22, duration: .65 }, zone: { duration: 3.4, tickInterval: .5, tickDamage: 34 }, color: '#c4b5fd', description: 'Erupt a frostfire field after 0.4s. The initial hit damages once; enemies inside the 3.4s field take 34 magic damage every 0.5s and are slowed 22%.', comboTip: 'Deny exits after displacement or protect an objective entrance.' },
  { id: 'whiteout-step', name: 'Rimeball Roll', recipe: ['ice','wind','wind'], cooldown: 10, damage: 150, radius: 48, control: 'none', controlDuration: 0, shape: 'snowball', range: 390, mana: 25, delay: 0, speed: 235, targeting: 'ground', ratios: { adRatio: .18, apRatio: .18 }, slow: { amount: .26, duration: 1.5 }, color: '#e0f2fe', description: 'Roll a visibly growing snowball through an aimed line. It pierces valid enemies once, dealing damage and slowing 26% for 1.5s.', comboTip: 'Sweep a group after Undertow or slow a pursuer while disengaging.' },
  { id: 'primal-tempest', name: 'Equinox Accord', recipe: ['ice','wind','fire'], cooldown: 16, damage: 0, radius: 135, control: 'none', controlDuration: 0, shape: 'ally', range: 360, mana: 35, delay: 0, speed: 0, targeting: 'ally', shield: { amount: 115, duration: 3.2, moveSpeed: 18 }, color: '#c084fc', description: 'Pulse elemental protection around an allied position. Nearby allies gain a 115 shield for 3.2s and +18 movement speed; it refreshes rather than stacks.', comboTip: 'Use before an engage, during counter-engage, or to secure an escape.' },
  { id: 'emberfrost-lance', name: 'Ashen Hail', recipe: ['ice','fire','fire'], cooldown: 11, damage: 145, radius: 76, control: 'none', controlDuration: 0, shape: 'line', range: 365, mana: 30, delay: .08, speed: 430, targeting: 'ground', ratios: { adRatio: .18, apRatio: .22 }, slow: { amount: .16, duration: 2.2 }, debuff: { duration: 2.2, tickInterval: .55, tickDamage: 24, maxStacks: 2 }, color: '#fda4af', description: 'Fan-shaped frostfire shards strike enemies once. Hits apply a 2.2s burning-frost debuff: 24 magic damage every 0.55s, 16% slow, up to two controlled stacks.', comboTip: 'Sustain pressure on enemies caught by your first control spell.' },
  { id: 'skyshatter', name: 'Pressure Front', recipe: ['wind','wind','wind'], cooldown: 13, damage: 115, radius: 72, control: 'knockback', controlDuration: 0, shape: 'line', range: 360, mana: 25, delay: 0, speed: 310, targeting: 'ground', ratios: { adRatio: .15, apRatio: .15 }, slow: { amount: .23, duration: 1.15 }, color: '#a5f3fc', description: 'A moving pressure wave pushes each enemy 54 units in its travel direction once, terrain-safely, then slows 23% for 1.15s.', comboTip: 'Peel divers, split a frontline, or push opponents out of an objective approach.' },
  { id: 'ashen-cyclone', name: 'Static Harvest', recipe: ['wind','wind','fire'], cooldown: 15, damage: 135, radius: 118, control: 'none', controlDuration: 0, shape: 'burst', range: 355, mana: 35, delay: .7, speed: 0, targeting: 'ground', ratios: { adRatio: .18, apRatio: .22 }, slow: { amount: .18, duration: .7 }, zone: { duration: 2.5, tickInterval: .55, tickDamage: 22 }, color: '#fbbf24', description: 'Charge an electromagnetic field for 0.7s, then pulse once for major damage. The field lingers 2.5s for weaker lightning ticks and an 18% slow. No new mana-drain system is introduced.', comboTip: 'Place on a controlled cluster or stationary objective defense.' },
  { id: 'sirocco-flare', name: 'Solar Meteor', recipe: ['wind','fire','fire'], cooldown: 17, damage: 255, radius: 112, control: 'none', controlDuration: 0, shape: 'meteor', range: 430, mana: 35, delay: .8, speed: 0, targeting: 'ground', ratios: { adRatio: .22, apRatio: .25 }, slow: { amount: .18, duration: .65 }, zone: { duration: 3, tickInterval: .5, tickDamage: 30 }, color: '#f97316', description: 'Telegraph a celestial impact for 0.8s. The meteor deals one high area hit, then leaves a 3s burning crater for 30 damage every 0.5s and an 18% slow.', comboTip: 'Devastating after Undertow, Hoarfrost roots, or allied area control; dodgeable when careless.' },
  { id: 'solar-pike', name: 'Prism Warden', recipe: ['fire','fire','fire'], cooldown: 19, damage: 0, radius: 74, control: 'none', controlDuration: 0, shape: 'summon', range: 350, mana: 40, delay: .25, speed: 0, targeting: 'summon', summon: { health: 460, duration: 12, attackDamage: 36, attackInterval: 1.2 }, color: '#fb7185', description: 'Conjure one mobile Prism Warden for 12s. It is killable, attacks nearby enemy champions or minions, and applies a modest slow. Recasting refreshes its lifetime and focus; it never attacks structures.', comboTip: 'Establish area pressure before a fight or cover a contested route.' },
];

export const KAELEN_COMBOS = [
  { id: 'cataclysm', name: 'Cataclysm Initiation', spells: ['rime-gale','ashen-cyclone','sirocco-flare','sleetflare'], description: 'Undertow → Static Harvest → Solar Meteor → Fracture Bloom.' },
  { id: 'lockdown', name: 'Battlefield Lockdown', spells: ['glacier-lock','whiteout-step','emberfrost-lance','sleetflare'], description: 'Mark, slow, burn and deny the priority target’s escape.' },
  { id: 'empowerment', name: 'Team Empowerment', spells: ['primal-tempest','solar-pike','skyshatter'], description: 'Protect allies, deploy the Warden, then peel or disrupt.' },
  { id: 'objective', name: 'Objective Domination', spells: ['solar-pike','sleetflare','ashen-cyclone','sirocco-flare'], description: 'Control routes and punish enemy contest positioning.' },
  { id: 'counter', name: 'Defensive Counter-engage', spells: ['primal-tempest','skyshatter','rime-gale','sirocco-flare'], description: 'Protect the team, displace divers, then reverse the fight.' },
  { id: 'siege', name: 'Siege Breaker', spells: ['solar-pike','primal-tempest','skyshatter','sirocco-flare'], description: 'Support a safe main-lane siege without bypassing structure rules.' },
  { id: 'comeback', name: 'Desperate Comeback', spells: ['rime-gale','sirocco-flare','ashen-cyclone','sleetflare'], description: 'A high-value control sequence when a realistic clustered opening appears.' },
  { id: 'disengage', name: 'Emergency Disengage', spells: ['skyshatter','sleetflare','primal-tempest'], description: 'Push pursuers away, block their route and protect allies.' },
] as const;

export type KaelenPlanContext = { healthFraction: number; enemyDistance: number; clusteredEnemies: number; threatenedAllies: number; objectiveFight: boolean; defending: boolean; mana: number; iq: number; cooldowns: Record<string, number>; cycle: number; personality?: readonly string[] };
export function chooseKaelenPlan(s: KaelenPlanContext) {
  const urgentDefense = s.defending || s.threatenedAllies >= 2 || (s.healthFraction < .52 && s.enemyDistance < 150);
  const wantsObjective = s.objectiveFight && s.clusteredEnemies >= 2;
  const preferred = urgentDefense ? 'disengage' : wantsObjective ? 'objective' : s.clusteredEnemies >= 3 ? 'cataclysm' : s.clusteredEnemies >= 2 ? 'lockdown' : 'empowerment';
  const personality = s.personality ?? [];
  const priority = personality.includes('bodyguard') ? ['counter','empowerment','disengage'] : personality.includes('objective_zealot') ? ['objective','cataclysm'] : personality.includes('perfectionist') ? ['cataclysm','lockdown'] : [preferred];
  const rank = (id: string) => { const index = priority.indexOf(id); return index < 0 ? priority.length : index; };
  const ordered = [...KAELEN_COMBOS].sort((a, b) => Number(b.id === preferred && urgentDefense) - Number(a.id === preferred && urgentDefense)
    || rank(a.id) - rank(b.id) || Number(b.id === preferred) - Number(a.id === preferred)
    || (s.cycle % 2 ? a.id.localeCompare(b.id) : b.id.localeCompare(a.id)));
  const affordable = (ids: readonly string[]) => ids.filter(id => { const spell = KAELEN_INVOKED_SPELLS.find(entry => entry.id === id)!; return (s.cooldowns[id] ?? 0) <= 0 && spell.mana + KAELEN_ORB_MANA * 3 <= s.mana; });
  const maxLength = s.iq >= 90 ? 5 : s.iq >= 70 ? 4 : s.iq >= 48 ? 3 : 2;
  for (const candidate of ordered) { const spells = affordable(candidate.spells).slice(0, maxLength); if (spells.length) return { ...candidate, spells, tacticalGoal: urgentDefense ? 'protect / disengage' : wantsObjective ? 'objective area control' : s.clusteredEnemies >= 3 ? 'AoE initiation' : 'adaptive pressure' }; }
  return undefined;
}
export function chooseKaelenCombo(s: Omit<KaelenPlanContext, 'threatenedAllies' | 'objectiveFight' | 'defending' | 'mana' | 'iq'>) { return chooseKaelenPlan({ ...s, threatenedAllies: 0, objectiveFight: false, defending: false, mana: 999, iq: 70 }); }

const ELEMENT_ORDER: Record<KaelenElement, number> = { ice: 0, wind: 1, fire: 2 };
export function appendKaelenOrb(orbs: readonly KaelenElement[], element: KaelenElement) { return [...orbs, element].slice(-3); }
export function nextKaelenRecipeOrb(orbs: readonly KaelenElement[], recipe: readonly KaelenElement[]) { let prefix = Math.min(2, orbs.length); while (prefix > 0 && !orbs.slice(-prefix).every((orb, index) => orb === recipe[index])) prefix--; return recipe[prefix]; }
export function getKaelenInvokedSpell(orbs: readonly KaelenElement[]) { if (orbs.length !== 3) return undefined; const recipe = [...orbs].sort((a,b) => ELEMENT_ORDER[a] - ELEMENT_ORDER[b]); return KAELEN_INVOKED_SPELLS.find(spell => spell.recipe.every((element, index) => element === recipe[index])); }
export function appendKaelenInvokedSpell(slots: readonly string[], spellId: string) { return [...slots.filter(id => id !== spellId), spellId].slice(-2); }
export function kaelenInvokeCooldownAtLevel(level: number) { return level >= 18 ? 0 : level >= 13 ? 1 : level >= 7 ? 2 : 3; }
