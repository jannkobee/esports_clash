// src/marketBatchEngine.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  toScale10,
  fromScale10,
  getHattrickDescriptor,
  canBecomeCoach,
  convertPlayerToCoach,
  getCoachAttributes,
  getCoachFocusBoost,
  mapToMacroRegion,
  resolveTeamCaptain,
  generateMarketBatch,
  evaluateProspectWithScout,
  DEFAULT_SCOUTS,
  placeBid,
  instantBuyout,
  simulateAIBiddingStep,
  applyHattrickTrainingTick,
  applyRealMatchTrainingImpact,
  INITIAL_THIRD_PARTY_CUPS,
  INITIAL_FRIENDS,
  INITIAL_FRIEND_CHALLENGES
} from './marketBatchEngine.ts';

test('toScale10 accurately maps 1-99 attributes to the 1-10 Hattrick scale with correct descriptors', () => {
  assert.equal(toScale10(15), 1);
  assert.equal(getHattrickDescriptor(1), 'Non-existent');

  assert.equal(toScale10(25), 2);
  assert.equal(getHattrickDescriptor(2), 'Wretched');

  assert.equal(toScale10(35), 3);
  assert.equal(getHattrickDescriptor(3), 'Poor');

  assert.equal(toScale10(45), 4);
  assert.equal(getHattrickDescriptor(4), 'Weak');

  assert.equal(toScale10(55), 5);
  assert.equal(getHattrickDescriptor(5), 'Passable');

  assert.equal(toScale10(65), 6);
  assert.equal(getHattrickDescriptor(6), 'Solid');

  assert.equal(toScale10(75), 7);
  assert.equal(getHattrickDescriptor(7), 'Excellent');

  assert.equal(toScale10(85), 8);
  assert.equal(getHattrickDescriptor(8), 'Formidable');

  assert.equal(toScale10(92), 9);
  assert.equal(getHattrickDescriptor(9), 'World Class');

  assert.equal(toScale10(98), 10);
  assert.equal(getHattrickDescriptor(10), 'Divine (GOAT)');
});

test('fromScale10 returns sensible 1-99 anchors for simulation integration', () => {
  assert.equal(fromScale10(10), 97);
  assert.equal(fromScale10(8), 84);
  assert.equal(fromScale10(5), 55);
  assert.equal(fromScale10(1), 15);
});

test('canBecomeCoach strictly enforces Age >= 23, IQ >= 7/10 and Leadership >= 6/10', () => {
  const youngProdigy = {
    id: 'p_young',
    name: 'Youngster',
    realName: 'Young',
    origin: 'LoL',
    tier: 'Gold',
    ovr: 88,
    stats: { lan: 95, tf: 90, iq: 85, clu: 85, sta: 85, flx: 80, ldr: 80 },
    age: 18,
    badges: [],
    signatureChampions: [],
    morale: 90,
    fatigue: 0,
    level: 20,
    currentXp: 0,
    maxXp: 1000,
    avatarSvg: 'theshy',
    personality: 'Solo'
  };

  const youngCheck = canBecomeCoach(youngProdigy);
  assert.equal(youngCheck.eligible, false);
  assert.match(youngCheck.reason, /at least 23 years old/);

  // Veteran with low IQ (< 70 -> < 7)
  const lowIqVeteran = {
    ...youngProdigy,
    age: 24,
    stats: { ...youngProdigy.stats, iq: 55, ldr: 80 }
  };
  const lowIqCheck = canBecomeCoach(lowIqVeteran);
  assert.equal(lowIqCheck.eligible, false);
  assert.match(lowIqCheck.reason, /at least 7\/10 IQ/);

  // Veteran with low Leadership (< 60 -> < 6)
  const lowLdrVeteran = {
    ...youngProdigy,
    age: 24,
    stats: { ...youngProdigy.stats, iq: 75, ldr: 45 }
  };
  const lowLdrCheck = canBecomeCoach(lowLdrVeteran);
  assert.equal(lowLdrCheck.eligible, false);
  assert.match(lowLdrCheck.reason, /at least 6\/10 Leadership/);

  // Qualified Veteran (Age 24, IQ 78 -> 7, LDR 68 -> 6)
  const qualifiedVeteran = {
    ...youngProdigy,
    age: 24,
    stats: { ...youngProdigy.stats, iq: 78, ldr: 68 }
  };
  const qualifiedCheck = canBecomeCoach(qualifiedVeteran);
  assert.equal(qualifiedCheck.eligible, true);
});

