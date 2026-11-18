import { CreateSphereVertexData, Mesh, MeshBuilder, Vector3, VertexBuffer, VertexData, type FloatArray, type IndicesArray, type Scene } from '@babylonjs/core';

/**
 * Soft-edged and anatomically sculpted 3D procedural geometry for the CT/T operatives.
 * Hit volumes and ballistics remain strictly simulation-side (`fpsLiveBallistics.ts`).
 */

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const bump = (t: number, centre: number, width: number) => {
  const u = (t - centre) / Math.max(1e-4, width);
  return Math.abs(u) >= 1 ? 0 : (1 - u * u) * (1 - u * u);
};

function recomputeNormalsAndRefresh(mesh: Mesh, positions: FloatArray, indices: IndicesArray): void {
  const normals: number[] = [];
  VertexData.ComputeNormals(positions, indices, normals);
  mesh.updateVerticesData(VertexBuffer.PositionKind, positions);
  mesh.updateVerticesData(VertexBuffer.NormalKind, normals);
  mesh.refreshBoundingInfo();
}

const roundedTemplates = new Map<string, { positions: Float32Array; indices: Uint32Array; normals: Float32Array; uvs: Float32Array }>();

/**
 * A unit box (1 x 1 x 1) with rounded edges and corners: a sphere pushed toward the box faces
 * (superellipsoid). `squareness` near 0 is a sphere, near 1 a sharp box.
 */
function roundedBoxTemplate(segments: number, squareness: number) {
  const key = `${segments}:${squareness}`;
  const cached = roundedTemplates.get(key);
  if (cached) return cached;
  const sphere = CreateSphereVertexData({ diameter: 1, segments });
  const source = sphere.positions!, positions = new Float32Array(source.length);
  const exponent = 1 - squareness;
  for (let i = 0; i < source.length; i++) {
    const u = source[i] * 2;
    positions[i] = Math.sign(u) * Math.pow(Math.abs(u), exponent) * .5;
  }
  const indices = Uint32Array.from(sphere.indices!);
  const normals: number[] = [];
  VertexData.ComputeNormals(positions, indices, normals);
  const template = { positions, indices, normals: Float32Array.from(normals), uvs: Float32Array.from(sphere.uvs ?? []) };
  roundedTemplates.set(key, template);
  return template;
}

/**
 * Human build shared by the operative mesh, its animation and the hit volumes in `fpsLiveBallistics.ts`.
 * The torso pivot is scaled wider and deeper than the original lathe (a real chest with a vest is about
 * 0.4 m across and 0.26 m deep), the shoulder joints sit out at the deltoids, and the hit volumes are
 * sized to stay inside this silhouette.
 */
export const OPERATIVE_BUILD = {
  /** Shoulder joint distance from the body centre line (m). */ shoulderX: .205,
  /** Torso pivot scale: across, up, front-to-back. */ torsoScale: [1.1, 1, 1.28] as const,
} as const;

/** A rounded box of unit size (scale it like `CreateBox({width:1,height:1,depth:1})`). */
export function createRoundedOperativeBox(name: string, scene: Scene, small = false, large = false): Mesh {
  const template = roundedBoxTemplate(small ? 2 : large ? 4 : 3, .72);
  const data = new VertexData();
  data.positions = template.positions.slice();
  data.indices = template.indices.slice();
  data.normals = template.normals.slice();
  if (template.uvs.length) data.uvs = template.uvs.slice();
  const mesh = new Mesh(name, scene);
  data.applyToMesh(mesh, true);
  return mesh;
}

const roundedCylinderTemplates = new Map<string, { positions: Float32Array; indices: Uint32Array; normals: Float32Array; uvs: Float32Array }>();

/**
 * A unit cylinder (height 1, bottom diameter 1, top diameter `topScale`) whose rims are rolled instead of
 * cut: a superquadric that stays round around the axis and flattens toward the caps.
 */
