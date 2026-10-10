import type { AramChampionUnit, ChampionSkill } from './types';

export function aetherisUltimateDurationAtRank(rank: number): number {
  return Math.min(8, Math.max(5, Math.floor(rank) + 4));
}

export function findAetherisInnateAlly(
  aetheris: Pick<AramChampionUnit, 'id' | 'team' | 'x' | 'y'>,
  allies: readonly AramChampionUnit[],
  range = 280
): AramChampionUnit | undefined {
  return allies
    .filter(ally => ally.isAlive && ally.id !== aetheris.id && ally.team === aetheris.team
      && Math.hypot(ally.x - aetheris.x, ally.y - aetheris.y) <= range)
    .sort((a, b) => Math.hypot(a.x - aetheris.x, a.y - aetheris.y)
      - Math.hypot(b.x - aetheris.x, b.y - aetheris.y)
      || a.id.localeCompare(b.id))[0];
}

export function abilityTargetingDetails(skill: ChampionSkill): string {
  switch (skill.targeting ?? 'unit') {
    case 'ground':
      return 'Ground-targeted: choose a position or direction; no enemy unit needs to be selected.';
    case 'ally':
      return 'Ally-targeted: point-and-click an allied avatar (the arena AI chooses an eligible ally).';
    case 'self':
      return 'Self-targeted: activates around the casting avatar.';
    case 'none':
      return 'No target required: activates on the casting avatar.';
    case 'unit':
      return 'Unit-targeted: point-and-click an eligible avatar; dodgeable projectiles can still miss.';
  }
}
