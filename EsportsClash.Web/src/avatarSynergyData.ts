// Avatar Matchup Counter & Teamfight Synergy Knowledge Database
// Data-driven matrix used by Pro AI Coaches for counter-picking, synergy combos, and draft intelligence.

export interface ChampionCounter {
  championId: string;
  countersId: string;
  advantage: number; // Win-rate delta advantage (+10 to +25)
  reason: string;
}

export interface ChampionSynergy {
  champ1Id: string;
  champ2Id: string;
  comboName: string;
  tier: 'S+' | 'S' | 'A';
  bonus: number; // Synergy effectiveness bonus (+10 to +25)
  description: string;
}

export interface ChampionMetaStats {
  championId: string;
  tier: 'S+' | 'S' | 'A' | 'B';
  winRate: number;
  pickRate: number;
  banRate: number;
  bestPartnerId: string;
  worstMatchupId: string;
}

// 1. Hard Counter Relationships (A counters B)
export const CHAMPION_COUNTERS: ChampionCounter[] = [
  // Assassins counter squishy immobile Marksmen / Mages
  { championId: 'c_kage', countersId: 'c_astra', advantage: 20, reason: 'Shadow gap-close and lethal burst instantly assassinates immobile frost archer.' },
  { championId: 'c_kage', countersId: 'c_cora', advantage: 16, reason: 'Untargetable shadow strike bypasses feather ground zoning.' },
  { championId: 'c_kage', countersId: 'c_tequoia', advantage: 18, reason: 'Blades pierce through living trees to execute isolated nature mage.' },
  
  // Tanks & Vanguard Disengagers counter Dive Assassins & Skirmishers
  { championId: 'c_solana', countersId: 'c_kage', advantage: 22, reason: 'Point-blank Solar Shieldbash and Daybreak Flare suppress shadow assassins mid-dive.' },
  { championId: 'c_solana', countersId: 'c_valkira', advantage: 18, reason: 'Heavy chain CC interrupts warlord dash sequences.' },
  { championId: 'c_renn', countersId: 'c_kage', advantage: 17, reason: 'Acrobatic knockup and instant ally shield completely peel burst attempts.' },
  { championId: 'c_kaolin', countersId: 'c_xin', advantage: 19, reason: 'Boulder smash silence and geomagnetic stun shut down flame remnants.' },

  // Anti-Tank Shredders / High DPS counter Heavy Frontline Tanks
  { championId: 'c_buck', countersId: 'c_solana', advantage: 19, reason: 'Point-blank shotgun pellet shred and true damage melt heavy armor.' },
  { championId: 'c_sylla', countersId: 'c_solana', advantage: 16, reason: 'Armored Spirit Bear entangles and shreds single-target tanks.' },
  { championId: 'c_astra', countersId: 'c_sylla', advantage: 21, reason: 'Infinite glacial chill kiting prevents Spirit Bear from ever reaching melee range.' },
  { championId: 'c_cora', countersId: 'c_kaolin', advantage: 17, reason: 'Feather Recall roots grounded tanks in choke points.' },

  // Area of Effect Wombo Disrupters counter Clustered Melee Dive Teams
  { championId: 'c_earthshaker', countersId: 'c_xin', advantage: 20, reason: 'Echo Slam multiplies exponentially against melee skirmishers and clusters.' },
  { championId: 'c_earthshaker', countersId: 'c_valkira', advantage: 18, reason: 'Impassable earth fissures block warlord retreat routes.' },
  { championId: 'c_raijin', countersId: 'c_buck', advantage: 17, reason: 'Electric Vortex tether pulls short-range shotgun carry into fatal focus.' },
  { championId: 'c_mirehook', countersId: 'c_astra', advantage: 22, reason: 'Meat hook drag drags immobile long-range carries into instant death.' },
  { championId: 'c_kyumi', countersId: 'c_buck', advantage: 16, reason: 'True damage spirit orb and charm catch punish short-range skirmishers.' },
  { championId: 'c_kazemaru', countersId: 'c_astra', advantage: 24, reason: 'Zephyr Barrier vaporizes all incoming frost arrows and global comets.' },
  { championId: 'c_zal', countersId: 'c_kage', advantage: 19, reason: 'Soul Sanctuary prevents assassin execution with 4.5s absolute death immunity.' },
  { championId: 'c_nullweaver', countersId: 'c_raijin', advantage: 21, reason: 'Mana burn and domain suppression drain energy from hyper-mobile mages.' },
  { championId: 'c_vi', countersId: 'c_astra', advantage: 23, reason: 'Unstoppable Cease and Desist charge ignores frost arrows to lock down the archer.' },
  { championId: 'c_vi', countersId: 'c_jinx', advantage: 24, reason: 'Heavy Atlas punch dive easily executes fragile hypercarries.' },
  { championId: 'c_puck', countersId: 'c_kage', advantage: 22, reason: 'Phase Shift reflex completely negates death mark execution burst.' },
  { championId: 'c_batrider', countersId: 'c_jinx', advantage: 21, reason: 'Flaming Lasso snags immobile backline carries directly into allied turrets.' },
  { championId: 'c_bristleback', countersId: 'c_kage', advantage: 20, reason: 'Bristled rear carapace reduces incoming assassin burst by 40% and sprays deadly quills.' },
  { championId: 'c_invoker', countersId: 'c_earthshaker', advantage: 19, reason: 'Sonic Shockwave disarms initiators while Chaos Meteor zones clustered frontlines.' },
  { championId: 'c_jinx', countersId: 'c_solana', advantage: 18, reason: 'Rocket launcher area range allows safe siege against short-range solar vanguards.' }
];

