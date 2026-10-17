import * as THREE from 'three';

export type Section = [y: number, halfWidth: number, halfDepth: number, centerZ?: number];

/** Ring topology with continuous UVs, welded pole caps and outward winding. */
export function loftSurface(sections: readonly Section[], segments = 20, folds = 0): THREE.BufferGeometry {
  const positions: number[] = [], uv: number[] = [], indices: number[] = [];
  const low = sections[0][0], span = sections.at(-1)![0] - low || 1;
  for (const [y, width, depth, z = 0] of sections) for (let j = 0; j <= segments; j++) {
    const angle = j * Math.PI * 2 / segments;
    const fold = 1 + Math.cos(angle * 10) * folds * (1 - (y - low) / span);
    positions.push(Math.sin(angle) * width * fold, y, Math.cos(angle) * depth * fold + z);
    uv.push(j / segments, (y - low) / span);
  }
  for (let i = 0; i < sections.length - 1; i++) for (let j = 0; j < segments; j++) {
    const a = i * (segments + 1) + j, b = a + 1, c = a + segments + 1;
    indices.push(a, b, c, b, c + 1, c);
  }
  for (const end of [0, sections.length - 1]) {
    const [y, , , z = 0] = sections[end], center = positions.length / 3;
    positions.push(0, y, z); uv.push(.5, end === 0 ? 0 : 1);
    for (let j = 0; j < segments; j++) {
      const a = end * (segments + 1) + j;
      indices.push(center, end === 0 ? a + 1 : a, end === 0 ? a : a + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

export function beveledPanel(points: readonly [number, number][], depth = 1, bevel = .15) {
  const shape = new THREE.Shape();
  points.forEach(([x, y], i) => i ? shape.lineTo(x, y) : shape.moveTo(x, y)); shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0,
    bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, steps: 1 });
  geometry.translate(0, 0, -depth / 2);
  // Export UVs in a usable 0–1 range instead of world-sized extrusion coordinates.
  const uv = geometry.getAttribute('uv');
  geometry.computeBoundingBox();
  const bounds = geometry.boundingBox!;
  const size = bounds.getSize(new THREE.Vector3());
  for (let i = 0; i < uv.count; i++) uv.setXY(i,
    (uv.getX(i) - bounds.min.x) / Math.max(1, size.x), (uv.getY(i) - bounds.min.y) / Math.max(1, size.y));
  return geometry;
}

export function taperedCurve(points: readonly [number, number, number][], radius: number, tip = .15, segments = 12) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
  const geometry = new THREE.TubeGeometry(curve, segments, radius, 8, false);
  const positions = geometry.getAttribute('position');
  for (let row = 0; row <= segments; row++) {
    const t = row / segments, center = curve.getPointAt(t), taper = 1 - t * (1 - tip);
    for (let j = 0; j <= 8; j++) {
      const i = row * 9 + j;
      positions.setXYZ(i, center.x + (positions.getX(i) - center.x) * taper,
        center.y + (positions.getY(i) - center.y) * taper, center.z + (positions.getZ(i) - center.z) * taper);
    }
  }
  geometry.computeVertexNormals(); return geometry;
}

export function faceSurface() {
  const geometry = loftSurface([[58, 1.8, 1.7, 1], [59, 3.1, 2.5, .5], [61, 4.2, 3.1],
    [63, 4.5, 3.3], [65, 4.3, 3.1], [67, 4.2, 3.4], [69, 3.3, 2.8], [70, .8, .8]], 24);
  const position = geometry.getAttribute('position');
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
    if (z > 1) {
      const nose = Math.exp(-x * x / .8 - (y - 63) ** 2 / 3) * 1.4;
      const brow = Math.exp(-((y - 65) ** 2) / .6) * .35;
      position.setZ(i, z + nose + brow);
    }
  }
  geometry.computeVertexNormals(); return geometry;
}

export function clothCape(length: number, spread: number) {
  const positions: number[] = [], uv: number[] = [], indices: number[] = [];
  const rows = 14, columns = 16;
  for (let row = 0; row <= rows; row++) for (let col = 0; col <= columns; col++) {
    const v = row / rows, u = col / columns * 2 - 1;
    positions.push(u * spread * (.62 + v * .38), 52 - v * length + v * Math.abs(u) ** 2 * 2,
      -8 - v * 5 + Math.sin(u * Math.PI * 5) * (.2 + v * .8)); uv.push(col / columns, 1 - v);
  }
  for (let r = 0; r < rows; r++) for (let c = 0; c < columns; c++) {
    const a = r * (columns + 1) + c, b = a + columns + 1;
    indices.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}
