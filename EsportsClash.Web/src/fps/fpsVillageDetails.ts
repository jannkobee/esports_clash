import { MeshBuilder, Vector3, type Mesh, type Scene } from '@babylonjs/core';
import { liveTintMesh, LIVE_TINT_BASE } from './fpsVillageTint.ts';
import { LIVE_FPS_MAP } from './fpsLiveMap.ts';
import { liveBoxSurfaceUV, LIVE_SURFACE_BOX_WRAP, LIVE_SURFACE_METRES, type LiveSurface, type LiveSurfaceLibrary } from './fpsLiveGraphics.ts';
import type { VillageBuilder } from './fpsVillageArchitecture.ts';

/**
 * Lived-in dressing for Fontessa. Visual only: everything is wall-mounted within 0.12 m of a facade, hangs above
 * 2.4 m, or sits in space no actor can reach (behind the trattoria counter), so no walkable space is occupied.
 */
const solid = (id: string) => LIVE_FPS_MAP.solids.find(s => s.id === id);

/** Washing lines strung between facades above the lanes (y is the anchor height on both walls). */
export const LIVE_LAUNDRY_LINES = Object.freeze([
  // Between the Farmacia's and the Formaggi house's window bays, under the Farmacia eave.
  { id: 'mid-lane', fromX: -2, toX: 2, z: -4.6, y: 4.75, sag: .2 },
  { id: 'residential-passage', fromX: -10, toX: -7.5, z: -15.1, y: 4.82, sag: .16 },
  { id: 'market-street', fromX: 14, toX: 22, z: -3.6, y: 7.05, sag: .42 },
] as const);

