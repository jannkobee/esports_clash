import React, { useEffect, useState } from 'react';
import { 
  CHAMPIONS, 
  INITIAL_COACHES, 
  INITIAL_EVOLUTIONS, 
  INITIAL_FACILITIES, 
  INITIAL_PLAYERS 
} from './mockData';
import { ChampionKit, CoachCard, EvolutionPlan, Facility, PlayerCard, TournamentTeam } from './types';
import { PackOpeningModal } from './components/PackOpeningModal';
import { EvolutionsView } from './components/EvolutionsView';
import { SquadView } from './components/SquadView';
import { DraftPhaseView } from './components/DraftPhaseView';
import { ArenaMatchView } from './components/ArenaMatchView';
import { ThreeAramArena } from './components/ThreeAramArena';
import { TeamfightArenaView } from './components/TeamfightArenaView';
import { AramMatchView } from './components/AramMatchView';
import type { MatchReport } from './matchReplay';
import { rerollAfterBalanceGame } from './matchReplay';
import type { OnlineRoom, OnlineSession } from './onlineRooms';
import { createOnlineRoom, getOnlineRoom, joinOnlineRoom, submitOnlineDraft } from './onlineRooms';
import { ChampionHubView } from './components/ChampionHubView';
import { TournamentView } from './components/TournamentView';
import { ProCircuitView } from './components/ProCircuitView';
import { PRO_TEAMS_DATABASE, type ProTeam } from './proTeamsDatabase';
import { RankedLadderView } from './components/RankedLadderView';
import { 
  LadderProfile, 
  LadderEntry, 
  LadderMatchRecord,
  loadLadderProfile, 
  saveLadderProfile, 
  calculateEloDelta, 
  getChessRank, 
  ladderOpponentToProTeam 
} from './ladderRating';
import {
  createEqualizedRoster,
  EQUALIZED_COACH_BLUE,
  EQUALIZED_COACH_RED,
  getEqualizedPlayerPool
} from './equalizedMode';
import { PlayerDraftPhaseView } from './components/PlayerDraftPhaseView';
import { createDevRandomMatch } from './devRandomMode';
import { sound } from './audio';
import { settlePackPurchase } from './packEconomy';
import { 
  Tv, 
  Coins, 
  Users, 
  Zap, 
  Swords, 
  Trophy, 
  Package,
  Layers,
  Globe,
  FlaskConical,
  Volume2,
  VolumeX
} from 'lucide-react';

type ArenaChoice = 'ai' | 'equalized_ai' | 'dev_random' | 'online' | null;

export interface PackConfig {
  id: string;
  name: string;
  cost: number;
  count: number;
  description: string;
  category: 'all' | 'starter' | 'role' | 'elite';
  badge?: string;
  badgeColor?: string;
  roleFilter?: 'Marksman' | 'Mage' | 'Tank';
  tierFilter?: 'Rookie' | 'Pro' | 'GOAT';
  icon: string;
}

export const PACK_CATALOG: PackConfig[] = [
  {
    id: 'pack_rookie',
    name: 'Rookie Talent Scout',
    cost: 250,
    count: 3,
    description: '3 Rising talents. High Bronze/Silver rate with 20% Gold upgrade chance. Perfect for early Evolutions.',
    category: 'starter',
    tierFilter: 'Rookie',
    icon: '🥉'
  },
  {
    id: 'pack_marksman',
    name: 'Marksmen & Snipers Pack',
    cost: 600,
    count: 3,
    description: '3 Dedicated carrying marksmen (e.g. Daft, Ouzi, M0cke, LastArrow) with high AD and carry potential.',
    category: 'role',
    roleFilter: 'Marksman',
    icon: '🏹'
  },
  {
    id: 'pack_midlane',
    name: 'Midlane Wizards & Assassins',
    cost: 600,
    count: 3,
    description: '3 Burst mages and playmaking assassins (e.g. Flaker, Craps, Fisha, Kage) with high clutch rating.',
    category: 'role',
    roleFilter: 'Mage',
    icon: '🔮'
  },
  {
    id: 'pack_frontline',
    name: 'Frontline Titans & Wardens',
    cost: 600,
    count: 3,
    description: '3 Unyielding tanks, brawlers and frontline protectors (e.g. TheSpicy, Spl1t, BigTail, SneakBro).',
    category: 'role',
    roleFilter: 'Tank',
    icon: '🛡️'
  },
  {
    id: 'pack_pro',
    name: 'Continental Pro Pack',
    cost: 900,
    count: 4,
    description: '4 Seasoned esports stars from across all positions. Guaranteed 1+ Gold with 35% Platinum chance.',
    category: 'elite',
    tierFilter: 'Pro',
    badge: 'Popular',
    badgeColor: 'bg-amber-400 text-slate-950',
    icon: '🥇'
  },
  {
    id: 'pack_goat',
    name: 'World Championship GOAT Pack',
    cost: 1800,
    count: 5,
    description: '5 Legendary esports immortals. Guaranteed Platinum+ with highest Diamond and GOAT odds (Flaker, p1mple, Zypoo).',
    category: 'elite',
    tierFilter: 'GOAT',
    badge: 'GOAT Tier',
    badgeColor: 'bg-gradient-to-r from-pink-500 to-amber-400 text-white',
    icon: '👑'
  }
];

