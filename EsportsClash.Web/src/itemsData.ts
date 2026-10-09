import { ItemDef, CombatRole } from './types';

export const ALL_ITEMS: ItemDef[] = [
  // ==========================================
  // STARTING ITEMS (Cost: 500g)
  // ==========================================
  {
    id: 'item_guardians_blade',
    name: "Guardian's Blade",
    cost: 500,
    tier: 'Starting',
    icon: '⚔️',
    stats: { ad: 25, hp: 150, haste: 10 },
    passiveName: 'Warpath',
    passiveDesc: '+10 Ability Haste and early health for lane skirmishes.',
    suitableRoles: ['Fighter', 'Marksman', 'Assassin']
  },
  {
    id: 'item_guardians_orb',
    name: "Guardian's Orb",
    cost: 500,
    tier: 'Starting',
    icon: '🔮',
    stats: { ap: 45, hp: 150, haste: 10 },
    passiveName: 'Essence Flow',
    passiveDesc: 'Restores mana over time and empowers poke spells.',
    suitableRoles: ['Mage', 'Support']
  },
  {
    id: 'item_guardians_horn',
    name: "Guardian's Horn",
    cost: 500,
    tier: 'Starting',
    icon: '🛡️',
    stats: { hp: 180 },
    passiveName: 'Unyielding',
    passiveDesc: 'Reduces damage taken from attacks and spells by 15 flat.',
    suitableRoles: ['Tank', 'Support', 'Fighter']
  },
  {
    id: 'item_guardians_hammer',
    name: "Guardian's Hammer",
    cost: 500,
    tier: 'Starting',
    icon: '🔨',
    stats: { ad: 25, hp: 150 },
    passiveName: 'Vampiric Drain',
    passiveDesc: 'Grants +7% Lifesteal to sustain through minion waves.',
    suitableRoles: ['Marksman', 'Fighter', 'Assassin']
  },

  // ==========================================
  // MID-TIER COMPONENT ITEMS (Cost: 700g - 1300g)
  // ==========================================
  {
    id: 'item_bf_sword',
    name: 'B.F. Heavy Sword',
    cost: 1300,
    tier: 'Component',
    icon: '🗡️',
    stats: { ad: 40 },
    passiveName: 'Raw Power',
    passiveDesc: '+40 Attack Damage weapon spike.',
    suitableRoles: ['Marksman', 'Fighter', 'Assassin']
  },
  {
    id: 'item_lost_chapter',
    name: 'Lost Chapter',
    cost: 1100,
    tier: 'Component',
    icon: '📖',
    stats: { ap: 40, haste: 10 },
    passiveName: 'Insight',
    passiveDesc: '+40 AP and mana surge upon level up.',
    suitableRoles: ['Mage', 'Support']
  },
  {
    id: 'item_serrated_dirk',
    name: 'Serrated Dirk',
    cost: 1000,
    tier: 'Component',
    icon: '🔪',
    stats: { ad: 30 },
    passiveName: 'Lethality',
    passiveDesc: 'Armor penetration and lethal skirmish damage.',
    suitableRoles: ['Assassin', 'Marksman', 'Fighter']
  },
  {
    id: 'item_bami_cinder',
    name: "Bami's Cinder",
    cost: 1000,
    tier: 'Component',
    icon: '🔥',
    stats: { hp: 260 },
    passiveName: 'Kindle',
    passiveDesc: 'Grants early health and area wave burn.',
    suitableRoles: ['Tank', 'Fighter', 'Support']
  },
  {
    id: 'item_chain_vest',
    name: 'Armored Chainmail',
    cost: 800,
    tier: 'Component',
    icon: '🛡️',
    stats: { armor: 40 },
    passiveName: 'Plated Guard',
    passiveDesc: '+40 Armor defensive foundation.',
    suitableRoles: ['Tank', 'Support', 'Fighter']
  },
  {
    id: 'item_blasting_wand',
    name: 'Blasting Wand',
    cost: 850,
    tier: 'Component',
    icon: '🪄',
    stats: { ap: 45 },
    passiveName: 'Arcane Spark',
    passiveDesc: '+45 Ability Power poke amplification.',
    suitableRoles: ['Mage', 'Support']
  },
  {
    id: 'item_recurve_bow',
    name: 'Recurve Bow',
    cost: 700,
    tier: 'Component',
    icon: '🏹',
    stats: { aspd: 0.20 },
    passiveName: 'Steelfiber',
    passiveDesc: '+20% Attack Speed rapid fire.',
    suitableRoles: ['Marksman', 'Fighter']
  },
  {
    id: 'item_caulfield',
    name: "Caulfield's War Hammer",
    cost: 1100,
    tier: 'Component',
    icon: '🔨',
    stats: { ad: 25, haste: 10 },
    passiveName: 'Tempered Steel',
    passiveDesc: '+25 AD and +10 Ability Haste.',
    suitableRoles: ['Fighter', 'Assassin', 'Marksman']
  },

  // ==========================================
  // BOT / CARRY & AD LEGENDARY ITEMS
  // ==========================================
  {
    id: 'item_infinity_edge',
    name: 'Edge of Infinity',
    cost: 3400,
    tier: 'Mythic',
    icon: '🗡️',
    stats: { ad: 75, crit: 25 },
    passiveName: 'Perfection',
    passiveDesc: 'Increases Critical Strike damage from 175% to 215%. Massive DPS spike!',
    suitableRoles: ['Marksman', 'Assassin']
  },
  {
    id: 'item_kraken_slayer',
    name: 'Leviathan Harpoon',
    cost: 3100,
    tier: 'Legendary',
    icon: '🔱',
    stats: { ad: 45, aspd: 0.35 },
    passiveName: 'Bring It Down',
    passiveDesc: 'Every third basic attack unleashes 160 True Damage piercing all armor.',
    suitableRoles: ['Marksman', 'Fighter']
  },
  {
    id: 'item_bork',
    name: 'Blade of the Ruined King',
    cost: 3200,
    tier: 'Legendary',
    icon: '🗡️',
    stats: { ad: 40, aspd: 0.25 },
    passiveName: "Mist's Edge",
    passiveDesc: 'Basic attacks deal 9% of the target’s current HP as bonus physical damage.',
    suitableRoles: ['Marksman', 'Fighter', 'Assassin']
  },
  {
    id: 'item_collector',
    name: 'The Debt Collector',
    cost: 3000,
    tier: 'Legendary',
    icon: '💰',
    stats: { ad: 55, crit: 20 },
    passiveName: 'Death & Taxes',
    passiveDesc: 'Executes enemy champions falling below 5% HP and grants +25 extra bonus gold.',
    suitableRoles: ['Marksman', 'Assassin']
  },

  // ==========================================
  // MID / MAGE & AP LEGENDARY ITEMS
  // ==========================================
  {
    id: 'item_deathcap',
    name: 'Crown of the Archmage',
    cost: 3600,
    tier: 'Mythic',
    icon: '👑',
    stats: { ap: 130 },
    passiveName: 'Magical Opus',
    passiveDesc: 'Increases total Ability Power by +35%. Pure annihilation burst!',
    suitableRoles: ['Mage']
  },
  {
    id: 'item_ludens',
    name: 'Tempest Echo',
    cost: 3000,
    tier: 'Legendary',
    icon: '⚡',
    stats: { ap: 90, haste: 20 },
    passiveName: 'Echo Burst',
    passiveDesc: 'Spells detonate, discharging 110 + 10% AP magic burst to up to 3 nearby enemies.',
    suitableRoles: ['Mage', 'Support']
  },
  {
    id: 'item_zhonyas',
    name: 'Chrono Stasis',
    cost: 3000,
    tier: 'Legendary',
    icon: '⏳',
    stats: { ap: 80, armor: 45, haste: 15 },
    passiveName: 'Golden Stasis',
    passiveDesc: 'Upon lethal burst damage, enters golden invulnerability for 2.5s (90s CD).',
    suitableRoles: ['Mage', 'Support', 'Assassin']
  },
  {
    id: 'item_void_staff',
    name: 'Void Scepter',
    cost: 2800,
    tier: 'Legendary',
    icon: '🔮',
    stats: { ap: 75 },
    passiveName: 'Dissolution',
    passiveDesc: 'Ignores 40% of the target’s Magic Resistance.',
    suitableRoles: ['Mage', 'Assassin']
  },

  // ==========================================
  // TOP & TANK / FRONTLINE LEGENDARY ITEMS
  // ==========================================
  {
    id: 'item_sunfire',
    name: 'Solar Aegis',
    cost: 2800,
    tier: 'Legendary',
    icon: '🔥',
    stats: { hp: 450, armor: 50 },
    passiveName: 'Immolate',
    passiveDesc: 'Constantly burns nearby enemy champions and minions for 35 magic damage/sec.',
    suitableRoles: ['Tank', 'Fighter', 'Support']
  },
  {
    id: 'item_warmogs',
    name: 'Behemoth Heart',
    cost: 3100,
    tier: 'Mythic',
    icon: '❤️',
    stats: { hp: 850, haste: 10 },
    passiveName: "Behemoth's Vigor",
    passiveDesc: 'Rapidly regenerates 5% Max HP per second after 6 seconds out of combat.',
    suitableRoles: ['Tank', 'Support', 'Fighter']
  },
  {
    id: 'item_thornmail',
    name: 'Bramble Spikes',
    cost: 2700,
    tier: 'Legendary',
    icon: '🌵',
    stats: { hp: 350, armor: 65 },
    passiveName: 'Thorns',
    passiveDesc: 'Reflects 25 + 10% bonus armor damage back to attackers and inflicts Grievous Wounds.',
    suitableRoles: ['Tank', 'Support']
  },
  {
    id: 'item_steraks',
    name: "Titan's Lifeline",
    cost: 3100,
    tier: 'Legendary',
    icon: '🥊',
    stats: { hp: 400, ad: 45 },
    passiveName: 'Lifeline',
    passiveDesc: 'When dropping below 30% HP, gain a massive 600 HP shield for 4.5 seconds.',
    suitableRoles: ['Fighter', 'Tank', 'Assassin']
  },
  {
    id: 'item_spirit_visage',
    name: 'Spirit Visage',
    cost: 2900,
    tier: 'Legendary',
    icon: '🍃',
    stats: { hp: 450, mr: 55, haste: 15 },
    passiveName: 'Boundless Vitality',
    passiveDesc: 'Increases all incoming heals and shields by +25%.',
    suitableRoles: ['Tank', 'Support', 'Fighter']
  }
];

