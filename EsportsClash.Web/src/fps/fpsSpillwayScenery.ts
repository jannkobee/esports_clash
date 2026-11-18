import { Color3, DynamicTexture, Mesh, MeshBuilder, PointLight, StandardMaterial, Texture, Vector3, type Scene } from '@babylonjs/core';
import { liveBoxSurfaceUV, LIVE_SURFACE_METRES, type LiveSurface, type LiveSurfaceLibrary } from './fpsLiveGraphics.ts';
import { batchStaticLiveGeometry } from './fpsLiveRenderOptimization.ts';
import { SPILLWAY_GROUND_PATCHES, SPILLWAY_SHALLOW_WATERS } from './fpsSpillwayTerrain.ts';

export interface SpillwaySceneryBuildResult {
  meshes: Mesh[];
  shadowCasters: Mesh[];
  cutawayMeshes: Mesh[];
  waterTextures: Texture[];
  lights: PointLight[];
}

/**
 * Municipal European flood-management district underneath a landscaped riverside park.
 * All visual props match the physical collision footprint while keeping eye-level sightlines crisp.
 */
export function buildSpillwayScenery(
  scene: Scene,
  material: (color: string) => StandardMaterial,
  surfaces?: LiveSurfaceLibrary,
): SpillwaySceneryBuildResult {
  const details: Mesh[] = [];
  const cutawayMeshes: Mesh[] = [];
  const waterTextures: Texture[] = [];
  const lights: PointLight[] = [];

  const register = <T extends Mesh>(mesh: T, cutaway = false): T => {
    mesh.isPickable = false;
    mesh.receiveShadows = true;
    if (cutaway) cutawayMeshes.push(mesh);
    else details.push(mesh);
    return mesh;
  };

  const detailMesh = <T extends Mesh>(mesh: T, color: string, surface?: LiveSurface, cutaway = false): T => {
    mesh.material = surface && surfaces ? surfaces.material(surface, color) : material(color);
    return register(mesh, cutaway);
  };

  const box = (
    name: string,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    color: string,
    surface?: LiveSurface,
    cutaway = false,
  ): Mesh => {
    const mesh = MeshBuilder.CreateBox(
      name,
      {
        width: w,
        height: h,
        depth: d,
        ...(surface ? { faceUV: liveBoxSurfaceUV(w, h, d, LIVE_SURFACE_METRES[surface]) } : {}),
      },
      scene,
    );
    mesh.position.set(x, y, z);
    mesh.material = surface && surfaces ? surfaces.material(surface, color) : material(color);
    return register(mesh, cutaway);
  };

  const paintedSign = (
    name: string,
    text: string,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    bg: string,
    fg: string,
    horizontal = false,
  ): Mesh => {
    const texture = new DynamicTexture(`${name}-paint`, { width: 1024, height: 256 }, scene, false);
    const fontPx = Math.max(42, Math.min(108, Math.floor(860 / Math.max(1, text.length * .65))));
    texture.drawText(text, null, Math.round(128 + fontPx * .35), `bold ${fontPx}px Arial`, fg, bg, true);
    const mat = new StandardMaterial(`${name}-mat`, scene);
    mat.diffuseTexture = texture;
    mat.specularColor = Color3.Black();
    const panel = horizontal
      ? MeshBuilder.CreateGround(name, { width: w, height: h }, scene)
      : MeshBuilder.CreateBox(name, { width: w, height: h, depth: .04 }, scene);
    panel.position.set(x, y, z);
    panel.material = mat;
    panel.metadata = { castShadow: false };
    return register(panel);
  };

  const sitePad = (site: 'A' | 'B', cx: number, y: number, cz: number, size: number, label: string, bg: string, ringColor: string) => {
    const padTex = new DynamicTexture(`sw-site-pad-${site}`, { width: 512, height: 512 }, scene, false);
    const ctx = padTex.getContext() as unknown as CanvasRenderingContext2D;
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 512, 512);
    ctx.strokeStyle = ringColor;
    ctx.lineWidth = 14;
    ctx.strokeRect(22, 22, 468, 468);
    ctx.setLineDash([28, 18]);
    ctx.lineWidth = 8;
    ctx.strokeRect(52, 52, 408, 408);
    ctx.setLineDash([]);
    ctx.fillStyle = ringColor;
    ctx.font = 'bold 210px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(site, 256, 232);
    ctx.font = 'bold 34px Arial';
    ctx.fillText(label, 256, 412);
    padTex.update();
    padTex.anisotropicFilteringLevel = 8;
    const mat = new StandardMaterial(`sw-site-pad-mat-${site}`, scene);
    mat.diffuseTexture = padTex;
    mat.specularColor = new Color3(.1, .1, .1);
    const pad = MeshBuilder.CreateGround(`sw-site-pad-mesh-${site}`, { width: size, height: size }, scene);
    pad.position.set(cx, y, cz);
    pad.material = mat;
    pad.metadata = { castShadow: false };
    register(pad);
  };

  // ===========================================================================
  // 1. Lower Drainage & Animated Floodwater Channels (y = 0.0)
  // ===========================================================================
  const flowTex = new DynamicTexture('spillway-canal-flow', { width: 256, height: 128 }, scene, false);
  const fCtx = flowTex.getContext() as unknown as CanvasRenderingContext2D;
  fCtx.fillStyle = '#2d6361';
  fCtx.fillRect(0, 0, 256, 128);
  for (let i = 0; i < 26; i++) {
    fCtx.strokeStyle = i % 3 ? '#45807d' : '#7cb0ab';
    fCtx.lineWidth = i % 3 ? 1.5 : 2.5;
    fCtx.beginPath();
    fCtx.moveTo((i * 59) % 256, (i * 31) % 128);
    fCtx.bezierCurveTo((i * 59) % 256 + 14, (i * 31) % 128 + 5, (i * 59) % 256 + 28, (i * 31) % 128 - 5, (i * 59) % 256 + 44, (i * 31) % 128);
    fCtx.stroke();
  }
  flowTex.update();
  flowTex.wrapU = flowTex.wrapV = Texture.WRAP_ADDRESSMODE;
  flowTex.uScale = 6;
  flowTex.vScale = 4;
  waterTextures.push(flowTex);

  const canalWaterMat = surfaces ? surfaces.water('#2c6260') : new StandardMaterial('spillway-water-mat', scene);
  canalWaterMat.diffuseTexture = flowTex;
  canalWaterMat.alpha = .92;
  canalWaterMat.specularColor = new Color3(.55, .74, .74);

  for (const vol of SPILLWAY_SHALLOW_WATERS) {
    const w = vol.maxX - vol.minX;
    const d = vol.maxZ - vol.minZ;
    const cx = (vol.minX + vol.maxX) / 2;
    const cz = (vol.minZ + vol.maxZ) / 2;
    const bed = MeshBuilder.CreateGround(`${vol.id}-bed`, { width: w + .4, height: d + .4 }, scene);
    bed.position.set(cx, -.22, cz);
    bed.material = surfaces ? surfaces.material('concrete', '#586264') : material('#586264');
    bed.metadata = { castShadow: false };
    register(bed);

    const water = MeshBuilder.CreateGround(`${vol.id}-plane`, { width: w, height: d }, scene);
    water.position.set(cx, vol.waterY, cz);
    water.material = canalWaterMat;
    water.metadata = { castShadow: false };
    register(water);
  }

  // Elevated Steel Canal Footbridge Deck Grate Ribs & Overhead Pipe Rings (x: 21..26.5, z: -14.5..-9.5, y: 1.4m)
  for (let gx = 21.4; gx <= 26.2; gx += .8) {
    box(`sw-bridge-grate-${gx.toFixed(1)}`, gx, 1.415, -12, .12, .03, 4.6, '#4b555a', 'metal');
  }

  // Storm Pipe Culvert Ribbed Collar Rings & Intake Grate (x = 27.8, z = 1.5..15.5)
  for (const pz of [2.4, 6.2, 10.0, 14.4]) {
    const ring = detailMesh(MeshBuilder.CreateTorus(`sw-pipe-ring-${pz}`, { diameter: 4.1, thickness: .16, tessellation: 18 }, scene), '#4f687a', 'metal', true);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(27.8, 1.1, pz);
  }
  paintedSign('sw-pipe-sign', 'STORM CULVERT  //  SECTOR B', 27.8, 3.1, 1.45, 3.8, .48, '#20323e', '#d9e3e8');

  // Storm outfall pipes & blue sluice gates along east Drainage/Canal wall
  for (const [i, pz] of [-29, -18, -10].entries()) {
    const arch = detailMesh(MeshBuilder.CreateCylinder(`sw-outfall-pipe-${i}`, { height: 1.6, diameter: 2.1, tessellation: 18 }, scene), '#586164', 'concrete');
    arch.rotation.z = Math.PI / 2;
    arch.position.set(44.2, .92, pz);
    const gate = box(`sw-sluice-gate-${i}`, 43.3, 1.45, pz, .18, 2.2, 1.7, '#2f6b9a', 'metal');
    gate.metadata = { castShadow: false };
  }

  // Drainage Utility Box (x: 38..40.2, z: -20.5..-18.5)
  box('sw-utility-dial-face', 39.1, .42, -18.47, 1.3, .45, .04, '#dde3df');
  box('sw-utility-led-strip', 39.1, .52, -18.44, .24, .08, .03, '#4fc97b');

  // B Site Barrels (x: 34.4..36.6, z: 27.6..29.6) & East Maintenance Jail Cage
  for (const [bi, [bx, bz, col]] of [
    [35.0, 28.2, '#2f6b9a'],
    [36.0, 28.3, '#b85c37'],
    [35.4, 29.1, '#2f6b9a'],
  ].entries()) {
    const drum = detailMesh(MeshBuilder.CreateCylinder(`sw-b-barrel-${bi}`, { height: 1.38, diameter: .84, tessellation: 14 }, scene), col as string, 'metal');
    drum.position.set(bx as number, .69, bz as number);
    const rim = detailMesh(MeshBuilder.CreateTorus(`sw-b-barrel-rim-${bi}`, { diameter: .86, thickness: .05, tessellation: 14 }, scene), '#d7b239', 'metal');
    rim.position.set(bx as number, 1.34, bz as number);
  }
  for (let jz = 19.2; jz <= 21.6; jz += .6) {
    box(`sw-jail-post-${jz.toFixed(1)}`, 42.3, 1.25, jz, .06, 2.5, .06, '#485256', 'metal');
  }
  paintedSign('sw-jail-sign', 'VALVE CAGE', 44.3, 2.1, 21.95, 2.4, .4, '#363c3e', '#e7c152');

  // ===========================================================================
  // 2. Pumping Station (Bombsite B, y = 0.0) + Cantilevered Control Deck (y = 3.6)
  // ===========================================================================
  sitePad('B', 30, .022, 21, 5.4, 'PUMPING STATION', '#7f7f79', '#d7b239');

  // Tiered radial central pressure silo (x=29, z=25, r=1.5m matching b-silo-pillar)
  const siloBody = detailMesh(MeshBuilder.CreateCylinder('sw-silo-core', { height: 5.2, diameter: 2.92, tessellation: 24 }, scene), '#879194', 'concrete');
  siloBody.position.set(29, 2.6, 25);
  const siloPlinth = detailMesh(MeshBuilder.CreateCylinder('sw-silo-plinth', { height: .45, diameter: 2.98, tessellation: 24 }, scene), '#5b6367', 'concrete');
  siloPlinth.position.set(29, .225, 25);
  const siloRimTop = detailMesh(MeshBuilder.CreateCylinder('sw-silo-cap', { height: .36, diameterTop: 2.35, diameterBottom: 2.94, tessellation: 24 }, scene), '#6c777c', 'metal');
  siloRimTop.position.set(29, 5.38, 25);
  const siloBand = detailMesh(MeshBuilder.CreateTorus('sw-silo-band', { diameter: 2.95, thickness: .08, tessellation: 24 }, scene), '#d7b239', 'metal');
  siloBand.position.set(29, 2.2, 25);
  const siloBandHi = detailMesh(MeshBuilder.CreateTorus('sw-silo-band-hi', { diameter: 2.95, thickness: .08, tessellation: 24 }, scene), '#2f6b9a', 'metal');
  siloBandHi.position.set(29, 4.1, 25);

  // Twin Blue Turbine Pumps (West 25.6, East 32.4, z = 25, height <= 1.75m)
  for (const [label, px] of [['west', 25.6], ['east', 32.4]] as const) {
    box(`sw-pump-plinth-${label}`, px, .14, 25, 2.36, .28, 1.92, '#62696c', 'concrete');
    const drum = detailMesh(MeshBuilder.CreateCylinder(`sw-pump-drum-${label}`, { height: 2.05, diameter: 1.15, tessellation: 16 }, scene), '#2f6b9a', 'metal');
    drum.rotation.z = Math.PI / 2;
    drum.position.set(px, .92, 25);
    const motor = detailMesh(MeshBuilder.CreateCylinder(`sw-pump-motor-${label}`, { height: .85, diameter: .66, tessellation: 14 }, scene), '#d7b239', 'metal');
    motor.position.set(px, 1.32, 25);
    // Overhead manifold riser (starts above 2.15m so sightlines across site stay completely clear!)
    const riser = detailMesh(MeshBuilder.CreateCylinder(`sw-pump-riser-${label}`, { height: 2.3, diameter: .24, tessellation: 10 }, scene), '#3b7aa8', 'metal');
    riser.position.set(px, 3.1, 25);
    const headerX = (px + 29) / 2;
    const header = detailMesh(MeshBuilder.CreateCylinder(`sw-pump-header-${label}`, { height: Math.abs(px - 29), diameter: .22, tessellation: 10 }, scene), '#3b7aa8', 'metal');
    header.rotation.z = Math.PI / 2;
    header.position.set(headerX, 4.15, 25);
  }

  // East Control Cabinet Trim
  box('sw-b-cabinet-trim', 40.17, 1.25, 25.15, .04, 1.45, 2.2, '#2d3f48', 'metal');
  box('sw-b-cabinet-warn', 40.14, 1.72, 25.15, .03, .22, .65, '#d7b239');

  // Cantilevered Control Deck Steel Under-Girders & Stanchions (y = 3.6m overhang)
  for (const gx of [17.5, 21.0, 24.5, 27.8]) {
    box(`sw-deck-girder-${gx}`, gx, 3.32, 31, .28, .28, 9.8, '#4e585d', 'metal');
  }
  for (let rx = 20.0; rx <= 28.8; rx += 1.76) {
    box(`sw-deck-post-s-${rx.toFixed(1)}`, rx, 3.96, 26.05, .07, .72, .07, '#4c5458', 'metal');
  }
  box('sw-deck-rail-s-top', 24.4, 4.30, 26.05, 9.0, .06, .06, '#d8b23a', 'metal');
  box('sw-deck-rail-s-mid', 24.4, 4.02, 26.05, 9.0, .04, .05, '#d8b23a', 'metal');
  for (let rz = 26.5; rz <= 35.5; rz += 1.8) {
    box(`sw-deck-post-e-${rz.toFixed(1)}`, 28.9, 4.02, rz, .07, .82, .07, '#4c5458', 'metal');
  }
  box('sw-deck-rail-e-top', 28.9, 4.41, 31.0, .06, .06, 9.8, '#d8b23a', 'metal');
  box('sw-deck-rail-e-mid', 28.9, 4.08, 31.0, .05, .04, 9.8, '#d8b23a', 'metal');
  // Control Deck Booth Interior Console & Windows
  box('sw-booth-desk', 27.6, 4.12, 33.4, 1.8, 1.0, .6, '#505b60', 'metal');
  box('sw-booth-screen-a', 27.1, 4.82, 33.3, .55, .36, .06, '#71c6df');
  box('sw-booth-screen-b', 27.85, 4.82, 33.3, .55, .36, .06, '#5bc48a');
  box('sw-booth-hvac', 26.8, 6.72, 34.4, 1.6, .55, 1.2, '#697276', 'metal', true);
  paintedSign('sw-sector-b-sign', 'SECTOR B // PUMP HALL', 29.0, 4.7, 36.1, 5.8, .62, '#243542', '#e8d089');

  // Warm Tunnel Lights in Main Tunnel, Service Tunnel, & Connector
  const addWarmFixture = (id: string, x: number, y: number, z: number, addLight = false) => {
    box(`${id}-housing`, x, y, z, 1.2, .12, .26, '#394044', 'metal');
    const tube = box(`${id}-tube`, x, y - .07, z, 1.05, .06, .16, '#fff0c2');
    tube.metadata = { castShadow: false };
    if (addLight) {
      const pt = new PointLight(`${id}-light`, new Vector3(x, y - .25, z), scene);
      pt.diffuse = new Color3(1, .87, .64);
      pt.intensity = .55;
      pt.range = 15;
      lights.push(pt);
    }
  };
  addWarmFixture('sw-tun-lamp-1', 40, 3.28, 0, true);
  addWarmFixture('sw-tun-lamp-2', 40, 3.28, 10, false);
  addWarmFixture('sw-pipe-lamp', 27.8, 2.26, 8, false);
  addWarmFixture('sw-upper-tun-lamp', 7.5, 5.38, -28, true);
  addWarmFixture('sw-squeaky-lamp', 7.5, 8.28, -6, false);
  addWarmFixture('sw-conn-lamp', 13.8, 7.6, 3.5, true);
  addWarmFixture('sw-b-hall-lamp', 29, 6.1, 29, true);
  addWarmFixture('sw-parkhouse-lamp', -26.2, 8.65, 8, false);
  addWarmFixture('sw-bank-lamp', -13, 8.85, 48.5, false);

  // Squeaky Hazard Door Frame (x = 4.15, z = -6.25, y = 5.6..8.4)
  box('sw-squeaky-lintel', 4.15, 8.2, -6.25, .45, .3, 3.6, '#d7b239', 'metal');
  box('sw-squeaky-jamb-s', 4.15, 6.95, -7.9, .45, 2.5, .18, '#394044', 'metal');
  box('sw-squeaky-jamb-n', 4.15, 6.95, -4.6, .45, 2.5, .18, '#394044', 'metal');

  // ===========================================================================
  // 3. Service Yard (Level 1, y = 2.8) & Landscaped Gardens
  // ===========================================================================
  // Isolated T Service Flatbed Truck (3..9, -52.5..-49.5, y = 2.8..5.2)
  box('sw-t-truck-chassis', 6.0, 3.38, -51.0, 5.7, .38, 2.75, '#434a4f', 'metal');
  box('sw-t-truck-bed', 4.85, 3.92, -51.0, 3.35, .72, 2.7, '#c9853b', 'metal');
  box('sw-t-truck-cab', 7.75, 4.24, -51.0, 2.1, 1.48, 2.66, '#d6903f', 'metal');
  box('sw-t-truck-glass', 8.22, 4.48, -51.0, 1.12, .58, 2.38, '#283d46');
  box('sw-t-truck-beacon', 7.75, 5.06, -51.0, .75, .14, .32, '#e9b035');
  for (const wx of [4.1, 7.8]) for (const wz of [-52.25, -49.75]) {
    const tire = detailMesh(MeshBuilder.CreateCylinder(`sw-t-tire-${wx}-${wz}`, { height: .34, diameter: .92, tessellation: 14 }, scene), '#25282a');
    tire.rotation.x = Math.PI / 2;
    tire.position.set(wx, 3.26, wz);
  }
  for (const [ci, [cx, cz]] of [[1.8, -49.6], [1.8, -51.6], [9.8, -49.4]].entries()) {
    const cone = detailMesh(MeshBuilder.CreateCylinder(`sw-yard-cone-${ci}`, { height: .62, diameterTop: .08, diameterBottom: .36, tessellation: 10 }, scene), '#df6b35');
    cone.position.set(cx, 3.11, cz);
  }

  // Gardens Scalloped Ornamental Fountain (-15.5, -29.5, y = 2.8..4.3)
  const gfPlinth = detailMesh(MeshBuilder.CreateCylinder('sw-gf-plinth', { height: .22, diameter: 3.92, tessellation: 22 }, scene), '#7e7d75', 'stone');
  gfPlinth.position.set(-15.5, 2.91, -29.5);
  const gfBasin = detailMesh(MeshBuilder.CreateCylinder('sw-gf-basin', { height: .58, diameterTop: 3.74, diameterBottom: 3.5, tessellation: 22 }, scene), '#a49f92', 'stone');
  gfBasin.position.set(-15.5, 3.3, -29.5);
  const gfRim = detailMesh(MeshBuilder.CreateTorus('sw-gf-rim', { diameter: 3.6, thickness: .16, tessellation: 24 }, scene), '#c8c0af', 'stone');
  gfRim.position.set(-15.5, 3.6, -29.5);
  const gfWater = detailMesh(MeshBuilder.CreateCylinder('sw-gf-water', { height: .04, diameter: 3.2, tessellation: 20 }, scene), '#447d82');
  gfWater.material = canalWaterMat;
  gfWater.position.set(-15.5, 3.55, -29.5);
  const gfSpire = detailMesh(MeshBuilder.CreateCylinder('sw-gf-spire', { height: .75, diameterTop: .28, diameterBottom: .62, tessellation: 12 }, scene), '#989487', 'stone');
  gfSpire.position.set(-15.5, 3.92, -29.5);

  // Gardens Pergola Louvers (cutaway roof group so Overview + Cutaway reveals seating cleanly)
  for (let i = 0; i < 6; i++) {
    box(`sw-pergola-slat-${i}`, -35.2 + i * 1.28, 5.65, -31.2, .18, .22, 5.8, '#7d5b3e', 'timber', true);
  }
  box('sw-pergola-bench-top', -32.0, 3.24, -31.2, 2.8, .08, .76, '#8f6944', 'timber');
  box('sw-pergola-bench-leg-w', -33.0, 3.01, -31.2, .14, .42, .68, '#464d51', 'metal');
  box('sw-pergola-bench-leg-e', -31.0, 3.01, -31.2, .14, .42, .68, '#464d51', 'metal');

  // ===========================================================================
  // 4. Upper Urban Park, Promenade, Kiosk, HQ (Site A), CT Compound (y = 5.6)
  // ===========================================================================
  // Grass Turf Lawns across Riverside Park & Gardens borders
  for (const [gi, [x, z, w, d, y]] of [
    [-33.5, -18.5, 11.5, 22, 5.612],
    [-25.5, 4.5, 11.5, 18, 5.612],
    [-31.5, 26.5, 8.5, 14, 5.612],
    [-21.5, -38.5, 12.0, 11.5, 2.812],
  ].entries()) {
    const lawn = MeshBuilder.CreateGround(`sw-park-lawn-${gi}`, { width: w, height: d }, scene);
    lawn.position.set(x, y, z);
    lawn.material = surfaces ? surfaces.material('grass', '#5e7e49') : material('#5e7e49');
    lawn.setVerticesData('uv', [0, 0, w / 3.2, 0, 0, d / 3.2, w / 3.2, d / 3.2]);
    lawn.metadata = { castShadow: false };
    register(lawn);
  }

  // Brick Promenade Ribbon along West Walk & Fountain Plaza
  for (const [bi, [x, z, w, d, y]] of [
    [-37.0, 2.0, 4.8, 52, 5.614],
    [-11.0, -20.0, 12.0, 14, 5.614],
  ].entries()) {
    const brickWalk = MeshBuilder.CreateGround(`sw-brick-walk-${bi}`, { width: w, height: d }, scene);
    brickWalk.position.set(x, y, z);
    brickWalk.material = surfaces ? surfaces.material('clay', '#9c6753') : material('#9c6753');
    brickWalk.setVerticesData('uv', [0, 0, w / 2.8, 0, 0, d / 2.8, w / 2.8, d / 2.8]);
    brickWalk.metadata = { castShadow: false };
    register(brickWalk);
  }

  // Fine yellow tread bands make the many concrete tier changes readable without adding collision.
  for (const [index, patch] of SPILLWAY_GROUND_PATCHES.filter(p => p.stair).entries()) {
    const width = patch.maxX - patch.minX;
    const depth = patch.maxZ - patch.minZ;
    const acrossX = width >= depth;
    const stripe = MeshBuilder.CreateGround(
      `sw-stair-tread-band-${patch.id ?? index}`,
      {
        width: acrossX ? Math.max(.08, width - .16) : .055,
        height: acrossX ? .055 : Math.max(.08, depth - .16),
      },
      scene,
    );
    stripe.position.set((patch.minX + patch.maxX) / 2, patch.height + .016, (patch.minZ + patch.maxZ) / 2);
    stripe.material = material('#d7b239');
    stripe.metadata = { castShadow: false };
    register(stripe);
  }

  // Rooted Park Trees (matching exact 0.72m collision trunk footprints; canopy >= 3.2m overhead!)
  for (const [idx, [tx, tz, baseY, tall]] of [
    [-24.6, -34.6, 2.8, 4.2],
    [-38.8, 1.9, 5.6, 4.2],
    [-32.8, 34.4, 5.6, 4.2],
    [-5.1, 28.4, 5.6, 4.2],
  ].entries()) {
    const trunk = detailMesh(MeshBuilder.CreateCylinder(`sw-tree-trunk-${idx}`, { height: tall, diameterTop: .42, diameterBottom: .68, tessellation: 10 }, scene), '#614e3a', 'timber');
    trunk.position.set(tx, baseY + tall / 2, tz);
    const canopy = detailMesh(MeshBuilder.CreateSphere(`sw-tree-canopy-${idx}`, { diameter: 4.1, segments: 10 }, scene), idx % 2 ? '#4d6f40' : '#587b47', 'grass');
    canopy.scaling.set(1.15, .74, 1.15);
    canopy.position.set(tx, baseY + tall + .95, tz);
  }

  // Riverside Park Iron Street Lamps
  for (const [li, [lx, lz]] of [[-40.2, -12], [-40.2, 4], [-35.2, 22], [-28, 12]].entries()) {
    const post = detailMesh(MeshBuilder.CreateCylinder(`sw-lamp-post-${li}`, { height: 4.2, diameter: .16, tessellation: 8 }, scene), '#353e41', 'metal');
    post.position.set(lx, 7.7, lz);
    const globe = detailMesh(MeshBuilder.CreateSphere(`sw-lamp-globe-${li}`, { diameter: .42, segments: 8 }, scene), '#fae3a7');
    globe.position.set(lx + .22, 9.85, lz);
    globe.metadata = { castShadow: false };
  }

  // Playground Climbing Fort & Sandpit Border (x: -33..-30.6, z: -40.2..-38.4, y: 3.2)
  box('sw-play-deck', -31.8, 3.92, -39.3, 2.3, .14, 1.7, '#b47442', 'timber');
  for (const [px, pz] of [[-32.8, -40.0], [-30.8, -40.0], [-32.8, -38.6], [-30.8, -38.6]]) {
    box(`sw-play-post-${px}-${pz}`, px, 3.85, pz, .18, 1.3, .18, '#7a5436', 'timber');
  }
  box('sw-play-rail-top', -31.8, 4.44, -39.3, 2.2, .12, 1.6, '#cf5e3d', 'metal');

  // Party Terrace Balloons & Bunting (-21..-16, -11.5..-9.2, y = 5.6+)
  for (const [bi, [bx, by, bz, col]] of [
    [-16.4, 8.25, -9.8, '#e35a4b'],
    [-16.9, 8.52, -10.1, '#f2c144'],
    [-16.2, 8.48, -10.4, '#4aa4df'],
    [-19.6, 7.75, -10.5, '#e35a4b'],
    [-20.1, 7.95, -10.3, '#58c488'],
  ].entries()) {
    const balloon = detailMesh(MeshBuilder.CreateSphere(`sw-party-balloon-${bi}`, { diameter: .48, segments: 8 }, scene), col as string);
    balloon.position.set(bx as number, by as number, bz as number);
    balloon.metadata = { castShadow: false };
  }

  // Promenade Granite Rock Boulder (-37.2..-34.6, -2.0..0.6, y = 5.6..7.35)
  const rockMain = detailMesh(MeshBuilder.CreateCylinder('sw-long-rock-main', { height: 1.65, diameterTop: 1.5, diameterBottom: 2.55, tessellation: 7 }, scene), '#838784', 'stone');
  rockMain.position.set(-35.9, 6.42, -.7);
  const rockShoulder = detailMesh(MeshBuilder.CreateCylinder('sw-long-rock-side', { height: 1.15, diameterTop: 1.1, diameterBottom: 1.75, tessellation: 6 }, scene), '#767b78', 'stone');
  rockShoulder.position.set(-35.1, 6.17, .1);

  // Parkhouse (Toilets) Sign, Tiled Floor & Washroom Counter (-30..-22.5, 1.5..15.5, y = 5.6)
  box('sw-parkhouse-tile-floor', -26.25, 5.616, 8.5, 6.8, .03, 12.8, '#d4cfc4', 'stone');
  box('sw-parkhouse-basin', -26.2, 6.48, 11.7, 1.0, .14, 1.9, '#e7e8e3', 'stone');
  paintedSign('sw-parkhouse-sign', 'PARK RESTROOMS  •  A LONG', -29.8, 8.15, 7.5, .04, 3.2, '#2d3f3d', '#efe4c8');

  // A Short Flowers Sign & Planter Bed (-23.6..-21.0, 25.2..26.0, y = 5.6..7.8)
  box('sw-flowers-bed', -22.3, 5.88, 25.6, 2.5, .56, .85, '#685947', 'stone');
  box('sw-flowers-blooms', -22.3, 6.18, 25.6, 2.1, .16, .55, '#598249', 'grass');
  box('sw-flowers-post-w', -23.3, 6.7, 25.6, .12, 2.2, .12, '#353e41', 'metal');
  box('sw-flowers-post-e', -21.3, 6.7, 25.6, .12, 2.2, .12, '#353e41', 'metal');
  paintedSign('sw-flowers-board', 'FLOOD HQ  ▲  LONG / KIOSK', -22.3, 7.25, 25.6, 2.4, .78, '#243542', '#f0e2bd');

  // Kiosk Café Details & Striped Awning (-18..-3.8, 14.5..23.9, y = 5.6)
  box('sw-kiosk-wood-floor', -10.9, 5.616, 19.2, 13.0, .03, 8.2, '#8b6a48', 'timber');
  box('sw-kiosk-awning', -10.9, 8.38, 13.9, 12.6, .18, 1.35, '#a84739', undefined, true);
  box('sw-kiosk-awning-trim', -10.9, 8.31, 13.26, 12.6, .16, .14, '#ede2c9', undefined, true);
  paintedSign('sw-kiosk-sign', 'PARK KIOSK  •  INFO', -10.9, 8.15, 14.48, 4.6, .58, '#283634', '#eedcaa');
  box('sw-kiosk-menu', -10.6, 6.95, 19.1, .9, .55, .12, '#222b29');

  // Flood Control HQ (Bombsite A, center -15, 29, y = 5.6) & Hydrology Bank
  sitePad('A', -15, 5.622, 29, 5.8, 'FLOOD CONTROL HQ', '#8a867c', '#d86643');
  paintedSign('sw-hq-sign', 'HYDROLOGY HQ  //  SECTOR A', -21.0, 8.8, 43.76, 8.6, .74, '#243542', '#e8ecf0');
  paintedSign('sw-bank-sign', 'HYDROLOGY BANK  •  RETAKE ACCESS', -12.5, 8.5, 45.25, 4.4, .56, '#23323d', '#ecd493');
  box('sw-bank-floor', -13.0, 5.616, 48.5, 13.4, .03, 6.2, '#b6b8b3', 'stone');

  // Hydrology Bank Van (-27.2..-22.6, 47.0..49.8, y = 5.6..7.9)
  box('sw-bank-van-body', -24.9, 6.82, 48.4, 4.4, 1.62, 2.6, '#d0d3ce', 'metal');
  box('sw-bank-van-stripe', -24.9, 6.72, 47.08, 4.2, .24, .04, '#2f6b9a');
  box('sw-bank-van-glass', -23.1, 7.04, 47.07, 1.1, .52, .05, '#243843');
  for (const vx of [-26.3, -23.5]) for (const vz of [47.15, 49.65]) {
    const tire = detailMesh(MeshBuilder.CreateCylinder(`sw-bank-tire-${vx}-${vz}`, { height: .3, diameter: .84, tessellation: 12 }, scene), '#232729');
    tire.rotation.x = Math.PI / 2;
    tire.position.set(vx, 6.02, vz);
  }

  // A Response Utility Van (-22.2..-17.6, 32.5..37.5, y = 5.6..8.0)
  box('sw-a-van-body', -19.9, 6.86, 35.0, 4.2, 1.72, 4.8, '#395569', 'metal');
  box('sw-a-van-cab', -19.9, 6.74, 33.1, 4.05, 1.36, 1.2, '#446379', 'metal');
  box('sw-a-van-windshield', -19.9, 7.05, 32.48, 3.65, .62, .08, '#243944');
  box('sw-a-van-stripe', -17.78, 6.82, 35.0, .05, .28, 4.6, '#d7b239');
  box('sw-a-van-rack', -19.9, 7.82, 35.3, 3.4, .14, 3.6, '#505b60', 'metal');
  for (const vx of [-21.75, -18.05]) for (const vz of [33.5, 36.4]) {
    const tire = detailMesh(MeshBuilder.CreateCylinder(`sw-a-tire-${vx}-${vz}`, { height: .36, diameter: .92, tessellation: 14 }, scene), '#232729');
    tire.rotation.z = Math.PI / 2;
    tire.position.set(vx, 6.06, vz);
  }

  // CT Security Van (12.5..17.8, 45.5..48.5, y = 5.6..8.0)
  box('sw-ct-van-body', 15.15, 6.86, 47.0, 5.1, 1.72, 2.8, '#d4d7d2', 'metal');
  box('sw-ct-van-stripe', 15.15, 6.76, 45.58, 4.9, .26, .04, '#2f6b9a');
  box('sw-ct-van-glass', 13.0, 7.08, 45.57, 1.25, .58, .05, '#253944');
  box('sw-ct-van-strobe', 15.15, 7.84, 47.0, .9, .16, .42, '#4ea6db');
  for (const vx of [13.5, 16.8]) for (const vz of [45.65, 48.35]) {
    const tire = detailMesh(MeshBuilder.CreateCylinder(`sw-ct-tire-${vx}-${vz}`, { height: .32, diameter: .88, tessellation: 14 }, scene), '#232729');
    tire.rotation.x = Math.PI / 2;
    tire.position.set(vx, 6.04, vz);
  }
  // Security Boom Arm on CT Barrier Hut (-0.5..3.2, 46.8..49.8)
  box('sw-ct-boom-arm', -4.2, 6.72, 46.75, 5.8, .12, .12, '#d8553a');

  // ===========================================================================
  // 5. Distant Municipal Skyline & Viaduct Piers (No Shadows / Visual Framing)
  // ===========================================================================
  for (const [si, [sx, sy, sz, sw, sh, sd, col]] of ([
    [-64, 9, 10, 14, 24, 90, '#787e82'],
    [64, 7, 10, 16, 20, 88, '#72797d'],
    [0, 10, 72, 110, 26, 16, '#6f777d'],
    [0, 6, -74, 112, 18, 16, '#7a7e7b'],
  ] as [number, number, number, number, number, number, string][]).entries()) {
    const blk = box(`sw-outside-skyline-${si}`, sx, sy, sz, sw, sh, sd, col, 'concrete');
    blk.metadata = { castShadow: false };
  }

  for (const mesh of details) {
    mesh.metadata = {
      ...(mesh.metadata ?? {}),
      castShadow: mesh.metadata?.castShadow !== false && !mesh.name.startsWith('sw-outside-'),
    };
  }
  for (const mesh of cutawayMeshes) {
    mesh.metadata = { ...(mesh.metadata ?? {}), cutaway: true };
    mesh.freezeWorldMatrix();
  }

  const batched = batchStaticLiveGeometry(details);
  const shadowCasters = batched.meshes.filter(
    mesh => mesh.metadata?.castShadow !== false && !mesh.material?.name.startsWith('water:') && !/lamp|tube|screen|strobe|beacon|led/.test(mesh.material?.name ?? ''),
  );

  return {
    meshes: [...batched.meshes, ...cutawayMeshes],
    shadowCasters,
    cutawayMeshes,
    waterTextures,
    lights,
  };
}
