// src/marketBatchEngine.ts
// Chess.com × Hattrick Club Management Engine:
// 1-10 Attribute Scale, Veteran-to-Coach Lifecycle, Batch Player Generator,
// Live Bidding Escrow, Scouting Network & Hattrick Training.

import type {
  CardTier,
  CoachAttributes,
  CoachCard,
  FriendChallenge,
  FriendClub,
  MacroRegion,
  MarketListing,
  PlayerAttributes,
  PlayerCard,
  ScoutCard,
  ScoutReportDossier,
  TacticalArchetype,
  ThirdPartyCup,
  TrainingFocus,
  TrainingRegimen
} from './types';

// ==========================================
// 1. THE 1–10 HATTRICK ATTRIBUTE SCALE
// ==========================================

export function toScale10(stat99: number): number {
  if (typeof stat99 !== 'number' || isNaN(stat99)) return 5;
  if (stat99 <= 19) return 1;
  if (stat99 <= 29) return 2;
  if (stat99 <= 39) return 3;
  if (stat99 <= 49) return 4;
  if (stat99 <= 59) return 5;
  if (stat99 <= 69) return 6;
  if (stat99 <= 79) return 7;
  if (stat99 <= 87) return 8;
  if (stat99 <= 94) return 9;
  return 10;
}

export function fromScale10(stat10: number): number {
  const clamped = Math.max(1, Math.min(10, Math.round(stat10)));
  const map: Record<number, number> = {
    1: 15,
    2: 25,
    3: 35,
    4: 45,
    5: 55,
    6: 65,
    7: 75,
    8: 84,
    9: 91,
    10: 97
  };
  return map[clamped] ?? 65;
}

export function getHattrickDescriptor(scale10: number): string {
  const clamped = Math.max(1, Math.min(10, Math.round(scale10)));
  const descriptors: Record<number, string> = {
    1: 'Non-existent',
    2: 'Wretched',
    3: 'Poor',
    4: 'Weak',
    5: 'Passable',
    6: 'Solid',
    7: 'Excellent',
    8: 'Formidable',
    9: 'World Class',
    10: 'Divine (GOAT)'
  };
  return descriptors[clamped] ?? 'Passable';
}

export function getAttributeColor(scale10: number): string {
  if (scale10 >= 10) return 'text-[#facc15] bg-[#facc15]/15 border-[#eab308]/50'; // Divine Gold
  if (scale10 >= 9) return 'text-[#c084fc] bg-[#a855f7]/15 border-[#9333ea]/50';  // World Class Purple
  if (scale10 >= 8) return 'text-[#38bdf8] bg-[#0ea5e9]/15 border-[#0284c7]/50';  // Formidable Blue
  if (scale10 >= 7) return 'text-[#4ade80] bg-[#22c55e]/15 border-[#16a34a]/50';  // Excellent Green
  if (scale10 >= 6) return 'text-[#34d399] bg-[#10b981]/12 border-[#059669]/40';  // Solid Emerald
  if (scale10 >= 5) return 'text-[#a3e635] bg-[#84cc16]/12 border-[#65a30d]/40';  // Passable Lime
  if (scale10 >= 4) return 'text-[#fbbf24] bg-[#f59e0b]/12 border-[#d97706]/40';  // Weak Amber
  return 'text-[#94a3b8] bg-[#334155]/30 border-[#475569]/50';                    // Poor / Wretched
}

export function mapToMacroRegion(regionOrSeed: string): MacroRegion {
  const upper = (regionOrSeed || '').toUpperCase();
  if (upper === 'ASIA' || upper === 'LCK' || upper === 'LPL') return 'ASIA';
  if (upper === 'EUROPE' || upper === 'LEC') return 'EUROPE';
  if (upper === 'AFRICA' || upper === 'CHALLENGERS') return 'AFRICA';
  if (upper === 'AMERICAS' || upper === 'LCS') return 'AMERICAS';
  let h = 0;
  for (let i = 0; i < upper.length; i++) h = (h * 31 + upper.charCodeAt(i)) >>> 0;
  const list: MacroRegion[] = ['ASIA', 'EUROPE', 'AFRICA', 'AMERICAS'];
  return list[h % 4];
}

// ==========================================
// 2. VETERAN PLAYER → COACH CONVERSION & CAPTAINCY
// ==========================================