// Helper: Recommend next item to buy given a champion's role and existing items
export function getRecommendedItem(role: CombatRole, existingItemIds: string[], gold: number, champName?: string): ItemDef | null {
  const existingSet = new Set(existingItemIds);

  // Derive target archetype from champName if provided
  let effectiveRole = role;
  if (champName) {
    if (champName === 'Astra' || champName === 'Cora' || champName === 'Kindra') effectiveRole = 'Marksman';
    else if (champName === 'Kyumi' || champName === 'Raijin' || champName === 'Tequoia') effectiveRole = 'Mage';
    else if (champName === 'Solana' || champName === 'Kaolin') effectiveRole = 'Tank';
    else if (champName === 'Zal' || champName === 'Renn') effectiveRole = 'Support';
    else if (champName === 'Buck' || champName === 'Valkira' || champName === 'Kazemaru' || champName === 'Sylla' || champName === 'Xin') effectiveRole = 'Fighter';
    else if (champName === 'Kage' || champName === 'Inai') effectiveRole = 'Assassin';
  }

  // 1. If no items yet, pick suitable starting item
  if (existingItemIds.length === 0) {
    const starter = ALL_ITEMS.find((it) => it.tier === 'Starting' && (it.suitableRoles.includes(effectiveRole) || it.suitableRoles.includes(role)) && it.cost <= gold)
      || ALL_ITEMS.find((it) => it.tier === 'Starting' && it.cost <= gold);
    if (starter) return starter;
  }

  // 2. Filter affordable unowned items matching role/champ
  let candidates = ALL_ITEMS.filter((it) => 
    !existingSet.has(it.id) &&
    it.tier !== 'Starting' &&
    (it.suitableRoles.includes(effectiveRole) || it.suitableRoles.includes(role)) &&
    it.cost <= gold
  );

  // 3. Robust Fallback: If no role-specific candidates affordable, pick ANY affordable unowned non-starter item
  if (candidates.length === 0) {
    candidates = ALL_ITEMS.filter((it) => 
      !existingSet.has(it.id) &&
      it.tier !== 'Starting' &&
      it.cost <= gold
    );
  }

  if (candidates.length === 0) return null;

  // Prioritize Mythic items first, then highest cost
  candidates.sort((a, b) => {
    if (a.tier === 'Mythic' && b.tier !== 'Mythic') return -1;
    if (b.tier === 'Mythic' && a.tier !== 'Mythic') return 1;
    return b.cost - a.cost;
  });

  return candidates[0];
}