test('convertPlayerToCoach creates an authentic CoachCard with derived stats and extra bans if IQ >= 9', () => {
  const masterTactician = {
    id: 'p_tactician',
    name: 'OldMaster',
    realName: 'Master',
    origin: 'LoL',
    tier: 'Diamond',
    ovr: 89,
    role: 'Support',
    preferredRole: 'Support',
    stats: { lan: 60, tf: 70, iq: 96, clu: 85, sta: 70, flx: 80, ldr: 88 }, // IQ 10/10, LDR 9/10
    age: 26,
    badges: [],
    signatureChampions: ['Solana'],
    morale: 95,
    fatigue: 0,
    level: 45,
    currentXp: 0,
    maxXp: 4000,
    avatarSvg: 'notail',
    personality: 'Leader'
  };

  const coach = convertPlayerToCoach(masterTactician);
  assert.equal(coach.name, 'Coach OldMaster');
  assert.equal(coach.realName, 'Master');
  assert.equal(coach.isConvertedPlayer, true);
  assert.equal(coach.originalPlayerId, 'p_tactician');
  assert.equal(coach.rating10, 10);
  assert.equal(coach.extraBans, 1); // IQ >= 9 unlocks +1 ban
  assert.ok(coach.playbookBonus >= 12);
  assert.ok(coach.chemistryBonus >= 9);
  assert.equal(coach.style, 'Objective Macro');
});

test('resolveTeamCaptain picks the player with the highest combined LDR + IQ', () => {
  const p1 = { id: 'p1', name: 'MicroGod', stats: { lan: 99, tf: 95, iq: 70, clu: 80, sta: 80, flx: 80, ldr: 50 } };
  const p2 = { id: 'p2', name: 'VocalLeader', stats: { lan: 80, tf: 85, iq: 85, clu: 85, sta: 85, flx: 85, ldr: 92 } };

  const captain = resolveTeamCaptain([p1, p2]);
  assert.ok(captain);
  assert.equal(captain.captainId, 'p2');
  assert.equal(captain.captainName, 'VocalLeader');
});

test('generateMarketBatch creates public listings and regional youth pools deterministically', () => {
  const batch = generateMarketBatch(42, 20);
  assert.equal(batch.publicListings.length, 12); // 60%
  const totalYouth = Object.values(batch.regionalYouthPool).reduce((acc, pool) => acc + pool.length, 0);
  assert.equal(totalYouth, 8); // 40%

  // Check youth age range
  batch.regionalYouthPool.LCK.forEach((p) => {
    assert.ok(p.age >= 16 && p.age <= 18);
    assert.ok(p.potentialOvr >= p.ovr);
  });

  // Verify repeatability
  const batchRepeat = generateMarketBatch(42, 20);
  assert.equal(batch.publicListings[0].player.name, batchRepeat.publicListings[0].player.name);
});

test('evaluateProspectWithScout reveals fog-of-war bounds determined by scout attributes', () => {
  const eliteScout = DEFAULT_SCOUTS.find((s) => s.judgingAbility >= 9);
  assert.ok(eliteScout);

  const prospect = {
    id: 'p_test',
    name: 'Gem',
    ovr: 75, // 7/10
    potentialOvr: 92, // 9/10
    wage: 50,
    stats: { lan: 75, tf: 75, iq: 75, clu: 75, sta: 75, flx: 75, ldr: 75 }
  };

  const dossier = evaluateProspectWithScout(prospect, eliteScout, 1);
  assert.equal(dossier.estimatedOvrRange[0], 7);
  assert.equal(dossier.estimatedOvrRange[1], 7); // Exact bounds for elite scout
  assert.ok(dossier.signingFee > 0);
  assert.ok(dossier.weeklyWage <= prospect.wage); // Negotiation discount applied
});

test('placeBid enforces +5% minimum increments and manages escrow balance', () => {
  const listing = {
    id: 'l_1',
    askingPrice: 1000,
    currentBid: null,
    highestBidderId: null,
    highestBidderName: null,
    buyoutPrice: 2000,
    bidsCount: 0,
    deadlineRound: 14,
    deadlineTimestamp: Date.now() + 100000,
    bidHistory: []
  };

  // Placing initial bid of asking price
  const res1 = placeBid(listing, 1000, 1500, 'my_club', 'My Club');
  assert.ok('updatedListing' in res1);
  assert.equal(res1.updatedListing.currentBid, 1000);
  assert.equal(res1.escrowChange, 1000);

  // Counter-bidding less than +5% fails
  const res2 = placeBid(res1.updatedListing, 1020, 1500, 'my_club', 'My Club');
  assert.ok('error' in res2);

  // Counter-bidding at 1100 succeeds
  const res3 = placeBid(res1.updatedListing, 1100, 1500, 'my_club', 'My Club');
  assert.ok('updatedListing' in res3);
  assert.equal(res3.updatedListing.currentBid, 1100);
  assert.equal(res3.escrowChange, 100); // 1100 - 1000 already held in escrow
});

