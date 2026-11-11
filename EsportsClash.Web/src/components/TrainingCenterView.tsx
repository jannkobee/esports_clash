// src/components/TrainingCenterView.tsx
// Hattrick-Style Team Training System + Coach Attributes (1–10) + Real Match Training Impact
// Pick what the team works on, see Coach Attribute training speed multipliers, and track real match participation.

import React, { useState } from 'react';
import type { CoachCard, PlayerCard, TrainingFocus, TrainingRegimen } from '../types';
import { ChibiAvatar } from './ChibiAvatar';
import { sound } from '../audio';
import { INITIAL_COACHES } from '../mockData';
import {
  toScale10,
  getHattrickDescriptor,
  canBecomeCoach,
  convertPlayerToCoach,
  getCoachAttributes,
  getCoachFocusBoost
} from '../marketBatchEngine';
import {
  Zap,
  Sliders,
  GraduationCap,
  CheckCircle2,
  AlertCircle,
  Swords,
  Users,
  Shield,
  Brain,
  Crown,
  Flame,
  Battery,
  RefreshCw
} from 'lucide-react';

interface TrainingCenterViewProps {
  roster: PlayerCard[];
  startingFive: PlayerCard[];
  currentCoach?: CoachCard;
  regimen?: TrainingRegimen;
  onUpdateRegimen?: (regimen: TrainingRegimen) => void;
  onAppointCoach: (newCoach: CoachCard, retiredPlayerId?: string) => void;
  onLaunchRealMatch?: () => void;
}

