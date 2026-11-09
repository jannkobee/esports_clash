import React, { useEffect, useState, useRef } from 'react';
import type { PlayerCard, ChampionKit, CoachCard } from '../types';
import { ChampionArtwork } from './ChampionArtwork';

interface MatchLoadingScreenProps {
  blueLineup: { player: PlayerCard; champion: ChampionKit }[];
  redLineup: { player: PlayerCard; champion: ChampionKit }[];
  blueCoach?: CoachCard;
  redCoach?: CoachCard;
  blueTeamName?: string;
  redTeamName?: string;
  seed: number;
  viewerReady: boolean;
  onComplete: () => void;
}

const TIPS = [
  'Structure Order: Outer Turret ➔ Inner Turret ➔ Nexus Turret ➔ All 3 Barracks ➔ Nexus.',
  'Dragon Embermaw spawns in the south caldera, empowering attacks with burning dragonfire.',
  'Siege Golem Gravemarch charges down the valley chasm, battering enemy structures.',
  'Turret Execution: Intruders executed by turrets award zero champion gold if undamaged for 10s.',
  'High-IQ champions coordinate minion wave crashes before committing to tower dives.',
  'The Sunken Rocky Canyon provides high-ground advantage for defense along the causeway.',
  'Destroying all three enemy barracks unleashes relentless Super Minions in the valley.',
];

