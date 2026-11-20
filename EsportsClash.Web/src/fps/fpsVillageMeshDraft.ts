import { Mesh, VertexData, type Scene } from '@babylonjs/core';

export interface DraftPoint { x: number; y: number; z: number }

/** Small hand-built mesh whose faces are wound against Babylon's own normal convention. */
export class MeshDraft {
  positions: number[] = []; normals: number[] = []; uvs: number[] = []; indices: number[] = []; colors: number[] = [];
  private push(points: readonly DraftPoint[], normal: DraftPoint, uv: readonly (readonly [number, number])[], shade?: readonly number[]) {
    const base = this.positions.length / 3;
    points.forEach((p, i) => {
      this.positions.push(p.x, p.y, p.z); this.normals.push(normal.x, normal.y, normal.z); this.uvs.push(uv[i][0], uv[i][1]);
      if (shade) this.colors.push(shade[i], shade[i], shade[i], 1);
    });
    // Babylon's face normal is (p1 - p2) x (p3 - p2); flip the winding when it opposes the intended side.
    const [a, b, c] = points, ux = a.x - b.x, uy = a.y - b.y, uz = a.z - b.z, vx = c.x - b.x, vy = c.y - b.y, vz = c.z - b.z;
    return { base, flip: (uy * vz - uz * vy) * normal.x + (uz * vx - ux * vz) * normal.y + (ux * vy - uy * vx) * normal.z < 0 };
  }
  quad(corners: [DraftPoint, DraftPoint, DraftPoint, DraftPoint], normal: DraftPoint, uv: [number, number][], shade?: number[]) {
    const { base, flip } = this.push(corners, normal, uv, shade);
    if (!flip) this.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    else this.indices.push(base, base + 2, base + 1, base, base + 3, base + 2);
  }
  tri(corners: [DraftPoint, DraftPoint, DraftPoint], normal: DraftPoint, uv: [number, number][]) {
    const { base, flip } = this.push(corners, normal, uv);
    this.indices.push(...(flip ? [base, base + 2, base + 1] : [base, base + 1, base + 2]));
  }
  build(name: string, scene: Scene): Mesh {
    const mesh = new Mesh(name, scene), data = new VertexData();
    data.positions = this.positions; data.normals = this.normals; data.uvs = this.uvs; data.indices = this.indices;
    if (this.colors.length) data.colors = this.colors;
    data.applyToMesh(mesh); return mesh;
  }
}

export interface ArchedWallSpec {
  /** Wall runs along x (a z-facing wall) or along z (an x-facing wall), from `from` to `to`. */
  along: 'x' | 'z'; from: number; to: number;
  /** Clear opening between `openFrom` and `openTo`, a segmental arch springing at `springY` with `rise`. */
  openFrom: number; openTo: number; springY: number; rise: number; topY: number;
  /** The wall's two faces, at these coordinates on the other horizontal axis. */
  faceA: number; faceB: number; metres: number; steps?: number;
}

/** Solid masonry over an arched opening: both faces down to the arch curve, plus the soffit across it. */
export function addArchedWall(draft: MeshDraft, spec: ArchedWallSpec): void {
  const centre = (spec.openFrom + spec.openTo) / 2, half = (spec.openTo - spec.openFrom) / 2;
  const radius = (half * half + spec.rise * spec.rise) / (2 * spec.rise), cy = spec.springY + spec.rise - radius;
  const curve = (a: number) => Math.abs(a - centre) >= half ? spec.springY : cy + Math.sqrt(radius * radius - (a - centre) ** 2);
  const at = (a: number, y: number, c: number): DraftPoint => spec.along === 'x' ? { x: a, y, z: c } : { x: c, y, z: a };
  const normal = (sign: number): DraftPoint => spec.along === 'x' ? { x: 0, y: 0, z: sign } : { x: sign, y: 0, z: 0 };
  const steps = spec.steps ?? 24, m = spec.metres, outward = Math.sign(spec.faceB - spec.faceA) || 1;
  for (let i = 0; i < steps; i++) {
    const a0 = spec.from + (spec.to - spec.from) * i / steps, a1 = spec.from + (spec.to - spec.from) * (i + 1) / steps;
    const y0 = curve(a0), y1 = curve(a1);
    for (const [c, sign] of [[spec.faceA, -outward], [spec.faceB, outward]] as const) draft.quad(
      [at(a0, y0, c), at(a1, y1, c), at(a1, spec.topY, c), at(a0, spec.topY, c)], normal(sign),
      [[a0 / m, y0 / m], [a1 / m, y1 / m], [a1 / m, spec.topY / m], [a0 / m, spec.topY / m]]);
    const mid = (a0 + a1) / 2;
    if (Math.abs(mid - centre) < half) {
      const my = curve(mid), len = Math.hypot(mid - centre, my - cy) || 1, na = (centre - mid) / len, ny = (cy - my) / len;
      draft.quad([at(a0, y0, spec.faceA), at(a1, y1, spec.faceA), at(a1, y1, spec.faceB), at(a0, y0, spec.faceB)],
        spec.along === 'x' ? { x: na, y: ny, z: 0 } : { x: 0, y: ny, z: na },
        [[a0 / m, spec.faceA / m], [a1 / m, spec.faceA / m], [a1 / m, spec.faceB / m], [a0 / m, spec.faceB / m]]);
    }
  }
}
