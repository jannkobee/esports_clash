import { LIVE_KNIFE } from '../fps/fpsLiveWeapons.ts';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { freshFpsExhibitionSeed } from '../fps/fpsExhibitionSeed';
import type { PlayerCard } from '../types';
import type { FpsIdentityExperiment, FpsTeamId } from '../fps/types';
import { FpsFixedStepClock } from '../fps/fpsSpatialWorld';
import { LIVE_FPS_MAP } from '../fps/fpsLiveMap';
import { FpsLiveSimulation, LIVE_FPS_STEP, LIVE_WEAPONS, type LivePlayer, type LiveSnapshot } from '../fps/fpsLiveSimulation';
import { FpsBroadcastAudio } from '../fps/fpsBroadcastAudio';
import { readFpsLearning, saveFpsLearningRound } from '../fps/fpsLiveLearningStorage';
import { readFpsMechanicsLearning, saveFpsMechanicsRound } from '../fps/fpsLiveMechanicsLearningStorage';
import { domRectToBabylonViewport } from '../fps/fpsBroadcastDirector';
import type { BombPlantPipState, LiveCameraMode } from '../fps/fpsLiveViewer';
import { liveImpactRate } from '../fps/fpsLiveImpact';
import type { FpsSkillProfile } from '../fps/fpsSkillProfile';
import type { LiveWeapon, LiveEquippedWeapon } from '../fps/fpsLiveWeapons';
import './fps-live-broadcast.css';

interface DocumentPictureInPictureApi {
  window: Window | null;
  requestWindow(options?: { width?: number; height?: number }): Promise<Window>;
}

const EMPTY_PLANT_PIP: BombPlantPipState = {
  active: false,
  phase: 'planting',
  progress: 0,
  duration: 3.2,
  spot: { x: 0, z: 0 },
};

function cloneDocumentStylesToPipWindow(sourceDoc: Document, targetDoc: Document): void {
  for (const node of Array.from(sourceDoc.querySelectorAll('style, link[rel="stylesheet"]'))) {
    targetDoc.head.appendChild(node.cloneNode(true));
  }
}

interface Props {
  blue: PlayerCard[];
  red: PlayerCard[];
  seed: number;
  identity: FpsIdentityExperiment;
  skillProfiles?: Record<string, FpsSkillProfile>;
  learningEnabled?:boolean;
  onExit: () => void;
}

const clock = (seconds: number) => `${Math.floor(Math.ceil(seconds) / 60)}:${String(Math.ceil(seconds) % 60).padStart(2, '0')}`;
const cameraModes:LiveCameraMode[]=['director','first','third','overview'];

function WeaponSilhouette({ weapon }: { weapon: LiveEquippedWeapon }) {
  if (weapon === 'knife') return <svg viewBox="0 0 40 16" className="blast-weapon-icon" fill="currentColor" aria-label="Knife"><path d="M2 9h10l12-3c4 0 8 3 8 3s-4 3-8 3L12 9H2zM3 7h7v4H3z" /></svg>;
  if (weapon === 'flash' || weapon === 'smoke' || weapon === 'incendiary' || weapon==='he') return <svg viewBox="0 0 24 24" className="blast-weapon-icon" fill="currentColor" aria-label={weapon}><rect x="7" y="6" width="10" height="14" rx="2" /><rect x="10" y="2" width="4" height="4" />{weapon === 'incendiary' ? <path d="M12 8c-4 4 2 4-1 8 5-1 6-7 1-8z" /> : weapon==='he'?<path d="M8 12h8M12 8v8" stroke="currentColor" strokeWidth="2" /> : <line x1="14" y1="4" x2="18" y2="4" stroke="currentColor" strokeWidth="2" />}</svg>;
  if (weapon === 'bomb') return <svg viewBox="0 0 28 22" className="blast-weapon-icon" fill="currentColor" aria-label="C4 explosion"><path d="M9 3h10v3l3 3v9l-3 2H9l-3-2V9l3-3z" /><path d="M11 1h6v2h-6zM10 10h8v2h-8zM10 14h8v2h-8z" fill="#111827" /></svg>;
  const silhouettes:Record<LiveWeapon,string>={
    pistol:'M3 9h11l3-3h11v3h-4v3h-7l-2 5h-5l1-4H4z',
    usp_s:'M2 9h17l2-2h12v2H21v2h-5l-2 5H9l1-4H3z',
    glock:'M3 8h16l2 2h8v2h-8v2h-7l-2 4H7l1-5H3z',
    deagle:'M2 8h14l3-4h12v4h-5v4h-9l-2 5H9l1-4H2z',
    rifle:'M2 10h9l3-4h20l3 3h13v3h-5v3h-8l-3-3H18l-3 5H8l2-4H2z',
    m4a1_s:'M2 10h9l3-4h17l3 3h15v3h-5v3h-7l-3-3H18l-3 5H8l2-4H2zM34 8h12v1H34z',
    ak47:'M2 10h8l4-4h19l4 3h12v3h-6v3h-8l-4-3H19l-2 6h-5l1-5H2z',
    sniper:'M1 11h12l3-4h18l2-3h7l1 3h17v2H41l-2 4H16l-4 3H6l2-3H1zM26 3h8v3h-8z',
    scout:'M2 11h12l3-4h16l2-2h7l1 2h15v2H40l-2 4H17l-4 3H7l2-3H2zM26 4h7v2h-7z',
    smg:'M3 10h8l3-4h15l3 3h10v3h-5v4h-5v-4h-8l-2 5h-5l1-5H9l-2 3H3z',
    mp9:'M3 10h7l4-5h15l2 4h11v3h-6v4h-4v-4h-8l-2 5h-5l1-5H9l-2 3H3z',
    mac10:'M3 10h9l2-4h14l4 2h9v4h-7v5h-5v-5h-9l-2 5h-5l1-5H9l-2 3H3z',
    mag7:'M2 10h14l3-3h22v3h-5v3h-8l-2 5H10l1-4H2z',
    nova:'M2 10h12l4-4h26v3h-5v3H26l-2 6H10l1-4H2zM16 7v-3h12v3z',
    negev:'M1 9h12l3-4h18l4 4h17v3h-6v4h-8v-4h-8l-2 4H10l1-4H1zM22 16h2v3h-2zM39 16h2v3h-2z',
  };
  const title=LIVE_WEAPONS[weapon].name;
  return <svg viewBox="0 0 62 22" className="blast-weapon-icon" fill="currentColor" role="img" aria-label={title}><title>{title}</title><path d={silhouettes[weapon]} /></svg>;
}

