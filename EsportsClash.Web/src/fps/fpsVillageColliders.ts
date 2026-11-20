import type { LiveSolid } from './fpsLiveMapTypes.ts';
import { liveVillageAsset } from './fpsVillageDesign.ts';
import { VILLAGE_MARKET_STALLS } from './fpsVillageMarketLayout.ts';
import { FONTESSA_TERRAIN_RUNTIME, LIVE_BRIDGE, LIVE_RIVER } from './fpsLiveTerrain.ts';
import {
  CAMPANILE_BELFRY, LIVE_CANAL_STAIRWELLS, MERCATO_ARCH, PALAZZO_PEDIMENT, PALAZZO_PORTICO, VILLAGE_CHIMNEY, VILLAGE_CHIMNEY_MIN_HEIGHT,
  canalStairCheek, fontessaGalleryLeanTo, fontessaSlabRoofs, palazzoArchVoussoirs, villageRoofChimneys, villageRoofShape,
} from './fpsVillageLayout.ts';

/** A collider for masonry or a roof drawn by the village scenery; `blocksMovement` ones also keep bodies out. */
export interface LiveVisualCollider extends LiveSolid { blocksMovement?: true }

/** Vertical step of roof bands: each band edge stands within half of it (4 cm) of the drawn tile surface. */
export const ROOF_BAND_STEP = .08;
/** Roof bands end this far past the gable wall's outer face, so the open verge under the tile overhang stays open. */
export const ROOF_BAND_PAST_GABLE = .049;

type Pt = readonly [number, number];
type Column = readonly [a0: number, a1: number, y0: number, y1: number];
/** Vertical extent of a convex polygon in (a, y) at a, or undefined where the line misses it. */
function convexSpan(poly: readonly Pt[], a: number): [number, number] | undefined {
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < poly.length; i++) {
    const [a0, y0] = poly[i], [a1, y1] = poly[(i + 1) % poly.length];
    if (a < Math.min(a0, a1) || a > Math.max(a0, a1)) continue;
    const ys = a0 === a1 ? [y0, y1] : [y0 + (y1 - y0) * (a - a0) / (a1 - a0)];
    for (const y of ys) { lo = Math.min(lo, y); hi = Math.max(hi, y); }
  }
  return lo <= hi ? [lo, hi] : undefined;
}
/** Corners of a w by h box face centred at (a, y) and turned by `angle` (Babylon rotation.z, or minus rotation.x in (z, y)). */
function turnedRect(a: number, y: number, w: number, h: number, angle: number): Pt[] {
  const c = Math.cos(angle), s = Math.sin(angle);
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => [a + u * w / 2 * c - v * h / 2 * s, y + u * w / 2 * s + v * h / 2 * c] as const);
}
/**
 * Columns covering the union of convex profiles: each spans the middle of the lower and of the upper outline over its
 * width, and a column ends once either outline has moved 2 x `tol`, so both stay within `tol` of the drawn shape.
 */
export function profileColumns(polys: readonly (readonly Pt[])[], tol: number, step = .002): Column[] {
  const as = polys.flat().map(p => p[0]), minA = Math.min(...as), maxA = Math.max(...as), n = Math.max(2, Math.ceil((maxA - minA) / step));
  const out: Column[] = [];
  let col: { a0: number; lo: [number, number]; hi: [number, number] } | undefined, prev = minA;
  const finish = (a1: number) => { if (col) out.push([col.a0, a1, (col.lo[0] + col.lo[1]) / 2, (col.hi[0] + col.hi[1]) / 2]); col = undefined; };
  for (let i = 0; i <= n; i++) {
    const a = minA + (maxA - minA) * i / n;
    let lo = Infinity, hi = -Infinity;
    for (const poly of polys) { const s = convexSpan(poly, a); if (s) { lo = Math.min(lo, s[0]); hi = Math.max(hi, s[1]); } }
    if (lo > hi) { finish(prev); prev = a; continue; }
    if (col && (Math.max(col.lo[1], lo) - Math.min(col.lo[0], lo) > 2 * tol || Math.max(col.hi[1], hi) - Math.min(col.hi[0], hi) > 2 * tol)) {
      const cut = (prev + a) / 2; finish(cut); col = { a0: cut, lo: [lo, lo], hi: [hi, hi] };
    } else if (!col) col = { a0: a, lo: [lo, lo], hi: [hi, hi] };
    else { col.lo = [Math.min(col.lo[0], lo), Math.max(col.lo[1], lo)]; col.hi = [Math.min(col.hi[0], hi), Math.max(col.hi[1], hi)]; }
    prev = a;
  }
  finish(maxA);
  return out;
}
/**
 * Masonry above a segmental arch (radius from half-span and rise, as `addArchedWall` draws it), in equal-height
 * steps: each column runs from where the curve crosses one step height to the next and starts at the step's middle,
 * within rise / 2m of the curve; the two crown steps share one box. Returns (a0, a1, bottom) per column.
 */
