import type { AramChampionUnit, LaneStructure } from './types';

// Read the same kill records shown in the player rows. Neutral and structure
// deaths have no champion kill credit and therefore do not change this score.
export function getTeamKillScore(units: readonly Pick<AramChampionUnit, 'team' | 'kills'>[]) {
  return units.reduce((score, unit) => {
    score[unit.team] += unit.kills;
    return score;
  }, { blue: 0, red: 0 });
}

// Calculate team total net worth (gold in purse + value of all purchased equipment).
// Each 5-player squad begins with 7,500g (5 players x 1,500g starting gold).
export function getTeamTotalGold(
  units: readonly (Pick<AramChampionUnit, 'team' | 'gold' | 'items'> & Partial<Pick<AramChampionUnit, 'boots'>>)[],
  team: 'blue' | 'red'
): number {
  const teamUnits = units.filter((u) => u.team === team);
  if (teamUnits.length === 0) return 7500;

  return teamUnits.reduce((total, u) => {
    const itemsValue = (u.items || []).reduce((itemSum, it) => itemSum + (it?.cost || 0), 0);
    return total + Math.round((u.gold || 0) + itemsValue + (u.boots?.cost ?? 0));
  }, 0);
}

// Count remaining living defense towers for a team (Outer, Inner, Nexus towers).
export function getTowersAliveCount(
  structures: readonly Pick<LaneStructure, 'team' | 'type' | 'isAlive'>[],
  team: 'blue' | 'red'
): number {
  return structures.filter((st) => st.team === team && st.type.includes('tower') && st.isAlive).length;
}

// Resolve team display names cleanly without hardcoded mismatches.
export function getTeamNames(options: {
  blueTeamName?: string;
  redTeamName?: string;
  opponentName?: string;
}): { blue: string; red: string } {
  return {
    blue: options.blueTeamName || 'T-CHIBI SQUAD',
    red: options.opponentName || options.redTeamName || 'RIVAL CHIBI SQUAD'
  };
}
