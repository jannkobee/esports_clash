import { ARENA_WIDTH } from './arenaLayout.ts';
type Point = { x: number; y: number };
type Rock = Point & { radius: number };
type Node = Point & { edges: { index: number; cost: number }[] };
type Route = { goal: Point; points: Point[]; index: number; bestDistance: number; stalled: number };

const CELL = 20;
const MIN_X = 40;
const MAX_X = ARENA_WIDTH - 40;
const MIN_Y = 80;
const MAX_Y = 620;
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/** Static, body-expanded terrain graph. Only route planning uses the grid;
 * movement follows smoothed, collision-free segments at ordinary walk speed. */
export function createTerrainRouter(rocks: readonly Rock[]) {
  const graphs = new Map<number, Node[]>();
  const routes = new WeakMap<Point, { radius: number; route: Route }>();

  const clear = (a: Point, b: Point, radius: number) => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSquared = dx * dx + dy * dy;
    return rocks.every(rock => {
      const t = lengthSquared > 0
        ? Math.max(0, Math.min(1, ((rock.x - a.x) * dx + (rock.y - a.y) * dy) / lengthSquared)) : 0;
      return Math.hypot(a.x + dx * t - rock.x, a.y + dy * t - rock.y) >= rock.radius + radius + 2;
    });
  };

  function graph(radius: number): Node[] {
    const existing = graphs.get(radius);
    if (existing) return existing;
    const nodes: Node[] = [];
    const columns = (MAX_X - MIN_X) / CELL + 1;
    const rows = (MAX_Y - MIN_Y) / CELL + 1;
    const indices = new Int32Array(columns * rows).fill(-1);
    for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
      const point = { x: MIN_X + col * CELL, y: MIN_Y + row * CELL };
      if (!clear(point, point, radius)) continue;
      indices[row * columns + col] = nodes.length;
      nodes.push({ ...point, edges: [] });
    }
    for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
      const index = indices[row * columns + col];
      if (index < 0) continue;
      for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [-1, 1]]) {
        if (col + dx < 0 || col + dx >= columns || row + dy >= rows) continue;
        const neighbor = indices[(row + dy) * columns + col + dx];
        if (neighbor < 0 || !clear(nodes[index], nodes[neighbor], radius)) continue;
        const cost = distance(nodes[index], nodes[neighbor]);
        nodes[index].edges.push({ index: neighbor, cost });
        nodes[neighbor].edges.push({ index, cost });
      }
    }
    graphs.set(radius, nodes);
    return nodes;
  }

  function plan(from: Point, goal: Point, radius: number): Point[] {
    const nodes = graph(radius);
    // Invalid destinations (e.g. a bush center within a ramp rock) resolve to
    // nearby walkable ground, never a point inside an impassable footprint.
    const target = clear(goal, goal, radius) ? goal
      : nodes.reduce((best, node) => distance(node, goal) < distance(best, goal) ? node : best, nodes[0]);
    const costs = new Float64Array(nodes.length).fill(Infinity);
    const parents = new Int32Array(nodes.length).fill(-1);
    const closed = new Uint8Array(nodes.length);
    const open = new Set<number>();
    nodes.forEach((node, index) => {
      if (distance(from, node) <= CELL * 3 && clear(from, node, radius)) {
        costs[index] = distance(from, node);
        open.add(index);
      }
    });
    while (open.size > 0) {
      let current = -1;
      let bestScore = Infinity;
      for (const index of open) {
        const score = costs[index] + distance(nodes[index], target);
        if (score < bestScore) { bestScore = score; current = index; }
      }
      open.delete(current);
      if (clear(nodes[current], target, radius)) {
        const path: Point[] = [{ x: target.x, y: target.y }];
        for (let index = current; index >= 0; index = parents[index]) {
          path.unshift({ x: nodes[index].x, y: nodes[index].y });
        }
        return path;
      }
      closed[current] = 1;
      for (const edge of nodes[current].edges) {
        const cost = costs[current] + edge.cost;
        if (closed[edge.index] || cost >= costs[edge.index]) continue;
        costs[edge.index] = cost;
        parents[edge.index] = current;
        open.add(edge.index);
      }
    }
    return [];
  }

  return function waypoint(from: Point, requestedGoal: Point, radius = 13): Point {
    const goal = { x: Math.max(MIN_X, Math.min(MAX_X, requestedGoal.x)),
      y: Math.max(MIN_Y, Math.min(MAX_Y, requestedGoal.y)) };
    if (clear(from, goal, radius)) {
      routes.delete(from);
      return goal;
    }
    let cached = routes.get(from);
    if (!cached || cached.radius !== radius || distance(cached.route.goal, goal) > 16
      || cached.route.stalled >= 30 || cached.route.index >= cached.route.points.length
      || !clear(from, cached.route.points[cached.route.index], radius)) {
      cached = { radius, route: { goal, points: plan(from, goal, radius), index: 0,
        bestDistance: Infinity, stalled: 0 } };
      routes.set(from, cached);
    }
    const route = cached.route;
    if (route.points.length === 0) return { x: from.x, y: from.y };
    // String-pull the route: skip grid corners only after checking the whole segment.
    for (let index = route.points.length - 1; index > route.index; index--) {
      if (clear(from, route.points[index], radius)) {
        route.index = index;
        route.bestDistance = Infinity;
        route.stalled = 0;
        break;
      }
    }
    const target = route.points[route.index];
    const remaining = distance(from, target);
    if (remaining < route.bestDistance - 1) {
      route.bestDistance = remaining;
      route.stalled = 0;
    } else route.stalled++;
    return target;
  };
}
