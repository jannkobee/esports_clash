import React, { useState, useEffect, useMemo } from 'react';
import type { PlayerCard, CoachCard, AvatarRole, GameOrigin } from '../types';
import { ChibiAvatar } from './ChibiAvatar';
import { sound } from '../audio';
import { 
  TEAM_SLOTS, 
  PLAYER_DRAFT_TURNS, 
  chooseEqualizedPlayerPick 
} from '../equalizedMode';
import { 
  Zap, 
  Shield, 
  Sparkles, 
  Search, 
  Dices, 
  ArrowRight, 
  UserCheck, 
  Swords, 
  CheckCircle2, 
  ArrowLeftRight 
} from 'lucide-react';

interface Props {
  pool: PlayerCard[];
  userCoach: CoachCard;
  opponentCoach: CoachCard;
  draftSeed: number;
  onDraftComplete: (blueRoster: PlayerCard[], redRoster: PlayerCard[]) => void;
  onCancel: () => void;
}

export const PlayerDraftPhaseView: React.FC<Props> = ({
  pool,
  userCoach,
  opponentCoach,
  draftSeed,
  onDraftComplete,
  onCancel
}) => {
  const [turnIndex, setTurnIndex] = useState(0);
  const [blueSlots, setBlueSlots] = useState<(PlayerCard | null)[]>([null, null, null, null, null]);
  const [redSlots, setRedSlots] = useState<(PlayerCard | null)[]>([null, null, null, null, null]);
  const [targetSlot, setTargetSlot] = useState<number | null>(null);
  const [selectedCard, setSelectedCard] = useState<PlayerCard | null>(() => pool[0] ?? null);
  const [roleFilter, setRoleFilter] = useState<AvatarRole | 'All'>('All');
  const [originFilter, setOriginFilter] = useState<GameOrigin | 'All'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [aiThinking, setAiThinking] = useState(false);
  const [swappingSlot, setSwappingSlot] = useState<number | null>(null);

  const usedIds = useMemo(() => {
    const ids = new Set<string>();
    blueSlots.forEach((p) => p && ids.add(p.id));
    redSlots.forEach((p) => p && ids.add(p.id));
    return ids;
  }, [blueSlots, redSlots]);

  const currentTurn = turnIndex < PLAYER_DRAFT_TURNS.length ? PLAYER_DRAFT_TURNS[turnIndex] : null;
  const isBlueTurn = currentTurn?.side === 'blue';
  const isDraftComplete = turnIndex >= PLAYER_DRAFT_TURNS.length && blueSlots.every(p => p !== null) && redSlots.every(p => p !== null);

  // AI Draft step
  useEffect(() => {
    if (turnIndex >= PLAYER_DRAFT_TURNS.length) return;
    const turn = PLAYER_DRAFT_TURNS[turnIndex];
    if (turn.side !== 'red') return;

    setAiThinking(true);
    const timer = setTimeout(() => {
      const available = pool.filter((c) => !usedIds.has(c.id));
      const pick = chooseEqualizedPlayerPick(available, redSlots, blueSlots, draftSeed + turnIndex * 31);
      if (pick) {
        sound.playClick();
        setRedSlots((prev) => {
          const next = [...prev];
          next[pick.slot] = pick.card;
          return next;
        });
        setTurnIndex((t) => t + 1);
      }
      setAiThinking(false);
    }, 550);

    return () => clearTimeout(timer);
  }, [turnIndex, redSlots, blueSlots, pool, usedIds, draftSeed]);

  // Determine which blue slot is active for drafting
  const firstEmptyBlueSlot = blueSlots.findIndex((p) => p === null);
  const activeBlueSlotIndex = targetSlot !== null && blueSlots[targetSlot] === null
    ? targetSlot
    : firstEmptyBlueSlot !== -1 ? firstEmptyBlueSlot : 0;

  // Filter pool
  const filteredPool = useMemo(() => {
    return pool.filter((card) => {
      if (roleFilter !== 'All') {
        const matchesRole = card.role === roleFilter || card.preferredRole === roleFilter;
        if (!matchesRole) return false;
      }
      if (originFilter !== 'All' && card.origin !== originFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = card.name.toLowerCase().includes(q);
        const matchesOrigin = card.origin.toLowerCase().includes(q);
        const matchesRole = (card.preferredRole || card.role || '').toLowerCase().includes(q);
        if (!matchesName && !matchesOrigin && !matchesRole) return false;
      }
      return true;
    });
  }, [pool, roleFilter, originFilter, searchQuery]);

  const handleDraftPlayer = (card: PlayerCard) => {
    if (!isBlueTurn || aiThinking || usedIds.has(card.id)) return;
    if (activeBlueSlotIndex === -1) return;

    sound.playClick();
    setBlueSlots((prev) => {
      const next = [...prev];
      // If user selected a specific slot, use it; otherwise match role or use first empty
      let slotToFill = activeBlueSlotIndex;
      if (targetSlot === null) {
        const cardRole = card.preferredRole || card.role;
        const matchingEmpty = next.findIndex((p, idx) => p === null && TEAM_SLOTS[idx].role === cardRole);
        if (matchingEmpty !== -1) {
          slotToFill = matchingEmpty;
        }
      }
      next[slotToFill] = card;
      return next;
    });

    setTargetSlot(null);
    setTurnIndex((t) => t + 1);
  };

  const handleAutoDraftRest = () => {
    sound.playCoin();
    const currBlue = [...blueSlots];
    const currRed = [...redSlots];
    const currUsed = new Set([...usedIds]);
    let currIndex = turnIndex;

    while (currIndex < PLAYER_DRAFT_TURNS.length) {
      const turn = PLAYER_DRAFT_TURNS[currIndex];
      const available = pool.filter((c) => !currUsed.has(c.id));
      if (turn.side === 'blue') {
        const pick = chooseEqualizedPlayerPick(available, currBlue, currRed, draftSeed + currIndex * 17);
        if (pick) {
          currBlue[pick.slot] = pick.card;
          currUsed.add(pick.card.id);
        }
      } else {
        const pick = chooseEqualizedPlayerPick(available, currRed, currBlue, draftSeed + currIndex * 31);
        if (pick) {
          currRed[pick.slot] = pick.card;
          currUsed.add(pick.card.id);
        }
      }
      currIndex++;
    }

    setBlueSlots(currBlue);
    setRedSlots(currRed);
    setTurnIndex(PLAYER_DRAFT_TURNS.length);
  };

  const handleSwapSlot = (slotIdx: number) => {
    if (swappingSlot === null) {
      sound.playClick();
      setSwappingSlot(slotIdx);
    } else if (swappingSlot === slotIdx) {
      setSwappingSlot(null);
    } else {
      sound.playClick();
      setBlueSlots((prev) => {
        const next = [...prev];
        const temp = next[swappingSlot];
        next[swappingSlot] = next[slotIdx];
        next[slotIdx] = temp;
        return next;
      });
      setSwappingSlot(null);
    }
  };

  const handleProceed = () => {
    sound.playWalkoutFanfare();
    const finalBlue = blueSlots.filter((p): p is PlayerCard => p !== null);
    const finalRed = redSlots.filter((p): p is PlayerCard => p !== null);
    if (finalBlue.length === 5 && finalRed.length === 5) {
      onDraftComplete(finalBlue, finalRed);
    }
  };

  return (
    <div className="space-y-4 animate-fade-in max-w-7xl mx-auto">
      {/* Top Navigation & Mode Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-purple-950/80 via-slate-900 to-indigo-950/80 border border-purple-500/40 rounded-2xl p-4 shadow-xl">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition flex items-center gap-1 cursor-pointer"
          >
            ← Back to Modes
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-black text-white flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-purple-400" />
                EQUALIZED 100 OVR · PLAYER CARD DRAFT
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Phase 1 of 2
              </span>
            </div>
            <p className="text-xs text-purple-200/70 mt-0.5">
              Draft your starting 5 from the pool of 63 equalized superstars. Both squads receive 100 OVR GOAT tier athletes!
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isDraftComplete && (
            <button
              type="button"
              onClick={handleAutoDraftRest}
              disabled={aiThinking}
              className="px-3.5 py-1.5 rounded-xl bg-amber-500/20 border border-amber-400/40 hover:bg-amber-500/30 text-amber-300 font-bold text-xs transition flex items-center gap-1.5 shadow disabled:opacity-50 cursor-pointer"
            >
              <Dices className="w-3.5 h-3.5" />
              <span>Auto-Draft Rest</span>
            </button>
          )}

          {isDraftComplete && (
            <button
              type="button"
              onClick={handleProceed}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:brightness-110 text-slate-950 font-black text-xs transition flex items-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer animate-pulse"
            >
              <span>Proceed to Avatar Draft</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Snake Draft Turn Tracker */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 shadow-lg">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-xs font-black uppercase">
            <span className="text-slate-400">Snake Draft Turn Order:</span>
            {isDraftComplete ? (
              <span className="text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Rosters Locked!
              </span>
            ) : isBlueTurn ? (
              <span className="text-cyan-300 flex items-center gap-1 animate-pulse">
                <UserCheck className="w-3.5 h-3.5" /> YOUR TURN TO DRAFT (BLUE)
              </span>
            ) : (
              <span className="text-rose-400 flex items-center gap-1 animate-pulse">
                <Swords className="w-3.5 h-3.5" /> RED COACH DRAFTING...
              </span>
            )}
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            {Math.min(turnIndex + 1, 10)} / 10 Picks
          </span>
        </div>

        <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
          {PLAYER_DRAFT_TURNS.map((step, idx) => {
            const isCurrent = turnIndex === idx;
            const isDone = turnIndex > idx;
            const isBlue = step.side === 'blue';

            return (
              <div
                key={idx}
                className={`py-1.5 px-2 rounded-xl border text-center transition-all ${
                  isCurrent
                    ? isBlue
                      ? 'bg-cyan-500/30 border-cyan-400 text-cyan-200 ring-2 ring-cyan-400/50 shadow-lg scale-105'
                      : 'bg-rose-500/30 border-rose-400 text-rose-200 ring-2 ring-rose-400/50 shadow-lg scale-105'
                    : isDone
                    ? isBlue
                      ? 'bg-cyan-950/40 border-cyan-800/40 text-cyan-400/60'
                      : 'bg-rose-950/40 border-rose-800/40 text-rose-400/60'
                    : 'bg-slate-950/60 border-slate-800 text-slate-500'
                }`}
              >
                <div className="text-[9px] font-bold uppercase tracking-wider">
                  R{step.round}
                </div>
                <div className="text-[10px] font-black uppercase">
                  {step.side}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Stage: Blue Lineup | Center Inspector | Red Lineup */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Blue Lineup (5 Slots) */}
        <div className="lg:col-span-4 bg-slate-900/80 border border-cyan-500/30 rounded-2xl p-4 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-cyan-500/20 mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center text-cyan-300 font-black text-sm">
                  🔵
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">Blue All-Stars</h3>
                  <p className="text-[10px] text-cyan-300/80 font-semibold">{userCoach.name}</p>
                </div>
              </div>
              <span className="text-[10px] font-mono font-bold text-cyan-300 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-500/30">
                {blueSlots.filter(p => p !== null).length}/5 Drafted
              </span>
            </div>

            <div className="space-y-2">
              {TEAM_SLOTS.map((slotDef) => {
                const player = blueSlots[slotDef.slot];
                const isTarget = targetSlot === slotDef.slot;
                const isSwapping = swappingSlot === slotDef.slot;

                return (
                  <div
                    key={slotDef.slot}
                    onClick={() => {
                      if (swappingSlot !== null) {
                        handleSwapSlot(slotDef.slot);
                      } else if (!player) {
                        setTargetSlot(slotDef.slot);
                      }
                    }}
                    className={`relative p-2.5 rounded-xl border transition-all ${
                      player
                        ? 'bg-slate-950/70 border-cyan-500/40 shadow'
                        : isTarget
                        ? 'bg-cyan-500/20 border-cyan-400 border-dashed ring-1 ring-cyan-400/50'
                        : 'bg-slate-950/30 border-slate-800 border-dashed hover:border-cyan-500/50 hover:bg-slate-900/50 cursor-pointer'
                    } ${isSwapping ? 'ring-2 ring-amber-400' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-6 h-6 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center text-[10px] font-black text-slate-300 shrink-0">
                          {slotDef.icon}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-black text-cyan-400 uppercase tracking-wider">
                              {slotDef.label}
                            </span>
                            {player && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300">
                                {player.origin}
                              </span>
                            )}
                          </div>
                          {player ? (
                            <div className="text-xs font-black text-white truncate">
                              {player.name}
                            </div>
                          ) : (
                            <div className="text-xs text-slate-500 italic">
                              {isTarget ? 'Targeted for draft...' : `Empty (${slotDef.role})`}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {player ? (
                          <>
                            <div className="flex flex-col items-end">
                              <span className="text-xs font-black text-amber-300 font-mono">100 OVR</span>
                              <div className="flex gap-1 text-[8px] text-slate-400">
                                {player.badges?.slice(0, 1).map((b) => (
                                  <span key={b} className="bg-slate-800 px-1 rounded text-purple-300 font-medium">
                                    {b}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSwapSlot(slotDef.slot);
                              }}
                              title="Swap position with another slot"
                              className={`p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition ${
                                isSwapping ? 'text-amber-300 bg-amber-500/20' : ''
                              }`}
                            >
                              <ArrowLeftRight className="w-3.5 h-3.5" />
                            </button>
                            <div className="w-8 h-8 rounded-full bg-slate-900 border border-white/10 p-0.5 flex items-center justify-center">
                              <ChibiAvatar avatarType={player.avatarSvg} size={30} />
                            </div>
                          </>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-500 px-2 py-1 rounded bg-slate-900 border border-slate-800">
                            Available
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-cyan-500/20 text-[10px] text-slate-400 flex justify-between items-center">
            <span>Playbook: +{userCoach.playbookBonus} · Chem: +{userCoach.chemistryBonus}</span>
            <span className="text-cyan-300 font-bold">100% Equalized Stats</span>
          </div>
        </div>

        {/* Center: Selected Card Spotlight & Draft Action */}
        <div className="lg:col-span-4 bg-slate-900/90 border border-purple-500/30 rounded-2xl p-5 shadow-2xl flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl pointer-events-none" />

          {selectedCard ? (
            <div>
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-purple-500/20">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <span className="text-xs font-black uppercase text-purple-300">Player Card Dossier</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-amber-400 text-slate-950">
                    GOAT
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    EVO
                  </span>
                </div>
              </div>

              {/* Chibi & Hero Identity */}
              <div className="flex items-center gap-4 mb-4 bg-slate-950/60 p-3 rounded-2xl border border-slate-800">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/20 to-purple-600/20 border border-amber-400/40 p-1 flex items-center justify-center shrink-0 shadow-lg">
                  <ChibiAvatar avatarType={selectedCard.avatarSvg} size={56} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-baseline gap-1.5">
                    <h2 className="text-xl font-black text-white truncate">{selectedCard.name}</h2>
                    <span className="text-xs font-mono font-bold text-amber-300">100 OVR</span>
                  </div>
                  <div className="text-xs text-slate-400 font-semibold flex items-center gap-1.5 mt-0.5">
                    <span className="text-cyan-300 font-bold">{selectedCard.preferredRole || selectedCard.role}</span>
                    <span>·</span>
                    <span className="text-purple-300">{selectedCard.origin}</span>
                    <span>·</span>
                    <span className="text-slate-400">{selectedCard.personality}</span>
                  </div>
                </div>
              </div>

              {/* 100 Stats Grid */}
              <div className="grid grid-cols-3 gap-1.5 mb-4 text-center">
                <div className="bg-slate-950/80 p-1.5 rounded-xl border border-slate-800">
                  <div className="text-[9px] text-slate-400 font-bold uppercase">LAN</div>
                  <div className="text-xs font-mono font-black text-amber-300">100</div>
                </div>
                <div className="bg-slate-950/80 p-1.5 rounded-xl border border-slate-800">
                  <div className="text-[9px] text-slate-400 font-bold uppercase">TF</div>
                  <div className="text-xs font-mono font-black text-amber-300">100</div>
                </div>
                <div className="bg-slate-950/80 p-1.5 rounded-xl border border-slate-800">
                  <div className="text-[9px] text-slate-400 font-bold uppercase">IQ</div>
                  <div className="text-xs font-mono font-black text-amber-300">100</div>
                </div>
                <div className="bg-slate-950/80 p-1.5 rounded-xl border border-slate-800">
                  <div className="text-[9px] text-slate-400 font-bold uppercase">CLU</div>
                  <div className="text-xs font-mono font-black text-amber-300">100</div>
                </div>
                <div className="bg-slate-950/80 p-1.5 rounded-xl border border-slate-800">
                  <div className="text-[9px] text-slate-400 font-bold uppercase">STA</div>
                  <div className="text-xs font-mono font-black text-amber-300">100</div>
                </div>
                <div className="bg-slate-950/80 p-1.5 rounded-xl border border-slate-800">
                  <div className="text-[9px] text-slate-400 font-bold uppercase">FLX</div>
                  <div className="text-xs font-mono font-black text-amber-300">100</div>
                </div>
              </div>

              {/* PlayStyle Badges */}
              <div className="mb-4">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  PlayStyle Tactical Badges:
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(selectedCard.badges || []).map((badge) => (
                    <span
                      key={badge}
                      className="text-[10px] font-black px-2 py-0.5 rounded-lg bg-purple-500/20 text-purple-200 border border-purple-400/30"
                    >
                      ✦ {badge}
                    </span>
                  ))}
                  {(!selectedCard.badges || selectedCard.badges.length === 0) && (
                    <span className="text-[10px] text-slate-500 italic">Universal Competitor</span>
                  )}
                </div>
              </div>

              {/* Unlocked Roles */}
              <div className="text-[10px] text-slate-400 mb-4 bg-slate-950/40 p-2 rounded-xl border border-slate-800">
                <span className="text-emerald-400 font-bold">Full Role Versatility: </span>
                <span>Tank · Mage · Marksman · Support · Fighter · Assassin (Max 1.05 Power)</span>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500">
              Select a player card from the pool below to inspect
            </div>
          )}

          {/* Draft Action Button */}
          <div>
            {selectedCard && usedIds.has(selectedCard.id) ? (
              <div className="w-full py-3 rounded-xl bg-slate-800/80 border border-slate-700 text-center text-xs font-black text-slate-400">
                Already Drafted
              </div>
            ) : isDraftComplete ? (
              <button
                type="button"
                onClick={handleProceed}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:brightness-110 text-slate-950 font-black text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer"
              >
                <span>Proceed to Avatar Draft</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : isBlueTurn ? (
              <button
                type="button"
                onClick={() => selectedCard && handleDraftPlayer(selectedCard)}
                disabled={!selectedCard || usedIds.has(selectedCard.id)}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:brightness-110 text-white font-black text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 cursor-pointer disabled:opacity-40"
              >
                <UserCheck className="w-4 h-4" />
                <span>
                  Draft {selectedCard?.name} to {TEAM_SLOTS[activeBlueSlotIndex]?.label}
                </span>
              </button>
            ) : (
              <div className="w-full py-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-center text-xs font-black text-rose-300 flex items-center justify-center gap-2 animate-pulse">
                <span>Opponent AI is drafting...</span>
              </div>
            )}
          </div>
        </div>

        {/* Red Lineup (5 Slots) */}
        <div className="lg:col-span-4 bg-slate-900/80 border border-rose-500/30 rounded-2xl p-4 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-rose-500/20 mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-rose-500/20 border border-rose-400/30 flex items-center justify-center text-rose-300 font-black text-sm">
                  🔴
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">Red All-Stars</h3>
                  <p className="text-[10px] text-rose-300/80 font-semibold">{opponentCoach.name}</p>
                </div>
              </div>
              <span className="text-[10px] font-mono font-bold text-rose-300 bg-rose-950/60 px-2 py-0.5 rounded border border-rose-500/30">
                {redSlots.filter(p => p !== null).length}/5 Drafted
              </span>
            </div>

            <div className="space-y-2">
              {TEAM_SLOTS.map((slotDef) => {
                const player = redSlots[slotDef.slot];

                return (
                  <div
                    key={slotDef.slot}
                    className={`p-2.5 rounded-xl border transition-all ${
                      player
                        ? 'bg-slate-950/70 border-rose-500/40 shadow'
                        : 'bg-slate-950/30 border-slate-800 border-dashed'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-6 h-6 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center text-[10px] font-black text-slate-300 shrink-0">
                          {slotDef.icon}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-black text-rose-400 uppercase tracking-wider">
                              {slotDef.label}
                            </span>
                            {player && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300">
                                {player.origin}
                              </span>
                            )}
                          </div>
                          {player ? (
                            <div className="text-xs font-black text-white truncate">
                              {player.name}
                            </div>
                          ) : (
                            <div className="text-xs text-slate-500 italic">
                              {aiThinking && !isBlueTurn ? 'Evaluating...' : 'Awaiting draft'}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {player ? (
                          <>
                            <div className="flex flex-col items-end">
                              <span className="text-xs font-black text-amber-300 font-mono">100 OVR</span>
                              <div className="flex gap-1 text-[8px] text-slate-400">
                                {player.badges?.slice(0, 1).map((b) => (
                                  <span key={b} className="bg-slate-800 px-1 rounded text-rose-300 font-medium">
                                    {b}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div className="w-8 h-8 rounded-full bg-slate-900 border border-white/10 p-0.5 flex items-center justify-center">
                              <ChibiAvatar avatarType={player.avatarSvg} size={30} />
                            </div>
                          </>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-500 px-2 py-1 rounded bg-slate-900 border border-slate-800">
                            Slot Open
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-rose-500/20 text-[10px] text-slate-400 flex justify-between items-center">
            <span>Playbook: +{opponentCoach.playbookBonus} · Chem: +{opponentCoach.chemistryBonus}</span>
            <span className="text-rose-300 font-bold">100% Equalized Stats</span>
          </div>
        </div>
      </div>

      {/* Available Player Card Pool (Grid & Filters) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-black uppercase text-white tracking-wider">
              Available 100 OVR Superstars ({filteredPool.filter(c => !usedIds.has(c.id)).length} Available)
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search player..."
                className="bg-slate-950 border border-slate-700 rounded-xl pl-8 pr-3 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-400 w-36 sm:w-48"
              />
            </div>

            {/* Role Filter */}
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as AvatarRole | 'All')}
              className="bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1 text-xs font-bold text-slate-300 focus:outline-none focus:border-purple-400"
            >
              <option value="All">All Roles</option>
              <option value="Fighter">Fighter / Top</option>
              <option value="Assassin">Assassin / Jgl</option>
              <option value="Mage">Mage / Mid</option>
              <option value="Marksman">Marksman / Bot</option>
              <option value="Support">Support</option>
              <option value="Tank">Tank</option>
            </select>

            {/* Origin Filter */}
            <select
              value={originFilter}
              onChange={(e) => setOriginFilter(e.target.value as GameOrigin | 'All')}
              className="bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1 text-xs font-bold text-slate-300 focus:outline-none focus:border-purple-400"
            >
              <option value="All">All Origins</option>
              <option value="LoL">LoL</option>
              <option value="Dota2">Dota2</option>
              <option value="CS">CS</option>
              <option value="Valorant">Valorant</option>
            </select>
          </div>
        </div>

        {/* Player Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5 max-h-[380px] overflow-y-auto pr-1">
          {filteredPool.map((card) => {
            const isUsed = usedIds.has(card.id);
            const isSelected = selectedCard?.id === card.id;
            const isBlueDrafted = blueSlots.some((p) => p?.id === card.id);
            const isRedDrafted = redSlots.some((p) => p?.id === card.id);

            return (
              <div
                key={card.id}
                onClick={() => {
                  sound.playClick();
                  setSelectedCard(card);
                }}
                onDoubleClick={() => {
                  if (!isUsed && isBlueTurn) {
                    handleDraftPlayer(card);
                  }
                }}
                className={`relative p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  isSelected
                    ? 'ring-2 ring-purple-400 bg-purple-950/40 border-purple-400 shadow-lg scale-102'
                    : isUsed
                    ? 'opacity-40 bg-slate-950/40 border-slate-800 grayscale cursor-not-allowed'
                    : 'bg-slate-950/80 border-slate-800 hover:border-slate-600 hover:bg-slate-900/90'
                }`}
              >
                {isUsed && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 rounded-xl backdrop-blur-[1px]">
                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded shadow ${
                      isBlueDrafted ? 'bg-cyan-500 text-slate-950' : 'bg-rose-500 text-white'
                    }`}>
                      {isBlueDrafted ? 'Blue Team' : 'Red Team'}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between gap-1 mb-1.5">
                  <span className="text-[10px] font-mono font-black text-amber-300">100</span>
                  <span className="text-[8px] font-bold uppercase px-1 rounded bg-slate-800 text-slate-400">
                    {card.origin}
                  </span>
                </div>

                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-8 h-8 rounded-full bg-slate-900 border border-white/10 p-0.5 shrink-0 flex items-center justify-center">
                    <ChibiAvatar avatarType={card.avatarSvg} size={30} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-black text-white truncate" title={card.name}>
                      {card.name}
                    </div>
                    <div className="text-[9px] text-slate-400 truncate">
                      {card.preferredRole || card.role}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1 mt-1">
                  {(card.badges || []).slice(0, 1).map((b) => (
                    <span
                      key={b}
                      className="text-[8px] font-semibold px-1 py-0.2 rounded bg-purple-500/20 text-purple-300 truncate max-w-full"
                    >
                      {b}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
