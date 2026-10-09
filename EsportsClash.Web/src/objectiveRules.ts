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
