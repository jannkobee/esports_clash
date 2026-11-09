import {canonicalRoute,sectionHref,workspacePath} from './frontendRoutes';
import {ClubMatchHistory} from './components/ClubMatchHistory';
import {SupporterStudio} from './components/SupporterStudio';
import {SupporterBadge} from './components/SupporterBadge';
import {CommunityCups} from './components/CommunityCups';
import {ClubFinances} from './components/ClubFinances';
import {ClubInboxLink} from './components/ClubOfficeDesk';
import {LabelIcon} from './components/LabelIcon';
import {NewsFeed,BroadcastHub,LaunchArchive} from './components/WorldMedia';
import React, { useEffect, useMemo, useState } from 'react';
import { useGameContent, useGameContentConnection } from './GameContentContext';
import { useAccount } from './AccountContext';
import { contentChampion, validateGameContent, type GameContentSnapshot } from './gameContent';
import { GameCatalogView } from './components/GameCatalogView';
import { refreshIntelligenceRelease, intelligenceReleaseSnapshot, type IntelligenceRelease } from './intelligenceRelease';
import { loadArenaActor } from './arenaLearning';
import {
  CHAMPIONS as BUNDLED_CHAMPIONS,
  INITIAL_COACHES,
  INITIAL_EVOLUTIONS,
  INITIAL_PLAYERS,
  KOVI_PLAYER_CARD
} from './mockData';
import { loadStartingFive, persistClubRoster, reconcileClubRoster } from './clubRosterPersistence';
import {
  AvatarRole,
  ChampionKit,
  CoachCard,
  EvolutionPlan,
  MatchOrders,
  PlayerCard,
  ScheduledFixture,
  TrainingRegimen
} from './types';
import { MatchOrdersModal } from './components/MatchOrdersModal';
import { EvolutionsView } from './components/EvolutionsView';
import { SquadView } from './components/SquadView';
import { CloudSavePanel } from './components/CloudSavePanel';
import { OnlineNormalView } from './components/OnlineNormalView';
import { Hexapedia } from './components/Hexapedia';
import { CompetitionHub } from './components/CompetitionHub';
import { ClubTrainingView } from './components/ClubTrainingView';
import { ClubStaffRoom } from './components/ClubStaffRoom';
import { HexatrickMark } from './components/HexatrickBrand';
import { ClubHome } from './components/ClubHome';
import { DraftPhaseView } from './components/DraftPhaseView';
import { AramMatchView } from './components/AramMatchView';
import type { MatchReport } from './matchReplay';
import { refreshMatchReportAvatarPresentation, rerollAfterBalanceGame } from './matchReplay';
import type { OnlineRoom, OnlineSession } from './onlineRooms';
import { createOnlineRoom, getOnlineRoom, joinOnlineRoom, submitOnlineDraft } from './onlineRooms';
import { ChampionHubView } from './components/ChampionHubView';
import { PRO_TEAMS_DATABASE, type ProTeam } from './proTeamsDatabase';
import { ClubMarketView } from './components/ClubMarketView';
import { TrainingCenterView } from './components/TrainingCenterView';
import { ChibiAvatar } from './components/ChibiAvatar';
import {
  toScale10,
  canBecomeCoach,
  resolveTeamCaptain,
  mapToMacroRegion
} from './marketBatchEngine';
import {
  createEqualizedRoster,
  EQUALIZED_COACH_BLUE,
  EQUALIZED_COACH_RED,
  getEqualizedPlayerPool
} from './equalizedMode';
import { PlayerDraftPhaseView } from './components/PlayerDraftPhaseView';
import { createDevRandomMatch } from './devRandomMode';
import { V3_RULESET, HERO_IDENTITIES_V3 } from './heroIdentityV3';
import { sound } from './audio';
import { settlePackPurchase } from './packEconomy';
import {
  Tv,
  Users,
  Zap,
  Swords,
  Trophy,
  Package,
  Globe,
  FlaskConical,
  Volume2,
  VolumeX,
  Home,
  Settings as SettingsIcon,
  Shield,
  ClipboardList,
  Clock,
  BookOpen,
  Upload,
  LogOut
} from 'lucide-react';

type ArenaChoice = 'ai' | 'equalized_ai' | 'dev_random' | 'online' | null;
type MainSection = 'home' | 'squad' | 'play' | 'market' | 'finances' | 'hexapedia' | 'history' | 'supporter' | 'settings';
type SquadSubTab = 'lineup' | 'training' | 'staff' | 'evolutions';
type PlaySubTab = 'modes' | 'split' | 'community' | 'competitions' | 'news' | 'broadcasts' | 'archive';

const SECTION_HASHES: MainSection[] = ['home', 'squad', 'play', 'market', 'finances', 'hexapedia', 'history', 'supporter', 'settings'];

function readInitialSection(): MainSection {
  if (typeof window === 'undefined') return 'home';
  const raw = workspacePath(window.location.hash).split(/[/?]/)[0].trim().toLowerCase() as MainSection;
  if (raw === ('avatarpedia' as MainSection) || raw === ('discover' as MainSection)) return 'hexapedia';
  return SECTION_HASHES.includes(raw) ? raw : 'home';
}

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
    badgeColor: 'cm-badge cm-badge-gold',
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
    badgeColor: 'cm-badge cm-badge-gold',
    icon: '👑'
  }
];

