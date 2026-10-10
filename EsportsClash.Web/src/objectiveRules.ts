import type { CoachCard, PlayerCard } from './types';
import { hasPlayerTrait } from './playerTraits.ts';

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
  // A specialist may take a last-hit risk only when the monster is nearly finished.
  const lastHitWindow = s.hasStealSpecialist && s.bossHealthFraction <= 0.24
    && s.actorHealthFraction >= 0.15;
  if (lastHitWindow) return true;
  if (s.actorHealthFraction < 0.28 || s.healthyAllies < 2) return false;
  if (s.enemiesAtBoss > s.healthyAllies + 1 && s.bossHealthFraction > 0.35) return false;

  const contestUrgency = s.bossHealthFraction < 0.55 ? 1.35 : 1.0;
  const dragonBonus = s.isDragon ? 8 : 0;
  const macro = (s.averageIq * 0.40 + s.averageTeamfight * 0.35 + Math.min(99, s.chemistry * 4) * 0.25) * contestUrgency
    + dragonBonus;

  // A caller can bring a ready group in earlier, without changing any unit's stats.
  return (s.hasShotcaller && s.healthyAllies >= s.enemiesAtBoss && macro >= 48) || macro >= 52;
}

// Ratings and PlayStyles shape decisions, never the damage dealt to an objective.
export function objectiveFightPreference(players: PlayerCard[], coach?: CoachCard, actor?: PlayerCard): number {
  if (players.length === 0) return 0;
  const cardPreference = (player: PlayerCard) => {
    const { iq, tf, clu } = player.stats;
    return (tf - iq) * 0.38 + (clu - 75) * 0.1
      + (hasPlayerTrait(player, 'Aggro Diver') ? 10 : 0)
      + (hasPlayerTrait(player, 'One-Tap God') ? 9 : 0)
      + (hasPlayerTrait(player, 'Clutch King') ? 5 : 0)
      - (hasPlayerTrait(player, 'Baron Steal') ? 12 : 0)
      - (hasPlayerTrait(player, 'Vision Master') ? 7 : 0)
      - (hasPlayerTrait(player, 'Laning Demon') ? 5 : 0);
  };
  const average = players.reduce((sum, player) => sum + cardPreference(player), 0) / players.length;
  const caller = players.find(player => hasPlayerTrait(player, 'Shotcaller'));
  const teamVoice = caller ? average * 0.45 + cardPreference(caller) * 0.55 : average;
  const individualVoice = actor && !caller ? cardPreference(actor) * 0.25 : 0;
  const coachVoice = coach?.style === 'Aggressive Dive' ? 12
    : coach?.style === 'Pick & Burst' ? 9
    : coach?.style === 'Objective Macro' ? -9
    : coach?.style === 'Scaling Poke' ? -5 : 0;
  return teamVoice + individualVoice + coachVoice;
}

export interface ObjectiveActionSituation {
  bossHealthFraction: number;
  hasVision: boolean;
  contestedByEnemy: boolean;
  enemyStartedFight: boolean;
  fightPreference: number;
}

export function chooseObjectiveAction(s: ObjectiveActionSituation): 'finish' | 'fight' | 'none' {
  if (!s.hasVision) return 'none';
  // A near-finished objective is the call for both the holder and a potential stealer.
  if (s.bossHealthFraction <= 0.32) return 'finish';
  // The side already taking it only turns when opponents actually attack champions.
  if (s.enemyStartedFight) return 'fight';
  return s.contestedByEnemy && s.fightPreference >= 6 ? 'fight' : 'finish';
}

export function choosePostObjectiveAction(s: {
  fightPreference: number;
  nearbyEnemies: number;
  healthyAllies: number;
  healthyEnemies: number;
  averageHealthFraction: number;
}): 'fight' | 'regroup' {
  if (s.nearbyEnemies === 0 || s.healthyAllies === 0 || s.averageHealthFraction < 0.4) return 'regroup';
  const advantage = s.healthyAllies - s.healthyEnemies;
  return s.fightPreference + advantage * 3 + (s.averageHealthFraction - 0.6) * 15 >= 7
    ? 'fight' : 'regroup';
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
