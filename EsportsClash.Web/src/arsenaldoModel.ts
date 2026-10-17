import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { beveledPanel, loftSurface, taperedCurve, type Section } from './avatarSurfaceGeometry.ts';
import type { AvatarModelResources } from './threeAvatarModels.ts';
import {AVATAR_MESH_PROFILES,meshSection} from './avatarMeshProfiles.ts';

type V = [number, number, number];
type Weight = (x: number, y: number) => [number, number, number];
const C = { ivory: '#d4c8ad', navy: '#192b40', leather: '#302b32', gold: '#b99960',
  goldLight: '#e0c184', wine: '#542438', skin: '#bd896a', hair: '#d2c1a0' };

/** A deliberately authored hero, independent of the roster's generic human template.
 * All surfaces use the existing skeleton and standard glTF vertex-color materials. */
export function sculptArsenaldo(outfit: THREE.Group, resources: AvatarModelResources, bones: THREE.Bone[], externalAnatomy = false) {
  const rigid = (name: string): Weight => () => [bones.findIndex(b => b.name === name), 0, 1];
  const joint = (a: string, b: string, low: number, high: number): Weight => (_x, y) =>
    [bones.findIndex(bone => bone.name === a), bones.findIndex(bone => bone.name === b), THREE.MathUtils.clamp((y - low) / (high - low), 0, 1)];
  let serial = 0;
  const surface = (name: string, color: string, geometry: THREE.BufferGeometry, weight: Weight = rigid('Root'), glow = false, double = false) => {
    if (externalAnatomy && ((name !== 'neck' && weight(0, 64)[0] === bones.findIndex(b => b.name === 'Head')) ||
      /^(gloved-palm|gloved-finger|knuckle-stud|thumb)$/.test(name))) { geometry.dispose(); return; }
    const key = `arsenaldo-art:${serial++}:${name}`;
    const owned = resources.geometry(key, () => {
      const positions = geometry.getAttribute('position'), normals = geometry.getAttribute('normal');
      if(/^(brocade-waistcoat|split-coat|coat-lining|coat-gold-seam)$/.test(name)){
        for(let i=0;i<positions.count;i++){const section=meshSection(AVATAR_MESH_PROFILES.c_invoker,positions.getY(i));positions.setX(i,positions.getX(i)*section.x);positions.setZ(i,positions.getZ(i)*section.z);}
        geometry.computeVertexNormals();
      }
      const indices: number[] = [], weights: number[] = [], colors: number[] = [];
      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
        const coat=/^(split-coat|coat-lining|coat-gold-seam)$/.test(name)&&y<32;
        const [a,b,blend]=coat?[bones.findIndex(b=>b.name==='Hips'),bones.findIndex(b=>b.name===(x<0?'ThighL':'ThighR')),1-THREE.MathUtils.clamp((32-y)/25,0,1)*.32]:weight(x,y);
        indices.push(a, b, 0, 0); weights.push(blend, 1 - blend, 0, 0);
        // Broad painted values retain form even at arena scale. No random state or image dependency.
        const shade = THREE.MathUtils.clamp(.78 + normals.getY(i) * .12 + normals.getZ(i) * .08
          + Math.sin(x * 2.7 + y * .6 + z * 1.4) * .018, .54, 1);
        colors.push(shade, shade, shade);
      }
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(indices, 4));
      geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4)); return geometry;
    });
    if (owned !== geometry) geometry.dispose();
    const result = new THREE.SkinnedMesh(owned, resources.material(color, glow, double, true));
    result.name = name; result.frustumCulled = false; outfit.add(result); return result;
  };
  const loft = (name: string, color: string, sections: Section[], weight?: Weight, x = 0) =>
    surface(name, color, loftSurface(sections, 32).translate(x, 0, 0), weight);
  const line = (name: string, color: string, points: V[], radius = .23, weight?: Weight) =>
    surface(name, color, taperedCurve(points, radius, .8, 18), weight);
  const ellipsoid = (name: string, color: string, at: V, scale: V, weight?: Weight, glow = false) =>
    surface(name, color, new THREE.SphereGeometry(1, 24, 16).scale(...scale).translate(...at), weight, glow);
  const panel = (name: string, color: string, points: [number, number][], depth: number, z: number, weight?: Weight) =>
    surface(name, color, beveledPanel(points, depth, .16).translate(0, 0, z), weight);
  const head = rigid('Head'), chest = rigid('Chest'), hips = rigid('Hips');

  loft('brocade-waistcoat', C.navy, [[31, 7.3, 4.4], [35, 7.1, 4.4], [40, 8.4, 4.8],
    [46, 11, 5.5], [50, 10.7, 4.8], [53, 7.5, 3.4], [55, 3.2, 2.7]], joint('Chest', 'Hips', 33, 50));
  loft('neck', C.skin, [[54, 2.5, 2.5], [58, 2.35, 2.3], [60, 2.9, 2.7]], head);
  // Smaller eyes and a shaped jaw, cheeks, muzzle, nose, brow and temples.
  const faceSections: Section[] = [[58.5, 1.6, 1.7, .8], [59, 2.6, 2.3, .6], [60, 3.3, 2.65, .4],
    [61, 3.75, 2.8, .25], [62, 4.15, 2.9], [63, 4.35, 3.05], [64, 4.2, 3.05],
    [65, 4.1, 3.2], [66, 4.15, 3.2], [67, 4.2, 3.25], [68, 3.85, 3.1], [69, 3.1, 2.65], [70, 1, .9]];
  const denseFace: Section[] = [];
  faceSections.forEach((section, i) => {
    if (!i) { denseFace.push(section); return; }
    const previous = faceSections[i - 1], steps = Math.ceil((section[0] - previous[0]) * 4);
    for (let j = 1; j <= steps; j++) denseFace.push([THREE.MathUtils.lerp(previous[0], section[0], j / steps),
      THREE.MathUtils.lerp(previous[1], section[1], j / steps), THREE.MathUtils.lerp(previous[2], section[2], j / steps),
      THREE.MathUtils.lerp(previous[3] ?? 0, section[3] ?? 0, j / steps)]);
  });
  const face = loftSurface(denseFace, 48);
  const pos = face.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    if (z > 0) {
      const gaussian = (cx: number, cy: number, sx: number, sy: number) => Math.exp(-(((x - cx) / sx) ** 2) - ((y - cy) / sy) ** 2);
      const front = THREE.MathUtils.smoothstep(z, 0, 2.4);
      const nose = gaussian(0, 63.2, .65, 1.7) * 1.5 + gaussian(0, 62.4, .8, .55) * .55;
      const eyes = (gaussian(-1.9, 64.35, 1.1, .65) + gaussian(1.9, 64.35, 1.1, .65)) * -.55;
      const cheek = (gaussian(-2.7, 62.8, 1, .8) + gaussian(2.7, 62.8, 1, .8)) * .44;
      pos.setZ(i, z + front * (nose + eyes + cheek + gaussian(0, 61, 1.65, .75) * .3));
    }
  }
  face.computeVertexNormals(); surface('sculpted-face', C.skin, face, head);
  for (const side of [-1, 1]) {
    ellipsoid(`ear-${side}`, C.skin, [side * 4.2, 62.8, -.1], [.72, 1.45, .55], head);
    line('ear-fold', '#95684f', [[side * 4.3, 63.6, .3], [side * 4.65, 63, .38], [side * 4.3, 62.2, .35]], .15, head);
    ellipsoid('eye-socket', '#744e40', [side * 1.9, 64.3, 2.98], [1.18, .49, .23], head);
    ellipsoid('almond-eye', '#c9bfa7', [side * 1.9, 64.3, 3.12], [.92, .29, .17], head);
    ellipsoid('iris', '#62938e', [side * 1.9, 64.3, 3.28], [.26, .27, .07], head);
    ellipsoid('pupil', '#142e32', [side * 1.9, 64.3, 3.34], [.11, .21, .035], head);
    ellipsoid('eye-light', '#fff0cf', [side * 1.8, 64.4, 3.37], [.07, .07, .025], head);
    line('upper-lid', '#865d49', [[side * .95, 64.25, 3.1], [side * 1.9, 64.62, 3.24], [side * 2.85, 64.35, 2.99]], .14, head);
    line('eyebrow', '#71634f', [[side * .95, 65.1, 3.3], [side * 1.85, 65.35, 3.35], [side * 3.1, 65.1, 2.9]], .24, head);
    ellipsoid('nostril', '#835741', [side * .47, 62.2, 3.95], [.23, .14, .11], head);
  }
  line('mouth', '#774b40', [[-1.32, 60.8, 2.98], [-.5, 60.85, 3.19], [0, 60.77, 3.25], [.6, 60.84, 3.17], [1.32, 60.85, 2.98]], .105, head);
  line('lower-lip', '#bf8974', [[-.9, 60.55, 3.07], [0, 60.47, 3.23], [.9, 60.58, 3.07]], .13, head);
  const hair = loftSurface([[64.5, 4.1, 3.15, -.7], [67, 4.35, 3.45, -.3],
    [69, 4.2, 3.4, -.2], [70.4, 3, 2.6], [70.9, 1, 1]], 32);
  const hp = hair.getAttribute('position');
  for (let i = 0; i < hp.count; i++) if (hp.getZ(i) > 0 && hp.getY(i) < 67.7) {
    hp.setY(i, THREE.MathUtils.lerp(hp.getY(i), 67.7, THREE.MathUtils.smoothstep(hp.getZ(i), 0, 2.8)));
  }
  hair.computeVertexNormals(); surface('hair-foundation', '#b6a486', hair, head);
  // Swept sculpted locks, dark roots and fine engraved strand highlights.
  for (let i = 0; i < 15; i++) {
    const x = -4 + i * .53, top = 69.4 + Math.sin(i * .22) * .5;
    const points: V[] = [[x * .6 - .5, top - .6, -2.4], [x * .85 - 1.2, top + .8, -.5],
      [x * .95 - .3, top + .4, 1.7], [x + .9, 67.5 + Math.abs(x) * .09 + Math.sin(i * .8) * .35, 3]];
    surface('swept-hair-lock', i % 3 === 0 ? '#b6a486' : C.hair, taperedCurve(points, .68, .08, 16), head);
    line('hair-strand', '#e0d0ab', points.map(([px, py, pz]) => [px - .12, py + .24, pz + .2]), .065, head);
  }
  for (let i = 0; i < 17; i++) {
    const a = Math.PI * .48 + i / 16 * Math.PI * 1.04;
    const points: V[] = [[Math.sin(a) * 2.1 - .5, 70, Math.cos(a) * 1.9],
      [Math.sin(a) * 3.9, 68.4, Math.cos(a) * 3.4 - .4],
      [Math.sin(a) * 4.05, 65.7, Math.cos(a) * 3.35 - .5],
      [Math.sin(a) * 3.7, 64.7 + Math.sin(i) * .25, Math.cos(a) * 2.85 - .5]];
    surface('side-hair-lock', i % 3 ? C.hair : '#b6a486', taperedCurve(points, .58, .05, 12), head);
  }

  // Curved standing collar wraps the neck instead of the previous triangular ears.
  const collar = loftSurface([[53.8, 4.2, 3, -.5], [55, 4.8, 3.4, -.7], [57, 5, 3.5, -.8], [58.3, 4.8, 3.1, -1]], 32);
  const cp = collar.getAttribute('position');
  for (let i = 0; i < cp.count; i++) if (cp.getZ(i) > 0) {
    cp.setY(i, cp.getY(i) - THREE.MathUtils.smoothstep(cp.getZ(i), 0, 2) * Math.max(0, cp.getY(i) - 55) * .8);
  }
  collar.computeVertexNormals(); surface('standing-collar', C.wine, collar, chest);
  // An asymmetric velvet half-mantle supplies a strong side/back silhouette.
  const capeVertices: number[] = [], capeUv: number[] = [], capeIndices: number[] = [];
  for (let row = 0; row <= 20; row++) for (let col = 0; col <= 16; col++) {
    const v = row / 20, u = col / 16;
    capeVertices.push(-12 + u * (18 + v * 3) - v * 5, 51 - v * (32 + Math.sin(u * Math.PI) * 5),
      -5.8 - v * 5.5 + Math.sin(u * Math.PI * 6) * (.3 + v * .75)); capeUv.push(u, 1 - v);
  }
  for (let row = 0; row < 20; row++) for (let col = 0; col < 16; col++) {
    const a = row * 17 + col, b = a + 17; capeIndices.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const mantle = new THREE.BufferGeometry(); mantle.setAttribute('position', new THREE.Float32BufferAttribute(capeVertices, 3));
  mantle.setAttribute('uv', new THREE.Float32BufferAttribute(capeUv, 2)); mantle.setIndex(capeIndices); mantle.computeVertexNormals();
  surface('velvet-half-mantle', C.wine, mantle, chest, false, true);
  for (const edge of [0, 16]) {
    const points: V[] = [];
    for (let row = 0; row <= 20; row += 4) { const n = (row * 17 + edge) * 3; points.push([capeVertices[n], capeVertices[n + 1], capeVertices[n + 2] - .2]); }
    line('mantle-trim', C.gold, points, .25, chest);
  }
  // Front opening exposes the neck and waistcoat; sloped ivory lapels frame it.
  panel('left-lapel', C.ivory, [[-10, 50], [-5.8, 55], [-3.5, 52], [-1.7, 41], [-4.1, 44]], .8, 4.2, chest);
  panel('right-lapel', C.ivory, [[10, 50], [5.8, 55], [3.5, 52], [1.7, 41], [4.1, 44]], .8, 4.2, chest);
  for (const side of [-1, 1]) {
    line('lapel-piping', C.goldLight, [[side * 5.8, 54.9, 4.7], [side * 3.8, 51.6, 5], [side * 1.8, 41, 5.2]], .24, chest);
    // Flowing split coat: individually curved front, side and back panels, with a burgundy lining.
    for (let piece = 0; piece < 3; piece++) {
      const rows = 20, columns = 12, vertices: number[] = [], uv: number[] = [], indices: number[] = [];
      for (let r = 0; r <= rows; r++) for (let c = 0; c <= columns; c++) {
        const v = r / rows, u = c / columns, angle = side * (.23 + piece * .92 + u * .91);
        const width = 7.8 + v * 6.7, depth = 4.8 + v * 3.8;
        vertices.push(Math.sin(angle) * width, 36 - v * (26 - Math.sin(u * Math.PI) * 2 - piece),
          Math.cos(angle) * depth - v * v * 3 + Math.sin(u * Math.PI * 3) * v * .7);
        uv.push(u, 1 - v);
      }
      for (let r = 0; r < rows; r++) for (let c = 0; c < columns; c++) {
        const a = r * (columns + 1) + c, b = a + columns + 1;
        if (side > 0) indices.push(a, a + 1, b, a + 1, b + 1, b); else indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
      const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geometry.setIndex(indices); geometry.computeVertexNormals();
      surface('split-coat', C.ivory, geometry, hips, false, true);
      surface('coat-lining', C.wine, geometry.clone().scale(.985, 1, .985), hips, false, true);
      for (const edge of [0, 1]) {
        const points: V[] = [];
        for (let r = 0; r <= rows; r += 4) { const n = (r * (columns + 1) + edge * columns) * 3; points.push([vertices[n] * 1.01, vertices[n + 1], vertices[n + 2] * 1.01]); }
        line('coat-gold-seam', C.gold, points, .22, hips);
      }
    }
    const i = side < 0 ? 0 : 1, x = side * 12.2, suffix = i ? 'R' : 'L';
    const upper = rigid(`UpperArm${suffix}`), fore = rigid(`Forearm${suffix}`), hand = rigid(`Hand${suffix}`);
    loft('fitted-sleeve', C.navy, [[27, 1.65, 1.65], [32, 2.1, 2], [36, 2.65, 2.4],
      [40, 2.6, 2.4], [45, 3.25, 2.8], [49, 3.5, 3], [51, 2.3, 2.3]], joint(`UpperArm${suffix}`, `Forearm${suffix}`, 36, 41), x);
    // Three overlapping domed plates per shoulder.
    for (let layer = 0; layer < 3; layer++) {
      const y = 48.5 + layer * 1.45, size = 4.9 - layer * .65;
      loft('layered-pauldron', layer === 2 ? C.goldLight : C.gold, [[y - 1.2, size, 3.9], [y, size + .6, 4.4], [y + 1.7, size * .7, 3.2], [y + 2.3, .9, 1]], upper, x + side * (2 - layer * .6));
    }
    ellipsoid('shoulder-enamel', C.navy, [x + side, 52.3, 2.5], [2.4, 1.4, 1.5], upper);
    ellipsoid('shoulder-rune', '#72b3be', [x + side, 52.6, 3.65], [.7, .9, .32], upper, true);
    loft('leather-gauntlet', C.leather, [[28, 1.9, 1.8], [29, 2.5, 2.2], [33, 2.65, 2.3], [36, 2.8, 2.5], [37, 2.4, 2.3]], fore, x);
    for (const y of [29, 35.5]) loft('gauntlet-rim', C.gold, [[y, 2.7, 2.4], [y + .65, 2.7, 2.4]], fore, x);
    panel('gauntlet-crest', C.gold, [[x - 1.4, 30.5], [x + 1.4, 30.5], [x + 1.7, 34.3], [x, 35.3], [x - 1.7, 34.3]], .3, 2.5, fore);
    ellipsoid('gloved-palm', C.leather, [x, 26, .2], [1.8, 2, 1.1], hand);
    for (let f = 0; f < 4; f++) {
      const fx = x + (f - 1.5) * .85;
      line('gloved-finger', C.leather, [[fx, 25.4, .4], [fx, 23.5 - (f % 3) * .2, .8], [fx, 23.2, 1.7]], .44, hand);
      ellipsoid('knuckle-stud', C.gold, [fx, 25.4, 1.2], [.28, .34, .16], hand);
    }
    line('thumb', C.leather, [[x - side * 1.5, 26.7, .5], [x - side * 2.1, 25.2, 1.4], [x - side * 1.3, 24.6, 1.8]], .55, hand);
    const legX = side * 4.5, foot = rigid(`Foot${suffix}`), calf = rigid(`Calf${suffix}`);
    loft('trousers', C.navy, [[8, 2.1, 2.3], [17, 2.5, 2.5], [24, 3.4, 3], [33, 3.6, 3.4]], joint(`Thigh${suffix}`, `Calf${suffix}`, 14, 20), legX);
    loft('riding-boot', C.leather, [[1, 2.8, 5.3, 2], [2, 3, 5.7, 2], [3.6, 2.8, 5.2, 1.8], [6, 2.2, 3, .5], [10, 2.3, 2.4], [17, 2.8, 2.7]], calf, legX);
    loft('boot-sole', '#171c25', [[.6, 3, 5.6, 2], [1.5, 3, 5.6, 2]], foot, legX);
    panel('boot-crest', C.gold, [[legX - 1.2, 11], [legX, 9], [legX + 1.2, 11], [legX + 1.5, 16], [legX - 1.5, 16]], .3, 2.6, calf);
    // Waistcoat embroidery: repeated angular botanical motifs rather than blank flat panels.
    for (let row = 0; row < 4; row++) {
      const y = 36.5 + row * 3.2;
      line('brocade-motif', C.gold, [[side * 4.8, y, 4.9], [side * 6, y + 1.3, 4.75], [side * 4.8, y + 2.3, 5], [side * 3.8, y + 1.3, 5.15], [side * 4.8, y, 4.9]], .075, chest);
    }
  }
  loft('layered-sash', C.wine, [[31, 8, 4.9], [32, 8.3, 5], [34.2, 7.8, 4.8]], hips);
  panel('belt-clasp', C.gold, [[-2.2, 32], [0, 30.6], [2.2, 32], [2, 34.8], [0, 35.6], [-2, 34.8]], .5, 5.1, hips);
  ellipsoid('clasp-stone', '#5d9fac', [0, 33.3, 5.6], [.9, 1.2, .4], hips, true);
  for (let i = 0; i < 4; i++) ellipsoid('waistcoat-button', C.goldLight, [0, 37 + i * 3.7, 5.2], [.42, .42, .24], chest);
  // Small chain catches the key light across the sternum.
  line('chest-chain', C.goldLight, [[-6.5, 49.6, 4.7], [-4, 47.5, 5.6], [0, 46.4, 5.8], [4, 47.5, 5.6], [6.5, 49.6, 4.7]], .18, chest);
  // The common skeleton allows all surfaces of one material to share one draw.
  const batches = new Map<THREE.Material, THREE.SkinnedMesh[]>();
  for (const child of outfit.children) if (child instanceof THREE.SkinnedMesh && !Array.isArray(child.material)) {
    const batch = batches.get(child.material) ?? []; batch.push(child); batches.set(child.material, batch);
  }
  let batchIndex = 0;
  for (const [material, meshes] of batches) {
    const geometry = resources.geometry(`arsenaldo-art:batch:${batchIndex++}`, () => {
      const copies = meshes.map(mesh => mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone());
      const merged = mergeGeometries(copies); copies.forEach(copy => copy.dispose());
      if (!merged) throw Error('Arsenaldo surface merge failed');
      const indexed = mergeVertices(merged); merged.dispose(); return indexed;
    });
    const mesh = new THREE.SkinnedMesh(geometry, material); mesh.name = `arsenaldo-surface-${batchIndex}`;
    mesh.userData.surfaces = meshes.map(part => part.name); mesh.frustumCulled = false;
    meshes.forEach(part => outfit.remove(part)); outfit.add(mesh);
  }
}

/** Elemental silhouettes, kept separate so live spell colors still follow the real unit. */
export function arsenaldoElements(body: THREE.Group, resources: AvatarModelResources) {
  const colors = ['#8ad9f8', '#b5a4f3', '#ff9960'];
  colors.forEach((color, i) => {
    const orb = new THREE.Group(); orb.name = `element-orb:${i}`; orb.userData.avatarPart = orb.name; body.add(orb);
    const geometry = resources.geometry(`arsenaldo:element-core:${i}`, () => new THREE.IcosahedronGeometry(2.6, 1));
    orb.add(new THREE.Mesh(geometry, resources.material(color, true)));
    for (let k = 0; k < 3; k++) {
      const points: V[] = [];
      for (let j = 0; j <= 24; j++) {
        const angle = j / 24 * Math.PI * 1.65 + k * Math.PI * 2 / 3;
        const radius = 4.2 + Math.sin(angle * 2 + k) * .6;
        points.push([Math.cos(angle) * radius, Math.sin(angle) * radius, Math.sin(angle * 1.5 + k) * 1.7]);
      }
      const ribbon = resources.geometry(`arsenaldo:element-ribbon:${i}:${k}`, () => taperedCurve(points, i === 2 ? .6 : .3, .06, 32));
      const mesh = new THREE.Mesh(ribbon, resources.material(color, true)); mesh.rotation.y = k * 1.1; orb.add(mesh);
    }
    for (let k = 0; k < 5; k++) {
      const angle = k * 2.4;
      resources.mesh(orb, 'gem', color, [.45, i === 0 ? 1.7 : .6, .45], [Math.cos(angle) * 5.2, Math.sin(angle) * 5.2, k % 2 ? 1.5 : -1.5], true);
    }
  });
}
