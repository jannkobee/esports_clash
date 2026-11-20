import { Matrix, Ray, Vector3, type AbstractMesh, type Scene } from '@babylonjs/core';
import type { LiveMapRuntime, LiveWorldPoint } from './fpsLiveMapTypes.ts';
import { fpsSkillRandom } from './fpsSkillProfile.ts';

/**
 * Compares what the drawn village blocks with what collision blocks, along seeded lines of fire between
 * walkable eye and target positions, plus "lob" lines from eye height to points 2-14 m up (roofs, arches,
 * the belfry). Diagnostic only.
 * - A "shoot-through" is a line that a solid-looking piece of scenery blocks but that bullets cross, because no
 *   collider (or only a penetrable one) is in the way. `strict` also counts a collider that stops the line only
 *   further along than the drawn piece.
 * - A "phantom" is a line whose first opaque hit is a `visual-*` collider while nothing solid is drawn within
 *   `PHANTOM_GAP` of that hit point, in any direction: the collider stops a shot where the drawn world is open.
 */
export interface VisualCollisionFinding {
  mesh: string; group: string; point: LiveWorldPoint;
  from: LiveWorldPoint; to: LiveWorldPoint; penetrable: boolean;
  /** Metres of a penetrable solid crossed, for thickness findings. */
  depth?: number;
  /** Strict findings: metres from the drawn hit to where an opaque collider stops the line. */
  gap?: number;
  lob?: boolean;
}
export interface VisualPhantomFinding {
  collider: string; group: string; point: LiveWorldPoint; from: LiveWorldPoint; to: LiveWorldPoint; lob: boolean;
  /** Metres from the collider hit to the first drawn hit along the line, or null when the line is drawn clear. */
  gap: number | null;
}
export interface VisualCollisionAudit {
  rays: number; lobRays: number; blockedVisual: number; findings: VisualCollisionFinding[]; phantoms: VisualPhantomFinding[];
}

/**
 * Cloth, foliage (with the tree limbs inside the crowns; trunks are collided), glass, paper, water, light fittings,
 * thin ironwork, small props and floor overlays never stop a bullet. Matched as whole name words, so "market" is not
 * "mark" and "stringcourse" is not "ring".
 */
const SOFT_WORDS = new Set(`festoon bulb laundry cord cable chain leaf leaves crown olive spray lily flower flowerbox bloom petal geranium
  herb lemon fruit canvas valance awning stripe banner flag poster paper notice ink sign glass glazing jet overflow splash stream soil
  rope socket cloth peg curtain halo robe mantle shade lamp sconce grille bar slat shutter louvre rod wire aerial tassel hanger plate
  cup bottle candle vase bread loaf baguette roll fish basket goods chart ledger blotter drawer pull handle ring knocker hook bracket
  finial vane clock hand mark boss dial occlusion compass seal hub drain cotto tiled nosing kerb inlay mosaic border smoke
  chalkboard picture mirror ham garlic till espresso bowl pad rose moss stain planter pipe hopper pot meter shelf face subtitle lantern
  rail branch cushion`.split(/\s+/));
/** Words that name a soft object only when they are the object itself (the last word), not a qualifier such as
 * "village-street-gatepost", "canal-palazzo-water-footing" or "jade-lantern-dining-tile-roof". A "menu" is a painted
 * board like the other signs. */
const SOFT_OBJECT_WORDS = new Set('water street road court paving floor terrain landing sill mullion drop ground grass menu recess'.split(' '));
/** Masonry that keeps a soft-looking word: the belfry's sills and mullion piers, arch rings (the palazzo voussoirs,
 * shopfront arches), the terrace rail, the Jade Lantern's roof. */
const HARD_NAMES = /^a-crates-belfry-(sill|mullion)|arch-ring|^b-passage-balustrade-rail|^jade-lantern-dining-/;
/** Thin dressing: the 4 cm window heads over each window, the 2.5 cm balcony bars, the terrace bistro chairs. */
const THIN_NAMES = /-interior-ceiling$|-balcony-iron-|^b-passage-terrace-chair-/;
/** Paving laid over the terrain (the courtyard, the market square and street) and the painted village map. */
const FLOOR_NAMES = /^(civic-courtyard|market-square|market-street-(north|south))[-\d.]*$|^village-map-board$/;
const wordsOf = (name: string) => name.toLowerCase().split(/[^a-z]+/).filter(w => w.length > 1);
export const isHardVisual = (name: string) => {
  if (HARD_NAMES.test(name)) return true;
  if (FLOOR_NAMES.test(name) || THIN_NAMES.test(name)) return false;
  const words = wordsOf(name);
  if (words.some(w => SOFT_WORDS.has(w))) return false;
  return !SOFT_OBJECT_WORDS.has(words[words.length - 1] ?? '');
};
/** Thin timber furniture (market counters, tables, the stall-side stand, the lookout desk, the terrace bistro chairs)
 * is wallbangable by design. */
