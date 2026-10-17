// Predeclared evaluation rule; never used by the live action selector.
export function assessPairedOutcome(incumbent, alternate) {
  const a = incumbent?.event?.followup;
  const b = alternate?.event?.followup;
  if (!a?.actor || !a.team || !b?.actor || !b.team) return { classification: 'missing-metrics' };
  const delta = {
    alive: Number(b.actor.isAlive) - Number(a.actor.isAlive),
    healthFraction: b.actor.hpFraction - a.actor.hpFraction,
    structureMargin: (b.team.ownStructureHp - b.team.enemyStructureHp)
      - (a.team.ownStructureHp - a.team.enemyStructureHp),
    dragonAspect: Number(b.team.dragonAspect) - Number(a.team.dragonAspect),
    siegeGolemUnits: b.team.siegeGolemUnits - a.team.siegeGolemUnits,
    economicValue: b.actor.economicValue - a.actor.economicValue,
    gold: b.actor.gold - a.actor.gold,
    damageDealt: b.actor.damageDealt - a.actor.damageDealt,
  };
  if (Object.values(delta).some(value => !Number.isFinite(value)))
    return { classification: 'missing-metrics' };
  if (delta.alive !== 0) return { classification: delta.alive > 0
    ? 'survival-improved' : 'survival-worsened', delta };
  if (!a.actor.isAlive) return { classification: 'both-dead', delta };
  const thresholded = {
    healthFraction: Math.abs(delta.healthFraction) >= 0.05 ? Math.sign(delta.healthFraction) : 0,
    structureMargin: Math.abs(delta.structureMargin) >= 100 ? Math.sign(delta.structureMargin) : 0,
    dragonAspect: Math.sign(delta.dragonAspect),
    siegeGolemUnits: Math.sign(delta.siegeGolemUnits),
    economicValue: Math.abs(delta.economicValue) >= 50 ? Math.sign(delta.economicValue) : 0,
  };
  const values = Object.values(thresholded);
  const favorable = values.some(value => value > 0);
  const unfavorable = values.some(value => value < 0);
  const classification = favorable && unfavorable ? 'mixed' : favorable ? 'better'
    : unfavorable ? 'worse' : 'no-material-difference';
  return { classification, delta, thresholded };
}