export function createRoundedOperativeCylinder(name: string, scene: Scene, topScale = 1, small = false): Mesh {
  const segments = small ? 3 : 4, key = `${segments}:${Math.round(topScale * 1000)}`;
  let template = roundedCylinderTemplates.get(key);
  if (!template) {
    const sphere = CreateSphereVertexData({ diameter: 1, segments });
    const source = sphere.positions!, positions = new Float32Array(source.length);
    const exponent = .22;
    for (let i = 0; i < source.length; i += 3) {
      const x = source[i] * 2, y = source[i + 1] * 2, z = source[i + 2] * 2;
      const r = Math.hypot(x, z), radial = r > 1e-6 ? Math.pow(r, exponent) / r : 0;
      const ny = Math.sign(y) * Math.pow(Math.abs(y), exponent);
      const taper = 1 + (topScale - 1) * (ny * .5 + .5);
      positions[i] = x * radial * .5 * taper;
      positions[i + 1] = ny * .5;
      positions[i + 2] = z * radial * .5 * taper;
    }
    const indices = Uint32Array.from(sphere.indices!);
    const normals: number[] = [];
    VertexData.ComputeNormals(positions, indices, normals);
    template = { positions, indices, normals: Float32Array.from(normals), uvs: Float32Array.from(sphere.uvs ?? []) };
    roundedCylinderTemplates.set(key, template);
  }
  const data = new VertexData();
  data.positions = template.positions.slice();
  data.indices = template.indices.slice();
  data.normals = template.normals.slice();
  if (template.uvs.length) data.uvs = template.uvs.slice();
  const mesh = new Mesh(name, scene);
  data.applyToMesh(mesh, true);
  return mesh;
}

/** A rounded box with its own sizes (for named core parts such as boots and hands). */
export function createRoundedOperativeBlock(name: string, scene: Scene, width: number, height: number, depth: number, small = false): Mesh {
  const mesh = createRoundedOperativeBox(name, scene, small);
  bakeScale(mesh, width, height, depth);
  return mesh;
}

function bakeScale(mesh: Mesh, sx: number, sy: number, sz: number): void {
  const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
  const indices = mesh.getIndices();
  if (!positions || !indices) return;
  for (let i = 0; i < positions.length; i += 3) { positions[i] *= sx; positions[i + 1] *= sy; positions[i + 2] *= sz; }
  recomputeNormalsAndRefresh(mesh, positions, indices);
}

/**
 * Anatomically sculpted 3D combat boot: sloped vamp over the instep, asymmetric big-toe sweep,
 * raised heel counter and arch hollow underneath.
 */
export function createOperativeBoot(name: string, scene: Scene, width: number, height: number, depth: number, side: number): Mesh {
  const mesh = createRoundedOperativeBox(name, scene, false, true);
  bakeScale(mesh, width, height, depth);
  const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
  const indices = mesh.getIndices();
  if (!positions || !indices) return mesh;
  const hw = width * .5, hh = height * .5, hd = depth * .5;
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i], y = positions[i + 1], z = positions[i + 2];
    const zn = z / Math.max(1e-4, hd); // -1 heel .. +1 toe
    const yn = y / Math.max(1e-4, hh); // -1 sole .. +1 collar
    const toeT = clamp01((zn + .15) / 1.15);
    const vampSlope = yn > 0 ? .28 * clamp01((zn - .05) / .95) * height * (y / hh) : 0;
    const collarRise = yn > .2 && zn < -.05 ? .012 * clamp01((-.05 - zn) / .85) * ((yn - .2) / .8) : 0;
    const toeTaper = 1 - .18 * Math.pow(clamp01((zn - .35) / .65), 1.6);
    const ballSpread = 1 + .06 * bump(zn, .38, .35);
    // Asymmetric medial big-toe curve vs lateral pinky-toe taper
    const medialShift = -side * .007 * Math.pow(toeT, 1.4);
    const heelTuck = zn < -.45 ? (1 - .08 * clamp01((-zn - .45) / .55)) : 1;
    const archHollow = yn < -.3 ? .005 * bump(zn, -.05, .3) : 0;
    positions[i] = x * toeTaper * ballSpread * heelTuck + medialShift * clamp01(Math.abs(x) / hw + .35);
    positions[i + 1] = y - vampSlope + collarRise + archHollow;
  }
  recomputeNormalsAndRefresh(mesh, positions, indices);
  return mesh;
}

/**
 * Anatomically sculpted 3D hand/palm: tapered wrist, dorsal metacarpal arch, cupped palm interior,
 * and slight ulnar slope across the pinky edge.
 */
export function createOperativeHand(name: string, scene: Scene, width: number, height: number, depth: number, side: number): Mesh {
  const mesh = createRoundedOperativeBox(name, scene, false, false);
  bakeScale(mesh, width, height, depth);
  const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
  const indices = mesh.getIndices();
  if (!positions || !indices) return mesh;
  const hw = width * .5, hh = height * .5;
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i], y = positions[i + 1], z = positions[i + 2];
    const yn = y / Math.max(1e-4, hh); // -1 knuckles .. +1 wrist
    const xn = (x * side) / Math.max(1e-4, hw); // -1 inner/thumb .. +1 outer/pinky
    const wristTaper = 1 - .14 * clamp01((yn - .25) / .75);
    // Slight ulnar drop on pinky edge toward distal knuckles
    const ulnarDrop = xn > 0 && yn < -.1 ? .0045 * xn * clamp01((-yn - .1) / .9) : 0;
    // Slight dorsal arch (convex back z > 0, gentle palm cup z < 0)
    const archZ = (.0035 - .0025 * bump(xn, 0, 1)) * (1 - Math.abs(yn) * .5);
    positions[i] = x * wristTaper;
    positions[i + 1] = y + ulnarDrop;
    positions[i + 2] = z + archZ;
  }
  recomputeNormalsAndRefresh(mesh, positions, indices);
  return mesh;
}