export function getCoachAttributes(coach?: CoachCard): CoachAttributes {
  if (coach?.coachAttributes) return coach.coachAttributes;
  if (!coach) {
    return {
      tactical: 6,
      mechanical: 6,
      conditioning: 6,
      youthDevelopment: 6,
      motivation: 6
    };
  }
  const base = coach.rating10 ?? (coach.tier === 'GOAT' ? 9 : coach.tier === 'Diamond' ? 8 : coach.tier === 'Platinum' ? 7 : 6);
  const isMacro = coach.style === 'Objective Macro' || coach.style === 'Utility Execute';
  const isDive = coach.style === 'Aggressive Dive' || coach.style === 'Pick & Burst';
  return {
    tactical: Math.min(10, isMacro ? base + 1 : base),
    mechanical: Math.min(10, isDive ? base + 1 : base),
    conditioning: Math.max(5, Math.min(10, base - 1 + (coach.extraBans ? 1 : 0))),
    youthDevelopment: Math.min(10, coach.isConvertedPlayer ? base : base + 1),
    motivation: Math.min(10, Math.round(base + (coach.chemistryBonus >= 12 ? 1 : 0)))
  };
}

export function getCoachFocusBoost(
  coach: CoachCard | undefined,
  focus: TrainingFocus
): {
  primaryAttrLabel: string;
  primaryAttrValue: number;
  speedBonusPercent: number;
  youthBonusPercent: number;
} {
  const attrs = getCoachAttributes(coach);
  let primaryAttrLabel = 'Tactical Coaching';
  let primaryAttrValue = attrs.tactical;

  if (focus === 'rifling' || focus === 'entry') {
    primaryAttrLabel = 'Mechanical Drills';
    primaryAttrValue = attrs.mechanical;
  } else if (focus === 'positioning' || focus === 'shotcalling') {
    primaryAttrLabel = 'Tactical Macro';
    primaryAttrValue = attrs.tactical;
  } else if (focus === 'sniping') {
    primaryAttrLabel = 'Stage Motivation';
    primaryAttrValue = attrs.motivation;
  } else if (focus === 'utility') {
    primaryAttrLabel = 'Conditioning & Flex';
    primaryAttrValue = attrs.conditioning;
  }

  // Each point on 1-10 scale grants +6% drill speed, plus +2% per Motivation point above 5
  const speedBonusPercent = Math.round(primaryAttrValue * 6 + Math.max(0, attrs.motivation - 5) * 3);
  const youthBonusPercent = Math.round(attrs.youthDevelopment * 5);

  return {
    primaryAttrLabel,
    primaryAttrValue,
    speedBonusPercent,
    youthBonusPercent
  };
}

export function canBecomeCoach(player: PlayerCard): { eligible: boolean; reason?: string } {
  const age = player.age ?? 21;
  const iq10 = toScale10(player.stats.positioning);
  const ldr10 = toScale10(player.stats.shotcalling ?? 55);

  if (age < 23) {
    return { eligible: false, reason: `Player must be at least 23 years old (currently ${age} yo).` };
  }
  if (iq10 < 7) {
    return {
      eligible: false,
      reason: `Requires at least 7/10 IQ (currently ${iq10}/10 ${getHattrickDescriptor(iq10)}).`
    };
  }
  if (ldr10 < 6) {
    return {
      eligible: false,
      reason: `Requires at least 6/10 Leadership (currently ${ldr10}/10 ${getHattrickDescriptor(ldr10)}).`
    };
  }
  return { eligible: true };
}

export function convertPlayerToCoach(player: PlayerCard): CoachCard {
  const iq10 = toScale10(player.stats.positioning);
  const ldr10 = toScale10(player.stats.shotcalling ?? 55);
  const lan10 = toScale10(player.stats.rifling);
  const tf10 = toScale10(player.stats.entry);
  const sta10 = toScale10(player.stats.utility);
  const clu10 = toScale10(player.stats.sniping);

  const coachRating10 = Math.max(1, Math.min(10, Math.round(0.55 * iq10 + 0.45 * ldr10)));
  const playbookBonus = Math.max(0, (iq10 - 5) * 3); // up to +15%
  const chemistryBonus = Math.max(0, (ldr10 - 5) * 3); // up to +15
  const extraBans = iq10 >= 9 ? 1 : 0;

  let style: TacticalArchetype = 'Dynamic Adapt';
  if (iq10 >= 8 && ldr10 >= 8) style = 'Objective Macro';
  else if (tf10 >= 8) style = 'Aggressive Dive';
  else if (sta10 >= 8) style = 'Utility Execute';
  else if (clu10 >= 8 || lan10 >= 8) style = 'Pick & Burst';

  const tier: CardTier =
    coachRating10 >= 9 ? 'GOAT' : coachRating10 >= 8 ? 'Diamond' : coachRating10 >= 7 ? 'Platinum' : 'Gold';

  const coachAttributes: CoachAttributes = {
    tactical: iq10,
    mechanical: Math.max(5, Math.round((lan10 + tf10) / 2)),
    conditioning: Math.max(5, sta10),
    youthDevelopment: Math.max(6, Math.round((iq10 + ldr10) / 2)),
    motivation: Math.max(6, Math.round((ldr10 + clu10) / 2))
  };

  return {
    id: `coach_converted_${player.id}_${Date.now()}`,
    name: `Coach ${player.name}`,
    realName: player.realName,
    tier,
    style,
    chemistryBonus,
    playbookBonus,
    extraBans,
    quote: `Former competitor bringing ${iq10}/10 positioning and ${ldr10}/10 shotcalling to the coaching staff.`,
    avatarSvg: player.avatarSvg || player.name,
    rating10: coachRating10,
    coachAttributes,
    isConvertedPlayer: true,
    originalPlayerId: player.id
  };
}

