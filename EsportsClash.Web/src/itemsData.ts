import type { ItemDef, CombatRole } from './types';

export const ALL_ITEMS: ItemDef[] = ([
  // ==========================================
  // STARTING ITEMS (Cost: 500g)
  // ==========================================
  {
    id: 'item_guardians_blade',
    name: "Sentinel's Blade",
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
    name: "Aegis Orb",
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
    name: "Bastion Horn",
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
    name: "Siphon Mallet",
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
    name: 'Colossal Greatsword',
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
    name: 'Forgotten Grimoire',
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
    name: 'Jagged Stiletto',
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
    name: "Ignis Ember",
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
    name: 'Reinforced Mail',
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
    name: 'Ether Wand',
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
    name: 'Composite Longbow',
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
    name: "Striker's War Hammer",
    cost: 1100,
    tier: 'Component',
    icon: '🔨',
    stats: { ad: 25, haste: 10 },
    passiveName: 'Tempered Steel',
    passiveDesc: '+25 AD and +10 Ability Haste.',
    suitableRoles: ['Fighter', 'Assassin', 'Marksman']
  },
  {
    id: 'item_last_whisper',
    name: 'Piercing Whisper',
    cost: 1450,
    tier: 'Component',
    icon: '🏹',
    stats: { ad: 20, armorPen: 18 },
    passiveName: 'Armor Piercing',
    passiveDesc: 'Ignores 18% of target Armor.',
    suitableRoles: ['Marksman', 'Assassin', 'Fighter']
  },
  {
    id: 'item_noonquiver',
    name: 'Solar Quiver',
    cost: 1300,
    tier: 'Component',
    icon: '🎯',
    stats: { ad: 30, aspd: 0.20 },
    passiveName: 'Precision Fire',
    passiveDesc: '+30 AD and +20% Attack Speed rapid firing.',
    suitableRoles: ['Marksman']
  },

  // ==========================================
  // BOT / CARRY & AD LEGENDARY ITEMS
  // ==========================================
  {
    id: 'item_infinity_edge',
    name: 'Apex Edge',
    cost: 3400,
    tier: 'Mythic',
    icon: '🗡️',
    stats: { ad: 80, crit: 25 },
    passiveName: 'Perfection',
    passiveDesc: 'Increases Critical Strike damage from 175% to 225%. Massive DPS hypercarry spike!',
    suitableRoles: ['Marksman', 'Assassin']
  },
  {
    id: 'item_kraken_slayer',
    name: 'Leviathan Harpoon',
    cost: 3000,
    tier: 'Legendary',
    icon: '🔱',
    stats: { ad: 45, aspd: 0.40, moveSpeed: 4 },
    passiveName: 'Bring It Down',
    passiveDesc: 'Every third Attack deals bonus physical damage On-Hit, increased based on their missing Health.',
    suitableRoles: ['Marksman', 'Fighter']
  },
  {
    id: 'item_ldr',
    name: "Goliath Slayer",
    cost: 3000,
    tier: 'Legendary',
    icon: '🏹',
    stats: { ad: 45, crit: 25, armorPen: 35 },
    passiveName: 'Giant Slayer',
    passiveDesc: 'Ignores 35% of target Armor and deals up to +22% bonus damage against high-health tanks.',
    suitableRoles: ['Marksman', 'Assassin']
  },
  {
    id: 'item_bork',
    name: "Sovereign's Ruin",
    cost: 3200,
    tier: 'Legendary',
    icon: '🗡️',
    stats: { ad: 40, aspd: 0.25, lifesteal: 10 },
    passiveName: "Mist's Edge",
    passiveDesc: 'Basic attacks deal 9% of the target’s current HP as bonus physical damage on-hit.',
    suitableRoles: ['Marksman', 'Fighter', 'Assassin']
  },
  {
    id: 'item_mortal_reminder',
    name: 'Fatal Verdict',
    cost: 3000,
    tier: 'Legendary',
    icon: '⚔️',
    stats: { ad: 40, crit: 25, armorPen: 30 },
    passiveName: 'Grievous Execution',
    passiveDesc: 'Ignores 30% Armor and applies Grievous Wounds, cutting enemy healing and shields by 40%.',
    suitableRoles: ['Marksman', 'Fighter']
  },
  {
    id: 'item_phantom_dancer',
    name: 'Ghoststep Rapier',
    cost: 2600,
    tier: 'Legendary',
    icon: '💃',
    stats: { ad: 35, aspd: 0.60, crit: 25, moveSpeed: 7 },
    passiveName: 'Spectral Waltz',
    passiveDesc: 'Grants massive attack speed and ghosting for relentless kiting mobility.',
    suitableRoles: ['Marksman']
  },
  {
    id: 'item_runaans',
    name: "Tempest Galebow",
    cost: 2600,
    tier: 'Legendary',
    icon: '🌪️',
    stats: { aspd: 0.40, crit: 25, moveSpeed: 4 },
    passiveName: "Wind's Fury",
    passiveDesc: 'Basic attacks fire secondary bolts at up to 2 nearby enemies for 40% damage with on-hit effects.',
    suitableRoles: ['Marksman']
  },
  {
    id: 'item_terminus',
    name: 'Equinox Cleaver',
    cost: 3000,
    tier: 'Legendary',
    icon: '⚖️',
    stats: { ad: 35, aspd: 0.30, armorPen: 30 },
    passiveName: 'Shadow & Light',
    passiveDesc: 'Alternating attacks shred 30% enemy Armor & MR while granting +25 bonus defensive resistances.',
    suitableRoles: ['Marksman', 'Fighter']
  },
  {
    id: 'item_collector',
    name: 'Bounty Collector',
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
    name: "Archmage's Diadem",
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
    name: 'Thunderclap Staff',
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
    name: 'Hourglass of Stasis',
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
    name: 'Void Piercer',
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
    name: 'Sunfire Bulwark',
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
    name: "Titan's Heart",
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
    name: 'Thorned Cuirass',
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
    name: 'Colossus Gauntlet',
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
    name: 'Spirit Shroud',
    cost: 2900,
    tier: 'Legendary',
    icon: '🍃',
    stats: { hp: 450, mr: 55, haste: 15 },
    passiveName: 'Boundless Vitality',
    passiveDesc: 'Increases all incoming heals and shields by +25%.',
    suitableRoles: ['Tank', 'Support', 'Fighter']
  }
] as ItemDef[]).map(item => item.tier === 'Legendary' || item.tier === 'Mythic'
  ? { ...item, cost: Math.round(item.cost * 0.65 / 25) * 25 }
  : item);