export function App() {
  const { session: accountSession, signOut } = useAccount();
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountError, setAccountError] = useState('');
  const gameContent = useGameContent();
  const catalogConnection = useGameContentConnection();
  const CHAMPIONS = useMemo(
    () => BUNDLED_CHAMPIONS.map((champion) => contentChampion(champion, gameContent)),
    [gameContent]
  );

  useEffect(() => {
    void refreshIntelligenceRelease();
    const timer = setInterval(() => void refreshIntelligenceRelease(), 15000);
    return () => clearInterval(timer);
  }, []);

  // Navigation (6 Primary Sections + Clean Sub-tabs)
  const [activeSection, setActiveSectionState] = useState<MainSection>(readInitialSection);
  const [squadSubTab, setSquadSubTab] = useState<SquadSubTab>(()=>{const tab=new URLSearchParams(workspacePath(window.location.hash).split('?')[1]??'').get('tab');return tab&&['lineup','training','staff'].includes(tab)?tab as SquadSubTab:'lineup';});
  const [playSubTab, setPlaySubTab] = useState<PlaySubTab>(()=>(['news','broadcasts','archive'].includes(new URLSearchParams(workspacePath(window.location.hash).split('?')[1]??'').get('world')??'')?new URLSearchParams(workspacePath(window.location.hash).split('?')[1]??'').get('world') as PlaySubTab:workspacePath(window.location.hash).includes('community=cups')?'community':workspacePath(window.location.hash).includes('competitions=')?'competitions':workspacePath(window.location.hash).includes('tool=practice')?'modes':'split'));
  const [watchMatchId, setWatchMatchId] = useState<string | undefined>(() => {
    const match = new URLSearchParams(workspacePath(window.location.hash).split('?')[1] ?? '').get('match');
    return match && /^[a-f0-9-]{36}$/i.test(match) ? match : undefined;
  });
  const [showOnlineNormalSandbox, setShowOnlineNormalSandbox] = useState(false);

  const setActiveSection = (section: MainSection) => {
    setActiveSectionState(section);
    if (typeof window !== 'undefined' && window.location.hash !== sectionHref(section)) {
      window.history.replaceState(null, '', sectionHref(section));
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    }
  };

  useEffect(() => {
    const onHashChange = () => {
      const next = readInitialSection();
      setActiveSectionState(next);
      if(next==='squad'){const tab=new URLSearchParams(workspacePath(window.location.hash).split('?')[1]??'').get('tab');if(tab&&['lineup','training','staff'].includes(tab))setSquadSubTab(tab as SquadSubTab);}
      const params=new URLSearchParams(workspacePath(window.location.hash).split('?')[1]??'');
      const match=params.get('match');if(next==='play'&&match&&/^[a-f0-9-]{36}$/i.test(match)){setWatchMatchId(match);setPlaySubTab('split');}
      const worldTab=params.get('world');
      if(next==='play' && ['news','broadcasts','archive'].includes(worldTab??''))setPlaySubTab(worldTab as PlaySubTab);
      if(next==='play'&&workspacePath(window.location.hash).includes('community=cups'))setPlaySubTab('community');
      if(next==='play'&&workspacePath(window.location.hash).includes('tool=practice'))setPlaySubTab('modes');
      if(next==='play'&&window.location.hash==='#match-centre')setPlaySubTab('split');
      if(next==='play' && workspacePath(window.location.hash).includes('competitions='))setPlaySubTab('competitions');
      if(next==='play' && new URLSearchParams(workspacePath(window.location.hash).split('?')[1]??'').has('club')){setPlaySubTab('split');setWatchMatchId(undefined);}
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const [musicEnabled, setMusicEnabled] = useState(() => sound.isMusicEnabled());
  const [audioMuted, setAudioMuted] = useState(() => sound.isMuted());
  const [selectedOpponentTeam] = useState<ProTeam | null>(() => PRO_TEAMS_DATABASE[0] ?? null);
  const [inBattle, setInBattle] = useState<boolean>(false);
  const [arenaChoice, setArenaChoice] = useState<ArenaChoice>(() =>
    sessionStorage.getItem('esports-clash-online-session') ? 'online' : null
  );
  const [draftSeed, setDraftSeed] = useState(0);
  const rivalCoach = INITIAL_COACHES[draftSeed % INITIAL_COACHES.length];
  const [equalizedBlueRoster, setEqualizedBlueRoster] = useState<PlayerCard[]>(() => createEqualizedRoster('blue'));
  const [equalizedRedRoster, setEqualizedRedRoster] = useState<PlayerCard[]>(() => createEqualizedRoster('red'));
  const [equalizedDraftStage, setEqualizedDraftStage] = useState<'player_draft' | 'avatar_draft'>('player_draft');

  // Online Foundation
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [onlineSession, setOnlineSession] = useState<OnlineSession | null>(() => {
    try {
      return JSON.parse(sessionStorage.getItem('esports-clash-online-session') || 'null') as OnlineSession | null;
    } catch {
      return null;
    }
  });
  const [onlineRoom, setOnlineRoom] = useState<OnlineRoom | null>(null);
  const [onlineError, setOnlineError] = useState('');
  const [onlineBusy, setOnlineBusy] = useState(false);

  // Club Resources
  const [teamFunds, setTeamFunds] = useState<number>(3500);

  // Roster State
  const [roster, setRoster] = useState<PlayerCard[]>(() => reconcileClubRoster(INITIAL_PLAYERS, [KOVI_PLAYER_CARD]));
  const [startingFive, setStartingFive] = useState<PlayerCard[]>(() =>
    loadStartingFive(reconcileClubRoster(INITIAL_PLAYERS, [KOVI_PLAYER_CARD]), INITIAL_PLAYERS.slice(0, 5))
  );
  const [currentCoach, setCurrentCoach] = useState<CoachCard>(INITIAL_COACHES[0]);
  const [trainingRegimen, setTrainingRegimen] = useState<TrainingRegimen>({
    primaryFocus: 'lan',
    intensityPercent: 95,
    staminaSharePercent: 15
  });

  useEffect(() => {
    persistClubRoster(roster, startingFive);
  }, [roster, startingFive]);

  // Evolutions & Hattrick Match Orders State
  const [evolutionPlans] = useState<EvolutionPlan[]>(INITIAL_EVOLUTIONS);
  const [activeEvolutions, setActiveEvolutions] = useState<{ [cardId: string]: { planId: string; progress: number[] } }>({});
  const [matchOrdersByFixture, setMatchOrdersByFixture] = useState<Record<string, MatchOrders>>({});
  const [activeOrdersModalFixture, setActiveOrdersModalFixture] = useState<ScheduledFixture | null>(null);
  const [scheduleNotice, setScheduleNotice] = useState<string | null>(null);


  // Active Drafted Lineups
  const [draftedBlue, setDraftedBlue] = useState<{ player: PlayerCard; champion: ChampionKit }[]>([]);
  const [draftedRed, setDraftedRed] = useState<{ player: PlayerCard; champion: ChampionKit }[]>([]);
  const [matchSeed, setMatchSeed] = useState(0);
  const [replayNumber, setReplayNumber] = useState(0);
  const [balanceRunsLeft, setBalanceRunsLeft] = useState(0);
  const [balanceBatchId, setBalanceBatchId] = useState(0);
  const [replayDraft, setReplayDraft] = useState<MatchReport['draft'] | null>(null);
  const [replayContent, setReplayContent] = useState<GameContentSnapshot | null>();
  const [replayIntelligence, setReplayIntelligence] = useState<IntelligenceRelease>();

  const savedReports = (() => {
    try {
      return JSON.parse(localStorage.getItem('esports-clash-match-reports') || '[]') as MatchReport[];
    } catch {
      return [];
    }
  })();

  const balanceSwapped = balanceRunsLeft > 0 && balanceRunsLeft % 2 === 0;

  const openRecordedMatch = (report: MatchReport) => {
    if (report.version !== 1 || !Number.isInteger(report.seed) || report.draft?.blue?.length !== 5 || report.draft?.red?.length !== 5)
      return;
    const frozen = report.intelligence;
    if (frozen?.policy && (!loadArenaActor(frozen.policy) || frozen.sourceHash !== import.meta.env.INTELLIGENCE_SOURCE_HASH)) {
      alert(
        'This report uses a different game version or an invalid model. Its saved results remain available; an exact replay requires its original version.'
      );
      return;
    }
    setReplayIntelligence(
      frozen?.policy
        ? {
            id: frozen.policyId,
            policy: frozen.policy,
            qualification: frozen.qualification,
            run_id: frozen.runId,
            generation: frozen.generation
          }
        : undefined
    );
    const refreshedReport = refreshMatchReportAvatarPresentation(report, CHAMPIONS);
    setDraftedBlue(refreshedReport.draft.blue);
    setDraftedRed(refreshedReport.draft.red);
    if (report.contentCatalog && !validateGameContent(report.contentCatalog)) {
      alert('The saved catalog is invalid.');
      return;
    }
    setReplayDraft(refreshedReport.draft);
    setReplayContent(report.contentCatalog ?? null);
    setMatchSeed(report.seed);
    setReplayNumber(1);
    setBalanceRunsLeft(0);
    setBalanceBatchId(0);
    setActiveSection('play');
    setPlaySubTab('modes');
    setInBattle(true);
  };

  const bench = roster.filter((p) => !startingFive.some((s) => s.id === p.id));

  useEffect(() => {
    if (!onlineSession) return;
    let stopped = false;
    const refresh = async () => {
      try {
        const room = await getOnlineRoom(onlineSession);
        if (!stopped) {
          setOnlineRoom(room);
          setOnlineError('');
        }
      } catch (error) {
        if (!stopped) setOnlineError((error as Error).message);
      }
    };
    void refresh();
    const timer = window.setInterval(refresh, 1200);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [onlineSession]);

  const [onlineMatchType, setOnlineMatchType] = useState<'ranked' | 'normal'>('ranked');
  const [useEqualizedRoster, setUseEqualizedRoster] = useState<boolean>(false);

  const beginOnline = async (code?: string, matchType: 'ranked' | 'normal' = onlineMatchType) => {
    setOnlineBusy(true);
    setOnlineError('');
    try {
      const activeRoster =
        matchType === 'normal' && useEqualizedRoster ? createEqualizedRoster(code ? 'red' : 'blue') : startingFive;
      const activeCoach =
        matchType === 'normal' && useEqualizedRoster
          ? code
            ? EQUALIZED_COACH_RED
            : EQUALIZED_COACH_BLUE
          : currentCoach;

      const joined = code
        ? await joinOnlineRoom(code.trim(), activeRoster, activeCoach, 1000)
        : await createOnlineRoom(activeRoster, activeCoach, matchType, 1000);
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
    } catch (error) {
      setOnlineError((error as Error).message);
    } finally {
      setOnlineBusy(false);
    }
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

  // Update a player's assigned Role Position (Role as Position)
  const handleUpdatePlayerRole = (playerId: string, role: AvatarRole) => {
    setRoster((prev) =>
      prev.map((p) => (p.id === playerId ? { ...p, preferredRole: role, role } : p))
    );
    setStartingFive((prev) =>
      prev.map((p) => (p.id === playerId ? { ...p, preferredRole: role, role } : p))
    );
  };

  const handleAppointCoach = (newCoach: CoachCard, retiredPlayerId?: string) => {
    setCurrentCoach(newCoach);
    if (retiredPlayerId) {
      setRoster((prev) => prev.filter((p) => p.id !== retiredPlayerId));
      setStartingFive((prev) => prev.filter((p) => p.id !== retiredPlayerId));
    }
  };

  // Duplicate calculation and recycling for Club Reserves
  const nameGroups: { [name: string]: PlayerCard[] } = {};
  roster.forEach((c) => {
    if (!nameGroups[c.name]) nameGroups[c.name] = [];
    nameGroups[c.name].push(c);
  });
  let duplicateCount = 0;
  let duplicateValue = 0;
  Object.values(nameGroups).forEach((cards) => {
    if (cards.length > 1) {
      const sorted = [...cards].sort((a, b) => b.ovr - a.ovr);
      const dupes = sorted.slice(1);
      duplicateCount += dupes.length;
      dupes.forEach((d) => {
        duplicateValue +=
          d.tier === 'GOAT'
            ? 2500
            : d.tier === 'Diamond'
            ? 1200
            : d.tier === 'Platinum'
            ? 600
            : d.tier === 'Gold'
            ? 300
            : d.tier === 'Silver'
            ? 120
            : 60;
      });
    }
  });

  const handleRecycleDuplicates = () => {
    if (duplicateCount === 0) return;
    const keptCards: PlayerCard[] = [];
    Object.keys(nameGroups).forEach((name) => {
      const cards = nameGroups[name];
      const best = [...cards].sort((a, b) => b.ovr - a.ovr)[0];
      keptCards.push(best);
    });
    setTeamFunds((f) => f + duplicateValue);
    setRoster(keptCards);
    setStartingFive((prev) => prev.map((s) => keptCards.find((k) => k.name === s.name) || s));
    alert(`Released ${duplicateCount} duplicate practice cards for ${duplicateValue.toLocaleString()} practice credits.`);
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
      const currentRoles =
        card.playableRoles && card.playableRoles.length > 0
          ? card.playableRoles
          : [card.preferredRole || card.role || 'Mage'];
      const updatedRoles =
        plan.unlockedRole && !currentRoles.includes(plan.unlockedRole)
          ? [...currentRoles, plan.unlockedRole]
          : currentRoles;

      const updatedSignatures =
        chosenSignature && !card.signatureChampions.includes(chosenSignature)
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
    red: { player: PlayerCard; champion: ChampionKit }[],
    seed: number
  ) => {
    if (arenaChoice === 'online' && onlineRoom?.intelligence?.source_hash !== import.meta.env.INTELLIGENCE_SOURCE_HASH) {
      setOnlineError('The room uses a different game version. Reload both clients and create a new room.');
      return;
    }
    setDraftedBlue(blue);
    setDraftedRed(red);
    setReplayDraft(null);
    setReplayContent(undefined);
    setReplayIntelligence(undefined);
    setMatchSeed(seed);
    setReplayNumber(0);
    setBalanceRunsLeft(0);
    setBalanceBatchId(0);
    setActiveSection('play');
    setPlaySubTab('modes');
    setInBattle(true);
  };

  const launchDeveloperRandomMatch = () => {
    const seed = crypto.getRandomValues(new Uint32Array(1))[0];
    const matchup = createDevRandomMatch(INITIAL_PLAYERS, CHAMPIONS, seed);
    setArenaChoice('dev_random');
    handleDraftComplete(matchup.blue, matchup.red, seed);
  };

  const [v3RosterChoices, setV3RosterChoices] = useState<Record<string, string>>({});
  const launchV3PrototypeMatch = () => {
    const seed = crypto.getRandomValues(new Uint32Array(1))[0];
    const matchup = createDevRandomMatch(INITIAL_PLAYERS, CHAMPIONS, seed);
    setArenaChoice('dev_random');
    const choose = (side: 'blue' | 'red', lineup: typeof matchup.blue) =>
      lineup.map((entry, index) => ({
        ...entry,
        champion: CHAMPIONS.find((c) => c.id === v3RosterChoices[`${side}:${index}`]) ?? entry.champion
      }));
    handleDraftComplete(choose('blue', matchup.blue), choose('red', matchup.red), seed);
  };



  const avgSquadOvr = Math.round(startingFive.reduce((sum, p) => sum + p.ovr, 0) / Math.max(1, startingFive.length));
  const activeEvoCount = Object.keys(activeEvolutions).length;

  const sectionTitle: Record<MainSection, string> = {
    home: 'Club Office · Dashboard & Schedule',
    squad:
      squadSubTab === 'lineup'
        ? 'Squad · Tactical Lineup & Reserves'
        : squadSubTab === 'training'
        ? 'Squad · Practice training & coaches'
        : 'Squad · Player Evolutions',
    play:
      playSubTab === 'modes'
        ? inBattle
          ? 'Live Broadcast · Clash Arena'
          : 'Play · Arena practice'
        : 'Play · Scheduled Matchday',
    finances: 'Finances | Cash, income and expenses',
    market: 'Transfer Exchange · Player signings & club-to-club trades',
    hexapedia: 'Hexapedia | The Hexatrick reference',
    history: 'Match history | Every club fixture',
    supporter: 'Supporter studio | Identity and themes',
    settings: 'Settings · Club Options & Diagnostics'
  };

  return (
    <div className="cm-shell">
      <a href="#main-content" className="cm-skip-link" onClick={event => { event.preventDefault(); document.getElementById('main-content')?.focus(); }}>Skip to content</a>
      {/* LEFT SIDEBAR NAVIGATION */}
      <aside className="cm-sidebar" aria-label="Club navigation">
        <div className="cm-brand">
          <a href="#welcome" className="cm-brand-title" aria-label="Hexatrick landing page"><HexatrickMark/><span>hexatrick</span></a>
          <div className="cm-brand-sub">Your club. Every matchday.</div>
        </div>

        <nav className="cm-nav">
          <div className="cm-nav-section">Club Management</div>
          <button
            type="button"
            onClick={() => {
              sound.playClick();
              setActiveSection('home');
              setInBattle(false);
            }}
            className={`cm-nav-btn ${activeSection === 'home' ? 'active' : ''}`}
            aria-current={activeSection === 'home' ? 'page' : undefined}
          >
            <span className="flex items-center gap-2">
              <Home className="w-4 h-4 shrink-0" />
              <span>Home</span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              sound.playClick();
              setActiveSection('squad');
              setInBattle(false);
            }}
            className={`cm-nav-btn ${activeSection === 'squad' ? 'active' : ''}`}
            aria-current={activeSection === 'squad' ? 'page' : undefined}
          >
            <span className="flex items-center gap-2">
              <Users className="w-4 h-4 shrink-0" />
              <span>Squad</span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              sound.playClick();
              setActiveSection('play');
            }}
            className={`cm-nav-btn ${activeSection === 'play' ? 'active' : ''}`}
            aria-current={activeSection === 'play' ? 'page' : undefined}
          >
            <span className="flex items-center gap-2">
              <Swords className="w-4 h-4 shrink-0" />
              <span>Play</span>
            </span>
            {inBattle && <span className="cm-nav-badge">LIVE</span>}
          </button>

          <button
            type="button"
            onClick={() => {
              sound.playClick();
              setActiveSection('market');
              setInBattle(false);
            }}
            className={`cm-nav-btn ${activeSection === 'market' ? 'active' : ''}`}
            aria-current={activeSection === 'market' ? 'page' : undefined}
          >
            <span className="flex items-center gap-2">
              <Package className="w-4 h-4 shrink-0" />
              <span>Transfer Exchange</span>
            </span>
          </button>

          <button className={`cm-nav-btn ${activeSection==='finances'?'active':''}`} aria-current={activeSection==='finances'?'page':undefined} onClick={()=>{setActiveSection('finances');setInBattle(false);}}><span className="flex items-center gap-2"><LabelIcon name="money"/>Finances</span></button>
          <button className={`cm-nav-btn ${activeSection==='history'?'active':''}`} aria-current={activeSection==='history'?'page':undefined} onClick={()=>{setActiveSection('history');setInBattle(false);}}><span className="flex items-center gap-2"><LabelIcon name="history"/>Match history</span></button>
          <div className="cm-nav-section">Living world</div>
          {([['news','The Wire'],['broadcasts','Hexacast'],['archive','Crown 2026']] as const).map(([tab,label])=><button key={tab} className={`cm-nav-btn ${activeSection==='play'&&playSubTab===tab?'active':''}`} onClick={()=>{setActiveSection('play');setPlaySubTab(tab);setInBattle(false);window.location.hash=({news:'wire',broadcasts:'hexacast',archive:'launch-championship'})[tab];}}><span className="flex items-center gap-2"><LabelIcon name={label}/>{label}</span></button>)}
          <div className="cm-nav-section">Scouting &amp; System</div>
          <button
            type="button"
            onClick={() => {
              sound.playClick();
              setActiveSection('hexapedia');
              setInBattle(false);
            }}
            className={`cm-nav-btn ${activeSection === 'hexapedia' ? 'active' : ''}`}
            aria-current={activeSection === 'hexapedia' ? 'page' : undefined}
          >
            <span className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 shrink-0" />
              <span>Hexapedia</span>
            </span>
          </button>

          <button className={`cm-nav-btn ${activeSection==='supporter'?'active':''}`} aria-current={activeSection==='supporter'?'page':undefined} onClick={()=>{setActiveSection('supporter');setInBattle(false);}}><span className="flex items-center gap-2"><LabelIcon name="supporter"/>Supporter studio</span></button>
          <button
            type="button"
            onClick={() => {
              sound.playClick();
              setActiveSection('settings');
              setInBattle(false);
            }}
            className={`cm-nav-btn ${activeSection === 'settings' ? 'active' : ''}`}
            aria-current={activeSection === 'settings' ? 'page' : undefined}
          >
            <span className="flex items-center gap-2">
              <SettingsIcon className="w-4 h-4 shrink-0" />
              <span>Settings</span>
            </span>
          </button>
        </nav>

        <div className="cm-sidebar-footer">
          <div className="flex items-center justify-between mb-1">
            <span>World records:</span>
            <a href="#hexapedia">Hexapedia</a>
          </div>
          <div className="flex items-center justify-between">
            <span>Training:</span>
            <span>Scheduled matches</span>
          </div>
        </div>
      </aside>

      {/* MAIN WORKSPACE */}
      <div className="cm-main">
        {/* STICKY TOP STATUS BAR */}
        <header className="cm-topbar">
          <div className="cm-breadcrumb" title={sectionTitle[activeSection]}>Club management <span>Manila · UTC+8</span></div>

          <div className="cm-topbar-stats">{accountSession?.user.supporter?.active&&<SupporterBadge trial={accountSession.user.supporter.kind==='trial'} level={accountSession.user.supporter.level} unlimited={accountSession.user.supporter.unlimited}/>}<ClubInboxLink/>
            <span className="hidden lg:inline text-xs text-slate-400 max-w-36 truncate" title={accountSession?.user.email}>{accountSession?.user.name}</span>
            <button
              type="button"
              onClick={() => {
                sound.playClick();
                setActiveSection('play');
                setPlaySubTab('split');
                setInBattle(false);
              }}
              className="cm-btn cm-topbar-calendar"
              title="Open the fixture calendar"
            >
              <Clock className="w-3.5 h-3.5" aria-hidden="true" /> Fixture calendar
            </button>

            <button
              type="button"
              aria-label={audioMuted ? 'Enable all sounds' : 'Mute all sounds'}
              aria-pressed={!audioMuted}
              onClick={() => setAudioMuted(sound.toggleMuted())}
              className="cm-btn py-1 px-2 text-xs"
              title={audioMuted ? 'Enable sound effects' : 'Mute sound effects'}
            >
              {audioMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{audioMuted ? 'Muted' : 'Sound'}</span>
            </button>
            <button type="button" className="cm-btn py-1 px-2 text-xs" disabled={accountBusy} aria-label="Sign out of your account" title="Sign out" onClick={async () => {
              setAccountBusy(true); setAccountError('');
              try { await signOut(); } catch (error) { setAccountError((error as Error).message); } finally { setAccountBusy(false); }
            }}><LogOut className="w-3.5 h-3.5" /><span className="hidden sm:inline">{accountBusy ? 'Signing out…' : 'Sign out'}</span></button>
          </div>
        </header>

        {/* PAGE CONTENT */}
        <main id="main-content" tabIndex={-1} className={`cm-content ${inBattle ? 'cm-content--arena' : ''} ${activeSection === 'play' && inBattle ? 'max-w-[1640px]' : 'max-w-7xl'} mx-auto w-full`}>
          {accountError && <p role="alert" className="club-notice mb-4">{accountError}</p>}
          {!inBattle && activeSection!=='hexapedia' && !['news','broadcasts','archive'].includes(activeSection==='play'?playSubTab:'') && <div className="cm-page-heading">
            <p className="cm-eyebrow">Hexatrick / Club management</p>
            <h1><LabelIcon name={activeSection} size={24}/>{({ home: 'Club home', squad: 'Your squad', play: 'Match centre', market: 'Transfer Exchange', finances: 'Finances', hexapedia: 'Hexapedia', history: 'Club match history', supporter: 'Supporter studio', settings: 'Settings' })[activeSection]}</h1>
            <p>{({
              home: 'Prepare your club for the next matchday.',
              squad: 'Manage your contracted players, training and official match orders.',
              play: 'Prepare your orders, follow the Arena, and revisit every result.',
              finances: 'Review income, expenses and your payroll commitments.',
              market: 'Buy, sell and develop your club roster.',
              hexapedia: 'Clubs, competitions, players, and the stories behind the Arena.',
              history: 'Follow every fixture, result and recording in your club archive.',
              supporter: 'Your membership, club cosmetics and player presentation.',
              settings: 'Manage your account, audio, and practice preferences.',
            })[activeSection]}</p>
          </div>}
          {/* =========================================================
              1. CLUB HOME (HATTRICK SCHEDULED FIXTURES & MATCH ORDERS)
             ========================================================= */}
          {activeSection === 'finances' && <ClubFinances/>}
          {activeSection === 'history' && <ClubMatchHistory onWatch={id=>{setWatchMatchId(id);setInBattle(false);setPlaySubTab('split');setActiveSection('play');window.location.hash='match-centre?match='+encodeURIComponent(id);}}/>}
          {activeSection === 'home' && <ClubHome
            onPlay={tool=>{setWatchMatchId(undefined);setPlaySubTab('split');setInBattle(false);setActiveSection('play');window.location.hash=canonicalRoute('play?club='+tool);}}
            onMarket={()=>setActiveSection('market')}
            onWatch={id=>{setWatchMatchId(id);setInBattle(false);setPlaySubTab('split');setActiveSection('play');window.location.hash='match-centre?match='+encodeURIComponent(id);}}
          />}
          {/* =========================================================
              2. SQUAD (LINEUP & RESERVES + PLAYER EVOLUTIONS)
             ========================================================= */}
          {activeSection === 'squad' && (
            <div>
              <div className="cm-tabs" role="group" aria-label="Squad management sections">
                <button
                  type="button"

                  aria-pressed={squadSubTab === 'lineup'}
                  onClick={() => {
                    sound.playClick();
                    setSquadSubTab('lineup');
                  }}
                  className={`cm-tab ${squadSubTab === 'lineup' ? 'active' : ''}`}
                >
                  <Users className="w-3.5 h-3.5 inline mr-1.5" />
                  Lineup &amp; reserves
                </button>
                <button
                  type="button"

                  aria-pressed={squadSubTab === 'training'}
                  onClick={() => {
                    sound.playClick();
                    setSquadSubTab('training');
                  }}
                  className={`cm-tab ${squadSubTab === 'training' ? 'active' : ''}`}
                >
                  <FlaskConical className="w-3.5 h-3.5 inline mr-1.5" />
                  Practice training
                </button>
                <button
                  type="button"
                  aria-pressed={squadSubTab === 'staff'}
                  onClick={() => {
                    sound.playClick();
                    setSquadSubTab('staff');
                  }}
                  className={`cm-tab ${squadSubTab === 'staff' ? 'active' : ''}`}
                >
                  <Users className="w-3.5 h-3.5 inline mr-1.5" />
                  Staff
                </button>

              </div>

              {squadSubTab === 'lineup' && <OnlineNormalView scheduled initialTool="lineup"/>}
              {squadSubTab === 'training' && <ClubTrainingView/>}
              {squadSubTab === 'staff' && <ClubStaffRoom/>}
              {squadSubTab === 'evolutions' && (
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
            </div>
          )}

          {/* =========================================================
              3. PLAY (MATCH MODES, RIOT GLOBAL CIRCUIT, FRIENDS HUB)
             ========================================================= */}
          {activeSection === 'play' && (
            <div>
              {!inBattle&&!['news','archive'].includes(playSubTab)&&<nav className="cm-tabs match-centre-nav" aria-label="Match centre">
                <button className={`cm-tab ${playSubTab==='split'&&!workspacePath(window.location.hash).includes('club=friendly')?'active':''}`} onClick={()=>{setWatchMatchId(undefined);setPlaySubTab('split');window.location.hash='match-centre?club=calendar';}}><LabelIcon name="calendar"/>Fixtures</button>
                <button className={`cm-tab ${playSubTab==='split'&&workspacePath(window.location.hash).includes('club=friendly')?'active':''}`} onClick={()=>{setWatchMatchId(undefined);setPlaySubTab('split');window.location.hash='scrimmages';}}><Swords size={14}/>Scrimmages</button>
                <button className={`cm-tab ${playSubTab==='competitions'?'active':''}`} onClick={()=>{setPlaySubTab('competitions');window.location.hash='competitions?tab=circuit';}}><Trophy size={14}/>Competitions</button>
                <button className={`cm-tab ${playSubTab==='broadcasts'?'active':''}`} onClick={()=>{setPlaySubTab('broadcasts');window.location.hash='hexacast';}}><LabelIcon name="broadcast"/>Hexacast</button>
                <button className={`cm-tab ${playSubTab==='community'?'active':''}`} onClick={()=>{setPlaySubTab('community');window.location.hash='community-cups';}}><Trophy size={14}/>Community cups</button>
                {playSubTab==='modes'&&<span className="cm-tab active">Practice tools</span>}
              </nav>}
              {playSubTab==='community'&&!inBattle&&<CommunityCups/>}
              {playSubTab==='news'&&!inBattle&&<NewsFeed onWatch={id=>{setWatchMatchId(id);setPlaySubTab('split');window.location.hash='match-centre?match='+id;}}/>}
              {playSubTab==='broadcasts'&&!inBattle&&<BroadcastHub/>}
              {playSubTab==='archive'&&!inBattle&&<LaunchArchive onWatch={id=>{setWatchMatchId(id);setPlaySubTab('split');window.location.hash='match-centre?match='+id;}}/>}
              {playSubTab === 'competitions' && !inBattle && <CompetitionHub onWatch={id=>{setWatchMatchId(id);setPlaySubTab('split');window.location.hash='match-centre?match='+id;}} />}
              {playSubTab === 'split' && !inBattle && <OnlineNormalView key={watchMatchId ?? 'calendar'} matchCentre scheduled initialMatchId={watchMatchId} />}

              {(playSubTab === 'modes' || inBattle) && (
                <div>
                  {!inBattle ? (
                    <>
                      {arenaChoice === null ? (
                        <div className="space-y-4">
                          {/* Hattrick Friendly Scrimmage Arranger Banner */}
                          <div className="cm-panel">
                            <div className="cm-panel-header">
                              <span>Arena practice</span>
                              <span className="cm-badge cm-badge-green">
                                Tactical Lab · World Rank #{selectedOpponentTeam?.globalRank || 1}
                              </span>
                            </div>
                            <div className="cm-panel-body space-y-3">
                              <div className="text-xs text-slate-300 bg-[#0f172a] border border-white/10 rounded-lg p-3">
                                Use Arena practice to try lineups and drafts. Official fixtures and club friendlies are in Scheduled matchday.
                              </div>
                              <div className="flex flex-wrap items-center justify-between gap-4">
                                <div className="flex items-center gap-3.5">
                                  <div className="w-12 h-12 bg-[#0b1f44] border-2 border-[#f2c14e] flex items-center justify-center font-black text-[#f2c14e] text-base">
                                    #{selectedOpponentTeam?.globalRank || 1}
                                  </div>
                                  <div>
                                    <div className="text-[11px] font-bold uppercase text-slate-400">
                                      Arranged Friendly Scrimmage · {mapToMacroRegion(selectedOpponentTeam?.league || 'ASIA')}
                                    </div>
                                    <h3 className="text-lg font-black text-white flex items-center gap-2">
                                      <span>{selectedOpponentTeam?.name || 'T1 Tigers'}</span>
                                      <span className="cm-badge cm-badge-navy">{toScale10(selectedOpponentTeam?.avgOvr || 97)}/10 Rating</span>
                                    </h3>
                                    <p className="text-xs text-slate-300">
                                      Coach: <strong>{selectedOpponentTeam?.coach.name}</strong> ({selectedOpponentTeam?.coach.style})
                                    </p>
                                  </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      sound.playClick();
                                      setActiveOrdersModalFixture({
                                        id: 'friendly_scrim_orders',
                                        competitionId: 'friendly',
                                        competitionName: 'Arranged Tactical Scrimmage',
                                        competitionType: 'friendly',
                                        roundLabel: 'Friendly Tactical Test',
                                        opponentName: selectedOpponentTeam?.name || 'T1 Tigers',
                                        opponentRegion: mapToMacroRegion(selectedOpponentTeam?.league || 'ASIA'),
                                        opponentRating10: toScale10(selectedOpponentTeam?.avgOvr || 95),
                                        seriesFormat: 'Bo1',
                                        scheduledTimeLabel: 'On-Demand Friendly',
                                        countdownLabel: 'Ready to Test',
                                        prizeCoins: 500
                                      });
                                    }}
                                    className="cm-btn"
                                  >
                                    <ClipboardList className="w-4 h-4 text-emerald-400" />
                                    <span>Set practice orders</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      sound.playClick();
                                      window.location.hash='competitions?tab=calendar';
                                    }}
                                    className="cm-btn"
                                  >
                                    <Globe className="w-4 h-4" /> Tournament calendar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      sound.playClick();
                                      setDraftSeed(crypto.getRandomValues(new Uint32Array(1))[0]);
                                      setArenaChoice('ai');
                                    }}
                                    className="cm-btn cm-btn-primary"
                                  >
                                    <Swords className="w-4 h-4" /> Arrange Friendly Scrimmage ▸
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* 4 Match Mode Selection Cards */}
                          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                            <div className="cm-panel flex flex-col justify-between">
                              <div className="cm-panel-header">
                                <span>Single-Player Scrimmage</span>
                                <span className="cm-badge cm-badge-gold">Squad Match</span>
                              </div>
                              <div className="cm-panel-body flex-1 flex flex-col justify-between space-y-3">
                                <div>
                                  <h2 className="text-base font-black text-[#0b1f44]">
                                    Vs AI ({selectedOpponentTeam?.name || 'Pro Team'})
                                  </h2>
                                  <p className="text-xs text-[#313a48] mt-1.5 leading-relaxed">
                                    Play a full 5v5 draft and match using your Starting Five lineup against{' '}
                                    {selectedOpponentTeam?.name || 'a practice opponent'}.
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    sound.playClick();
                                    setDraftSeed(crypto.getRandomValues(new Uint32Array(1))[0]);
                                    setArenaChoice('ai');
                                  }}
                                  className="cm-btn cm-btn-primary w-full"
                                >
                                  Launch Vs AI Draft ▸
                                </button>
                              </div>
                            </div>

                            <div className="cm-panel flex flex-col justify-between">
                              <div className="cm-panel-header">
                                <span>Multiplayer Exhibition</span>
                                <span className="cm-badge cm-badge-gold">Online Lobby</span>
                              </div>
                              <div className="cm-panel-body flex-1 flex flex-col justify-between space-y-3">
                                <div>
                                  <h2 className="text-base font-black text-[#0b1f44]">Match Lobby (Vs Player)</h2>
                                  <p className="text-xs text-[#313a48] mt-1.5 leading-relaxed">
                                    Create or join a live peer-to-peer multiplayer room with custom rosters and live draft.
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    sound.playClick();
                                    setOnlineMatchType('normal');
                                    setArenaChoice('online');
                                  }}
                                  className="cm-btn cm-btn-navy w-full"
                                >
                                  Open Match Room ▸
                                </button>
                              </div>
                            </div>

                            <div className="cm-panel flex flex-col justify-between">
                              <div className="cm-panel-header">
                                <span>Dream Draft Mode</span>
                                <span className="cm-badge cm-badge-blue">100 OVR</span>
                              </div>
                              <div className="cm-panel-body flex-1 flex flex-col justify-between space-y-3">
                                <div>
                                  <h2 className="text-base font-black text-[#0b1f44]">Equalized Draft</h2>
                                  <p className="text-xs text-[#313a48] mt-1.5 leading-relaxed">
                                    Bypass your club roster and draft a 100 OVR dream team from 63 esports superstars, followed by avatar drafting.
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    sound.playClick();
                                    setDraftSeed(crypto.getRandomValues(new Uint32Array(1))[0]);
                                    setEqualizedDraftStage('player_draft');
                                    setArenaChoice('equalized_ai');
                                  }}
                                  className="cm-btn w-full"
                                >
                                  Start 100 OVR Draft ▸
                                </button>
                              </div>
                            </div>

                            <div className="cm-panel flex flex-col justify-between">
                              <div className="cm-panel-header">
                                <span>Friendly Exhibition</span>
                                <span className="cm-badge cm-badge-green">Unranked</span>
                              </div>
                              <div className="cm-panel-body flex-1 flex flex-col justify-between space-y-3">
                                <div>
                                  <h2 className="text-base font-black text-[#0b1f44]">Normal (Vs Player)</h2>
                                  <p className="text-xs text-[#313a48] mt-1.5 leading-relaxed">
                                    Casual multiplayer exhibition. Play friendlies and test squads with zero rating risk.
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    sound.playClick();
                                    setOnlineMatchType('normal');
                                    setArenaChoice('online');
                                  }}
                                  className="cm-btn w-full"
                                >
                                  Open Friendly Room ▸
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Compact Match Replay & Dev Quick Bar */}
                          <div className="cm-panel">
                            <div className="cm-panel-body py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-bold text-[#313a48]">Match Replays &amp; Sandbox:</span>
                                {savedReports.length > 0 && (
                                  <button
                                    type="button"
                                    className="cm-btn py-1 px-2.5 text-xs"
                                    onClick={() => openRecordedMatch(savedReports[savedReports.length - 1])}
                                  >
                                    Replay Last Saved Match
                                  </button>
                                )}
                                <label className="cm-btn py-1 px-2.5 text-xs cursor-pointer">
                                  <Upload className="w-3.5 h-3.5" />
                                  <span>Open Match Report (.json)</span>
                                  <input
                                    type="file"
                                    accept="application/json,.json"
                                    className="hidden"
                                    onChange={async (event) => {
                                      const file = event.target.files?.[0];
                                      if (!file) return;
                                      try {
                                        openRecordedMatch(JSON.parse(await file.text()) as MatchReport);
                                      } catch {
                                        alert('This is not a valid match report.');
                                      }
                                    }}
                                  />
                                </label>
                              </div>

                              {import.meta.env.DEV && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    sound.playClick();
                                    launchDeveloperRandomMatch();
                                  }}
                                  className="cm-btn py-1 px-3 text-xs"
                                >
                                  <FlaskConical className="w-3.5 h-3.5" />
                                  <span>Instant Dev Random 5v5</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : arenaChoice === 'dev_random' ? (
                        <div className="cm-panel max-w-2xl mx-auto">
                          <div className="cm-panel-header">
                            <span>Developer Random 5v5 Sandbox</span>
                            <span className="cm-badge cm-badge-gold">Sandbox</span>
                          </div>
                          <div className="cm-panel-body space-y-4">
                            <p className="text-xs text-[#313a48]">
                              Generate a fresh equalized matchup with ten unique random avatars. Developer matches do not award progression or affect standings.
                            </p>
                            <details className="text-xs bg-white border border-[#b4bcc8] p-3">
                              <summary className="font-bold cursor-pointer text-[#0b1f44]">
                                Choose V3 lineups by original name
                              </summary>
                              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {(['blue', 'red'] as const).map((side) => (
                                  <div key={side}>
                                    <strong className="uppercase text-[#0b1f44]">{side} squad</strong>
                                    {Array.from({ length: 5 }, (_, index) => (
                                      <label key={index} className="mt-2 block">
                                        Slot {index + 1}
                                        <select
                                          className="cm-select mt-1 w-full"
                                          aria-label={`V3 ${side} slot ${index + 1}`}
                                          value={v3RosterChoices[`${side}:${index}`] ?? ''}
                                          onChange={(event) =>
                                            setV3RosterChoices((old) => ({
                                              ...old,
                                              [`${side}:${index}`]: event.target.value
                                            }))
                                          }
                                        >
                                          <option value="">Seeded random</option>
                                          {HERO_IDENTITIES_V3.map((hero) => (
                                            <option key={hero.key} value={hero.key}>
                                              {hero.displayName} — {hero.title}
                                            </option>
                                          ))}
                                        </select>
                                      </label>
                                    ))}
                                  </div>
                                ))}
                              </div>
                            </details>
                            <div className="flex flex-wrap justify-end gap-2">
                              <button type="button" onClick={() => setArenaChoice(null)} className="cm-btn">
                                ← Back to Modes
                              </button>
                              <button type="button" onClick={launchV3PrototypeMatch} className="cm-btn cm-btn-navy">
                                V3 Full-Roster 5v5
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  sound.playClick();
                                  launchDeveloperRandomMatch();
                                }}
                                className="cm-btn cm-btn-primary"
                              >
                                Launch New Random 5v5
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : arenaChoice === 'online' && (!onlineSession || !onlineRoom?.ready) ? (
                        <div className="cm-panel max-w-xl mx-auto">
                          <div className="cm-panel-header">
                            <span>
                              {onlineMatchType === 'ranked' ? 'Ranked Match' : 'Normal Match'} (Vs Player)
                            </span>
                            {!onlineSession && (
                              <div className="flex gap-1">
                                <button
                                  type="button"
                                  onClick={() => setOnlineMatchType('ranked')}
                                  className={`cm-btn py-0.5 px-2 text-[11px] ${
                                    onlineMatchType === 'ranked' ? 'cm-btn-primary' : ''
                                  }`}
                                >
                                  Ranked
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setOnlineMatchType('normal')}
                                  className={`cm-btn py-0.5 px-2 text-[11px] ${
                                    onlineMatchType === 'normal' ? 'cm-btn-primary' : ''
                                  }`}
                                >
                                  Normal
                                </button>
                              </div>
                            )}
                          </div>

                          <div className="cm-panel-body space-y-4">
                            <p className="text-xs text-[#313a48]">
                              {onlineMatchType === 'ranked'
                                ? 'Multiplayer Competitive Ladder · Chess Rating on the line.'
                                : 'Casual Multiplayer Exhibition · Zero Rating Risk.'}
                            </p>

                            {onlineSession ? (
                              <div className="space-y-3 bg-white border border-[#b4bcc8] p-4 text-center">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="uppercase font-bold text-[#566173]">Room Code:</span>
                                  <span className="cm-badge cm-badge-gold">
                                    {(onlineRoom?.matchType || onlineSession.matchType) === 'ranked'
                                      ? 'Ranked Match'
                                      : 'Normal Match'}
                                  </span>
                                </div>
                                <p className="text-3xl font-mono font-black text-[#0b1f44] tracking-widest py-2 bg-[#eef1f5] border border-[#9aa4b4]">
                                  {onlineSession.code}
                                </p>
                                <p className="text-xs text-[#566173]">
                                  Share this room code with your opponent. Waiting for their five-player roster...
                                </p>
                                <button
                                  type="button"
                                  className="cm-btn cm-btn-navy w-full"
                                  onClick={() => navigator.clipboard.writeText(onlineSession.code)}
                                >
                                  Copy Room Code
                                </button>
                              </div>
                            ) : (
                              <div className="space-y-4">
                                {onlineMatchType === 'normal' && (
                                  <label className="flex items-center gap-2.5 p-2.5 bg-white border border-[#b4bcc8] text-xs cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={useEqualizedRoster}
                                      onChange={(e) => setUseEqualizedRoster(e.target.checked)}
                                      className="w-4 h-4"
                                    />
                                    <span className="font-bold text-[#0b1f44]">
                                      Equalize to 100 OVR (Squad lineup bypassed)
                                    </span>
                                  </label>
                                )}

                                <button
                                  type="button"
                                  disabled={onlineBusy}
                                  className="cm-btn cm-btn-primary w-full py-2.5"
                                  onClick={() => void beginOnline(undefined, onlineMatchType)}
                                >
                                  <Swords className="w-4 h-4" />
                                  <span>Create Room</span>
                                </button>

                                <div className="flex items-center gap-2">
                                  <div className="h-px flex-1 bg-[#b4bcc8]" />
                                  <span className="text-[11px] uppercase font-bold text-[#566173]">
                                    Or Join Existing Room
                                  </span>
                                  <div className="h-px flex-1 bg-[#b4bcc8]" />
                                </div>

                                <div className="flex gap-2">
                                  <input
                                    aria-label="Room code"
                                    value={roomCodeInput}
                                    onChange={(event) => setRoomCodeInput(event.target.value.toUpperCase())}
                                    maxLength={6}
                                    placeholder="6-character room code"
                                    className="cm-input flex-1 uppercase font-mono tracking-widest"
                                  />
                                  <button
                                    type="button"
                                    disabled={onlineBusy || !/^[A-F0-9]{6}$/.test(roomCodeInput)}
                                    className="cm-btn cm-btn-navy"
                                    onClick={() => void beginOnline(roomCodeInput)}
                                  >
                                    Join Room
                                  </button>
                                </div>
                              </div>
                            )}

                            {onlineError && (
                              <p role="alert" className="text-[#b91c1c] text-xs font-bold text-center">
                                {onlineError}
                              </p>
                            )}
                            <div className="pt-2 border-t border-[#c4cbd6] flex justify-between">
                              <button type="button" className="cm-btn text-xs" onClick={leaveOnline}>
                                ← Back to Match Modes
                              </button>
                            </div>
                          </div>
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
                          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 bg-[#dde2ea] border border-[#9aa4b4] px-3 py-2">
                            <div className="flex items-center gap-2">
                              {arenaChoice === 'equalized_ai' ? (
                                <>
                                  <button
                                    type="button"
                                    className="cm-btn py-1 px-2.5 text-xs"
                                    onClick={() => setEqualizedDraftStage('player_draft')}
                                  >
                                    ← Back to Player Draft
                                  </button>
                                  <button
                                    type="button"
                                    className="cm-btn py-1 px-2.5 text-xs"
                                    onClick={() => setArenaChoice(null)}
                                  >
                                    Back to Modes
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  className="cm-btn py-1 px-2.5 text-xs"
                                  onClick={arenaChoice === 'online' ? leaveOnline : () => setArenaChoice(null)}
                                >
                                  ← Back to Match Modes
                                </button>
                              )}
                            </div>

                            {arenaChoice === 'equalized_ai' && (
                              <div className="text-xs font-bold text-[#0b1f44]">
                                Equalized 100 OVR Draft · Phase 2: Avatar Draft (Unranked)
                              </div>
                            )}

                            {arenaChoice === 'online' && onlineSession && (
                              <div className="flex items-center gap-2 text-xs font-bold text-[#0b1f44]">
                                <span className="font-mono">Room {onlineSession.code}</span>
                                <span className="cm-badge cm-badge-gold">
                                  {(onlineRoom?.matchType || onlineSession.matchType) === 'ranked'
                                    ? 'Ranked'
                                    : 'Normal'}
                                </span>
                                <span>· Side: {onlineSession.side.toUpperCase()}</span>
                                <button
                                  type="button"
                                  onClick={leaveOnline}
                                  className="cm-btn cm-btn-danger py-0.5 px-2 text-xs"
                                >
                                  Leave Room
                                </button>
                              </div>
                            )}
                          </div>

                          <DraftPhaseView
                            key={arenaChoice === 'online' ? onlineSession?.code : draftSeed}
                            startingFive={arenaChoice === 'equalized_ai' ? equalizedBlueRoster : startingFive}
                            allChampions={CHAMPIONS}
                            userCoach={arenaChoice === 'equalized_ai' ? EQUALIZED_COACH_BLUE : currentCoach}
                            opponentCoach={
                              arenaChoice === 'equalized_ai'
                                ? EQUALIZED_COACH_RED
                                : arenaChoice === 'online'
                                ? onlineRoom!.redCoach
                                : selectedOpponentTeam?.coach ?? rivalCoach
                            }
                            opponentName={
                              arenaChoice === 'equalized_ai'
                                ? 'Red All-Stars (100 OVR)'
                                : arenaChoice === 'online'
                                ? 'Red team'
                                : selectedOpponentTeam?.name ?? 'Rival Chibi Squad'
                            }
                            opponentRoster={
                              arenaChoice === 'equalized_ai'
                                ? equalizedRedRoster
                                : arenaChoice === 'online'
                                ? onlineRoom!.redRoster
                                : selectedOpponentTeam?.starters ?? INITIAL_PLAYERS.slice(5, 10)
                            }
                            draftSeed={arenaChoice === 'online' ? onlineRoom!.seed : draftSeed}
                            online={
                              arenaChoice === 'online' && onlineSession
                                ? {
                                    room: onlineRoom!,
                                    side: onlineSession.side,
                                    onAction: async (championId, slot) => {
                                      try {
                                        setOnlineRoom(
                                          await submitOnlineDraft(
                                            onlineSession,
                                            championId,
                                            slot,
                                            onlineRoom!.revision
                                          )
                                        );
                                        setOnlineError('');
                                      } catch (error) {
                                        setOnlineError((error as Error).message);
                                        setOnlineRoom(await getOnlineRoom(onlineSession));
                                      }
                                    }
                                  }
                                : undefined
                            }
                            onDraftComplete={handleDraftComplete}
                          />
                          {onlineError && (
                            <p role="alert" className="mt-3 text-[#b91c1c] font-bold text-sm">
                              {onlineError}
                            </p>
                          )}
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      {arenaChoice === 'online' && onlineSession && !replayDraft && (
                        <div className="mb-2 flex justify-between items-center bg-[#0b1f44] text-white px-3 py-1.5 text-xs">
                          <span>
                            Online Room <strong>{onlineSession.code}</strong> · You are{' '}
                            <strong>{onlineSession.side.toUpperCase()}</strong>
                          </span>
                          <button type="button" onClick={leaveOnline} className="cm-btn cm-btn-danger py-0.5 px-2 text-xs">
                            Leave Room
                          </button>
                        </div>
                      )}
                      <AramMatchView
                        abilityRuleset={V3_RULESET}
                        contentCatalog={
                          replayDraft ? replayContent : arenaChoice === 'online' ? onlineRoom?.contentCatalog ?? null : undefined
                        }
                        intelligenceRelease={
                          replayDraft
                            ? replayIntelligence
                            : arenaChoice === 'online'
                            ? onlineRoom?.intelligence
                            : intelligenceReleaseSnapshot()
                        }
                        onExit={() => {
                          if (arenaChoice === 'online' && onlineSession && !replayDraft) leaveOnline();
                          setInBattle(false);
                          setBalanceRunsLeft(0);
                        }}
                        key={`${matchSeed}:${replayNumber}`}
                        seed={matchSeed}
                        onlineMode={arenaChoice === 'online' && !replayDraft}
                        onReplay={
                          arenaChoice === 'dev_random'
                            ? launchDeveloperRandomMatch
                            : () => setReplayNumber((number) => number + 1)
                        }
                        replayLabel={arenaChoice === 'dev_random' ? 'New Random 5v5' : undefined}
                        replayTitle={
                          arenaChoice === 'dev_random'
                            ? 'Generate ten new random avatars and restart immediately'
                            : undefined
                        }
                        batchMode={balanceRunsLeft > 0}
                        batchId={balanceBatchId}
                        batchNumber={balanceRunsLeft > 0 ? 26 - balanceRunsLeft : 0}
                        onBatchStart={() => {
                          setBalanceRunsLeft(25);
                          setBalanceBatchId(crypto.getRandomValues(new Uint32Array(1))[0]);
                          setMatchSeed(crypto.getRandomValues(new Uint32Array(1))[0]);
                          setReplayNumber((number) => number + 1);
                        }}
                        onBatchStop={() => {
                          setBalanceRunsLeft(0);
                          setReplayNumber((number) => number + 1);
                        }}
                        blueLineup={balanceSwapped ? draftedRed : draftedBlue}
                        redLineup={balanceSwapped ? draftedBlue : draftedRed}
                        blueCoach={
                          balanceSwapped
                            ? replayDraft?.redCoach ??
                              (arenaChoice === 'equalized_ai' || arenaChoice === 'dev_random'
                                ? EQUALIZED_COACH_RED
                                : arenaChoice === 'online'
                                ? onlineRoom?.redCoach ?? (selectedOpponentTeam?.coach ?? rivalCoach)
                                : selectedOpponentTeam?.coach ?? rivalCoach)
                            : replayDraft?.blueCoach ??
                              (arenaChoice === 'equalized_ai' || arenaChoice === 'dev_random'
                                ? EQUALIZED_COACH_BLUE
                                : arenaChoice === 'online'
                                ? onlineRoom?.blueCoach ?? currentCoach
                                : currentCoach)
                        }
                        redCoach={
                          balanceSwapped
                            ? replayDraft?.blueCoach ??
                              (arenaChoice === 'equalized_ai' || arenaChoice === 'dev_random'
                                ? EQUALIZED_COACH_BLUE
                                : arenaChoice === 'online'
                                ? onlineRoom?.blueCoach ?? currentCoach
                                : currentCoach)
                            : replayDraft?.redCoach ??
                              (arenaChoice === 'equalized_ai' || arenaChoice === 'dev_random'
                                ? EQUALIZED_COACH_RED
                                : arenaChoice === 'online'
                                ? onlineRoom?.redCoach ?? (selectedOpponentTeam?.coach ?? rivalCoach)
                                : selectedOpponentTeam?.coach ?? rivalCoach)
                        }
                        blueTeamName={
                          arenaChoice === 'dev_random'
                            ? balanceSwapped
                              ? 'Dev Red Random'
                              : 'Dev Blue Random'
                            : arenaChoice === 'equalized_ai'
                            ? balanceSwapped
                              ? 'Red All-Stars (100 OVR)'
                              : 'Blue All-Stars (100 OVR)'
                            : arenaChoice === 'online' && !replayDraft
                            ? 'Blue Player'
                            : balanceSwapped
                            ? selectedOpponentTeam?.name ?? 'Rival Chibi Squad'
                            : 'T-Chibi Squad'
                        }
                        opponentName={
                          arenaChoice === 'dev_random'
                            ? balanceSwapped
                              ? 'Dev Blue Random'
                              : 'Dev Red Random'
                            : arenaChoice === 'equalized_ai'
                            ? balanceSwapped
                              ? 'Blue All-Stars (100 OVR)'
                              : 'Red All-Stars (100 OVR)'
                            : arenaChoice === 'online' && !replayDraft
                            ? 'Red Player'
                            : balanceSwapped
                            ? 'T-Chibi Squad'
                            : selectedOpponentTeam?.name ?? 'Rival Chibi Squad'
                        }
                        onMatchComplete={
                          balanceRunsLeft > 0
                            ? () => {
                                setBalanceRunsLeft((left) => left - 1);
                                if (balanceRunsLeft > 1) {
                                  if (rerollAfterBalanceGame(balanceRunsLeft))
                                    setMatchSeed(crypto.getRandomValues(new Uint32Array(1))[0]);
                                  setReplayNumber((number) => number + 1);
                                }
                              }
                            : () => {}
                        }
                      />
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* =========================================================
              4. TRANSFER MARKET (SCOUTING & PACK STORE)
             ========================================================= */}
          {activeSection === 'market' && (
            <ClubMarketView />
          )}

          {/* =========================================================
              5. CODEX (PRO CIRCUIT, AVATARS & LORE, ITEMS & SKILLS)
             ========================================================= */}
          {activeSection === 'hexapedia' && (
            <div>
              <Hexapedia laboratory={<ChampionHubView champions={CHAMPIONS} allPlayers={roster}/>} catalogTools={<GameCatalogView/>} onWatch={id => {
                setWatchMatchId(id);
                setInBattle(false);
                setPlaySubTab('split');
                setActiveSectionState('play');
                window.location.hash='match-centre?match='+encodeURIComponent(id);
              }}/>
            </div>
          )}

          {/* =========================================================
              6. SETTINGS (AUDIO, CLOUD SAVE, CATALOG, DEVELOPER)
             ========================================================= */}
          {activeSection==='supporter'&&<SupporterStudio/>}
          {activeSection==='settings'&&<section className="cm-panel mb-4"><h2 className="cm-panel-header"><Swords size={15}/> Practice tools</h2><div className="cm-panel-body"><p className="club-help">Local draft experiments and historical sandbox modes. Club fixtures remain server scheduled.</p><a className="cm-btn" href="#arena-practice">Open Arena practice</a></div></section>}
          {activeSection === 'settings' && (
            <div className="space-y-4 max-w-5xl">
              {/* Audio & Broadcast */}
              <div className="cm-panel">
                <div className="cm-panel-header">
                  <span>Audio &amp; Broadcast Preferences</span>
                </div>
                <div className="cm-panel-body flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    aria-label={audioMuted ? 'Enable all sounds' : 'Mute all sounds'}
                    aria-pressed={!audioMuted}
                    onClick={() => setAudioMuted(sound.toggleMuted())}
                    className="cm-btn"
                  >
                    {audioMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    <span>Master Sound: {audioMuted ? 'Off' : 'On'}</span>
                  </button>

                  <button
                    type="button"
                    disabled={audioMuted}
                    aria-label={
                      audioMuted
                        ? 'Background music muted'
                        : musicEnabled
                        ? 'Mute background music'
                        : 'Enable background music'
                    }
                    aria-pressed={musicEnabled && !audioMuted}
                    onClick={() => {
                      setMusicEnabled(sound.toggleMusic());
                      sound.playClick();
                    }}
                    className="cm-btn"
                  >
                    {musicEnabled && !audioMuted ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                    <span>Background Music: {musicEnabled && !audioMuted ? 'On' : 'Off'}</span>
                  </button>
                </div>
              </div>

              {/* Cloud Save Backup */}
              <CloudSavePanel
                roster={roster}
                startingFive={startingFive}
                onRestore={(snapshot) => {
                  const restoredRoster = reconcileClubRoster(snapshot.roster, [KOVI_PLAYER_CARD]);
                  const restoredStarters = snapshot.starting_five
                    .map((id) => restoredRoster.find((card) => card.id === id))
                    .filter((card): card is PlayerCard => !!card);
                  if (restoredStarters.length !== 5) return false;
                  setRoster(restoredRoster);
                  setStartingFive(restoredStarters);
                  return true;
                }}
              />

              {/* Backoffice & AI Controller Status */}
              <div className="cm-panel">
                <div className="cm-panel-header">
                  <span>Backoffice Catalog &amp; Learned AI Controller</span>
                  <span className="cm-badge cm-badge-blue">{catalogConnection.status}</span>
                </div>
                <div className="cm-panel-body space-y-3 text-xs">
                  <div
                    className="flex flex-wrap items-center justify-between gap-2 bg-white border border-[#b4bcc8] p-3"
                    role="status"
                    aria-label="Backoffice catalog connection"
                  >
                    <div>
                      <strong>
                        {catalogConnection.status === 'connected'
                          ? 'Backoffice connected'
                          : catalogConnection.status === 'stale'
                          ? 'Backoffice disconnected · retaining last catalog'
                          : 'Backoffice offline · bundled catalog'}
                      </strong>
                      {catalogConnection.hash && (
                        <span className="ml-2 font-mono text-[#566173]" title={catalogConnection.hash}>
                          (Catalog {catalogConnection.hash.slice(0, 12)})
                        </span>
                      )}
                    </div>
                    <button type="button" onClick={catalogConnection.refresh} className="cm-btn text-xs py-1 px-2.5">
                      Refresh catalog
                    </button>
                  </div>

                  <p className="text-[#313a48] leading-relaxed">
                    <strong>Learning AI in your arena matches:</strong> Movement, combat targets, spells and strategic
                    choices come from a learned controller (`arenaPlaybookV6.json` / `data/arena-v6`). Open the AI
                    panel inside the match spectator to inspect live decision scores.
                  </p>
                </div>
              </div>

              {/* Developer & Diagnostics */}
              <div className="cm-panel">
                <div className="cm-panel-header">
                  <span>Developer Diagnostics &amp; Experimental Sandboxes</span>
                  <span className="cm-badge cm-badge-navy">Diagnostics</span>
                </div>
                <div className="cm-panel-body space-y-3 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        sound.playClick();
                        launchDeveloperRandomMatch();
                      }}
                      className="cm-btn cm-btn-navy"
                    >
                      <FlaskConical className="w-4 h-4" />
                      <span>Launch Developer Random 5v5</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        sound.playClick();
                        setActiveSection('play');
                        setPlaySubTab('modes');
                        setArenaChoice('dev_random');
                      }}
                      className="cm-btn"
                    >
                      Configure V3 Sandbox Lineups
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowOnlineNormalSandbox((v) => !v)}
                      className="cm-btn"
                    >
                      <Globe className="w-4 h-4" />
                      <span>{showOnlineNormalSandbox ? 'Hide Online Normal Sandbox' : 'Open Online Normal Sandbox'}</span>
                    </button>
                  </div>

                  {showOnlineNormalSandbox && (
                    <div className="pt-3 border-t border-[#c4cbd6]">
                      <OnlineNormalView />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Global Hattrick Match Orders Modal */}
          {activeOrdersModalFixture && (
            <MatchOrdersModal
              fixture={activeOrdersModalFixture}
              startingFive={startingFive}
              bench={bench}
              existingOrders={matchOrdersByFixture[activeOrdersModalFixture.id]}
              onSaveOrders={(orders) => {
                setMatchOrdersByFixture((prev) => ({
                  ...prev,
                  [activeOrdersModalFixture.id]: orders
                }));
                // Also apply any role assignment changes to the club's starters
                Object.entries(orders.roleAssignments).forEach(([pid, r]) => {
                  handleUpdatePlayerRole(pid, r);
                });
                setScheduleNotice(
                  `✓ Match Orders saved for ${activeOrdersModalFixture.competitionName} vs ${activeOrdersModalFixture.opponentName} (${orders.attitude.toUpperCase()} · ${orders.doctrine.replace('_', ' ')})`
                );
                setTimeout(() => setScheduleNotice(null), 5000);
              }}
              onSwapStarter={handleSwapPlayer}
              onClose={() => setActiveOrdersModalFixture(null)}
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
