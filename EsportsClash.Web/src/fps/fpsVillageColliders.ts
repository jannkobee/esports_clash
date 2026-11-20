import type { LiveSolid } from './fpsLiveMapTypes.ts';
import { liveVillageAsset } from './fpsVillageDesign.ts';
import { FONTESSA_TERRAIN_RUNTIME, LIVE_BRIDGE, LIVE_RIVER } from './fpsLiveTerrain.ts';
import {
  CAMPANILE_BELFRY, LIVE_CANAL_STAIRWELLS, MERCATO_ARCH, PALAZZO_PEDIMENT, canalStairCheek, fontessaGalleryLeanTo, fontessaSlabRoofs, villageRoofShape,
} from './fpsVillageLayout.ts';

/** A collider for masonry or a roof drawn by the village scenery; `blocksMovement` ones also keep bodies out. */
export interface LiveVisualCollider extends LiveSolid { blocksMovement?: true }

/**
 * Colliders for drawn masonry and roofs that had none, so bullets, sight and grenades stop where Fontessa looks
 * solid. Built from the same dimensions as the scenery (`fpsVillageLayout.ts`). Pitched roofs and upper works are
 * stepped boxes whose edges straddle the drawn slope (within rise / (2 x levels)). Nothing here sits in walkable
 * space except the Mercato gate piers, which also block movement so bodies no longer pass through them.
 * Deliberately not collided: cloth, foliage, glass, ironwork, festoons, laundry and thin wall dressing.
 */