export const MatchLoadingScreen: React.FC<MatchLoadingScreenProps> = ({
  blueLineup,
  redLineup,
  blueCoach,
  redCoach,
  blueTeamName = 'Blue Squad',
  redTeamName = 'Red Squad',
  seed,
  viewerReady,
  onComplete,
}) => {
  const [globalProgress, setGlobalProgress] = useState(10);
  const [cardProgress, setCardProgress] = useState<number[]>(() =>
    Array(10).fill(0).map(() => Math.floor(10 + Math.random() * 20))
  );
  const [tipIndex, setTipIndex] = useState(() => Math.floor(Math.random() * TIPS.length));
  const [isReadyToEnter, setIsReadyToEnter] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const completedRef = useRef(false);

  // Rotate tips
  useEffect(() => {
    const timer = setInterval(() => {
      setTipIndex(prev => (prev + 1) % TIPS.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  // Smooth loading progression tied to actual 3D viewer asset readiness
  useEffect(() => {
    const interval = setInterval(() => {
      setGlobalProgress(prev => {
        if (prev >= 100) return 100;
        // Hold at 88% until 3D assets/viewer are confirmed ready, then surge to 100%
        if (!viewerReady) {
          return Math.min(88, prev + Math.floor(Math.random() * 3) + 2);
        }
        return Math.min(100, prev + 15);
      });

      setCardProgress(prev =>
        prev.map(val => {
          if (val >= 100) return 100;
          if (!viewerReady) {
            return Math.min(90, val + Math.floor(Math.random() * 4) + 2);
          }
          return Math.min(100, val + Math.floor(Math.random() * 18) + 10);
        })
      );
    }, 100);

    return () => clearInterval(interval);
  }, [viewerReady]);

  // Completion trigger
  useEffect(() => {
    if (globalProgress >= 100 && viewerReady && !completedRef.current) {
      setIsReadyToEnter(true);
      const timer = setTimeout(() => {
        handleEnter();
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [globalProgress, viewerReady]);

  const handleEnter = () => {
    if (completedRef.current) return;
    completedRef.current = true;
    setIsFadingOut(true);
    setTimeout(() => {
      onComplete();
    }, 400);
  };

  const statusLabel =
    globalProgress < 30
      ? 'Synthesizing 3D Valley Terrain & Heightmaps...'
      : globalProgress < 60
      ? 'Generating Foliage & Shading Bridge Causeway...'
      : globalProgress < 90
      ? 'Calibrating AI Champions & Combat Systems...'
      : !viewerReady
      ? 'Finalizing Visual Pipeline...'
      : 'All Assets Synchronized! Entering Arena...';

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col justify-between overflow-hidden bg-slate-950 text-slate-100 select-none transition-opacity duration-400 ${
        isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{
        backgroundImage:
          'radial-gradient(circle at 50% 30%, rgba(15, 30, 55, 0.9) 0%, rgba(5, 10, 20, 0.98) 75%, #02050b 100%)',
      }}
    >
      {/* Top Header */}
      <header className="relative flex items-center justify-between px-6 py-4 border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-md z-10">
        {/* Blue Team Header */}
        <div className="flex items-center gap-4">
          <div className="w-3 h-10 bg-cyan-400 rounded-sm shadow-[0_0_12px_rgba(34,211,238,0.7)]" />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] tracking-widest uppercase font-bold text-cyan-400">BLUE SIDE</span>
              {blueCoach && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-800/60 text-cyan-200">
                  Coach: {blueCoach.name}
                </span>
              )}
            </div>
            <h1 className="text-xl md:text-2xl font-black tracking-wide text-cyan-100 uppercase">{blueTeamName}</h1>
          </div>
        </div>

        {/* Center Versus Badge */}
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-3">
            <div className="w-12 h-px bg-gradient-to-r from-transparent to-amber-400/60" />
            <div className="px-3 py-1 rounded-full border border-amber-400/50 bg-amber-950/40 shadow-[0_0_15px_rgba(251,191,36,0.3)]">
              <span className="font-black text-xs md:text-sm tracking-widest text-amber-300">VS</span>
            </div>
            <div className="w-12 h-px bg-gradient-to-l from-transparent to-amber-400/60" />
          </div>
          <span className="text-[9px] tracking-widest uppercase font-mono text-slate-400 mt-1">
            VALLEY OF CONVERGENCE · SEED #{seed}
          </span>
        </div>

        {/* Red Team Header */}
        <div className="flex items-center gap-4 text-right">
          <div>
            <div className="flex items-center justify-end gap-2">
              {redCoach && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-rose-950/80 border border-rose-800/60 text-rose-200">
                  Coach: {redCoach.name}
                </span>
              )}
              <span className="text-[10px] tracking-widest uppercase font-bold text-rose-400">RED SIDE</span>
            </div>
            <h1 className="text-xl md:text-2xl font-black tracking-wide text-rose-100 uppercase">{redTeamName}</h1>
          </div>
          <div className="w-3 h-10 bg-rose-500 rounded-sm shadow-[0_0_12px_rgba(244,63,94,0.7)]" />
        </div>
      </header>

      {/* Main Champion Cards Grid */}
      <main className="flex-1 flex items-center justify-center p-4 max-w-7xl mx-auto w-full overflow-hidden">
        <div className="grid grid-cols-10 gap-2 md:gap-3 w-full h-[62vh] max-h-[580px]">
          {/* Blue Lineup (5 Cards) */}
          {blueLineup.map((item, index) => {
            const progress = cardProgress[index];
            const isCardComplete = progress >= 100;
            return (
              <div
                key={item.player.id + '-' + index}
                className="group relative flex flex-col justify-between rounded-xl overflow-hidden border border-cyan-500/40 bg-gradient-to-b from-slate-900/90 to-cyan-950/60 shadow-lg transition-transform duration-300 hover:scale-[1.02] hover:border-cyan-400"
              >
                {/* Background Artwork */}
                <div className="absolute inset-0 z-0 overflow-hidden bg-slate-900 flex items-center justify-center p-3">
                  <ChampionArtwork championId={item.champion.id} size={140} />
                  {/* Subtle Gradient Overlays */}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
                  <div className="absolute inset-0 bg-gradient-to-b from-cyan-950/60 via-transparent to-transparent" />
                </div>

                {/* Card Top: OVR & Role */}
                <div className="relative z-10 flex items-center justify-between p-2">
                  <div className="flex items-center gap-1">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-cyan-900/90 border border-cyan-400/60 text-cyan-200 shadow">
                      {item.player.ovr ?? 85}
                    </span>
                    <span className="text-[8px] font-bold uppercase tracking-wider text-cyan-300 bg-slate-950/70 px-1 rounded">
                      {item.player.preferredRole ?? item.champion.primaryRole ?? 'FIGHTER'}
                    </span>
                  </div>
                  {/* Card Loading Indicator */}
                  <div
                    className={`text-[9px] font-mono px-1 rounded ${
                      isCardComplete
                        ? 'text-emerald-300 bg-emerald-950/80 border border-emerald-500/60'
                        : 'text-cyan-300 bg-slate-950/70'
                    }`}
                  >
                    {isCardComplete ? '✓ 100%' : `${progress}%`}
                  </div>
                </div>

                {/* Card Bottom: Identity & Spells */}
                <div className="relative z-10 p-2.5 flex flex-col gap-1 bg-gradient-to-t from-slate-950 via-slate-950/90 to-transparent pt-6">
                  <div className="truncate text-[11px] font-black tracking-wide text-cyan-300 drop-shadow">
                    {item.player.name}
                  </div>
                  <div className="truncate text-xs md:text-sm font-black text-white leading-tight">
                    {item.champion.displayName}
                  </div>
                  <div className="truncate text-[8px] tracking-wide text-slate-400">
                    {item.champion.title}
                  </div>

                  {/* Ability Pills */}
                  <div className="flex items-center gap-1 mt-1 pt-1 border-t border-slate-800/80">
                    <span className="w-4 h-4 rounded bg-slate-800/90 border border-cyan-500/40 flex items-center justify-center text-[8px] font-bold text-cyan-200">
                      Q
                    </span>
                    <span className="w-4 h-4 rounded bg-slate-800/90 border border-cyan-500/40 flex items-center justify-center text-[8px] font-bold text-cyan-200">
                      W
                    </span>
                    <span className="w-4 h-4 rounded bg-slate-800/90 border border-amber-500/50 flex items-center justify-center text-[8px] font-bold text-amber-300">
                      R
                    </span>
                  </div>

                  {/* Individual Progress Bar */}
                  <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden mt-1">
                    <div
                      className="h-full bg-cyan-400 transition-all duration-150"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}

          {/* Red Lineup (5 Cards) */}
          {redLineup.map((item, index) => {
            const progress = cardProgress[index + 5];
            const isCardComplete = progress >= 100;
            return (
              <div
                key={item.player.id + '-' + index}
                className="group relative flex flex-col justify-between rounded-xl overflow-hidden border border-rose-500/40 bg-gradient-to-b from-slate-900/90 to-rose-950/60 shadow-lg transition-transform duration-300 hover:scale-[1.02] hover:border-rose-400"
              >
                {/* Background Artwork */}
                <div className="absolute inset-0 z-0 overflow-hidden bg-slate-900 flex items-center justify-center p-3">
                  <ChampionArtwork championId={item.champion.id} size={140} />
                  {/* Subtle Gradient Overlays */}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
                  <div className="absolute inset-0 bg-gradient-to-b from-rose-950/60 via-transparent to-transparent" />
                </div>

                {/* Card Top: OVR & Role */}
                <div className="relative z-10 flex items-center justify-between p-2">
                  <div className="flex items-center gap-1">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-rose-900/90 border border-rose-400/60 text-rose-200 shadow">
                      {item.player.ovr ?? 85}
                    </span>
                    <span className="text-[8px] font-bold uppercase tracking-wider text-rose-300 bg-slate-950/70 px-1 rounded">
                      {item.player.preferredRole ?? item.champion.primaryRole ?? 'FIGHTER'}
                    </span>
                  </div>
                  {/* Card Loading Indicator */}
                  <div
                    className={`text-[9px] font-mono px-1 rounded ${
                      isCardComplete
                        ? 'text-emerald-300 bg-emerald-950/80 border border-emerald-500/60'
                        : 'text-rose-300 bg-slate-950/70'
                    }`}
                  >
                    {isCardComplete ? '✓ 100%' : `${progress}%`}
                  </div>
                </div>

                {/* Card Bottom: Identity & Spells */}
                <div className="relative z-10 p-2.5 flex flex-col gap-1 bg-gradient-to-t from-slate-950 via-slate-950/90 to-transparent pt-6">
                  <div className="truncate text-[11px] font-black tracking-wide text-rose-300 drop-shadow">
                    {item.player.name}
                  </div>
                  <div className="truncate text-xs md:text-sm font-black text-white leading-tight">
                    {item.champion.displayName}
                  </div>
                  <div className="truncate text-[8px] tracking-wide text-slate-400">
                    {item.champion.title}
                  </div>

                  {/* Ability Pills */}
                  <div className="flex items-center gap-1 mt-1 pt-1 border-t border-slate-800/80">
                    <span className="w-4 h-4 rounded bg-slate-800/90 border border-rose-500/40 flex items-center justify-center text-[8px] font-bold text-rose-200">
                      Q
                    </span>
                    <span className="w-4 h-4 rounded bg-slate-800/90 border border-rose-500/40 flex items-center justify-center text-[8px] font-bold text-rose-200">
                      W
                    </span>
                    <span className="w-4 h-4 rounded bg-slate-800/90 border border-amber-500/50 flex items-center justify-center text-[8px] font-bold text-amber-300">
                      R
                    </span>
                  </div>

                  {/* Individual Progress Bar */}
                  <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden mt-1">
                    <div
                      className="h-full bg-rose-500 transition-all duration-150"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Bottom Footer & Progress Bar */}
      <footer className="relative px-6 py-5 border-t border-slate-800/80 bg-slate-950/80 backdrop-blur-md z-10">
        <div className="max-w-4xl mx-auto flex flex-col gap-3">
          {/* Status Label & Percentage */}
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-slate-300 flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              {statusLabel}
            </span>
            <span className="font-mono font-bold text-amber-300">{globalProgress}%</span>
          </div>

          {/* Master Progress Bar */}
          <div className="relative w-full h-2.5 bg-slate-900 border border-slate-700/80 rounded-full overflow-hidden shadow-inner">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 via-amber-400 to-rose-500 transition-all duration-150 rounded-full shadow-[0_0_12px_rgba(251,191,36,0.5)]"
              style={{ width: `${globalProgress}%` }}
            />
          </div>

          {/* Rotating Tip & Skip Button */}
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <div className="flex items-center gap-2 truncate">
              <span className="px-1.5 py-0.5 rounded bg-amber-950/80 border border-amber-600/50 text-amber-300 font-bold uppercase tracking-wider text-[9px]">
                ARENA TIP
              </span>
              <span className="truncate italic text-slate-300">{TIPS[tipIndex]}</span>
            </div>

            <button
              onClick={handleEnter}
              className={`shrink-0 ml-4 px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition shadow-lg ${
                isReadyToEnter
                  ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 hover:brightness-110 shadow-emerald-500/25 animate-pulse'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
              }`}
            >
              {isReadyToEnter ? 'ENTER ARENA ▶' : 'START NOW ⏭'}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};

