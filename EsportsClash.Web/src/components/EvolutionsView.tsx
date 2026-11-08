import React, { useState } from 'react';
import { EvolutionPlan, PlayerCard } from '../types';
import { PlayerProfileCard } from './PlayerProfileCard';
import { sound } from '../audio';
import confetti from 'canvas-confetti';
import { Zap, Sparkles, Coins } from 'lucide-react';

interface EvolutionsViewProps {
  plans: EvolutionPlan[];
  roster: PlayerCard[];
  teamFunds: number;
  onStartEvolution: (cardId: string, planId: string) => void;
  onClaimEvolution: (cardId: string, planId: string, chosenSignature?: string) => void;
  onFastTrackEvolution: (cardId: string) => void;
  activeEvolutions: { [cardId: string]: { planId: string; progress: number[] } };
}

export const EvolutionsView: React.FC<EvolutionsViewProps> = ({
  plans,
  roster,
  teamFunds,
  onStartEvolution,
  onClaimEvolution,
  onFastTrackEvolution,
  activeEvolutions
}) => {
  const [selectedPlan, setSelectedPlan] = useState<EvolutionPlan>(plans[0]);
  const [selectedCard, setSelectedCard] = useState<PlayerCard | null>(null);
  const [eligibleQuery, setEligibleQuery] = useState('');
  const [selectedSignatures, setSelectedSignatures] = useState<{ [cardId: string]: string }>({});

  const eligibleCards = roster.filter((c) => c.ovr <= selectedPlan.maxOvr && !activeEvolutions[c.id]);
  const visibleEligibleCards = eligibleCards.filter((card) =>
    `${card.name} ${card.role} ${card.tier}`.toLowerCase().includes(eligibleQuery.trim().toLowerCase())
  );

  const handleStart = () => {
    if (!selectedCard) return;
    sound.playClick();
    onStartEvolution(selectedCard.id, selectedPlan.id);
    setSelectedCard(null);
  };

  return (
    <div className="space-y-4">
      {/* Active Evolutions in Progress Section */}
      {Object.keys(activeEvolutions).length > 0 && (
        <div className="cm-panel">
          <div className="cm-panel-header">
            <span className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#f2c14e]" />
              <span>Active Training &amp; Evolutions in Progress</span>
            </span>
            <span className="cm-badge cm-badge-gold">{Object.keys(activeEvolutions).length} Active</span>
          </div>

          <div className="cm-panel-body grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(activeEvolutions).map(([cardId, evoData]) => {
              const card = roster.find((c) => c.id === cardId);
              const plan = plans.find((p) => p.id === evoData.planId);
              if (!card || !plan) return null;

              const isComplete = plan.objectives.every(
                (_, idx) => (evoData.progress[idx] || 0) >= plan.objectives[idx].target
              );

              return (
                <div
                  key={cardId}
                  className="bg-white border border-[#9aa4b4] p-3 flex flex-col sm:flex-row gap-3 items-center"
                >
                  <div className="w-36 shrink-0">
                    <PlayerProfileCard card={card} compact />
                  </div>

                  <div className="flex-1 w-full space-y-2">
                    <div className="flex items-center justify-between border-b border-[#d0d6e0] pb-1">
                      <div className="text-sm font-black text-[#0b1f44]">{plan.name}</div>
                      {plan.unlockedRole && <span className="cm-badge cm-badge-green">+{plan.unlockedRole} Role</span>}
                    </div>

                    <div className="space-y-1.5 text-xs">
                      {plan.objectives.map((obj, idx) => {
                        const current = evoData.progress[idx] || 0;
                        const pct = Math.min(100, Math.round((current / obj.target) * 100));
                        return (
                          <div key={obj.id}>
                            <div className="flex justify-between text-[11px] text-[#313a48] mb-0.5">
                              <span>{obj.desc}</span>
                              <span className="font-mono font-bold text-[#0b1f44]">
                                {current}/{obj.target}
                              </span>
                            </div>
                            <div className="w-full h-2 bg-[#d7dce5] border border-[#9aa4b4]">
                              <div className="h-full bg-[#127a3a]" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {plan.selectableSignatures && plan.selectableSignatures.length > 0 && (
                      <div className="text-xs">
                        <label className="text-[#566173] block text-[11px] font-bold mb-1">
                          Select Signature Avatar to Unlock:
                        </label>
                        <select
                          value={selectedSignatures[card.id] || plan.selectableSignatures[0]}
                          onChange={(e) => setSelectedSignatures((prev) => ({ ...prev, [card.id]: e.target.value }))}
                          className="cm-select w-full"
                        >
                          {plan.selectableSignatures.map((sig) => (
                            <option key={sig} value={sig}>
                              ⚡ {sig}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {isComplete ? (
                      <button
                        type="button"
                        onClick={() => {
                          sound.playWalkoutFanfare();
                          confetti({ particleCount: 100, spread: 70 });
                          const chosenSig = selectedSignatures[card.id] || plan.selectableSignatures?.[0];
                          onClaimEvolution(card.id, plan.id, chosenSig);
                        }}
                        className="cm-btn cm-btn-primary w-full py-1.5"
                      >
                        <Sparkles className="w-3.5 h-3.5" /> Claim Evolution (+{plan.ovrBoost || 5} OVR)!
                      </button>
                    ) : (
                      <div className="flex items-center justify-between gap-2 pt-1">
                        <div className="text-[11px] text-[#566173] font-bold">⏳ Complete match objectives</div>
                        <button
                          type="button"
                          onClick={() => {
                            sound.playCoin();
                            onFastTrackEvolution(card.id);
                          }}
                          className="cm-btn py-1 px-2.5 text-[11px]"
                          title="Instantly complete objectives for 250 Coins"
                        >
                          <Zap className="w-3 h-3 text-[#b88406]" /> Fast-Track (🪙 250)
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Available Evolution Plans Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Evolution Path Selector */}
        <div className="cm-panel">
          <div className="cm-panel-header">
            <span>Training &amp; Evolution Programs</span>
            <span className="cm-badge cm-badge-blue">{plans.length} Paths</span>
          </div>
          <div className="cm-panel-body space-y-2">
            {plans.map((plan) => {
              const isSelected = selectedPlan.id === plan.id;
              return (
                <button
                  type="button"
                  key={plan.id}
                  onClick={() => {
                    sound.playClick();
                    setSelectedPlan(plan);
                    setSelectedCard(null);
                  }}
                  className={`w-full text-left p-3 border transition cursor-pointer ${
                    isSelected
                      ? 'bg-[#fff3d1] border-2 border-[#c8961e]'
                      : 'bg-white border-[#b4bcc8] hover:bg-[#f6f8fb]'
                  }`}
                >
                  <div className="flex justify-between items-start gap-2 mb-1">
                    <h4 className="font-black text-xs text-[#0b1f44]">{plan.name}</h4>
                    <span className="cm-badge cm-badge-gold">{plan.targetTier}</span>
                  </div>
                  <p className="text-xs text-[#313a48] line-clamp-2">{plan.desc}</p>
                  <div className="mt-2 pt-1.5 border-t border-[#d0d6e0] flex justify-between items-center text-[11px] font-bold">
                    <span className="text-[#566173]">Max Entry: {plan.maxOvr} OVR</span>
                    <span className="text-[#0b1f44] font-mono flex items-center gap-1">
                      <Coins className="w-3 h-3 text-[#b88406]" /> 🪙 {plan.coinCost}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Selected Plan Details & Eligible Roster */}
        <div className="cm-panel lg:col-span-2 min-w-0">
          <div className="cm-panel-header">
            <span>Program Dossier · {selectedPlan.name}</span>
            <span className="cm-badge cm-badge-gold">Fee: 🪙 {selectedPlan.coinCost} Coins</span>
          </div>

          <div className="cm-panel-body space-y-4">
            <div className="bg-white border border-[#b4bcc8] p-3 space-y-2.5">
              <p className="text-xs text-[#313a48]">{selectedPlan.desc}</p>

              <div className="flex flex-wrap gap-2 text-xs">
                <span className="cm-badge cm-badge-gold">Target Tier: {selectedPlan.targetTier}</span>
                <span className="cm-badge cm-badge-green">Rating Boost: +{selectedPlan.ovrBoost || 5} OVR</span>
                <span className="cm-badge cm-badge-blue">Trait Badge: {selectedPlan.unlockedBadge}</span>
                {selectedPlan.unlockedRole && (
                  <span className="cm-badge cm-badge-navy">Secondary Role: +{selectedPlan.unlockedRole}</span>
                )}
              </div>

              {selectedPlan.selectableSignatures && selectedPlan.selectableSignatures.length > 0 && (
                <div className="text-xs text-[#313a48] pt-1 border-t border-[#d0d6e0]">
                  <span className="font-bold text-[#566173]">Unlockable Signature Avatars: </span>
                  <strong className="text-[#0b1f44]">{selectedPlan.selectableSignatures.join(' · ')}</strong>
                </div>
              )}

              <div className="grid grid-cols-6 gap-1.5 text-center text-xs pt-1">
                <div className="bg-[#eef1f5] border border-[#b4bcc8] p-1.5">
                  <div className="text-[10px] font-bold text-[#566173]">LAN</div>
                  <div className="font-mono font-black text-[#127a3a]">+{selectedPlan.statBoost.lan || 5}</div>
                </div>
                <div className="bg-[#eef1f5] border border-[#b4bcc8] p-1.5">
                  <div className="text-[10px] font-bold text-[#566173]">TF</div>
                  <div className="font-mono font-black text-[#127a3a]">+{selectedPlan.statBoost.tf || 5}</div>
                </div>
                <div className="bg-[#eef1f5] border border-[#b4bcc8] p-1.5">
                  <div className="text-[10px] font-bold text-[#566173]">IQ</div>
                  <div className="font-mono font-black text-[#127a3a]">+{selectedPlan.statBoost.iq || 5}</div>
                </div>
                <div className="bg-[#eef1f5] border border-[#b4bcc8] p-1.5">
                  <div className="text-[10px] font-bold text-[#566173]">CLU</div>
                  <div className="font-mono font-black text-[#127a3a]">+{selectedPlan.statBoost.clu || 8}</div>
                </div>
                <div className="bg-[#eef1f5] border border-[#b4bcc8] p-1.5">
                  <div className="text-[10px] font-bold text-[#566173]">STA</div>
                  <div className="font-mono font-black text-[#127a3a]">+{selectedPlan.statBoost.sta || 5}</div>
                </div>
                <div className="bg-[#eef1f5] border border-[#b4bcc8] p-1.5">
                  <div className="text-[10px] font-bold text-[#566173]">FLX</div>
                  <div className="font-mono font-black text-[#127a3a]">+{selectedPlan.statBoost.flx || 5}</div>
                </div>
              </div>
            </div>

            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-xs font-black uppercase text-[#0b1f44]">
                  Select Eligible Club Player ({eligibleCards.length} Eligible ≤ {selectedPlan.maxOvr} OVR)
                </h4>
                <input
                  type="search"
                  value={eligibleQuery}
                  onChange={(event) => setEligibleQuery(event.target.value)}
                  placeholder="Search name, role, tier..."
                  aria-label="Search eligible players"
                  className="cm-input w-48"
                />
              </div>

              {eligibleCards.length === 0 ? (
                <div className="bg-white border border-[#b4bcc8] text-center py-6 text-[#566173] text-xs">
                  No eligible players meet this program&apos;s requirements (Max OVR: {selectedPlan.maxOvr}).
                </div>
              ) : (
                <div className="flex min-w-0 gap-3 overflow-x-auto pb-2">
                  {visibleEligibleCards.map((card) => (
                    <div key={card.id} className="w-36 shrink-0">
                      <PlayerProfileCard
                        card={card}
                        compact
                        selected={selectedCard?.id === card.id}
                        onClick={() => {
                          sound.playClick();
                          setSelectedCard(card);
                        }}
                      />
                    </div>
                  ))}
                  {visibleEligibleCards.length === 0 && (
                    <p className="py-6 text-xs text-[#566173]">No eligible players match this search.</p>
                  )}
                </div>
              )}
            </div>

            {selectedCard && (
              <div className="pt-3 border-t border-[#c4cbd6] flex flex-wrap justify-between items-center gap-3">
                <div className="text-xs">
                  <span className="text-[#566173] font-bold">Selected Candidate: </span>
                  <strong className="text-[#0b1f44] text-sm">
                    {selectedCard.name} (OVR {selectedCard.ovr})
                  </strong>
                </div>

                <button
                  type="button"
                  onClick={handleStart}
                  disabled={teamFunds < selectedPlan.coinCost}
                  className="cm-btn cm-btn-primary px-5 py-2"
                >
                  <Zap className="w-4 h-4" />
                  <span>Enroll in Evolution (🪙 {selectedPlan.coinCost})</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