export function App() {
  // Navigation
  const [activeTab, setActiveTab] = useState<'squad' | 'packs' | 'evolutions' | 'arena' | 'ladder' | 'tournament' | 'champions' | 'pro_circuit'>('squad');
  const [musicEnabled, setMusicEnabled] = useState(() => sound.isMusicEnabled());
  const [selectedOpponentTeam, setSelectedOpponentTeam] = useState<ProTeam | null>(() => PRO_TEAMS_DATABASE[0] ?? null);
  const [inBattle, setInBattle] = useState<boolean>(false);
  const [arenaChoice, setArenaChoice] = useState<ArenaChoice>(() =>
    sessionStorage.getItem('esports-clash-online-session') ? 'online' : null);
  const [draftSeed, setDraftSeed] = useState(0);
  const rivalCoach = INITIAL_COACHES[draftSeed % INITIAL_COACHES.length];
  const [equalizedBlueRoster, setEqualizedBlueRoster] = useState<PlayerCard[]>(() => createEqualizedRoster('blue'));
  const [equalizedRedRoster, setEqualizedRedRoster] = useState<PlayerCard[]>(() => createEqualizedRoster('red'));
  const [equalizedDraftStage, setEqualizedDraftStage] = useState<'player_draft' | 'avatar_draft'>('player_draft');

  // Chess-Style Ranked Ladder State (Starts at 300 Rating)
  const [ladderProfile, setLadderProfile] = useState<LadderProfile>(loadLadderProfile);
  const [activeRankedOpponent, setActiveRankedOpponent] = useState<LadderEntry | null>(null);
  const [ladderResultModal, setLadderResultModal] = useState<{
    isOpen: boolean;
    result: 'win' | 'loss';
    delta: number;
    oldRating: number;
    newRating: number;
    oldTier: string;
    newTier: string;
    promoted: boolean;
    demoted: boolean;
    opponentName: string;
  } | null>(null);
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [onlineSession, setOnlineSession] = useState<OnlineSession | null>(() => {
    try { return JSON.parse(sessionStorage.getItem('esports-clash-online-session') || 'null') as OnlineSession | null; }
    catch { return null; }
  });
  const [onlineRoom, setOnlineRoom] = useState<OnlineRoom | null>(null);
  const [onlineError, setOnlineError] = useState('');
  const [onlineBusy, setOnlineBusy] = useState(false);

  // Club Resources
  const [teamFunds, setTeamFunds] = useState<number>(3500);
  const [adsWatched, setAdsWatched] = useState<number>(0);

  // Roster State
  const [roster, setRoster] = useState<PlayerCard[]>(INITIAL_PLAYERS);
  const [startingFive, setStartingFive] = useState<PlayerCard[]>(INITIAL_PLAYERS.slice(0, 5));
  const [currentCoach] = useState<CoachCard>(INITIAL_COACHES[0]);

  // Facilities & Evolutions
  const [facilities, setFacilities] = useState<Facility[]>(INITIAL_FACILITIES);
  const [evolutionPlans] = useState<EvolutionPlan[]>(INITIAL_EVOLUTIONS);
  const [activeEvolutions, setActiveEvolutions] = useState<{ [cardId: string]: { planId: string; progress: number[] } }>({});

  // Gacha Modal
  const [packModal, setPackModal] = useState<{ open: boolean; name: string; cards: PlayerCard[]; duplicateUpgrades: number; spentCoins: number; balanceAfter: number } | null>(null);

  // Tournament Split State
  const currentLeague = 'Regional Challenger Split';
  const [round, setRound] = useState<number>(1);
  const maxRounds = 6;
  const [standings, setStandings] = useState<TournamentTeam[]>([
    { name: 'T-Chibi Squad', roster: INITIAL_PLAYERS.slice(0, 5), wins: 2, losses: 0, points: 6, avgOvr: 94, isPlayer: true },
    { name: 'Baby-G2 Esports', roster: [], wins: 1, losses: 1, points: 3, avgOvr: 90 },
    { name: 'Mini-Fnatic', roster: [], wins: 1, losses: 1, points: 3, avgOvr: 89 },
    { name: 'Cloud9 Pups', roster: [], wins: 0, losses: 2, points: 0, avgOvr: 87 }
  ]);

  // Active Drafted Lineups
  const [draftedBlue, setDraftedBlue] = useState<{ player: PlayerCard; champion: ChampionKit }[]>([]);
  const [draftedRed, setDraftedRed] = useState<{ player: PlayerCard; champion: ChampionKit }[]>([]);
  const [matchSeed, setMatchSeed] = useState(0);
  const [replayNumber, setReplayNumber] = useState(0);
  const [balanceRunsLeft, setBalanceRunsLeft] = useState(0);
  const [balanceBatchId, setBalanceBatchId] = useState(0);
  const [replayDraft, setReplayDraft] = useState<MatchReport['draft'] | null>(null);
  const savedReports = (() => {
    try { return JSON.parse(localStorage.getItem('esports-clash-match-reports') || '[]') as MatchReport[]; }
    catch { return []; }
  })();
  const balanceSwapped = balanceRunsLeft > 0 && balanceRunsLeft % 2 === 0;
  const openRecordedMatch = (report: MatchReport) => {
    if (report.version !== 1 || !Number.isInteger(report.seed) || report.draft?.blue?.length !== 5 || report.draft?.red?.length !== 5) return;
    setDraftedBlue(report.draft.blue);
    setDraftedRed(report.draft.red);
    setReplayDraft(report.draft);
    setMatchSeed(report.seed);
    setReplayNumber(1);
    setBalanceRunsLeft(0);
    setBalanceBatchId(0);
    setInBattle(true);
  };

  const bench = roster.filter((p) => !startingFive.some((s) => s.id === p.id));

  useEffect(() => {
    if (!onlineSession) return;
    let stopped = false;
    const refresh = async () => {
      try {
        const room = await getOnlineRoom(onlineSession);
        if (!stopped) { setOnlineRoom(room); setOnlineError(''); }
      } catch (error) { if (!stopped) setOnlineError((error as Error).message); }
    };
    void refresh();
    const timer = window.setInterval(refresh, 1200);
    return () => { stopped = true; window.clearInterval(timer); };
  }, [onlineSession]);

  const [onlineMatchType, setOnlineMatchType] = useState<'ranked' | 'normal'>('ranked');
  const [useEqualizedRoster, setUseEqualizedRoster] = useState<boolean>(false);

  const beginOnline = async (code?: string, matchType: 'ranked' | 'normal' = onlineMatchType) => {
    setOnlineBusy(true);
    setOnlineError('');
    try {
      const activeRoster = (matchType === 'normal' && useEqualizedRoster)
        ? createEqualizedRoster(code ? 'red' : 'blue')
        : startingFive;
      const activeCoach = (matchType === 'normal' && useEqualizedRoster)
        ? (code ? EQUALIZED_COACH_RED : EQUALIZED_COACH_BLUE)
        : currentCoach;

      const joined = code 
        ? await joinOnlineRoom(code.trim(), activeRoster, activeCoach, ladderProfile.rating)
        : await createOnlineRoom(activeRoster, activeCoach, matchType, ladderProfile.rating);
      const effectiveType = joined.room.matchType || matchType;
      const session = { 
        code: joined.room.roomCode!, 
        token: joined.token, 
        side: joined.side, 
        matchType: effectiveType 
      };
      sessionStorage.setItem('esports-clash-online-session', JSON.stringify(session));
      setOnlineSession(session);
      setOnlineRoom(joined.room);
      setOnlineMatchType(effectiveType);
    } catch (error) { setOnlineError((error as Error).message); }
    finally { setOnlineBusy(false); }
  };

  const leaveOnline = () => {
    sessionStorage.removeItem('esports-clash-online-session');
    setOnlineSession(null);
    setOnlineRoom(null);
    setOnlineError('');
    setArenaChoice(null);
    setInBattle(false);
  };

  // Swap Starter and Bench Player
  const handleSwapPlayer = (startingIdx: number, benchId: string) => {
    const benchPlayer = roster.find((p) => p.id === benchId);
    if (!benchPlayer) return;

    const newStarting = [...startingFive];
    newStarting[startingIdx] = benchPlayer;
    setStartingFive(newStarting);
  };

  // Facility Upgrade
  const handleUpgradeFacility = (facId: string) => {
    const fac = facilities.find((f) => f.id === facId);
    if (!fac || teamFunds < fac.cost || fac.level >= fac.maxLevel) return;

    setTeamFunds((f) => f - fac.cost);
    setFacilities((prev) =>
      prev.map((f) =>
        f.id === facId ? { ...f, level: f.level + 1, cost: (f.level + 1) * 1200 } : f
      )
    );
  };

  // Run Daily Schedule in House
  const handleRunDailySchedule = (activity: string) => {
    if (activity === 'stream') {
      const earned = 350;
      setTeamFunds((f) => f + earned);
      sound.playCoin();
    } else if (activity === 'gym' || activity === 'rest') {
      setRoster((prev) =>
        prev.map((p) => ({
          ...p,
          fatigue: Math.max(0, p.fatigue - 35),
          morale: Math.min(100, p.morale + 10)
        }))
      );
    } else if (activity === 'scrim') {
      setRoster((prev) =>
        prev.map((p) => ({
          ...p,
          level: Math.min(60, p.level + 1),
          fatigue: Math.min(100, p.fatigue + 15)
        }))
      );
      updateEvolutionsProgress('scrim');
    }
  };

  // Gacha Pack Purchase Logic with Smart Duplicate Management
  const handleOpenPack = (packOrName: PackConfig | string, customCost?: number, customCount?: number) => {
    if (packModal) return;
    const pack: PackConfig = typeof packOrName === 'string'
      ? {
          id: 'custom',
          name: packOrName,
          cost: customCost ?? 0,
          count: customCount ?? 3,
          description: 'Special Supply Pack',
          category: 'all',
          icon: '🎁'
        }
      : packOrName;

    if (pack.cost > 0 && teamFunds < pack.cost) {
      alert(`Insufficient Clash Coins! You need 🪙 ${pack.cost.toLocaleString()} Coins.`);
      return;
    }

    let pool = [...INITIAL_PLAYERS];
    if (pack.roleFilter) {
      if (pack.roleFilter === 'Mage') {
        const filtered = pool.filter(p => p.role === 'Mage' || p.role === 'Assassin' || p.preferredRole === 'Mage' || p.preferredRole === 'Assassin');
        if (filtered.length >= 3) pool = filtered;
      } else if (pack.roleFilter === 'Tank') {
        const filtered = pool.filter(p => p.role === 'Tank' || p.role === 'Fighter' || p.role === 'Support' || p.preferredRole === 'Tank' || p.preferredRole === 'Fighter' || p.preferredRole === 'Support');
        if (filtered.length >= 3) pool = filtered;
      } else {
        const filtered = pool.filter(p => p.role === pack.roleFilter || p.preferredRole === pack.roleFilter);
        if (filtered.length >= 3) pool = filtered;
      }
    } else if (pack.tierFilter === 'Rookie') {
      const lower = pool.filter(p => p.tier === 'Bronze' || p.tier === 'Silver');
      if (lower.length >= 5) pool = lower;
    } else if (pack.tierFilter === 'GOAT') {
      const higher = pool.filter(p => p.tier === 'GOAT' || p.tier === 'Diamond' || p.tier === 'Platinum');
      if (higher.length >= 5) pool = higher;
    }

    const pulledCards: PlayerCard[] = [];
    let duplicateUpgrades = 0;
    let upgradedRoster = [...roster];

    for (let i = 0; i < pack.count; i++) {
      const randomBase = pool[Math.floor(Math.random() * pool.length)];
      const cardInstance: PlayerCard = {
        ...randomBase,
        id: `card_${Date.now()}_${i}_${Math.floor(Math.random() * 1000)}`
      };

      const existingIndex = upgradedRoster.findIndex(r => r.name === randomBase.name);
      if (existingIndex !== -1) {
        // A duplicate trains the owned card; pack purchases do not refund coins.
        duplicateUpgrades += 1;

        // Upgrade the existing player's training level and attributes
        const existing = upgradedRoster[existingIndex];
        upgradedRoster[existingIndex] = {
          ...existing,
          level: Math.min(60, existing.level + 1),
          ovr: Math.min(99, existing.ovr + 1),
          stats: {
            ...existing.stats,
            lan: Math.min(99, existing.stats.lan + 1),
            tf: Math.min(99, existing.stats.tf + 1),
            iq: Math.min(99, existing.stats.iq + 1),
            clu: Math.min(99, existing.stats.clu + 1),
            sta: Math.min(99, existing.stats.sta + 1),
            flx: Math.min(99, existing.stats.flx + 1)
          }
        };

        pulledCards.push(cardInstance);
      } else {
        upgradedRoster.push(cardInstance);
        pulledCards.push(cardInstance);
      }
    }

    const purchase = settlePackPurchase(teamFunds, pack.cost, duplicateUpgrades);
    if (!purchase) return;
    setTeamFunds(purchase.balance);
    setRoster(upgradedRoster);
    setStartingFive((current) => current.map(card => upgradedRoster.find(updated => updated.id === card.id) ?? card));

    setPackModal({
      open: true,
      name: pack.name,
      cards: pulledCards,
      duplicateUpgrades: purchase.duplicateUpgrades,
      spentCoins: pack.cost,
      balanceAfter: purchase.balance
    });
  };

  // Duplicate calculation and recycling for Club Reserves
  const nameGroups: { [name: string]: PlayerCard[] } = {};
  roster.forEach(c => {
    if (!nameGroups[c.name]) nameGroups[c.name] = [];
    nameGroups[c.name].push(c);
  });
  let duplicateCount = 0;
  let duplicateValue = 0;
  Object.values(nameGroups).forEach(cards => {
    if (cards.length > 1) {
      const sorted = [...cards].sort((a, b) => b.ovr - a.ovr);
      const dupes = sorted.slice(1);
      duplicateCount += dupes.length;
      dupes.forEach(d => {
        duplicateValue += d.tier === 'GOAT' ? 2500
          : d.tier === 'Diamond' ? 1200
          : d.tier === 'Platinum' ? 600
          : d.tier === 'Gold' ? 300
          : d.tier === 'Silver' ? 120
          : 60;
      });
    }
  });

  const handleRecycleDuplicates = () => {
    if (duplicateCount === 0) return;
    const keptCards: PlayerCard[] = [];
    Object.keys(nameGroups).forEach(name => {
      const cards = nameGroups[name];
      const best = [...cards].sort((a, b) => b.ovr - a.ovr)[0];
      keptCards.push(best);
    });
    setTeamFunds(f => f + duplicateValue);
    setRoster(keptCards);
    setStartingFive(prev => prev.map(s => keptCards.find(k => k.name === s.name) || s));
    alert(`♻️ Recycled ${duplicateCount} duplicate cards for 🪙 ${duplicateValue.toLocaleString()} Clash Coins!`);
  };

  // Rewarded Video Ad Claim
  const handleWatchRewardedAd = () => {
    sound.playClick();
    if (adsWatched >= 3) {
      alert('Daily free ad packs limit reached (3/3). Resets tomorrow!');
      return;
    }
    setAdsWatched((a) => a + 1);
    handleOpenPack('Daily Supply Drop', 0, 3);
  };

  // Evolution System
  const handleStartEvolution = (cardId: string, planId: string) => {
    const plan = evolutionPlans.find((p) => p.id === planId);
    if (!plan || teamFunds < plan.coinCost) return;

    setTeamFunds((f) => f - plan.coinCost);
    setActiveEvolutions((prev) => ({
      ...prev,
      [cardId]: { planId, progress: plan.objectives.map(() => 0) }
    }));
  };

  const updateEvolutionsProgress = (eventType: 'match_win' | 'scrim', amount: number = 1) => {
    setActiveEvolutions((prev) => {
      const updated = { ...prev };
      Object.keys(updated).forEach((cardId) => {
        const evo = updated[cardId];
        const plan = evolutionPlans.find((p) => p.id === evo.planId);
        if (plan) {
          evo.progress = evo.progress.map((val, idx) => {
            const obj = plan.objectives[idx];
            if (eventType === 'match_win' && obj.desc.includes('Win')) {
              return Math.min(obj.target, val + amount);
            }
            if (eventType === 'scrim' && obj.desc.includes('Scrim')) {
              return Math.min(obj.target, val + amount);
            }
            return Math.min(obj.target, val + amount);
          });
        }
      });
      return updated;
    });
  };

  const handleFastTrackEvolution = (cardId: string) => {
    const cost = 250;
    if (teamFunds < cost) {
      alert('Need 250 Clash Coins to Fast-Track this evolution!');
      return;
    }
    setTeamFunds((f) => f - cost);
    sound.playCoin();
    setActiveEvolutions((prev) => {
      const evo = prev[cardId];
      if (!evo) return prev;
      const plan = evolutionPlans.find((p) => p.id === evo.planId);
      if (!plan) return prev;
      return {
        ...prev,
        [cardId]: {
          ...evo,
          progress: plan.objectives.map((o) => o.target)
        }
      };
    });
  };

  const handleClaimEvolution = (cardId: string, planId: string, chosenSignature?: string) => {
    const plan = evolutionPlans.find((p) => p.id === planId);
    if (!plan) return;

    const upgradeCard = (card: PlayerCard): PlayerCard => {
      const currentRoles = card.playableRoles && card.playableRoles.length > 0
        ? card.playableRoles
        : [card.preferredRole || card.role || 'Mage'];
      const updatedRoles = plan.unlockedRole && !currentRoles.includes(plan.unlockedRole)
        ? [...currentRoles, plan.unlockedRole]
        : currentRoles;

      const updatedSignatures = chosenSignature && !card.signatureChampions.includes(chosenSignature)
        ? [...card.signatureChampions, chosenSignature]
        : card.signatureChampions;

      return {
        ...card,
        tier: plan.targetTier,
        ovr: Math.min(99, card.ovr + (plan.ovrBoost || 5)),
        isEvo: true,
        evolutionLevel: (card.evolutionLevel || 0) + 1,
        evolutionHistory: [...(card.evolutionHistory || []), plan.name],
        playableRoles: updatedRoles,
        signatureChampions: updatedSignatures,
        stats: {
          lan: Math.min(99, card.stats.lan + (plan.statBoost.lan || 5)),
          tf: Math.min(99, card.stats.tf + (plan.statBoost.tf || 5)),
          iq: Math.min(99, card.stats.iq + (plan.statBoost.iq || 5)),
          clu: Math.min(99, card.stats.clu + (plan.statBoost.clu || 8)),
          sta: Math.min(99, card.stats.sta + (plan.statBoost.sta || 5)),
          flx: Math.min(99, card.stats.flx + (plan.statBoost.flx || 5))
        },
        badges: Array.from(new Set([...card.badges, plan.unlockedBadge]))
      };
    };

    setRoster((prev) => prev.map((c) => (c.id === cardId ? upgradeCard(c) : c)));
    setStartingFive((prev) => prev.map((c) => (c.id === cardId ? upgradeCard(c) : c)));

    setActiveEvolutions((prev) => {
      const next = { ...prev };
      delete next[cardId];
      return next;
    });
  };

  // Draft Finished -> Launch 1-Lane ARAM Combat
  const handleDraftComplete = (
    blue: { player: PlayerCard; champion: ChampionKit }[],
    red: { player: PlayerCard; champion: ChampionKit }[], seed: number
  ) => {
    setDraftedBlue(blue);
    setDraftedRed(red);
    setReplayDraft(null);
    setMatchSeed(seed);
    setReplayNumber(0);
    setBalanceRunsLeft(0);
    setBalanceBatchId(0);
    setInBattle(true);
  };

  const launchDeveloperRandomMatch = () => {
    const seed = crypto.getRandomValues(new Uint32Array(1))[0];
    const matchup = createDevRandomMatch(INITIAL_PLAYERS, CHAMPIONS, seed);
    setArenaChoice('dev_random');
    handleDraftComplete(matchup.blue, matchup.red, seed);
  };

  // Queue Ranked Ladder Match against specific ladder rival
  const handleQueueRankedMatch = (opponent: LadderEntry) => {
    setActiveRankedOpponent(opponent);
    const proOpponent = ladderOpponentToProTeam(opponent);
    setSelectedOpponentTeam(proOpponent);
    setDraftSeed(crypto.getRandomValues(new Uint32Array(1))[0]);
    setActiveTab('arena');
    setArenaChoice('ai');
    setInBattle(false);
  };

  // Match Simulation Handler
  const handleMatchComplete = (winTeam: 'blue' | 'red') => {
    if (arenaChoice === 'dev_random') return;
    const isPlayerWin = winTeam === (arenaChoice === 'online' ? onlineSession?.side : 'blue');

    if (isPlayerWin) {
      setTeamFunds((f) => f + 1000);
      updateEvolutionsProgress('match_win', 1);

      setStandings((prev) =>
        prev.map((t) =>
          t.isPlayer ? { ...t, wins: t.wins + 1, points: t.points + 3 } : t
        )
      );
    } else {
      setStandings((prev) =>
        prev.map((t) =>
          t.isPlayer ? { ...t, losses: t.losses + 1 } : t
        )
      );
    }
    setRound((r) => r + 1);

    // Chess Elo Rating Update - MULTIPLAYER ONLY (Ranked Vs Player)
    // Ladder is for multiplayer only. Normal matches vs player are unranked (0 rating risk).
    const isOnline = arenaChoice === 'online';
    const isRankedMultiplayer = isOnline && (onlineRoom?.matchType === 'ranked' || onlineSession?.matchType === 'ranked');

    if (isRankedMultiplayer) {
      const mySide = onlineSession?.side ?? 'blue';
      const opponentRating = mySide === 'blue' 
        ? (onlineRoom?.redRating ?? 300) 
        : (onlineRoom?.blueRating ?? 300);
      const opponentName = mySide === 'blue' ? 'Red Player' : 'Blue Player';

      const eloResult = calculateEloDelta(
        ladderProfile.rating,
        opponentRating,
        isPlayerWin,
        ladderProfile.streak
      );

      const newStreak = isPlayerWin
        ? (ladderProfile.streak >= 0 ? ladderProfile.streak + 1 : 1)
        : (ladderProfile.streak <= 0 ? ladderProfile.streak - 1 : -1);

      const matchRecord: LadderMatchRecord = {
        id: `match_${Date.now()}`,
        opponentName,
        opponentRating,
        result: isPlayerWin ? 'win' : 'loss',
        ratingBefore: ladderProfile.rating,
        ratingAfter: eloResult.newRating,
        delta: eloResult.delta,
        timestamp: Date.now()
      };

      const updatedProfile: LadderProfile = {
        rating: eloResult.newRating,
        peakRating: Math.max(ladderProfile.peakRating, eloResult.newRating),
        wins: ladderProfile.wins + (isPlayerWin ? 1 : 0),
        losses: ladderProfile.losses + (isPlayerWin ? 0 : 1),
        streak: newStreak,
        matchesPlayed: ladderProfile.matchesPlayed + 1,
        recentMatches: [...ladderProfile.recentMatches.slice(-49), matchRecord]
      };

      setLadderProfile(updatedProfile);
      saveLadderProfile(updatedProfile);

      // Trigger post-match ladder dialog
      setLadderResultModal({
        isOpen: true,
        result: isPlayerWin ? 'win' : 'loss',
        delta: eloResult.delta,
        oldRating: ladderProfile.rating,
        newRating: eloResult.newRating,
        oldTier: eloResult.oldTier.name,
        newTier: eloResult.newTier.name,
        promoted: eloResult.promoted,
        demoted: eloResult.demoted,
        opponentName
      });
    }
  };

  const [arenaMode, setArenaMode] = useState<'teamfight' | '3d'>('3d');

  return (
    <div className="min-h-screen pb-16">
      {/* TOP RESOURCE BAR */}
      <header className="bg-slate-900/90 border-b border-slate-800 backdrop-blur-md sticky top-0 z-40 px-4 py-3 shadow-xl">
        <div className="w-full max-w-7xl mx-auto flex flex-wrap justify-between items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-tr from-amber-400 to-pink-500 rounded-lg flex items-center justify-center font-black text-slate-950 shadow">
              ⚡
            </div>
            <div>
              <h1 className="font-black text-sm tracking-wider uppercase bg-gradient-to-r from-amber-300 via-pink-400 to-cyan-400 bg-clip-text text-transparent">
                Esports Clash: GOAT Manager
              </h1>
              <div className="text-[10px] text-slate-400 font-semibold">
                EA FC Evolutions x Clash Arena Mayhem
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 text-xs font-bold">
            <button
              onClick={() => { sound.playClick(); setActiveTab('ladder'); setInBattle(false); }}
              className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-xl border border-amber-500/40 hover:border-amber-400 text-amber-300 shadow transition cursor-pointer"
              title="Click to view Chess Ranked Ladder"
            >
              <span className="text-sm">{getChessRank(ladderProfile.rating).icon}</span>
              <span className="font-mono font-black">{ladderProfile.rating} Rating</span>
              <span className="text-[10px] text-slate-400 font-bold uppercase">({getChessRank(ladderProfile.rating).name})</span>
            </button>

            <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-xl border border-amber-500/30 text-amber-300 shadow">
              <Coins className="w-4 h-4 text-amber-400" />
              <span>🪙 {teamFunds.toLocaleString()} Coins</span>
            </div>

            <button
              onClick={handleWatchRewardedAd}
              className="px-3 py-1.5 bg-gradient-to-r from-rose-600 to-pink-600 hover:brightness-110 text-white font-black rounded-xl shadow transition flex items-center gap-1.5 text-xs animate-pulse"
            >
              <Tv className="w-3.5 h-3.5" />
              Daily Supply Drop ({3 - adsWatched}/3 Free Packs)
            </button>
          </div>
        </div>
      </header>

      {/* MAIN NAVIGATION TABS */}
      <nav className="max-w-7xl mx-auto px-4 mt-4">
        <div className="flex gap-2 overflow-x-auto bg-slate-900/60 p-1.5 rounded-2xl border border-slate-800">
          <button
            onClick={() => { sound.playClick(); setActiveTab('squad'); setInBattle(false); }}
            className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'squad'
                ? 'bg-amber-400 text-slate-950 shadow-lg'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Users className="w-4 h-4" /> Squad Lineup
          </button>

          <button
            onClick={() => { sound.playClick(); setActiveTab('arena'); }}
            className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'arena'
                ? 'bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 shadow-lg'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Swords className="w-4 h-4" /> Clash Arena
          </button>

          <button
            onClick={() => { sound.playClick(); setActiveTab('ladder'); setInBattle(false); }}
            className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'ladder'
                ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 shadow-lg'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Trophy className="w-4 h-4" /> Ranked Ladder
          </button>

          <button
            onClick={() => { sound.playClick(); setActiveTab('evolutions'); setInBattle(false); }}
            className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'evolutions'
                ? 'bg-teal-400 text-slate-950 shadow-lg'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Zap className="w-4 h-4" /> Evolutions Hub
          </button>

          <button
            onClick={() => { sound.playClick(); setActiveTab('packs'); setInBattle(false); }}
            className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'packs'
                ? 'bg-pink-500 text-white shadow-lg'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Package className="w-4 h-4" /> Pack Store
          </button>

          <button
            onClick={() => { sound.playClick(); setActiveTab('champions'); setInBattle(false); }}
            className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'champions'
                ? 'bg-purple-500 text-white shadow-lg'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Layers className="w-4 h-4" /> Avatars & Lore
          </button>

          <button
            onClick={() => { sound.playClick(); setActiveTab('tournament'); setInBattle(false); }}
            className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'tournament'
                ? 'bg-amber-500 text-slate-950 shadow-lg'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Trophy className="w-4 h-4" /> Tournament Split
          </button>

          <button
            onClick={() => { sound.playClick(); setActiveTab('pro_circuit'); setInBattle(false); }}
            className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'pro_circuit'
                ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Globe className="w-4 h-4" /> Pro Circuit & Scouting
          </button>

          <button
            type="button"
            aria-label={musicEnabled ? 'Mute background music' : 'Enable background music'}
            aria-pressed={musicEnabled}
            title={musicEnabled ? 'Background music on' : 'Background music off'}
            onClick={() => {
              setMusicEnabled(sound.toggleMusic());
              sound.playClick();
            }}
            className={`ml-auto shrink-0 px-3 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 whitespace-nowrap ${
              musicEnabled
                ? 'bg-slate-800 text-cyan-200 hover:bg-slate-700'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            {musicEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            Music {musicEnabled ? 'On' : 'Off'}
          </button>
        </div>
      </nav>

      {/* VIEW CONTENT */}
      <main className={`w-full min-w-0 ${activeTab === 'arena' ? 'max-w-[1600px]' : 'max-w-7xl'} mx-auto px-4 mt-6`}>
        {activeTab === 'squad' && (
          <SquadView
            startingFive={startingFive}
            bench={bench}
            coach={currentCoach}
            onSwapPlayer={handleSwapPlayer}
            onRecycleDuplicates={handleRecycleDuplicates}
            duplicateCount={duplicateCount}
            duplicateValue={duplicateValue}
          />
        )}

        {activeTab === 'arena' && (
          <div>
            {!inBattle ? (
              <>
              {savedReports.length > 0 && <button className="mb-3 px-3 py-2 rounded-lg bg-slate-800 text-cyan-300 text-xs font-bold" onClick={() => openRecordedMatch(savedReports[savedReports.length - 1])}>Replay last saved match</button>}
              <label className="mb-3 ml-2 inline-block px-3 py-2 rounded-lg bg-slate-800 text-amber-300 text-xs font-bold cursor-pointer">
                Open match report
                <input type="file" accept="application/json,.json" className="hidden" onChange={async event => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  try { openRecordedMatch(JSON.parse(await file.text()) as MatchReport); }
                  catch { alert('This is not a valid match report.'); }
                }} />
              </label>
              {arenaChoice === null ? (
                <div className="max-w-4xl mx-auto mt-6 space-y-5">
                  {/* Opponent Selection Card */}
                  <div className="bg-gradient-to-r from-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-5 shadow-xl flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <div className="w-12 h-12 rounded-2xl bg-slate-950 border-2 border-amber-400/50 flex items-center justify-center font-black text-amber-300 text-lg shadow-lg">
                        #{selectedOpponentTeam?.globalRank || 1}
                      </div>
                      <div>
                        <div className="text-[10px] font-black tracking-wider uppercase text-cyan-400">Target AI Opponent</div>
                        <h3 className="text-lg font-black text-white flex items-center gap-2">
                          <span>{selectedOpponentTeam?.name || 'T1 Tigers'}</span>
                          <span className="text-xs px-2 py-0.5 rounded bg-black/60 text-amber-300 border border-amber-400/20">{selectedOpponentTeam?.avgOvr || 97} OVR</span>
                        </h3>
                        <p className="text-xs text-slate-400">Coach: {selectedOpponentTeam?.coach.name} ({selectedOpponentTeam?.coach.style})</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => { sound.playClick(); setActiveTab('pro_circuit'); }}
                      className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2"
                    >
                      <Globe className="w-4 h-4 text-cyan-400" /> Choose From 125 Pro Teams
                    </button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <button type="button" onClick={() => { sound.playClick(); setOnlineMatchType('ranked'); setArenaChoice('online'); }} className="bg-gradient-to-br from-amber-950/40 via-slate-900 to-slate-950 border border-amber-500/50 hover:border-amber-300 rounded-3xl p-6 text-left shadow-xl transition hover:-translate-y-1 group cursor-pointer flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <Trophy className="w-8 h-8 text-amber-400" />
                          <span className="text-xs px-2 py-0.5 rounded bg-amber-400/20 text-amber-300 font-mono font-bold border border-amber-400/30">
                            {ladderProfile.rating} Rating
                          </span>
                        </div>
                        <h2 className="text-xl text-white font-black group-hover:text-amber-300 transition-colors">Ranked Ladder</h2>
                        <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider block mt-0.5">Vs Player · Competitive</span>
                        <p className="text-slate-400 text-xs mt-2">Multiplayer competitive ladder match. Chess Elo Rating (starting at 300) on the line!</p>
                      </div>
                    </button>

                    <button type="button" onClick={() => { sound.playClick(); setDraftSeed(crypto.getRandomValues(new Uint32Array(1))[0]); setArenaChoice('ai'); }} className="bg-slate-900 border border-cyan-600/50 hover:border-cyan-300 rounded-3xl p-6 text-left shadow-xl transition hover:-translate-y-1 group cursor-pointer flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <Swords className="w-8 h-8 text-cyan-300" />
                          <span className="text-xs px-2 py-0.5 rounded bg-cyan-400/20 text-cyan-300 font-mono font-bold border border-cyan-400/30">
                            Squad Match
                          </span>
                        </div>
                        <h2 className="text-xl text-white font-black group-hover:text-cyan-300 transition-colors">Vs AI ({selectedOpponentTeam?.name || 'Pro Team'})</h2>
                        <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider block mt-0.5">Single-Player Scrimmage</span>
                        <p className="text-slate-400 text-xs mt-2">Single-player match using your squad lineup against {selectedOpponentTeam?.name || 'a pro coach'} with synergy AI.</p>
                      </div>
                    </button>

                    <button type="button" onClick={() => { sound.playClick(); setDraftSeed(crypto.getRandomValues(new Uint32Array(1))[0]); setEqualizedDraftStage('player_draft'); setArenaChoice('equalized_ai'); }} className="bg-gradient-to-br from-purple-950/40 via-slate-900 to-slate-950 border border-purple-500/60 hover:border-purple-300 rounded-3xl p-6 text-left shadow-xl transition hover:-translate-y-1 group cursor-pointer flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <Zap className="w-8 h-8 text-purple-400" />
                          <span className="text-xs px-2 py-0.5 rounded bg-purple-400/20 text-purple-300 font-mono font-bold border border-purple-400/30">
                            100 OVR · Normal
                          </span>
                        </div>
                        <h2 className="text-xl text-white font-black group-hover:text-purple-300 transition-colors">Equalized Draft</h2>
                        <span className="text-[10px] text-purple-400 font-bold uppercase tracking-wider block mt-0.5">Player & Avatar Draft · No Rank</span>
                        <p className="text-slate-400 text-xs mt-2">Squad Lineup bypassed! Draft your 100 OVR dream team from 63 superstars, followed by avatar drafting with zero rank risk.</p>
                      </div>
                    </button>

                    <button type="button" onClick={() => { sound.playClick(); setOnlineMatchType('normal'); setArenaChoice('online'); }} className="bg-slate-900 border border-emerald-600/50 hover:border-emerald-300 rounded-3xl p-6 text-left shadow-xl transition hover:-translate-y-1 group cursor-pointer flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <Users className="w-8 h-8 text-emerald-300" />
                          <span className="text-xs px-2 py-0.5 rounded bg-emerald-400/20 text-emerald-300 font-mono font-bold border border-emerald-400/30">
                            Unranked
                          </span>
                        </div>
                        <h2 className="text-xl text-white font-black group-hover:text-emerald-300 transition-colors">Normal (Vs Player)</h2>
                        <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block mt-0.5">Multiplayer Exhibition</span>
                        <p className="text-slate-400 text-xs mt-2">Casual multiplayer exhibition. Play friendlies and test squads with zero rating risk.</p>
                      </div>
                    </button>
                  </div>

                  {import.meta.env.DEV && (
                    <button
                      type="button"
                      onClick={() => { sound.playClick(); launchDeveloperRandomMatch(); }}
                      className="w-full bg-gradient-to-r from-fuchsia-950/65 via-slate-900 to-cyan-950/65 border border-dashed border-fuchsia-400/60 hover:border-cyan-300 rounded-3xl p-5 text-left shadow-xl transition hover:-translate-y-0.5 group cursor-pointer flex flex-wrap items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-4">
                        <div className="p-3 rounded-2xl bg-fuchsia-500/15 border border-fuchsia-400/30">
                          <FlaskConical className="w-7 h-7 text-fuchsia-300 group-hover:text-cyan-300 transition-colors" />
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-lg text-white font-black">Developer Random 5v5</h2>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-fuchsia-400/20 text-fuchsia-200 font-black uppercase tracking-wider border border-fuchsia-400/30">Dev build only</span>
                          </div>
                          <p className="text-slate-400 text-xs mt-1">Skip both drafts and instantly launch ten unique random avatars on equalized 100 OVR players.</p>
                        </div>
                      </div>
                      <span className="px-4 py-2 rounded-xl bg-fuchsia-500 text-white text-xs font-black shadow-lg group-hover:bg-cyan-500 group-hover:text-slate-950 transition-colors">Launch Random Match</span>
                    </button>
                  )}
                </div>
              ) : arenaChoice === 'dev_random' ? (
                <div className="max-w-2xl mx-auto mt-8 rounded-3xl border border-dashed border-fuchsia-400/60 bg-gradient-to-br from-fuchsia-950/50 via-slate-900 to-cyan-950/50 p-7 text-center shadow-2xl">
                  <FlaskConical className="w-10 h-10 text-fuchsia-300 mx-auto mb-3" />
                  <h2 className="text-xl font-black text-white">Developer Random 5v5</h2>
                  <p className="text-xs text-slate-400 mt-2">Generate a fresh equalized matchup with ten unique random avatars. Developer matches do not award progression or affect standings.</p>
                  <div className="mt-5 flex flex-wrap justify-center gap-3">
                    <button type="button" onClick={() => { sound.playClick(); launchDeveloperRandomMatch(); }} className="rounded-xl bg-fuchsia-500 hover:bg-fuchsia-400 px-5 py-2 text-xs font-black text-white transition">Launch New Random 5v5</button>
                    <button type="button" onClick={() => setArenaChoice(null)} className="rounded-xl border border-slate-600 px-5 py-2 text-xs font-bold text-slate-300 hover:text-white transition">Back to modes</button>
                  </div>
                </div>
              ) : arenaChoice === 'online' && (!onlineSession || !onlineRoom?.ready) ? (
                <div className="max-w-xl mx-auto bg-slate-900 border border-slate-700 rounded-3xl p-7 mt-8 text-white space-y-5">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <div>
                      <h2 className="text-xl font-black flex items-center gap-2">
                        <span>{onlineMatchType === 'ranked' ? '⚔️ Ranked Match' : '🕊️ Normal Match'} (Vs Player)</span>
                      </h2>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {onlineMatchType === 'ranked' 
                          ? 'Multiplayer Competitive Ladder · Chess Rating on the line' 
                          : 'Casual Exhibition · Zero Rating Risk'}
                      </p>
                    </div>

                    {!onlineSession && (
                      <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-bold">
                        <button
                          onClick={() => setOnlineMatchType('ranked')}
                          className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                            onlineMatchType === 'ranked'
                              ? 'bg-amber-400 text-slate-950 font-black'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          Ranked
                        </button>
                        <button
                          onClick={() => setOnlineMatchType('normal')}
                          className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                            onlineMatchType === 'normal'
                              ? 'bg-emerald-400 text-slate-950 font-black'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          Normal
                        </button>
                      </div>
                    )}
                  </div>

                  {onlineSession ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs uppercase font-black text-slate-400">Room Code:</span>
                        <span className={`text-xs px-2.5 py-0.5 rounded-full font-black uppercase ${
                          (onlineRoom?.matchType || onlineSession.matchType) === 'ranked'
                            ? 'bg-amber-400 text-slate-950'
                            : 'bg-emerald-400 text-slate-950'
                        }`}>
                          {(onlineRoom?.matchType || onlineSession.matchType) === 'ranked' ? '⚔️ Ranked Match' : '🕊️ Normal Match'}
                        </span>
                      </div>
                      <p className="text-3xl font-mono font-black text-amber-300 tracking-widest text-center py-2 bg-slate-950 rounded-2xl border border-amber-500/30">
                        {onlineSession.code}
                      </p>
                      <p className="text-xs text-slate-400 text-center">
                        Share this room code with your opponent. Waiting for their five-player roster...
                      </p>
                      <button
                        type="button"
                        className="w-full bg-cyan-700 hover:bg-cyan-600 px-4 py-2.5 rounded-xl font-bold text-xs transition cursor-pointer"
                        onClick={() => navigator.clipboard.writeText(onlineSession.code)}
                      >
                        Copy Room Code
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {onlineMatchType === 'normal' && (
                        <label className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 cursor-pointer hover:border-purple-500/50 transition">
                          <input
                            type="checkbox"
                            checked={useEqualizedRoster}
                            onChange={(e) => setUseEqualizedRoster(e.target.checked)}
                            className="w-4 h-4 rounded text-purple-500 focus:ring-purple-400"
                          />
                          <div className="flex items-center gap-1.5">
                            <Zap className="w-3.5 h-3.5 text-purple-400" />
                            <span className="font-bold text-white">Equalize to 100 OVR</span>
                            <span className="text-[10px] text-purple-300">(Squad lineup bypassed)</span>
                          </div>
                        </label>
                      )}

                      <button
                        type="button"
                        disabled={onlineBusy}
                        className={`w-full rounded-xl p-3 font-black text-sm transition shadow-lg flex items-center justify-center gap-2 cursor-pointer ${
                          onlineMatchType === 'ranked'
                            ? 'bg-gradient-to-r from-amber-400 to-yellow-500 hover:brightness-110 text-slate-950'
                            : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:brightness-110 text-slate-950'
                        }`}
                        onClick={() => void beginOnline(undefined, onlineMatchType)}
                      >
                        <Swords className="w-4 h-4" />
                        <span>Create {onlineMatchType === 'ranked' ? 'Ranked' : 'Normal'} Room</span>
                        {onlineMatchType === 'ranked' && (
                          <span className="text-xs font-mono opacity-80">({ladderProfile.rating} Rating)</span>
                        )}
                      </button>

                      <div className="flex items-center gap-2">
                        <div className="h-px flex-1 bg-slate-800" />
                        <span className="text-[10px] uppercase font-bold text-slate-500">Or Join Existing Room</span>
                        <div className="h-px flex-1 bg-slate-800" />
                      </div>

                      <div className="flex gap-2">
                        <input
                          aria-label="Room code"
                          value={roomCodeInput}
                          onChange={(event) => setRoomCodeInput(event.target.value.toUpperCase())}
                          maxLength={6}
                          placeholder="6-character room code"
                          className="min-w-0 flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs uppercase font-mono tracking-widest text-white placeholder-slate-500"
                        />
                        <button
                          type="button"
                          disabled={onlineBusy || !/^[A-F0-9]{6}$/.test(roomCodeInput)}
                          className="bg-rose-600 hover:bg-rose-500 px-5 py-2 rounded-xl text-xs font-bold disabled:opacity-40 transition cursor-pointer"
                          onClick={() => void beginOnline(roomCodeInput)}
                        >
                          Join Room
                        </button>
                      </div>
                    </div>
                  )}

                  {onlineError && <p role="alert" className="text-rose-300 text-xs text-center">{onlineError}</p>}
                  <button type="button" className="text-slate-400 text-xs hover:text-white block mx-auto pt-2 cursor-pointer" onClick={leaveOnline}>
                    ← Back to Modes
                  </button>
                </div>
              ) : arenaChoice === 'equalized_ai' && equalizedDraftStage === 'player_draft' ? (
                <PlayerDraftPhaseView
                  pool={getEqualizedPlayerPool()}
                  userCoach={EQUALIZED_COACH_BLUE}
                  opponentCoach={EQUALIZED_COACH_RED}
                  draftSeed={draftSeed}
                  onDraftComplete={(blueRoster, redRoster) => {
                    setEqualizedBlueRoster(blueRoster);
                    setEqualizedRedRoster(redRoster);
                    setEqualizedDraftStage('avatar_draft');
                  }}
                  onCancel={() => setArenaChoice(null)}
                />
              ) : (
                <>
              <div className="mb-3 flex items-center gap-2">
                {arenaChoice === 'equalized_ai' ? (
                  <>
                    <button
                      type="button"
                      className="text-slate-400 text-xs hover:text-white cursor-pointer"
                      onClick={() => setEqualizedDraftStage('player_draft')}
                    >
                      ← Back to Player Draft
                    </button>
                    <span className="text-slate-600">·</span>
                    <button
                      type="button"
                      className="text-slate-400 text-xs hover:text-white cursor-pointer"
                      onClick={() => setArenaChoice(null)}
                    >
                      Back to modes
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="text-slate-400 text-xs hover:text-white cursor-pointer"
                    onClick={arenaChoice === 'online' ? leaveOnline : () => setArenaChoice(null)}
                  >
                    ← Back to modes
                  </button>
                )}
              </div>
              {arenaChoice === 'equalized_ai' && (
                <div className="mb-4 bg-gradient-to-r from-purple-950/80 via-slate-900 to-indigo-950/80 border border-purple-500/50 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-white shadow-xl">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-purple-500/20 border border-purple-400/30 text-purple-300">
                      <Zap className="w-5 h-5 text-purple-300" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-white">EQUALIZED 100 OVR DRAFT MODE · PHASE 2: AVATAR DRAFT</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Normal Match · Unranked</span>
                      </div>
                      <p className="text-xs text-purple-200/80 mt-0.5">Using your drafted 100 OVR All-Stars! All 10 players have maxed mechanical stats with all combat roles unlocked. Draft your avatar team composition!</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-amber-300 bg-black/50 px-3 py-1.5 rounded-xl border border-amber-400/20">Zero Rating Risk</span>
                  </div>
                </div>
              )}
              {arenaChoice === 'online' && onlineSession && (
                <div className="mb-3 flex justify-between items-center text-xs text-slate-300">
                  <div className="flex items-center gap-2">
                    <span className="font-mono">Room {onlineSession.code}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                      (onlineRoom?.matchType || onlineSession.matchType) === 'ranked'
                        ? 'bg-amber-400 text-slate-950'
                        : 'bg-emerald-400 text-slate-950'
                    }`}>
                      {(onlineRoom?.matchType || onlineSession.matchType) === 'ranked' ? '⚔️ Ranked Match' : '🕊️ Normal Match'}
                    </span>
                    <span>· You are {onlineSession.side.toUpperCase()} team</span>
                  </div>
                  <button type="button" onClick={leaveOnline} className="text-rose-300 hover:text-white font-bold cursor-pointer">Leave room</button>
                </div>
              )}
              <DraftPhaseView
                key={arenaChoice === 'online' ? onlineSession?.code : draftSeed}
                startingFive={arenaChoice === 'equalized_ai' ? equalizedBlueRoster : startingFive}
                allChampions={CHAMPIONS}
                userCoach={arenaChoice === 'equalized_ai' ? EQUALIZED_COACH_BLUE : currentCoach}
                opponentCoach={arenaChoice === 'equalized_ai' ? EQUALIZED_COACH_RED : arenaChoice === 'online' ? onlineRoom!.redCoach : (selectedOpponentTeam?.coach ?? rivalCoach)}
                opponentName={arenaChoice === 'equalized_ai' ? 'Red All-Stars (100 OVR)' : arenaChoice === 'online' ? 'Red team' : (selectedOpponentTeam?.name ?? 'Rival Chibi Squad')}
                opponentRoster={arenaChoice === 'equalized_ai' ? equalizedRedRoster : arenaChoice === 'online' ? onlineRoom!.redRoster : (selectedOpponentTeam?.starters ?? INITIAL_PLAYERS.slice(5, 10))}
                draftSeed={arenaChoice === 'online' ? onlineRoom!.seed : draftSeed}
                online={arenaChoice === 'online' && onlineSession ? { room: onlineRoom!, side: onlineSession.side,
                  onAction: async (championId, slot) => {
                    try { setOnlineRoom(await submitOnlineDraft(onlineSession, championId, slot, onlineRoom!.revision)); setOnlineError(''); }
                    catch (error) { setOnlineError((error as Error).message); setOnlineRoom(await getOnlineRoom(onlineSession)); }
                  } } : undefined}
                onDraftComplete={handleDraftComplete}
              />
                {onlineError && <p role="alert" className="mt-3 text-rose-300 text-sm">{onlineError}</p>}
                </>
              )}
            </>
          ) : (
              <>
              {arenaChoice === 'online' && onlineSession && !replayDraft && <div className="mb-3 flex justify-between text-xs text-slate-300"><span>Online room {onlineSession.code} · You are {onlineSession.side.toUpperCase()}</span><button type="button" onClick={leaveOnline} className="text-rose-300 hover:text-white font-bold">Leave room</button></div>}
              <AramMatchView
                key={`${matchSeed}:${replayNumber}`}
                seed={matchSeed}
                onlineMode={arenaChoice === 'online' && !replayDraft}
                onReplay={arenaChoice === 'dev_random' ? launchDeveloperRandomMatch : () => setReplayNumber(number => number + 1)}
                replayLabel={arenaChoice === 'dev_random' ? 'New Random 5v5' : undefined}
                replayTitle={arenaChoice === 'dev_random' ? 'Generate ten new random avatars and restart immediately' : undefined}
                batchMode={balanceRunsLeft > 0}
                batchId={balanceBatchId}
                batchNumber={balanceRunsLeft > 0 ? 26 - balanceRunsLeft : 0}
                onBatchStart={() => {
                  setBalanceRunsLeft(25);
                  setBalanceBatchId(crypto.getRandomValues(new Uint32Array(1))[0]);
                  setMatchSeed(crypto.getRandomValues(new Uint32Array(1))[0]);
                  setReplayNumber(number => number + 1);
                }}
                onBatchStop={() => {
                  setBalanceRunsLeft(0);
                  setReplayNumber(number => number + 1);
                }}
                blueLineup={balanceSwapped ? draftedRed : draftedBlue}
                redLineup={balanceSwapped ? draftedBlue : draftedRed}
                blueCoach={balanceSwapped ? (replayDraft?.redCoach ?? (arenaChoice === 'equalized_ai' || arenaChoice === 'dev_random' ? EQUALIZED_COACH_RED : arenaChoice === 'online' ? onlineRoom?.redCoach ?? (selectedOpponentTeam?.coach ?? rivalCoach) : (selectedOpponentTeam?.coach ?? rivalCoach))) : (replayDraft?.blueCoach ?? (arenaChoice === 'equalized_ai' || arenaChoice === 'dev_random' ? EQUALIZED_COACH_BLUE : arenaChoice === 'online' ? onlineRoom?.blueCoach ?? currentCoach : currentCoach))}
                redCoach={balanceSwapped ? (replayDraft?.blueCoach ?? (arenaChoice === 'equalized_ai' || arenaChoice === 'dev_random' ? EQUALIZED_COACH_BLUE : arenaChoice === 'online' ? onlineRoom?.blueCoach ?? currentCoach : currentCoach)) : (replayDraft?.redCoach ?? (arenaChoice === 'equalized_ai' || arenaChoice === 'dev_random' ? EQUALIZED_COACH_RED : arenaChoice === 'online' ? onlineRoom?.redCoach ?? (selectedOpponentTeam?.coach ?? rivalCoach) : (selectedOpponentTeam?.coach ?? rivalCoach)))}
                blueTeamName={arenaChoice === 'dev_random' ? (balanceSwapped ? 'Dev Red Random' : 'Dev Blue Random') : arenaChoice === 'equalized_ai' ? (balanceSwapped ? 'Red All-Stars (100 OVR)' : 'Blue All-Stars (100 OVR)') : (arenaChoice === 'online' && !replayDraft ? 'Blue Player' : balanceSwapped ? (selectedOpponentTeam?.name ?? 'Rival Chibi Squad') : 'T-Chibi Squad')}
                opponentName={arenaChoice === 'dev_random' ? (balanceSwapped ? 'Dev Blue Random' : 'Dev Red Random') : arenaChoice === 'equalized_ai' ? (balanceSwapped ? 'Blue All-Stars (100 OVR)' : 'Red All-Stars (100 OVR)') : (arenaChoice === 'online' && !replayDraft ? 'Red Player' : balanceSwapped ? 'T-Chibi Squad' : (selectedOpponentTeam?.name ?? 'Rival Chibi Squad'))}
                onMatchComplete={balanceRunsLeft > 0 ? () => {
                  setBalanceRunsLeft(left => left - 1);
                  if (balanceRunsLeft > 1) {
                    if (rerollAfterBalanceGame(balanceRunsLeft)) setMatchSeed(crypto.getRandomValues(new Uint32Array(1))[0]);
                    setReplayNumber(number => number + 1);
                  }
                } : replayNumber === 0 ? handleMatchComplete : () => {}}
              />
              </>
            )}
          </div>
        )}

        {activeTab === 'ladder' && (
          <RankedLadderView
            profile={ladderProfile}
            playerName="T-Chibi Squad"
            onPlayRankedMultiplayer={() => beginOnline('ranked')}
            onQueueRankedMatch={handleQueueRankedMatch}
          />
        )}

        {activeTab === 'evolutions' && (
          <EvolutionsView
            plans={evolutionPlans}
            roster={roster}
            teamFunds={teamFunds}
            onStartEvolution={handleStartEvolution}
            onClaimEvolution={handleClaimEvolution}
            onFastTrackEvolution={handleFastTrackEvolution}
            activeEvolutions={activeEvolutions}
          />
        )}

        {activeTab === 'packs' && (
          <div className="space-y-6 animate-fade-in max-w-6xl mx-auto">
            {/* Store Header Banner */}
            <div className="bg-gradient-to-r from-pink-950/70 via-slate-900 to-amber-950/70 border border-pink-500/40 rounded-3xl p-6 shadow-2xl flex flex-wrap justify-between items-center gap-4">
              <div>
                <div className="flex items-center gap-2 text-pink-400 text-xs font-black uppercase tracking-wider mb-1">
                  <Package className="w-4 h-4" /> Official Card Pack Store
                </div>
                <h2 className="text-2xl font-black text-white">
                  SCOUT & TRAIN YOUR ESPORTS ROSTER
                </h2>
                <p className="text-slate-400 text-xs mt-1">
                  Packs feature walkout animations. Duplicate pulls train your existing cards; the listed pack price is deducted from your coins.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="bg-slate-950/90 border border-amber-500/40 px-4 py-2 rounded-2xl flex items-center gap-2 text-amber-300 shadow">
                  <Coins className="w-5 h-5 text-amber-400" />
                  <div className="text-left">
                    <div className="text-[10px] text-slate-400 uppercase font-black">Your Balance</div>
                    <div className="text-sm font-black text-amber-300">🪙 {teamFunds.toLocaleString()} Coins</div>
                  </div>
                </div>

                {duplicateCount > 0 && (
                  <button
                    onClick={handleRecycleDuplicates}
                    className="bg-amber-500/20 border border-amber-400/50 hover:bg-amber-500/30 text-amber-300 font-bold px-3 py-2 rounded-2xl text-xs flex items-center gap-1.5 transition shadow"
                  >
                    <span>♻️</span>
                    <span>Recycle {duplicateCount} Dupes (+{duplicateValue.toLocaleString()} Coins)</span>
                  </button>
                )}
              </div>
            </div>

            {/* Pack Catalog Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {PACK_CATALOG.map((pack) => {
                const canAfford = teamFunds >= pack.cost;
                return (
                  <div
                    key={pack.id}
                    className={`bg-slate-900/90 border rounded-3xl p-5 flex flex-col justify-between transition-all duration-200 shadow-xl relative overflow-hidden group ${
                      pack.tierFilter === 'GOAT'
                        ? 'border-pink-500/50 hover:border-pink-400 hover:shadow-[0_0_25px_rgba(236,72,153,0.3)]'
                        : pack.tierFilter === 'Pro'
                        ? 'border-amber-500/40 hover:border-amber-300'
                        : 'border-slate-800 hover:border-slate-600'
                    }`}
                  >
                    {pack.badge && (
                      <div className={`absolute top-3 right-3 text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase shadow ${pack.badgeColor}`}>
                        {pack.badge}
                      </div>
                    )}

                    <div>
                      <div className="flex items-center gap-2 text-2xl mb-2">
                        <span>{pack.icon}</span>
                        <div className="text-xs font-black uppercase text-slate-400">
                          {pack.count} Cards Pack
                        </div>
                      </div>

                      <h3 className="text-lg font-black text-white group-hover:text-amber-300 transition-colors mb-1.5">
                        {pack.name}
                      </h3>

                      <p className="text-xs text-slate-400 leading-relaxed min-h-[40px]">
                        {pack.description}
                      </p>
                    </div>

                    <div className="mt-5 pt-3 border-t border-slate-800/80">
                      <div className="flex items-center justify-between mb-3 text-xs">
                        <span className="text-slate-400 font-semibold">Price:</span>
                        <span className="font-mono font-black text-amber-300 flex items-center gap-1 text-sm">
                          🪙 {pack.cost.toLocaleString()} Coins
                        </span>
                      </div>

                      <button
                        onClick={() => { sound.playClick(); handleOpenPack(pack); }}
                        disabled={!canAfford}
                        className={`w-full py-2.5 rounded-xl text-xs font-black transition-all shadow-md flex items-center justify-center gap-1.5 ${
                          !canAfford
                            ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                            : pack.tierFilter === 'GOAT'
                            ? 'bg-gradient-to-r from-pink-500 to-purple-600 hover:brightness-110 text-white shadow-pink-500/20'
                            : pack.tierFilter === 'Pro'
                            ? 'bg-gradient-to-r from-amber-400 to-yellow-500 hover:brightness-110 text-slate-950 font-black'
                            : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
                        }`}
                      >
                        {canAfford ? `Open for 🪙 ${pack.cost.toLocaleString()} Coins` : `Need 🪙 ${pack.cost.toLocaleString()} Coins`}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'champions' && (
          <ChampionHubView
            champions={CHAMPIONS}
            allPlayers={roster}
          />
        )}

        {activeTab === 'tournament' && (
          <TournamentView
            currentLeague={currentLeague}
            round={round}
            maxRounds={maxRounds}
            standings={standings}
            onStartMatch={() => {
              setActiveTab('arena');
              setInBattle(false);
            }}
          />
        )}

        {activeTab === 'pro_circuit' && (
          <ProCircuitView
            selectedOpponentId={selectedOpponentTeam?.id}
            onChallengeTeam={(team) => {
              setSelectedOpponentTeam(team);
              setDraftSeed(crypto.getRandomValues(new Uint32Array(1))[0]);
              setActiveTab('arena');
              setArenaChoice('ai');
              setInBattle(false);
              sound.playWalkoutFanfare();
            }}
          />
        )}
      </main>

      {/* POST-MATCH CHESS ELO LADDER RESULT MODAL */}
      {ladderResultModal && ladderResultModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 border-2 border-amber-500/50 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative text-center">
            {/* Header Icon */}
            <div className="w-20 h-20 mx-auto rounded-3xl bg-slate-950 border-2 border-amber-400/60 flex items-center justify-center text-4xl shadow-xl mb-4">
              {ladderResultModal.result === 'win' ? '🏆' : '💀'}
            </div>

            <div className="text-[11px] font-black tracking-widest uppercase text-cyan-400 mb-1">
              CHESS COMPETITIVE LADDER MATCH
            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-white mb-1">
              {ladderResultModal.result === 'win' ? (
                <span className="text-emerald-400">VICTORY</span>
              ) : (
                <span className="text-rose-400">DEFEAT</span>
              )}
            </h2>

            <p className="text-xs text-slate-400 mb-6">
              Match concluded vs <strong className="text-slate-200">{ladderResultModal.opponentName}</strong>
            </p>

            {/* Rating Delta Box */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 mb-5 shadow-inner">
              <div className="text-[10px] text-slate-400 uppercase font-black tracking-wider mb-2">
                Chess Rating Shift
              </div>

              <div className="flex items-center justify-center gap-3">
                <span className="font-mono text-xl font-bold text-slate-400">
                  {ladderResultModal.oldRating}
                </span>
                <span className="text-slate-600 font-black">➔</span>
                <span className="font-mono text-3xl font-black text-amber-300">
                  {ladderResultModal.newRating}
                </span>
                <span className="text-xs font-bold text-slate-400 uppercase">Rating</span>
              </div>

              <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-xl font-mono font-black text-sm border shadow-sm">
                <span className={ladderResultModal.delta >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                  {ladderResultModal.delta >= 0 ? `+${ladderResultModal.delta}` : ladderResultModal.delta} Rating
                </span>
              </div>

              {/* Promotion / Demotion alert */}
              {ladderResultModal.promoted && (
                <div className="mt-3 p-2 bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-400/50 rounded-xl text-amber-300 text-xs font-black animate-pulse">
                  🎉 PROMOTED TO {ladderResultModal.newTier.toUpperCase()}!
                </div>
              )}

              {ladderResultModal.demoted && (
                <div className="mt-3 p-2 bg-rose-500/20 border border-rose-500/40 rounded-xl text-rose-300 text-xs font-bold">
                  ⚠️ Demoted to {ladderResultModal.newTier}
                </div>
              )}
            </div>

            {/* Current Chess Tier */}
            <div className="flex items-center justify-center gap-2 text-xs text-slate-300 mb-6">
              <span>Current Chess Rank:</span>
              <span className="font-black text-white px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
                {getChessRank(ladderResultModal.newRating).icon} {ladderResultModal.newTier}
              </span>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  sound.playClick();
                  setLadderResultModal(null);
                  setActiveTab('ladder');
                  setInBattle(false);
                }}
                className="py-3 px-4 bg-slate-800 hover:bg-slate-700 text-white font-black text-xs rounded-2xl transition flex items-center justify-center gap-1.5"
              >
                <Trophy className="w-4 h-4 text-amber-400" />
                <span>View Ladder</span>
              </button>

              <button
                onClick={() => {
                  sound.playClick();
                  setLadderResultModal(null);
                }}
                className="py-3 px-4 bg-gradient-to-r from-amber-400 to-yellow-500 hover:brightness-110 text-slate-950 font-black text-xs rounded-2xl transition shadow-lg"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PACK OPENING POPUP MODAL */}
      {packModal && (
        <PackOpeningModal
          packName={packModal.name}
          cards={packModal.cards}
          duplicateUpgrades={packModal.duplicateUpgrades}
          spentCoins={packModal.spentCoins}
          balanceAfter={packModal.balanceAfter}
          onClose={() => setPackModal(null)}
        />
      )}
    </div>
  );
}

export default App;