// 2. High-Impact Teamfight Synergy Combos (A + B = High Synergy)
export const CHAMPION_SYNERGIES: ChampionSynergy[] = [
  {
    champ1Id: 'c_cora',
    champ2Id: 'c_renn',
    comboName: 'Featherbound Lovers',
    tier: 'S+',
    bonus: 24,
    description: 'Harmonic Waltz grants Cora bonus shields while Gilded Vault knockup sets up 100% hit rate Feather Recall roots.'
  },
  {
    champ1Id: 'c_earthshaker',
    champ2Id: 'c_raijin',
    comboName: 'Thunderous Cataclysm',
    tier: 'S+',
    bonus: 25,
    description: 'Raijin Electric Vortex vacuums enemies into a tight cluster, magnifying Earthshaker Echo Slam to lethal one-shot numbers.'
  },
  {
    champ1Id: 'c_invoker',
    champ2Id: 'c_earthshaker',
    comboName: 'Cataclysmic Fissure',
    tier: 'S+',
    bonus: 26,
    description: 'Earthshaker Faultline lines up all 5 enemies for a guaranteed Cataclysmic Flare wipe.'
  },
  {
    champ1Id: 'c_jinx',
    champ2Id: 'c_io',
    comboName: 'Overcharged Rampage',
    tier: 'S+',
    bonus: 24,
    description: 'Aetheris Overcharge grants Jinxy maximum attack speed and movespeed to trigger infinite Get Excited resets.'
  },
  {
    champ1Id: 'c_bristleback',
    champ2Id: 'c_io',
    comboName: 'Unkillable Spined Bulwark',
    tier: 'S+',
    bonus: 23,
    description: 'Resonant Tether transfers massive healing into Bristleback while he charges into enemy territory.'
  },
  {
    champ1Id: 'c_vi',
    champ2Id: 'c_jayce',
    comboName: 'Piltover Hextech Blitz',
    tier: 'S',
    bonus: 21,
    description: 'Valerie armor-shattering heavy punch primes Jaxon Shock Blast for absolute true damage execution.'
  },
  {
    champ1Id: 'c_puck',
    champ2Id: 'c_hwei',
    comboName: 'Dream Spiral Torment',
    tier: 'S',
    bonus: 22,
    description: 'Puck Dream Coil leashes enemies inside Hweilin expanding Vortex of Torment.'
  },
  {
    champ1Id: 'c_kazemaru',
    champ2Id: 'c_renn',
    comboName: 'Acrobatic Tempest',
    tier: 'S+',
    bonus: 22,
    description: 'Renn Gilded Vault airborne knockup primes Kazemaru Airborne Sever from maximum cast distance.'
  },
  {
    champ1Id: 'c_earthshaker',
    champ2Id: 'c_shadowfiend',
    comboName: 'Requiem Fissure',
    tier: 'S+',
    bonus: 23,
    description: 'Fissure line stun locks enemy team while Shadowfiend channels point-blank Requiem of Souls.'
  },
  {
    champ1Id: 'c_solana',
    champ2Id: 'c_astra',
    comboName: 'Solar Frost Lock',
    tier: 'S',
    bonus: 20,
    description: 'Daybreak Flare sun stun followed by Enchanted Crystal Comet creates an unbroken 4.5s single-target chain stun.'
  },
  {
    champ1Id: 'c_kindra',
    champ2Id: 'c_zal',
    comboName: 'Eternal Life Ward',
    tier: 'S',
    bonus: 21,
    description: 'Soul Sanctuary death prevention bridges directly into Sanctuary of Eternity, creating a 9-second unkillable carry window.'
  },
  {
    champ1Id: 'c_solana',
    champ2Id: 'c_kazemaru',
    comboName: 'Daybreak Tornado',
    tier: 'S',
    bonus: 19,
    description: 'Solar stun guarantees tornado connection, triggering Yasuo Airborne Sever on the stunned backline.'
  },
  {
    champ1Id: 'c_sylla',
    champ2Id: 'c_tequoia',
    comboName: 'Wrath of the Ancient Forest',
    tier: 'A',
    bonus: 16,
    description: 'Spirit Bear and Treant swarm tank tower shots for ultra-rapid structure sieging.'
  },
  {
    champ1Id: 'c_kage',
    champ2Id: 'c_mirehook',
    comboName: 'Hook & Execute',
    tier: 'A',
    bonus: 17,
    description: 'Mirehook meat hook drags a target out of position, allowing Kage to instantly trigger Eclipse Mark.'
  },
  {
    champ1Id: 'c_xin',
    champ2Id: 'c_raijin',
    comboName: 'Elemental Storm Skirmish',
    tier: 'A',
    bonus: 16,
    description: 'Dual remnant spirits generate relentless map mobility and multi-angle flanking pressure.'
  }
];

