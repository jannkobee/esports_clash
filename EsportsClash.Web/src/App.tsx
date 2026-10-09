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
import { GamingHouseView } from './components/GamingHouseView';
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
import { sound } from './audio';
import { 
  Tv, 
  Sparkles, 
  Coins, 
  Users, 
  Home, 
  Zap, 
  Swords, 
  Trophy, 
  Package,
  Layers
} from 'lucide-react';

export function App() {
  // Navigation
  const [activeTab, setActiveTab] = useState<'squad' | 'house' | 'packs' | 'evolutions' | 'arena' | 'tournament' | 'champions'>('squad');
  const [inBattle, setInBattle] = useState<boolean>(false);
  const [arenaChoice, setArenaChoice] = useState<'ai' | 'online' | null>(() =>
    sessionStorage.getItem('esports-clash-online-session') ? 'online' : null);
  const [draftSeed, setDraftSeed] = useState(0);
  const rivalCoach = INITIAL_COACHES[draftSeed % INITIAL_COACHES.length];
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
  const [fansCount, setFansCount] = useState<number>(1250);
  const [day, setDay] = useState<number>(1);
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
  const [packModal, setPackModal] = useState<{ open: boolean; name: string; cards: PlayerCard[]; duplicateCoins: number } | null>(null);

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

  const beginOnline = async (code?: string) => {
    setOnlineBusy(true);
    setOnlineError('');
    try {
      const joined = code ? await joinOnlineRoom(code.trim(), startingFive, currentCoach)
        : await createOnlineRoom(startingFive, currentCoach);
      const session = { code: joined.room.roomCode!, token: joined.token, side: joined.side };
      sessionStorage.setItem('esports-clash-online-session', JSON.stringify(session));
      setOnlineSession(session);
      setOnlineRoom(joined.room);
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
    setDay((d) => d + 1);

    if (activity === 'stream') {
      const earned = 350;
      const newFans = 120;
      setTeamFunds((f) => f + earned);
      setFansCount((c) => c + newFans);
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

  // Gacha Pack Purchase Logic
  const handleOpenPack = (tierName: string, cost: number, count: number) => {
    if (cost > 0 && teamFunds < cost) return;

    if (cost > 0) setTeamFunds((f) => f - cost);

    const pulledCards: PlayerCard[] = [];
    let dupCoins = 0;

    for (let i = 0; i < count; i++) {
      const randomBase = INITIAL_PLAYERS[Math.floor(Math.random() * INITIAL_PLAYERS.length)];
      const cardInstance: PlayerCard = {
        ...randomBase,
        id: `card_${Date.now()}_${i}`
      };

      if (roster.some((r) => r.name === randomBase.name)) {
        dupCoins += 200;
      }
      pulledCards.push(cardInstance);
    }

    if (dupCoins > 0) setTeamFunds((f) => f + dupCoins);

    setRoster((prev) => [...prev, ...pulledCards]);
    setPackModal({
      open: true,
      name: tierName,
      cards: pulledCards,
      duplicateCoins: dupCoins
    });
  };

  // Rewarded Video Ad Claim
  const handleWatchRewardedAd = () => {
    sound.playClick();
    if (adsWatched >= 3) {
      alert('Daily free ad packs limit reached (3/3). Resets tomorrow!');
      return;
    }
    setAdsWatched((a) => a + 1);
    handleOpenPack('Daily Rewarded Ad Pack', 0, 3);
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

  const handleClaimEvolution = (cardId: string, planId: string) => {
    const plan = evolutionPlans.find((p) => p.id === planId);
    if (!plan) return;

    setRoster((prev) =>
      prev.map((card) => {
        if (card.id === cardId) {
          return {
            ...card,
            tier: plan.targetTier,
            ovr: Math.min(99, card.ovr + 6),
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
        }
        return card;
      })
    );

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

  // Match Simulation Handler
  const handleMatchComplete = (winTeam: 'blue' | 'red') => {
    if (winTeam === (arenaChoice === 'online' ? onlineSession?.side : 'blue')) {
      setTeamFunds((f) => f + 1000);
      setFansCount((c) => c + 350);
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
  };

  const [arenaMode, setArenaMode] = useState<'teamfight' | '3d'>('3d');

  return (
    <div className="min-h-screen pb-16">
      {/* TOP RESOURCE BAR */}
      <header className="bg-slate-900/90 border-b border-slate-800 backdrop-blur-md sticky top-0 z-40 px-4 py-3 shadow-xl">
        <div className="max-w-7xl mx-auto flex flex-wrap justify-between items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-tr from-amber-400 to-pink-500 rounded-lg flex items-center justify-center font-black text-slate-950 shadow">
              ⚡
            </div>
            <div>
              <h1 className="font-black text-sm tracking-wider uppercase bg-gradient-to-r from-amber-300 via-pink-400 to-cyan-400 bg-clip-text text-transparent">
                Esports Clash: GOAT Manager
              </h1>
              <div className="text-[10px] text-slate-400 font-semibold">
                EA FC Evolutions x 1-Lane ARAM Mayhem
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-bold">
            <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-xl border border-amber-500/30 text-amber-300 shadow">
              <Coins className="w-4 h-4 text-amber-400" />
              <span>${teamFunds.toLocaleString()}</span>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-xl border border-pink-500/30 text-pink-300 shadow">
              <Sparkles className="w-4 h-4 text-pink-400" />
              <span>{fansCount.toLocaleString()} Fans</span>
            </div>

            <div className="bg-slate-950 px-3 py-1.5 rounded-xl border border-white/10 text-slate-300">
              📅 Day {day}
            </div>

            <button
              onClick={handleWatchRewardedAd}
              className="px-3 py-1.5 bg-gradient-to-r from-rose-600 to-pink-600 hover:brightness-110 text-white font-black rounded-xl shadow transition flex items-center gap-1.5 text-xs animate-pulse"
            >
              <Tv className="w-3.5 h-3.5" />
              Watch Ad ({3 - adsWatched}/3 Free Packs)
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
            <Swords className="w-4 h-4" /> 1-Lane ARAM Bridge
          </button>

          <button
            onClick={() => { sound.playClick(); setActiveTab('house'); setInBattle(false); }}
            className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'house'
                ? 'bg-indigo-500 text-white shadow-lg'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Home className="w-4 h-4" /> Gaming House
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
            <Layers className="w-4 h-4" /> Champions & Lore
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
        </div>
      </nav>

      {/* VIEW CONTENT */}
      <main className={`${activeTab === 'arena' ? 'max-w-[1600px]' : 'max-w-7xl'} mx-auto px-4 mt-6`}>
        {activeTab === 'squad' && (
          <SquadView
            startingFive={startingFive}
            bench={bench}
            coach={currentCoach}
            onSwapPlayer={handleSwapPlayer}
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
              {arenaChoice === null ? <div className="grid gap-4 md:grid-cols-2 max-w-4xl mx-auto mt-10">
                <button type="button" onClick={() => { setDraftSeed(crypto.getRandomValues(new Uint32Array(1))[0]); setArenaChoice('ai'); }} className="bg-slate-900 border border-cyan-600/50 hover:border-cyan-300 rounded-3xl p-8 text-left shadow-xl">
                  <Swords className="w-8 h-8 text-cyan-300 mb-4" /><h2 className="text-2xl text-white font-black">Vs AI</h2><p className="text-slate-400 text-sm mt-2">Draft against a coach led rival, then watch both teams play.</p>
                </button>
                <button type="button" onClick={() => setArenaChoice('online')} className="bg-slate-900 border border-rose-600/50 hover:border-rose-300 rounded-3xl p-8 text-left shadow-xl">
                  <Users className="w-8 h-8 text-rose-300 mb-4" /><h2 className="text-2xl text-white font-black">Vs Player</h2><p className="text-slate-400 text-sm mt-2">Create or join an online room. Each player drafts a team; both watch the seeded match.</p>
                </button>
              </div> : arenaChoice === 'online' && (!onlineSession || !onlineRoom?.ready) ? <div className="max-w-xl mx-auto bg-slate-900 border border-slate-700 rounded-3xl p-7 mt-8 text-white space-y-4">
                <h2 className="text-xl font-black">Online Vs Player</h2>
                {onlineSession ? <><p>Room <strong className="text-amber-300 text-2xl tracking-widest">{onlineSession.code}</strong></p><p className="text-sm text-slate-400">Share this code with your opponent. Waiting for their five player roster.</p><button type="button" className="bg-cyan-700 px-4 py-2 rounded-xl font-bold" onClick={() => navigator.clipboard.writeText(onlineSession.code)}>Copy room code</button></>
                  : <><button type="button" disabled={onlineBusy} className="w-full bg-cyan-600 hover:bg-cyan-500 rounded-xl p-3 font-black" onClick={() => void beginOnline()}>Create room</button>
                  <div className="flex gap-2"><input aria-label="Room code" value={roomCodeInput} onChange={event => setRoomCodeInput(event.target.value.toUpperCase())} maxLength={6} placeholder="6 character room code" className="min-w-0 flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 uppercase" /><button type="button" disabled={onlineBusy || !/^[A-F0-9]{6}$/.test(roomCodeInput)} className="bg-rose-600 px-4 py-2 rounded-xl font-bold disabled:opacity-40" onClick={() => void beginOnline(roomCodeInput)}>Join</button></div></>}
                {onlineError && <p role="alert" className="text-rose-300 text-sm">{onlineError}</p>}
                <button type="button" className="text-slate-400 text-xs hover:text-white" onClick={leaveOnline}>Back to modes</button>
              </div> : <>
              <button type="button" className="mb-3 text-slate-400 text-xs hover:text-white" onClick={arenaChoice === 'online' ? leaveOnline : () => setArenaChoice(null)}>← Back to modes</button>
              {arenaChoice === 'online' && onlineSession && <div className="mb-3 text-xs text-cyan-300">Room {onlineSession.code} · {onlineSession.side.toUpperCase()} team</div>}
              <DraftPhaseView
                key={arenaChoice === 'online' ? onlineSession?.code : draftSeed}
                startingFive={startingFive}
                allChampions={CHAMPIONS}
                userCoach={currentCoach}
                opponentCoach={arenaChoice === 'online' ? onlineRoom!.redCoach : rivalCoach}
                opponentName={arenaChoice === 'online' ? 'Red team' : 'Rival Chibi Squad'}
                opponentRoster={arenaChoice === 'online' ? onlineRoom!.redRoster : INITIAL_PLAYERS.slice(5, 10)}
                draftSeed={arenaChoice === 'online' ? onlineRoom!.seed : draftSeed}
                online={arenaChoice === 'online' && onlineSession ? { room: onlineRoom!, side: onlineSession.side,
                  onAction: async (championId, slot) => {
                    try { setOnlineRoom(await submitOnlineDraft(onlineSession, championId, slot, onlineRoom!.revision)); setOnlineError(''); }
                    catch (error) { setOnlineError((error as Error).message); setOnlineRoom(await getOnlineRoom(onlineSession)); }
                  } } : undefined}
                onDraftComplete={handleDraftComplete}
              />
              {onlineError && <p role="alert" className="mt-3 text-rose-300 text-sm">{onlineError}</p>}
              </>}
              </>
            ) : (
              <>
              {arenaChoice === 'online' && onlineSession && !replayDraft && <div className="mb-3 flex justify-between text-xs text-slate-300"><span>Online room {onlineSession.code} · You are {onlineSession.side.toUpperCase()}</span><button type="button" onClick={leaveOnline} className="text-rose-300 hover:text-white font-bold">Leave room</button></div>}
              <AramMatchView
                key={`${matchSeed}:${replayNumber}`}
                seed={matchSeed}
                onlineMode={arenaChoice === 'online' && !replayDraft}
                onReplay={() => setReplayNumber(number => number + 1)}
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
                blueCoach={balanceSwapped ? replayDraft ? replayDraft.redCoach : rivalCoach : replayDraft?.blueCoach ?? (arenaChoice === 'online' ? onlineRoom?.blueCoach : currentCoach) ?? currentCoach}
                redCoach={balanceSwapped ? replayDraft?.blueCoach ?? currentCoach : replayDraft ? replayDraft.redCoach : arenaChoice === 'online' ? onlineRoom?.redCoach ?? rivalCoach : rivalCoach}
                blueTeamName={arenaChoice === 'online' && !replayDraft ? 'Blue Player' : balanceSwapped ? 'Rival Chibi Squad' : 'T-Chibi Squad'}
                opponentName={arenaChoice === 'online' && !replayDraft ? 'Red Player' : balanceSwapped ? 'T-Chibi Squad' : 'Rival Chibi Squad'}
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

        {activeTab === 'house' && (
          <GamingHouseView
            facilities={facilities}
            roster={roster}
            teamFunds={teamFunds}
            onUpgradeFacility={handleUpgradeFacility}
            onRunDailySchedule={handleRunDailySchedule}
          />
        )}

        {activeTab === 'evolutions' && (
          <EvolutionsView
            plans={evolutionPlans}
            roster={roster}
            teamFunds={teamFunds}
            onStartEvolution={handleStartEvolution}
            onClaimEvolution={handleClaimEvolution}
            activeEvolutions={activeEvolutions}
          />
        )}

        {activeTab === 'packs' && (
          <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
            <div className="bg-gradient-to-r from-pink-950/60 via-slate-900 to-amber-950 border border-pink-500/40 rounded-2xl p-5 shadow-xl flex justify-between items-center">
              <div>
                <h2 className="text-xl font-black text-white flex items-center gap-2">
                  <Package className="w-5 h-5 text-pink-400" />
                  ULTIMATE TEAM PACK STORE
                </h2>
                <p className="text-slate-400 text-xs mt-0.5">
                  Scout global esports stars with realistic Walkout animations!
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between hover:border-amber-500/50 transition shadow-xl">
                <div>
                  <div className="text-xs font-black uppercase text-amber-400 mb-1">🥉 Rookie Scout Pack</div>
                  <h3 className="text-lg font-black text-white mb-2">3 Chibi Cards</h3>
                  <p className="text-xs text-slate-400">Great for finding raw young talents for your Evolution paths.</p>
                </div>
                <button
                  onClick={() => { sound.playClick(); handleOpenPack('Rookie Scout Pack', 200, 3); }}
                  disabled={teamFunds < 200}
                  className="mt-4 w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-black rounded-xl text-xs shadow transition disabled:opacity-50"
                >
                  Open for $200
                </button>
              </div>

              <div className="bg-slate-900 border border-amber-500/40 rounded-2xl p-5 flex flex-col justify-between hover:border-amber-400 transition shadow-xl relative overflow-hidden">
                <div className="absolute top-2 right-2 bg-amber-400 text-slate-950 text-[9px] font-black px-2 py-0.5 rounded-full uppercase">
                  Popular
                </div>
                <div>
                  <div className="text-xs font-black uppercase text-amber-300 mb-1">🥇 Gold Pro Pack</div>
                  <h3 className="text-lg font-black text-white mb-2">5 Cards (1+ Gold Guaranteed)</h3>
                  <p className="text-xs text-slate-400">Higher chance of Platinum and Diamond esports legends!</p>
                </div>
                <button
                  onClick={() => { sound.playClick(); handleOpenPack('Gold Pro Pack', 1000, 5); }}
                  disabled={teamFunds < 1000}
                  className="mt-4 w-full py-2.5 bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 font-black rounded-xl text-xs shadow transition disabled:opacity-50"
                >
                  Open for $1,000
                </button>
              </div>

              <div className="bg-gradient-to-b from-purple-950 via-slate-900 to-slate-900 border-2 border-pink-500 rounded-2xl p-5 flex flex-col justify-between shadow-[0_0_25px_rgba(236,72,153,0.4)] relative">
                <div className="absolute top-2 right-2 bg-gradient-to-r from-pink-500 to-amber-400 text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase animate-pulse">
                  GOAT Tier
                </div>
                <div>
                  <div className="text-xs font-black uppercase text-pink-400 mb-1">👑 GOAT Legendary Pack</div>
                  <h3 className="text-lg font-black text-white mb-2">5 Elite Cards (High GOAT/Diamond)</h3>
                  <p className="text-xs text-slate-400">Guaranteed highest tier esports legends (Flaker, p1mple, Mirecle).</p>
                </div>
                <button
                  onClick={() => { sound.playClick(); handleOpenPack('GOAT Legendary Pack', 5000, 5); }}
                  disabled={teamFunds < 5000}
                  className="mt-4 w-full py-2.5 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-black rounded-xl text-xs shadow-lg transition hover:brightness-110 disabled:opacity-50"
                >
                  Open for $5,000
                </button>
              </div>
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
      </main>

      {/* PACK OPENING POPUP MODAL */}
      {packModal && (
        <PackOpeningModal
          packName={packModal.name}
          cards={packModal.cards}
          duplicateCoins={packModal.duplicateCoins}
          onClose={() => setPackModal(null)}
        />
      )}
    </div>
  );
}

export default App;