export function buildVillageDetails(scene: Scene, b: VillageBuilder, surfaces?: LiveSurfaceLibrary): void {
  // Colours are baked into vertex colours so all of this dressing joins a few shared batches.
  const detail = <T extends Mesh>(mesh: T, color: string) => b.detail(liveTintMesh(mesh, color), LIVE_TINT_BASE);
  const box = (name: string, x: number, y: number, z: number, w: number, h: number, d: number, color: string) => {
    const mesh = detail(MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene), color); mesh.position.set(x, y, z); return mesh;
  };
  const surfaceBox = (name: string, kind: LiveSurface, x: number, y: number, z: number, w: number, h: number, d: number, color: string) => {
    const mesh = detail(MeshBuilder.CreateBox(name, { width: w, height: h, depth: d, faceUV: liveBoxSurfaceUV(w, h, d, LIVE_SURFACE_METRES[kind]), wrap: LIVE_SURFACE_BOX_WRAP }, scene), color);
    mesh.position.set(x, y, z); if (surfaces) mesh.material = surfaces.material(kind, LIVE_TINT_BASE); return mesh;
  };

  // Washing lines: a sagging cord, hooks on both facades and pegged laundry hanging below it.
  const palette = ['#f1ede2', '#9fb7c9', '#c95a4a', '#e7c766', '#f1ede2', '#6f8fa8', '#d8a3a0', '#efe9da'];
  for (const line of LIVE_LAUNDRY_LINES) {
    const point = (t: number) => new Vector3(line.fromX + (line.toX - line.fromX) * t, line.y - 4 * line.sag * t * (1 - t), line.z);
    const cord = detail(MeshBuilder.CreateTube(`laundry-cord-${line.id}`, { path: Array.from({ length: 17 }, (_, i) => point(i / 16)), radius: .007, tessellation: 4 }, scene), '#d9d2c2');
    cord.metadata = { castShadow: false };
    for (const [i, x] of [line.fromX, line.toX].entries()) box(`laundry-hook-${line.id}-${i}`, x + (i ? -.03 : .03), line.y, line.z, .06, .06, .06, '#3b3f3c');
    const items = Math.max(3, Math.round(Math.abs(line.toX - line.fromX) / .62));
    for (let i = 0; i < items; i++) {
      const t = (i + .6) / (items + .2), p = point(t), kind = (i * 7 + line.id.length) % 4;
      const w = kind === 0 ? .46 : kind === 1 ? .34 : kind === 2 ? .52 : .22, h = kind === 0 ? .54 : kind === 1 ? .62 : kind === 2 ? .38 : .3;
      const cloth = box(`laundry-cloth-${line.id}-${i}`, p.x, p.y - h / 2 - .012, p.z, w, h, .012, palette[(i + line.id.length) % palette.length]);
      cloth.rotation.y = ((i % 3) - 1) * .06;
      for (const dx of [-w * .38, w * .38]) box(`laundry-peg-${line.id}-${i}-${dx.toFixed(2)}`, p.x + dx, p.y - .012, p.z, .018, .05, .022, '#b59b6b');
    }
  }

  // Trattoria interior: warm plaster over a dark wainscot on every inner wall face, a back bar behind the
  // counter (unreachable: the gap to the wall is narrower than a player), framed pictures and hanging hams.
  const PLASTER = '#d6c09b', WAINSCOT = '#6e4d36', RAIL = '#8a6446';
  const innerFace = (name: string, alongX: boolean, face: number, dir: number, from: number, to: number, top = 4.28) => {
    const len = to - from, mid = (from + to) / 2;
    const panel = (part: string, kind: LiveSurface, y: number, h: number, out: number, depth: number, color: string) =>
      surfaceBox(`trattoria-${part}-${name}`, kind, alongX ? mid : face + dir * out, y, alongX ? face + dir * out : mid, alongX ? len : depth, h, alongX ? depth : len, color);
    panel('wainscot', 'timber', .53, 1.06, .008, .012, WAINSCOT);
    panel('dado-rail', 'timber', 1.09, .06, .02, .04, RAIL);
    panel('plaster', 'plaster', (1.12 + top) / 2, top - 1.12, .006, .01, PLASTER);
  };
  const south = solid('restaurant-south-wall'), sideRear = solid('restaurant-side-rear-1'), sideFront = solid('restaurant-side-front-1'), front = solid('restaurant-front-1');
  if (south && sideRear && sideFront && front) {
    const inner = sideRear.minX, southFace = south.maxZ, frontFace = front.minZ;
    innerFace('south', true, southFace, 1, -inner, inner);
    for (const side of [-1, 1]) {
      innerFace(`rear-${side}`, false, side * inner, -side, southFace, sideRear.maxZ);
      innerFace(`front-side-${side}`, false, side * inner, -side, sideFront.minZ, frontFace);
      innerFace(`front-${side}`, true, frontFace, -1, side < 0 ? -inner : front.minX, side < 0 ? -front.minX : inner);
    }
    const lintel = solid('restaurant-door-lintel');
    if (lintel) surfaceBox('trattoria-plaster-door-lintel', 'plaster', 0, ((lintel.baseY ?? 2.7) + 4.28) / 2, frontFace - .006, lintel.maxX - lintel.minX, 4.28 - (lintel.baseY ?? 2.7), .01, PLASTER);
    // Back bar: two shelves of bottles, a mirror, and a marble counter top with an espresso machine.
    const counter = solid('restaurant-service-counter');
    if (counter) {
      const cx = (counter.minX + counter.maxX) / 2, cw = counter.maxX - counter.minX, cz = (counter.minZ + counter.maxZ) / 2;
      box('trattoria-counter-marble', cx, counter.height + .02, cz, cw + .06, .04, counter.maxZ - counter.minZ + .06, '#e2ddd2');
      box('trattoria-bar-mirror', cx, 2.42, southFace + .012, cw - .6, .72, .012, '#8e9c9b');
      box('trattoria-bar-mirror-frame', cx, 2.42, southFace + .008, cw - .44, .86, .01, '#5b3f2c');
      const bottles = ['#3f5d3b', '#5c3a24', '#b8c3b4', '#7d2f2b', '#3f5d3b', '#c9a24e'];
      for (const [shelf, y] of [1.48, 1.86].entries()) {
        box(`trattoria-bar-shelf-${shelf}`, cx, y, southFace + .1, cw - .4, .035, .2, '#6b4a33');
        for (let i = 0; i < 14; i++) {
          const bottle = detail(MeshBuilder.CreateCylinder(`trattoria-bottle-${shelf}-${i}`, { height: .26, diameterTop: .03, diameterBottom: .075, tessellation: 8 }, scene), bottles[(i + shelf * 2) % bottles.length]);
          bottle.position.set(cx - cw / 2 + .45 + i * (cw - .9) / 13, y + .148, southFace + .1);
        }
      }
      const machine = box('trattoria-espresso-machine', cx + 1.6, counter.height + .22, cz - .05, .5, .36, .34, '#a9aeac');
      machine.metadata = { castShadow: false };
      box('trattoria-espresso-top', cx + 1.6, counter.height + .42, cz - .05, .44, .04, .3, '#2f3331');
      for (const dx of [-.12, .12]) {
        const cup = detail(MeshBuilder.CreateCylinder(`trattoria-espresso-cup-${dx}`, { height: .06, diameter: .07, tessellation: 10 }, scene), '#f1ede2');
        cup.position.set(cx + 1.6 + dx, counter.height + .07, cz - .24);
      }
      box('trattoria-till', cx - 1.7, counter.height + .14, cz, .36, .2, .3, '#2f3331');
      for (let i = 0; i < 5; i++) {
        const glass = detail(MeshBuilder.CreateCylinder(`trattoria-glass-${i}`, { height: .13, diameterTop: .075, diameterBottom: .055, tessellation: 10 }, scene), '#c9d3cf');
        glass.position.set(cx - .6 + i * .3, counter.height + .105, cz + .1);
      }
      // Hams and a garlic braid hang from the rear beam, well above head height.
      for (const [i, dx] of [-2.4, -1.6, 1.4].entries()) {
        const cordY = 4.31 - .09, ham = detail(MeshBuilder.CreateSphere(`trattoria-ham-${i}`, { diameter: .3, segments: 8 }, scene), '#8b4f3a');
        ham.scaling.set(.8, 1.5, .8); ham.position.set(cx + dx, 3.42, -37 - .02);
        const cord = detail(MeshBuilder.CreateCylinder(`trattoria-ham-cord-${i}`, { height: cordY - 3.65, diameter: .012, tessellation: 4 }, scene), '#d9cfb4');
        cord.position.set(cx + dx, (cordY + 3.65) / 2, -37 - .02);
      }
      for (let i = 0; i < 6; i++) {
        const bulb = detail(MeshBuilder.CreateSphere(`trattoria-garlic-${i}`, { diameter: .085, segments: 6 }, scene), '#ece4d2');
        bulb.position.set(cx + 2.2, 3.95 - i * .085, -37 - .02);
      }
    }
    // Framed pictures on the side walls.
    for (const side of [-1, 1]) for (const [i, z] of [-38.1, -30.7].entries()) {
      const fx = side * inner - side * .02;
      box(`trattoria-picture-frame-${side}-${i}`, fx, 2.25, z, .03, .62, .82, '#5b3f2c');
      box(`trattoria-picture-sky-${side}-${i}`, fx - side * .016, 2.36, z, .006, .3, .7, i ? '#9cb7c4' : '#d3b27a');
      box(`trattoria-picture-land-${side}-${i}`, fx - side * .016, 2.13, z, .006, .2, .7, i ? '#6f8458' : '#5b7f8d');
    }
  }

  // Arrival kiosk: posters pasted over both notice boards instead of two blank panels.
  const kiosk = solid('mid-approach-screen');
  if (kiosk) {
    const kx = (kiosk.minX + kiosk.maxX) / 2, posters = ['#d9c27a', '#b9543f', '#e8e2d2', '#5f7f8f', '#c98f55'];
    for (const face of [-1, 1]) {
      // Pasted 1 cm proud of the notice board (its face sits 5.5 cm off the kiosk wall).
      const fz = (face < 0 ? kiosk.minZ - .04 : kiosk.maxZ + .04) + face * .065;
      for (let i = 0; i < (face < 0 ? 2 : 4); i++) {
        const px = face < 0 ? kx + .55 + i * .34 : kx - .63 + i * .42, w = face < 0 ? .3 : .36, h = .5 + (i % 2) * .08;
        const poster = box(`kiosk-poster-${face}-${i}`, px, 1.68 + (i % 2) * .1, fz, w, h, .008, posters[(i + (face > 0 ? 1 : 0)) % posters.length]);
        poster.rotation.z = ((i % 3) - 1) * .035;
        for (let row = 0; row < 3; row++) box(`kiosk-poster-ink-${face}-${i}-${row}`, px, 1.82 + (i % 2) * .1 - row * .13, fz + face * .006, w * .7, row ? .025 : .06, .004, row ? '#5b5448' : '#2b2722');
      }
    }
  }

  // Palazzo Comunale portico: the two side bays get tall barred windows instead of blank wall.
  const palazzo = solid('a-loggia-wall');
  if (palazzo) for (const wx of [-26.05, -19.95]) {
    const fz = palazzo.minZ - .03;
    surfaceBox(`palazzo-bay-window-frame-${wx}`, 'stone', wx, 1.78, fz, 1.12, 1.96, .06, '#e0cfab');
    box(`palazzo-bay-window-glass-${wx}`, wx, 1.78, fz - .03, .92, 1.76, .02, '#30474b');
    box(`palazzo-bay-window-transom-${wx}`, wx, 2.24, fz - .045, .92, .05, .03, '#e0cfab');
    for (let i = 0; i < 6; i++) box(`palazzo-bay-grille-bar-${wx}-${i}`, wx - .4 + i * .16, 1.64, fz - .07, .022, 1.36, .022, '#30363a');
    for (const dy of [-.45, .3]) box(`palazzo-bay-grille-rail-${wx}-${dy}`, wx, 1.64 + dy, fz - .07, .9, .022, .022, '#30363a');
    surfaceBox(`palazzo-bay-window-sill-${wx}`, 'stone', wx, .76, fz - .05, 1.24, .08, .14, '#d6c5a2');
    surfaceBox(`palazzo-bay-window-pediment-${wx}`, 'stone', wx, 2.84, fz - .03, 1.3, .1, .12, '#e0cfab');
  }

  // CT guardhouse: a lantern over the harbour door and a civic banner on a wall arm, both above 2.58 m.
  const guard = solid('north-divider');
  if (guard) {
    const gx = (guard.minX + guard.maxX) / 2, gz = guard.maxZ, bx = guard.maxX - .7;
    box('guardhouse-lantern-arm', gx, 2.92, gz + .2, .04, .04, .4, '#2f3532');
    box('guardhouse-lantern-cap', gx, 2.84, gz + .38, .2, .04, .2, '#2f3532');
    box('guardhouse-lantern-glass', gx, 2.72, gz + .38, .15, .2, .15, '#d9b868');
    box('guardhouse-lantern-base', gx, 2.6, gz + .38, .17, .03, .17, '#2f3532');
    box('guardhouse-banner-arm', bx, 3.62, gz + .3, .04, .04, .6, '#2f3532');
    box('guardhouse-banner-bracket', bx, 3.62, gz + .03, .1, .14, .06, '#3d4541');
    box('guardhouse-banner', bx, 3.14, gz + .33, .02, .9, .52, '#527e77');
    box('guardhouse-banner-band', bx, 3.14, gz + .33, .026, .16, .52, '#e7dcc2');
    const finial = detail(MeshBuilder.CreateSphere('guardhouse-banner-finial', { diameter: .07, segments: 6 }, scene), '#c3a45c');
    finial.position.set(bx, 3.62, gz + .62);
  }
}