export const TrainingCenterView: React.FC<TrainingCenterViewProps> = ({
  roster,
  startingFive,
  currentCoach,
  regimen: externalRegimen,
  onUpdateRegimen,
  onAppointCoach,
  onLaunchRealMatch
}) => {
  const [internalRegimen, setInternalRegimen] = useState<TrainingRegimen>({
    primaryFocus: 'lan',
    intensityPercent: 95,
    staminaSharePercent: 15
  });

  const regimen = externalRegimen || internalRegimen;
  const updateRegimen = (updater: (prev: TrainingRegimen) => TrainingRegimen) => {
    const next = updater(regimen);
    setInternalRegimen(next);
    onUpdateRegimen?.(next);
  };

  const [notification, setNotification] = useState<string | null>(null);

  const coachAttrs = getCoachAttributes(currentCoach);
  const activeFocusBoost = getCoachFocusBoost(currentCoach, regimen.primaryFocus);

  const FOCUS_OPTIONS: {
    id: TrainingFocus;
    label: string;
    desc: string;
    icon: typeof Swords;
    coachStatLabel: string;
    coachStatVal: number;
  }[] = [
    {
      id: 'lan',
      label: 'Aim & Weapon Mechanics',
      desc: 'Trains opening-duel mechanics and precision with FPS weapons.',
      icon: Swords,
      coachStatLabel: 'Mechanical Coaching',
      coachStatVal: coachAttrs.mechanical
    },
    {
      id: 'tf',
      label: 'Trading & Team Coordination',
      desc: 'Drills spacing, trade follow-up and coordinated site takes.',
      icon: Shield,
      coachStatLabel: 'Mechanical Coaching',
      coachStatVal: coachAttrs.mechanical
    },
    {
      id: 'iq',
      label: 'Macro & Game Sense (IQ)',
      desc: 'Develops tactical reading and prepares future 7+/10 IQ coaches.',
      icon: Brain,
      coachStatLabel: 'Tactical Coaching',
      coachStatVal: coachAttrs.tactical
    },
    {
      id: 'ldr',
      label: 'Leadership & Shotcalling (LDR)',
      desc: 'Builds vocal captaincy, morale resilience, and future Head Coach eligibility.',
      icon: Crown,
      coachStatLabel: 'Tactical Coaching',
      coachStatVal: coachAttrs.tactical
    },
    {
      id: 'clu',
      label: 'Clutch & High-Stakes Nerves',
      desc: 'Develops decision-making under pressure in decisive rounds.',
      icon: Flame,
      coachStatLabel: 'Stage Motivation',
      coachStatVal: coachAttrs.motivation
    },
    {
      id: 'sta',
      label: 'Conditioning & Stamina',
      desc: 'Prevents late-series fatigue drop-off during grueling Best-of-5 schedules.',
      icon: Battery,
      coachStatLabel: 'Conditioning',
      coachStatVal: coachAttrs.conditioning
    },
    {
      id: 'flx',
      label: 'Weapon & Role Flexibility',
      desc: 'Develops adaptability across equipment and tactical assignments.',
      icon: RefreshCw,
      coachStatLabel: 'Conditioning',
      coachStatVal: coachAttrs.conditioning
    }
  ];

  // Eligible players for Coach conversion
  const coachEligiblePlayers = roster.filter((p) => canBecomeCoach(p).eligible);

  // Convert Player to Coach
  const handleConvertPlayer = (player: PlayerCard) => {
    const check = canBecomeCoach(player);
    if (!check.eligible) {
      alert(`Cannot convert ${player.name}: ${check.reason}`);
      return;
    }

    if (
      window.confirm(
        `Convert veteran ${player.name} (${player.age}yo) into Club Head Coach? They will retire from the active roster and lead your training center.`
      )
    ) {
      sound.playWalkoutFanfare();
      const newCoach = convertPlayerToCoach(player);
      onAppointCoach(newCoach, player.id);
      setNotification(
        `${newCoach.name} appointed as practice coach (${newCoach.rating10}/10).`
      );
      setTimeout(() => setNotification(null), 6000);
    }
  };

  const startersWithRealMatchCount = startingFive.filter((p) => (p.matchesPlayedThisWeek ?? 0) >= 1).length;

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="cm-panel">
        <div className="cm-panel-header">
          <span className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-emerald-400" />
            <span>Practice training planner</span>
          </span>
          <div className="cm-inline-facts">
            <span>
              Coach Speed Boost: +{activeFocusBoost.speedBonusPercent}%
            </span>
            <span>
              Active Focus: {FOCUS_OPTIONS.find((f) => f.id === regimen.primaryFocus)?.label}
            </span>
            <span>
              Match-Active Starters: {startersWithRealMatchCount}/5
            </span>
          </div>
        </div>

        <div className="cm-panel-body flex flex-wrap justify-between items-center gap-4">
          <div>
            <h2 className="text-base font-black text-slate-100">
              Plan what your squad works on
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Preview practice programs and coach bonuses here. Official club training XP comes from verified scheduled matches and is posted on the weekly cycle. This planner does not change your official players.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onLaunchRealMatch && (
              <button
                type="button"
                onClick={onLaunchRealMatch}
                className="cm-btn py-2 px-3.5 text-xs"
                title="Open your scheduled match calendar"
              >
                <Swords className="w-3.5 h-3.5 text-sky-400" />
                <span>Open fixture calendar</span>
              </button>
            )}

          </div>
        </div>
      </div>

      {notification && (
        <div className="bg-emerald-500/15 border border-emerald-500/40 rounded-xl p-3 text-xs font-bold text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{notification}</span>
        </div>
      )}

      {/* HEAD COACH ATTRIBUTES & SPECIALIST STAFF PANEL */}
      <div className="cm-panel">
        <div className="cm-panel-header">
          <span className="flex items-center gap-2">
            <Users className="w-4 h-4 text-amber-400" />
            <span>Head Coach Attributes &amp; Training Speed Multipliers (1–10 Scale)</span>
          </span>
          <span className="cm-badge cm-badge-gold">
            {currentCoach?.name || 'Club Head Coach'} · +{activeFocusBoost.speedBonusPercent}% Speed on{' '}
            {regimen.primaryFocus.toUpperCase()}
          </span>
        </div>

        <div className="cm-panel-body grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
          {/* Active Coach Card */}
          <div className="lg:col-span-4 bg-[#0f172a] border border-white/10 rounded-xl p-3.5 flex items-center gap-3.5">
            <div className="shrink-0">
              <ChibiAvatar avatarType={currentCoach?.avatarSvg || currentCoach?.name || 'Coach'} size={64} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1">
                <span className="text-sm font-black text-white truncate">
                  {currentCoach?.name || 'Head Coach'}
                </span>
                <span className="cm-badge cm-badge-gold">{currentCoach?.tier || 'Diamond'}</span>
              </div>
              <div className="text-xs font-bold text-emerald-400 mt-0.5">
                Style: {currentCoach?.style || 'Objective Macro'}
              </div>
              <p className="text-[11px] text-slate-400 italic mt-1 line-clamp-2">
                &ldquo;{currentCoach?.quote || 'Precision drills and live stage games forge world champions.'}&rdquo;
              </p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                <span className="cm-badge cm-badge-blue text-[10px]">
                  +{activeFocusBoost.speedBonusPercent}% {activeFocusBoost.primaryAttrLabel}
                </span>
                <span className="cm-badge cm-badge-green text-[10px]">
                  +{activeFocusBoost.youthBonusPercent}% Youth Speed
                </span>
              </div>
            </div>
          </div>

          {/* 5 Coach Attributes (1-10 Scale) */}
          <div className="lg:col-span-5 grid grid-cols-2 sm:grid-cols-5 gap-2">
            {[
              {
                label: 'Tactical',
                sub: 'IQ & LDR Speed',
                val: coachAttrs.tactical,
                active: regimen.primaryFocus === 'iq' || regimen.primaryFocus === 'ldr'
              },
              {
                label: 'Mechanical',
                sub: 'LAN & TF Speed',
                val: coachAttrs.mechanical,
                active: regimen.primaryFocus === 'lan' || regimen.primaryFocus === 'tf'
              },
              {
                label: 'Conditioning',
                sub: 'STA & FLX Speed',
                val: coachAttrs.conditioning,
                active: regimen.primaryFocus === 'sta' || regimen.primaryFocus === 'flx'
              },
              {
                label: 'Youth Dev',
                sub: '16–18yo Growth',
                val: coachAttrs.youthDevelopment,
                active: true
              },
              {
                label: 'Motivation',
                sub: 'CLU & All Drills',
                val: coachAttrs.motivation,
                active: regimen.primaryFocus === 'clu'
              }
            ].map((attr) => (
              <div
                key={attr.label}
                className={`p-2.5 rounded-xl border text-center transition ${
                  attr.active
                    ? 'bg-emerald-500/15 border-emerald-500/50 shadow-sm'
                    : 'bg-[#0f172a] border-white/10'
                }`}
              >
                <div className="text-[10px] font-bold uppercase text-slate-300">{attr.label}</div>
                <div className="text-lg font-black font-mono text-emerald-400 my-0.5">{attr.val}/10</div>
                <div className="text-[9px] text-slate-400">{attr.sub}</div>
                <div className="text-[10px] font-mono font-bold text-amber-300 mt-1">+{attr.val * 6}%</div>
              </div>
            ))}
          </div>

          {/* Switch Specialist Coach */}
          <div className="lg:col-span-3 bg-[#0f172a] border border-white/10 rounded-xl p-3 space-y-2 text-xs">
            <div className="font-bold text-slate-200 flex items-center justify-between">
              <span>Coaching Staff Selection</span>
              <span className="text-[10px] text-slate-400">{INITIAL_COACHES.length} Licensed</span>
            </div>
            <select
              value={currentCoach?.id || ''}
              onChange={(e) => {
                const found = INITIAL_COACHES.find((c) => c.id === e.target.value);
                if (found) {
                  sound.playClick();
                  onAppointCoach(found);
                  setNotification(`Appointed ${found.name} (${found.style}) as active Head Coach.`);
                  setTimeout(() => setNotification(null), 4000);
                }
              }}
              className="cm-select w-full"
            >
              {INITIAL_COACHES.map((c) => {
                const ca = getCoachAttributes(c);
                return (
                  <option key={c.id} value={c.id}>
                    {c.name} (TAC {ca.tactical} · MECH {ca.mechanical} · MOT {ca.motivation})
                  </option>
                );
              })}
            </select>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              Match your Head Coach&apos;s highest 1–10 attribute to your weekly training focus for maximum speed.
            </p>
          </div>
        </div>
      </div>

      {/* Regimen Selector & Sliders */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: 7 Hattrick Team Training Focus Options */}
        <div className="cm-panel lg:col-span-2">
          <div className="cm-panel-header">
            <span>What Should the Team Work On This Week? (7 Training Programs)</span>
            <span className="text-[11px] font-normal text-slate-400">Click any program to set team focus</span>
          </div>
          <div className="cm-panel-body grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {FOCUS_OPTIONS.map((opt) => {
              const isSelected = regimen.primaryFocus === opt.id;
              const optBoost = getCoachFocusBoost(currentCoach, opt.id);
              return (
                <button
                  type="button"
                  key={opt.id}
                  onClick={() => {
                    sound.playClick();
                    updateRegimen((r) => ({ ...r, primaryFocus: opt.id }));
                  }}
                  className={`p-3 text-left border transition rounded-xl flex flex-col justify-between ${
                    isSelected
                      ? 'bg-emerald-500/15 border-2 border-emerald-500 shadow-md'
                      : 'bg-[#0f172a] border-white/10 hover:border-white/25'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-bold text-xs text-white flex items-center gap-1.5">
                        <opt.icon className="w-4 h-4 shrink-0 text-slate-400" aria-hidden="true" />
                        <span>{opt.label}</span>
                      </span>
                      {isSelected ? (
                        <span className="text-emerald-300 text-[10px]">Selected</span>
                      ) : (
                        <span className="text-slate-400 text-[10px]">+{optBoost.speedBonusPercent}%</span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">{opt.desc}</p>
                  </div>
                  <div className="mt-2 pt-1.5 border-t border-white/10 flex items-center justify-between text-[10px]">
                    <span className="text-slate-400">
                      Coach {opt.coachStatLabel}: <strong className="text-white">{opt.coachStatVal}/10</strong>
                    </span>
                    <span className="font-mono font-bold text-emerald-400">
                      +{optBoost.speedBonusPercent}% Coach Speed
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Intensity, Stamina & Real-Match Rules */}
        <div className="cm-panel flex flex-col justify-between">
          <div className="cm-panel-header">
            <span className="flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-emerald-400" />
              <span>Intensity &amp; Real-Match Impact</span>
            </span>
          </div>
          <div className="cm-panel-body space-y-4 text-xs">
            <div>
              <div className="flex justify-between items-center mb-1 font-bold">
                <span className="text-slate-200">Training Intensity:</span>
                <span className="font-mono text-emerald-400">{regimen.intensityPercent}%</span>
              </div>
              <input
                type="range"
                min={50}
                max={100}
                step={5}
                value={regimen.intensityPercent}
                onChange={(e) => updateRegimen((r) => ({ ...r, intensityPercent: Number(e.target.value) }))}
                className="w-full cursor-pointer accent-emerald-500"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Higher intensity accelerates weekly stat gains across all drills.
              </span>
            </div>

            <div className="pt-2 border-t border-white/10">
              <div className="flex justify-between items-center mb-1 font-bold">
                <span className="text-slate-200">Stamina Conditioning Share:</span>
                <span className="font-mono text-sky-400">{regimen.staminaSharePercent}%</span>
              </div>
              <input
                type="range"
                min={10}
                max={30}
                step={5}
                value={regimen.staminaSharePercent}
                onChange={(e) => updateRegimen((r) => ({ ...r, staminaSharePercent: Number(e.target.value) }))}
                className="w-full cursor-pointer accent-sky-500"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Maintains player stamina and prevents late-game collapse.
              </span>
            </div>

            <div className="p-3 bg-[#0f172a] border border-white/10 rounded-xl text-[11px] space-y-1.5">
              <strong className="block text-white">How Real Games Affect Training:</strong>
              <div className="text-slate-300">
                • <strong className="text-emerald-400">2+ Real Games Played:</strong> 135% Max Match Speed
              </div>
              <div className="text-slate-300">
                • <strong className="text-emerald-300">1 Real Game Played:</strong> 115% Full Match Speed
              </div>
              <div className="text-slate-300">
                • <strong className="text-amber-400">0 Games (Starter Drill):</strong> 55% Scrimmage Speed
              </div>
              <div className="text-slate-300">
                • <strong className="text-slate-400">0 Games (Bench Reserve):</strong> 25% Passive Speed
              </div>
              <div className="text-slate-300 pt-1 border-t border-white/10">
                • <strong className="text-purple-400">Coach Boost:</strong> +{activeFocusBoost.speedBonusPercent}% Speed
                from {currentCoach?.name || 'Coach'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Squad Training Progression Table */}
      <div className="cm-panel">
        <div className="cm-panel-header">
          <span>
            Squad Training Table · Working on {regimen.primaryFocus.toUpperCase()} (+
            {activeFocusBoost.speedBonusPercent}% Coach Speed)
          </span>
          <span className="text-[11px] font-normal text-slate-400">{roster.length} Athletes in Club</span>
        </div>
        <div className="cm-panel-body p-0">
          <div className="cm-table-wrap border-0">
            <table className="cm-table">
              <thead>
                <tr>
                  <th>Athlete</th>
                  <th>Age</th>
                  <th>Role</th>
                  <th>Modeled participation</th>
                  <th>Target ({regimen.primaryFocus.toUpperCase()})</th>
                  <th>Progress to Next Level</th>
                  <th>Effective Speed</th>
                </tr>
              </thead>
              <tbody>
                {roster.map((player) => {
                  const isStarter = startingFive.some((s) => s.id === player.id);
                  const statVal = player.stats[regimen.primaryFocus] ?? 50;
                  const stat10 = toScale10(statVal);
                  const progress = player.trainingProgress?.[regimen.primaryFocus] ?? 0;
                  const age = player.age ?? 21;
                  const matchesPlayed = player.matchesPlayedThisWeek ?? (isStarter ? 1 : 0);

                  const matchEff =
                    matchesPlayed >= 2 ? 135 : matchesPlayed === 1 ? 115 : isStarter ? 55 : 25;
                  const totalSpeedPct = Math.round(
                    matchEff * (1 + activeFocusBoost.speedBonusPercent / 100) * (age <= 18 ? 1.45 : 1.0)
                  );

                  return (
                    <tr key={player.id} className={isStarter ? 'cm-row-highlight' : ''}>
                      <td>
                        <div className="flex items-center gap-2">
                          <ChibiAvatar avatarType={player.avatarSvg || player.name} size={28} />
                          <div>
                            <div className="font-bold text-white">{player.name}</div>
                            <div className="text-[10px] text-slate-400">
                              {isStarter ? 'Starting V' : 'Reserve'} · {toScale10(player.ovr)}/10 OVR
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="font-mono">{age}yo</td>
                      <td>{player.preferredRole || player.role}</td>
                      <td>
                        {matchesPlayed >= 1 ? (
                          <span className="text-emerald-300 text-xs">
                            {matchesPlayed} {matchesPlayed === 1 ? 'Game' : 'Games'} ({matchEff}%)
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">0 games ({matchEff}% drill)</span>
                        )}
                      </td>
                      <td className="font-mono font-bold text-emerald-400">
                        {stat10}/10 ({getHattrickDescriptor(stat10)})
                      </td>
                      <td className="w-52">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2.5 bg-slate-800 rounded-full overflow-hidden border border-white/10">
                            <div
                              className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all"
                              style={{ width: `${Math.min(100, progress)}%` }}
                            />
                          </div>
                          <span className="font-mono text-[11px] font-bold w-10 text-right">{progress}%</span>
                        </div>
                        {player.lastMatchTrainingGain ? (
                          <div className="text-[10px] text-emerald-400 font-mono mt-0.5">
                            Last gain: +{player.lastMatchTrainingGain}%
                          </div>
                        ) : null}
                      </td>
                      <td className="font-mono text-xs font-bold text-amber-300">
                        {totalSpeedPct}% Speed
                        {age <= 18 && <span className="block text-[10px] text-purple-400">Youth prospect</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Veteran Player → Coach Conversion Academy */}
      <div className="cm-panel">
        <div className="cm-panel-header">
          <span className="flex items-center gap-1.5">
            <GraduationCap className="w-4 h-4 text-emerald-400" />
            <span>Coaching License Academy · Convert Veteran Players (Age ≥ 23, IQ ≥ 7, LDR ≥ 6)</span>
          </span>
          <span className="cm-badge cm-badge-gold">{coachEligiblePlayers.length} Eligible Veterans</span>
        </div>

        <div className="cm-panel-body space-y-3 text-xs">
          <p className="text-slate-300 leading-relaxed">
            Veterans aged <strong>23+</strong> with <strong>IQ ≥ 7/10</strong> and <strong>Leadership ≥ 6/10</strong>{' '}
            can retire from active play to become your club&apos;s <strong>Head Coach</strong>, converting their playing
            stats directly into 1–10 Coaching Attributes!
          </p>

          {coachEligiblePlayers.length === 0 ? (
            <div className="bg-[#0f172a] border border-white/10 rounded-xl p-4 text-center text-slate-400 space-y-1">
              <AlertCircle className="w-5 h-5 mx-auto text-amber-400" />
              <p className="font-bold text-slate-200">No active players currently qualify for Coach Conversion.</p>
              <p className="text-[11px]">
                Train your veterans in <strong>IQ</strong> and <strong>Leadership</strong> to unlock their coaching
                license!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {coachEligiblePlayers.map((player) => {
                const iq10 = toScale10(player.stats.iq);
                const ldr10 = toScale10(player.stats.ldr ?? 55);
                const lan10 = toScale10(player.stats.lan);
                const tf10 = toScale10(player.stats.tf);
                const projectedRating = Math.round(0.55 * iq10 + 0.45 * ldr10);
                const projectedMech = Math.round((lan10 + tf10) / 2);

                return (
                  <div
                    key={player.id}
                    className="bg-[#0f172a] border-2 border-emerald-500/50 p-3.5 rounded-xl space-y-2 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <div className="flex items-center gap-2">
                          <ChibiAvatar avatarType={player.avatarSvg || player.name} size={36} />
                          <div>
                            <strong className="text-sm text-white block">{player.name}</strong>
                            <span className="text-[11px] text-slate-400">
                              Age {player.age}yo · {player.preferredRole || player.role}
                            </span>
                          </div>
                        </div>
                        <span className="cm-badge cm-badge-green font-bold">Coach License Ready</span>
                      </div>

                      <div className="bg-slate-900/90 border border-white/10 rounded-lg p-2.5 my-2 space-y-1 text-[11px]">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Projected Tactical Coaching (from IQ):</span>
                          <strong className="font-mono text-emerald-400">{iq10}/10 (+{iq10 * 6}% Speed)</strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Projected Mechanical Coaching (from LAN/TF):</span>
                          <strong className="font-mono text-sky-400">
                            {projectedMech}/10 (+{projectedMech * 6}% Speed)
                          </strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Projected Motivation &amp; Youth Dev (from LDR):</span>
                          <strong className="font-mono text-amber-400">{ldr10}/10</strong>
                        </div>
                        <div className="flex justify-between pt-1 border-t border-white/10">
                          <span className="text-slate-300 font-bold">Overall Coach License Rating:</span>
                          <strong className="font-mono text-sm text-white">{projectedRating}/10</strong>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleConvertPlayer(player)}
                      className="cm-btn cm-btn-primary w-full py-2 text-xs"
                    >
                      <GraduationCap className="w-4 h-4" />
                      <span>Appoint {player.name} as Head Coach ▸</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
