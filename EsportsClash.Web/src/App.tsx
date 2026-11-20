import {useGameModes} from './gameModes';
import {canonicalRoute,sectionHref,workspacePath} from './frontendRoutes';
import {ClubMatchHistory} from './components/ClubMatchHistory';
import {SupporterStudio} from './components/SupporterStudio';
import {SupporterBadge} from './components/SupporterBadge';
import {CommunityCups} from './components/CommunityCups';
import {ClubFinances} from './components/ClubFinances';
import {ClubInboxLink} from './components/ClubOfficeDesk';
import {AppIcon} from './components/ui/AppIcon';
import {PageHeader} from './components/ui/PageHeader';
import {WORKSPACE_NAV, activeNavKey, areaHeading, navTrail} from './components/ui/navigation';
import {NewsFeed,BroadcastHub,LaunchArchive} from './components/WorldMedia';
import { useEffect, useState } from 'react';
import { useAccount } from './AccountContext';
import {
  INITIAL_PLAYERS,
  KOVI_PLAYER_CARD
} from './mockData';
import { loadStartingFive, persistClubRoster, reconcileClubRoster } from './clubRosterPersistence';
import type { PlayerCard } from './types';
import { OnlineNormalView } from './components/OnlineNormalView';
import { Hexapedia } from './components/Hexapedia';
import { CompetitionHub } from './components/CompetitionHub';
import { ClubTrainingView } from './components/ClubTrainingView';
import { VerifyEmailBanner } from './components/EmailSettings';
import { SettingsPage } from './components/SettingsPage';
import { PracticeLauncher } from './components/PracticeLauncher';
import { ClubStaffRoom } from './components/ClubStaffRoom';
import { HexatrickMark } from './components/HexatrickBrand';
import { ClubHome } from './components/ClubHome';
import { FpsMatchView } from './components/FpsMatchView';
import { FpsLiveBroadcast } from './components/FpsLiveBroadcast';
import { simulateFpsMatch } from './fps';
import type { LiveMapId } from './fps/fpsLiveMapTypes';
import { createFpsIdentityContext } from './fps/fpsIdentityMatch';
import { fpsSkillProfileFromAttributes, type FpsSkillProfile } from './fps/fpsSkillProfile';
import type { FpsIdentityExperiment, FpsMapId, FpsMatchReport } from './fps/fpsTypes';
import { ClubMarketView } from './components/ClubMarketView';
import { sound } from './audio';
import {
  Menu,
  X,
  ClipboardList,
  Dumbbell,
  GraduationCap,
  Clock,
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

  const [inBattle, setInBattle] = useState<boolean>(false);
  const modes = useGameModes();
  const [fpsMapSelection, setFpsMapSelection] = useState<FpsMapId>('breakwater');
  const [liveMapSelection, setLiveMapSelection] = useState<LiveMapId>('fontessa');
  const [fpsExhibition, setFpsExhibition] = useState<{ report: FpsMatchReport; blueName: string; redName: string } | null>(null);
  const [livePracticeMatch, setLivePracticeMatch] = useState<{ mapId: LiveMapId; blue: PlayerCard[]; red: PlayerCard[]; seed: number; identity: FpsIdentityExperiment; skillProfiles: Record<string, FpsSkillProfile> } | null>(null);
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
    setLivePracticeMatch(null);
    setFpsExhibition({
      report: simulateFpsMatch(blueRoster, redRoster, fpsMapSelection, seed),
      blueName: 'Your Club',
      redName: 'Practice Opponent'
    });
    setActiveSection('play');
    setPlaySubTab('modes');
    setInBattle(true);
  };

  const launchLive3dPractice = () => {
    const blueRoster = startingFive.slice(0, 5);
    const blueIds = new Set(blueRoster.map(player => player.id));
    const redRoster = roster.filter(player => !blueIds.has(player.id)).slice(0, 5);
    if (blueRoster.length !== 5 || redRoster.length !== 5) {
      setPracticeError('A live 3D practice broadcast requires five distinct players on each side.');
      return;
    }
    try {
      const seed = crypto.getRandomValues(new Uint32Array(1))[0] % 2147483646 + 1;
      const identity = createFpsIdentityContext(blueRoster, redRoster);
      const createdAt = new Date().toISOString();
      const skillProfiles = Object.fromEntries(
        [...blueRoster, ...redRoster].map(player => [
          player.id,
          fpsSkillProfileFromAttributes(player.id, player.stats, seed, createdAt),
        ])
      );
      setPracticeError('');
      setFpsExhibition(null);
      setLivePracticeMatch({
        mapId: liveMapSelection,
        blue: blueRoster,
        red: redRoster,
        seed,
        identity,
        skillProfiles,
      });
      setActiveSection('play');
      setPlaySubTab('modes');
      setInBattle(true);
    } catch (error) {
      setPracticeError((error as Error).message || 'Assign complete unique T and CT roles to your starting five before launching.');
    }
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

  const [locationHash, setLocationHash] = useState(() => window.location.hash);
  useEffect(() => { const sync = () => setLocationHash(window.location.hash); window.addEventListener('hashchange', sync); return () => window.removeEventListener('hashchange', sync); }, []);
  const navKey = activeNavKey(activeSection, playSubTab, locationHash);
  const [navOpen, setNavOpen] = useState(false);
  const heading = areaHeading(navKey);

  return (
    <div className="cm-shell">
      <a href="#main-content" className="cm-skip-link" onClick={event => { event.preventDefault(); document.getElementById('main-content')?.focus(); }}>Skip to content</a>
      <aside className="cm-sidebar" aria-label="Club navigation">
        <div className="cm-brand">
          <a href="#welcome" className="cm-brand-title" aria-label="Hexatrick landing page"><HexatrickMark/><span>hexatrick</span></a>
          <div className="cm-brand-sub">Your club. Every matchday.</div>
          <button type="button" className="cm-nav-toggle" aria-expanded={navOpen} aria-controls="workspace-nav" onClick={() => setNavOpen(open => !open)}>
            {navOpen ? <X size={16} aria-hidden="true" /> : <Menu size={16} aria-hidden="true" />}
            <span>{navOpen ? 'Close menu' : navTrail(navKey)[1]}</span>
          </button>
        </div>

        <nav id="workspace-nav" className={`cm-nav ${navOpen ? 'is-open' : ''}`} aria-label="Workspace">
          {WORKSPACE_NAV.map(group => <div className="cm-nav-group-block" key={group.id} role="group" aria-labelledby={'nav-group-' + group.id}>
            <div className="cm-nav-section" id={'nav-group-' + group.id}>{group.label}</div>
            {group.items.map(item => <a key={item.key} href={item.href} title={item.hint} aria-current={navKey === item.key ? 'page' : undefined}
              className={`cm-nav-btn ${navKey === item.key ? 'active' : ''}`}
              onClick={() => { sound.playClick(); setNavOpen(false); if (item.key !== 'practice') setInBattle(false); }}>
              <span className="flex items-center gap-2"><AppIcon name={item.icon} size={16} /><span>{item.label}</span></span>
              {item.key === 'matches' && inBattle && <span className="cm-nav-badge">LIVE</span>}
            </a>)}
          </div>)}
        </nav>

        <div className="cm-sidebar-footer">
          <div className="flex items-center justify-between">
            <span>New here?</span>
            <a href="#hexapedia/guide">Read the game guide</a>
          </div>
        </div>
      </aside>

      <div className="cm-main">
        <header className="cm-topbar">
          <div className="cm-breadcrumb" title={sectionTitle[activeSection]}>{navTrail(navKey)[0]} <span aria-hidden="true">/</span> <strong>{navTrail(navKey)[1]}</strong> <span>Manila · UTC+8</span></div>

          <div className="cm-topbar-stats">
            <button
              type="button"
              onClick={() => {
                sound.playClick();
                setActiveSection('play');
                setPlaySubTab('split');
                setInBattle(false);
              }}
              className="cm-btn cm-btn-ghost cm-topbar-calendar"
              title="Open your fixtures"
            >
              <Clock size={14} aria-hidden="true" /><span className="cm-topbar-label">Fixtures</span>
            </button>
            <ClubInboxLink/>
            <span className="cm-topbar-divider" aria-hidden="true" />
            <div className="cm-account" title={accountSession?.user.email}>
              <span className="cm-account__avatar" aria-hidden="true">{(accountSession?.user.name ?? '?').trim().charAt(0).toUpperCase()}</span>
              <span className="cm-account__name">{accountSession?.user.name}</span>
              {accountSession?.user.supporter?.active && <SupporterBadge trial={accountSession.user.supporter.kind === 'trial'} level={accountSession.user.supporter.level} unlimited={accountSession.user.supporter.unlimited}/>}
            </div>
            <button type="button" className="cm-btn cm-btn-ghost cm-topbar-signout" disabled={accountBusy} aria-label="Sign out of your account" title="Sign out" onClick={async () => {
              setAccountBusy(true); setAccountError('');
              try { await signOut(); } catch (error) { setAccountError((error as Error).message); } finally { setAccountBusy(false); }
            }}><LogOut size={14} aria-hidden="true" /><span className="hidden sm:inline">{accountBusy ? 'Signing out…' : 'Sign out'}</span></button>
          </div>
        </header>

        <main id="main-content" tabIndex={-1} className={`cm-content ${activeSection === 'play' && inBattle ? 'cm-content--arena max-w-[1640px]' : 'max-w-7xl'} mx-auto w-full`}>
          {accountError && <p role="alert" className="club-notice mb-4">{accountError}</p>}
          {!inBattle && <VerifyEmailBanner/>}
          {!inBattle && heading && <PageHeader eyebrow={heading.group} icon={heading.icon} title={heading.title} description={heading.description} />}
          {!inBattle && navKey === 'matches' && <nav className="cm-tabs matches-nav" aria-label="Matches">
            {([['fixtures', 'Fixtures', '#match-centre?club=calendar', activeSection === 'play' && !workspacePath(window.location.hash).includes('club=friendly')],
              ['scrimmages', 'Scrimmages', '#scrimmages', activeSection === 'play' && workspacePath(window.location.hash).includes('club=friendly')],
              ['history', 'Results', '#match-history', activeSection === 'history']] as const).map(([icon, label, href, current]) =>
              <a key={icon} href={href} className={`cm-tab ${current ? 'active' : ''}`} aria-current={current ? 'page' : undefined} onClick={() => setWatchMatchId(undefined)}><AppIcon name={icon} size={14} />{label}</a>)}
          </nav>}

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
                  <ClipboardList size={14} aria-hidden="true" />
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
                  <Dumbbell size={14} aria-hidden="true" />
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
                  <GraduationCap size={14} aria-hidden="true" />
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
              {playSubTab === 'community' && !inBattle && <CommunityCups/>}
              {playSubTab === 'news' && !inBattle && <NewsFeed onWatch={id => { setWatchMatchId(id); setPlaySubTab('split'); window.location.hash = 'match-centre?match=' + id; }}/>}
              {playSubTab === 'broadcasts' && !inBattle && <BroadcastHub/>}
              {playSubTab === 'archive' && !inBattle && <LaunchArchive onWatch={id => { setWatchMatchId(id); setPlaySubTab('split'); window.location.hash = 'match-centre?match=' + id; }}/>}
              {playSubTab === 'competitions' && !inBattle && <CompetitionHub onWatch={id => { setWatchMatchId(id); setPlaySubTab('split'); window.location.hash = 'match-centre?match=' + id; }} />}
              {playSubTab === 'split' && !inBattle && <OnlineNormalView key={watchMatchId ?? 'calendar'} matchCentre scheduled initialMatchId={watchMatchId} />}

              {(playSubTab === 'modes' || inBattle) && (
                <div>
                  {!inBattle ? (
                    <PracticeLauncher
                      five={startingFive.slice(0, 5)}
                      opponents={roster.filter(player => !startingFive.slice(0, 5).some(starter => starter.id === player.id)).slice(0, 5)}
                      liveMap={liveMapSelection}
                      onLiveMap={setLiveMapSelection}
                      recordedMap={fpsMapSelection}
                      onRecordedMap={setFpsMapSelection}
                      onLaunchLive={launchLive3dPractice}
                      onLaunchRecorded={launchFpsExhibition}
                      error={practiceError}
                    />
                  ) : livePracticeMatch ? (
                    <FpsLiveBroadcast
                      mapId={livePracticeMatch.mapId}
                      blue={livePracticeMatch.blue}
                      red={livePracticeMatch.red}
                      seed={livePracticeMatch.seed}
                      identity={livePracticeMatch.identity}
                      skillProfiles={livePracticeMatch.skillProfiles}
                      onExit={() => {
                        setInBattle(false);
                        setLivePracticeMatch(null);
                      }}
                    />
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
          {activeSection === 'settings' && <SettingsPage
            roster={roster}
            startingFive={startingFive}
            isAdmin={Boolean(accountSession?.user.is_evolution_admin)}
            fpsEnabled={modes.fps_enabled}
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
          />}
        </main>
      </div>
    </div>
  );
}

export default App;
