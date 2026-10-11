export type RetreatTeam = 'blue' | 'red';
export type RetreatPoint = { x: number; y: number };

export type RetreatDestinationKind = 'home-lane' | 'allied-tower' | 'teammate' | 'open-ground' | 'fountain' | 'bush';

export type RetreatPlan = RetreatPoint & {
  id: string;
  kind: RetreatDestinationKind;
  committedUntil: number;
};

type RetreatActor = RetreatPoint & {
  id: string;
  team: RetreatTeam;
  healthFraction: number;
  iq: number;
  teamfight: number;
  hasEscapeAbility: boolean;
};

type RetreatUnit = RetreatPoint & { id: string; team: RetreatTeam; healthFraction: number; isAlive: boolean };
type RetreatStructure = RetreatPoint & { id: string; team: RetreatTeam; type: string; range: number; isAlive: boolean };
type RetreatBush = RetreatPoint & { id: string };

export type RetreatRoutingInput = {
  actor: RetreatActor;
  now: number;
  laneY: number;
  well: RetreatPoint;
  enemies: readonly RetreatUnit[];
  allies: readonly RetreatUnit[];
  structures: readonly RetreatStructure[];
  bushes: readonly RetreatBush[];
  isPassable: (point: RetreatPoint) => boolean;
  routeLength: (from: RetreatPoint, to: RetreatPoint) => number;
};

type ScoredDestination = RetreatPoint & { id: string; kind: RetreatDestinationKind; score: number };

const distance = (a: RetreatPoint, b: RetreatPoint) => Math.hypot(a.x - b.x, a.y - b.y);
const towardHome = (team: RetreatTeam) => team === 'blue' ? -1 : 1;

function enemyDistance(point: RetreatPoint, enemies: readonly RetreatUnit[]): number {
  const distances = enemies.filter(enemy => enemy.isAlive).map(enemy => distance(point, enemy));
  return distances.length ? Math.min(...distances) : Infinity;
}

function isEnemyTowerSafe(point: RetreatPoint, actor: RetreatActor, structures: readonly RetreatStructure[]): boolean {
  return !structures.some(structure => structure.isAlive && structure.team !== actor.team
    && distance(point, structure) <= structure.range + 50);
}

/** This is deliberately strict: IQ/TF influence ranking, never this safety gate. */
export function isRetreatDestinationSafe(
  point: RetreatPoint,
  actor: RetreatActor,
  enemies: readonly RetreatUnit[],
  structures: readonly RetreatStructure[],
  isPassable: (point: RetreatPoint) => boolean,
): boolean {
  if (!isPassable(point) || !isEnemyTowerSafe(point, actor, structures)) return false;
  const minimumEnemyDistance = actor.healthFraction < 0.35 ? 220 : 150;
  return enemyDistance(point, enemies) >= minimumEnemyDistance;
}

function candidates(input: RetreatRoutingInput): Omit<ScoredDestination, 'score'>[] {
  const { actor, laneY, well, allies, structures, bushes } = input;
  const home = towardHome(actor.team);
  const homeLaneX = Math.max(90, Math.min(2510, actor.x + home * 280));
  const openLaneX = Math.max(90, Math.min(2510, actor.x + home * 180));
  const base: Omit<ScoredDestination, 'score'>[] = [
    { id: 'home-lane', kind: 'home-lane', x: homeLaneX, y: laneY },
    { id: 'open-ground', kind: 'open-ground', x: openLaneX, y: laneY + (actor.y - laneY) * 0.35 },
    { id: 'fountain', kind: 'fountain', x: well.x, y: well.y },
  ];

  structures.filter(structure => structure.isAlive && structure.team === actor.team
    && structure.type !== 'nexus')
    .sort((a, b) => distance(actor, a) - distance(actor, b))
    .slice(0, 2)
    .forEach(structure => base.push({
      id: `tower:${structure.id}`,
      kind: 'allied-tower',
      x: structure.x + home * Math.max(62, structure.range * 0.26),
      y: laneY + (actor.y - laneY) * 0.25,
    }));

  allies.filter(ally => ally.isAlive && ally.id !== actor.id && ally.healthFraction >= 0.48
    && home * (ally.x - actor.x) >= 45)
    .sort((a, b) => distance(actor, a) - distance(actor, b))
    .slice(0, 2)
    .forEach(ally => base.push({ id: `ally:${ally.id}`, kind: 'teammate', x: ally.x, y: ally.y }));

  bushes.forEach(bush => base.push({ id: `bush:${bush.id}`, kind: 'bush', x: bush.x, y: bush.y }));
  return base;
}

function score(candidate: Omit<ScoredDestination, 'score'>, input: RetreatRoutingInput, route: number): number {
  const { actor, enemies } = input;
  const enemyGap = enemyDistance(candidate, enemies);
  const healthUrgency = 0.65 + (1 - actor.healthFraction) * 1.35;
  const safetyCost = Number.isFinite(enemyGap) ? (330 * healthUrgency) / Math.max(90, enemyGap) : 0;
  const routeCost = route / (actor.healthFraction < 0.4 ? 42 : 31);
  const homeProgress = towardHome(actor.team) * (candidate.x - actor.x);
  const progressBonus = homeProgress > 0 ? -Math.min(14, homeProgress / 34) : 14;
  const iq = Math.max(1, Math.min(99, actor.iq));
  const teamfight = Math.max(1, Math.min(99, actor.teamfight));
  const kindBias: Record<RetreatDestinationKind, number> = {
    'home-lane': -13 - iq * 0.04,
    'allied-tower': -10 - teamfight * 0.06,
    teammate: -4 - teamfight * 0.08,
    'open-ground': 0,
    fountain: 8,
    // Bushes are cover only, never the default destination. A high-IQ card can
    // value a safe close bush when pressure is immediate, but not bypass safety.
    bush: 34 - (enemyGap < 300 ? iq * 0.16 : 0),
  };
  const escapeBonus = actor.hasEscapeAbility && candidate.kind !== 'bush' ? -4 : 0;
  return safetyCost + routeCost + progressBonus + kindBias[candidate.kind] + escapeBonus;
}

export function chooseRetreatPlan(input: RetreatRoutingInput): RetreatPlan | undefined {
  const ranked = candidates(input)
    .filter(candidate => isRetreatDestinationSafe(candidate, input.actor, input.enemies, input.structures, input.isPassable))
    .map(candidate => ({ ...candidate, route: input.routeLength(input.actor, candidate) }))
    .filter(candidate => Number.isFinite(candidate.route) && candidate.route > 0)
    .map(candidate => ({ ...candidate, score: score(candidate, input, candidate.route) }))
    .sort((a, b) => a.score - b.score || a.route - b.route || a.id.localeCompare(b.id));
  const chosen = ranked[0];
  if (!chosen) return undefined;
  const commitment = 0.65 + Math.max(0, Math.min(0.3, input.actor.iq / 330));
  return { id: chosen.id, kind: chosen.kind, x: chosen.x, y: chosen.y, committedUntil: input.now + commitment };
}

/** Keeps a route stable until a material threat, tower, or terrain change invalidates it. */
export function shouldKeepRetreatPlan(
  plan: RetreatPlan | undefined,
  input: Pick<RetreatRoutingInput, 'actor' | 'now' | 'enemies' | 'structures' | 'isPassable'>,
): plan is RetreatPlan {
  return !!plan && input.now < plan.committedUntil
    && isRetreatDestinationSafe(plan, input.actor, input.enemies, input.structures, input.isPassable);
}
