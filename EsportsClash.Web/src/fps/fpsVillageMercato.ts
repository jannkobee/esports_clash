import { Color3, Mesh, MeshBuilder, StandardMaterial, type Scene } from '@babylonjs/core';
import { MeshDraft, type DraftPoint as Point3 } from './fpsVillageMeshDraft.ts';
import { LIVE_FPS_MAP } from './fpsLiveMap.ts';
import { FONTESSA_TERRAIN_RUNTIME } from './fpsLiveTerrain.ts';
import { liveBoxSurfaceUV, LIVE_SURFACE_BOX_WRAP, LIVE_SURFACE_METRES, type LiveSurface, type LiveSurfaceLibrary } from './fpsLiveGraphics.ts';
import type { VillageBuilder } from './fpsVillageArchitecture.ts';
import { liveTintMesh, LIVE_TINT_BASE } from './fpsVillageTint.ts';
import { canalStairCheek, LIVE_CANAL_STAIRWELLS, MERCATO_ARCH } from './fpsVillageLayout.ts';

/**
 * The Mercato di Fontessa gate: the low covered passage (`b-sottoportego`) between the freight office and the
 * market residences, entered from the canal stair. Visual only. Every piece sits inside an admitted solid, on the
 * unreachable roof of the passage, inside the stair cheeks, or within 0.15 m of a wall, so collision, sightlines
 * and routes are unchanged.
 */
const PASSAGE = LIVE_FPS_MAP.solids.find(solid => solid.id === 'b-sottoportego');
const { pier: PIER, springY: SPRING_Y, rise: RISE, friezeTop: FRIEZE_TOP } = MERCATO_ARCH;
export { LIVE_CANAL_STAIRWELLS };

export const MERCATO_GATE = PASSAGE ? Object.freeze({
  minX: PASSAGE.minX, maxX: PASSAGE.maxX, southZ: PASSAGE.minZ, northZ: PASSAGE.maxZ,
  soffitY: PASSAGE.baseY ?? 3.05, roofY: PASSAGE.height, springY: SPRING_Y, crownY: SPRING_Y + RISE,
  /** Front planes of the two friezes, where the painted gate inscriptions are mounted, and their centre line. */
  southFaceZ: PASSAGE.minZ - .14, northFaceZ: PASSAGE.maxZ + .14, signY: 3.265,
}) : undefined;



