import React, { useState } from 'react';
import { CoachCard, PlayerCard } from '../types';
import { CardComponent } from './CardComponent';
import { sound } from '../audio';
import { Shield, Sparkles, Users, RefreshCw } from 'lucide-react';

interface SquadViewProps {
  startingFive: PlayerCard[];
  bench: PlayerCard[];
  coach?: CoachCard;
  onSwapPlayer: (startingIndex: number, benchId: string) => void;
}

export const SquadView: React.FC<SquadViewProps> = ({
  startingFive,
  bench,
  coach,
  onSwapPlayer
}) => {
  const [inspectCard, setInspectCard] = useState<PlayerCard | null>(null);
  const [selectedStartingIdx, setSelectedStartingIdx] = useState<number | null>(null);

  // Chemistry Calculation: based on shared game origins & coach bonus
  const originCounts: { [k: string]: number } = {};
  startingFive.forEach((p) => {
    originCounts[p.origin] = (originCounts[p.origin] || 0) + 1;
  });
  const maxSynergy = Math.max(...Object.values(originCounts), 1);
  const chemistryScore = Math.min(100, maxSynergy * 20 + (coach?.chemistryBonus || 0) + 20);

  const handleStartingSlotClick = (idx: number) => {
    sound.playClick();
    if (selectedStartingIdx === idx) setSelectedStartingIdx(null);
    else setSelectedStartingIdx(idx);
  };

  const handleBenchClick = (benchCard: PlayerCard) => {
    sound.playClick();
    if (selectedStartingIdx !== null) {
      onSwapPlayer(selectedStartingIdx, benchCard.id);
      setSelectedStartingIdx(null);
    } else {
      setInspectCard(benchCard);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl mx-auto">
      {/* Squad Overview Banner */}
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl p-4 shadow-xl flex flex-wrap justify-between items-center gap-4">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-400" />
            SQUAD MANAGEMENT & TACTICAL LINEUP
          </h2>
          <p className="text-slate-400 text-xs mt-0.5">
            Set your Starting 5 for the 1-Lane ARAM Mayhem split matches. Click a starter then click a bench player to swap!
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs font-bold">
          <div className="bg-black/40 px-3 py-1.5 rounded-lg border border-white/10 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Squad Chemistry: <strong className="text-amber-300">{chemistryScore}/100</strong></span>
          </div>
          {coach && (
            <div className="bg-black/40 px-3 py-1.5 rounded-lg border border-white/10 flex items-center gap-2">
              <Shield className="w-4 h-4 text-cyan-400" />
              <span>Coach: <strong className="text-cyan-300">{coach.name} ({coach.style})</strong></span>
            </div>
          )}
        </div>
      </div>

      {/* Starting 5 Lineup Formation */}
      <div className="bg-gradient-to-b from-indigo-950/40 via-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-6 shadow-2xl">
        <h3 className="text-xs font-black uppercase text-amber-300 tracking-wider mb-4 flex items-center gap-2">
          <span>Starting 5 (Active Combat Formation)</span>
          {selectedStartingIdx !== null && (
            <span className="text-cyan-400 font-normal normal-case animate-pulse flex items-center gap-1">
              <RefreshCw className="w-3.5 h-3.5" /> (Select a bench card below to substitute)
            </span>
          )}
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 justify-items-center">
          {startingFive.map((player, idx) => (
            <div key={player.id} className="flex flex-col items-center">
              <CardComponent
                card={player}
                selected={selectedStartingIdx === idx}
                onClick={() => handleStartingSlotClick(idx)}
              />
              <button
                onClick={() => setInspectCard(player)}
                className="mt-2 text-[10px] text-slate-400 hover:text-white underline"
              >
                Inspect Details
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Club Reserves & Bench */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
        <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider mb-3">
          Club Reserves & Bench ({bench.length} players)
        </h3>

        {bench.length === 0 ? (
          <div className="text-center py-6 text-slate-500 text-xs">
            No bench reserves. Open more packs in the Store to build squad depth!
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-3">
            {bench.map((player) => (
              <CardComponent
                key={player.id}
                card={player}
                compact
                onClick={() => handleBenchClick(player)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Full Screen Card Inspector Modal */}
      {inspectCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl max-w-md w-full relative animate-fade-in flex flex-col items-center">
            <button
              onClick={() => setInspectCard(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white font-bold"
            >
              ✕
            </button>
            <CardComponent card={inspectCard} />
            <div className="mt-4 text-center text-xs text-slate-400">
              Signature Champions: <strong className="text-white">{inspectCard.signatureChampions.join(', ')}</strong>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