const WALLBANG_FURNITURE = /^(visual-)?(market-stall-|restaurant-(table|outside-table|menu-stand|service-counter)|mid-window-furniture-)/;
/** Deepest material a bullet may plausibly cross (a counter, a door, a table top), in metres. */
export const MAX_PENETRATION_DEPTH = .6;
/** Visual surfaces this close to an opaque collider count as the collider's own surface. */
const GRAZE = .05;
/** A visual collider surface this close to drawn solid geometry is that geometry's own surface. */
export const PHANTOM_GAP = .05;
/** Fraction of the segment inside an axis-aligned solid (slab test). */
function boxChord(a: LiveWorldPoint, b: LiveWorldPoint, w: { minX: number; maxX: number; minZ: number; maxZ: number; height: number; baseY?: number }): number {
  let enter = 0, exit = 1;
  for (const [o, d, lo, hi] of [[a.x, b.x - a.x, w.minX, w.maxX], [a.y, b.y - a.y, w.baseY ?? 0, w.height], [a.z, b.z - a.z, w.minZ, w.maxZ]]) {
    if (Math.abs(d) < 1e-9) { if (o < lo || o > hi) return 0; continue; }
    const t0 = (lo - o) / d, t1 = (hi - o) / d;
    enter = Math.max(enter, Math.min(t0, t1)); exit = Math.min(exit, Math.max(t0, t1));
  }
  return Math.max(0, exit - enter);
}
const groupOf = (name: string) => name.replace(/-?\d+(\.\d+)?/g, '#').replace(/#(-#)+/g, '#');
/** Axis and diagonal directions for the phantom proximity probe. */
const PROBES = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
  ...[-1, 1].flatMap(x => [-1, 1].flatMap(y => [-1, 1].map(z => [x / Math.sqrt(3), y / Math.sqrt(3), z / Math.sqrt(3)])))].map(([x, y, z]) => new Vector3(x, y, z));
const JITTER = [[0, 0, 0], [.002, 0, 0], [-.002, 0, 0], [0, .002, 0], [0, -.002, 0], [0, 0, .002], [0, 0, -.002]].map(([x, y, z]) => new Vector3(x, y, z));

