import { Color3, VertexBuffer, type Mesh } from '@babylonjs/core';

/**
 * Shared base colour for tinted village props. A prop's own colour is baked into its vertex colours, so every
 * tinted prop on a material (plain, or one textured surface kind) joins one static batch instead of adding a
 * draw call per colour. StandardMaterial multiplies vertex colour into the white diffuse, so the result matches
 * a per-colour material.
 */
export const LIVE_TINT_BASE = '#ffffff';

export function liveTintMesh<T extends Mesh>(mesh: T, hex: string, shade?: (vertex: number) => number): T {
  const color = Color3.FromHexString(hex), count = mesh.getTotalVertices(), colors = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    const s = shade ? shade(i) : 1;
    colors[i * 4] = color.r * s; colors[i * 4 + 1] = color.g * s; colors[i * 4 + 2] = color.b * s; colors[i * 4 + 3] = 1;
  }
  mesh.setVerticesData(VertexBuffer.ColorKind, colors);
  return mesh;
}
