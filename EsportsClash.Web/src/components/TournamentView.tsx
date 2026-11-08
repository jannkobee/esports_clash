// src/components/TournamentView.tsx
// Hexatrick-Style Annual Global Tournament Circuit (Real-Life Years: 2026 -> 2027+)
// 3 Official Annual Splits:
//   1. Opening Regionals -> Hexatrick Vanguard Cup
//   2. Spring Regionals  -> Hexatrick Summit Masters
//   3. Summer Regionals  -> Hexatrick Crown Championship (Most Prestigious Annual Championship)
// 4 Macro-Regions: ASIA, EUROPE, AFRICA, AMERICAS
// Infinite Million-Player Horizontal & Vertical Shard Scaling + Third-Party Cups (Beacon Circuit Style)

import React, { useState } from 'react';
import type {
  ClashCupBracket,
  InternationalEventKey,
  MacroRegion,
  MatchOrders,
  PlayerCard,
  RiotSplitKey,
  ScheduledFixture,
  SeriesDivision,
  SeriesDivisionTier,
  ThirdPartyCup
} from '../types';
import { MatchOrdersModal } from './MatchOrdersModal';
import { sound } from '../audio';
import {
  toScale10,
  DEFAULT_SERIES_DIVISIONS,
  INITIAL_CLASH_CUP,
  INITIAL_THIRD_PARTY_CUPS,
  simulateSeriesRound
} from '../marketBatchEngine';
import {
  Trophy,
  Calendar,
  Swords,
  Award,
  FastForward,
  CheckCircle2,
  ClipboardList,
  Clock,
  Crown,
  Flame,
  Shield,
  Globe,
  Layers,
  Gift,
  Coins,
  Sparkles
} from 'lucide-react';

interface TournamentViewProps {
  startingFive: PlayerCard[];
  bench?: PlayerCard[];
  onPlaySeriesMatch?: (opponentName: string) => void;
  onEarnFunds?: (amount: number, reason: string) => void;
  onClaimThirdPartyReward?: (rewardType: ThirdPartyCup['inGameRewardType'], label: string) => void;
}

const REGIONAL_CLUB_NAMES: Record<MacroRegion, string[]> = {
  ASIA: [
    'Seoul T1 Dynamos',
    'Gen.G Tiger Kings',
    'Shanghai Bilibili',
    'Busan Storm',
    'Tokyo Ronin',
    'Taipei Flash Hawks',
    'Saigon Whales'
  ],
  EUROPE: [
    'G2 Berlin Samurai',
    'FNATIC Orange',
    'Madrid Koi Armada',
    'Paris Karmine Corp',
    'Stockholm Blades',
    'Warsaw Vanguards',
    'London Monarchs'
  ],
  AFRICA: [
    'Cairo Pharaohs',
    'Lagos Cyber Lions',
    'Johannesburg Titans',
    'Casablanca Atlas',
    'Nairobi Savanna',
    'Tunis Carthaginians',
    'Accra Gold Stars'
  ],
  AMERICAS: [
    'Cloud9 Los Angeles',
    'Team Liquid Honda',
    'São Paulo LOUD',
    'Toronto Ultra Frost',
    'Santiago Condors',
    'Austin Outlaws',
    'Buenos Aires Kru'
  ]
};

const SPLIT_METADATA: Record<
  RiotSplitKey,
  {
    regionalTitle: string;
    internationalEvent: InternationalEventKey;
    internationalSubtitle: string;
    prizePoolCoins: number;
    prestigeBadge: string;
    monthsLabel: string;
  }
> = {
  opening: {
    regionalTitle: 'Opening Regionals',
    internationalEvent: 'Hexatrick Vanguard Cup',
    internationalSubtitle: 'Global Season Kickoff · Fearless Draft Showcase',
    prizePoolCoins: 12000,
    prestigeBadge: 'Hexatrick Vanguard Cup Vanguard Trophy',
    monthsLabel: 'Jan – Mar'
  },
  spring: {
    regionalTitle: 'Spring Regionals',
    internationalEvent: 'Hexatrick Summit Masters',
    internationalSubtitle: 'Mid-Season Invitational · Cross-Continental Clash',
    prizePoolCoins: 25000,
    prestigeBadge: 'Hexatrick Summit Masters Golden Crest',
    monthsLabel: 'Apr – Jun'
  },
  summer: {
    regionalTitle: 'Summer Regionals',
    internationalEvent: 'Hexatrick Crown Championship',
    internationalSubtitle: 'The Pinnacle of Global Esports · World Championship',
    prizePoolCoins: 60000,
    prestigeBadge: 'Hexatrick Crown Trophy (Most Prestigious)',
    monthsLabel: 'Jul – Nov'
  }
};

