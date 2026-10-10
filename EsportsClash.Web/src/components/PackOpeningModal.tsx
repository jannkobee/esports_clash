import React, { useState, useEffect } from 'react';
import { PlayerCard } from '../types';
import { CardComponent } from './CardComponent';
import { sound } from '../audio';
import confetti from 'canvas-confetti';
import { Sparkles, X } from 'lucide-react';

interface PackOpeningModalProps {
  packName: string;
  cards: PlayerCard[];
  onClose: () => void;
  duplicateUpgrades: number;
  spentCoins: number;
  balanceAfter: number;
}

export const PackOpeningModal: React.FC<PackOpeningModalProps> = ({
  packName,
  cards,
  onClose,
  duplicateUpgrades,
  spentCoins,
  balanceAfter
}) => {
  const [stage, setStage] = useState<'tearing' | 'walkout' | 'summary'>('tearing');
  const [featuredIndex, setFeaturedIndex] = useState(0);

  // Pick highest OVR card for walkout
  const bestCard = [...cards].sort((a, b) => b.ovr - a.ovr)[0];

  useEffect(() => {
    sound.playPackTear();
    const t1 = setTimeout(() => {
      setStage('walkout');
      if (bestCard.tier === 'GOAT' || bestCard.tier === 'Diamond') {
        sound.playWalkoutFanfare();
        confetti({
          particleCount: 120,
          spread: 80,
          origin: { y: 0.6 }
        });
      }
    }, 1200);

    const t2 = setTimeout(() => {
      setStage('summary');
    }, 3600);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
      {stage === 'tearing' && (
        <div className="text-center animate-pulse">
          <div className="w-64 h-88 bg-gradient-to-tr from-amber-600 via-pink-600 to-purple-600 rounded-3xl p-6 border-4 border-amber-300 shadow-[0_0_50px_rgba(236,72,153,0.8)] mx-auto flex flex-col items-center justify-center transform scale-110">
            <Sparkles className="w-16 h-16 text-yellow-300 animate-spin-slow mb-4" />
            <h2 className="text-2xl font-black text-white uppercase tracking-wider">{packName}</h2>
            <p className="text-amber-200 text-sm font-semibold mt-2">Tearing Pack Foil...</p>
          </div>
        </div>
      )}

      {stage === 'walkout' && (
        <div className="flex flex-col items-center justify-center animate-fade-in text-center">
          <div className="text-amber-300 font-black text-2xl mb-4 tracking-widest uppercase flex items-center gap-2">
            <Sparkles className="w-6 h-6 animate-bounce" />
            WALKOUT REVEAL!
            <Sparkles className="w-6 h-6 animate-bounce" />
          </div>
          <div className="transform scale-125 transition-all duration-500">
            <CardComponent card={bestCard} />
          </div>
        </div>
      )}

      {stage === 'summary' && (
        <div className="w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl relative animate-fade-in">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-full transition"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="text-center mb-6">
            <h2 className="text-2xl font-black text-amber-400 uppercase tracking-wide">
              {packName} Opened!
            </h2>
            <p className="text-slate-400 text-sm">
              {duplicateUpgrades > 0
                ? `${cards.length} cards scouted. ${duplicateUpgrades} duplicate pulls trained your existing cards.`
                : `${cards.length} new players added to your club roster.`}
            </p>
            <p className="mt-2 text-xs font-semibold text-amber-300">
              {spentCoins > 0 ? `Spent ${spentCoins.toLocaleString()} Coins` : 'Free pack'} · Balance: {balanceAfter.toLocaleString()} Coins
            </p>
            {duplicateUpgrades > 0 && (
              <div className="mt-2 inline-flex items-center gap-2 bg-amber-950/80 border border-amber-500/40 text-amber-300 px-4 py-1.5 rounded-full text-xs font-bold animate-pulse">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>{duplicateUpgrades} existing player {duplicateUpgrades === 1 ? 'card' : 'cards'} trained</span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap justify-center gap-4 max-h-[60vh] overflow-y-auto p-2">
            {cards.map((c, i) => (
              <CardComponent
                key={c.id + i}
                card={c}
                compact={cards.length > 3}
                onClick={() => {
                  sound.playClick();
                  setFeaturedIndex(i);
                }}
              />
            ))}
          </div>

          <div className="mt-6 flex justify-center">
            <button
              onClick={() => {
                sound.playClick();
                onClose();
              }}
              className="px-8 py-3 bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black rounded-xl hover:brightness-110 shadow-lg transition"
            >
              Collect All & Continue
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