export function segmentalArchColumns(from: number, to: number, springY: number, rise: number, tol: number): [number, number, number][] {
  const c = (from + to) / 2, half = (to - from) / 2, radius = (half * half + rise * rise) / (2 * rise), cy = springY + rise - radius;
  const m = Math.max(1, Math.ceil(rise / (2 * tol)));
  const xs = Array.from({ length: m + 1 }, (_, j) => c - Math.sqrt(Math.max(0, radius * radius - (springY + rise * j / m - cy) ** 2)));
  const out: [number, number, number][] = [];
  for (let j = 0; j < m - 1; j++) {
    const bottom = springY + rise * (j + .5) / m;
    out.push([xs[j], xs[j + 1], bottom], [2 * c - xs[j + 1], 2 * c - xs[j], bottom]);
  }
  out.push([xs[m - 1], 2 * c - xs[m - 1], springY + rise * (m - .5) / m]);
  return out;
}

/**
 * Colliders for drawn masonry and roofs that had none, so bullets, sight and grenades stop where Fontessa looks solid
 * and nowhere else. Built from the same dimensions as the scenery (`fpsVillageLayout.ts`): every face stands within
 * about 4 cm of the drawn surface (pitched roofs and pyramids as nested bands, arches and turned stones as columns).
 * Nothing here holds an actor's centre line: the Mercato gate piers and the fontanella also block movement.
 * Deliberately not collided: cloth, foliage and branches, glass, ironwork, festoons, laundry, signs and thin wall dressing.
 */
