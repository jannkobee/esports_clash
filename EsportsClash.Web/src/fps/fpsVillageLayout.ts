/**
 * Dimensions shared by pieces of Fontessa that are both drawn (village scenery) and collided
 * (`fpsVillageColliders.ts`), so a roof, arch or belfry can never look different from what stops a bullet.
 * Pure data: importable from the map definition without an import cycle.
 */

/**
 * Pitched clay roof over a w by d footprint; the ridge runs along the long side. Tile panels (12 cm thick) run from
 * the eave edge, `overhang` past the walls, up to the ridge, and `verge` past the walls at each gable end; the
 * gable walls stand 2.5 to `gableOut` (9.5 cm) past the walls.
 */
export interface VillageRoofShape { alongX: boolean; span: number; run: number; rise: number; overhang: number; verge: number; gableOut: number }
export function villageRoofShape(w: number, d: number): VillageRoofShape {
  const alongX = w > d * 1.15, span = alongX ? d : w, run = alongX ? w : d;
  return { alongX, span, run, rise: Math.min(1.25, .28 + span * .055), overhang: .18, verge: .185, gableOut: .095 };
}
/** Buildings (not pavilions, slab roofs or the campanile) at least this tall carry chimneys on their roof. */
export const VILLAGE_CHIMNEY_MIN_HEIGHT = 5.2;
/** Chimney stack dimensions relative to `topY`: a 48 cm shaft and a 60 cm cap (the clay pot above is not solid). */
export const VILLAGE_CHIMNEY = Object.freeze({ shaft: .48, shaftBottom: -.11, shaftTop: .67, cap: .6, capBottom: .65, capTop: .73 });
/** Chimney positions on a roof over (x, z) with eaves at y. */
export function villageRoofChimneys(r: VillageRoofShape, x: number, z: number, y: number): { x: number; z: number; topY: number }[] {
  const count = r.run >= 11 ? 2 : 1;
  return Array.from({ length: count }, (_, i) => {
    const along = count === 1 ? -r.run * .18 : (i === 0 ? -r.run * .28 : r.run * .24);
    return { x: r.alongX ? x + along : x + (i % 2 ? -.65 : .65), z: r.alongX ? z + (i % 2 ? -.55 : .55) : z + along, topY: y + r.rise * .82 };
  });
}

interface Footprint { minX: number; maxX: number; minZ: number; maxZ: number; height: number }
export interface VillageRoofSpec { id: string; x: number; z: number; w: number; d: number; y: number; color: string }
/** Pitched roofs over the flat cutaway slabs: the Mid lookout, its civic annex and the Jade Lantern dining room. */
export function fontessaSlabRoofs(find: (id: string) => Footprint | undefined): VillageRoofSpec[] {
  const house = find('mid-window-roof'), civic = find('mid-window-civic-roof'), passage = find('mid-window-passage-roof'), dining = find('restaurant-roof');
  const specs: VillageRoofSpec[] = [];
  const over = (id: string, f: Footprint, color: string, minX = f.minX, maxX = f.maxX) =>
    specs.push({ id, x: (minX + maxX) / 2, z: (f.minZ + f.maxZ) / 2, w: maxX - minX, d: f.maxZ - f.minZ, y: f.height, color });
  if (house) over('mid-window-house', house, '#a96548');
  // The lower annex roof stops short of the lookout's eave so the two roofs meet rather than cross.
  if (civic && passage) over('mid-window-annex', civic, '#a96548', civic.minX, Math.min(passage.maxX, (house?.minX ?? passage.maxX) - .25));
  if (dining) over('jade-lantern-dining', dining, '#a97451');
  return specs;
}
/** Lean-to over the B apartments gallery, under the apartment's upper window frames and over its front cornice. */
export function fontessaGalleryLeanTo(find: (id: string) => Footprint | undefined) {
  const gallery = find('b-apartments-roof'), apartments = find('b-apartments-back');
  if (!gallery || !apartments) return undefined;
  return { wallX: apartments.minX, lowX: gallery.minX - .18, frontX: gallery.minX, lowY: 4.63, highY: 4.98, slabY: gallery.height, minZ: gallery.minZ, maxZ: gallery.maxZ };
}