function TacticalAvatar({ attacking, isDead }: { attacking:boolean; isDead: boolean }) {
  const isCT = !attacking;
  return (
    <div className={`blast-avatar ${isCT ? 'is-ct' : 'is-t'} ${isDead ? 'is-dead' : ''}`}>
      <svg viewBox="0 0 48 48" className="blast-avatar-svg" aria-hidden="true">
        {isCT ? (
          <g>
            <path d="M6 46c0-9 7-15 18-15s18 6 18 15z" fill="#1e293b" />
            <path d="M12 36h24v10H12z" fill="#0f172a" />
            <rect x="18" y="26" width="12" height="7" rx="2" fill="#090d16" />
            <path d="M11 22c0-8 6-16 13-16s13 8 13 16v3H11z" fill="#1e3a5f" />
            <path d="M10 20h28v4H10z" fill="#0f172a" />
            <rect x="14" y="16" width="20" height="7" rx="3" fill="#38bdf8" />
            <line x1="16" y1="18" x2="23" y2="18" stroke="#ffffff" strokeWidth="1" strokeLinecap="round" opacity="0.8" />
            <circle cx="10" cy="22" r="3" fill="#334155" />
            <path d="M10 23c0 4 5 6 9 6" stroke="#334155" strokeWidth="1.5" fill="none" />
            <circle cx="19" cy="29" r="1.5" fill="#38bdf8" />
          </g>
        ) : (
          <g>
            <path d="M6 46c0-9 7-15 18-15s18 6 18 15z" fill="#991b1b" />
            <line x1="8" y1="46" x2="38" y2="34" stroke="#1c1917" strokeWidth="3" />
            <rect x="18" y="24" width="12" height="9" rx="2" fill="#292524" />
            <path d="M13 22c0-7 5-15 11-15s11 8 11 15v4H13z" fill="#44403c" />
            <rect x="12" y="10" width="24" height="4" rx="2" fill="#292524" />
            <rect x="15" y="15" width="18" height="8" rx="2" fill="#d97706" opacity="0.8" />
            <rect x="15" y="16" width="8" height="5" rx="1.5" fill="#09090b" />
            <rect x="25" y="16" width="8" height="5" rx="1.5" fill="#09090b" />
            <line x1="23" y1="18" x2="25" y2="18" stroke="#09090b" strokeWidth="1.5" />
          </g>
        )}
      </svg>
      {isDead && (
        <div className="blast-avatar__dead-badge" title="Eliminated">
          <svg viewBox="0 0 24 24" fill="#ef4444" width="22" height="22">
            <path d="M12 2a7 7 0 00-7 7c0 2.5 1.3 4.6 3.2 5.8V17a1 1 0 001 1h5.6a1 1 0 001-1v-2.2c1.9-1.2 3.2-3.3 3.2-5.8a7 7 0 00-7-7zm-2.5 8a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm5 0a1.5 1.5 0 110-3 1.5 1.5 0 010 3z" />
          </svg>
        </div>
      )}
    </div>
  );
}

function BlastPlayerCard({
  p,
  followed,
  onSelect,
}: {
  p: LivePlayer;
  followed: string;
  onSelect: (p: LivePlayer) => void;
}) {
  const isObserved = p.id === followed;
  const isDead = p.hp <= 0;
  return (
    <button
      type="button"
      className={`blast-player-card blast-player-card--${p.team} ${isObserved ? 'is-observed' : ''} ${isDead ? 'is-dead' : ''}`}
      onClick={() => onSelect(p)}
      disabled={isDead}
      aria-label={`${p.name} · ${p.hp} HP · ${p.role}`}
    >
      {isObserved && <span className="blast-player-card__pointer">▲</span>}
      <TacticalAvatar attacking={p.attacking} isDead={isDead} />
      <div className="blast-player-card__hp-wrap">
        <span className="blast-player-card__hp">{isDead ? '0' : Math.ceil(p.hp)}</span>
        <div className="blast-player-card__health-bar">
          <div className="blast-player-card__health-fill" style={{ width: `${Math.max(0, p.hp)}%` }} />
        </div>
      </div>
      <div className="blast-player-card__name-row">
        <strong className="blast-player-card__name">{p.name}</strong>
        <span className="blast-player-card__cash">${p.cash}</span>
      </div>
      <div className="blast-player-card__gear-row">
        <span className="blast-player-card__weapon">
          <WeaponSilhouette weapon={p.equipped} />
        </span>
        <div className="blast-player-card__utils">
          {p.flash > 0 && <span className="blast-pill blast-pill--flash" title={`${p.flash} Flashbang`}>⚡{p.flash > 1 ? p.flash : ''}</span>}
          {p.smoke > 0 && <span className="blast-pill blast-pill--smoke" title={`${p.smoke} Smoke`}>💨</span>}
          {p.incendiary > 0 && <span className="blast-pill blast-pill--incendiary" title={`${p.incendiary} ${p.attacking ? 'Molotov' : 'Incendiary'}`}>🔥</span>}
          {p.he > 0 && <span className="blast-pill blast-pill--he" title={`${p.he} HE grenade`}>HE</span>}
          {p.armor > 0 && <span className="blast-pill blast-pill--armor" title={`Armor: ${p.armor}`}>🛡️</span>}
          {p.kit && <span className="blast-pill blast-pill--kit" title="Defuse Kit">✂️</span>}
          {p.bomb && <span className="blast-pill blast-pill--bomb" title="Carrying Device">💣</span>}
        </div>
      </div>
    </button>
  );
}

function BlastCenterFocusCard({
  observed,
  mode,
  onSelectCamera,
  isBlueDefending,
  isRedDefending,
}: {
  observed: LivePlayer;
  mode: LiveCameraMode;
  onSelectCamera: (m: LiveCameraMode) => void;
  isBlueDefending: boolean;
  isRedDefending: boolean;
}) {
  const isCT = observed.team === 'blue' ? isBlueDefending : isRedDefending;
  return (
    <div className={`blast-focus-card blast-focus-card--${observed.team}`}>
      <div className="blast-focus-card__header">
        <span className="blast-focus-card__obs-tag">
          <span className="blast-rec-dot" /> OBSERVING · {observed.team === 'blue' ? (isCT ? '🛡️ CT' : '⚔️ T') : (isCT ? '🛡️ CT' : '⚔️ T')}
        </span>
        <span className="blast-focus-card__callout">📍 {observed.callout}</span>
      </div>
      <div className="blast-focus-card__main">
        <div className="blast-focus-card__profile">
          <h3 className="blast-focus-card__name">{observed.name}</h3>
          <span className="blast-focus-card__role">[{observed.role.toUpperCase()}]</span>
        </div>
        <div className="blast-focus-card__ammo-box">
          {observed.equipped === 'knife' ? (
            <span className="blast-focus-card__ammo-val">MELEE</span>
          ) : observed.equipped === 'flash' || observed.equipped === 'smoke' || observed.equipped === 'incendiary' || observed.equipped==='he' ? (
            <span className="blast-focus-card__ammo-val">UTILITY</span>
          ) : (
            <span className="blast-focus-card__ammo-val">
              {observed.ammo}
              <small> / {observed.reserve}</small>
            </span>
          )}
          <span className="blast-focus-card__weapon-name">
            {observed.equipped === 'knife' ? LIVE_KNIFE.name : observed.equipped === 'flash' ? 'Flashbang' : observed.equipped === 'smoke' ? 'Smoke grenade' : observed.equipped === 'incendiary' ? (observed.attacking ? 'Molotov' : 'Incendiary') : observed.equipped==='he'?'HE grenade':LIVE_WEAPONS[observed.weapon].name}
          </span>
        </div>
      </div>
      <div className="blast-focus-card__action-line">
        <span className="blast-focus-card__action-text">
          {observed.hp <= 0 ? 'Eliminated' : observed.action}
          {observed.channel > 0 ? ` (${observed.channel.toFixed(1)}s)` : ''}
        </span>
      </div>
      {observed.radioMessage && (
        <div className="blast-focus-card__radio">
          <span className="blast-focus-card__radio-icon">📻</span> {observed.radioMessage}
        </div>
      )}
      <p className="blast-focus-card__intent" title={observed.intent}>
        "{observed.intent}"
      </p>
      <div className="blast-focus-card__cams">
        {(['first', 'third', 'director', 'overview'] as const).map(cm => (
          <button
            type="button"
            key={cm}
            className={`blast-cam-btn ${mode === cm ? 'is-active' : ''}`}
            onClick={() => onSelectCamera(cm)}
          >
            {cm === 'first' ? '1P' : cm === 'third' ? '3P' : cm === 'director' ? 'AUTO' : 'MAP'}
          </button>
        ))}
      </div>
    </div>
  );
}