export function buildFontessaVisualColliders(solids: readonly LiveSolid[]): LiveVisualCollider[] {
  const out: LiveVisualCollider[] = [], byId = new Map(solids.map(s => [s.id, s]));
  const add = (id: string, minX: number, maxX: number, baseY: number, height: number, minZ: number, maxZ: number, extra: Partial<LiveVisualCollider> = {}) => {
    out.push({ id: `visual-${id}`, minX, maxX, minZ, maxZ, baseY, height, color: '#a89c84', bulletPenetration: 0, surface: 'stone', ...extra });
  };
  const box = (id: string, x: number, y: number, z: number, w: number, h: number, d: number, extra: Partial<LiveVisualCollider> = {}) =>
    add(id, x - w / 2, x + w / 2, y - h / 2, y + h / 2, z - d / 2, z + d / 2, extra);
  /** A vertical round shape (cylinder or frustum, radius r0 at y0 to r1 at y1) as a cross of two slabs and a square
   * per level: about 0.1 r out at the slab corners and in between them, plus half a level's change in radius. */
  const round = (id: string, x: number, z: number, y0: number, y1: number, r0: number, r1: number, levels: number, extra: Partial<LiveVisualCollider> = {}) => {
    for (let k = 0; k < levels; k++) {
      const r = r0 + (r1 - r0) * (k + .5) / levels, ya = y0 + (y1 - y0) * k / levels, yb = y0 + (y1 - y0) * (k + 1) / levels;
      for (const [i, [hx, hz]] of [[r, .45 * r], [.45 * r, r], [.75 * r, .75 * r]].entries()) add(`${id}-${k}-${i}`, x - hx, x + hx, ya, yb, z - hz, z + hz, extra);
    }
  };
  const C = VILLAGE_CHIMNEY;
  const roof = (id: string, x: number, z: number, w: number, d: number, y: number, chimneys: boolean) => {
    // Tile panels are 12 cm slabs centred on the line from the eave edge (half, y) to the ridge (0, y + rise).
    const r = villageRoofShape(w, d), half = r.span / 2 + r.overhang, skin = .06 / Math.cos(Math.atan2(r.rise, half));
    const n = Math.max(3, Math.ceil(r.rise / ROOF_BAND_STEP)), end = r.run / 2 + r.gableOut + ROOF_BAND_PAST_GABLE;
    const put = (tag: string, across: number, along: number, y0: number, y1: number) => r.alongX
      ? add(`${id}-${tag}`, x - along, x + along, y0, y1, z - across, z + across)
      : add(`${id}-${tag}`, x - across, x + across, y0, y1, z - along, z + along);
    // Nested bands, each within rise / 2n of the tile top; the gable walls start at the eave line y.
    for (let k = 0; k < n; k++) put(`roof-${k}`, half * (1 - k / n), end, k === 0 ? y : y + skin + r.rise * (k - .5) / n, y + skin + r.rise * (k + .5) / n);
    // Below the eave line the tiles exist only over the eave overhangs (out to the verge); the walls fill the rest.
    for (const side of [-1, 1]) {
      const a = r.span / 2, along = r.run / 2 + r.verge, y0 = y - skin;
      if (r.alongX) add(`${id}-eave-${side}`, x - along, x + along, y0, y, side < 0 ? z - half : z + a, side < 0 ? z - a : z + half);
      else add(`${id}-eave-${side}`, side < 0 ? x - half : x + a, side < 0 ? x - a : x + half, y0, y, z - along, z + along);
    }
    put('ridge', .1, r.run / 2 + .24, y + r.rise - .08, y + r.rise + .08);
    if (chimneys) for (const [i, c] of villageRoofChimneys(r, x, z, y).entries()) {
      add(`${id}-chimney-shaft-${i}`, c.x - C.shaft / 2, c.x + C.shaft / 2, c.topY + C.shaftBottom, c.topY + C.shaftTop, c.z - C.shaft / 2, c.z + C.shaft / 2);
      add(`${id}-chimney-cap-${i}`, c.x - C.cap / 2, c.x + C.cap / 2, c.topY + C.capBottom, c.topY + C.capTop, c.z - C.cap / 2, c.z + C.cap / 2);
    }
  };

  // Every village house, shop and civic building carries a pitched roof above its collision top; buildings (not the
  // low pavilions) at least VILLAGE_CHIMNEY_MIN_HEIGHT tall carry chimneys (village architecture).
  for (const s of solids) {
    if (s.id.startsWith('mid-window-furniture-')) continue;
    const kind = liveVillageAsset(s.id).kind;
    if (kind === 'house' || kind === 'shop' || kind === 'civic')
      roof(s.id, (s.minX + s.maxX) / 2, (s.minZ + s.maxZ) / 2, s.maxX - s.minX, s.maxZ - s.minZ, s.height, s.height > 3.2 && s.height >= VILLAGE_CHIMNEY_MIN_HEIGHT);
  }
  const find = (id: string) => byId.get(id);
  for (const r of fontessaSlabRoofs(find)) roof(r.id, r.x, r.z, r.w, r.d, r.y, false);
  // B apartments lean-to: a 12 cm tile slab from the fascia up to the apartment wall on two thin gable walls. The
  // slit under its front edge stays open.
  const leanTo = fontessaGalleryLeanTo(find);
  if (leanTo) {
    const { wallX, lowX, frontX, lowY, highY, slabY } = leanTo, run = wallX - lowX, len = leanTo.maxZ - leanTo.minZ + .3, cz = (leanTo.minZ + leanTo.maxZ) / 2;
    const tiles = turnedRect((wallX + lowX) / 2, (highY + lowY) / 2 + .06, Math.hypot(run, highY - lowY) + .06, .12, Math.atan2(highY - lowY, run));
    for (const [i, [a0, a1, y0, y1]] of profileColumns([tiles], .04).entries()) add(`b-apartments-lean-to-${i}`, a0, a1, y0, y1, cz - len / 2, cz + len / 2);
    box('b-apartments-lean-to-fascia', lowX + .02, lowY + .03, cz, .06, .14, len);
    const gable: Pt[] = [[frontX, lowY + .01], [wallX, slabY], [wallX, highY]];
    for (const [g, ez] of [leanTo.minZ - .12, leanTo.maxZ + .12].entries())
      for (const [i, [a0, a1, y0, y1]] of profileColumns([gable], .04).entries()) add(`b-apartments-lean-to-gable-${g}-${i}`, a0, a1, y0, y1, ez - .03, ez + .03);
  }

  // Campanile belfry stage: corner piers, centre mullions, sill walls, arch heads over the eight openings, the impost
  // course, cornice, bell and headstock, then the pyramid roof and spire.
  const tower = byId.get('a-crates');
  if (tower) {
    const B = CAMPANILE_BELFRY, w = tower.maxX - tower.minX, d = tower.maxZ - tower.minZ, x = (tower.minX + tower.maxX) / 2, z = (tower.minZ + tower.maxZ) / 2;
    const top = tower.height, belfryTop = top + B.height, spring = top + B.springAbove, openW = (w - 2 * B.pier - B.mullion) / 2;
    for (const sx of [-1, 1]) for (const sz of [-1, 1])
      box(`a-crates-belfry-pier-${sx}-${sz}`, x + sx * (w / 2 - B.pier / 2), top + B.height / 2, z + sz * (d / 2 - B.pier / 2), B.pier, B.height, B.pier);
    for (const [plane, alongX, inward] of [[tower.minZ, true, 1], [tower.maxZ, true, -1], [tower.minX, false, 1], [tower.maxX, false, -1]] as const) {
      const a = Math.min(plane, plane + inward * B.wall), b = Math.max(plane, plane + inward * B.wall);
      const span = (from: number, to: number, y0: number, y1: number, tag: string) =>
        alongX ? add(`a-crates-belfry-${tag}`, from, to, y0, y1, a, b) : add(`a-crates-belfry-${tag}`, a, b, y0, y1, from, to);
      const centre = alongX ? x : z, start = centre - (alongX ? w : d) / 2;
      span(centre - B.mullion / 2, centre + B.mullion / 2, top, belfryTop, `mullion-${plane}`);
      for (const k of [0, 1]) {
        const from = start + B.pier + k * (openW + B.mullion), to = from + openW;
        span(from, to, top, top + B.sill, `sill-${plane}-${k}`);
        for (const [i, [a0, a1, y0]] of segmentalArchColumns(from, to, spring, B.rise, .04).entries()) span(a0, a1, y0, belfryTop - .1, `arch-${plane}-${k}-${i}`);
      }
    }
    box('a-crates-belfry-impost', x, spring - .04, z, w + .06, .08, d + .06);
    box('a-crates-belfry-cornice', x, belfryTop, z, w + .34, B.cornice, d + .34);
    box('a-crates-bell-crossbar', x, spring + .36, z, w - .7, .14, .18);
    // Bell: a frustum, radius .34 at the lip to .18 at the crown, .62 tall.
    round('a-crates-bell', x, z, spring - .31, spring + .31, .34, .18, 6);
    // Moulded stringcourses ring the tower shaft 8 cm proud.
    for (const y of [2.55, 4.02, 6.22]) box(`a-crates-stringcourse-${y}`, x, y, z, w + .16, .14, d + .16);
    // Pyramid roof (a four-sided cone turned 45 degrees: base side w + overhang, 0.22 m top diameter) in thin square bands.
    const roofBase = belfryTop + B.roofGap, s0 = (w + B.roofOverhang) / 2, s1 = .22 / 2 / Math.SQRT2, levels = Math.ceil(B.roofHeight / .09);
    for (let k = 0; k < levels; k++) {
      const s = s0 - (s0 - s1) * (k + .5) / levels;
      add(`a-crates-campanile-roof-${k}`, x - s, x + s, roofBase + B.roofHeight * k / levels, roofBase + B.roofHeight * (k + 1) / levels, z - s, z + s);
    }
    const spireBase = roofBase + B.roofHeight + .36 - .425;
    for (let k = 0; k < 3; k++) {
      const s = .85 * (.09 - .075 * (k + .5) / 3);
      add(`a-crates-campanile-spire-${k}`, x - s, x + s, spireBase + .85 * k / 3, spireBase + .85 * (k + 1) / 3, z - s, z + s);
    }
  }

  // Palazzo Comunale: loggia eave, capitals and the voussoir rings (the spandrels between the rings are open), the
  // pediment with its raking and base cornices, acroteria, and the clay tiles behind it down onto the portico.
  if (byId.has('a-loggia-wall')) {
    const { eave, capital, columns, columnZ, ring } = PALAZZO_PORTICO;
    add('palazzo-portico-eave', eave.minX, eave.maxX, eave.minY, eave.maxY, eave.minZ, eave.maxZ);
    for (const cx of columns) add(`palazzo-capital-${cx}`, cx - capital.half, cx + capital.half, capital.minY, capital.maxY, columnZ - capital.half, columnZ + capital.half);
    for (let bay = 0; bay < columns.length - 1; bay++) {
      const stones = palazzoArchVoussoirs(columns[bay], columns[bay + 1]).map(v => turnedRect(v.x, v.y, v.width, ring.thickness, v.angle));
      for (const [i, [a0, a1, y0, y1]] of profileColumns(stones, .04).entries()) add(`palazzo-arch-${bay}-${i}`, a0, a1, y0, y1, ring.z - ring.depth / 2, ring.z + ring.depth / 2);
    }
    const P = PALAZZO_PEDIMENT, cx = (P.left + P.right) / 2, halfW = (P.right - P.left) / 2, rise = P.apex - P.base, n = Math.ceil(rise / ROOF_BAND_STEP);
    for (let k = 0; k < n; k++)
      add(`palazzo-pediment-${k}`, cx - halfW * (1 - k / n), cx + halfW * (1 - k / n), k === 0 ? P.base : P.base + rise * (k - .5) / n, P.base + rise * (k + .5) / n, P.front, P.back);
    const rake = Math.atan2(rise, halfW), rakeLen = Math.hypot(halfW, rise) + .24;
    const raking = [-1, 1].map(side => turnedRect(cx + side * halfW / 2, (P.base + P.apex) / 2 + .07, rakeLen, .17, side < 0 ? rake : -rake));
    for (const [i, [a0, a1, y0, y1]] of profileColumns(raking, .04).entries()) add(`palazzo-raking-cornice-${i}`, a0, a1, y0, y1, P.front - .15, P.front + .07);
    box('palazzo-pediment-base-cornice', cx, P.base + .06, P.front - .05, P.right - P.left + .36, .14, .24);
    for (const [ax, ay] of [[cx, P.apex + .06], [P.left + .12, P.base + .16], [P.right - .12, P.base + .16]]) {
      box(`palazzo-acroterion-plinth-${ax}`, ax, ay + .09, P.front + .05, .24, .18, .24);
      box(`palazzo-acroterion-urn-${ax}`, ax, ay + .27, P.front + .05, .17, .204, .17);
    }
    // Tiles from the pediment back (z 25.4, y 4.2) up to the facade (26.38, 4.78) on two roof-end triangles. The
    // space under them stays hollow: the pediment is 25 cm wider than the facade each side, so it is open behind there.
    const tiles = turnedRect((25.4 + 26.38) / 2, (4.2 + 4.78) / 2 + .04, Math.hypot(26.38 - 25.4, 4.78 - 4.2), .1, Math.atan2(4.78 - 4.2, 26.38 - 25.4));
    for (const [i, [z0, z1, y0, y1]] of profileColumns([tiles], .04).entries()) add(`palazzo-portico-tiles-${i}`, P.left - .05, P.right + .05, y0, y1, z0, z1);
    const end: Pt[] = [[P.back, P.base], [26.4, P.base], [26.4, 4.8]];
    for (const [e, ex] of [P.left, P.right].entries())
      for (const [i, [z0, z1, y0, y1]] of profileColumns([end], .04).entries()) add(`palazzo-portico-roof-end-${e}-${i}`, ex - .03, ex + .03, y0, y1, z0, z1);
  }

  // Mercato gate: piers (which also block movement) on their plinths under impost blocks, the spandrel wall above
  // the segmental arch, frieze, astragal and cornice, and the terrace balustrades; stairwell cheeks.
  const passage = byId.get('b-sottoportego'), ground = FONTESSA_TERRAIN_RUNTIME.groundHeight;
  if (passage) {
    const A = MERCATO_ARCH, soffit = passage.baseY ?? 3.05, xc = (passage.minX + passage.maxX) / 2, half = passage.maxX - A.pier - xc;
    const frieze = A.friezeTop, railY = passage.height + .74, plinthY = passage.height + .08;
    for (const side of [-1, 1]) {
      const edge = side < 0 ? passage.minZ : passage.maxZ, out = edge + side * A.outer, inner = edge - side * A.inner, label = side < 0 ? 'south' : 'north';
      const pierMinZ = Math.min(out, inner) - .04, pierMaxZ = Math.max(out, inner) + .04, pierZ = (pierMinZ + pierMaxZ) / 2, pierD = pierMaxZ - pierMinZ;
      for (const [px, inward] of [[passage.minX + A.pier / 2, 1], [passage.maxX - A.pier / 2, -1]] as const) {
        const footing = Math.min(...[pierMinZ, pierMaxZ].flatMap(z => [px - A.pier / 2 + .02, px + A.pier / 2 - .02].map(x => ground({ x, z }))));
        const tag = `${label}-${inward > 0 ? 'west' : 'east'}`;
        add(`mercato-pier-${tag}`, px - A.pier / 2, px + A.pier / 2, footing - .02, A.springY, pierMinZ, pierMaxZ, { blocksMovement: true });
        box(`mercato-pier-plinth-${tag}`, px + inward * .03, footing + .17, pierZ, A.pier + .06, .34, pierD + .06);
        box(`mercato-pier-impost-${tag}`, px + inward * .035, A.springY - .05, pierZ, A.pier + .07, .12, pierD + .08);
      }
      const z0 = Math.min(out, inner), z1 = Math.max(out, inner);
      add(`mercato-spandrel-${label}-west`, passage.minX, xc - half, A.springY, soffit, z0, z1);
      add(`mercato-spandrel-${label}-east`, xc + half, passage.maxX, A.springY, soffit, z0, z1);
      for (const [i, [a0, a1, bottom]] of segmentalArchColumns(xc - half, xc + half, A.springY, A.rise, .03).entries())
        add(`mercato-spandrel-${label}-${i}`, a0, a1, bottom, soffit, z0, z1);
      box(`mercato-frieze-${label}`, xc, (soffit + frieze) / 2, edge + side * .07, passage.maxX - passage.minX, frieze - soffit, .14);
      box(`mercato-astragal-${label}`, xc, soffit + .01, edge + side * .17, passage.maxX - passage.minX, .06, .08);
      box(`mercato-cornice-${label}`, xc, frieze + .065, edge + side * .1, passage.maxX - passage.minX, .13, .3);
      box(`mercato-cornice-drip-${label}`, xc, frieze + .155, edge + side * .07, passage.maxX - passage.minX, .05, .24);
      // Balustrade: plinth, rail, three pedestals and the turned balusters between them (the gaps stay open).
      const railZ = edge - side * .12, low = plinthY + .08, high = railY - .05;
      box(`mercato-balustrade-plinth-${label}`, xc, plinthY, railZ, passage.maxX - passage.minX, .16, .22);
      box(`mercato-balustrade-rail-${label}`, xc, railY, railZ, passage.maxX - passage.minX, .1, .22);
      for (const px of [passage.minX + .16, xc, passage.maxX - .16]) box(`mercato-balustrade-pedestal-${label}-${px.toFixed(1)}`, px, (plinthY + railY) / 2, railZ, .2, railY - plinthY, .24);
      for (let bx = passage.minX + .46; bx < passage.maxX - .3; bx += .24) {
        if (Math.abs(bx - xc) < .2) continue;
        box(`mercato-baluster-${label}-${bx.toFixed(2)}`, bx, (low + high) / 2, railZ, .1, high - low, .1);
      }
    }
    // Under the slab: three timber beams on stone corbels and the joists over them (all above jump height).
    const beamY = soffit - .2, plankMinZ = passage.minZ + .18, plankMaxZ = passage.maxZ - .18;
    for (const z of [8.45, 9.5, 10.55]) {
      box(`mercato-ceiling-beam-${z}`, xc, beamY, z, passage.maxX - passage.minX, .18, .2);
      for (const x of [passage.minX + .08, passage.maxX - .08]) box(`mercato-beam-corbel-${z}-${x}`, x, beamY - .16, z, .16, .14, .28);
    }
    for (let x = passage.minX + .3; x < passage.maxX - .2; x += .45) box(`mercato-ceiling-joist-${x.toFixed(2)}`, x, soffit - .06, (plankMinZ + plankMaxZ) / 2, .08, .1, plankMaxZ - plankMinZ);
  }
  for (const stair of LIVE_CANAL_STAIRWELLS) for (const [i, cheek] of stair.cheeks.entries()) {
    const c = canalStairCheek(cheek);
    add(`${stair.id}-cheek-${i}`, c.minX, c.maxX, c.baseY, c.height, c.minZ, c.maxZ);
  }

  // Jade Lantern: facade piers 13 cm proud of the front wall, and the round eave tiles above the awning's collision.
  for (const x of [-8.78, -3.15, 3.15, 8.78]) add(`jade-front-pier-${x}`, x - .08, x + .08, .03, 2.93, -29.305, -29.135);
  // The tiles are round (0.32 m): the box stops at 3.38 m and 11 cm past the end tiles' axes, within 5 cm of both.
  add('jade-eave-tiles', -9.2 - .11, -9.2 + 57 * .322 + .11, 3.25, 3.38, -29.35, -27.95);
  // Trattoria (dining room) ceiling beams under the roof slab.
  for (const z of [-31.5, -37]) box(`trattoria-ceiling-beam-${z}`, 0, 4.31, z, 18, .18, .2);
  // B apartments gallery: the front cornice rises 8 cm above the gallery roof slab.
  box('b-apartments-front-cornice', 30.3, 4.5, 18, .34, .2, 8.65);
  // Cast-iron fontanella standpipe beside the arrival kiosk: column, cap, spout and basin. Its basin reaches 46 cm
  // out from the kiosk wall, past the actor radius, so it also keeps bodies out (they stood in the basin).
  const kiosk = byId.get('mid-approach-screen');
  if (kiosk) {
    const fx = (kiosk.minX + kiosk.maxX) / 2, fz = kiosk.minZ - .14, solid = { blocksMovement: true as const };
    round('village-fontanella-column', fx, fz, .015, 1.065, .11, .11, 1, solid);
    box('village-fontanella-cap', fx, 1.1, fz, .2, .24, .2, solid);
    box('village-fontanella-spout', fx, .74, fz - .14, .04, .04, .16, solid);
    round('village-fontanella-basin', fx, fz - .06, .03, .17, .17, .26, 3, solid);
  }
  // Proud stone: the B canal house balconies (fpsCanalWaterfront.ts) and the coffin maker's display ledge.
  for (const x of [23.4, 26.6]) box(`b-canal-balcony-slab-${x}`, x, 4.1, -2.08, 1.8, .14, .25);
  const coffins = byId.get('b-coffins');
  if (coffins) box('b-coffins-display-ledge', coffins.maxX + .13, 1.02, (coffins.minZ + coffins.maxZ) / 2, .24, .09, coffins.maxZ - coffins.minZ - .35);
  // The lookout desk's top sits on the desk solid and shares its wallbang.
  const desk = byId.get('mid-window-furniture-desk');
  if (desk) add('mid-window-furniture-desk-top', desk.minX - .03, desk.maxX + .03, desk.height, desk.height + .05, desk.minZ - .03, desk.maxZ + .03, { bulletPenetration: desk.bulletPenetration, surface: 'wood' });
  // Market stalls: counter tops (and the produce trays on them) stand above the stall solids and share their wallbang.
  for (const stall of VILLAGE_MARKET_STALLS) {
    const solid = byId.get(`market-stall-${stall.id}`), extra = { bulletPenetration: solid?.bulletPenetration ?? .38, surface: 'wood' as const };
    box(`market-stall-${stall.id}-counter-top`, stall.x, 1.04, stall.z, stall.w + .08, .08, stall.d + .08, extra);
    if (stall.id === 'produce') box('market-stall-produce-trays', stall.x, 1.11, stall.z, 1.49, .12, .78, extra);
  }

  // Central bridge: pilasters and their caps rise above the parapet.
  for (const side of [-1, 1]) for (const z of [LIVE_RIVER.minZ, 2.85, 5.62]) {
    const x = side * 1.66;
    add(`bridge-pilaster-${side}-${z}`, x - .16, x + .16, LIVE_BRIDGE.deckY, 1.9, z - .15, z + .15);
    add(`bridge-pilaster-cap-${side}-${z}`, x - .215, x + .215, 1.895, 2.025, z - .21, z + .21);
  }
  return out;
}