// 3. Meta Data & Tier Ratings (Simulation Telemetry)
export const CHAMPION_META_STATS: Record<string, ChampionMetaStats> = {
  c_solana: { championId: 'c_solana', tier: 'S+', winRate: 54.2, pickRate: 38.5, banRate: 24.0, bestPartnerId: 'c_astra', worstMatchupId: 'c_buck' },
  c_astra: { championId: 'c_astra', tier: 'S', winRate: 52.8, pickRate: 42.1, banRate: 18.5, bestPartnerId: 'c_solana', worstMatchupId: 'c_kage' },
  c_kyumi: { championId: 'c_kyumi', tier: 'S', winRate: 53.1, pickRate: 35.4, banRate: 22.1, bestPartnerId: 'c_renn', worstMatchupId: 'c_nullweaver' },
  c_buck: { championId: 'c_buck', tier: 'S+', winRate: 54.7, pickRate: 39.0, banRate: 28.2, bestPartnerId: 'c_solana', worstMatchupId: 'c_astra' },
  c_valkira: { championId: 'c_valkira', tier: 'S', winRate: 52.4, pickRate: 32.8, banRate: 20.4, bestPartnerId: 'c_solana', worstMatchupId: 'c_earthshaker' },
  c_kage: { championId: 'c_kage', tier: 'S+', winRate: 55.1, pickRate: 44.0, banRate: 34.6, bestPartnerId: 'c_mirehook', worstMatchupId: 'c_solana' },
  c_kazemaru: { championId: 'c_kazemaru', tier: 'S', winRate: 52.0, pickRate: 46.5, banRate: 31.0, bestPartnerId: 'c_renn', worstMatchupId: 'c_earthshaker' },
  c_kindra: { championId: 'c_kindra', tier: 'A', winRate: 50.8, pickRate: 24.5, banRate: 12.0, bestPartnerId: 'c_zal', worstMatchupId: 'c_kage' },
  c_cora: { championId: 'c_cora', tier: 'S+', winRate: 54.8, pickRate: 41.2, banRate: 26.5, bestPartnerId: 'c_renn', worstMatchupId: 'c_kage' },
  c_renn: { championId: 'c_renn', tier: 'S+', winRate: 55.4, pickRate: 43.6, banRate: 29.8, bestPartnerId: 'c_cora', worstMatchupId: 'c_kaolin' },
  c_sylla: { championId: 'c_sylla', tier: 'A', winRate: 51.5, pickRate: 22.0, banRate: 14.5, bestPartnerId: 'c_tequoia', worstMatchupId: 'c_astra' },
  c_tequoia: { championId: 'c_tequoia', tier: 'A', winRate: 50.2, pickRate: 19.8, banRate: 9.0, bestPartnerId: 'c_sylla', worstMatchupId: 'c_kage' },
  c_zal: { championId: 'c_zal', tier: 'S', winRate: 53.0, pickRate: 28.5, banRate: 16.0, bestPartnerId: 'c_kindra', worstMatchupId: 'c_solana' },
  c_xin: { championId: 'c_xin', tier: 'A', winRate: 51.2, pickRate: 27.0, banRate: 15.2, bestPartnerId: 'c_raijin', worstMatchupId: 'c_kaolin' },
  c_raijin: { championId: 'c_raijin', tier: 'S+', winRate: 54.5, pickRate: 37.2, banRate: 27.0, bestPartnerId: 'c_earthshaker', worstMatchupId: 'c_nullweaver' },
  c_kaolin: { championId: 'c_kaolin', tier: 'S', winRate: 52.9, pickRate: 26.4, banRate: 19.0, bestPartnerId: 'c_earthshaker', worstMatchupId: 'c_cora' },
  c_earthshaker: { championId: 'c_earthshaker', tier: 'S+', winRate: 56.0, pickRate: 40.5, banRate: 36.5, bestPartnerId: 'c_raijin', worstMatchupId: 'c_kazemaru' },
  c_shadowfiend: { championId: 'c_shadowfiend', tier: 'S', winRate: 53.4, pickRate: 34.0, banRate: 23.0, bestPartnerId: 'c_earthshaker', worstMatchupId: 'c_kage' },
  c_mirehook: { championId: 'c_mirehook', tier: 'S', winRate: 53.8, pickRate: 38.0, banRate: 25.4, bestPartnerId: 'c_kage', worstMatchupId: 'c_solana' },
  c_nullweaver: { championId: 'c_nullweaver', tier: 'A', winRate: 51.8, pickRate: 21.0, banRate: 17.5, bestPartnerId: 'c_solana', worstMatchupId: 'c_buck' },
  c_invoker: { championId: 'c_invoker', tier: 'S+', winRate: 55.6, pickRate: 42.0, banRate: 31.0, bestPartnerId: 'c_earthshaker', worstMatchupId: 'c_kage' },
  c_hwei: { championId: 'c_hwei', tier: 'S', winRate: 53.2, pickRate: 36.5, banRate: 22.0, bestPartnerId: 'c_puck', worstMatchupId: 'c_vi' },
  c_jayce: { championId: 'c_jayce', tier: 'S', winRate: 52.9, pickRate: 35.0, banRate: 19.5, bestPartnerId: 'c_vi', worstMatchupId: 'c_bristleback' },
  c_vi: { championId: 'c_vi', tier: 'S+', winRate: 54.8, pickRate: 39.5, banRate: 27.0, bestPartnerId: 'c_jayce', worstMatchupId: 'c_solana' },
  c_jinx: { championId: 'c_jinx', tier: 'S+', winRate: 55.0, pickRate: 44.5, banRate: 33.0, bestPartnerId: 'c_io', worstMatchupId: 'c_vi' },
  c_puck: { championId: 'c_puck', tier: 'S', winRate: 53.5, pickRate: 31.0, banRate: 21.5, bestPartnerId: 'c_hwei', worstMatchupId: 'c_kaolin' },
  c_batrider: { championId: 'c_batrider', tier: 'S', winRate: 52.7, pickRate: 29.0, banRate: 18.0, bestPartnerId: 'c_earthshaker', worstMatchupId: 'c_puck' },
  c_bristleback: { championId: 'c_bristleback', tier: 'S+', winRate: 54.3, pickRate: 37.0, banRate: 26.0, bestPartnerId: 'c_io', worstMatchupId: 'c_astra' },
  c_io: { championId: 'c_io', tier: 'S+', winRate: 55.2, pickRate: 33.0, banRate: 28.5, bestPartnerId: 'c_jinx', worstMatchupId: 'c_nullweaver' }
};