export const TournamentView: React.FC<TournamentViewProps> = ({
  startingFive,
  bench = [],
  onEarnFunds,
  onClaimThirdPartyReward
}) => {
  const [activeTab, setActiveTab] = useState<'regionals' | 'international' | 'third_party'>('regionals');
  const [ordersByFixture, setOrdersByFixture] = useState<Record<string, MatchOrders>>({});
  const [editingFixture, setEditingFixture] = useState<ScheduledFixture | null>(null);

  // Real-Life Calendar Year & Hexatrick Split State
  const [calendarYear, setCalendarYear] = useState<number>(2026);
  const [currentSplit, setCurrentSplit] = useState<RiotSplitKey>('opening');
  const [macroRegion, setMacroRegion] = useState<MacroRegion>('ASIA');
  const [activeShardId, setActiveShardId] = useState<number>(1);

  // Division state
  const [activeTier, setActiveTier] = useState<SeriesDivisionTier>('Series I');
  const [division, setDivision] = useState<SeriesDivision>(() => {
    const base = DEFAULT_SERIES_DIVISIONS['Series IV'];
    return {
      ...base,
      tier: 'Series I',
      title: 'ASIA · Opening Regionals',
      teams: base.teams.map((t, idx) =>
        t.isPlayer
          ? t
          : {
              ...t,
              name: REGIONAL_CLUB_NAMES.ASIA[idx - 1] || t.name
            }
      )
    };
  });

  // International Bracket State (Hexatrick Vanguard Cup / Hexatrick Summit Masters / Worlds)
  const [internationalBracket, setInternationalBracket] = useState<ClashCupBracket>(() => ({
    ...INITIAL_CLASH_CUP,
    season: 2026,
    prizePool: SPLIT_METADATA.opening.prizePoolCoins,
    matches: [
      {
        id: 'intl_m1',
        stageName: 'Round of 16',
        homeTeamName: 'Your Club (ASIA #1)',
        awayTeamName: 'Cairo Pharaohs (AFRICA #2)',
        isPlayerMatch: true,
        played: false
      },
      {
        id: 'intl_m2',
        stageName: 'Round of 16',
        homeTeamName: 'G2 Berlin Samurai (EUROPE #1)',
        awayTeamName: 'Cloud9 Los Angeles (AMERICAS #2)',
        played: false
      },
      {
        id: 'intl_m3',
        stageName: 'Round of 16',
        homeTeamName: 'Seoul T1 Dynamos (ASIA #2)',
        awayTeamName: 'FNATIC Orange (EUROPE #2)',
        played: false
      },
      {
        id: 'intl_m4',
        stageName: 'Round of 16',
        homeTeamName: 'Lagos Cyber Lions (AFRICA #1)',
        awayTeamName: 'São Paulo LOUD (AMERICAS #1)',
        played: false
      }
    ]
  }));

  // Third-Party Cups (Beacon Circuit Style)
  const [thirdPartyCups, setThirdPartyCups] = useState<ThirdPartyCup[]>(INITIAL_THIRD_PARTY_CUPS);
  const [claimedTrophies, setClaimedTrophies] = useState<string[]>([
    '2025 Regional Contenders Champion'
  ]);
  const [bannerNotice, setBannerNotice] = useState<string | null>(null);

  const splitInfo = SPLIT_METADATA[currentSplit];

  // Switch Macro-Region (updates regional opponent club names)
  const handleSelectRegion = (reg: MacroRegion) => {
    sound.playClick();
    setMacroRegion(reg);
    const clubList = REGIONAL_CLUB_NAMES[reg];
    setDivision((prev) => ({
      ...prev,
      teams: prev.teams.map((t, idx) =>
        t.isPlayer
          ? t
          : {
              ...t,
              name: clubList[(idx - 1) % clubList.length]
            }
      )
    }));
  };

  // Switch Hexatrick Split (Opening -> Spring -> Summer)
  const handleSelectSplit = (split: RiotSplitKey) => {
    sound.playClick();
    setCurrentSplit(split);
    const meta = SPLIT_METADATA[split];
    const clubList = REGIONAL_CLUB_NAMES[macroRegion];
    const base = DEFAULT_SERIES_DIVISIONS['Series IV'];
    setDivision({
      ...base,
      tier: activeTier,
      title: `${macroRegion} · ${meta.regionalTitle}`,
      teams: base.teams.map((t, idx) =>
        t.isPlayer ? t : { ...t, name: clubList[(idx - 1) % clubList.length] }
      )
    });
    setInternationalBracket({
      season: calendarYear,
      currentStage: 'Round of 16',
      prizePool: meta.prizePoolCoins,
      matches: [
        {
          id: 'intl_m1',
          stageName: 'Round of 16',
          homeTeamName: `Your Club (${macroRegion} #1)`,
          awayTeamName: 'Cairo Pharaohs (AFRICA #2)',
          isPlayerMatch: true,
          played: false
        },
        {
          id: 'intl_m2',
          stageName: 'Round of 16',
          homeTeamName: 'G2 Berlin Samurai (EUROPE #1)',
          awayTeamName: 'Cloud9 Los Angeles (AMERICAS #2)',
          played: false
        },
        {
          id: 'intl_m3',
          stageName: 'Round of 16',
          homeTeamName: 'Seoul T1 Dynamos (ASIA #1)',
          awayTeamName: 'FNATIC Orange (EUROPE #2)',
          played: false
        },
        {
          id: 'intl_m4',
          stageName: 'Round of 16',
          homeTeamName: 'Lagos Cyber Lions (AFRICA #1)',
          awayTeamName: 'São Paulo LOUD (AMERICAS #1)',
          played: false
        }
      ]
    });
    setBannerNotice(
      `📅 Switched to ${calendarYear} ${meta.regionalTitle} (Qualifies for ${meta.internationalEvent})!`
    );
    setTimeout(() => setBannerNotice(null), 4000);
  };

  // Sort teams by Points -> Wins -> Kill Diff
  const sortedTeams = [...division.teams].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.wins !== a.wins) return b.wins - a.wins;
    return b.kills - b.deaths - (a.kills - a.deaths);
  });

  const currentRoundFixtures = division.fixtures.filter((f) => f.round === division.currentRound);
  const playerFixture = currentRoundFixtures.find((f) => f.isPlayerMatch);

  const getTeamName = (id: string) => division.teams.find((t) => t.id === id)?.name || id;

  // Simulate current regional round
  const handleSimulateRegionalRound = () => {
    sound.playClick();
    const myOvr = Math.round(
      startingFive.reduce((acc, p) => acc + p.ovr, 0) / Math.max(1, startingFive.length)
    );
    const isWin = Math.random() < (myOvr >= 78 ? 0.72 : 0.55);

    const homeIsPlayer = playerFixture?.homeTeamId === 'my_club';
    const myKills = Math.round(14 + Math.random() * 10);
    const oppKills = isWin ? Math.max(3, myKills - Math.round(4 + Math.random() * 6)) : myKills + 5;

    const playerResult = playerFixture
      ? {
          homeKills: homeIsPlayer ? myKills : oppKills,
          awayKills: homeIsPlayer ? oppKills : myKills,
          winnerId: isWin
            ? 'my_club'
            : homeIsPlayer
            ? playerFixture.awayTeamId
            : playerFixture.homeTeamId
        }
      : undefined;

    const nextDivision = simulateSeriesRound(division, playerResult);
    setDivision(nextDivision);

    if (isWin) {
      sound.playWalkoutFanfare();
      onEarnFunds?.(950, `${calendarYear} ${macroRegion} ${splitInfo.regionalTitle} Match Win`);
      setBannerNotice(
        `🏆 ${macroRegion} ${splitInfo.regionalTitle} Round ${division.currentRound} Victory! +3 Points & +🪙 950 Match Prize.`
      );
    } else {
      setBannerNotice(
        `Round ${division.currentRound} Concluded: Tough loss in ${macroRegion} ${splitInfo.regionalTitle}.`
      );
    }
    setTimeout(() => setBannerNotice(null), 4500);
  };

  // Advance International Event Stage (Hexatrick Vanguard Cup / Hexatrick Summit Masters / Worlds)
  const handlePlayInternationalStage = () => {
    sound.playWalkoutFanfare();
    const updatedMatches = internationalBracket.matches.map((m) => {
      if (m.played) return m;
      const homeWins = m.isPlayerMatch ? true : Math.random() < 0.5;
      return {
        ...m,
        homeKills: homeWins ? 21 : 12,
        awayKills: homeWins ? 12 : 21,
        winnerName: homeWins ? m.homeTeamName : m.awayTeamName,
        played: true
      };
    });

    const winners = updatedMatches.map((m) => m.winnerName || m.homeTeamName);
    let nextStage: ClashCupBracket['currentStage'] = internationalBracket.currentStage;
    const nextStageMatches = [...updatedMatches];

    if (internationalBracket.currentStage === 'Round of 16') {
      nextStage = 'Semifinals';
      nextStageMatches.push(
        {
          id: `intl_sf_1_${Date.now()}`,
          stageName: 'Semifinals',
          homeTeamName: winners[0],
          awayTeamName: winners[1],
          isPlayerMatch: true,
          played: false
        },
        {
          id: `intl_sf_2_${Date.now()}`,
          stageName: 'Semifinals',
          homeTeamName: winners[2],
          awayTeamName: winners[3],
          played: false
        }
      );
      onEarnFunds?.(2500, `${splitInfo.internationalEvent} Semifinalist Bonus`);
      setBannerNotice(
        `🌍 Advanced to ${calendarYear} ${splitInfo.internationalEvent} Semifinals! +🪙 2,500 Stage Bonus.`
      );
    } else if (internationalBracket.currentStage === 'Semifinals') {
      nextStage = 'Grand Final';
      const sfMatches = updatedMatches.filter((m) => m.stageName === 'Semifinals');
      const sfWinners = sfMatches.map((m) => m.winnerName || m.homeTeamName);
      nextStageMatches.push({
        id: `intl_gf_${Date.now()}`,
        stageName: 'Grand Final',
        homeTeamName: sfWinners[0] || `Your Club (${macroRegion} #1)`,
        awayTeamName: sfWinners[1] || 'Seoul T1 Dynamos (ASIA #1)',
        isPlayerMatch: true,
        played: false
      });
      onEarnFunds?.(5000, `${splitInfo.internationalEvent} Grand Finalist Bonus`);
      setBannerNotice(
        `🔥 GRAND FINAL LOCKED: You reached the ${calendarYear} ${splitInfo.internationalEvent} Grand Final!`
      );
    } else if (internationalBracket.currentStage === 'Grand Final') {
      nextStage = 'Concluded';
      const trophyTitle = `${calendarYear} ${splitInfo.internationalEvent} Champion`;
      setClaimedTrophies((prev) => [trophyTitle, ...prev]);
      onEarnFunds?.(splitInfo.prizePoolCoins, trophyTitle);
      setBannerNotice(
        `👑 WORLD HISTORY MADE: You won the ${calendarYear} ${splitInfo.internationalEvent}! +🪙 ${splitInfo.prizePoolCoins.toLocaleString()} Championship Prize!`
      );
    }

    setInternationalBracket({
      ...internationalBracket,
      currentStage: nextStage,
      matches: nextStageMatches,
      champion: nextStage === 'Concluded' ? `Your Club (${macroRegion})` : undefined
    });
    setTimeout(() => setBannerNotice(null), 5500);
  };

  // Advance to Next Split or Next Real-Life Year (e.g. 2026 -> 2027)
  const handleAdvanceAnnualCalendar = () => {
    sound.playWalkoutFanfare();
    if (currentSplit === 'opening') {
      handleSelectSplit('spring');
    } else if (currentSplit === 'spring') {
      handleSelectSplit('summer');
    } else {
      const nextYear = calendarYear + 1;
      setCalendarYear(nextYear);
      setCurrentSplit('opening');
      setBannerNotice(
        `🎆 NEW REAL-LIFE SEASON STARTED: Welcome to Season ${nextYear} Opening Regionals!`
      );
      setTimeout(() => setBannerNotice(null), 5500);
    }
  };

  // Play a Round in a Third-Party Cup (Beacon Circuit / Northstar Series / Savannah / Cobalt)
  const handlePlayThirdPartyCupRound = (cup: ThirdPartyCup) => {
    sound.playWalkoutFanfare();
    setThirdPartyCups((prev) =>
      prev.map((c) => {
        if (c.id !== cup.id) return c;
        if (c.currentRound < c.maxRounds) {
          const nextRound = c.currentRound + 1;
          const nextStatus = nextRound === 2 ? 'Semifinals' : 'Grand Final';
          onEarnFunds?.(800, `${c.name} Stage Win`);
          setBannerNotice(
            `⚡ ${c.name}: Victory over ${c.nextOpponentName}! Advanced to ${nextStatus} (+🪙 800).`
          );
          return {
            ...c,
            currentRound: nextRound,
            status: nextStatus
          };
        } else {
          // Won the Third-Party Cup!
          onEarnFunds?.(c.prizePoolCoins, `${c.name} Champion Prize`);
          onClaimThirdPartyReward?.(c.inGameRewardType, c.inGameRewardLabel);
          setClaimedTrophies((t) => [`${calendarYear} ${c.name} Winner`, ...t]);
          setBannerNotice(
            `🏆 ${c.name} CHAMPION! Earned +🪙 ${c.prizePoolCoins.toLocaleString()} Coins & Unlocked Reward: ${c.inGameRewardLabel}!`
          );
          return {
            ...c,
            status: 'Completed',
            claimed: true
          };
        }
      })
    );
    setTimeout(() => setBannerNotice(null), 5500);
  };

  return (
    <div className="space-y-4">
      {/* RIOT ANNUAL GLOBAL CIRCUIT CALENDAR BAR */}
      <div className="cm-panel">
        <div className="cm-panel-header">
          <span className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-amber-400" />
            <span>
              Global Esports Circuit · Season {calendarYear} ({splitInfo.monthsLabel}) · {macroRegion} Region
            </span>
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <span className="cm-badge cm-badge-gold">Season {calendarYear}</span>
            <span className="cm-badge cm-badge-blue">{macroRegion} Macro-Region</span>
            <span className="cm-badge cm-badge-green">
              Shard #{activeShardId} · 1,248,640 Global Clubs
            </span>
          </div>
        </div>

        <div className="cm-panel-body space-y-4">
          {/* 3 Annual Hexatrick Splits Timeline */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {(['opening', 'spring', 'summer'] as RiotSplitKey[]).map((splitKey, idx) => {
              const meta = SPLIT_METADATA[splitKey];
              const isCurrent = currentSplit === splitKey;
              const isWorlds = splitKey === 'summer';
              return (
                <button
                  type="button"
                  key={splitKey}
                  onClick={() => handleSelectSplit(splitKey)}
                  className={`p-3.5 rounded-xl border text-left transition flex flex-col justify-between ${
                    isCurrent
                      ? isWorlds
                        ? 'bg-amber-500/15 border-2 border-amber-400 shadow-lg shadow-amber-500/10'
                        : 'bg-emerald-500/15 border-2 border-emerald-400 shadow-lg shadow-emerald-500/10'
                      : 'bg-[#0f172a] border-white/10 hover:border-white/25'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Split {idx + 1} · {calendarYear} ({meta.monthsLabel})
                      </span>
                      {isWorlds ? (
                        <span className="cm-badge cm-badge-gold text-[10px]">👑 MOST PRESTIGIOUS</span>
                      ) : isCurrent ? (
                        <span className="cm-badge cm-badge-green text-[10px]">ACTIVE SPLIT</span>
                      ) : null}
                    </div>
                    <div className="text-sm font-black text-white">
                      {meta.regionalTitle} ➔ {meta.internationalEvent}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">{meta.internationalSubtitle}</p>
                  </div>
                  <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between text-[11px]">
                    <span className="text-slate-300 font-bold">{meta.prestigeBadge}</span>
                    <span className="font-mono font-bold text-amber-400">
                      🪙 {meta.prizePoolCoins.toLocaleString()}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* 4 Real-World Macro-Regions & Million-Player Shard Selector */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0f172a] border border-white/10 rounded-xl p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-300 mr-1">Macro-Region:</span>
              {(['ASIA', 'EUROPE', 'AFRICA', 'AMERICAS'] as MacroRegion[]).map((reg) => (
                <button
                  type="button"
                  key={reg}
                  onClick={() => handleSelectRegion(reg)}
                  className={`cm-btn py-1 px-3 text-xs ${macroRegion === reg ? 'cm-btn-primary' : ''}`}
                >
                  <Globe className="w-3 h-3" />
                  <span>{reg}</span>
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Layers className="w-3.5 h-3.5 text-sky-400" />
              <span className="text-slate-300 font-bold">Scaling Division Shard:</span>
              <select
                value={activeTier}
                onChange={(e) => {
                  const nextTier = e.target.value as SeriesDivisionTier;
                  setActiveTier(nextTier);
                  setActiveShardId(nextTier === 'Series I' ? 1 : nextTier === 'Series II' ? 14 : 420);
                }}
                className="cm-select text-xs"
              >
                <option value="Series I">Tier 1 · Regional Premier (Shard #1 · Top 8 Clubs)</option>
                <option value="Series II">Tier 2 · Regional Challengers (16 Shards · 128 Clubs)</option>
                <option value="Series III">Tier 3 · Regional Contenders (256 Shards · 2,048 Clubs)</option>
                <option value="Series IV">Tier 4 · Open Circuit Shards (38,500 Shards · 1.2M+ Clubs)</option>
              </select>

              <button
                type="button"
                onClick={handleAdvanceAnnualCalendar}
                className="cm-btn py-1 px-2.5 text-xs"
                title="Advance to the next Split or next Real-Life Year"
              >
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                <span>Next Split / Year ({calendarYear}) ▸</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {bannerNotice && (
        <div className="bg-emerald-500/15 border border-emerald-500/40 rounded-xl p-3 text-xs font-bold text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{bannerNotice}</span>
        </div>
      )}

      {/* Sub-Tabs */}
      <div className="cm-tabs">
        <button
          type="button"
          onClick={() => {
            sound.playClick();
            setActiveTab('regionals');
          }}
          className={`cm-tab ${activeTab === 'regionals' ? 'active' : ''}`}
        >
          <Shield className="w-3.5 h-3.5 inline mr-1.5" />
          {macroRegion} {splitInfo.regionalTitle} ({calendarYear})
        </button>

        <button
          type="button"
          onClick={() => {
            sound.playClick();
            setActiveTab('international');
          }}
          className={`cm-tab ${activeTab === 'international' ? 'active' : ''}`}
        >
          <Crown className="w-3.5 h-3.5 inline mr-1.5" />
          {splitInfo.internationalEvent} Bracket
        </button>

        <button
          type="button"
          onClick={() => {
            sound.playClick();
            setActiveTab('third_party');
          }}
          className={`cm-tab ${activeTab === 'third_party' ? 'active' : ''}`}
        >
          <Gift className="w-3.5 h-3.5 inline mr-1.5" />
          Third-Party Cups (Beacon Circuit &amp; Majors)
        </button>
      </div>

      {/* =========================================================
          TAB 1: REGIONAL SPLIT STANDINGS & SHARD SCALING
         ========================================================= */}
      {activeTab === 'regionals' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Regional Standings Table */}
          <div className="cm-panel lg:col-span-2">
            <div className="cm-panel-header">
              <span>
                {calendarYear} {macroRegion} {splitInfo.regionalTitle} · Shard #{activeShardId} Standings
              </span>
              <span className="cm-badge cm-badge-gold">
                Top 2 Qualify for {splitInfo.internationalEvent}
              </span>
            </div>

            <div className="cm-panel-body p-0">
              <div className="cm-table-wrap border-0">
                <table className="cm-table">
                  <thead>
                    <tr>
                      <th>Pos</th>
                      <th>Club</th>
                      <th>Region</th>
                      <th>Rating</th>
                      <th>W</th>
                      <th>L</th>
                      <th>K / D</th>
                      <th>Pts</th>
                      <th>Qualification Zone</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedTeams.map((team, idx) => {
                      const pos = idx + 1;
                      const isQualifier = pos <= 2;
                      const isRelegation = pos >= 7;

                      return (
                        <tr key={team.id} className={team.isPlayer ? 'cm-row-highlight' : ''}>
                          <td className="font-mono font-black">{pos}</td>
                          <td className="font-bold text-white">
                            {team.name}
                            {team.isPlayer && (
                              <span className="ml-1.5 cm-badge cm-badge-green text-[10px]">YOU</span>
                            )}
                          </td>
                          <td>
                            <span className="cm-badge cm-badge-blue">{macroRegion}</span>
                          </td>
                          <td className="font-mono font-bold text-emerald-400">
                            {toScale10(team.avgOvr)}/10
                          </td>
                          <td className="font-mono font-bold text-emerald-400">{team.wins}</td>
                          <td className="font-mono text-rose-400">{team.losses}</td>
                          <td className="font-mono text-xs">
                            {team.kills} / {team.deaths}
                          </td>
                          <td className="font-mono font-black text-amber-300">{team.points}</td>
                          <td>
                            {isQualifier ? (
                              <span className="cm-badge cm-badge-gold text-[10px]">
                                ✈️ {splitInfo.internationalEvent} Seed
                              </span>
                            ) : isRelegation ? (
                              <span className="cm-badge cm-badge-red text-[10px]">▼ Shard Relegation</span>
                            ) : (
                              <span className="text-[11px] text-slate-400">Regional Playoffs</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right Column: Scheduled Round Fixtures, Match Orders & Infinite Scaling */}
          <div className="space-y-4">
            <div className="cm-panel">
              <div className="cm-panel-header">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                  <span>
                    Round {division.currentRound} of {division.maxRounds} · Scheduled Kickoff
                  </span>
                </span>
                <span className="cm-badge cm-badge-gold text-[10px]">Sat 18:00 UTC</span>
              </div>
              <div className="cm-panel-body space-y-2.5 text-xs">
                <div className="bg-[#0f172a] border border-emerald-500/30 rounded-lg p-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Scheduled: Saturday 18:00 UTC (Bo3 Series)</span>
                  </div>
                  <span className="text-[11px] font-mono text-amber-300 font-bold">⏳ In 02h 14m</span>
                </div>

                {currentRoundFixtures.map((fix) => (
                  <div
                    key={fix.id}
                    className={`p-2.5 rounded-xl border flex items-center justify-between ${
                      fix.isPlayerMatch
                        ? 'bg-emerald-500/15 border-emerald-500/50 font-bold'
                        : 'bg-[#0f172a] border-white/10'
                    }`}
                  >
                    <span className="truncate max-w-[115px] text-white">{getTeamName(fix.homeTeamId)}</span>
                    <span className="px-2 py-0.5 bg-slate-800 text-amber-400 font-mono text-[10px] rounded">
                      Bo3
                    </span>
                    <span className="truncate max-w-[115px] text-right text-white">
                      {getTeamName(fix.awayTeamId)}
                    </span>
                  </div>
                ))}

                {playerFixture && (() => {
                  const oppId =
                    playerFixture.homeTeamId === 'my_club'
                      ? playerFixture.awayTeamId
                      : playerFixture.homeTeamId;
                  const oppName = getTeamName(oppId);
                  const fixKey = `reg_${currentSplit}_${division.currentRound}`;
                  const savedOrd = ordersByFixture[fixKey];

                  return (
                    <div className="pt-2 space-y-2">
                      <div className="p-2 rounded-lg bg-[#0f172a] border border-white/10 flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">Match Orders Status:</span>
                        {savedOrd ? (
                          <span className="font-bold text-emerald-400">
                            ✓ {savedOrd.attitude.toUpperCase()} · {savedOrd.doctrine.replace('_', ' ')}
                          </span>
                        ) : (
                          <span className="font-bold text-amber-400">⚠️ Default Orders (Not Customized)</span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          sound.playClick();
                          setEditingFixture({
                            id: fixKey,
                            competitionId: currentSplit,
                            competitionName: `${calendarYear} ${macroRegion} ${splitInfo.regionalTitle}`,
                            competitionType: 'regional_split',
                            roundLabel: `Round ${division.currentRound} of ${division.maxRounds}`,
                            opponentName: oppName,
                            opponentRegion: macroRegion,
                            opponentRating10: 8,
                            seriesFormat: 'Bo3',
                            scheduledTimeLabel: 'Saturday 18:00 UTC',
                            countdownLabel: 'Kickoff in 02h 14m',
                            prizeCoins: 950
                          });
                        }}
                        className="cm-btn cm-btn-primary w-full py-2 text-xs font-bold"
                      >
                        <ClipboardList className="w-3.5 h-3.5" />
                        <span>📋 Set Match Orders vs {oppName} (Bo3) ▸</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleSimulateRegionalRound}
                        className="cm-btn w-full py-2 text-xs"
                        title="Advance to the scheduled Saturday 18:00 UTC kickoff and resolve the round using your Match Orders"
                      >
                        <FastForward className="w-3.5 h-3.5" />
                        <span>⏱️ Simulate Scheduled Kickoff (Round {division.currentRound})</span>
                      </button>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Million-Player Scaling Architecture Info */}
            <div className="cm-panel">
              <div className="cm-panel-header">
                <span>Million-Player Shard Scaling Engine</span>
              </div>
              <div className="cm-panel-body space-y-2 text-xs text-slate-300">
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Each Macro-Region (<strong>ASIA, EUROPE, AFRICA, AMERICAS</strong>) scales horizontally via
                  automated 8-club Hattrick shards so millions of clubs compete simultaneously:
                </p>
                <div className="space-y-1 text-[11px]">
                  <div className="flex justify-between">
                    <span>• Tier 1 Regional Premier:</span>
                    <strong className="text-amber-400">1 Shard (Qualifies for {splitInfo.internationalEvent})</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>• Tier 2 Challengers:</span>
                    <strong className="text-emerald-400">16 Shards (128 Clubs / Region)</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>• Tier 3 Contenders:</span>
                    <strong className="text-sky-400">256 Shards (2,048 Clubs / Region)</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>• Tier 4+ Open Shards:</span>
                    <strong className="text-purple-400">Dynamic Auto-Spawn (1,000,000+ Clubs)</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          TAB 2: INTERNATIONAL EVENT (FIRST STAND / Hexatrick Summit Masters / WORLDS)
         ========================================================= */}
      {activeTab === 'international' && (
        <div className="space-y-4">
          <div className="cm-panel">
            <div className="cm-panel-header">
              <span className="flex items-center gap-2">
                <Crown className="w-4 h-4 text-amber-400" />
                <span>
                  {calendarYear} {splitInfo.internationalEvent} · Cross-Regional Championship Bracket
                </span>
              </span>
              <span className="cm-badge cm-badge-gold">
                Prize Pool: 🪙 {splitInfo.prizePoolCoins.toLocaleString()} Coins
              </span>
            </div>

            <div className="cm-panel-body flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-black text-white">
                  {calendarYear} {splitInfo.internationalEvent} — ASIA vs EUROPE vs AFRICA vs AMERICAS
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {splitInfo.internationalSubtitle}. Scheduled Kickoff:{' '}
                  <strong className="text-emerald-400">Sunday 20:00 UTC (Bo5 Series)</strong> · Trophy:{' '}
                  <strong className="text-amber-300">{splitInfo.prestigeBadge}</strong>!
                </p>
              </div>

              {internationalBracket.currentStage !== 'Concluded' ? (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      sound.playClick();
                      const playerMatch = internationalBracket.matches.find((m) => m.isPlayerMatch && !m.played);
                      const oppName = playerMatch?.awayTeamName || 'International Qualifier';
                      setEditingFixture({
                        id: `intl_${currentSplit}_${internationalBracket.currentStage}`,
                        competitionId: splitInfo.internationalEvent,
                        competitionName: `${calendarYear} ${splitInfo.internationalEvent}`,
                        competitionType: 'international',
                        roundLabel: `${internationalBracket.currentStage} (Bo5)`,
                        opponentName: oppName,
                        opponentRegion: 'EUROPE',
                        opponentRating10: 9,
                        seriesFormat: 'Bo5',
                        scheduledTimeLabel: 'Sunday 20:00 UTC',
                        countdownLabel: 'Kickoff in 1d 04h',
                        prizeCoins: splitInfo.prizePoolCoins
                      });
                    }}
                    className="cm-btn py-2 px-3.5 text-xs font-bold"
                  >
                    <ClipboardList className="w-4 h-4 text-emerald-400" />
                    <span>📋 Set Match Orders (Bo5)</span>
                  </button>
                  <button
                    type="button"
                    onClick={handlePlayInternationalStage}
                    className="cm-btn cm-btn-primary py-2 px-4 text-xs"
                  >
                    <Flame className="w-4 h-4" />
                    <span>⏱️ Simulate Scheduled {internationalBracket.currentStage} Kickoff ▸</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleAdvanceAnnualCalendar}
                  className="cm-btn cm-btn-primary py-2 px-4 text-xs"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Advance Calendar to Next Split / Year ▸</span>
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {internationalBracket.matches.map((m) => (
              <div
                key={m.id}
                className={`p-3.5 rounded-xl border text-xs space-y-2 ${
                  m.isPlayerMatch
                    ? 'bg-amber-500/10 border-2 border-amber-400/60'
                    : 'bg-[#0f172a] border-white/10'
                }`}
              >
                <div className="flex justify-between items-center text-[10px] font-bold uppercase text-slate-400">
                  <span>
                    {calendarYear} {splitInfo.internationalEvent} · {m.stageName} (Bo5)
                  </span>
                  {m.played ? (
                    <span className="cm-badge cm-badge-green">FINAL</span>
                  ) : (
                    <span className="cm-badge cm-badge-gold">SCHEDULED · SUN 20:00 UTC</span>
                  )}
                </div>

                <div className="flex justify-between items-center py-1.5 border-b border-white/10">
                  <span
                    className={`font-bold ${
                      m.winnerName === m.homeTeamName ? 'text-emerald-400 font-black' : 'text-white'
                    }`}
                  >
                    {m.homeTeamName}
                  </span>
                  <span className="font-mono font-bold text-amber-300">{m.played ? m.homeKills : '—'}</span>
                </div>

                <div className="flex justify-between items-center py-1">
                  <span
                    className={`font-bold ${
                      m.winnerName === m.awayTeamName ? 'text-emerald-400 font-black' : 'text-white'
                    }`}
                  >
                    {m.awayTeamName}
                  </span>
                  <span className="font-mono font-bold text-amber-300">{m.played ? m.awayKills : '—'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================
          TAB 3: THIRD-PARTY CUPS (DREAMLEAGUE STYLE)
         ========================================================= */}
      {activeTab === 'third_party' && (
        <div className="space-y-4">
          <div className="cm-panel">
            <div className="cm-panel-header">
              <span className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-emerald-400" />
                <span>Third-Party Global Cups &amp; Invitationals (Beacon Circuit / Northstar Series / Cobalt)</span>
              </span>
              <span className="cm-badge cm-badge-green">Midweek Scheduled Cups · Wed 19:00 UTC</span>
            </div>
            <div className="cm-panel-body text-xs text-slate-300">
              Alongside the official Hexatrick circuit (<strong>Hexatrick Vanguard Cup, Hexatrick Summit Masters, Hexatrick Crown Championship</strong>), your club
              can enter scheduled midweek third-party tournaments like <strong>Beacon Circuit</strong>. Set your{' '}
              <strong>Match Orders</strong> before Wednesday 19:00 UTC kickoff to compete for{' '}
              <strong>Club Treasury Prize Pools</strong> and <strong>In-Game Training &amp; Scouting Rewards</strong>!
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {thirdPartyCups.map((cup) => {
              const cupFixId = `cup_${cup.id}_r${cup.currentRound}`;
              const savedCupOrd = ordersByFixture[cupFixId];
              return (
                <div
                  key={cup.id}
                  className="cm-panel flex flex-col justify-between"
                >
                  <div className="cm-panel-header">
                    <span>
                      {cup.name} ({cup.organizer})
                    </span>
                    <span className="cm-badge cm-badge-gold">{cup.tierLabel} · Wed 19:00 UTC</span>
                  </div>

                  <div className="cm-panel-body space-y-3 text-xs flex-1 flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between bg-[#0f172a] border border-white/10 rounded-lg p-2.5">
                        <div>
                          <div className="text-[10px] uppercase font-bold text-slate-400">Champion Prize Money</div>
                          <div className="text-base font-black font-mono text-amber-400">
                            🪙 {cup.prizePoolCoins.toLocaleString()} Coins
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] uppercase font-bold text-slate-400">Scheduled Stage</div>
                          <div className="text-xs font-bold text-emerald-400">
                            {cup.status} (Round {cup.currentRound}/{cup.maxRounds} · Bo3)
                          </div>
                        </div>
                      </div>

                      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-2.5">
                        <div className="text-[10px] font-bold uppercase text-emerald-400 flex items-center gap-1">
                          <Gift className="w-3.5 h-3.5" />
                          <span>Winner In-Game Reward Bonus:</span>
                        </div>
                        <div className="text-xs font-bold text-white mt-0.5">{cup.inGameRewardLabel}</div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-300 pt-1">
                        <span>
                          Scheduled Opponent: <strong className="text-white">{cup.nextOpponentName}</strong> (
                          {cup.nextOpponentRegion})
                        </span>
                        <span className="cm-badge cm-badge-blue">{cup.nextOpponentOvr}/10 Rating</span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] bg-[#0f172a] border border-white/10 rounded px-2.5 py-1.5">
                        <span className="text-slate-400">Match Orders:</span>
                        {savedCupOrd ? (
                          <span className="font-bold text-emerald-400">
                            ✓ {savedCupOrd.attitude.toUpperCase()} · {savedCupOrd.doctrine.replace('_', ' ')}
                          </span>
                        ) : (
                          <span className="font-bold text-amber-400">⚠️ Default Orders</span>
                        )}
                      </div>
                    </div>

                    {cup.status !== 'Completed' ? (
                      <div className="flex gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            sound.playClick();
                            setEditingFixture({
                              id: cupFixId,
                              competitionId: cup.id,
                              competitionName: cup.name,
                              competitionType: 'third_party',
                              roundLabel: `${cup.status} (Round ${cup.currentRound}/${cup.maxRounds})`,
                              opponentName: cup.nextOpponentName,
                              opponentRegion: cup.nextOpponentRegion,
                              opponentRating10: cup.nextOpponentOvr,
                              seriesFormat: 'Bo3',
                              scheduledTimeLabel: 'Wednesday 19:00 UTC',
                              countdownLabel: 'Kickoff in 18h 30m',
                              prizeCoins: cup.prizePoolCoins
                            });
                          }}
                          className="cm-btn flex-1 py-2 text-xs font-bold"
                        >
                          <ClipboardList className="w-3.5 h-3.5 text-emerald-400" />
                          <span>📋 Set Match Orders</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePlayThirdPartyCupRound(cup)}
                          className="cm-btn cm-btn-primary flex-1 py-2 text-xs"
                        >
                          <Clock className="w-3.5 h-3.5" />
                          <span>⏱️ Simulate Kickoff ▸</span>
                        </button>
                      </div>
                    ) : (
                      <div className="py-2 px-3 bg-emerald-500/20 border border-emerald-500/40 rounded-lg text-center font-bold text-emerald-300">
                        🏆 Champion Crowned · Prize &amp; In-Game Reward Claimed!
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Club Trophy Cabinet */}
          {claimedTrophies.length > 0 && (
            <div className="cm-panel">
              <div className="cm-panel-header">
                <span>Club Trophy Cabinet &amp; Honors</span>
                <span className="cm-badge cm-badge-gold">{claimedTrophies.length} Trophies</span>
              </div>
              <div className="cm-panel-body flex flex-wrap gap-2">
                {claimedTrophies.map((t, i) => (
                  <span key={i} className="cm-badge cm-badge-gold py-1 px-3 text-xs">
                    🏆 {t}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Match Orders Modal */}
      {editingFixture && (
        <MatchOrdersModal
          fixture={editingFixture}
          startingFive={startingFive}
          bench={bench}
          existingOrders={ordersByFixture[editingFixture.id]}
          onSaveOrders={(orders) => {
            setOrdersByFixture((prev) => ({ ...prev, [editingFixture.id]: orders }));
            setBannerNotice(
              `📋 Match Orders submitted for ${editingFixture.competitionName} vs ${editingFixture.opponentName} (${orders.attitude.toUpperCase()} · ${orders.doctrine.replace('_', ' ')})!`
            );
            setTimeout(() => setBannerNotice(null), 4500);
          }}
          onClose={() => setEditingFixture(null)}
        />
      )}
    </div>
  );
};
