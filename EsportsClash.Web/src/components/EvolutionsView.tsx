import React, { useState } from 'react';
import { EvolutionPlan, PlayerCard } from '../types';
import { CardComponent } from './CardComponent';
import { sound } from '../audio';
import confetti from 'canvas-confetti';
import { Zap, CheckCircle2, ArrowRight, Sparkles, Coins } from 'lucide-react';

interface EvolutionsViewProps {
  plans: EvolutionPlan[];
  roster: PlayerCard[];
  teamFunds: number;
  onStartEvolution: (cardId: string, planId: string) => void;
  onClaimEvolution: (cardId: string, planId: string) => void;
  activeEvolutions: { [cardId: string]: { planId: string; progress: number[] } };
}

export const EvolutionsView: React.FC<EvolutionsViewProps> = ({
  plans,
  roster,
  teamFunds,
  onStartEvolution,
  onClaimEvolution,
  activeEvolutions
}) => {
  const [selectedPlan, setSelectedPlan] = useState<EvolutionPlan>(plans[0]);
  const [selectedCard, setSelectedCard] = useState<PlayerCard | null>(null);

  const eligibleCards = roster.filter(
    (c) => c.ovr <= selectedPlan.maxOvr && !activeEvolutions[c.id]
  );

  const handleStart = () => {
    if (!selectedCard) return;
    sound.playClick();
    onStartEvolution(selectedCard.id, selectedPlan.id);
    setSelectedCard(null);
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl mx-auto">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-teal-950 via-slate-900 to-indigo-950 border border-teal-500/40 rounded-2xl p-4 shadow-xl flex justify-between items-center">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-teal-400 animate-pulse" />
            EA FC-STYLE EVOLUTIONS HUB
          </h2>
          <p className="text-slate-400 text-xs mt-0.5">
            Level up your favorite cards, upgrade their rarity tiers, and unlock exclusive PlayStyle+ badges!
          </p>
        </div>
      </div>

      {/* Active Evolutions in Progress Section */}
      {Object.keys(activeEvolutions).length > 0 && (
        <div className="bg-slate-900 border border-teal-500/30 rounded-2xl p-5 shadow-lg">
          <h3 className="text-sm font-black text-teal-300 uppercase tracking-wide mb-3 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-teal-400" />
            Active Evolutions in Progress
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(activeEvolutions).map(([cardId, evoData]) => {
              const card = roster.find((c) => c.id === cardId);
              const plan = plans.find((p) => p.id === evoData.planId);
              if (!card || !plan) return null;

              const isComplete = plan.objectives.every((_, idx) => (evoData.progress[idx] || 0) >= plan.objectives[idx].target);

              return (
                <div key={cardId} className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex gap-4 items-center">
                  <CardComponent card={card} compact />

                  <div className="flex-1">
                    <div className="text-sm font-bold text-white mb-1">{plan.name}</div>
                    <div className="space-y-1.5 text-xs">
                      {plan.objectives.map((obj, idx) => {
                        const current = evoData.progress[idx] || 0;
                        const pct = Math.min(100, Math.round((current / obj.target) * 100));
                        return (
                          <div key={obj.id}>
                            <div className="flex justify-between text-[11px] text-slate-400 mb-0.5">
                              <span>{obj.desc}</span>
                              <span className="font-bold text-teal-300">{current}/{obj.target}</span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                              <div className="h-full bg-teal-400" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {isComplete ? (
                      <button
                        onClick={() => {
                          sound.playWalkoutFanfare();
                          confetti({ particleCount: 100, spread: 70 });
                          onClaimEvolution(card.id, plan.id);
                        }}
                        className="mt-3 w-full py-1.5 bg-gradient-to-r from-teal-400 to-emerald-400 text-slate-950 font-black rounded-lg text-xs hover:brightness-110 shadow"
                      >
                        🎉 Claim Evolution Upgrade!
                      </button>
                    ) : (
                      <div className="mt-2 text-[10px] text-amber-300 font-semibold">
                        ⏳ Complete objectives in tournament matches to evolve!
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Evolution Path Selector */}
        <div className="space-y-3">
          <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider">Available Evolution Paths</h3>
          {plans.map((plan) => (
            <div
              key={plan.id}
              onClick={() => {
                sound.playClick();
                setSelectedPlan(plan);
                setSelectedCard(null);
              }}
              className={`p-4 rounded-xl border cursor-pointer transition ${
                selectedPlan.id === plan.id
                  ? 'bg-teal-950/70 border-teal-400 shadow-lg'
                  : 'bg-slate-900 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex justify-between items-start mb-1">
                <h4 className="font-black text-sm text-white">{plan.name}</h4>
                <span className="text-[10px] bg-teal-400/20 text-teal-300 px-2 py-0.5 rounded-full font-bold border border-teal-400/30">
                  {plan.targetTier} Tier
                </span>
              </div>
              <p className="text-xs text-slate-400 line-clamp-2">{plan.desc}</p>
              <div className="mt-2 flex justify-between items-center text-xs font-bold">
                <span className="text-slate-400">Max OVR: {plan.maxOvr}</span>
                <span className="text-amber-400 flex items-center gap-1">
                  <Coins className="w-3.5 h-3.5" /> ${plan.coinCost}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Center: Selected Plan Details & Eligible Roster */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="text-lg font-black text-white">{selectedPlan.name}</h3>
            <p className="text-xs text-slate-400 mt-0.5">{selectedPlan.desc}</p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <span className="bg-slate-800 text-slate-300 px-2.5 py-1 rounded-lg border border-white/5">
                Upgrades to: <strong className="text-teal-300 uppercase">{selectedPlan.targetTier}</strong>
              </span>
              <span className="bg-slate-800 text-slate-300 px-2.5 py-1 rounded-lg border border-white/5">
                Unlocks Badge: <strong className="text-amber-300">{selectedPlan.unlockedBadge}</strong>
              </span>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider mb-2">
              Select Eligible Player from Your Club ({eligibleCards.length} eligible)
            </h4>

            {eligibleCards.length === 0 ? (
              <div className="text-center py-6 text-slate-500 text-xs">
                No eligible players meeting requirements (Max OVR: {selectedPlan.maxOvr}). Open packs to find candidates!
              </div>
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-2">
                {eligibleCards.map((card) => (
                  <CardComponent
                    key={card.id}
                    card={card}
                    compact
                    selected={selectedCard?.id === card.id}
                    onClick={() => {
                      sound.playClick();
                      setSelectedCard(card);
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {selectedCard && (
            <div className="pt-4 border-t border-slate-800 flex justify-between items-center">
              <div>
                <span className="text-xs text-slate-400">Selected for Evolution: </span>
                <strong className="text-white text-sm">{selectedCard.name} (OVR {selectedCard.ovr})</strong>
              </div>

              <button
                onClick={handleStart}
                disabled={teamFunds < selectedPlan.coinCost}
                className={`px-6 py-2.5 rounded-xl text-xs font-black transition flex items-center gap-2 ${
                  teamFunds >= selectedPlan.coinCost
                    ? 'bg-gradient-to-r from-teal-400 to-emerald-400 text-slate-950 hover:brightness-110 shadow-lg'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                <Zap className="w-4 h-4" />
                Start Evolution (${selectedPlan.coinCost})
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

