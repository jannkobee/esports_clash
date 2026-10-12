export type EngagementTeam = 'blue' | 'red';

export interface EngagementUnit {
  id: string;
  team: EngagementTeam;
  isAlive: boolean;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  combatTimer?: number;
}

export interface EngagementSnapshot {
  id: number;
  startedAt: number;
  lastContactAt: number;
  livingByTeam: Record<EngagementTeam, number>;
  participantIds: Record<EngagementTeam, string[]>;
  healthByTeam: Record<EngagementTeam, number>;
  laneXByTeam: Record<EngagementTeam, number>;
}

export interface EngagementObservation {
  next?: EngagementSnapshot;
  failedTeams: EngagementTeam[];
  endedByDeath?: boolean;
}

const TEAMS: EngagementTeam[] = ['blue', 'red'];
const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);

function teamState(units: EngagementUnit[], team: EngagementTeam, participantIds?: string[]) {
  const living = units.filter(unit => unit.team === team && unit.isAlive
    && (!participantIds || participantIds.includes(unit.id)));
  return {
    living: living.length,
    health: average(living.map(unit => unit.hp / Math.max(1, unit.maxHp))),
    laneX: average(living.map(unit => unit.x)),
  };
}

function hasObservedGroupContact(units: EngagementUnit[]): boolean {
  const engaged = units.filter(unit => unit.isAlive && (unit.combatTimer ?? 0) > 0);
  return TEAMS.every(team => engaged.filter(unit => unit.team === team).length >= 2)
    && engaged.some(left => engaged.some(right => left.team !== right.team
      && Math.hypot(left.x - right.x, left.y - right.y) <= 460));
}

/**
 * Detects a real, inconclusive multi-player fight that has ended in a damaged
 * team's visible withdrawal. It deliberately ignores single trades, deaths,
 * ordinary movement, and unobserved opponents.
 */
export function observeEngagementOutcome(
  units: EngagementUnit[],
  now: number,
  previous: EngagementSnapshot | undefined,
  nextId: number,
): EngagementObservation {
  const inContact = hasObservedGroupContact(units);
  if (!previous) {
    if (!inContact) return { failedTeams: [] };
    const engaged = units.filter(unit => unit.isAlive && (unit.combatTimer ?? 0) > 0);
    const participantIds = Object.fromEntries(TEAMS.map(team => [team,
      engaged.filter(unit => unit.team === team).map(unit => unit.id)])) as Record<EngagementTeam, string[]>;
    const state = Object.fromEntries(TEAMS.map(team => [team, teamState(units, team, participantIds[team])])) as Record<EngagementTeam, ReturnType<typeof teamState>>;
    return {
      next: {
        id: nextId,
        startedAt: now,
        lastContactAt: now,
        livingByTeam: { blue: state.blue.living, red: state.red.living },
        participantIds,
        healthByTeam: { blue: state.blue.health, red: state.red.health },
        laneXByTeam: { blue: state.blue.laneX, red: state.red.laneX },
      },
      failedTeams: [],
    };
  }

  if (inContact) return { next: { ...previous, lastContactAt: now }, failedTeams: [] };
  // Keep the tracker alive briefly so normal ability spacing does not count as a disengage.
  if (now - previous.lastContactAt < 3.4 || now - previous.startedAt < 3.5) {
    return { next: previous, failedTeams: [] };
  }

  const current = Object.fromEntries(TEAMS.map(team => [team,
    teamState(units, team, previous.participantIds[team])])) as Record<EngagementTeam, ReturnType<typeof teamState>>;
  if (TEAMS.some(team => current[team].living < previous.livingByTeam[team])) {
    return { failedTeams: [], endedByDeath: true };
  }
  const failedTeams = TEAMS.filter(team => {
    const healthLoss = previous.healthByTeam[team] - current[team].health;
    const retreatDistance = team === 'blue'
      ? previous.laneXByTeam[team] - current[team].laneX
      : current[team].laneX - previous.laneXByTeam[team];
    return healthLoss >= 0.08 && retreatDistance >= 55;
  });
  return { failedTeams };
}