test('applyHattrickTrainingTick boosts targeted attributes with youth bonus and starter slot efficiency', () => {
  const youthStarter = {
    id: 'p_youth',
    name: 'Youth',
    age: 17,
    ovr: 65,
    stats: { lan: 65, tf: 65, iq: 65, clu: 65, sta: 65, flx: 65, ldr: 65 },
    trainingProgress: { lan: 85 }
  };

  const veteranBench = {
    id: 'p_vet',
    name: 'Veteran',
    age: 26,
    ovr: 75,
    stats: { lan: 75, tf: 75, iq: 75, clu: 75, sta: 75, flx: 75, ldr: 75 },
    trainingProgress: { lan: 85 }
  };

  const regimen = {
    primaryFocus: 'lan',
    intensityPercent: 100,
    staminaSharePercent: 10
  };

  const result = applyHattrickTrainingTick(
    [youthStarter, veteranBench],
    [youthStarter], // youth is starter
    regimen,
    true
  );

  const updatedYouth = result.updatedRoster.find((p) => p.id === 'p_youth');
  const updatedVet = result.updatedRoster.find((p) => p.id === 'p_vet');

  assert.ok(updatedYouth);
  assert.ok(updatedVet);
  // Youth should level up LAN (85 + >20 >= 100)
  assert.equal(updatedYouth.stats.lan, 66);
  assert.ok(updatedYouth.trainingProgress.lan < 85);
});

test('getCoachAttributes and applyRealMatchTrainingImpact multiply training speed from coach 1-10 attributes and real games', () => {
  const coach = {
    id: 'c_test',
    name: 'Coach Master',
    realName: 'Master',
    tier: 'GOAT',
    style: 'Aggressive Dive',
    chemistryBonus: 15,
    playbookBonus: 15,
    extraBans: 1,
    quote: 'Drill hard.',
    avatarSvg: 'faker',
    rating10: 9,
    coachAttributes: {
      tactical: 9,
      mechanical: 10,
      conditioning: 8,
      youthDevelopment: 9,
      motivation: 9
    }
  };

  const attrs = getCoachAttributes(coach);
  assert.equal(attrs.mechanical, 10);
  const boost = getCoachFocusBoost(coach, 'lan');
  assert.ok(boost.speedBonusPercent >= 60);

  const starter = {
    id: 'p_starter',
    name: 'StarterPro',
    age: 19,
    ovr: 75,
    stats: { lan: 75, tf: 75, iq: 75, clu: 75, sta: 75, flx: 75, ldr: 75 },
    matchesPlayedThisWeek: 0,
    trainingProgress: { lan: 10 }
  };

  const bench = {
    id: 'p_bench',
    name: 'BenchPro',
    age: 21,
    ovr: 70,
    stats: { lan: 70, tf: 70, iq: 70, clu: 70, sta: 70, flx: 70, ldr: 70 },
    matchesPlayedThisWeek: 0,
    trainingProgress: { lan: 10 }
  };

  const regimen = { primaryFocus: 'lan', intensityPercent: 100, staminaSharePercent: 15 };
  const afterMatch = applyRealMatchTrainingImpact([starter, bench], ['p_starter'], regimen, coach, true);
  const updatedStarter = afterMatch.updatedRoster.find((p) => p.id === 'p_starter');
  const updatedBench = afterMatch.updatedRoster.find((p) => p.id === 'p_bench');

  assert.equal(updatedStarter.matchesPlayedThisWeek, 1);
  assert.ok(updatedStarter.trainingProgress.lan > 35);
  assert.equal(updatedBench.matchesPlayedThisWeek, 0);
  assert.equal(updatedBench.trainingProgress.lan, 10);
});

test('mapToMacroRegion and global circuit / friends catalogs cover ASIA, EUROPE, AFRICA, AMERICAS', () => {
  assert.equal(mapToMacroRegion('LCK'), 'ASIA');
  assert.equal(mapToMacroRegion('LEC'), 'EUROPE');
  assert.equal(mapToMacroRegion('Challengers'), 'AFRICA');
  assert.equal(mapToMacroRegion('LCS'), 'AMERICAS');

  assert.ok(INITIAL_THIRD_PARTY_CUPS.some((c) => c.name.includes('DreamLeague')));
  const friendRegions = new Set(INITIAL_FRIENDS.map((f) => f.region));
  assert.ok(friendRegions.has('ASIA'));
  assert.ok(friendRegions.has('EUROPE'));
  assert.ok(friendRegions.has('AFRICA'));
  assert.ok(friendRegions.has('AMERICAS'));
  assert.ok(INITIAL_FRIEND_CHALLENGES.length >= 2);
});
