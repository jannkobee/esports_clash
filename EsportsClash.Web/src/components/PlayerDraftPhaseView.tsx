import React, { useState, useEffect, useMemo } from 'react';
import type { PlayerCard, CoachCard, AvatarRole } from '../types';
import { ChibiAvatar } from './ChibiAvatar';
import { sound } from '../audio';
import { PERSONALITIES, personalityOf } from '../playerPersonality';
import { TEAM_SLOTS, PLAYER_DRAFT_TURNS, chooseEqualizedPlayerPick } from '../equalizedMode';
import { Zap, Shield, Sparkles, Search, Dices, ArrowRight, UserCheck, Swords, CheckCircle2, ArrowLeftRight } from 'lucide-react';

interface Props {
  pool: PlayerCard[];
  userCoach: CoachCard;
  opponentCoach: CoachCard;
  draftSeed: number;
  onDraftComplete: (blueRoster: PlayerCard[], redRoster: PlayerCard[]) => void;
  onCancel: () => void;
}

const primaryPersonalityName = (player: PlayerCard) => PERSONALITIES[personalityOf(player)[0]].name;

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
  const [searchQuery, setSearchQuery] = useState('');
  const [aiThinking, setAiThinking] = useState(false);
  const [swappingSlot, setSwappingSlot] = useState<number | null>(null);
  const selectedPersonalities = selectedCard ? personalityOf(selectedCard) : [];

  const usedIds = useMemo(() => {
    const ids = new Set<string>();
    blueSlots.forEach((p) => p && ids.add(p.id));
    redSlots.forEach((p) => p && ids.add(p.id));
    return ids;
  }, [blueSlots, redSlots]);

  const currentTurn = turnIndex < PLAYER_DRAFT_TURNS.length ? PLAYER_DRAFT_TURNS[turnIndex] : null;
  const isBlueTurn = currentTurn?.side === 'blue';
  const isDraftComplete =
    turnIndex >= PLAYER_DRAFT_TURNS.length &&
    blueSlots.every((p) => p !== null) &&
    redSlots.every((p) => p !== null);

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

  const firstEmptyBlueSlot = blueSlots.findIndex((p) => p === null);
  const activeBlueSlotIndex =
    targetSlot !== null && blueSlots[targetSlot] === null
      ? targetSlot
      : firstEmptyBlueSlot !== -1
      ? firstEmptyBlueSlot
      : 0;

  const filteredPool = useMemo(() => {
    return pool.filter((card) => {
      if (roleFilter !== 'All') {
        const matchesRole = card.role === roleFilter || card.preferredRole === roleFilter;
        if (!matchesRole) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = card.name.toLowerCase().includes(q);
        const matchesRole = (card.preferredRole || card.role || '').toLowerCase().includes(q);
        if (!matchesName && !matchesRole) return false;
      }
      return true;
    });
  }, [pool, roleFilter, searchQuery]);

  const handleDraftPlayer = (card: PlayerCard) => {
    if (!isBlueTurn || aiThinking || usedIds.has(card.id)) return;
    if (activeBlueSlotIndex === -1) return;

    sound.playClick();
    setBlueSlots((prev) => {
      const next = [...prev];
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
    <div className="space-y-4">
      {/* Top Navigation & Mode Header */}
      <div className="cm-panel">
        <div className="cm-panel-header">
          <span className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-[#f2c14e]" />
            <span>Equalized 100 OVR · Phase 1 of 2: Superstar Player Draft</span>
          </span>
          <span className="cm-badge cm-badge-gold">{Math.min(turnIndex + 1, 10)} / 10 Picks</span>
        </div>

        <div className="cm-panel-body space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button type="button" onClick={onCancel} className="cm-btn py-1 px-2.5 text-xs">
                ← Back to Match Modes
              </button>
              <span className="text-xs text-[#313a48]">
                Draft your starting 5 from 63 equalized 100 OVR GOAT superstars.
              </span>
            </div>

            <div className="flex items-center gap-2">
              {!isDraftComplete && (
                <button
                  type="button"
                  onClick={handleAutoDraftRest}
                  disabled={aiThinking}
                  className="cm-btn text-xs"
                >
                  <Dices className="w-3.5 h-3.5" />
                  <span>Auto-Draft Rest</span>
                </button>
              )}

              {isDraftComplete && (
                <button type="button" onClick={handleProceed} className="cm-btn cm-btn-primary text-xs">
                  <span>Proceed to Avatar Draft</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Snake Draft Turn Tracker */}
          <div className="grid grid-cols-5 sm:grid-cols-10 gap-1">
            {PLAYER_DRAFT_TURNS.map((step, idx) => {
              const isCurrent = turnIndex === idx;
              const isDone = turnIndex > idx;
              return (
                <div
                  key={idx}
                  className={`py-1 px-1.5 border text-center text-[10px] font-bold uppercase ${
                    isCurrent
                      ? 'bg-[#f2c14e] text-[#09152b] border-[#b88406]'
                      : isDone
                      ? 'bg-[#d0d6e0] text-[#566173] border-[#9aa4b4]'
                      : 'bg-white text-[#313a48] border-[#b4bcc8]'
                  }`}
                >
                  R{step.round} · {step.side}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Stage: Blue Lineup | Center Inspector | Red Lineup */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Blue Lineup (5 Slots) */}
        <div className="cm-panel lg:col-span-4">
          <div className="cm-panel-header">
            <span>🔵 Blue All-Stars ({userCoach.name})</span>
            <span className="cm-badge cm-badge-gold">
              {blueSlots.filter((p) => p !== null).length}/5
            </span>
          </div>
          <div className="cm-panel-body space-y-2">
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
                  className={`p-2 border transition cursor-pointer flex items-center justify-between gap-2 ${
                    player
                      ? 'bg-white border-[#143570]'
                      : isTarget
                      ? 'bg-[#fff3d1] border-2 border-[#c8961e]'
                      : 'bg-[#eef1f5] border-[#b4bcc8]'
                  } ${isSwapping ? 'ring-2 ring-[#c8961e]' : ''}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-bold text-[#0b1f44]">{slotDef.icon}</span>
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold uppercase text-[#143570]">{slotDef.label}</div>
                      {player ? (
                        <div className="text-xs font-black text-[#0b1f44] truncate">{player.name}</div>
                      ) : (
                        <div className="text-xs text-[#566173] italic">
                          {isTarget ? 'Targeted for draft...' : `Open (${slotDef.role})`}
                        </div>
                      )}
                    </div>
                  </div>

                  {player && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="cm-badge cm-badge-gold">100 OVR</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSwapSlot(slotDef.slot);
                        }}
                        title="Swap position with another slot"
                        className="cm-btn py-0.5 px-1.5 text-[10px]"
                      >
                        <ArrowLeftRight className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Center: Selected Card Spotlight & Draft Action */}
        <div className="cm-panel lg:col-span-4">
          <div className="cm-panel-header">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-[#f2c14e]" />
              <span>Player Dossier</span>
            </span>
            <span className="cm-badge cm-badge-gold">100 OVR GOAT</span>
          </div>

          <div className="cm-panel-body space-y-3">
            {selectedCard ? (
              <>
                <div className="flex items-center gap-3 bg-white p-3 border border-[#b4bcc8]">
                  <div className="w-12 h-12 bg-[#eef1f5] border border-[#9aa4b4] flex items-center justify-center shrink-0">
                    <ChibiAvatar avatarType={selectedCard.avatarSvg || selectedCard.name} size={44} />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-base font-black text-[#0b1f44] truncate">{selectedCard.name}</h2>
                    <div className="text-xs text-[#313a48] font-bold">
                      {selectedCard.preferredRole || selectedCard.role}
                    </div>
                    <div className="text-[11px] text-[#566173]">
                      {PERSONALITIES[selectedPersonalities[0]].name} / {PERSONALITIES[selectedPersonalities[1]].name}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-6 gap-1 text-center text-xs">
                  {(['LAN', 'TF', 'IQ', 'CLU', 'STA', 'FLX'] as const).map((stat) => (
                    <div key={stat} className="bg-white p-1.5 border border-[#b4bcc8]">
                      <div className="text-[9px] text-[#566173] font-bold">{stat}</div>
                      <div className="font-mono font-black text-[#0b1f44]">10/10</div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-[#566173] text-xs">
                Select a player card from the pool below to inspect.
              </div>
            )}

            <div>
              {selectedCard && usedIds.has(selectedCard.id) ? (
                <div className="w-full py-2 bg-[#d7dce5] border border-[#9aa4b4] text-center text-xs font-bold text-[#566173]">
                  Already Drafted
                </div>
              ) : isDraftComplete ? (
                <button type="button" onClick={handleProceed} className="cm-btn cm-btn-primary w-full py-2.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Proceed to Avatar Draft</span>
                </button>
              ) : isBlueTurn ? (
                <button
                  type="button"
                  onClick={() => selectedCard && handleDraftPlayer(selectedCard)}
                  disabled={!selectedCard || usedIds.has(selectedCard.id)}
                  className="cm-btn cm-btn-primary w-full py-2.5"
                >
                  <UserCheck className="w-4 h-4" />
                  <span>
                    Draft {selectedCard?.name} to {TEAM_SLOTS[activeBlueSlotIndex]?.label}
                  </span>
                </button>
              ) : (
                <div className="w-full py-2 bg-white border border-[#b4bcc8] text-center text-xs font-bold text-[#8f1d2c]">
                  <Swords className="w-3.5 h-3.5 inline mr-1" /> Opponent AI is drafting...
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Red Lineup (5 Slots) */}
        <div className="cm-panel lg:col-span-4">
          <div className="cm-panel-header">
            <span>🔴 Red All-Stars ({opponentCoach.name})</span>
            <span className="cm-badge cm-badge-gold">
              {redSlots.filter((p) => p !== null).length}/5
            </span>
          </div>
          <div className="cm-panel-body space-y-2">
            {TEAM_SLOTS.map((slotDef) => {
              const player = redSlots[slotDef.slot];
              return (
                <div
                  key={slotDef.slot}
                  className={`p-2 border flex items-center justify-between gap-2 ${
                    player ? 'bg-white border-[#8f1d2c]' : 'bg-[#eef1f5] border-[#b4bcc8]'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-bold text-[#8f1d2c]">{slotDef.icon}</span>
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold uppercase text-[#8f1d2c]">{slotDef.label}</div>
                      {player ? (
                        <div className="text-xs font-black text-[#0b1f44] truncate">{player.name}</div>
                      ) : (
                        <div className="text-xs text-[#566173] italic">
                          {aiThinking && !isBlueTurn ? 'Evaluating...' : 'Awaiting draft'}
                        </div>
                      )}
                    </div>
                  </div>
                  {player && <span className="cm-badge cm-badge-gold">10/10</span>}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Available Player Card Pool */}
      <div className="cm-panel">
        <div className="cm-panel-header">
          <span className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#f2c14e]" />
            <span>
              Available 10/10 Superstars ({filteredPool.filter((c) => !usedIds.has(c.id)).length} Available)
            </span>
          </span>
        </div>

        <div className="cm-panel-body space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="w-3.5 h-3.5 text-[#566173] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search player..."
                className="cm-input w-full pl-8"
              />
            </div>

            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as AvatarRole | 'All')}
              className="cm-select"
            >
              <option value="All">All Role Positions</option>
              <option value="Fighter">Fighter</option>
              <option value="Assassin">Assassin</option>
              <option value="Mage">Mage</option>
              <option value="Marksman">Marksman</option>
              <option value="Support">Support</option>
              <option value="Tank">Tank</option>
            </select>

          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 max-h-[340px] overflow-y-auto p-0.5">
            {filteredPool.map((card) => {
              const isUsed = usedIds.has(card.id);
              const isSelected = selectedCard?.id === card.id;
              const isBlueDrafted = blueSlots.some((p) => p?.id === card.id);

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
                  className={`relative p-2 border text-left transition cursor-pointer ${
                    isSelected
                      ? 'border-2 border-[#c8961e] bg-[#fff3d1]'
                      : isUsed
                      ? 'opacity-40 bg-[#d7dce5] border-[#9aa4b4] cursor-not-allowed'
                      : 'bg-white border-[#b4bcc8] hover:bg-[#f6f8fb]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-[10px] font-mono font-black text-[#b88406]">10/10</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <ChibiAvatar avatarType={card.avatarSvg || card.name} size={28} />
                    <div className="min-w-0">
                      <div className="text-xs font-black text-[#0b1f44] truncate" title={card.name}>
                        {card.name}
                      </div>
                      <div className="text-[10px] text-[#566173] truncate">
                        {card.preferredRole || card.role}
                      </div>
                    </div>
                  </div>

                  <div className="mt-1 flex items-center justify-between text-[10px]">
                    <span className="text-[#313a48] truncate">{primaryPersonalityName(card)}</span>
                    {isUsed && (
                      <span className={`cm-badge ${isBlueDrafted ? 'cm-badge-blue' : 'cm-badge-red'}`}>
                        {isBlueDrafted ? 'Blue' : 'Red'}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
