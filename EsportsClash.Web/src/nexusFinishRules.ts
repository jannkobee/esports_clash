import { estimateStructureTimeToDestroy } from './structureSiegeRules.ts';

export interface NexusFinishAttacker {
  id: string;
  isAlive: boolean;
  hp: number;
  maxHp: number;
  distance: number;
  attackRange: number;
  structureAttackDamage: number;
  attacksPerSecond: number;
  approachSpeed: number;
}

export interface NexusFinishEvaluation {
  feasible: boolean;
  reason: 'NEXUS_UNAVAILABLE' | 'NO_AVAILABLE_ATTACKERS' | 'INSUFFICIENT_DAMAGE_WINDOW' | 'LETHAL_INCOMING_DAMAGE' | 'NEXUS_FINISH_READY';
  availableAttackers: number;
  estimatedFinishSeconds: number;
  estimatedSurvivalSeconds: number;
  contextKey: string;
}

/**
 * A deliberately small, deterministic finish check. It uses the same authored
 * basic-attack structure damage passed by the caller; it does not predict
 * champion abilities or create a second combat model.
 */
export function evaluateNexusFinish(input: {
  nexus: { id: string; isAlive: boolean; hp: number; maxHp: number; range: number; ad: number } | undefined;
  exposed: boolean;
  attackers: readonly NexusFinishAttacker[];
  actorId: string;
  nearbyDefenders: number;
  actorTakingNexusFire: boolean;
}): NexusFinishEvaluation {
  const unavailable = (reason: NexusFinishEvaluation['reason']) => ({
    feasible: false,
    reason,
    availableAttackers: 0,
    estimatedFinishSeconds: Infinity,
    estimatedSurvivalSeconds: 0,
    contextKey: `unavailable:${reason}`,
  });
  const nexus = input.nexus;
  if (!nexus?.isAlive || !input.exposed || nexus.maxHp <= 0) return unavailable('NEXUS_UNAVAILABLE');

  // A finish call is a nearby end-game opportunity, never permission to cross
  // the map through a dangerous base because a health bar happens to be low.
  const available = input.attackers.filter(attacker => attacker.isAlive && attacker.hp > 0
    && attacker.distance <= Math.max(attacker.attackRange, nexus.range) + 520
    && attacker.structureAttackDamage > 0 && attacker.attacksPerSecond > 0);
  if (available.length === 0) return unavailable('NO_AVAILABLE_ATTACKERS');

  const arrivals = available.map(attacker => Math.max(0, attacker.distance - attacker.attackRange)
    / Math.max(55, attacker.approachSpeed));
  const closestArrival = Math.min(...arrivals);
  const contributors = available.filter((_, index) => arrivals[index] <= closestArrival + 2.8);
  const estimatedFinishSeconds = closestArrival + estimateStructureTimeToDestroy(nexus.hp,
    contributors.map(attacker => ({ attackDamage: attacker.structureAttackDamage, attacksPerSecond: attacker.attacksPerSecond })),
    1, 1);

  const actor = available.find(attacker => attacker.id === input.actorId);
  if (!actor) return unavailable('NO_AVAILABLE_ATTACKERS');
  const actorArrival = Math.max(0, actor.distance - actor.attackRange) / Math.max(55, actor.approachSpeed);
  // The Nexus has five rapid 85-damage shots before reloading. This bounded
  // estimate deliberately errs on the safe side and only applies defender
  // pressure as a short, explainable margin rather than invented champion DPS.
  const incomingPerSecond = input.actorTakingNexusFire ? nexus.ad / 0.6 : 0;
  const defenderMargin = input.nearbyDefenders * 0.35;
  const estimatedSurvivalSeconds = incomingPerSecond > 0
    ? Math.max(0, actor.hp / incomingPerSecond - defenderMargin)
    : Infinity;
  const oneHitFinish = actor.structureAttackDamage >= nexus.hp;
  const survivalAllowsContribution = !input.actorTakingNexusFire
    || oneHitFinish || estimatedSurvivalSeconds >= Math.min(estimatedFinishSeconds, actorArrival + 1 / actor.attacksPerSecond);
  const feasible = Number.isFinite(estimatedFinishSeconds) && estimatedFinishSeconds <= 7.5
    && survivalAllowsContribution;
  const reason = !survivalAllowsContribution ? 'LETHAL_INCOMING_DAMAGE'
    : feasible ? 'NEXUS_FINISH_READY' : 'INSUFFICIENT_DAMAGE_WINDOW';
  const contextKey = [nexus.id, Math.ceil(nexus.hp / 250), contributors.map(attacker => attacker.id).sort().join(','),
    input.nearbyDefenders, Number(input.actorTakingNexusFire), reason].join(':');
  return { feasible, reason, availableAttackers: contributors.length, estimatedFinishSeconds,
    estimatedSurvivalSeconds, contextKey };
}
