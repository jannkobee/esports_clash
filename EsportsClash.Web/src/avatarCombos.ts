import type { PlayerCard } from './types';

export type ComboSkill = 'skill1' | 'skill2';
export interface AvatarCombo { name: string; opener: ComboSkill; followup: ComboSkill }

// Each avatar has its own engage order. The ultimate is the finisher after both steps connect.
export const AVATAR_COMBOS: Record<string, AvatarCombo> = {
  Solana: { name: 'Solar Lockdown', opener: 'skill2', followup: 'skill1' },
  Astra: { name: 'Frost Volley', opener: 'skill2', followup: 'skill1' },
  Kyumi: { name: 'Foxfire Catch', opener: 'skill2', followup: 'skill1' },
  Buck: { name: 'Smoke and Powder', opener: 'skill2', followup: 'skill1' },
  Valkira: { name: 'Iron Crescent', opener: 'skill2', followup: 'skill1' },
  Kage: { name: 'Shadow Cut', opener: 'skill2', followup: 'skill1' },
  Kazemaru: { name: 'Tempest Breath', opener: 'skill1', followup: 'skill2' },
  Kindra: { name: 'Spectral Hunt', opener: 'skill2', followup: 'skill1' },
  Cora: { name: 'Feather Trap', opener: 'skill1', followup: 'skill2' },
  Renn: { name: 'Feather Dive', opener: 'skill2', followup: 'skill1' },
  Sylla: { name: 'Bear Rush', opener: 'skill2', followup: 'skill1' },
  Tequoia: { name: 'Living Cage', opener: 'skill1', followup: 'skill2' },
  Zal: { name: 'Venom Wave', opener: 'skill1', followup: 'skill2' },
  Xin: { name: 'Flame Chains', opener: 'skill1', followup: 'skill2' },
  Raijin: { name: 'Vortex Remnant', opener: 'skill2', followup: 'skill1' },
  Kaolin: { name: 'Boulder Crash', opener: 'skill2', followup: 'skill1' },
  Inai: { name: 'Void Ambush', opener: 'skill2', followup: 'skill1' },
  Qiyana: { name: 'Elemental Crown', opener: 'skill2', followup: 'skill1' },
  Locke: { name: 'Ashen Pursuit', opener: 'skill2', followup: 'skill1' },
  Senna: { name: 'Mist Snare', opener: 'skill2', followup: 'skill1' },
  Largo: { name: 'Frog Chorus', opener: 'skill2', followup: 'skill1' },
  'Shadow Fiend': { name: 'Soul Requiem', opener: 'skill2', followup: 'skill1' },
  Earthshaker: { name: 'Seismic Echo', opener: 'skill1', followup: 'skill2' },
};

export function comboPracticeNeeded(player: PlayerCard, avatarName: string): number | null {
  const mechanics = player.stats.lan * 0.45 + player.stats.tf * 0.4 + player.stats.flx * 0.15;
  if (mechanics < 77 || player.stats.iq < 55 || !AVATAR_COMBOS[avatarName]) return null;
  const signatureBonus = player.signatureChampions.includes(avatarName) ? 1 : 0;
  return Math.max(2, Math.ceil((100 - mechanics) / 8) + 1 - signatureBonus);
}
