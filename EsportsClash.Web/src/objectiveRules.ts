export interface ObjectiveSituation {
  gameSeconds: number;
  bossHealthFraction: number;
  healthyAllies: number;
  nearbyEnemies: number;
  lanePriority: boolean;
  hasVision: boolean;
  averageIq: number;
  averageTeamfight: number;
  chemistry: number;
  coachPlaybook: number;
  actorHealthFraction: number;
}

// A side earns an objective window by pushing first, controlling vision and
// bringing enough healthy players. Ratings affect recognition, not a timer alone.
export function shouldStartEpicObjective(s: ObjectiveSituation): boolean {
  if (s.gameSeconds < 105 || s.actorHealthFraction < 0.58 || s.healthyAllies < 3) return false;
  if (!s.lanePriority || !s.hasVision || s.nearbyEnemies > 1) return false;
  const macro = s.averageIq * 0.43 + s.averageTeamfight * 0.29
    + Math.min(99, s.chemistry * 4) * 0.16 + Math.min(99, s.coachPlaybook * 5) * 0.12;
  const finishOpportunity = s.bossHealthFraction < 0.4 && s.nearbyEnemies === 0;
  return macro >= (finishOpportunity ? 60 : 72);
}

export interface ObjectiveContestSituation {
  gameSeconds: number;
  bossHealthFraction: number;
  healthyAllies: number;
  enemiesAtBoss: number;
  hasVisionOfPit: boolean;
  hasShotcaller?: boolean;
  hasStealSpecialist?: boolean;
  averageIq: number;
  averageTeamfight: number;
  chemistry: number;
  actorHealthFraction: number;
  isDragon: boolean;
}

// Evaluates whether a team should regroup immediately and contest when the other team is doing an objective.
export function shouldContestOpponentObjective(s: ObjectiveContestSituation): boolean {
  // If team has no vision of the pit or enemies in it, they cannot know
  if (!s.hasVisionOfPit) return false;
  // If the deciding unit is near death, it shouldn't suicide unless a steal specialist
  if (s.actorHealthFraction < 0.28 && !s.hasStealSpecialist) return false;
  // Need at least 2 healthy players available to contest (or a steal specialist)
  if (s.healthyAllies < 2 && !s.hasStealSpecialist) return false;

  const contestUrgency = s.bossHealthFraction < 0.55 ? 1.35 : 1.0;
  const shotcallBonus = s.hasShotcaller ? 12 : 0;
  const stealBonus = s.hasStealSpecialist ? 14 : 0;
  const dragonBonus = s.isDragon ? 8 : 0;
  const macro = (s.averageIq * 0.40 + s.averageTeamfight * 0.35 + Math.min(99, s.chemistry * 4) * 0.25) * contestUrgency
    + shotcallBonus + stealBonus + dragonBonus;

  return macro >= 52;
}

// Evaluates whether a team possesses vision of an epic objective pit.
export function hasObjectiveVision(
  team: 'blue' | 'red',
  objective: { x: number; y: number; isAlive: boolean },
  allies: { x: number; y: number; isAlive: boolean }[],
  enemies: { x: number; y: number; isAlive: boolean; isInBush?: boolean; revealedTimer?: number }[],
  wards: { team: 'blue' | 'red'; x: number; y: number }[]
): boolean {
  if (!objective.isAlive) return false;
  // 1. Any allied champion near the pit (within 440px)
  if (allies.some(a => a.isAlive && Math.hypot(a.x - objective.x, a.y - objective.y) <= 440)) {
    return true;
  }
  // 2. Any allied ward covering the pit (within 320px)
  if (wards.some(w => w.team === team && Math.hypot(w.x - objective.x, w.y - objective.y) <= 320)) {
    return true;
  }
  // 3. Any visible enemy inside the pit (within 320px of objective)
  if (enemies.some(e => e.isAlive && Math.hypot(e.x - objective.x, e.y - objective.y) <= 320 && (!e.isInBush || (e.revealedTimer ?? 0) > 0))) {
    return true;
  }
  return false;
}