export function buildFontessaVisualColliders(solids: readonly LiveSolid[]): LiveVisualCollider[] {
  const out: LiveVisualCollider[] = [], byId = new Map(solids.map(s => [s.id, s]));
  const add = (id: string, minX: number, maxX: number, baseY: number, height: number, minZ: number, maxZ: number, blocksMovement = false) => {
    out.push({ id: `visual-${id}`, minX, maxX, minZ, maxZ, baseY, height, color: '#a89c84', bulletPenetration: 0, surface: 'stone', ...(blocksMovement ? { blocksMovement: true as const } : {}) });
  };
  const roof = (id: string, x: number, z: number, w: number, d: number, y: number) => {
    // Level tops include the 6 cm tile panel above the slope line; at most ~0.1 m from the drawn surface.
    const r = villageRoofShape(w, d), half = r.span / 2 + r.overhang, len = r.run + .4, levels = Math.max(3, Math.ceil(r.rise / .2));
    // Eave board: the tile panels overhang the walls by 18 cm right at the eave line.
    if (r.alongX) add(`${id}-eave`, x - len / 2, x + len / 2, y - .04, y + .1, z - half, z + half);
    else add(`${id}-eave`, x - half, x + half, y - .04, y + .1, z - len / 2, z + len / 2);
    for (let k = 0; k < levels; k++) {
      const h = half * (1 - (k + .5) / levels), lo = y + r.rise * k / levels, hi = y + r.rise * (k + 1) / levels + .06;
      if (r.alongX) add(`${id}-roof-${k}`, x - len / 2, x + len / 2, lo, hi, z - h, z + h);
      else add(`${id}-roof-${k}`, x - h, x + h, lo, hi, z - len / 2, z + len / 2);
    }
  };

  // Every village house, shop and civic building carries a pitched roof above its collision top (village architecture).
  for (const s of solids) {
    if (s.id.startsWith('mid-window-furniture-')) continue;
    const kind = liveVillageAsset(s.id).kind;
    if (kind === 'house' || kind === 'shop' || kind === 'civic') roof(s.id, (s.minX + s.maxX) / 2, (s.minZ + s.maxZ) / 2, s.maxX - s.minX, s.maxZ - s.minZ, s.height);
  }
  const find = (id: string) => byId.get(id);
  for (const r of fontessaSlabRoofs(find)) roof(r.id, r.x, r.z, r.w, r.d, r.y);
  const leanTo = fontessaGalleryLeanTo(find);
  if (leanTo) {
    const midX = (leanTo.lowX + leanTo.wallX) / 2, midY = (leanTo.lowY + leanTo.highY) / 2;
    add('b-apartments-lean-to-0', leanTo.lowX, leanTo.wallX, leanTo.slabY, midY, leanTo.minZ - .15, leanTo.maxZ + .15);
    add('b-apartments-lean-to-1', midX, leanTo.wallX, midY, leanTo.highY + .06, leanTo.minZ - .15, leanTo.maxZ + .15);
  }

  // Campanile belfry stage: corner piers, centre mullions, arch heads, sill walls, cornice and the pyramid roof.
  const tower = byId.get('a-crates');
  if (tower) {
    const B = CAMPANILE_BELFRY, w = tower.maxX - tower.minX, d = tower.maxZ - tower.minZ, x = (tower.minX + tower.maxX) / 2, z = (tower.minZ + tower.maxZ) / 2;
    const top = tower.height, belfryTop = top + B.height, spring = top + B.springAbove, openW = (w - 2 * B.pier - B.mullion) / 2;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const cx = x + sx * (w / 2 - B.pier / 2), cz = z + sz * (d / 2 - B.pier / 2);
      add(`a-crates-belfry-pier-${sx}-${sz}`, cx - B.pier / 2, cx + B.pier / 2, top, belfryTop, cz - B.pier / 2, cz + B.pier / 2);
    }
    for (const [plane, alongX, inward] of [[tower.minZ, true, 1], [tower.maxZ, true, -1], [tower.minX, false, 1], [tower.maxX, false, -1]] as const) {
      const lo = plane, a = Math.min(plane, plane + inward * B.wall), b = Math.max(plane, plane + inward * B.wall);
      const span = (from: number, to: number, y0: number, y1: number, tag: string) =>
        alongX ? add(`a-crates-belfry-${tag}`, from, to, y0, y1, a, b) : add(`a-crates-belfry-${tag}`, a, b, y0, y1, from, to);
      const centre = alongX ? x : z, start = centre - (alongX ? w : d) / 2;
      span(centre - B.mullion / 2, centre + B.mullion / 2, top, belfryTop, `mullion-${lo}`);
      for (const k of [0, 1]) {
        const from = start + B.pier + k * (openW + B.mullion), to = from + openW;
        span(from, to, top, top + B.sill, `sill-${lo}-${k}`);
        // Arch head: solid above the crown; its haunches beside the piers come down to the springing.
        span(from, to, spring + B.rise * .85, belfryTop - .1, `arch-${lo}-${k}`);
        span(from, from + .3, spring, spring + B.rise * .85, `haunch-${lo}-${k}-a`);
        span(to - .3, to, spring, spring + B.rise * .85, `haunch-${lo}-${k}-b`);
      }
    }
    add('a-crates-belfry-cornice', x - w / 2 - .17, x + w / 2 + .17, belfryTop - .1, belfryTop + .1, z - d / 2 - .17, z + d / 2 + .17);
    const roofBase = belfryTop + B.roofGap, side = w + B.roofOverhang;
    for (let k = 0; k < 4; k++) {
      const h = side / 2 * (1 - (k + .5) / 4);
      add(`a-crates-campanile-roof-${k}`, x - h, x + h, roofBase + B.roofHeight * k / 4, roofBase + B.roofHeight * (k + 1) / 4, z - h, z + h);
    }
  }

  // Palazzo Comunale: portico eave and arch spandrels over the columns, the pediment and the tiles behind it.
  if (byId.has('a-loggia-wall')) {
    const P = PALAZZO_PEDIMENT, cx = (P.left + P.right) / 2;
    add('palazzo-portico-eave', P.left, P.right, 3.62, 4.05, 24.85, 26.45);
    for (const x of [-27.5, -24.6, -21.4, -18.5]) add(`palazzo-arch-spandrel-${x}`, x - .55, x + .55, 3.05, 3.62, 25.76, 26.4);
    for (let k = 0; k < 3; k++) {
      const h = (P.right - P.left) / 2 * (1 - (k + .5) / 3);
      add(`palazzo-pediment-${k}`, cx - h, cx + h, P.base + (P.apex - P.base) * k / 3, P.base + (P.apex - P.base) * (k + 1) / 3, P.front - .15, P.back);
    }
    add('palazzo-portico-tiles-0', P.left, P.right, P.base, 4.42, P.back, 26.4);
    add('palazzo-portico-tiles-1', P.left, P.right, 4.42, 4.8, 25.9, 26.4);
  }

  // Mercato gate: piers (also block movement), arch spandrels, frieze and cornice, terrace balustrades; stairwell cheeks.
  const passage = byId.get('b-sottoportego'), ground = FONTESSA_TERRAIN_RUNTIME.groundHeight;
  if (passage) {
    const A = MERCATO_ARCH, soffit = passage.baseY ?? 3.05, xc = (passage.minX + passage.maxX) / 2, half = passage.maxX - A.pier - xc;
    const radius = (half * half + A.rise * A.rise) / (2 * A.rise), cy = A.springY + A.rise - radius;
    const archY = (x: number) => Math.abs(x - xc) >= half ? A.springY : cy + Math.sqrt(radius * radius - (x - xc) ** 2);
    for (const side of [-1, 1]) {
      const edge = side < 0 ? passage.minZ : passage.maxZ, out = edge + side * A.outer, inner = edge - side * A.inner, label = side < 0 ? 'south' : 'north';
      const zMin = Math.min(out, inner) - .04, zMax = Math.max(out, inner) + .04;
      for (const [x0, x1] of [[passage.minX, passage.minX + A.pier + .06], [passage.maxX - A.pier - .06, passage.maxX]]) {
        const footing = Math.min(...[zMin, zMax].flatMap(z => [x0 + .02, x1 - .02].map(x => ground({ x, z }))));
        add(`mercato-pier-${label}-${x0 < xc ? 'west' : 'east'}`, x0, x1, footing - .02, A.springY + .01, zMin, zMax, true);
      }
      // Spandrels: four steps per side, each down to the arch curve at its middle (within ~0.1 m of the drawn arch).
      const edges = [0, .25, .5, .75, 1].map(f => xc - half + half * f);
      for (let i = 0; i < edges.length - 1; i++) for (const mirror of [1, -1]) {
        const a = mirror > 0 ? edges[i] : 2 * xc - edges[i + 1], b = mirror > 0 ? edges[i + 1] : 2 * xc - edges[i];
        add(`mercato-spandrel-${label}-${i}-${mirror}`, a, b, archY((a + b) / 2), soffit, Math.min(out, inner), Math.max(out, inner));
      }
      add(`mercato-frieze-${label}`, passage.minX, passage.maxX, soffit - .03, A.friezeTop + .18, Math.min(edge, edge + side * .25), Math.max(edge, edge + side * .25));
      const railZ = edge - side * .12;
      add(`mercato-balustrade-${label}`, passage.minX, passage.maxX, passage.height, passage.height + .79, railZ - .11, railZ + .11);
    }
  }
  for (const stair of LIVE_CANAL_STAIRWELLS) for (const [i, cheek] of stair.cheeks.entries()) {
    const c = canalStairCheek(cheek);
    add(`${stair.id}-cheek-${i}`, c.minX, c.maxX, c.baseY, c.height, c.minZ, c.maxZ);
  }

  // Jade Lantern facade piers stand 13 cm proud of the front wall.
  for (const x of [-8.78, -3.15, 3.15, 8.78]) add(`jade-front-pier-${x}`, x - .08, x + .08, .03, 2.93, -29.305, -29.135);
  // Cast-iron fontanella standpipe beside the arrival kiosk (collision only; it stands against the kiosk wall).
  const kiosk = byId.get('mid-approach-screen');
  if (kiosk) { const fx = (kiosk.minX + kiosk.maxX) / 2, fz = kiosk.minZ - .14; add('village-fontanella', fx - .14, fx + .14, 0, 1.24, fz - .2, fz + .14); }

  // Central bridge: pilasters and their caps rise above the parapet.
  for (const side of [-1, 1]) for (const z of [LIVE_RIVER.minZ, 2.85, 5.62]) {
    const x = side * 1.66;
    add(`bridge-pilaster-${side}-${z}`, x - .16, x + .16, LIVE_BRIDGE.deckY, 1.9, z - .15, z + .15);
    add(`bridge-pilaster-cap-${side}-${z}`, x - .215, x + .215, 1.895, 2.025, z - .21, z + .21);
  }
  return out;
}
