import { Matrix, Ray, Vector3, type AbstractMesh, type Scene } from '@babylonjs/core';
import type { LiveMapRuntime } from './fpsLiveMapTypes.ts';
import { fpsSkillRandom } from './fpsSkillProfile.ts';

/**
 * Compares what the drawn village blocks with what collision blocks, along seeded lines of fire between
 * walkable eye and target positions. A "shoot-through" is a line that a solid-looking piece of scenery blocks
 * but that bullets cross, because no collider (or only a penetrable one) is in the way. Diagnostic only.
 */
export interface VisualCollisionFinding {
  mesh: string; group: string; point: { x: number; y: number; z: number };
  from: { x: number; y: number; z: number }; to: { x: number; y: number; z: number }; penetrable: boolean;
  /** Metres of a penetrable solid crossed, for thickness findings. */
  depth?: number;
}
export interface VisualCollisionAudit { rays: number; blockedVisual: number; findings: VisualCollisionFinding[] }

/** Cloth, foliage, glass, paper, water, light fittings, thin ironwork and floor overlays never stop a bullet. */
const SOFT = /festoon|bulb|laundry|cord|cable|chain|leaf|crown|olive|spray|lily|flower|bloom|petal|geranium|herb|lemon|fruit|canvas|valance|awning|stripe|banner|flag|poster|paper|notice|ink|sign|-face|glass|water|jet|overflow|splash|stream|soil|rope|drop|socket|cloth|peg|curtain|halo|robe|mantle|shade|lamp|lantern|sconce|grille|-bar-|slat|shutter|mullion|rail|rod|wire|aerial|tassel|hanger|plate|cup|bottle|candle|vase|bread|loaf|baguette|roll|fish|basket|goods|chart|ledger|blotter|drawer|pull|handle|ring|knocker|hook|bracket|finial|vane|clock|hand|mark|boss|dial|paving|floor|court|road|street|occlusion|terrain|compass|seal|hub|drain|cotto|tiled|nosing|kerb|inlay|mosaic|border|landing|smoke|map-board|chalkboard|picture|mirror|ham|garlic|till|espresso|bowl|pad|rose|moss|stain|sill|planter|herb|pipe|hopper|-pot-|pot$|chimney|meter|shelf/;
/** Thin timber furniture (market counters, tables, the stall-side stand, the lookout desk) is wallbangable by design. */
const WALLBANG_FURNITURE = /^market-stall-|^restaurant-(table|outside-table|menu-stand|service-counter)|^mid-window-furniture-/;
export const isHardVisual = (name: string) => !SOFT.test(name);
/** Deepest material a bullet may plausibly cross (a counter, a door, a table top), in metres. */
export const MAX_PENETRATION_DEPTH = .6;
/** Visual surfaces this close to an opaque collider count as the collider's own surface. */
const GRAZE = .05;
/** Fraction of the segment inside an axis-aligned solid (slab test). */
function boxChord(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }, w: { minX: number; maxX: number; minZ: number; maxZ: number; height: number; baseY?: number }): number {
  let enter = 0, exit = 1;
  for (const [o, d, lo, hi] of [[a.x, b.x - a.x, w.minX, w.maxX], [a.y, b.y - a.y, w.baseY ?? 0, w.height], [a.z, b.z - a.z, w.minZ, w.maxZ]]) {
    if (Math.abs(d) < 1e-9) { if (o < lo || o > hi) return 0; continue; }
    const t0 = (lo - o) / d, t1 = (hi - o) / d;
    enter = Math.max(enter, Math.min(t0, t1)); exit = Math.min(exit, Math.max(t0, t1));
  }
  return Math.max(0, exit - enter);
}
const groupOf = (name: string) => name.replace(/-?\d+(\.\d+)?/g, '#').replace(/#(-#)+/g, '#');

export function auditVisualCollision(scene: Scene, map: LiveMapRuntime, { rays = 4000, seed = 1, cell = 4 } = {}): VisualCollisionAudit {
  // Broad phase over hard visual meshes so each line only tests the few meshes it can reach.
  const meshes = scene.meshes.filter(m => m.isEnabled() && m.getTotalVertices() > 0 && isHardVisual(m.name)) as AbstractMesh[];
  const grid = new Map<string, AbstractMesh[]>();
  for (const mesh of meshes) {
    mesh.computeWorldMatrix(true);
    const b = mesh.getBoundingInfo().boundingBox, x0 = Math.floor(b.minimumWorld.x / cell), x1 = Math.floor(b.maximumWorld.x / cell);
    const z0 = Math.floor(b.minimumWorld.z / cell), z1 = Math.floor(b.maximumWorld.z / cell);
    if ((x1 - x0) * (z1 - z0) > 400) continue;
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) { const key = `${x}:${z}`, list = grid.get(key); if (list) list.push(mesh); else grid.set(key, [mesh]); }
  }
  // Walkable stations at street, canal and raised-floor level.
  const b = map.definition.bounds, stations: { x: number; z: number; floor: number }[] = [];
  for (let x = b.navMinX; x <= b.navMaxX; x += 1.6) for (let z = b.navMinZ; z <= b.navMaxZ; z += 1.6) {
    const p = { x, z };
    if (map.walkable(p)) stations.push({ x, z, floor: map.terrain.groundHeight(p) });
  }
  const random = fpsSkillRandom(seed, 'visual-collision-audit'), findings: VisualCollisionFinding[] = [];
  let blockedVisual = 0, cast = 0;
  for (let attempt = 0; cast < rays && attempt < rays * 20; attempt++) {
    const a = stations[Math.floor(random() * stations.length)], c = stations[Math.floor(random() * stations.length)];
    const flat = Math.hypot(a.x - c.x, a.z - c.z);
    if (flat < 3 || flat > 45) continue;
    cast++;
    const from = { x: a.x, y: a.floor + (random() < .3 ? 1.08 : 1.6), z: a.z };
    const to = { x: c.x, y: c.floor + [1.72, 1.25, .9][Math.floor(random() * 3)], z: c.z };
    const length = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
    const ray = new Ray(new Vector3(from.x, from.y, from.z), new Vector3((to.x - from.x) / length, (to.y - from.y) / length, (to.z - from.z) / length), length);
    const candidates = new Set<AbstractMesh>();
    const steps = Math.ceil(flat / (cell / 2));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps, key = `${Math.floor((from.x + (to.x - from.x) * t) / cell)}:${Math.floor((from.z + (to.z - from.z) * t) / cell)}`;
      for (const mesh of grid.get(key) ?? []) candidates.add(mesh);
    }
    let nearest: { mesh: AbstractMesh; distance: number; point: Vector3 } | undefined;
    for (const mesh of candidates) {
      // AbstractMesh.intersects takes a ray in the mesh's local space (scene picking transforms it first).
      const world = mesh.getWorldMatrix(), local = Ray.Transform(ray, Matrix.Invert(world));
      const pick = mesh.intersects(local, false, undefined, false, world);
      if (!pick.hit || !pick.pickedPoint) continue;
      const distance = Vector3.Distance(ray.origin, pick.pickedPoint);
      if (distance < length - .12 && distance > .12 && (!nearest || distance < nearest.distance)) nearest = { mesh, distance, point: pick.pickedPoint };
    }
    const hits = map.wallIntersections(from, to);
    // Penetration ignores thickness in the simulation, so crossing a deep "penetrable" solid is also a shoot-through.
    if (!hits.some(h => !h.wall.bulletPenetration)) for (const hit of hits.filter(h => !WALLBANG_FURNITURE.test(h.wall.id))) {
      const chord = boxChord(from, to, hit.wall) * length;
      if (chord > MAX_PENETRATION_DEPTH) {
        const t = hit.t;
        findings.push({ mesh: hit.wall.id, group: `penetrable solid ${hit.wall.id}`, depth: chord, point: { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t, z: from.z + (to.z - from.z) * t }, from, to, penetrable: true });
        break;
      }
    }
    if (!nearest) continue;
    blockedVisual++;
    if (hits.some(h => !h.wall.bulletPenetration)) continue;
    // Dressing within a few centimetres of a collider (quoins, frames, cappings) is a graze, not a hole.
    const p = nearest.point, inCollider = map.collisionSolidsAt(p, p, GRAZE).some(w => p.x >= w.minX - GRAZE && p.x <= w.maxX + GRAZE
      && p.z >= w.minZ - GRAZE && p.z <= w.maxZ + GRAZE && p.y >= (w.baseY ?? 0) - GRAZE && p.y <= w.height + GRAZE && !w.bulletPenetration);
    if (inCollider) continue;
    // Pieces inside designed-wallbang furniture (a menu stand's feet, a counter's slats) share its penetrability.
    if (hits.some(h => WALLBANG_FURNITURE.test(h.wall.id) && p.x >= h.wall.minX - GRAZE && p.x <= h.wall.maxX + GRAZE && p.z >= h.wall.minZ - GRAZE && p.z <= h.wall.maxZ + GRAZE)) continue;
    findings.push({ mesh: nearest.mesh.name, group: groupOf(nearest.mesh.name), point: { x: nearest.point.x, y: nearest.point.y, z: nearest.point.z }, from, to, penetrable: hits.length > 0 });
  }
  return { rays: cast, blockedVisual, findings };
}
