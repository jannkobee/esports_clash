import type { ChampionKit, CoachCard, PlayerCard } from './types';

export type DraftSide = 'blue' | 'red';
export type DraftAction = 'ban' | 'pick';
export interface DraftTurn { side: DraftSide; action: DraftAction }
export interface DraftPick { slot: number; championId: string }
export interface DraftSnapshot {
  turnIndex: number;
  bans: Partial<Record<DraftSide, string>>;
  picks: Record<DraftSide, DraftPick[]>;
  blueRoster: PlayerCard[];
  redRoster: PlayerCard[];
  blueCoach: CoachCard;
  redCoach: CoachCard;
  seed: number;
  revision: number;
  roomCode?: string;
}
export function draftLineups(snapshot: DraftSnapshot, champions: ChampionKit[]) {
  const assignment = (side: DraftSide) => snapshot.picks[side].map(pick => ({
    player: (side === 'blue' ? snapshot.blueRoster : snapshot.redRoster)[pick.slot],
    champion: champions.find(champion => champion.id === pick.championId)!
  })).sort((a, b) => (side === 'blue' ? snapshot.blueRoster : snapshot.redRoster).indexOf(a.player)
    - (side === 'blue' ? snapshot.blueRoster : snapshot.redRoster).indexOf(b.player));
  return { blue: assignment('blue'), red: assignment('red') };
}
// One ban each, then the familiar snake pick order. The server uses this same order.
export const DRAFT_TURNS: DraftTurn[] = [
  { side: 'blue', action: 'ban' }, { side: 'red', action: 'ban' },
  { side: 'blue', action: 'pick' }, { side: 'red', action: 'pick' }, { side: 'red', action: 'pick' },
  { side: 'blue', action: 'pick' }, { side: 'blue', action: 'pick' },
  { side: 'red', action: 'pick' }, { side: 'red', action: 'pick' },
  { side: 'blue', action: 'pick' }, { side: 'blue', action: 'pick' }, { side: 'red', action: 'pick' }
];

export function draftTieBreak(championId: string, seed: number): number {
  let hash = (2166136261 ^ seed) >>> 0;
  for (const char of championId) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d) >>> 0;
  hash ^= hash >>> 15;
  return (hash >>> 0) / 0xffffffff * 20;
}

import { calculateCounterBonus, calculateSynergyBonus } from './avatarSynergyData.ts';

export function draftScore(
  champion: ChampionKit,
  player: PlayerCard,
  team: ChampionKit[],
  coach?: CoachCard,
  opponentTeam: ChampionKit[] = []
): number {
  const preferred = player.preferredRole ?? player.role;
  const isPlayablePrimary = player.playableRoles
    ? player.playableRoles.includes(champion.primaryRole)
    : champion.primaryRole === preferred;
  const isPlayableSecondary = player.playableRoles && champion.secondaryRole
    ? player.playableRoles.includes(champion.secondaryRole)
    : champion.secondaryRole === preferred;
  const roleFit = isPlayablePrimary ? 38 : isPlayableSecondary ? 22 : -28;
  const signature = player.signatureChampions.includes(champion.name)
    ? 10 + (player.stats?.flx ?? 50) / 20 + (coach?.playbookBonus ?? 0) / 5 : 0;
  const flexibility = (player.stats?.flx ?? 50) / 10;
  const teamRoles = new Set(team.flatMap(pick => [pick.primaryRole, pick.secondaryRole].filter(Boolean)));
  const neededRole = teamRoles.has(champion.primaryRole) ? 0 : 8;
  const archetype = champion.archetype.toLowerCase();
  const style = coach?.style ?? 'Dynamic Adapt';
  const frontline = champion.primaryRole === 'Tank' || champion.primaryRole === 'Fighter';
  const engage = /initiator|vanguard|control|brawler|hook|earth|bruiser/.test(archetype);
  const waveClear = champion.primaryRole === 'Mage' || champion.primaryRole === 'Marksman' || /flame|zone|ranged/.test(archetype);
  const poke = champion.range >= 5;
  const styleScore = style === 'Aggressive Dive' ? (frontline || champion.primaryRole === 'Assassin' ? 14 : 0) + (engage ? 7 : 0)
    : style === 'Objective Macro' ? (frontline ? 10 : 0) + (waveClear ? 9 : 0)
    : style === 'Scaling Poke' ? (poke ? 13 : 0) + (waveClear ? 7 : 0)
    : style === 'Pick & Burst' ? (champion.primaryRole === 'Assassin' ? 12 : 0) + (engage ? 9 : 0)
    : (engage ? 7 : 0) + (waveClear ? 7 : 0);
  const hasFrontline = team.some(pick => pick.primaryRole === 'Tank' || pick.primaryRole === 'Fighter');
  const hasWaveClear = team.some(pick => pick.primaryRole === 'Mage' || pick.primaryRole === 'Marksman');
  const composition = ((!hasFrontline && frontline ? 13 : 0) + (!hasWaveClear && waveClear ? 12 : 0))
    * (0.7 + (coach?.playbookBonus ?? 8) / 25);
  const teamfightFit = engage || champion.primaryRole === 'Support' ? (player.stats?.tf ?? 50) / 20 : 0;

  // Actual Data Counter-Pick and Wombo Synergy Intelligence
  const synergyScore = team.length > 0 ? calculateSynergyBonus(champion.id, team.map(t => t.id)) : 0;
  const counterScore = opponentTeam.length > 0 ? calculateCounterBonus(champion.id, opponentTeam.map(o => o.id)) : 0;

  return roleFit + signature + flexibility + neededRole + styleScore + composition + teamfightFit + synergyScore + counterScore;
}