export function auditVisualCollision(scene: Scene, map: LiveMapRuntime, { rays = 4000, lobs = 0, seed = 1, cell = 4, strict = false } = {}): VisualCollisionAudit {
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
  const pick = (mesh: AbstractMesh, ray: Ray) => {
    // AbstractMesh.intersects takes a ray in the mesh's local space (scene picking transforms it first).
    const world = mesh.getWorldMatrix(), hit = mesh.intersects(Ray.Transform(ray, Matrix.Invert(world)), false, undefined, false, world);
    return hit.hit && hit.pickedPoint ? Vector3.Distance(ray.origin, hit.pickedPoint) : undefined;
  };
  /** Is any drawn solid surface within PHANTOM_GAP of the point (probing along axes and diagonals)? */
  const drawnNear = (p: Vector3) => {
    const near = new Set<AbstractMesh>();
    for (const dx of [-PHANTOM_GAP, PHANTOM_GAP]) for (const dz of [-PHANTOM_GAP, PHANTOM_GAP])
      for (const mesh of grid.get(`${Math.floor((p.x + dx) / cell)}:${Math.floor((p.z + dz) / cell)}`) ?? []) near.add(mesh);
    for (const mesh of near) {
      const b = mesh.getBoundingInfo().boundingBox, pad = PHANTOM_GAP + .001;
      if (p.x < b.minimumWorld.x - pad || p.x > b.maximumWorld.x + pad || p.y < b.minimumWorld.y - pad || p.y > b.maximumWorld.y + pad
        || p.z < b.minimumWorld.z - pad || p.z > b.maximumWorld.z + pad) continue;
      // Origins nudged 2 mm off the hit point so a probe never runs exactly along a face's edge plane.
      for (const origin of JITTER.map(j => p.add(j))) for (const direction of PROBES) {
        const distance = pick(mesh, new Ray(origin, direction, PHANTOM_GAP + .001, 0));
        if (distance !== undefined && distance <= PHANTOM_GAP + .001) return true;
      }
    }
    return false;
  };
  // Walkable stations at street, canal and raised-floor level.
  const b = map.definition.bounds, stations: { x: number; z: number; floor: number }[] = [];
  for (let x = b.navMinX; x <= b.navMaxX; x += 1.6) for (let z = b.navMinZ; z <= b.navMaxZ; z += 1.6) {
    const p = { x, z };
    if (map.walkable(p)) stations.push({ x, z, floor: map.terrain.groundHeight(p) });
  }
  const random = fpsSkillRandom(seed, 'visual-collision-audit'), findings: VisualCollisionFinding[] = [], phantoms: VisualPhantomFinding[] = [];
  let blockedVisual = 0, cast = 0, lobCast = 0;
  for (let attempt = 0; cast + lobCast < rays + lobs && attempt < (rays + lobs) * 20; attempt++) {
    // Lines of fire first (so a seed keeps its original lines), then lob lines.
    const lob = cast >= rays;
    const a = stations[Math.floor(random() * stations.length)], c = stations[Math.floor(random() * stations.length)];
    const flat = Math.hypot(a.x - c.x, a.z - c.z);
    if (lob ? flat < 1.5 || flat > 35 : flat < 3 || flat > 45) continue;
    if (lob) lobCast++; else cast++;
    const from = { x: a.x, y: a.floor + (random() < .3 ? 1.08 : 1.6), z: a.z };
    const to = { x: c.x, y: c.floor + (lob ? 2 + random() * 12 : [1.72, 1.25, .9][Math.floor(random() * 3)]), z: c.z };
    const length = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
    // Exact triangle tests: Babylon's default barycentric epsilon (0.001) widens a long roof face by ~2 cm.
    const ray = new Ray(new Vector3(from.x, from.y, from.z), new Vector3((to.x - from.x) / length, (to.y - from.y) / length, (to.z - from.z) / length), length, 0);
    const candidates = new Set<AbstractMesh>();
    const steps = Math.ceil(flat / (cell / 2));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps, key = `${Math.floor((from.x + (to.x - from.x) * t) / cell)}:${Math.floor((from.z + (to.z - from.z) * t) / cell)}`;
      for (const mesh of grid.get(key) ?? []) candidates.add(mesh);
    }
    let nearest: { mesh: AbstractMesh; distance: number; point: Vector3 } | undefined;
    for (const mesh of candidates) {
      const distance = pick(mesh, ray);
      if (distance !== undefined && distance < length - .12 && distance > .12 && (!nearest || distance < nearest.distance))
        nearest = { mesh, distance, point: ray.origin.add(ray.direction.scale(distance)) };
    }
    const hits = map.wallIntersections(from, to), opaque = hits.find(h => !h.wall.bulletPenetration);
    // Phantom: the first opaque collider is a visual one and nothing solid is drawn where it stops the line.
    if (opaque && opaque.wall.id.startsWith('visual-')) {
      const at = opaque.t * length;
      if (at > .12 && at < length - .12 && !(nearest && nearest.distance <= at + PHANTOM_GAP)) {
        const p = ray.origin.add(ray.direction.scale(at));
        if (!drawnNear(p)) phantoms.push({ collider: opaque.wall.id, group: groupOf(opaque.wall.id), point: { x: p.x, y: p.y, z: p.z }, from, to, lob, gap: nearest ? nearest.distance - at : null });
      }
    }
    // Penetration ignores thickness in the simulation, so crossing a deep "penetrable" solid is also a shoot-through.
    if (!opaque) for (const hit of hits.filter(h => !WALLBANG_FURNITURE.test(h.wall.id))) {
      const chord = boxChord(from, to, hit.wall) * length;
      if (chord > MAX_PENETRATION_DEPTH) {
        const t = hit.t;
        findings.push({ mesh: hit.wall.id, group: `penetrable solid ${hit.wall.id}`, depth: chord, point: { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t, z: from.z + (to.z - from.z) * t }, from, to, penetrable: true, lob });
        break;
      }
    }
    if (!nearest) continue;
    blockedVisual++;
    if (opaque && (!strict || opaque.t * length <= nearest.distance + GRAZE)) continue;
    // Dressing within a few centimetres of a collider (quoins, frames, cappings) is a graze, not a hole.
    const p = nearest.point, inCollider = map.collisionSolidsAt(p, p, GRAZE).some(w => p.x >= w.minX - GRAZE && p.x <= w.maxX + GRAZE
      && p.z >= w.minZ - GRAZE && p.z <= w.maxZ + GRAZE && p.y >= (w.baseY ?? 0) - GRAZE && p.y <= w.height + GRAZE && !w.bulletPenetration);
    if (inCollider) continue;
    // Pieces on or in designed-wallbang furniture (a menu stand's feet, a counter's slats or top) share its penetrability.
    if (map.collisionSolidsAt(p, p, GRAZE).some(w => WALLBANG_FURNITURE.test(w.id) && p.x >= w.minX - GRAZE && p.x <= w.maxX + GRAZE
      && p.z >= w.minZ - GRAZE && p.z <= w.maxZ + GRAZE && p.y >= (w.baseY ?? 0) - GRAZE && p.y <= w.height + GRAZE)) continue;
    findings.push({ mesh: nearest.mesh.name, group: groupOf(nearest.mesh.name), point: { x: p.x, y: p.y, z: p.z }, from, to, penetrable: hits.length > 0, lob,
      ...(opaque ? { gap: opaque.t * length - nearest.distance } : {}) });
  }
  return { rays: cast, lobRays: lobCast, blockedVisual, findings, phantoms };
}