// 4. Intelligence Scoring Functions for Draft Decision Engine

/**
 * Calculates counter advantage bonus for a candidate champion against locked opponent picks.
 */
export function calculateCounterBonus(championId: string, opponentChampionIds: string[]): number {
  let score = 0;
  for (const oppId of opponentChampionIds) {
    // If our candidate counters their locked pick
    const hardCounter = CHAMPION_COUNTERS.find(c => c.championId === championId && c.countersId === oppId);
    if (hardCounter) score += hardCounter.advantage * 0.8;

    // If their locked pick counters our candidate
    const counteredBy = CHAMPION_COUNTERS.find(c => c.championId === oppId && c.countersId === championId);
    if (counteredBy) score -= counteredBy.advantage * 0.7;
  }
  return Math.round(score);
}

/**
 * Calculates synergy combination bonus for a candidate champion with already locked team allies.
 */
export function calculateSynergyBonus(championId: string, alliedChampionIds: string[]): number {
  let score = 0;
  for (const allyId of alliedChampionIds) {
    const pair = CHAMPION_SYNERGIES.find(
      s => (s.champ1Id === championId && s.champ2Id === allyId) ||
           (s.champ2Id === championId && s.champ1Id === allyId)
    );
    if (pair) {
      score += pair.bonus;
    }
  }
  return Math.round(score);
}

/**
 * Retrieves full list of counters and synergies for the UI inspection modal.
 */
export function getChampionMatchupProfile(championId: string) {
  const strongAgainst = CHAMPION_COUNTERS.filter(c => c.championId === championId);
  const weakAgainst = CHAMPION_COUNTERS.filter(c => c.countersId === championId);
  const synergies = CHAMPION_SYNERGIES.filter(s => s.champ1Id === championId || s.champ2Id === championId);
  const meta = CHAMPION_META_STATS[championId] ?? {
    championId,
    tier: 'A',
    winRate: 50.0,
    pickRate: 20.0,
    banRate: 10.0,
    bestPartnerId: '',
    worstMatchupId: ''
  };

  return { strongAgainst, weakAgainst, synergies, meta };
}