export function resolveTeamCaptain(startingFive: PlayerCard[]): {
  captainId: string;
  captainName: string;
  combinedScore: number;
} | null {
  if (!startingFive.length) return null;
  let best = startingFive[0];
  let bestScore = toScale10(best.stats.positioning) + toScale10(best.stats.shotcalling ?? 55);

  for (let i = 1; i < startingFive.length; i++) {
    const p = startingFive[i];
    const score = toScale10(p.stats.positioning) + toScale10(p.stats.shotcalling ?? 55);
    if (score > bestScore) {
      bestScore = score;
      best = p;
    }
  }

  return {
    captainId: best.id,
    captainName: best.name,
    combinedScore: bestScore
  };
}

// ==========================================
// 3. BATCH PLAYER GENERATOR ENGINE
// ==========================================

const PARODY_FIRST = [
  'Viperz', 'Fakerino', 'ShowMocker', 'CanyonKid', 'KeriaBro', 'ChovyGod', 'Capsule',
  'Gumayuki', 'Rulerz', 'PeyzBoy', 'TarzanX', 'Scouty', 'Knighty', 'DoinbDance', 'BwipoT',
  'Mikyxo', 'JankosSpear', 'PerkzMid', 'RekklesArrow', 'DoubleLift', 'BjergKing', 'BlaberFish',
  'SneakySnack', 'MataVision', 'MadLifeHook', 'SmebTitan', 'HuniHolo', 'TheShyTwin', 'RookieAce',
  'UziSniper', 'DeftHands', 'JackeyLove2', 'CrispShield', 'MeikoWard', 'ClearloveSeven', 'BengiShadow'
];

const PARODY_LAST = [
  'Clash', 'Storm', 'Nova', 'Blaze', 'Frost', 'Apex', 'Titan', 'Echo', 'Vortex',
  'Pulse', 'Rift', 'Shadow', 'Strike', 'Edge', 'Flash', 'Zenith', 'Phantom', 'Fury'
];

const REGIONS: ('LCK' | 'LPL' | 'LEC' | 'LCS' | 'Challengers')[] = [
  'LCK', 'LPL', 'LEC', 'LCS', 'Challengers'
];

