import type { PlayerCard, PlayerAttributes } from './types';

export interface WorldPlayerProfile {
  name: string;
  tier: 'Bronze';
  stats: PlayerAttributes;
  ovr: number;
  age: number;
  wage: number;
  potentialOvr: number;
  avatarSvg: string;
  nationality: {id: number; code: string; name: string};
}

const attributes = ['lan', 'tf', 'iq', 'ldr', 'clu', 'sta', 'flx'] as const;

/** Consume only server-pinned person attributes; catalog IDs/roles and kit mechanics stay intact. */
export function applyWorldPlayerProfile(template: PlayerCard, profile?: WorldPlayerProfile, legacyName?: string): PlayerCard {
  if (!profile) return legacyName ? {...template, name: legacyName} : template;
  if (!profile.name || profile.name.length > 100 || profile.tier !== 'Bronze' || !/^[A-Z]{2}$/.test(profile.nationality?.code ?? '')) {
    throw new Error('Invalid allocated world-player identity');
  }
  for (const key of attributes) {
    const value = profile.stats?.[key];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 1 || value > 99) throw new Error('Invalid allocated player skill');
  }
  if (!Number.isInteger(profile.ovr) || profile.ovr < 1 || profile.ovr > 99 || !Number.isInteger(profile.age) || profile.age < 18) {
    throw new Error('Invalid allocated player rating or age');
  }
  return {
    ...template,
    name: profile.name, tier: profile.tier, stats: {...profile.stats}, ovr: profile.ovr,
    age: profile.age, wage: profile.wage, potentialOvr: profile.potentialOvr,
    nationality: {...profile.nationality}, avatarSvg: profile.avatarSvg,
    badges: [], signatureChampions: [], level: 1, currentXp: 0, maxXp: 100,
    morale: 70, fatigue: 0, isEvo: false, evolutionLevel: 0, evolutionHistory: [],
  };
}