/** The Mercato di Fontessa gate over the B sottoportego (relative to the passage solid). */
export const MERCATO_ARCH = Object.freeze({ pier: .26, springY: 2.3, rise: .52, friezeTop: 3.42, outer: .14, inner: .18 });

/** Canal access stairs cut down from street level, with the sides that need retaining cheeks. */
export const LIVE_CANAL_STAIRWELLS = Object.freeze([
  { id: 'canal-market-north-stair', cheeks: [{ x: 18.8, side: -1, minZ: 5.6, maxZ: 9.2 }, { x: 21.2, side: 1, minZ: 5.6, maxZ: 7.4 }, { x: 21.2, side: -1, minZ: 7.4, maxZ: 9.2 }] },
  { id: 'canal-west-stair', cheeks: [{ x: -20.5, side: -1, minZ: 5.6, maxZ: 9.2 }, { x: -18.5, side: 1, minZ: 5.6, maxZ: 9.2 }] },
  { id: 'canal-apartment-stair', cheeks: [{ x: 28.4, side: -1, minZ: 5.6, maxZ: 8 }, { x: 30.4, side: 1, minZ: 2.9, maxZ: 8 }] },
] as const);
/** Retaining cheek box for one side of a stairwell (cheeks meeting the quay wall start just behind its face). */
export function canalStairCheek(cheek: { x: number; side: number; minZ: number; maxZ: number }) {
  const minZ = cheek.minZ === 5.6 ? 5.62 : cheek.minZ;
  return { minX: cheek.x + (cheek.side < 0 ? -.2 : 0), maxX: cheek.x + (cheek.side < 0 ? 0 : .2), minZ, maxZ: cheek.maxZ, baseY: -1.4, height: 0 };
}

/** Open belfry stage on the campanile, above the tower's collision top. */
export const CAMPANILE_BELFRY = Object.freeze({
  height: 1.7, springAbove: .95, rise: .42, pier: .5, mullion: .3, wall: .5, sill: .36, cornice: .2, roofGap: .1, roofHeight: 1.9, roofOverhang: .5,
});

/** Palazzo Comunale portico pediment (world coordinates). */
export const PALAZZO_PEDIMENT = Object.freeze({ left: -28.05, right: -17.95, base: 4.05, apex: 5.5, front: 24.84, back: 25.4 });

/** Palazzo Comunale portico: columns, capitals, the loggia eave and the elliptical arch rings between the columns. */
export const PALAZZO_PORTICO = Object.freeze({
  columns: [-27.5, -24.6, -21.4, -18.5] as const, columnZ: 26,
  capital: { half: .34, minY: 3.64, maxY: 3.82 },
  eave: { minX: -28.05, maxX: -17.95, minY: 3.83, maxY: 4.05, minZ: 24.85, maxZ: 26.45 },
  ring: { springY: 3.05, rise: .66, z: 25.95, depth: .38, thickness: .16, stones: 11, inset: .12 },
});
/** Voussoirs of the arch ring between two columns: centre, width along the ring and turn about z (Babylon rotation.z). */
export function palazzoArchVoussoirs(fromX: number, toX: number): { x: number; y: number; width: number; angle: number }[] {
  const R = PALAZZO_PORTICO.ring, mid = (fromX + toX) / 2, half = (toX - fromX) / 2 - R.inset;
  return Array.from({ length: R.stones }, (_, i) => {
    const t = (i + .5) / R.stones * Math.PI;
    // Voussoir width follows the local arc length so the flatter crown has no gaps between stones.
    const arc = Math.PI / R.stones * Math.hypot(half * Math.sin(t), R.rise * Math.cos(t));
    return { x: mid - Math.cos(t) * half, y: R.springY + Math.sin(t) * R.rise, width: Math.max(.28, arc + .02), angle: Math.atan2(Math.cos(t) * R.rise, Math.sin(t) * half) };
  });
}