function draftVariance(coach?: CoachCard) {
  return Math.max(0.5, 1.5 - ((coach?.playbookBonus ?? 8) + (coach?.chemistryBonus ?? 8)) / 35);
}

export function chooseCoachPick(champions: ChampionKit[], player: PlayerCard, team: ChampionKit[],
  unavailableIds: Iterable<string>, coach?: CoachCard, seed = 0, opponentTeam: ChampionKit[] = []): ChampionKit | undefined {
  const unavailable = new Set(unavailableIds);
  return champions.filter(champion => !unavailable.has(champion.id)).sort((a, b) => {
    const score = (champion: ChampionKit) => draftScore(champion, player, team, coach, opponentTeam)
      + draftTieBreak(champion.id, seed) * draftVariance(coach);
    return score(b) - score(a);
  })[0];
}

export function chooseCoachTeamPick(champions: ChampionKit[], roster: PlayerCard[], picks: DraftPick[],
  unavailableIds: Iterable<string>, coach?: CoachCard, seed = 0, opponentPicks: DraftPick[] = []): DraftPick | undefined {
  const unavailable = new Set(unavailableIds);
  const team = picks.map(pick => champions.find(champion => champion.id === pick.championId))
    .filter((champion): champion is ChampionKit => !!champion);
  const opponentTeam = opponentPicks.map(pick => champions.find(champion => champion.id === pick.championId))
    .filter((champion): champion is ChampionKit => !!champion);
  return roster.flatMap((player, slot) => picks.some(pick => pick.slot === slot) ? []
    : champions.filter(champion => !unavailable.has(champion.id)).map(champion => ({
      slot, championId: champion.id,
      score: draftScore(champion, player, team, coach, opponentTeam) + draftTieBreak(champion.id, seed + slot * 7) * draftVariance(coach)
    }))).sort((a, b) => b.score - a.score)[0];
}

export function chooseCoachBan(champions: ChampionKit[], opponents: PlayerCard[],
  unavailableIds: Iterable<string>, seed = 0): ChampionKit | undefined {
  const unavailable = new Set(unavailableIds);
  return champions.filter(champion => !unavailable.has(champion.id)).sort((a, b) => {
    const threat = (champion: ChampionKit) => Math.max(...opponents.map(player =>
      (player.preferredRole === champion.primaryRole ? 15 : 0)
      + (player.signatureChampions.includes(champion.name) ? 20 : 0)
      + (player.stats?.tf ?? 50) / 5))
      + (Math.sin(seed + champion.id.length * 17 + champion.name.charCodeAt(0)) + 1) * 4;
    return threat(b) - threat(a);
  })[0];
}

export function isChampionAvailable(championId: string, playerId: string, selections: Record<string, string>, bannedIds: (string | null)[]): boolean {
  return !bannedIds.includes(championId) && !Object.entries(selections).some(([owner, id]) => owner !== playerId && id === championId);
}

export function buildUniqueLineups(
  startingFive: PlayerCard[], opponentRoster: PlayerCard[], champions: ChampionKit[],
  selections: Record<string, string>, bannedIds: (string | null)[]
) {
  const available = champions.filter(c => !bannedIds.includes(c.id));
  if (available.length < startingFive.length + Math.min(5, opponentRoster.length)) {
    throw new Error('The draft needs at least one available champion per player.');
  }
  const used = new Set<string>();
  const blue = startingFive.map(player => {
    const selected = available.find(c => c.id === selections[player.id] && !used.has(c.id));
    const champion = selected ?? available.find(c => !used.has(c.id) && player.signatureChampions.includes(c.name))
      ?? available.find(c => !used.has(c.id) && c.primaryRole === player.preferredRole)
      ?? available.find(c => !used.has(c.id))!;
    used.add(champion.id);
    return { player, champion };
  });
  const red = opponentRoster.slice(0, 5).map(player => {
    const fitsRole = (champion: ChampionKit) => champion.primaryRole === player.preferredRole || champion.secondaryRole === player.preferredRole;
    const champion = available.find(c => !used.has(c.id) && fitsRole(c) && player.signatureChampions.includes(c.name))
      ?? available.find(c => !used.has(c.id) && fitsRole(c))
      ?? available.find(c => !used.has(c.id) && player.signatureChampions.includes(c.name))
      ?? available.find(c => !used.has(c.id))!;
    used.add(champion.id);
    return { player, champion };
  });
  return { blue, red };
}