/**
 * 1st-person viewmodel forearm running along local +Z (elbow at -length/2 to wrist at +length/2),
 * sculpted with brachioradialis muscle fullness and an oval anatomical wrist.
 */
export function createViewmodelForearm(
  name: string,
  scene: Scene,
  wristDiameter: number,
  elbowDiameter: number,
  length: number,
  side = 1,
): Mesh {
  const mesh = createCapsuleLimb(name, scene, wristDiameter, elbowDiameter, length, 20, 10);
  const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
  const indices = mesh.getIndices();
  if (!positions || !indices) return mesh;
  const half = Math.max(1e-4, length * .5);
  for (let i = 0; i < positions.length; i += 3) {
    const x0 = positions[i], y0 = positions[i + 1], z0 = positions[i + 2];
    // Rotate +90deg around X so +Y (wrist) becomes +Z and -Z becomes +Y (top of forearm)
    const u = clamp01((y0 + half) / length); // 0 = elbow .. 1 = wrist
    const brachio = bump(u, .32, .34);
    const wristFlat = clamp01((u - .68) / .32);
    const rx = 1 + .11 * brachio + .07 * wristFlat;
    const ry = 1 + .08 * brachio - .13 * wristFlat;
    positions[i] = x0 * rx + side * .003 * brachio;
    positions[i + 1] = -z0 * ry + .004 * brachio;
    positions[i + 2] = y0;
  }
  recomputeNormalsAndRefresh(mesh, positions, indices);
  return mesh;
}

/** Rolled fabric sleeve cuff or wrist watch/strap oriented around the Z forearm axis. */
export function createViewmodelCuff(name: string, scene: Scene, width: number, height: number, length: number): Mesh {
  const mesh = createRoundedOperativeCylinder(name, scene, .92, false);
  const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
  const indices = mesh.getIndices();
  if (!positions || !indices) return mesh;
  for (let i = 0; i < positions.length; i += 3) {
    const x0 = positions[i], y0 = positions[i + 1], z0 = positions[i + 2];
    const crease = 1 + .045 * Math.sin(clamp01(y0 + .5) * Math.PI * 3);
    positions[i] = x0 * width * crease;
    positions[i + 1] = -z0 * height * crease;
    positions[i + 2] = y0 * length;
  }
  recomputeNormalsAndRefresh(mesh, positions, indices);
  return mesh;
}

/** Sculpted 4-finger curled cluster for 1st-person weapon grips and forends. */
export function createViewmodelFingerCluster(name: string, scene: Scene, width: number, height: number, depth: number, side = 1): Mesh {
  const mesh = createRoundedOperativeBox(name, scene, false, true);
  bakeScale(mesh, width, height, depth);
  const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
  const indices = mesh.getIndices();
  if (!positions || !indices) return mesh;
  const hw = Math.max(1e-4, width * .5), hh = Math.max(1e-4, height * .5);
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i], y = positions[i + 1], z = positions[i + 2];
    const yt = clamp01((y + hh) / height);
    const zt = clamp01((z + depth * .5) / Math.max(1e-4, depth));
    const ridge = Math.abs(Math.sin(yt * Math.PI * 4));
    const curl = Math.sin(zt * Math.PI) * .005;
    positions[i] = x * (.88 + .16 * ridge) + side * curl * .5;
    positions[i + 1] = y;
    positions[i + 2] = z + (.003 * ridge * (Math.abs(x) / hw));
  }
  recomputeNormalsAndRefresh(mesh, positions, indices);
  return mesh;
}

/**
 * A limb segment centred on its origin: tapered from `topDiameter` to `bottomDiameter` over `height`, with
 * rounded (half-ellipsoid) ends so joints read as flesh rather than cut tubes. Built updatable so the
 * existing muscle profiles can sculpt it.
 */
