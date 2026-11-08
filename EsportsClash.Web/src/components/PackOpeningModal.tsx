import React, { useState, useEffect } from 'react';
import { PlayerCard } from '../types';
import { PlayerProfileCard } from './PlayerProfileCard';
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
    }, 1000);

    const t2 = setTimeout(() => {
      setStage('summary');
    }, 2800);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [bestCard.tier]);

  return (
    <div className="cm-modal-backdrop">
      {stage === 'tearing' && (
        <div className="cm-modal p-8 text-center max-w-sm w-full">
          <Sparkles className="w-12 h-12 text-[#b88406] mx-auto mb-3 animate-spin" />
          <h2 className="text-lg font-black text-[#0b1f44] uppercase">{packName}</h2>
          <p className="text-xs text-[#566173] font-bold mt-1">Opening Scouting Dossiers...</p>
        </div>
      )}

      {stage === 'walkout' && (
        <div className="cm-modal p-6 flex flex-col items-center justify-center text-center max-w-md w-full">
          <div className="text-[#0b1f44] font-black text-base mb-3 uppercase flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#b88406]" />
            <span>Headlining Signing Reveal!</span>
            <Sparkles className="w-4 h-4 text-[#b88406]" />
          </div>
          <PlayerProfileCard card={bestCard} />
          <button
            type="button"
            onClick={() => setStage('summary')}
            className="cm-btn mt-4 text-xs"
          >
            Skip to Full Pack Summary ▸
          </button>
        </div>
      )}

      {stage === 'summary' && (
        <div className="cm-modal w-full max-w-4xl">
          <div className="cm-panel-header">
            <span>Scouting Report · {packName}</span>
            <button
              type="button"
              onClick={onClose}
              className="cm-btn py-0.5 px-2 text-xs"
              aria-label="Close pack summary"
            >
              <X className="w-3.5 h-3.5" /> Close
            </button>
          </div>

          <div className="cm-panel-body space-y-4">
            <div className="bg-white border border-[#b4bcc8] p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div>
                <strong className="text-[#0b1f44]">
                  {duplicateUpgrades > 0
                    ? `${cards.length} players scouted (${duplicateUpgrades} duplicate pulls trained existing contracts).`
                    : `${cards.length} new players added to your club roster.`}
                </strong>
              </div>
              <div className="font-mono font-bold text-[#0b1f44]">
                {spentCoins > 0 ? `Fee: 🪙 ${spentCoins.toLocaleString()} Coins` : 'Free Supply Pack'} · Treasury:{' '}
                <strong>🪙 {balanceAfter.toLocaleString()} Coins</strong>
              </div>
            </div>

            <div className="flex flex-wrap justify-center gap-3 max-h-[60vh] overflow-y-auto p-1">
              {cards.map((c, i) => (
                <PlayerProfileCard
                  key={c.id + i}
                  card={c}
                  compact={cards.length > 3}
                  onClick={() => sound.playClick()}
                />
              ))}
            </div>

            <div className="pt-3 border-t border-[#c4cbd6] flex justify-end">
              <button
                type="button"
                onClick={() => {
                  sound.playClick();
                  onClose();
                }}
                className="cm-btn cm-btn-primary px-6 py-2"
              >
                Confirm Signings &amp; Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
