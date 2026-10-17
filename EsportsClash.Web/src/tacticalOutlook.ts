export type TacticalPoint = { x: number; y: number };

export interface TacticalOutlook {
  /** Estimated seconds to reach the existing candidate's authored interaction range. */
  travelSeconds: number;
  /** Bounded local survival confidence; this is not a damage simulator. */
  survival: number;
  /** Bounded confidence that nearby legal allies can sustain pressure. */
  support: number;
  /** Bounded target-pressure opportunity based on existing visible state. */
  pressure: number;
}

const clamp = (value: number) => Math.max(0, Math.min(1, value));

/**
 * A short, deterministic ranking read. It deliberately does not predict fog,
 * casts, RNG, cooldown outcomes, damage values, or movement execution.
 */
export function estimateTacticalOutlook(input: {
  actor: TacticalPoint & { hp: number; maxHp: number };
  target: TacticalPoint & { hp: number; maxHp: number };
  travelSpeed: number;
  interactionRange: number;
  nearbyAllies: number;
  nearbyEnemies: number;
  approachThreat: number;
  approachCover: number;
}): TacticalOutlook {
  const distance = Math.hypot(input.target.x - input.actor.x, input.target.y - input.actor.y);
  const travelSeconds = Math.max(0, distance - Math.max(0, input.interactionRange)) / Math.max(60, input.travelSpeed);
  const actorHealth = clamp(input.actor.hp / Math.max(1, input.actor.maxHp));
  const targetHealth = clamp(input.target.hp / Math.max(1, input.target.maxHp));
  const allyEdge = clamp((input.nearbyAllies - input.nearbyEnemies + 3) / 6);
  const threat = clamp(input.approachThreat);
  const cover = clamp(input.approachCover);
  return {
    travelSeconds,
    survival: clamp(actorHealth * .5 + cover * .3 + allyEdge * .2 - threat * .45 - Math.min(.2, travelSeconds * .04)),
    support: clamp(allyEdge * .65 + cover * .35),
    pressure: clamp((1 - targetHealth) * .5 + allyEdge * .25 + cover * .15 - threat * .2 - Math.min(.2, travelSeconds * .03)),
  };
}