export function createCapsuleLimb(name: string, scene: Scene, topDiameter: number, bottomDiameter: number, height: number, tessellation = 18, rings = 10): Mesh {
  const rt = topDiameter / 2, rb = bottomDiameter / 2, half = height / 2;
  const capTop = rt * .55, capBottom = rb * .55;
  const shape: Vector3[] = [];
  const capSteps = 4;
  // Bottom cap: from the pole up to the bottom rim.
  for (let i = 0; i <= capSteps; i++) {
    const a = (i / capSteps) * Math.PI / 2;
    shape.push(new Vector3(Math.max(1e-4, Math.sin(a) * rb), -half - Math.cos(a) * capBottom + capBottom * .35, 0));
  }
  for (let i = 1; i < rings; i++) {
    const t = i / rings;
    shape.push(new Vector3(rb + (rt - rb) * t, -half + capBottom * .35 + (height - (capBottom + capTop) * .35) * t, 0));
  }
  for (let i = capSteps; i >= 0; i--) {
    const a = (i / capSteps) * Math.PI / 2;
    shape.push(new Vector3(Math.max(1e-4, Math.sin(a) * rt), half + Math.cos(a) * capTop - capTop * .35, 0));
  }
  return MeshBuilder.CreateLathe(name, { shape, tessellation, updatable: true, closed: true }, scene);
}

/**
 * Torso from pelvis to the base of the neck: narrow waist, fuller ribcage, and sloped trapezius shoulders
 * with higher ring density for chest/spine sculpting.
 */
export function createOperativeTorso(name: string, scene: Scene, height: number, topDiameter: number, bottomDiameter: number): Mesh {
  const half = height / 2, rt = topDiameter / 2, rb = bottomDiameter / 2;
  const profile: [number, number][] = [
    [0, -half - .028], [rb * .68, -half - .022], [rb * .94, -half - .002], [rb * 1.01, -half + .032],
    [rb * .98, -half + .078], [rb * .94, -half + .125], [rb * .96, -half + .175], [(rb + rt) * .50, -half + .235],
    [rt * .96, -half + .295], [rt * .99, half - .14], [rt * 1.01, half - .095], [rt * .98, half - .055],
    [rt * .91, half - .026], [rt * .78, half - .004], [rt * .60, half + .012], [rt * .44, half + .022],
    [rt * .34, half + .029], [0, half + .032],
  ];
  return MeshBuilder.CreateLathe(name, { shape: profile.map(([r, y]) => new Vector3(Math.max(1e-4, r), y, 0)), tessellation: 28, updatable: true, closed: true }, scene);
}

/**
 * Anatomically sculpted 3D human cranium and face: rounded parietal dome, occipital back curve,
 * defined jawline & chin projection, zygomatic cheekbones, slight temple hollows, brow ridge & eye sockets.
 */
export const OPERATIVE_HEAD_PROFILE = {
  width: (t: number) =>
    t < .38
      ? .74 + .26 * Math.pow(t / .38, .68)
      : 1.03 - .06 * Math.max(0, (t - .80) / .20) + .02 * bump(t, .56, .20),
  depth: (t: number) =>
    t < .32
      ? .84 + .16 * (t / .32)
      : 1.01 + .045 * Math.sin(Math.min(1, (t - .32) / .58) * Math.PI),
  forward: (t: number) =>
    t < .35
      ? .014 * (1 - t / .35)
      : -.007 * Math.sin(Math.min(1, (t - .35) / .65) * Math.PI),
  harmonic: (t: number, nx: number, nz: number) => {
    const front = Math.max(0, nz), back = Math.max(0, -nz), absX = Math.abs(nx);
    // Chin & anterior jaw taper cleanly into a defined mandibular line instead of an inverted egg
    const chinProj = front * bump(t, .16, .14) * bump(absX, 0, .45) * .13;
    const jawAngle = clamp01((absX - .42) / .45) * bump(t, .28, .15) * (nz > -.3 ? .085 : 0);
    // Cheekbone malar prominence below orbital socket & slight temple hollow above
    const cheek = front * bump(absX, .56, .34) * bump(t, .44, .12) * .075;
    const templeDip = -clamp01((absX - .62) / .38) * bump(t, .64, .14) * .045;
    // Supraorbital brow ridge above softly recessed eye sockets
    const browRidge = front * bump(t, .60, .09) * bump(absX, .28, .48) * .085;
    const orbitRecess = -front * bump(t, .50, .08) * bump(absX, .34, .24) * .07;
    // Occipital curve at the back of the skull and tucked nape underneath
    const occiput = back * bump(t, .50, .24) * .075;
    const napeTuck = -back * bump(t, .16, .18) * .10;
    return {
      rx: 1 + jawAngle + cheek * .5 + templeDip,
      rz: 1 + chinProj + cheek * .4 + browRidge + orbitRecess + occiput + napeTuck,
      dy: t < .18 && front > .4 ? -.003 * front * (1 - t / .18) : 0,
    };
  },
};
