import {RouteErrorBoundary} from './components/RouteErrorBoundary';
import {backendPageUrl} from './cloudPersistence';
import {useGameModes} from './gameModes';
import {WorldDesk} from './components/WorldDesk';
import {canonicalRoute,sectionHref,workspacePath} from './frontendRoutes';
import {ClubMatchHistory} from './components/ClubMatchHistory';
import {SupporterStudio} from './components/SupporterStudio';
import {SupporterBadge} from './components/SupporterBadge';
import {CommunityCups} from './components/CommunityCups';
import {ClubFinances} from './components/ClubFinances';
import {ClubInboxLink} from './components/ClubOfficeDesk';
import {LabelIcon} from './components/LabelIcon';
import {NewsFeed,BroadcastHub,LaunchArchive} from './components/WorldMedia';
import { useEffect, useState } from 'react';
import { useAccount } from './AccountContext';
import {
  INITIAL_PLAYERS,
  KOVI_PLAYER_CARD
} from './mockData';
import { loadStartingFive, persistClubRoster, reconcileClubRoster } from './clubRosterPersistence';
import type { PlayerCard } from './types';
import { CloudSavePanel } from './components/CloudSavePanel';
import { OnlineNormalView } from './components/OnlineNormalView';
import { Hexapedia } from './components/Hexapedia';
import { CompetitionHub } from './components/CompetitionHub';
import { ClubTrainingView } from './components/ClubTrainingView';
import { ClubStaffRoom } from './components/ClubStaffRoom';
import { HexatrickMark } from './components/HexatrickBrand';
import { ClubHome } from './components/ClubHome';
import { FpsMatchView } from './components/FpsMatchView';
import { simulateFpsMatch } from './fps';
import { FPS_MAPS } from './fps/fpsMaps';
import type { FpsMapId, FpsMatchReport } from './fps/fpsTypes';
import { ClubMarketView } from './components/ClubMarketView';
import { sound } from './audio';
import {
  Users,
  Swords,
  Trophy,
  Package,
  Globe,
  FlaskConical,
  Volume2,
  VolumeX,
  Home,
  Settings as SettingsIcon,
  Clock,
  BookOpen,
  LogOut
} from 'lucide-react';

type MainSection = 'home' | 'squad' | 'play' | 'market' | 'finances' | 'hexapedia' | 'history' | 'supporter' | 'settings';
type SquadSubTab = 'lineup' | 'training' | 'staff';
type PlaySubTab = 'modes' | 'split' | 'community' | 'competitions' | 'news' | 'broadcasts' | 'archive';

const SECTION_HASHES: MainSection[] = ['home', 'squad', 'play', 'market', 'finances', 'hexapedia', 'history', 'supporter', 'settings'];

function readInitialSection(): MainSection {
  if (typeof window === 'undefined') return 'home';
  const raw = workspacePath(window.location.hash).split(/[/?]/)[0].trim().toLowerCase() as MainSection;
  if (raw === ('avatarpedia' as MainSection) || raw === ('discover' as MainSection)) return 'hexapedia';
  return SECTION_HASHES.includes(raw) ? raw : 'home';
}