function pseudoRandom(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function generateSinglePlayer(
  rng: () => number,
  idSuffix: string,
  options: { isYouth?: boolean; forcedRegion?: 'LCK' | 'LPL' | 'LEC' | 'LCS' | 'Challengers' } = {}
): PlayerCard {
  const origin = options.forcedRegion ? (options.forcedRegion === 'LCK' || options.forcedRegion === 'LPL' ? 'LoL' : 'CS') : 'CS';
  const name1 = PARODY_FIRST[Math.floor(rng() * PARODY_FIRST.length)];
  const name2 = PARODY_LAST[Math.floor(rng() * PARODY_LAST.length)];
  const name = `${name1}_${name2}`;

  const isYouth = options.isYouth ?? rng() < 0.4;
  const age = isYouth ? Math.floor(16 + rng() * 3) : Math.floor(19 + rng() * 8); // Youth: 16-18, Pro: 19-26

  let targetOvr10: number;
  let potentialOvr10: number;

  if (isYouth) {
    targetOvr10 = Math.floor(5 + rng() * 3); // 5-7 current
    potentialOvr10 = Math.min(10, targetOvr10 + Math.floor(2 + rng() * 3)); // 8-10 potential
  } else {
    targetOvr10 = Math.floor(6 + rng() * 4); // 6-9 current
    potentialOvr10 = Math.min(10, targetOvr10 + Math.floor(rng() * 2));
  }

  const baseStat99 = fromScale10(targetOvr10);
  const jitter = () => Math.round((rng() - 0.5) * 12);

  const stats: PlayerAttributes = {
    rifling: Math.max(20, Math.min(99, baseStat99 + jitter())),
    entry: Math.max(20, Math.min(99, baseStat99 + jitter())),
    positioning: Math.max(20, Math.min(99, baseStat99 + jitter())),
    sniping: Math.max(20, Math.min(99, baseStat99 + jitter())),
    utility: Math.max(20, Math.min(99, baseStat99 + jitter())),
    shotcalling: Math.max(20, Math.min(99, baseStat99 + jitter()))
  };

  const calculatedOvr99 = Math.round(
    stats.rifling * 0.25 + stats.entry * 0.25 + stats.positioning * 0.15 + stats.sniping * 0.15 + stats.utility * 0.1 + stats.shotcalling * 0.1
  );

  const tier: CardTier =
    targetOvr10 >= 10 ? 'GOAT' : targetOvr10 >= 9 ? 'Diamond' : targetOvr10 >= 8 ? 'Platinum' : targetOvr10 >= 6 ? 'Gold' : 'Silver';

  const weeklyWage = Math.round(15 + targetOvr10 * 18 + (stats.shotcalling ?? 50) * 0.5);
  const macroRegion: MacroRegion = options.forcedRegion
    ? mapToMacroRegion(options.forcedRegion)
    : (['ASIA', 'EUROPE', 'AFRICA', 'AMERICAS'] as MacroRegion[])[Math.floor(rng() * 4)];

  return {
    id: `gen_p_${idSuffix}`,
    name,
    realName: name1,
    origin,
    macroRegion,
    tier,
    ovr: calculatedOvr99,
    stats,
    age,
    potentialOvr: fromScale10(potentialOvr10),
    wage: weeklyWage,
    personality: 'Unset',
    morale: 88,
    fatigue: 10,
    level: isYouth ? 15 : 35,
    currentXp: 300,
    maxXp: 3000,
    avatarSvg: name,
    matchesPlayedThisWeek: 0
  };
}

export function generateMarketBatch(
  batchSeed: number,
  count = 24
): {
  publicListings: MarketListing[];
  regionalYouthPool: Record<'LCK' | 'LPL' | 'LEC' | 'LCS' | 'Challengers', PlayerCard[]>;
} {
  const rng = pseudoRandom(batchSeed);
  const publicListings: MarketListing[] = [];
  const regionalYouthPool: Record<'LCK' | 'LPL' | 'LEC' | 'LCS' | 'Challengers', PlayerCard[]> = {
    LCK: [],
    LPL: [],
    LEC: [],
    LCS: [],
    Challengers: []
  };

  const SELLER_CLUBS = [
    'Gen.G Dynamos', 'FNATIC Rising', 'G2 Samurai', 'Cloud9 Academy',
    'Weibo Gaming', 'DRX Prodigies', 'T1 Academy', 'Free Agent Pool'
  ];

  for (let i = 0; i < count; i++) {
    const isYouth = i >= Math.floor(count * 0.6); // 60% public market, 40% youth scouting pool
    const player = generateSinglePlayer(rng, `${batchSeed}_${i}`, { isYouth });

    if (isYouth) {
      const region = REGIONS[i % REGIONS.length];
      regionalYouthPool[region].push(player);
    } else {
      const seller = SELLER_CLUBS[Math.floor(rng() * SELLER_CLUBS.length)];
      const ovr10 = toScale10(player.ovr);
      const askingPrice = Math.round(150 + ovr10 * 180 + rng() * 120);
      const buyoutPrice = Math.round(askingPrice * (1.4 + rng() * 0.3));

      publicListings.push({
        id: `listing_${batchSeed}_${i}`,
        player,
        sellerClubId: `club_${seller.toLowerCase().replace(/\s+/g, '_')}`,
        sellerClubName: seller,
        askingPrice,
        currentBid: null,
        highestBidderId: null,
        highestBidderName: null,
        buyoutPrice,
        bidsCount: 0,
        deadlineRound: 14,
        deadlineTimestamp: Date.now() + 3600 * 1000 * 24,
        bidHistory: []
      });
    }
  }

  return { publicListings, regionalYouthPool };
}

// ==========================================
// 4. SCOUTING NETWORK
// ==========================================

export const DEFAULT_SCOUTS: ScoutCard[] = [
  {
    id: 'scout_peter',
    name: 'Peter Dun (Elite Talent Eye)',
    avatarSvg: 'notail',
    specialtyRegion: 'LEC',
    weeklySalary: 85,
    hiringCost: 450,
    judgingAbility: 8,
    judgingPotential: 9,
    regionalKnowledge: 9,
    roleExpertise: 8,
    negotiation: 7,
    networkReach: 4,
    assignedRegion: 'LEC',
    activeMission: true
  },
  {
    id: 'scout_edgar',
    name: 'Edgar Cho (Korean Dynasty Scout)',
    avatarSvg: 'faker',
    specialtyRegion: 'LCK',
    weeklySalary: 110,
    hiringCost: 600,
    judgingAbility: 9,
    judgingPotential: 9,
    regionalKnowledge: 10,
    roleExpertise: 9,
    negotiation: 8,
    networkReach: 4,
    assignedRegion: 'LCK',
    activeMission: true
  },
  {
    id: 'scout_inero',
    name: 'Tony Inero (North American Developer)',
    avatarSvg: 'theshy',
    specialtyRegion: 'LCS',
    weeklySalary: 65,
    hiringCost: 300,
    judgingAbility: 7,
    judgingPotential: 8,
    regionalKnowledge: 9,
    roleExpertise: 7,
    negotiation: 8,
    networkReach: 3,
    assignedRegion: 'LCS',
    activeMission: false
  }
];

export function evaluateProspectWithScout(
  prospect: PlayerCard,
  scout: ScoutCard,
  currentRound = 1
): ScoutReportDossier {
  const actualOvr10 = toScale10(prospect.ovr);
  const actualPot10 = toScale10(prospect.potentialOvr ?? prospect.ovr);

  // Fog-of-war error margin determined by scout's judging ability & potential
  const abilityError = scout.judgingAbility >= 9 ? 0 : scout.judgingAbility >= 7 ? 1 : 2;
  const potentialError = scout.judgingPotential >= 9 ? 0 : scout.judgingPotential >= 7 ? 1 : 2;

  const minOvr = Math.max(1, actualOvr10 - abilityError);
  const maxOvr = Math.min(10, actualOvr10 + abilityError);

  const minPot = Math.max(minOvr, actualPot10 - potentialError);
  const maxPot = Math.min(10, actualPot10 + potentialError);

  // Negotiation discount (up to 25% discount)
  const discountFactor = 1 - (scout.negotiation / 10) * 0.25;
  const baseSigningFee = Math.round(actualOvr10 * 80 + actualPot10 * 100);
  const signingFee = Math.round(baseSigningFee * discountFactor);
  const weeklyWage = Math.round((prospect.wage ?? 25) * discountFactor);

  const region = scout.assignedRegion || scout.specialtyRegion;

  return {
    id: `dossier_${scout.id}_${prospect.id}`,
    prospect,
    scoutId: scout.id,
    scoutName: scout.name,
    region,
    estimatedOvrRange: [minOvr, maxOvr],
    revealedPotentialRange: [minPot, maxPot],
    signingFee,
    weeklyWage,
    scoutNotes: `Scouted in ${region}. Displays ${getHattrickDescriptor(actualOvr10)} fundamentals with ${getHattrickDescriptor(actualPot10)} upside.`,
    isSigned: false,
    expiresAtRound: currentRound + 2
  };
}

// ==========================================
// 5. LIVE BIDDING & ESCROW ENGINE
// ==========================================

export function placeBid(
  listing: MarketListing,
  bidAmount: number,
  playerFunds: number,
  playerClubId = 'my_club',
  playerClubName = 'Your Club'
): { updatedListing: MarketListing; escrowChange: number } | { error: string } {
  const minRequired = listing.currentBid ? Math.round(listing.currentBid * 1.05) : listing.askingPrice;

  if (bidAmount < minRequired) {
    return { error: `Bid must be at least 🪙 ${minRequired.toLocaleString()} Coins (+5% min increment).` };
  }

  const existingPlayerBid = listing.highestBidderId === playerClubId ? listing.currentBid ?? 0 : 0;
  const netEscrowNeeded = bidAmount - existingPlayerBid;

  if (playerFunds < netEscrowNeeded) {
    return { error: `Insufficient club treasury. Need 🪙 ${netEscrowNeeded.toLocaleString()} Coins.` };
  }

  const newBidRecord = {
    bidderId: playerClubId,
    bidderName: playerClubName,
    amount: bidAmount,
    timestamp: Date.now(),
    isPlayer: true
  };

  const updatedListing: MarketListing = {
    ...listing,
    currentBid: bidAmount,
    highestBidderId: playerClubId,
    highestBidderName: playerClubName,
    bidsCount: listing.bidsCount + 1,
    bidHistory: [newBidRecord, ...listing.bidHistory]
  };

  return {
    updatedListing,
    escrowChange: netEscrowNeeded
  };
}

export function instantBuyout(
  listing: MarketListing,
  playerFunds: number
): { updatedListing: MarketListing; cost: number } | { error: string } {
  if (playerFunds < listing.buyoutPrice) {
    return { error: `Insufficient club treasury. Buyout clause is 🪙 ${listing.buyoutPrice.toLocaleString()} Coins.` };
  }

  return {
    updatedListing: {
      ...listing,
      currentBid: listing.buyoutPrice,
      highestBidderId: 'my_club',
      highestBidderName: 'Your Club (Buyout Executed)'
    },
    cost: listing.buyoutPrice
  };
}

export function simulateAIBiddingStep(
  listings: MarketListing[],
  playerClubId = 'my_club',
  rngSeed = Date.now()
): {
  updatedListings: MarketListing[];
  outbidListingIds: string[];
} {
  const rng = pseudoRandom(rngSeed);
  const updatedListings: MarketListing[] = [];
  const outbidListingIds: string[] = [];

  const AI_BIDDERS = [
    'T1 Tigers', 'Gen.G Dynamos', 'FNATIC Rising', 'G2 Samurai',
    'Weibo Gaming', 'Bilibili Storm', 'Cloud9 Academy', 'Team Liquid'
  ];

  for (const listing of listings) {
    let current = { ...listing };

    // 25% chance of an AI club placing a bid on any open listing
    if (rng() < 0.25) {
      const currentHighest = current.currentBid ?? current.askingPrice;
      const aiBidAmount = Math.round(currentHighest * (1.05 + rng() * 0.10));

      if (aiBidAmount < current.buyoutPrice) {
        const aiClub = AI_BIDDERS[Math.floor(rng() * AI_BIDDERS.length)];
        const wasPlayerWinning = current.highestBidderId === playerClubId;

        current = {
          ...current,
          currentBid: aiBidAmount,
          highestBidderId: `ai_${aiClub.toLowerCase().replace(/\s+/g, '_')}`,
          highestBidderName: aiClub,
          bidsCount: current.bidsCount + 1,
          bidHistory: [
            {
              bidderId: `ai_${aiClub.toLowerCase().replace(/\s+/g, '_')}`,
              bidderName: aiClub,
              amount: aiBidAmount,
              timestamp: Date.now(),
              isPlayer: false
            },
            ...current.bidHistory
          ]
        };

        if (wasPlayerWinning) {
          outbidListingIds.push(current.id);
        }
      }
    }

    updatedListings.push(current);
  }

  return { updatedListings, outbidListingIds };
}

// ==========================================
// 6. HATTRICK TRAINING SYSTEM (COACH ATTRIBUTES + REAL MATCH IMPACT)
// ==========================================

export function applyHattrickTrainingTick(
  roster: PlayerCard[],
  startingFive: PlayerCard[],
  regimen: TrainingRegimen,
  isMatchDay = true,
  coach?: CoachCard
): {
  updatedRoster: PlayerCard[];
  levelUps: { playerName: string; attribute: string; from: number; to: number }[];
} {
  const starterIds = new Set(startingFive.map((p) => p.id));
  const levelUps: { playerName: string; attribute: string; from: number; to: number }[] = [];

  const focus = regimen.primaryFocus; // 'rifling' | 'entry' | 'positioning' | 'shotcalling' | 'sniping' | 'utility'
  const intensityFactor = regimen.intensityPercent / 100; // 0.5 to 1.0
  const coachBoost = coach ? getCoachFocusBoost(coach, focus) : null;
  const coachMultiplier = coachBoost ? 1 + coachBoost.speedBonusPercent / 100 : 1.0;

  const updatedRoster = roster.map((player) => {
    const isStarter = starterIds.has(player.id);
    const age = player.age ?? 21;

    // Real match participation: Hattrick rule where real matches unlock 100%-135% training speed
    const realMatches = player.matchesPlayedThisWeek ?? (isStarter && isMatchDay ? 1 : 0);
    let slotMultiplier = isStarter ? 1.0 : 0.35;
    if (realMatches >= 2) {
      slotMultiplier = isStarter ? 1.35 : 0.85;
    } else if (realMatches === 1) {
      slotMultiplier = isStarter ? 1.15 : 0.70;
    } else if (!isMatchDay && realMatches === 0) {
      slotMultiplier = isStarter ? 0.55 : 0.25;
    }

    // Age multiplier: 16-18 yo: 1.45x (+ coach youth development), 19-22 yo: 1.0x, 23+ yo: 0.45x for mechanics/TF, 1.20x for IQ/LDR
    let ageMultiplier = 1.0;
    if (age <= 18) {
      const youthCoachAdd = coachBoost ? coachBoost.youthBonusPercent / 200 : 0;
      ageMultiplier = 1.45 + youthCoachAdd;
    } else if (age >= 23) {
      ageMultiplier = focus === 'positioning' || focus === 'shotcalling' ? 1.20 : 0.45;
    }

    const currentStat = player.stats[focus] ?? 50;
    const currentProgress = player.trainingProgress?.[focus] ?? 0;

    // Base gain per matchday / training session: 12 - 25 progress points toward +1 stat
    const gain = Math.max(
      2,
      Math.round((isMatchDay ? 20 : 12) * intensityFactor * slotMultiplier * ageMultiplier * coachMultiplier)
    );
    const newProgress = currentProgress + gain;

    let updatedStat = currentStat;
    let finalProgress = newProgress;

    if (newProgress >= 100 && updatedStat < 99) {
      updatedStat = Math.min(99, updatedStat + 1);
      finalProgress = newProgress - 100;

      const from10 = toScale10(currentStat);
      const to10 = toScale10(updatedStat);
      if (to10 > from10) {
        levelUps.push({
          playerName: player.name,
          attribute: focus.toUpperCase(),
          from: from10,
          to: to10
        });
      }
    }

    const newStats: PlayerAttributes = {
      ...player.stats,
      [focus]: updatedStat
    };

    const newOvr = Math.round(
      newStats.rifling * 0.25 +
      newStats.entry * 0.25 +
      newStats.positioning * 0.15 +
      newStats.sniping * 0.15 +
      newStats.utility * 0.1 +
      newStats.utility * 0.1
    );

    return {
      ...player,
      ovr: newOvr,
      stats: newStats,
      lastMatchTrainingGain: gain,
      trainingProgress: {
        ...(player.trainingProgress || {}),
        [focus]: finalProgress
      }
    };
  });

  return { updatedRoster, levelUps };
}

export function applyRealMatchTrainingImpact(
  roster: PlayerCard[],
  participantIds: string[],
  regimen: TrainingRegimen,
  coach?: CoachCard,
  isWin = true
): {
  updatedRoster: PlayerCard[];
  levelUps: { playerName: string; attribute: string; from: number; to: number }[];
} {
  const activeSet = new Set(participantIds);
  const focus = regimen.primaryFocus;
  const coachBoost = getCoachFocusBoost(coach, focus);
  const coachMultiplier = 1 + coachBoost.speedBonusPercent / 100;
  const winMultiplier = isWin ? 1.25 : 1.0;
  const levelUps: { playerName: string; attribute: string; from: number; to: number }[] = [];

  const updatedRoster = roster.map((player) => {
    const playedInMatch = activeSet.has(player.id);
    if (!playedInMatch) {
      return player;
    }

    const age = player.age ?? 21;
    let ageMultiplier = 1.0;
    if (age <= 18) {
      ageMultiplier = 1.35 + coachBoost.youthBonusPercent / 200;
    } else if (age >= 23) {
      ageMultiplier = focus === 'positioning' || focus === 'shotcalling' ? 1.20 : 0.65;
    }

    const currentStat = player.stats[focus] ?? 50;
    const currentProgress = player.trainingProgress?.[focus] ?? 0;
    const matchGain = Math.round(18 * (regimen.intensityPercent / 100) * coachMultiplier * winMultiplier * ageMultiplier);
    const newProgress = currentProgress + matchGain;

    let updatedStat = currentStat;
    let finalProgress = newProgress;

    if (newProgress >= 100 && updatedStat < 99) {
      updatedStat = Math.min(99, updatedStat + 1);
      finalProgress = newProgress - 100;

      const from10 = toScale10(currentStat);
      const to10 = toScale10(updatedStat);
      if (to10 > from10) {
        levelUps.push({
          playerName: player.name,
          attribute: focus.toUpperCase(),
          from: from10,
          to: to10
        });
      }
    }

    const newStats: PlayerAttributes = {
      ...player.stats,
      [focus]: updatedStat
    };

    const newOvr = Math.round(
      newStats.rifling * 0.25 +
      newStats.entry * 0.25 +
      newStats.positioning * 0.15 +
      newStats.sniping * 0.15 +
      newStats.utility * 0.1 +
      newStats.utility * 0.1
    );

    return {
      ...player,
      ovr: newOvr,
      stats: newStats,
      matchesPlayedThisWeek: (player.matchesPlayedThisWeek ?? 0) + 1,
      lastMatchTrainingGain: matchGain,
      trainingProgress: {
        ...(player.trainingProgress || {}),
        [focus]: finalProgress
      }
    };
  });

  return { updatedRoster, levelUps };
}

export const INITIAL_THIRD_PARTY_CUPS: ThirdPartyCup[] = [
  {
    id: 'cup_dreamleague_s26',
    name: 'DreamLeague Season 26',
    organizer: 'ESL FaceIt Circuit',
    tierLabel: 'S-Tier Major',
    prizePoolCoins: 4500,
    inGameRewardLabel: '+20% Coach Drill Speed Booster (3 Weeks) + DreamLeague Crest',
    inGameRewardType: 'training_booster',
    status: 'Quarterfinals',
    currentRound: 1,
    maxRounds: 3,
    nextOpponentName: 'Seoul Dynamos',
    nextOpponentRegion: 'ASIA',
    nextOpponentOvr: 8
  },
  {
    id: 'cup_blast_slam',
    name: 'BLAST Arena Grand Slam',
    organizer: 'BLAST Premier',
    tierLabel: 'S-Tier Major',
    prizePoolCoins: 3800,
    inGameRewardLabel: 'Elite Global Scout Dossier Token (Guaranteed 9-10/10 Prospect)',
    inGameRewardType: 'scout_token',
    status: 'Quarterfinals',
    currentRound: 1,
    maxRounds: 3,
    nextOpponentName: 'Berlin Samurai',
    nextOpponentRegion: 'EUROPE',
    nextOpponentOvr: 8
  },
  {
    id: 'cup_afro_invitational',
    name: 'Savannah Masters Invitational',
    organizer: 'African Esports Federation',
    tierLabel: 'A-Tier Circuit',
    prizePoolCoins: 2400,
    inGameRewardLabel: 'Full Squad Conditioning & Stamina Recovery Kit',
    inGameRewardType: 'stamina_recovery',
    status: 'Quarterfinals',
    currentRound: 1,
    maxRounds: 3,
    nextOpponentName: 'Cairo Pharaohs',
    nextOpponentRegion: 'AFRICA',
    nextOpponentOvr: 7
  },
  {
    id: 'cup_redbull_gauntlet',
    name: 'Red Bull Pan-American Gauntlet',
    organizer: 'Red Bull Gaming',
    tierLabel: 'Open Invitational',
    prizePoolCoins: 2900,
    inGameRewardLabel: 'Golden Gauntlet Club Banner + +15% Match XP',
    inGameRewardType: 'trophy_crest',
    status: 'Quarterfinals',
    currentRound: 1,
    maxRounds: 3,
    nextOpponentName: 'São Paulo Vipers',
    nextOpponentRegion: 'AMERICAS',
    nextOpponentOvr: 8
  }
];

export const INITIAL_FRIENDS: FriendClub[] = [
  {
    id: 'fr_1',
    managerName: 'KuroKy_99',
    clubName: 'Seoul Shadow Wolves',
    clubTag: '#ASIA-8821',
    region: 'ASIA',
    avatarSeed: 'KuroKy_99',
    status: 'online',
    avgOvr: 8,
    divisionLabel: 'ASIA · Tier 1 Premier (Shard #1)',
    headToHeadWins: 3,
    headToHeadLosses: 2
  },
  {
    id: 'fr_2',
    managerName: 'CapsLockEU',
    clubName: 'Copenhagen Valkyries',
    clubTag: '#EU-4019',
    region: 'EUROPE',
    avatarSeed: 'CapsLockEU',
    status: 'online',
    avgOvr: 8,
    divisionLabel: 'EUROPE · Tier 1 Premier (Shard #1)',
    headToHeadWins: 2,
    headToHeadLosses: 1
  },
  {
    id: 'fr_3',
    managerName: 'AminePharaoh',
    clubName: 'Lagos Cyber Lions',
    clubTag: '#AFR-1104',
    region: 'AFRICA',
    avatarSeed: 'AminePharaoh',
    status: 'in_match',
    avgOvr: 7,
    divisionLabel: 'AFRICA · Tier 1 Premier (Shard #1)',
    headToHeadWins: 4,
    headToHeadLosses: 0
  },
  {
    id: 'fr_4',
    managerName: 'TacoViperNA',
    clubName: 'Los Angeles Renegades',
    clubTag: '#AME-7730',
    region: 'AMERICAS',
    avatarSeed: 'TacoViperNA',
    status: 'online',
    avgOvr: 8,
    divisionLabel: 'AMERICAS · Tier 2 Challengers (Shard #14)',
    headToHeadWins: 1,
    headToHeadLosses: 2
  }
];

export const INITIAL_FRIEND_CHALLENGES: FriendChallenge[] = [
  {
    id: 'ch_inc_1',
    friendId: 'fr_1',
    friendName: 'KuroKy_99',
    clubName: 'Seoul Shadow Wolves',
    region: 'ASIA',
    avatarSeed: 'KuroKy_99',
    avgOvr: 8,
    mode: 'Showmatch Wager',
    wagerCoins: 500,
    trainingBonusLabel: '+100% Real Match Training Progress (All 5 Starters)',
    direction: 'incoming',
    createdAtLabel: '2m ago',
    status: 'pending'
  },
  {
    id: 'ch_inc_2',
    friendId: 'fr_2',
    friendName: 'CapsLockEU',
    clubName: 'Copenhagen Valkyries',
    region: 'EUROPE',
    avatarSeed: 'CapsLockEU',
    avgOvr: 8,
    mode: 'Friendly Scrimmage',
    wagerCoins: 0,
    trainingBonusLabel: '+100% Real Match Training Progress (All 5 Starters)',
    direction: 'incoming',
    createdAtLabel: '14m ago',
    status: 'pending'
  }
];