function BlastScoreboard({
  frame,
  blueSideTitle,
  blueSideRole,
  isBlueDefending,
  redSideTitle,
  redSideRole,
  isRedDefending,
  clutchLabel,
  bluePct,
  redPct,
}: {
  frame: LiveSnapshot;
  blueSideTitle: string;
  blueSideRole: string;
  isBlueDefending: boolean;
  redSideTitle: string;
  redSideRole: string;
  isRedDefending: boolean;
  clutchLabel: string;
  bluePct: number;
  redPct: number;
}) {
  const isPlanted = frame.bomb.status === 'planted';
  return (
    <div className="blast-scoreboard">
      {/* Blue Team Block */}
      <div className={`blast-scoreboard__team blast-scoreboard__team--blue ${isBlueDefending ? 'is-ct' : 'is-t'}`}>
        <div className="blast-scoreboard__team-info">
          <span className="blast-scoreboard__team-name">{blueSideTitle}</span>
          <span className="blast-scoreboard__team-sub">BLUE · {blueSideRole}</span>
        </div>
        <div className="blast-scoreboard__score blast-scoreboard__score--blue">
          {frame.score.blue}
        </div>
      </div>

      {/* Center Match & Timer Module */}
      <div className="blast-scoreboard__center">
        <div className="blast-scoreboard__round-info">
          <span>ROUND {frame.round} {frame.round > 30 ? '· OT' : '/ 30'}</span>
          <span className={`blast-scoreboard__phase blast-scoreboard__phase--${frame.phase}`}>{frame.phase === 'freeze' ? 'BUY PHASE' : frame.phase === 'post' ? 'ROUND BREAK' : frame.phase === 'finished' ? 'MATCH OVER' : 'LIVE'}</span>
          {clutchLabel && <span className="blast-scoreboard__clutch">{clutchLabel}</span>}
        </div>
        <div className={`blast-scoreboard__timer ${isPlanted ? 'is-planted' : ''}`}>
          {isPlanted ? (
            <span className="blast-planted-pulse">💣 {Math.ceil(frame.remaining)}s</span>
          ) : (
            clock(frame.remaining)
          )}
        </div>
        {/* Win Prediction Bar (BLAST Premier Style!) */}
        <div className="blast-prediction">
          <div className="blast-prediction__header">
            <span className="blast-pred-blue">{bluePct}%</span>
            <span className="blast-pred-label">AI PREDICTION</span>
            <span className="blast-pred-red">{redPct}%</span>
          </div>
          <div className="blast-prediction__bar">
            <div className="blast-pred-fill blast-pred-fill--blue" style={{ width: `${bluePct}%` }} />
            <div className="blast-pred-fill blast-pred-fill--red" style={{ width: `${redPct}%` }} />
          </div>
        </div>
      </div>

      {/* Red Team Block */}
      <div className={`blast-scoreboard__team blast-scoreboard__team--red ${isRedDefending ? 'is-ct' : 'is-t'}`}>
        <div className="blast-scoreboard__score blast-scoreboard__score--red">
          {frame.score.red}
        </div>
        <div className="blast-scoreboard__team-info">
          <span className="blast-scoreboard__team-name">{redSideTitle}</span>
          <span className="blast-scoreboard__team-sub">RED · {redSideRole}</span>
        </div>
      </div>
    </div>
  );
}

