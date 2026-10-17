import { nextNexusVolleyShot } from './arenaRules.ts';

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
  attackReadyIn?: number;
  incomingDamage?: number;
  approachSafe?: boolean;
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
  nexus: { id: string; isAlive: boolean; hp: number; maxHp: number; range: number; ad: number;
    attackTimer?: number; volleyShotsRemaining?: number; volleyActive?: boolean } | undefined;
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
    && attacker.approachSafe !== false
    && attacker.distance <= Math.max(attacker.attackRange, nexus.range) + 520
    && attacker.structureAttackDamage > 0 && attacker.attacksPerSecond > 0);
  if (available.length === 0) return unavailable('NO_AVAILABLE_ATTACKERS');

  const arrivals = available.map(attacker => Math.max(0, attacker.distance - attacker.attackRange)
    / Math.max(1, attacker.approachSpeed));
  const closestArrival = Math.min(...arrivals);
  const contributors = available.filter((_, index) => arrivals[index] <= closestArrival + 2.8);
  const actor = available.find(attacker => attacker.id === input.actorId);
  if (!actor) return unavailable('NO_AVAILABLE_ATTACKERS');
  // An idle Nexus does not spend its remaining pulses on empty ground.
  const fireStartsIn = nexus.volleyActive === false ? Math.min(...available.map(attacker =>
    attacker.distance <= nexus.range ? 0 : attacker.attackRange > nexus.range ? Infinity
      : (attacker.distance - nexus.range) / Math.max(1, attacker.approachSpeed))) : 0;

  // Forecast the existing five-pulse/reload schedule before entering range.
  // Nexus pulses can hit the entire five-player group, so minions/teammates do
  // not divide this damage. Nearby defenders add only the existing time margin.
  const survival = (attacker: NexusFinishAttacker, defenderMargin = true) => {
    let hp = attacker.hp - (attacker.incomingDamage ?? 0);
    if (hp <= 0) return 0;
    if (attacker.distance > nexus.range && attacker.attackRange > nexus.range) return Infinity;
    const entry = Math.max(0, attacker.distance - nexus.range) / Math.max(1, attacker.approachSpeed);
    let at = Math.max(0, nexus.attackTimer ?? 0, fireStartsIn);
    let shots = nexus.volleyShotsRemaining ?? 5;
    for (let pulse = 0; pulse < 60 && at <= 15; pulse++) {
      if (at >= entry) {
        hp -= nexus.ad;
        if (hp <= 0) return Math.max(0, at - (defenderMargin ? input.nearbyDefenders * .35 : 0));
      }
      const next = nextNexusVolleyShot(shots);
      at += next.cooldown;
      shots = next.shotsRemaining;
    }
    return Infinity;
  };
  const firstHit = (attacker: NexusFinishAttacker) => Math.max(0, attacker.distance - attacker.attackRange)
    / Math.max(1, attacker.approachSpeed) + Math.max(.25, attacker.attackReadyIn ?? 0);
  const immediateFinish = actor.structureAttackDamage >= nexus.hp && firstHit(actor) < survival(actor, false);
  const events = contributors.flatMap(attacker => {
    const aliveUntil = survival(attacker);
    const hits: { at: number; damage: number }[] = [];
    for (let hit = 0, at = firstHit(attacker); hit < 100 && at <= 7.5 && at < aliveUntil;
      hit++, at += 1 / attacker.attacksPerSecond) hits.push({ at, damage: attacker.structureAttackDamage });
    return hits;
  }).sort((a, b) => a.at - b.at);
  let remainingHp = nexus.hp;
  let estimatedFinishSeconds = Infinity;
  for (const hit of events) {
    remainingHp -= hit.damage;
    if (remainingHp <= 0) { estimatedFinishSeconds = hit.at; break; }
  }
  if (immediateFinish) estimatedFinishSeconds = Math.min(estimatedFinishSeconds, firstHit(actor));
  const estimatedSurvivalSeconds = survival(actor, !immediateFinish);
  const survivalAllowsContribution = firstHit(actor) < estimatedSurvivalSeconds
    && (!Number.isFinite(estimatedFinishSeconds) || estimatedFinishSeconds < estimatedSurvivalSeconds);
  const feasible = Number.isFinite(estimatedFinishSeconds) && estimatedFinishSeconds <= 7.5
    && firstHit(actor) <= estimatedFinishSeconds && survivalAllowsContribution;
  const reason = !survivalAllowsContribution ? 'LETHAL_INCOMING_DAMAGE'
    : feasible ? 'NEXUS_FINISH_READY' : 'INSUFFICIENT_DAMAGE_WINDOW';
  const contextKey = [nexus.id, Math.ceil(nexus.hp / 250), contributors.map(attacker => attacker.id).sort().join(','),
    input.nearbyDefenders, Number(input.actorTakingNexusFire), reason].join(':');
  return { feasible, reason, availableAttackers: contributors.length, estimatedFinishSeconds,
    estimatedSurvivalSeconds, contextKey };
}