export function App() {
  const { session: accountSession, signOut } = useAccount();
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountError, setAccountError] = useState('');

  const [activeSection, setActiveSectionState] = useState<MainSection>(readInitialSection);
  const [squadSubTab, setSquadSubTab] = useState<SquadSubTab>(() => {
    const tab = new URLSearchParams(workspacePath(window.location.hash).split('?')[1] ?? '').get('tab');
    return tab && ['lineup', 'training', 'staff'].includes(tab) ? (tab as SquadSubTab) : 'lineup';
  });
  const [playSubTab, setPlaySubTab] = useState<PlaySubTab>(() =>
    ['news', 'broadcasts', 'archive'].includes(new URLSearchParams(workspacePath(window.location.hash).split('?')[1] ?? '').get('world') ?? '')
      ? (new URLSearchParams(workspacePath(window.location.hash).split('?')[1] ?? '').get('world') as PlaySubTab)
      : workspacePath(window.location.hash).includes('community=cups')
      ? 'community'
      : workspacePath(window.location.hash).includes('competitions=')
      ? 'competitions'
      : workspacePath(window.location.hash).includes('tool=practice')
      ? 'modes'
      : 'split'
  );
  const [watchMatchId, setWatchMatchId] = useState<string | undefined>(() => {
    const match = new URLSearchParams(workspacePath(window.location.hash).split('?')[1] ?? '').get('match');
    return match && /^[a-f0-9-]{36}$/i.test(match) ? match : undefined;
  });
  const [showOnlineNormalSandbox, setShowOnlineNormalSandbox] = useState(false);

  const setActiveSection = (section: MainSection) => {
    setActiveSectionState(section);
    if (section !== 'play') setInBattle(false);
    if (typeof window !== 'undefined' && window.location.hash !== sectionHref(section)) {
      window.history.replaceState(null, '', sectionHref(section));
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    }
  };

  useEffect(() => {
    const onHashChange = () => {
      const next = readInitialSection();
      setActiveSectionState(next);
      if (next !== 'play') setInBattle(false);
      if (next === 'squad') {
        const tab = new URLSearchParams(workspacePath(window.location.hash).split('?')[1] ?? '').get('tab');
        if (tab && ['lineup', 'training', 'staff'].includes(tab)) setSquadSubTab(tab as SquadSubTab);
      }
      const params = new URLSearchParams(workspacePath(window.location.hash).split('?')[1] ?? '');
      const match = params.get('match');
      if (next === 'play' && match && /^[a-f0-9-]{36}$/i.test(match)) {
        setWatchMatchId(match);
        setPlaySubTab('split');
      }
      const worldTab = params.get('world');
      if (next === 'play' && ['news', 'broadcasts', 'archive'].includes(worldTab ?? '')) setPlaySubTab(worldTab as PlaySubTab);
      if (next === 'play' && workspacePath(window.location.hash).includes('community=cups')) setPlaySubTab('community');
      if (next === 'play' && workspacePath(window.location.hash).includes('tool=practice')) setPlaySubTab('modes');
      if (next === 'play' && window.location.hash === '#match-centre') setPlaySubTab('split');
      if (next === 'play' && workspacePath(window.location.hash).includes('competitions=')) setPlaySubTab('competitions');
      if (next === 'play' && new URLSearchParams(workspacePath(window.location.hash).split('?')[1] ?? '').has('club')) {
        setPlaySubTab('split');
        setWatchMatchId(undefined);
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const [musicEnabled, setMusicEnabled] = useState(() => sound.isMusicEnabled());
  const [audioMuted, setAudioMuted] = useState(() => sound.isMuted());
  const [inBattle, setInBattle] = useState<boolean>(false);
  const modes = useGameModes();
  const [fpsMapSelection, setFpsMapSelection] = useState<FpsMapId>('breakwater');
  const [fpsExhibition, setFpsExhibition] = useState<{ report: FpsMatchReport; blueName: string; redName: string } | null>(null);
  const [practiceError, setPracticeError] = useState('');

  const [roster, setRoster] = useState<PlayerCard[]>(() => reconcileClubRoster(INITIAL_PLAYERS, [KOVI_PLAYER_CARD]));
  const [startingFive, setStartingFive] = useState<PlayerCard[]>(() =>
    loadStartingFive(reconcileClubRoster(INITIAL_PLAYERS, [KOVI_PLAYER_CARD]), INITIAL_PLAYERS.slice(0, 5))
  );

  useEffect(() => {
    persistClubRoster(roster, startingFive);
  }, [roster, startingFive]);

  const launchFpsExhibition = () => {
    const blueRoster = startingFive.slice(0, 5);
    const blueIds = new Set(blueRoster.map(player => player.id));
    const redRoster = roster.filter(player => !blueIds.has(player.id)).slice(0, 5);
    if (blueRoster.length !== 5 || redRoster.length !== 5) {
      setPracticeError('An FPS exhibition requires five distinct players on each side.');
      return;
    }
    setPracticeError('');
    const seed = crypto.getRandomValues(new Uint32Array(1))[0];
    setFpsExhibition({
      report: simulateFpsMatch(blueRoster, redRoster, fpsMapSelection, seed),
      blueName: 'Your Club',
      redName: 'Practice Opponent'
    });
    setActiveSection('play');
    setPlaySubTab('modes');
    setInBattle(true);
  };

  const sectionTitle: Record<MainSection, string> = {
    home: 'Club Office · Dashboard & Schedule',
    squad:
      squadSubTab === 'lineup'
        ? 'Squad · Tactical Lineup & Reserves'
        : squadSubTab === 'training'
        ? 'Squad · Practice training & coaches'
        : 'Squad · Staff room',
    play:
      playSubTab === 'modes'
        ? inBattle
          ? 'Live Broadcast · Tactical FPS Exhibition'
          : 'Play · FPS practice exhibition'
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

          <button className={`cm-nav-btn ${activeSection === 'finances' ? 'active' : ''}`} aria-current={activeSection === 'finances' ? 'page' : undefined} onClick={() => { setActiveSection('finances'); setInBattle(false); }}><span className="flex items-center gap-2"><LabelIcon name="money"/>Finances</span></button>
          <button className={`cm-nav-btn ${activeSection === 'history' ? 'active' : ''}`} aria-current={activeSection === 'history' ? 'page' : undefined} onClick={() => { setActiveSection('history'); setInBattle(false); }}><span className="flex items-center gap-2"><LabelIcon name="history"/>Match history</span></button>
          <div className="cm-nav-section">Living world</div>
          {([['news', 'The Wire'], ['broadcasts', 'Hexacast'], ['archive', 'Crown 2026']] as const).map(([tab, label]) => <button key={tab} className={`cm-nav-btn ${activeSection === 'play' && playSubTab === tab ? 'active' : ''}`} onClick={() => { setActiveSection('play'); setPlaySubTab(tab); setInBattle(false); window.location.hash = ({ news: 'wire', broadcasts: 'hexacast', archive: 'launch-championship' })[tab]; }}><span className="flex items-center gap-2"><LabelIcon name={label}/>{label}</span></button>)}
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

          <button className={`cm-nav-btn ${activeSection === 'supporter' ? 'active' : ''}`} aria-current={activeSection === 'supporter' ? 'page' : undefined} onClick={() => { setActiveSection('supporter'); setInBattle(false); }}><span className="flex items-center gap-2"><LabelIcon name="supporter"/>Supporter studio</span></button>
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

      <div className="cm-main">
        <header className="cm-topbar">
          <div className="cm-breadcrumb" title={sectionTitle[activeSection]}>Club management <span>Manila · UTC+8</span></div>

          <div className="cm-topbar-stats">{accountSession?.user.supporter?.active && <SupporterBadge trial={accountSession.user.supporter.kind === 'trial'} level={accountSession.user.supporter.level} unlimited={accountSession.user.supporter.unlimited}/>}<ClubInboxLink/>
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

        <main id="main-content" tabIndex={-1} className={`cm-content ${activeSection === 'play' && inBattle ? 'cm-content--arena max-w-[1640px]' : 'max-w-7xl'} mx-auto w-full`}>
          {accountError && <p role="alert" className="club-notice mb-4">{accountError}</p>}
          {!inBattle && activeSection !== 'hexapedia' && !['news', 'broadcasts', 'archive'].includes(activeSection === 'play' ? playSubTab : '') && <div className="cm-page-heading">
            <p className="cm-eyebrow">Hexatrick / Club management</p>
            <h1><LabelIcon name={activeSection} size={24}/>{({ home: 'Club home', squad: 'Your squad', play: 'Match centre', market: 'Transfer Exchange', finances: 'Finances', hexapedia: 'Hexapedia', history: 'Club match history', supporter: 'Supporter studio', settings: 'Settings' })[activeSection]}</h1>
            <p>{({
              home: 'Prepare your club for the next matchday.',
              squad: 'Manage your contracted players, training and official match orders.',
              play: 'Prepare your orders, follow matchdays, and revisit every result.',
              finances: 'Review income, expenses and your payroll commitments.',
              market: 'Buy, sell and develop your club roster.',
              hexapedia: 'Clubs, competitions, players, and tactical FPS references.',
              history: 'Follow every fixture, result and recording in your club archive.',
              supporter: 'Your membership, club cosmetics and player presentation.',
              settings: 'Manage your account, audio, and practice preferences.',
            })[activeSection]}</p>
          </div>}

          {activeSection === 'finances' && <ClubFinances/>}
          {activeSection === 'history' && <ClubMatchHistory onWatch={id => { setWatchMatchId(id); setInBattle(false); setPlaySubTab('split'); setActiveSection('play'); window.location.hash = 'match-centre?match=' + encodeURIComponent(id); }}/>}
          {activeSection === 'home' && <ClubHome
            onPlay={tool => { setWatchMatchId(undefined); setPlaySubTab('split'); setInBattle(false); setActiveSection('play'); window.location.hash = canonicalRoute('play?club=' + tool); }}
            onMarket={() => setActiveSection('market')}
            onWatch={id => { setWatchMatchId(id); setInBattle(false); setPlaySubTab('split'); setActiveSection('play'); window.location.hash = 'match-centre?match=' + encodeURIComponent(id); }}
          />}

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
            </div>
          )}

          {activeSection === 'play' && (
            <div>
              {!inBattle && !['news', 'archive'].includes(playSubTab) && <nav className="cm-tabs match-centre-nav" aria-label="Match centre">
                <button className={`cm-tab ${playSubTab === 'split' && !workspacePath(window.location.hash).includes('club=friendly') ? 'active' : ''}`} onClick={() => { setWatchMatchId(undefined); setPlaySubTab('split'); window.location.hash = 'match-centre?club=calendar'; }}><LabelIcon name="calendar"/>Fixtures</button>
                <button className={`cm-tab ${playSubTab === 'split' && workspacePath(window.location.hash).includes('club=friendly') ? 'active' : ''}`} onClick={() => { setWatchMatchId(undefined); setPlaySubTab('split'); window.location.hash = 'scrimmages'; }}><Swords size={14}/>Scrimmages</button>
                <button className={`cm-tab ${playSubTab === 'competitions' ? 'active' : ''}`} onClick={() => { setPlaySubTab('competitions'); window.location.hash = 'competitions?tab=circuit'; }}><Trophy size={14}/>Competitions</button>
                <button className={`cm-tab ${playSubTab === 'broadcasts' ? 'active' : ''}`} onClick={() => { setPlaySubTab('broadcasts'); window.location.hash = 'hexacast'; }}><LabelIcon name="broadcast"/>Hexacast</button>
                <button className={`cm-tab ${playSubTab === 'community' ? 'active' : ''}`} onClick={() => { setPlaySubTab('community'); window.location.hash = 'community-cups'; }}><Trophy size={14}/>Community cups</button>
                {playSubTab === 'modes' && <span className="cm-tab active">Practice tools</span>}
              </nav>}
              {playSubTab === 'community' && !inBattle && <CommunityCups/>}
              {playSubTab === 'news' && !inBattle && <NewsFeed onWatch={id => { setWatchMatchId(id); setPlaySubTab('split'); window.location.hash = 'match-centre?match=' + id; }}/>}
              {playSubTab === 'broadcasts' && !inBattle && <BroadcastHub/>}
              {playSubTab === 'archive' && !inBattle && <LaunchArchive onWatch={id => { setWatchMatchId(id); setPlaySubTab('split'); window.location.hash = 'match-centre?match=' + id; }}/>}
              {playSubTab === 'competitions' && !inBattle && <CompetitionHub onWatch={id => { setWatchMatchId(id); setPlaySubTab('split'); window.location.hash = 'match-centre?match=' + id; }} />}
              {playSubTab === 'split' && !inBattle && <OnlineNormalView key={watchMatchId ?? 'calendar'} matchCentre scheduled initialMatchId={watchMatchId} />}

              {(playSubTab === 'modes' || inBattle) && (
                <div>
                  {!inBattle ? (
                    <div className="cm-panel max-w-xl flex flex-col justify-between">
                      <div className="cm-panel-header">
                        <span>Tactical FPS Exhibition</span>
                        <span className="cm-badge cm-badge-navy">MR15 · 5v5</span>
                      </div>
                      <div className="cm-panel-body flex-1 flex flex-col justify-between space-y-3">
                        <div>
                          <h2 className="text-base font-black text-[#0b1f44]">FPS Match Simulation</h2>
                          <p className="text-xs text-[#313a48] mt-1.5 leading-relaxed">
                            Run a deterministic local exhibition on one of the five competitive maps. This preview does not affect schedules, standings, or player careers.
                          </p>
                        </div>
                        <label className="text-xs font-bold text-[#313a48]">
                          Map
                          <select
                            aria-label="FPS exhibition map"
                            className="cm-select mt-1 w-full"
                            value={fpsMapSelection}
                            onChange={event => setFpsMapSelection(event.target.value as FpsMapId)}
                          >
                            {Object.values(FPS_MAPS).map(map => <option key={map.id} value={map.id}>{map.name}</option>)}
                          </select>
                        </label>
                        {practiceError && <p role="alert" className="text-xs font-bold text-[#b91c1c]">{practiceError}</p>}
                        <button type="button" onClick={launchFpsExhibition} className="cm-btn cm-btn-primary w-full">
                          Run FPS Exhibition ▸
                        </button>
                      </div>
                    </div>
                  ) : fpsExhibition ? (
                    <FpsMatchView
                      report={fpsExhibition.report}
                      blueTeamName={fpsExhibition.blueName}
                      redTeamName={fpsExhibition.redName}
                      onExit={() => {
                        setInBattle(false);
                        setFpsExhibition(null);
                      }}
                    />
                  ) : null}
                </div>
              )}
            </div>
          )}

          {activeSection === 'market' && <ClubMarketView />}

          {activeSection === 'hexapedia' && (
            <div>
              <Hexapedia onWatch={id => {
                setWatchMatchId(id);
                setInBattle(false);
                setPlaySubTab('split');
                setActiveSectionState('play');
                window.location.hash = 'match-centre?match=' + encodeURIComponent(id);
              }}/>
            </div>
          )}

          {activeSection === 'supporter' && <SupporterStudio/>}
          {activeSection === 'settings' && <section className="cm-panel mb-4"><h2 className="cm-panel-header"><Swords size={15}/> Watch the FPS simulation</h2><div className="cm-panel-body space-y-3"><p>Watch the live 3D exhibition with first-person, third-person and automatic broadcast cameras, or inspect a recorded tactical match. Exhibition matches do not change your club records.</p><div className="flex flex-wrap gap-3"><a className="cm-btn cm-btn-primary" href="#fps-simulation">Open FPS broadcast room</a><a className="cm-btn" href="#hexapedia/fps">FPS reference</a><a className="cm-btn" href="#hexapedia/personalities">Personalities</a>{accountSession?.user.is_evolution_admin && <a className="cm-btn" href={backendPageUrl('/evolution/game-modes')}>Game-mode settings</a>}</div><p className="club-help">Current format: Tactical FPS ({modes.fps_enabled ? 'active' : 'configured'}).</p></div></section>}
          {activeSection === 'settings' && <RouteErrorBoundary><WorldDesk compact/></RouteErrorBoundary>}
          {activeSection === 'settings' && (
            <div className="space-y-4 max-w-5xl">
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

              <div className="cm-panel">
                <div className="cm-panel-header">
                  <span>Simulation status</span>
                  <span className="cm-badge cm-badge-blue">Tactical FPS</span>
                </div>
                <div className="cm-panel-body space-y-3 text-xs">
                  <p className="text-[#313a48] leading-relaxed">
                    Hexatrick uses the deterministic tactical FPS simulator. Skills, equipment, personality preferences and the round situation inform decisions.
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
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
        </main>
      </div>
    </div>
  );
}

export default App;
