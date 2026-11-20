/**
 * Dimensions shared by pieces of Fontessa that are both drawn (village scenery) and collided
 * (`fpsVillageColliders.ts`), so a roof, arch or belfry can never look different from what stops a bullet.
 * Pure data: importable from the map definition without an import cycle.
 */

export interface VillageRoofShape { alongX: boolean; span: number; run: number; rise: number; overhang: number }
/** Pitched clay roof over a w by d footprint; the ridge runs along the long side. */
export function villageRoofShape(w: number, d: number): VillageRoofShape {
  const alongX = w > d * 1.15, span = alongX ? d : w, run = alongX ? w : d;
  return { alongX, span, run, rise: Math.min(1.25, .28 + span * .055), overhang: .18 };
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