// Boots occupy their own slot and do not displace a completed combat item.
export const BOOTS: ItemDef = {
  id: 'item_pathfinder_boots', name: 'Pathfinder Boots', cost: 450, tier: 'Component', icon: '👢',
  stats: { moveSpeed: 20 }, passiveName: 'Swift Step',
  passiveDesc: 'Move faster between waves and objectives.',
  suitableRoles: ['Tank', 'Mage', 'Marksman', 'Support', 'Fighter', 'Assassin']
};

// Helper: Recommend next item to buy given a champion's role and existing items
export function getRecommendedItem(role: CombatRole, existingItemIds: string[], gold: number, champName?: string): ItemDef | null {
  const existingSet = new Set(existingItemIds);

  // Derive target archetype from champName if provided
  let effectiveRole = role;
  if (champName) {
    if (champName === 'Astra' || champName === 'Cora' || champName === 'Kindra' || champName === 'Kindra & Grim' || champName === 'Solenne') effectiveRole = 'Marksman';
    else if (champName === 'Kyumi' || champName === 'Raijin' || champName === 'Tequoia' || champName === 'Soulscourge') effectiveRole = 'Mage';
    else if (champName === 'Solana' || champName === 'Kaolin' || champName === 'Stonewake') effectiveRole = 'Tank';
    else if (champName === 'Zal' || champName === 'Renn' || champName === 'Croakwell') effectiveRole = 'Support';
    else if (champName === 'Buck' || champName === 'Valkira' || champName === 'Kazemaru' || champName === 'Sylla' || champName === 'Xin') effectiveRole = 'Fighter';
    else if (champName === 'Kage' || champName === 'Inai' || champName === 'Cinderlock' || champName === 'Veyara') effectiveRole = 'Assassin';
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