export function FpsLiveBroadcast({ blue, red, seed, identity, skillProfiles, learningEnabled=true, onExit }: Props) {
  const [attempt, setAttempt] = useState(0);
  const { simulation, activeSeed } = useMemo(
    () => {
      const activeSeed = freshFpsExhibitionSeed(seed);
      return { activeSeed, simulation: new FpsLiveSimulation(blue, red, activeSeed, identity, { skillProfiles,
        learning:learningEnabled?{mode:'learn',model:readFpsLearning(),onRound:round=>{saveFpsLearningRound(round);}}:undefined,
        mechanicsLearning:learningEnabled?{model:readFpsMechanicsLearning(),onRound:round=>{saveFpsMechanicsRound(round);}}:undefined }) };
    },
    [blue, red, seed, identity, skillProfiles, learningEnabled, attempt]
  );
  const [frame, setFrame] = useState(() => simulation.snapshot());
  const [paused, setPaused] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [mode, setMode] = useState<LiveCameraMode>('director');
  const [selected, setSelected] = useState(blue[0].id);
  const [followed, setFollowed] = useState(blue[0].id);
  const [effectiveCamera, setEffectiveCamera] = useState<Exclude<LiveCameraMode, 'director'>>('overview');
  const [autoPipEnabled, setAutoPipEnabled] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    try { return typeof window === 'undefined' || window.localStorage.getItem('hexatrick:fps-sound') !== 'off'; }
    catch { return true; }
  });
  const [plantPip, setPlantPip] = useState<BombPlantPipState>(EMPTY_PLANT_PIP);
  const [plantPipHudVisible, setPlantPipHudVisible] = useState(true);
  const [popoutHudVisible, setPopoutHudVisible] = useState(true);
  const [popoutKind, setPopoutKind] = useState<'none' | 'document' | 'video'>('none');
  const canvas = useRef<HTMLCanvasElement>(null);
  const host = useRef<HTMLElement>(null);
  const stageMount = useRef<HTMLDivElement>(null);
  const stageEl = useRef<HTMLDivElement>(null);
  const pipViewportEl = useRef<HTMLDivElement>(null);
  const pipVideo = useRef<HTMLVideoElement>(null);
  const pipStream = useRef<MediaStream | null>(null);
  const pipWindow = useRef<Window | null>(null);
  const rafWindow = useRef<Window>(window);
  const animId = useRef(0);
  const viewerRef = useRef<import('../fps/fpsLiveViewer').FpsLiveViewer | undefined>(undefined);
  const audioRef = useRef<FpsBroadcastAudio | null>(null);
  if(!audioRef.current)audioRef.current=new FpsBroadcastAudio();
  const audioFollowedId = useRef(blue[0].id);
  const scheduleFrameRef = useRef<(() => void) | null>(null);
  const controls = useRef({ paused, mode, selected, autoPipEnabled });
  controls.current = { paused, mode, selected, autoPipEnabled };

  useEffect(() => {
    audioRef.current?.setEnabled(soundEnabled);
    try { window.localStorage.setItem('hexatrick:fps-sound', soundEnabled ? 'on' : 'off'); } catch { /* Local storage is optional. */ }
  }, [soundEnabled]);

  useEffect(() => () => audioRef.current?.dispose(), []);

  const syncPipViewport = useCallback(() => {
    const activeViewer = viewerRef.current;
    if (!activeViewer || !canvas.current || !pipViewportEl.current || !controls.current.autoPipEnabled) {
      activeViewer?.setPipViewport(null);
      return;
    }
    const vpRect = pipViewportEl.current.getBoundingClientRect();
    const canvasRect = canvas.current.getBoundingClientRect();
    activeViewer.setPipViewport(domRectToBabylonViewport(vpRect, canvasRect));
  }, []);

  const restoreStageFromDocumentPip = useCallback(() => {
    if (stageEl.current && stageMount.current && stageEl.current.parentElement !== stageMount.current) {
      stageMount.current.appendChild(stageEl.current);
      viewerRef.current?.resizeNow();
      requestAnimationFrame(() => {
        viewerRef.current?.resizeNow();
        syncPipViewport();
      });
    }
  }, [syncPipViewport]);

  const closePopout = useCallback(async () => {
    const openWin = pipWindow.current;
    pipWindow.current = null;
    restoreStageFromDocumentPip();
    if (openWin && !openWin.closed) {
      try {
        openWin.close();
      } catch {
        // Ignore cross-window close errors.
      }
    }
    if (pipStream.current) {
      for (const track of pipStream.current.getTracks()) track.stop();
      pipStream.current = null;
    }
    if (pipVideo.current) {
      pipVideo.current.srcObject = null;
    }
    if (document.pictureInPictureElement && document.pictureInPictureElement === pipVideo.current) {
      try {
        await document.exitPictureInPicture();
      } catch {
        // Ignore if PIP already closed.
      }
    }
    setPopoutKind('none');
    scheduleFrameRef.current?.();
  }, [restoreStageFromDocumentPip]);

  useEffect(() => {
    return () => {
      void closePopout();
    };
  }, [closePopout]);

  useEffect(() => {
    let disposed = false;
    let viewer: import('../fps/fpsLiveViewer').FpsLiveViewer | undefined;
    let current = simulation.snapshot(), previous = current, lastHud = 0;
    let last: number | undefined;
    let lastPipActive = false;
    const fixed = new FpsFixedStepClock(LIVE_FPS_STEP);
    setFrame(current);
    setPlantPip(EMPTY_PLANT_PIP);
    setReady(false);
    setError('');
    setPaused(false);
    setNotice('');
    const visibility = () => {
      last = undefined;
      const docPipOpen = Boolean(pipWindow.current && !pipWindow.current.closed);
      if (document.hidden && !docPipOpen) {
        controls.current.paused = true;
        setPaused(true);
        setNotice('Exhibition paused while this tab is hidden. Resume when you are ready.');
      }
    };
    document.addEventListener('visibilitychange', visibility);
    import('../fps/fpsLiveViewer').then(({ FpsLiveViewer }) => {
      if (disposed || !canvas.current) return;
      viewer = new FpsLiveViewer(canvas.current, () => {
        controls.current.paused = true;
        setPaused(true);
        setError('The 3D graphics context was lost. Restart the exhibition to reconnect.');
      });
      viewerRef.current = viewer;
      setReady(true);
      last = undefined;
      const loop = (now: number) => {
        if (disposed) return;
        try {
          const docPipOpen = Boolean(pipWindow.current && !pipWindow.current.closed);
          const elapsed = last === undefined ? 0 : Math.max(0, now - last) / 1000;
          last = last === undefined ? now : Math.max(last, now);
          if (!controls.current.paused && (!document.hidden || docPipOpen)) {
            let completed=0;
            let beforeFinal:LiveSnapshot|undefined;
            const steps = fixed.advance(elapsed, () => {
              if(completed>0&&fixed.pendingSeconds<fixed.stepSeconds*2-1e-9)beforeFinal=simulation.snapshot();
              simulation.step();
              const cues=simulation.drainAudioCues();
              if(cues.length) {
                const listener=simulation.audioListener(audioFollowedId.current);
                if(listener)for(const cue of cues)audioRef.current?.play(cue,listener);
              }
              completed++;
            }, 8);
            if(steps>0){
              previous=steps>1?(beforeFinal??current):current;
              current=simulation.snapshot();
            }
            if (steps === 8 && fixed.pendingSeconds > .5) setNotice('The exhibition is catching up to real time.');
          }
          const result = viewer!.render(
            previous,
            current,
            Math.min(1, fixed.pendingSeconds / LIVE_FPS_STEP),
            controls.current.mode,
            controls.current.selected,
            elapsed,
            controls.current.autoPipEnabled
          );
          const pipChanged = result.pip.active !== lastPipActive;
          if (pipChanged || now - lastHud >= 100) {
            lastPipActive = result.pip.active;
            setFrame(current);
            setFollowed(result.followedId);
            audioFollowedId.current=result.followedId;
            setEffectiveCamera(result.effectiveMode);
            setPlantPip(result.pip.active ? result.pip : EMPTY_PLANT_PIP);
            if (!result.pip.active) viewer?.setPipViewport(null);
            lastHud = now;
          }
          const targetWin = (pipWindow.current && !pipWindow.current.closed) ? pipWindow.current : window;
          rafWindow.current = targetWin;
          animId.current = targetWin.requestAnimationFrame(loop);
        } catch (problem) {
          controls.current.paused = true;
          setPaused(true);
          setError(problem instanceof Error ? problem.message : 'The live exhibition stopped.');
        }
      };
      scheduleFrameRef.current = () => {
        if (disposed) return;
        try {
          rafWindow.current.cancelAnimationFrame(animId.current);
        } catch {
          // Ignore stale RAF handle.
        }
        const targetWin = (pipWindow.current && !pipWindow.current.closed) ? pipWindow.current : window;
        rafWindow.current = targetWin;
        animId.current = targetWin.requestAnimationFrame(loop);
      };
      rafWindow.current = (pipWindow.current && !pipWindow.current.closed) ? pipWindow.current : window;
      animId.current = rafWindow.current.requestAnimationFrame(loop);
    }).catch(problem => {
      if (!disposed) setError(problem instanceof Error ? problem.message : 'This browser could not start 3D graphics.');
    });
    return () => {
      disposed = true;
      scheduleFrameRef.current = null;
      viewerRef.current = undefined;
      try {
        rafWindow.current.cancelAnimationFrame(animId.current);
      } catch {
        cancelAnimationFrame(animId.current);
      }
      document.removeEventListener('visibilitychange', visibility);
      viewer?.dispose();
    };
  }, [simulation]);

  useEffect(() => {
    if (!ready || !autoPipEnabled || !plantPip.active) {
      viewerRef.current?.setPipViewport(null);
      return;
    }
    syncPipViewport();
    const ro = new ResizeObserver(() => syncPipViewport());
    if (canvas.current) ro.observe(canvas.current);
    if (pipViewportEl.current) ro.observe(pipViewportEl.current);
    const activeWin = (pipWindow.current && !pipWindow.current.closed) ? pipWindow.current : window;
    activeWin.addEventListener('resize', syncPipViewport);
    return () => {
      ro.disconnect();
      activeWin.removeEventListener('resize', syncPipViewport);
    };
  }, [ready, autoPipEnabled, plantPip.active, popoutKind, syncPipViewport]);

  const togglePopoutPip = async () => {
    if (popoutKind !== 'none') {
      await closePopout();
      return;
    }
    const docPip = (window as unknown as { documentPictureInPicture?: DocumentPictureInPictureApi }).documentPictureInPicture;
    if (docPip && stageEl.current) {
      try {
        setPopoutHudVisible(true);
        const win = await docPip.requestWindow({ width: 960, height: 540 });
        cloneDocumentStylesToPipWindow(document, win.document);
        win.document.title = 'HEXATRICK · Live Broadcast PIP';
        win.document.body.style.margin = '0';
        win.document.body.style.background = '#080c12';
        win.document.body.style.overflow = 'hidden';
        win.document.body.style.height = '100vh';
        win.document.body.className = 'live-fps__doc-pip-body';

        const wrapper = win.document.createElement('div');
        wrapper.className = 'live-fps__doc-pip-shell';
        wrapper.appendChild(stageEl.current);
        win.document.body.appendChild(wrapper);

        pipWindow.current = win;
        setPopoutKind('document');
        setNotice('');

        const onPipResize = () => {
          viewerRef.current?.resizeNow();
          syncPipViewport();
        };
        const onPageHide = () => {
          win.removeEventListener('resize', onPipResize);
          pipWindow.current = null;
          restoreStageFromDocumentPip();
          setPopoutKind('none');
          scheduleFrameRef.current?.();
        };
        win.addEventListener('resize', onPipResize);
        win.addEventListener('pagehide', onPageHide, { once: true });

        viewerRef.current?.resizeNow();
        win.requestAnimationFrame(() => {
          viewerRef.current?.resizeNow();
          syncPipViewport();
        });
        scheduleFrameRef.current?.();
        return;
      } catch (err) {
        restoreStageFromDocumentPip();
        pipWindow.current = null;
        setNotice(err instanceof Error ? err.message : 'Floating broadcast window could not be opened; trying video PIP.');
      }
    }

    const canvasEl = canvas.current as (HTMLCanvasElement & { captureStream?: (fps?: number) => MediaStream }) | null;
    const videoEl = pipVideo.current;
    if (canvasEl && videoEl && document.pictureInPictureEnabled && typeof canvasEl.captureStream === 'function') {
      try {
        const stream = canvasEl.captureStream(30);
        pipStream.current = stream;
        videoEl.srcObject = stream;
        await videoEl.play();
        await videoEl.requestPictureInPicture();
        setPopoutKind('video');
        setNotice('');
        videoEl.addEventListener(
          'leavepictureinpicture',
          () => {
            if (pipStream.current) {
              for (const t of pipStream.current.getTracks()) t.stop();
              pipStream.current = null;
            }
            videoEl.srcObject = null;
            setPopoutKind('none');
          },
          { once: true },
        );
        return;
      } catch {
        if (pipStream.current) {
          for (const t of pipStream.current.getTracks()) t.stop();
          pipStream.current = null;
        }
        videoEl.srcObject = null;
      }
    }
    setNotice('Browser pop-out Picture-in-Picture is unavailable in this browser.');
  };

  const observe = (p: LivePlayer) => {
    setSelected(p.id);
    if (mode === 'director' || mode === 'overview') setMode('first');
  };
  const togglePause = () => {
    setPaused(value => !value);
    setNotice('');
  };
  const toggleSound = () => {
    const next=!soundEnabled;
    setSoundEnabled(next);
    audioRef.current?.setEnabled(next);
    if(next)audioRef.current?.activate();
  };
  const downloadDiagnostics = () => {
    const data = { format: 'hexatrick-local-fps-diagnostics-v3', seed: activeSeed, skillProfiles,
      learning:simulation.learningDiagnostics(),snapshot: simulation.snapshot() };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `hexatrick-fps-diagnostics-${activeSeed}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const observed = frame.players.find(p => p.id === followed) ?? frame.players[0];
  const scopeKind = effectiveCamera === 'first' && observed.hp > 0 && observed.speed < .65
    && ['Engaging','Holding','Crouch-holding'].includes(observed.action)
    ? observed.equipped === 'sniper' || observed.equipped === 'scout' ? observed.equipped : undefined
    : undefined;
  const recent = frame.events.filter(e => frame.time - e.time < 12 && e.kind !== 'round').slice(-6);
  const roundOver = frame.phase === 'post' || frame.phase === 'finished';
  const aliveBlue = frame.players.filter(p => p.team === 'blue' && p.hp > 0).length;
  const aliveRed = frame.players.filter(p => p.team === 'red' && p.hp > 0).length;
  const clutchLabel = (aliveBlue === 1 && aliveRed >= 1) ? `1v${aliveRed} CLUTCH` : (aliveRed === 1 && aliveBlue >= 1) ? `1v${aliveBlue} CLUTCH` : `${aliveBlue} v ${aliveRed}`;
  const isBlueDefending = frame.attackTeam !== 'blue';
  const isRedDefending = frame.attackTeam !== 'red';
  const blueSideTitle = isBlueDefending ? 'CT FORCE' : 'T FORCE';
  const blueSideRole = isBlueDefending ? 'DEFEND' : 'ATTACK';
  const redSideTitle = isRedDefending ? 'CT FORCE' : 'T FORCE';
  const redSideRole = isRedDefending ? 'DEFEND' : 'ATTACK';

  // Dynamic AI Win Prediction Calculation (BLAST Premier Style)
  const blueAlive = frame.players.filter(p => p.team === 'blue' && p.hp > 0);
  const redAlive = frame.players.filter(p => p.team === 'red' && p.hp > 0);
  let bluePower = blueAlive.reduce((sum, p) => sum + p.hp * (p.equipped === 'sniper' ? 1.35 : p.equipped === 'rifle' ? 1.2 : 0.85), 0);
  let redPower = redAlive.reduce((sum, p) => sum + p.hp * (p.equipped === 'sniper' ? 1.35 : p.equipped === 'rifle' ? 1.2 : 0.85), 0);
  if (frame.bomb.status === 'planted') {
    if (frame.attackTeam === 'blue') bluePower *= 1.75;
    else redPower *= 1.75;
  }
  if (roundOver) {
    bluePower = frame.roundWinner === 'blue' ? 100 : 0;
    redPower = frame.roundWinner === 'red' ? 100 : 0;
  }
  const totalPower = bluePower + redPower || 1;
  const bluePct = Math.max(5, Math.min(95, Math.round((bluePower / totalPower) * 100)));
  const redPct = 100 - bluePct;

  return (
    <section
      className="live-fps"
      ref={host}
      aria-label="Hexatrick live 3D exhibition"
      tabIndex={0}
      onPointerDownCapture={() => audioRef.current?.activate()}
      onKeyDown={event => {
        if (event.repeat || error) return;
        if (/INPUT|SELECT|TEXTAREA|BUTTON/.test((event.target as HTMLElement).tagName)) return;
        if (event.code === 'Space') { event.preventDefault(); togglePause(); }
        if (event.key.toLowerCase() === 'c') setMode(value => cameraModes[(cameraModes.indexOf(value) + 1) % cameraModes.length]);
        if (event.key.toLowerCase() === 'p') setAutoPipEnabled(value => !value);
        const slot = '1234567890'.indexOf(event.key);
        if (slot >= 0 && frame.players[slot]?.hp > 0) observe(frame.players[slot]);
      }}
    >
      {/* Top Toolbar */}
      <div className="live-fps__toolbar">
        <div>
          <span className="live-fps__brand">HEXATRICK</span>
          <span className="live-fps__badge">3D EXHIBITION · BLAST HUD</span>
        </div>
        <div className="live-fps__controls">
          <button type="button" disabled={!ready || !!error || frame.phase === 'finished'} onClick={togglePause}>{paused ? 'Resume' : 'Pause'}</button>
          <button type="button" onClick={() => setAttempt(v => v + 1)}>New match</button>
          <details className="live-fps__more-controls">
            <summary>More</summary>
            <div className="live-fps__more-menu">
              {frame.learning&&<span className="live-fps__learning-status" role="status">Movement routes · {frame.learning.rounds} rounds<br/>{frame.learning.updates} updates · {frame.learning.explorations} route experiments</span>}
              {frame.mechanicsLearning&&<span className="live-fps__learning-status" role="status">Combat mechanics · {frame.mechanicsLearning.rounds} rounds<br/>{frame.mechanicsLearning.updates} cadence updates · {frame.mechanicsLearning.explorations} experiments</span>}
              <button type="button" className={soundEnabled ? 'live-fps__toggle--active' : undefined} aria-pressed={soundEnabled} onClick={toggleSound}>FPS sound: {soundEnabled ? 'On' : 'Off'}</button>
              <button type="button" className={autoPipEnabled ? 'live-fps__toggle--active' : undefined} aria-pressed={autoPipEnabled} onClick={() => setAutoPipEnabled(value => !value)}>Bomb PIP: {autoPipEnabled ? 'On' : 'Off'}</button>
              <button type="button" className={popoutKind !== 'none' ? 'live-fps__toggle--active' : undefined} disabled={!ready || !!error} onClick={() => void togglePopoutPip()}>{popoutKind !== 'none' ? 'Close pop-out' : 'Pop-out video'}</button>
              <button type="button" onClick={downloadDiagnostics}>Export diagnostics</button>
              <button type="button" onClick={() => {
                const task = document.fullscreenElement ? document.exitFullscreen() : host.current?.requestFullscreen?.();
                task?.catch(() => setNotice('Fullscreen is unavailable in this browser.'));
              }}>Fullscreen</button>
            </div>
          </details>
          <button type="button" onClick={onExit}>Exit</button>
        </div>
      </div>

      {/* 3D Stage Viewport with BLAST Broadcast HUD (supports reparenting into Document PIP window) */}
      <div className="live-fps__stage-container">
        {popoutKind === 'document' && (
          <div className="live-fps__popout-placeholder" role="status">
            <strong>Broadcast popped out in floating PIP window</strong>
            <span>Main camera continues tracking kills while C4 plant PIP activates on plants.</span>
            <button type="button" onClick={() => void closePopout()}>Return broadcast to tab</button>
          </div>
        )}
        <div ref={stageMount} className="live-fps__stage-mount">
          <div ref={stageEl} className="live-fps__stage" onPointerDownCapture={() => audioRef.current?.activate()}>
            <canvas ref={canvas} className="live-fps__canvas" aria-label="Live 3D match." />
            {popoutKind === 'document' && <div className="live-fps__pip-controls">
              <button type="button" className="live-fps__pip-hud-toggle" onClick={() => setPopoutHudVisible(value => !value)} aria-pressed={popoutHudVisible} aria-label={popoutHudVisible ? 'Hide broadcast HUD' : 'Show broadcast HUD'}>{popoutHudVisible ? 'Hide HUD' : 'Show HUD'}</button>
              <button type="button" className="live-fps__pip-hud-toggle" onClick={toggleSound} aria-pressed={soundEnabled} aria-label={soundEnabled ? 'Mute FPS sound' : 'Enable FPS sound'}>{soundEnabled ? 'Sound On' : 'Sound Off'}</button>
            </div>}
            <div className="live-fps__stage-hud" hidden={popoutKind === 'document' && !popoutHudVisible}>

        {/* Top-Left Tournament Pill */}
        <div className="blast-series-badge">
          <span className="blast-series-brand">BLAST PREMIER</span>
          <span className="blast-series-divider">/</span>
          <span className="blast-series-event">HEXATRICK</span>
          <span className="blast-series-map">{LIVE_FPS_MAP.name}</span>
        </div>

        {/* Top-Center Scoreboard (BLAST Premier Style) */}
        <BlastScoreboard
          frame={frame}
          blueSideTitle={blueSideTitle}
          blueSideRole={blueSideRole}
          isBlueDefending={isBlueDefending}
          redSideTitle={redSideTitle}
          redSideRole={redSideRole}
          isRedDefending={isRedDefending}
          clutchLabel={clutchLabel}
          bluePct={bluePct}
          redPct={redPct}
        />

        {/* Tactical Minimap Radar (Top Left below series badge) */}
        <svg className="blast-radar" viewBox="0 0 72 92" role="img" aria-label="Tactical minimap">
          <rect width="72" height="92" fill="#09121be8" rx="4" />
          {[-24, -12, 0, 12, 24].map(gx => <line key={`gx-${gx}`} x1={gx + 36} y1="0" x2={gx + 36} y2="92" stroke="#142636" strokeWidth=".3" />)}
          {[-36, -18, 0, 18, 36].map(gz => <line key={`gz-${gz}`} x1="0" y1={46 - gz} x2="72" y2={46 - gz} stroke="#142636" strokeWidth=".3" />)}

          {/* Bombsites A and B tactical capture zones */}
          <rect x={-23 + 36 - 6.5} y={46 - 21 - 6.5} width="13" height="13" rx="2" fill="#7a2525" fillOpacity=".35" stroke="#ef4444" strokeWidth=".45" strokeDasharray="1.6 1.2" />
          <rect x={23 + 36 - 6.5} y={46 - 21 - 6.5} width="13" height="13" rx="2" fill="#7a2525" fillOpacity=".35" stroke="#ef4444" strokeWidth=".45" strokeDasharray="1.6 1.2" />

          {/* Landmarks */}
          <circle cx={23 + 36} cy={46 - 21} r="2.4" fill="#1b2f3d" stroke="#487894" strokeWidth=".35" />
          <rect x={-30 + 36 - 1.5} y={46 - 16 - 1.5} width="3" height="4.5" fill="#18232c" stroke="#425769" strokeWidth=".3" />
          <rect x={-4.75 + 36 - 1.75} y={46 - (-10) - 1.5} width="3.5" height="3" fill="#152432" stroke="#3f6685" strokeWidth=".3" strokeDasharray="1 .8" />

          {/* Map solids */}
          {LIVE_FPS_MAP.solids.map(w => <rect key={w.id} x={w.minX + 36} y={46 - w.maxZ} width={w.maxX - w.minX} height={w.maxZ - w.minZ} fill="#23384c" stroke="#3d586e" strokeWidth=".35" />)}

          {/* Zone callout labels */}
          <text x="54" y="65" fill="#94a3b8" fontSize="2.4" textAnchor="middle" opacity=".85">BANANA</text>
          <text x="31.25" y="58.5" fill="#94a3b8" fontSize="2.2" textAnchor="middle" opacity=".85">UNDERPASS</text>
          <text x="6" y="34.5" fill="#94a3b8" fontSize="2.2" textAnchor="middle" opacity=".85">PIT</text>
          <text x="24" y="52" fill="#94a3b8" fontSize="2.2" textAnchor="middle" opacity=".85">APPS</text>
          <text x="48" y="14" fill="#94a3b8" fontSize="2.2" textAnchor="middle" opacity=".85">SPEEDWAY</text>

          {/* Site badges */}
          {Object.entries(LIVE_FPS_MAP.sites).map(([site, p]) => (
            <g key={site}>
              <rect x={p.x + 36 - 2.8} y={46 - p.z - 2.8} width="5.6" height="5.6" rx="1.2" fill="#dc2626" stroke="#ffffff" strokeWidth=".4" />
              <text x={p.x + 36} y={46 - p.z + 1.8} fill="#ffffff" fontSize="4.4" fontWeight="900" textAnchor="middle">{site}</text>
            </g>
          ))}

          {/* Smokes */}
          {frame.smokes.map(s => <circle key={s.id} cx={s.x + 36} cy={46 - s.z} r={s.radius} fill="#cbd5e1" opacity=".52" />)}
          {frame.fires.map(f => <circle key={f.id} cx={f.x + 36} cy={46 - f.z} r={f.radius} fill="#f97316" opacity=".4" />)}

          {/* Dropped weapons */}
          {frame.droppedWeapons?.map(w => (
            <g key={w.id}>
              <circle cx={w.x + 36} cy={46 - w.z} r="1.1" fill="#eab308" stroke="#ffffff" strokeWidth=".25" />
              <text x={w.x + 36} y={46 - w.z + .4} fill="#000000" fontSize="1.0" fontWeight="bold" textAnchor="middle">W</text>
            </g>
          ))}

          {/* Players with strict eye-level vision cones */}
          {frame.players.filter(p => p.hp > 0).map(p => {
            const px = p.x + 36, pz = 46 - p.z;
            const coneLen = 4.2;
            const halfFov = 0.82; // 47 degree half-angle
            const leftAngle = p.yaw - halfFov, rightAngle = p.yaw + halfFov;
            const lx = px + Math.sin(leftAngle) * coneLen, lz = pz - Math.cos(leftAngle) * coneLen;
            const rx = px + Math.sin(rightAngle) * coneLen, rz = pz - Math.cos(rightAngle) * coneLen;
            const teamColor = p.team === 'blue' ? '#38bdf8' : '#ef4444';
            return (
              <g key={p.id}>
                <polygon points={`${px},${pz} ${lx},${lz} ${rx},${rz}`} fill={teamColor} fillOpacity=".22" />
                <circle cx={px} cy={pz} r={p.id === followed ? 2.2 : 1.4} fill={teamColor} stroke={p.id === followed ? '#ffffff' : '#000000'} strokeWidth=".6" />
                <line x1={px} y1={pz} x2={px + Math.sin(p.yaw) * 3.4} y2={pz - Math.cos(p.yaw) * 3.4} stroke="#ffffff" strokeWidth=".5" />
              </g>
            );
          })}

          {/* Bomb indicator */}
          {(frame.bomb.status === 'planted' || frame.bomb.status === 'dropped') && (
            <g>
              <rect x={frame.bomb.x + 34.5} y={44.5 - frame.bomb.z} width="3" height="3" rx=".6" fill="#facc15" stroke="#1e293b" strokeWidth=".35" />
              <circle cx={frame.bomb.x + 36} cy={46 - frame.bomb.z} r=".7" fill="#ef4444" />
            </g>
          )}
        </svg>

        {/* BLAST Killfeed (Top Right) */}
        <div className="blast-killfeed" aria-label="Recent match events">
          {recent.map(e => {
            if (e.kind === 'kill') {
              const killer = frame.players.find(p => p.id === e.actorId);
              const victim = frame.players.find(p => p.id === e.targetId);
              if (e.weapon === 'bomb' && victim) {
                return <div key={e.id} className="blast-killfeed__item"><span className="blast-killfeed__name blast-killfeed__name--neutral">C4</span><span className="blast-killfeed__weapon"><WeaponSilhouette weapon="bomb" /></span><span className={`blast-killfeed__name blast-killfeed__name--${victim.team}`}>{victim.name}</span></div>;
              }
              if (killer && victim) {
                return (
                  <div key={e.id} className="blast-killfeed__item">
                    <span className={`blast-killfeed__name blast-killfeed__name--${killer.team}`}>{killer.name}</span>
                    <span className="blast-killfeed__weapon">
                      <WeaponSilhouette weapon={e.weapon === 'knife' ? 'knife' : e.weapon ?? 'rifle'} />
                    </span>
                    {e.headshot && (
                      <span className="blast-killfeed__hs" title="Headshot">
                        <svg viewBox="0 0 16 16" width="14" height="14" fill="#ef4444">
                          <circle cx="8" cy="8" r="6" stroke="#ef4444" strokeWidth="1.5" fill="none" />
                          <line x1="8" y1="0" x2="8" y2="4" stroke="#ef4444" strokeWidth="1.5" />
                          <line x1="8" y1="12" x2="8" y2="16" stroke="#ef4444" strokeWidth="1.5" />
                          <line x1="0" y1="8" x2="4" y2="8" stroke="#ef4444" strokeWidth="1.5" />
                          <line x1="12" y1="8" x2="16" y2="8" stroke="#ef4444" strokeWidth="1.5" />
                          <circle cx="8" cy="8" r="1.5" fill="#ef4444" />
                        </svg>
                      </span>
                    )}
                    <span className={`blast-killfeed__name blast-killfeed__name--${victim.team}`}>{victim.name}</span>
                  </div>
                );
              }
            }
            return (
              <div key={e.id} className={`blast-killfeed__event blast-killfeed__event--${e.team ?? 'neutral'}`}>
                {e.text}
              </div>
            );
          })}
        </div>

        {/* In-Eye Crosshair & Flashbang Blind */}
        {scopeKind && <div className={`live-fps__scope live-fps__scope--${scopeKind}`} aria-label={`${LIVE_WEAPONS[scopeKind].name} scope`}>
          <span className="live-fps__scope-lens"><span className="live-fps__scope-reticle" /></span>
        </div>}
        {effectiveCamera === 'first' && !scopeKind && <div className="live-fps__crosshair" aria-hidden="true" />}
        {observed.blinded > .2 && effectiveCamera === 'first' && (
          <div className="live-fps__flash" style={{ opacity: Math.min(.85, observed.blinded / 3) }} aria-hidden="true" />
        )}

        {/* BLAST Premier Bottom 10-Player Dock */}
        <div className="blast-bottom-dock">
          {/* Left 5: Blue Team */}
          <div className="blast-roster-group blast-roster-group--blue">
            {frame.players.filter(p => p.team === 'blue').map(p => (
              <BlastPlayerCard key={p.id} p={p} followed={followed} onSelect={observe} />
            ))}
          </div>

          {/* Center: Spectator Cam & Active Player Detail */}
          {observed && (
            <BlastCenterFocusCard
              observed={observed}
              mode={mode}
              onSelectCamera={setMode}
              isBlueDefending={isBlueDefending}
              isRedDefending={isRedDefending}
            />
          )}

          {/* Right 5: Red Team */}
          <div className="blast-roster-group blast-roster-group--red">
            {frame.players.filter(p => p.team === 'red').map(p => (
              <BlastPlayerCard key={p.id} p={p} followed={followed} onSelect={observe} />
            ))}
          </div>
        </div>

        {/* In-Broadcast Bomb Plant Picture-in-Picture (strictly Bomb Plants only) */}
        {autoPipEnabled && plantPip.active && (
          <aside className={`blast-pip ${plantPipHudVisible ? '' : 'blast-pip--hud-hidden'}`} aria-label={`Bomb plant Picture-in-Picture at Site ${plantPip.site ?? 'A'}`}>
            {plantPipHudVisible && <header className="blast-pip__header">
              <div className="blast-pip__title-group">
                <span className={`blast-pip__dot ${plantPip.phase === 'planted' ? 'blast-pip__dot--armed' : ''}`} />
                <span className="blast-pip__badge">
                  {plantPip.phase === 'planted' ? `BOMB PLANTED · SITE ${plantPip.site ?? 'A'}` : `PLANTING C4 · SITE ${plantPip.site ?? 'A'}`}
                </span>
              </div>
              <div className="blast-pip__meta">
                {plantPip.planterName && <span className="blast-pip__planter">{plantPip.planterName}</span>}
                <span className="blast-pip__timer">
                  {plantPip.phase === 'planted'
                    ? 'ARMED'
                    : `${Math.min(plantPip.duration, plantPip.progress * plantPip.duration).toFixed(1)}s`}
                </span>
                <button type="button" className="blast-pip__hud-toggle" onClick={() => setPlantPipHudVisible(false)} aria-label="Hide bomb PIP HUD" title="Hide PIP HUD">Hide HUD</button>
                <button
                  type="button"
                  className="blast-pip__close"
                  onClick={() => setAutoPipEnabled(false)}
                  aria-label="Hide bomb plant PIP"
                  title="Hide Bomb Plant PIP"
                >
                  ×
                </button>
              </div>
            </header>}
            <div ref={pipViewportEl} className="blast-pip__viewport">
              {plantPipHudVisible ? <span className="blast-pip__cam-label">PLANT CAM · SITE {plantPip.site ?? 'A'}</span> : <button type="button" className="blast-pip__hud-reveal" onClick={() => setPlantPipHudVisible(true)} aria-label="Show bomb PIP HUD">Show HUD</button>}
            </div>
            {plantPipHudVisible && <footer className="blast-pip__footer">
              <div className="blast-pip__progress-track">
                <div
                  className={`blast-pip__progress-fill ${plantPip.phase === 'planted' ? 'blast-pip__progress-fill--armed' : ''}`}
                  style={{ width: `${Math.round(plantPip.progress * 100)}%` }}
                />
              </div>
            </footer>}
          </aside>
        )}

        {/* Round End Tournament Banner */}
        {roundOver && (
          <div className="blast-round-banner">
            <small>{frame.phase === 'finished' ? 'MATCH COMPLETE' : 'ROUND WON'}</small>
            <h2>{frame.roundWinner === 'blue' ? 'Blue Five' : 'Red Five'} Win</h2>
            <p>{frame.roundReason}</p>
            {frame.phase === 'finished' && <button type="button" onClick={onExit}>Back to match setup</button>}
          </div>
        )}

        {/* Loading / Error Display */}
        {(!ready || error) && (
          <div className="live-fps__loading" role={error ? 'alert' : 'status'}>
            <h2>{error ? 'Broadcast unavailable' : 'Opening the 3D broadcast'}</h2>
            <p>{error || 'Preparing Breakwater Yard…'}</p>
            {error && <button type="button" onClick={() => setAttempt(v => v + 1)}>Restart exhibition</button>}
          </div>
        )}
            </div>
          </div>
        </div>
      </div>

      {/* Offscreen video stream carrier for fallback browser Picture-in-Picture */}
      <video
        ref={pipVideo}
        muted
        playsInline
        aria-hidden="true"
        className="live-fps__pip-video"
      />

      {/* Information Calls Bar */}
      <div className="live-fps__calls" aria-label="Team information and calls">
        {(['blue', 'red'] as const).map(team => (
          <div key={team}>
            <b className={`live-fps__${team}`}>{team === 'blue' ? 'BLUE' : 'RED'} CALL</b>
            <span>{frame.teams[team].information}</span>
          </div>
        ))}
      </div>

      {/* Deep Match Impact Summary Table */}
      <details className="live-fps__impact">
        <summary>Player impact beyond kills</summary>
        <p>Measured actions from this exhibition. Compare players in their assigned roles and round context; these figures are not an overall player rating.</p>
        <div className="live-fps__impact-scroll">
          <table>
            <thead>
              <tr>
                <th>Player / role</th>
                <th>Damage</th>
                <th>Headshots</th>
                <th>Opening wins / attempts</th>
                <th>Trades</th>
                <th>Deaths traded</th>
                <th>Flash assists</th>
                <th>First-shot hits</th>
                <th>Time to damage</th>
                <th>Unused utility on death</th>
                <th>Survival</th>
                <th>Plants / defuses</th>
              </tr>
            </thead>
            <tbody>
              {frame.players.map(p => {
                const m = p.impact;
                return (
                  <tr key={p.id}>
                    <th>
                      <span className={`live-fps__${p.team}`}>{p.name}</span>
                      <small>{p.role}</small>
                    </th>
                    <td>{Math.round(m.damage)}</td>
                    <td><b>{m.headshots}</b> <small>({liveImpactRate(m.headshots, m.hits)} HS)</small></td>
                    <td>{m.openingKills} / {m.openingAttempts}</td>
                    <td>{m.tradeKills}</td>
                    <td>{liveImpactRate(m.tradedDeaths, p.deaths)} <small>({m.tradedDeaths}/{p.deaths})</small></td>
                    <td>{m.flashAssists}</td>
                    <td>{liveImpactRate(m.firstShotHits, m.firstShots)} <small>({m.firstShotHits}/{m.firstShots})</small></td>
                    <td>{m.timeToDamageSamples ? `${Math.round(m.timeToDamageMs / m.timeToDamageSamples)} ms` : '—'}<small>{m.timeToDamageSamples} samples</small></td>
                    <td>{m.unusedUtilityOnDeath}</td>
                    <td>{liveImpactRate(m.roundsSurvived, m.roundsCompleted)}<small>{m.roundsCompleted} completed rounds</small></td>
                    <td>{m.plants} / {m.defuses}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p>Opening attempts count players firing before the first elimination. Headshots show total direct headshot impacts and headshot-to-hit ratio. First-shot samples start on target acquisition; damage time starts at detection. Trades use a 1.5-second window. Flash assists require an ally's active blind. Utility counts cover flashes, smokes, fire and HE grenades. Survival uses completed rounds.</p>
      </details>

      <footer className="live-fps__footer">
        <span>BLAST Premier Broadcast HUD · Breakwater Yard Tactical Simulation</span>
        <span>Click any player card to observe · Space: pause · C: camera · P: plant PIP · 1–0: players</span>
      </footer>
      {notice && <p className="live-fps__notice" role="status">{notice}</p>}
    </section>
  );
}