export function buildMercatoGate(scene: Scene, b: VillageBuilder, surfaces?: LiveSurfaceLibrary): void {
  if (!PASSAGE || !MERCATO_GATE) return;
  const gate = MERCATO_GATE, ground = FONTESSA_TERRAIN_RUNTIME.groundHeight;
  // Colours are baked into vertex colours: props share one plain material, textured pieces one per surface kind.
  const detail = <T extends Mesh>(mesh: T, color: string) => b.detail(liveTintMesh(mesh, color), LIVE_TINT_BASE);
  const surface = (mesh: Mesh, kind: LiveSurface, color: string, zOffset?: number) => {
    // Occlusion overlays keep their own per-vertex shading and a stronger polygon offset.
    if (zOffset !== undefined) { b.detail(mesh, color); if (surfaces) mesh.material = surfaces.material(kind, color, zOffset); return mesh; }
    detail(mesh, color); if (surfaces) mesh.material = surfaces.material(kind, LIVE_TINT_BASE); return mesh;
  };
  const block = (name: string, kind: LiveSurface, x: number, y: number, z: number, w: number, h: number, d: number, color: string) => {
    const mesh = MeshBuilder.CreateBox(name, { width: w, height: h, depth: d, faceUV: liveBoxSurfaceUV(w, h, d, LIVE_SURFACE_METRES[kind]), wrap: LIVE_SURFACE_BOX_WRAP }, scene);
    mesh.position.set(x, y, z); return surface(mesh, kind, color);
  };
  const plain = (name: string, x: number, y: number, z: number, w: number, h: number, d: number, color: string) => {
    const mesh = detail(MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene), color); mesh.position.set(x, y, z); return mesh;
  };
  const STONE = '#cdbf9f', STONE_DARK = '#b8a988', TRIM = '#ddd1b3', IRON = '#2f3532', TIMBER = '#5f4532';
  const xc = (gate.minX + gate.maxX) / 2, half = gate.maxX - PIER - xc, radius = (half * half + RISE * RISE) / (2 * RISE);
  const yc = SPRING_Y + RISE - radius, archY = (x: number) => Math.abs(x - xc) >= half ? SPRING_Y : yc + Math.sqrt(radius * radius - (x - xc) ** 2);

  for (const side of [-1, 1] as const) {
    const edge = side < 0 ? gate.southZ : gate.northZ, out = edge + side * MERCATO_ARCH.outer, inner = edge - side * MERCATO_ARCH.inner;
    const label = side < 0 ? 'south' : 'north';
    // Spandrels: one closed masonry wall with the segmental opening cut from it, both faces and the soffit.
    const wall = new MeshDraft(), steps = 28, m = LIVE_SURFACE_METRES.stone;
    for (let i = 0; i < steps; i++) {
      const x0 = gate.minX + (gate.maxX - gate.minX) * i / steps, x1 = gate.minX + (gate.maxX - gate.minX) * (i + 1) / steps;
      const y0 = archY(x0), y1 = archY(x1);
      for (const [z, n] of [[out, side], [inner, -side]] as const) wall.quad(
        [{ x: x0, y: y0, z }, { x: x1, y: y1, z }, { x: x1, y: gate.soffitY, z }, { x: x0, y: gate.soffitY, z }],
        { x: 0, y: 0, z: n }, [[x0 / m, y0 / m], [x1 / m, y1 / m], [x1 / m, gate.soffitY / m], [x0 / m, gate.soffitY / m]]);
      if (Math.abs((x0 + x1) / 2 - xc) < half) {
        const mx = (x0 + x1) / 2, my = archY(mx), len = Math.hypot(mx - xc, my - yc);
        wall.quad([{ x: x0, y: y0, z: out }, { x: x1, y: y1, z: out }, { x: x1, y: y1, z: inner }, { x: x0, y: y0, z: inner }],
          { x: (xc - mx) / len, y: (yc - my) / len, z: 0 }, [[x0 / m, out / m], [x1 / m, out / m], [x1 / m, inner / m], [x0 / m, inner / m]]);
      }
    }
    surface(wall.build(`b-passage-spandrel-${label}`, scene), 'stone', STONE);
    // Voussoirs a hair proud of both faces leave real joints, with a deeper keystone at the crown.
    const left = Math.atan2(archY(xc - half) - yc, -half), right = Math.atan2(archY(xc + half) - yc, half), count = 15;
    for (let i = 0; i < count; i++) {
      const angle = left + (right - left) * (i + .5) / count, key = i === (count - 1) / 2, depth = key ? .37 : .31;
      const width = radius * Math.abs(right - left) / count - .016, r = radius - .012 + depth / 2;
      const stone = block(`b-passage-arch-voussoir-${label}-${i}`, 'stone', xc + Math.cos(angle) * r, yc + Math.sin(angle) * r,
        (out + inner) / 2 + (key ? side * .012 : 0), width + (key ? .06 : 0), depth, Math.abs(out - inner) + (key ? .07 : .04), i % 2 ? TRIM : STONE);
      stone.rotation.z = angle - Math.PI / 2;
    }
    // Piers carry the arch down to whatever they stand on, including the stair treads on the east side.
    const pierMinZ = Math.min(out, inner) - .04, pierMaxZ = Math.max(out, inner) + .04, pierZ = (pierMinZ + pierMaxZ) / 2, pierD = pierMaxZ - pierMinZ;
    for (const [px, inward] of [[gate.minX + PIER / 2, 1], [gate.maxX - PIER / 2, -1]] as const) {
      const footing = Math.min(...[pierMinZ, pierMaxZ].flatMap(z => [px - PIER / 2 + .02, px + PIER / 2 - .02].map(x => ground({ x, z }))));
      const base = footing - .02, tag = `${label}-${inward > 0 ? 'west' : 'east'}`;
      block(`b-passage-pier-${tag}`, 'stone', px, (base + SPRING_Y) / 2, pierZ, PIER, SPRING_Y - base, pierD, STONE);
      block(`b-passage-plinth-${tag}`, 'stone', px + inward * .03, footing + .17, pierZ, PIER + .06, .34, pierD + .06, STONE_DARK);
      block(`b-passage-impost-${tag}`, 'stone', px + inward * .035, SPRING_Y - .05, pierZ, PIER + .07, .12, pierD + .08, TRIM);
    }
    // Frieze over the slab edge (it carries the painted name), astragal and a projecting cornice.
    const friezeZ = edge + side * .07;
    block(side < 0 ? 'b-passage-lintel-7.87' : 'b-passage-lintel-11.13', 'stone', xc, (gate.soffitY + FRIEZE_TOP) / 2, friezeZ, gate.maxX - gate.minX, FRIEZE_TOP - gate.soffitY, .14, STONE);
    block(`b-passage-astragal-${label}`, 'stone', xc, gate.soffitY + .01, edge + side * .17, gate.maxX - gate.minX, .06, .08, TRIM);
    block(`b-passage-cornice-${label}`, 'stone', xc, FRIEZE_TOP + .065, edge + side * .1, gate.maxX - gate.minX, .13, .3, TRIM);
    block(`b-passage-cornice-drip-${label}`, 'stone', xc, FRIEZE_TOP + .155, edge + side * .07, gate.maxX - gate.minX, .05, .24, STONE_DARK);

    // Roof terrace balustrade, set back on the slab behind the cornice.
    const railZ = edge - side * .12, plinthY = gate.roofY + .08, railY = gate.roofY + .74;
    const balusterLow = plinthY + .08, balusterHigh = railY - .05;
    block(`b-passage-balustrade-plinth-${label}`, 'stone', xc, plinthY, railZ, gate.maxX - gate.minX, .16, .22, STONE);
    block(`b-passage-balustrade-rail-${label}`, 'stone', xc, railY, railZ, gate.maxX - gate.minX, .1, .22, TRIM);
    for (const px of [gate.minX + .16, xc, gate.maxX - .16]) block(`b-passage-balustrade-pedestal-${label}-${px.toFixed(1)}`, 'stone', px, (plinthY + railY) / 2, railZ, .2, railY - plinthY, .24, STONE);
    for (let x = gate.minX + .46; x < gate.maxX - .3; x += .24) {
      if (Math.abs(x - xc) < .2) continue;
      const baluster = detail(MeshBuilder.CreateCylinder(`b-passage-baluster-${label}-${x.toFixed(2)}`, { height: balusterHigh - balusterLow, diameterTop: .075, diameterBottom: .13, tessellation: 8 }, scene), TRIM);
      baluster.position.set(x, (balusterLow + balusterHigh) / 2, railZ);
    }
    for (let i = 0; i < 6; i++) {
      const flower = detail(MeshBuilder.CreateSphere(`b-passage-rail-geranium-${label}-${i}`, { diameter: .19, segments: 6 }, scene), i % 3 ? '#b8423a' : '#d76a54');
      flower.position.set(gate.minX + .7 + i * .7, railY + .12, railZ); flower.scaling.y = .7;
    }
    block(`b-passage-rail-flowerbox-${label}`, 'clay', xc, railY + .07, railZ, 3.9, .07, .16, '#a8613f');
  }

  // Inside: heavy timber beams on stone corbels, joists over them and planking across the joists.
  const beamY = gate.soffitY - .2, plankMinZ = gate.southZ + .18, plankMaxZ = gate.northZ - .18;
  for (const z of [8.45, 9.5, 10.55]) {
    block(`b-passage-ceiling-beam-${z}`, 'timber', xc, beamY, z, gate.maxX - gate.minX, .18, .2, TIMBER);
    for (const x of [gate.minX + .08, gate.maxX - .08]) block(`b-passage-beam-corbel-${z}-${x}`, 'stone', x, beamY - .16, z, .16, .14, .28, STONE_DARK);
  }
  for (let x = gate.minX + .3; x < gate.maxX - .2; x += .45) block(`b-passage-ceiling-joist-${x.toFixed(2)}`, 'timber', x, gate.soffitY - .06, (plankMinZ + plankMaxZ) / 2, .08, .1, plankMaxZ - plankMinZ, '#6c5039');
  const planks = new MeshDraft(), plankY = gate.soffitY - .006, grain = LIVE_SURFACE_METRES.timber;
  // Timber texture planks run along V, so V follows x to lay the boards across the joists.
  planks.quad([{ x: gate.minX, y: plankY, z: plankMinZ }, { x: gate.maxX, y: plankY, z: plankMinZ }, { x: gate.maxX, y: plankY, z: plankMaxZ }, { x: gate.minX, y: plankY, z: plankMaxZ }],
    { x: 0, y: -1, z: 0 }, [[0, gate.minX / grain], [0, gate.maxX / grain], [(plankMaxZ - plankMinZ) / grain, gate.maxX / grain], [(plankMaxZ - plankMinZ) / grain, gate.minX / grain]]);
  surface(planks.build('b-passage-ceiling-planks', scene), 'timber', '#7a5c42');
  // Hung from the middle beam with its base at 2.39 m, clear of a jumping player's head.
  const chain = detail(MeshBuilder.CreateCylinder('b-passage-lantern-chain', { height: .12, diameter: .02, tessellation: 5 }, scene), IRON);
  chain.position.set(xc, beamY - .15, 9.5);
  plain('b-passage-lantern-cap', xc, beamY - .23, 9.5, .26, .05, .26, IRON);
  for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) plain(`b-passage-lantern-frame-${dx}-${dz}`, xc + dx * .1, beamY - .34, 9.5 + dz * .1, .025, .2, .025, IRON);
  const glass = MeshBuilder.CreateBox('b-passage-lantern-glass', { width: .18, height: .16, depth: .18 }, scene);
  glass.position.set(xc, beamY - .34, 9.5);
  const glassMat = new StandardMaterial('b-passage-lantern-glass-mat', scene);
  glassMat.diffuseColor = new Color3(.86, .74, .5); glassMat.emissiveColor = new Color3(.34, .24, .1); glassMat.specularColor = new Color3(.5, .45, .35);
  glass.material = glassMat; glass.isPickable = false; glass.receiveShadows = true;
  glass.metadata = { castShadow: false };
  plain('b-passage-lantern-base', xc, beamY - .45, 9.5, .22, .04, .22, IRON);

  // Edicola votiva on the freight-office wall: arched stone frame, painted panel, candle shelf and flowers.
  const shrineX = gate.minX + .01, shrineZ = 9.95;
  block('b-passage-shrine-frame', 'stone', shrineX + .04, 1.95, shrineZ, .08, .86, .66, TRIM);
  plain('b-passage-shrine-panel', shrineX + .085, 1.92, shrineZ, .012, .64, .46, '#24415f');
  // Icon: gold halo, face, and a blue mantle over a cream robe as apex-up triangles (discs rolled a quarter turn).
  const icon = (name: string, radius: number, tessellation: number, y: number, out: number, color: string) => {
    const disc = detail(MeshBuilder.CreateDisc(name, { radius, tessellation }, scene), color);
    disc.rotation.set(0, -Math.PI / 2, tessellation === 3 ? Math.PI / 2 : 0); disc.position.set(shrineX + out, y, shrineZ); return disc;
  };
  icon('b-passage-shrine-halo', .085, 18, 2.1, .093, '#c9a24e');
  icon('b-passage-shrine-face', .045, 14, 2.09, .096, '#e3c9a8');
  icon('b-passage-shrine-mantle', .22, 3, 1.86, .095, '#2f5f8f');
  icon('b-passage-shrine-robe', .12, 3, 1.8, .098, '#e2d6bd');
  // Discs face -z; turned a quarter about y they face into the passage (+x), the half disc reading as an arch.
  const tympanum = detail(MeshBuilder.CreateDisc('b-passage-shrine-tympanum', { radius: .33, tessellation: 18, arc: .5 }, scene), TRIM);
  tympanum.rotation.y = -Math.PI / 2; tympanum.position.set(shrineX + .081, 2.38, shrineZ);
  block('b-passage-shrine-canopy', 'stone', shrineX + .07, 2.74, shrineZ, .14, .05, .8, STONE_DARK);
  block('b-passage-shrine-shelf', 'stone', shrineX + .07, 1.47, shrineZ, .13, .05, .5, STONE_DARK);
  for (const dz of [-.15, .15]) {
    const candle = detail(MeshBuilder.CreateCylinder(`b-passage-shrine-candle-${dz}`, { height: .11, diameter: .035, tessellation: 8 }, scene), '#efe6cf');
    candle.position.set(shrineX + .08, 1.55, shrineZ + dz);
  }
  const vase = detail(MeshBuilder.CreateCylinder('b-passage-shrine-vase', { height: .1, diameterTop: .05, diameterBottom: .07, tessellation: 10 }, scene), '#c6ad7a');
  vase.position.set(shrineX + .08, 1.545, shrineZ);
  for (let i = 0; i < 3; i++) {
    const bloom = detail(MeshBuilder.CreateSphere(`b-passage-shrine-bloom-${i}`, { diameter: .06, segments: 5 }, scene), ['#d9d1c0', '#c44d45', '#e3b94f'][i]);
    bloom.position.set(shrineX + .08, 1.63 + (i % 2) * .02, shrineZ - .03 + i * .03);
  }

  // Ambient occlusion under the roof: the walkable half and the covered treads darken toward the middle.
  const shadeAt = (x: number, z: number) => {
    const inZ = Math.min(1, Math.max(0, Math.min(z - (gate.southZ - .35), (gate.northZ + .35) - z) / .9));
    const wall = Math.min(1, Math.max(0, Math.min(x - gate.minX, gate.maxX - x) / .5));
    return 1 - inZ * (.24 + (1 - wall) * .06);
  };
  const occlusion = (name: string, minX: number, maxX: number, minZ: number, maxZ: number, y: number, kind: LiveSurface, color: string, u0: number, v0: number, flipV: boolean) => {
    const draft = new MeshDraft(), nx = Math.max(1, Math.round((maxX - minX) / .45)), nz = Math.max(1, Math.round((maxZ - minZ) / .3)), m = LIVE_SURFACE_METRES[kind];
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      const xs = [minX + (maxX - minX) * i / nx, minX + (maxX - minX) * (i + 1) / nx], zs = [minZ + (maxZ - minZ) * j / nz, minZ + (maxZ - minZ) * (j + 1) / nz];
      const corners: [number, number][] = [[xs[0], zs[0]], [xs[1], zs[0]], [xs[1], zs[1]], [xs[0], zs[1]]];
      draft.quad(corners.map(([x, z]) => ({ x, y, z })) as [Point3, Point3, Point3, Point3], { x: 0, y: 1, z: 0 },
        corners.map(([x, z]) => [(x - u0) / m, (flipV ? v0 - z : z - v0) / m] as [number, number]), corners.map(([x, z]) => shadeAt(x, z)));
    }
    const mesh = draft.build(name, scene); surface(mesh, kind, color, -1.2); mesh.metadata = { castShadow: false };
  };
  // UV origins match the street piece (west edge 15, north edge 14) and each tread's own box face, so setts line up.
  occlusion('b-passage-occlusion-floor', gate.minX, 18.8, gate.southZ - .35, gate.northZ + .35, .014, 'paving', '#aaa084', 15, 14, true);
  for (const tread of FONTESSA_TERRAIN_RUNTIME.groundPatches.filter(p => p.id?.startsWith('canal-market-north-stair-') && p.maxZ > gate.southZ - .35)) {
    occlusion(`b-passage-occlusion-${tread.id}`, tread.minX, gate.maxX, Math.max(tread.minZ, gate.southZ - .35), tread.maxZ, tread.height + .004, 'stone', '#b0a58b', tread.minX, tread.minZ, false);
  }

  // Roof terrace: cotto floor, lemon trees in terracotta pots, a bistro set and the glazed door it belongs to.
  const terrace = MeshBuilder.CreateGround('b-passage-terrace-cotto', { width: gate.maxX - gate.minX, height: gate.northZ - gate.southZ }, scene);
  terrace.position.set(xc, gate.roofY + .006, (gate.southZ + gate.northZ) / 2);
  surface(terrace, 'paving', '#a8735a'); terrace.metadata = { castShadow: false };
  // 30 cm cotto squares: the paving texture holds eight setts per repeat.
  const tileRepeat = 2.4, tw = (gate.maxX - gate.minX) / tileRepeat, td = (gate.northZ - gate.southZ) / tileRepeat;
  terrace.setVerticesData('uv', [0, 0, tw, 0, 0, td, tw, td]);
  for (const [px, pz] of [[gate.minX + .45, 10.62], [gate.maxX - .45, 8.4]] as const) {
    const pot = detail(MeshBuilder.CreateCylinder(`b-passage-lemon-pot-${pz}`, { height: .46, diameterTop: .52, diameterBottom: .36, tessellation: 14 }, scene), '#b2643f');
    pot.position.set(px, gate.roofY + .23, pz);
    const trunk = detail(MeshBuilder.CreateCylinder(`b-passage-lemon-trunk-${pz}`, { height: .62, diameter: .06, tessellation: 6 }, scene), '#6a5340');
    trunk.position.set(px, gate.roofY + .74, pz);
    for (let i = 0; i < 5; i++) {
      const a = i * 2.4, crown = detail(MeshBuilder.CreateSphere(`b-passage-lemon-crown-${pz}-${i}`, { diameter: .46, segments: 7 }, scene), i % 2 ? '#4f6b3b' : '#5d7a43');
      crown.position.set(px + Math.cos(a) * .17, gate.roofY + 1.16 + (i % 2) * .12, pz + Math.sin(a) * .17);
    }
    for (let i = 0; i < 6; i++) {
      const a = i * 1.7 + pz, fruit = detail(MeshBuilder.CreateSphere(`b-passage-lemon-${pz}-${i}`, { diameter: .07, segments: 5 }, scene), '#e3c23f');
      fruit.position.set(px + Math.cos(a) * .29, gate.roofY + 1.05 + (i % 3) * .1, pz + Math.sin(a) * .29);
    }
  }
  const tableX = gate.maxX - .75, tableZ = 9.9;
  const top = detail(MeshBuilder.CreateCylinder('b-passage-terrace-table-top', { height: .03, diameter: .62, tessellation: 18 }, scene), '#3e4a44');
  top.position.set(tableX, gate.roofY + .72, tableZ);
  const stem = detail(MeshBuilder.CreateCylinder('b-passage-terrace-table-stem', { height: .7, diameter: .05, tessellation: 6 }, scene), IRON);
  stem.position.set(tableX, gate.roofY + .36, tableZ);
  for (const dz of [-.55, .55]) {
    plain(`b-passage-terrace-chair-seat-${dz}`, tableX, gate.roofY + .45, tableZ + dz, .38, .03, .38, '#3e4a44');
    plain(`b-passage-terrace-chair-back-${dz}`, tableX, gate.roofY + .7, tableZ + dz * 1.32, .38, .46, .03, '#3e4a44');
    for (const [lx, lz] of [[-.16, -.16], [.16, -.16], [.16, .16], [-.16, .16]]) plain(`b-passage-terrace-chair-leg-${dz}-${lx}-${lz}`, tableX + lx, gate.roofY + .22, tableZ + dz + lz, .025, .44, .025, IRON);
  }
  // Between the house's 5.75 m windows (z 7.3 and 10.1), so the door never runs into a frame or planter.
  const doorZ = 8.7, doorTop = gate.roofY + 2;
  block('b-passage-terrace-door-surround', 'stone', gate.minX + .03, (gate.roofY + doorTop) / 2 + .05, doorZ, .06, doorTop - gate.roofY + .1, 1.3, TRIM);
  plain('b-passage-terrace-door-glazing', gate.minX + .065, (gate.roofY + doorTop) / 2, doorZ, .02, doorTop - gate.roofY - .12, 1.0, '#2d4246');
  plain('b-passage-terrace-door-mullion', gate.minX + .08, (gate.roofY + doorTop) / 2, doorZ, .02, doorTop - gate.roofY - .12, .05, '#d9d0bb');
  for (const dz of [-1, 1]) plain(`b-passage-terrace-door-shutter-${dz}`, gate.minX + .04, (gate.roofY + doorTop) / 2, doorZ + dz * .92, .04, doorTop - gate.roofY - .16, .52, '#3f6b52');
  plain('b-passage-terrace-door-sill', gate.minX + .1, gate.roofY + .02, doorZ, .2, .04, 1.2, TRIM);

  // Stairwell cheeks: dressed retaining walls under each cut, a pale kerb on the street edge and tread nosings.
  for (const stair of LIVE_CANAL_STAIRWELLS) {
    for (const [i, cheek] of stair.cheeks.entries()) {
      // The same box is a collider (fpsVillageColliders.ts): a retaining wall stops bullets.
      const c = canalStairCheek(cheek);
      block(`${stair.id}-cheek-${i}`, 'stone', (c.minX + c.maxX) / 2, (c.baseY + c.height) / 2, (c.minZ + c.maxZ) / 2, c.maxX - c.minX, c.height - c.baseY, c.maxZ - c.minZ, '#a69c83');
      if (ground({ x: cheek.x + cheek.side * .3, z: (cheek.minZ + cheek.maxZ) / 2 }) > -.05)
        block(`${stair.id}-kerb-${i}`, 'stone', cheek.x + cheek.side * .07, .009, (cheek.minZ + cheek.maxZ) / 2, .14, .018, cheek.maxZ - cheek.minZ, '#d9cfb6');
    }
    for (const tread of FONTESSA_TERRAIN_RUNTIME.groundPatches.filter(p => p.id?.startsWith(`${stair.id}-`))) {
      if (tread.height < -1.15) continue;
      plain(`${tread.id}-nosing`, (tread.minX + tread.maxX) / 2, tread.height - .008, tread.minZ + .025, tread.maxX - tread.minX - .02, .022, .05, '#c4b99f').metadata = { castShadow: false };
    }
  }
}
