import { Color3, DynamicTexture, Mesh, MeshBuilder, PointLight, StandardMaterial, Texture, Vector3, type Scene } from '@babylonjs/core';
import { liveBoxSurfaceUV, LIVE_SURFACE_METRES, type LiveSurface, type LiveSurfaceLibrary } from './fpsLiveGraphics.ts';
import { batchStaticLiveGeometry } from './fpsLiveRenderOptimization.ts';
import { SPILLWAY_SHALLOW_WATERS } from './fpsSpillwayTerrain.ts';

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

  // Steel grate ribs on the central canal crossing island (x: 20..27, z: -15..-9)
  for (let gx = 20.4; gx <= 26.6; gx += .85) {
    box(`sw-grate-bar-${gx.toFixed(1)}`, gx, .018, -12, .12, .035, 5.8, '#535e63', 'metal');
  }

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
  addWarmFixture('sw-conn-lamp', 13.8, 7.6, 3.5, true);
  addWarmFixture('sw-b-hall-lamp', 29, 6.1, 29, true);

  // ===========================================================================
  // 3. Service Yard (Level 1, y = 2.8) & Landscaped Gardens
  // ===========================================================================
  // T Service Flatbed Truck (-14..-8, -49.8..-46, y = 2.8..5.2)
  box('sw-t-truck-chassis', -11.0, 3.38, -47.9, 5.7, .38, 2.75, '#434a4f', 'metal');
  box('sw-t-truck-bed', -12.15, 3.92, -47.9, 3.35, .72, 2.7, '#c9853b', 'metal');
  box('sw-t-truck-cab', -9.25, 4.24, -47.9, 2.1, 1.48, 2.66, '#d6903f', 'metal');
  box('sw-t-truck-glass', -8.78, 4.48, -47.9, 1.12, .58, 2.38, '#283d46');
  box('sw-t-truck-beacon', -9.25, 5.06, -47.9, .75, .14, .32, '#e9b035');
  for (const wx of [-12.9, -9.2]) for (const wz of [-49.15, -46.65]) {
    const tire = detailMesh(MeshBuilder.CreateCylinder(`sw-t-tire-${wx}-${wz}`, { height: .34, diameter: .92, tessellation: 14 }, scene), '#25282a');
    tire.rotation.x = Math.PI / 2;
    tire.position.set(wx, 3.26, wz);
  }
  for (const [ci, [cx, cz]] of [[-15.2, -46.8], [-15.2, -48.6], [-7.2, -46.4]].entries()) {
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
    box(`sw-pergola-slat-${i}`, -37.2 + i * 1.28, 5.65, -31.2, .18, .22, 5.8, '#7d5b3e', 'timber', true);
  }
  box('sw-pergola-bench-top', -34.0, 3.24, -31.2, 2.8, .08, .76, '#8f6944', 'timber');
  box('sw-pergola-bench-leg-w', -35.0, 3.01, -31.2, .14, .42, .68, '#464d51', 'metal');
  box('sw-pergola-bench-leg-e', -33.0, 3.01, -31.2, .14, .42, .68, '#464d51', 'metal');

  // ===========================================================================
  // 4. Upper Urban Park, Promenade, Kiosk, HQ (Site A), CT Compound (y = 5.6)
  // ===========================================================================
  // Grass Turf Lawns across Riverside Park & Gardens borders
  for (const [gi, [x, z, w, d, y]] of [
    [-33.5, -18.5, 13.5, 22, 5.612],
    [-25.5, 4.5, 11.5, 18, 5.612],
    [-33.5, 26.5, 10.5, 14, 5.612],
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
    [-42.0, 2.0, 5.4, 52, 5.614],
    [-11.0, -20.0, 12.0, 14, 5.614],
  ].entries()) {
    const brickWalk = MeshBuilder.CreateGround(`sw-brick-walk-${bi}`, { width: w, height: d }, scene);
    brickWalk.position.set(x, y, z);
    brickWalk.material = surfaces ? surfaces.material('clay', '#9c6753') : material('#9c6753');
    brickWalk.setVerticesData('uv', [0, 0, w / 2.8, 0, 0, d / 2.8, w / 2.8, d / 2.8]);
    brickWalk.metadata = { castShadow: false };
    register(brickWalk);
  }

  // Rooted Park Trees (matching exact 0.72m collision trunk footprints; canopy >= 3.2m overhead!)
  for (const [idx, [tx, tz, baseY, tall]] of [
    [-24.6, -34.6, 2.8, 4.2],
    [-43.8, -2.1, 5.6, 4.2],
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
  for (const [li, [lx, lz]] of [[-44.5, -12], [-44.5, 4], [-44.5, 22], [-28, 12]].entries()) {
    const post = detailMesh(MeshBuilder.CreateCylinder(`sw-lamp-post-${li}`, { height: 4.2, diameter: .16, tessellation: 8 }, scene), '#353e41', 'metal');
    post.position.set(lx, 7.7, lz);
    const globe = detailMesh(MeshBuilder.CreateSphere(`sw-lamp-globe-${li}`, { diameter: .42, segments: 8 }, scene), '#fae3a7');
    globe.position.set(lx + .22, 9.85, lz);
    globe.metadata = { castShadow: false };
  }

  // Kiosk Café Details & Striped Awning (-18..-3.8, 14.5..23.9, y = 5.6)
  box('sw-kiosk-wood-floor', -10.9, 5.616, 19.2, 13.0, .03, 8.2, '#8b6a48', 'timber');
  box('sw-kiosk-awning', -10.9, 8.38, 13.9, 12.6, .18, 1.35, '#a84739', undefined, true);
  box('sw-kiosk-awning-trim', -10.9, 8.31, 13.26, 12.6, .16, .14, '#ede2c9', undefined, true);
  paintedSign('sw-kiosk-sign', 'PARK KIOSK  •  INFO', -10.9, 8.15, 14.48, 4.6, .58, '#283634', '#eedcaa');
  box('sw-kiosk-menu', -10.6, 6.95, 19.1, .9, .55, .12, '#222b29');

  // Flood Control HQ (Bombsite A, center -15, 29, y = 5.6)
  sitePad('A', -15, 5.622, 29, 5.8, 'FLOOD CONTROL HQ', '#8a867c', '#d86643');
  paintedSign('sw-hq-sign', 'HYDROLOGY HQ  //  SECTOR A', -17.0, 8.8, 43.76, 8.6, .74, '#243542', '#e8ecf0');

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
