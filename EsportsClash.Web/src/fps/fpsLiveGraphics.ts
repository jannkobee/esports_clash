import { Color3, DynamicTexture, Mesh, MeshBuilder, StandardMaterial, Texture, Vector4, type Scene } from '@babylonjs/core';

export type LiveSurface = 'plaster' | 'stone' | 'paving' | 'timber' | 'metal' | 'clay';
export const LIVE_SURFACE_METRES: Record<LiveSurface, number> = {
  plaster: 3.2, stone: 4, paving: 4, timber: 2, metal: 3, clay: 3.2,
};

/** Box face ordering follows Babylon's front/back/right/left/top/bottom UVs. */
export function liveBoxSurfaceUV(width: number, height: number, depth: number, metres: number): Vector4[] {
  return [[width, height], [width, height], [depth, height], [depth, height], [width, depth], [width, depth]]
    .map(([u, v]) => new Vector4(0, 0, u / metres, v / metres));
}

const noise = (x: number, y: number, seed: number) => {
  let value = Math.imul(x + seed, 374761393) ^ Math.imul(y + seed * 3, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
};
const smooth = (value: number) => value * value * (3 - 2 * value);
const clamp = (value: number) => Math.max(0, Math.min(1, value));

/** Periodic noise keeps both the albedo and its normal derivative seamless. */
function mottling(x: number, y: number, cells: number, size: number, seed: number): number {
  const gx = x / size * cells, gy = y / size * cells;
  const ix = Math.floor(gx), iy = Math.floor(gy), tx = smooth(gx - ix), ty = smooth(gy - iy);
  const a = noise(ix % cells, iy % cells, seed), b = noise((ix + 1) % cells, iy % cells, seed);
  const c = noise(ix % cells, (iy + 1) % cells, seed), d = noise((ix + 1) % cells, (iy + 1) % cells, seed);
  return (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
}

/** Runtime environment materials only; no character generation or asset processing. */
export class LiveSurfaceLibrary {
  private scene: Scene;
  private materials = new Map<string, StandardMaterial>();
  private maps = new Map<LiveSurface, { color: DynamicTexture; normal: DynamicTexture }>();
  private waterNormal?: DynamicTexture;

  constructor(scene: Scene) { this.scene = scene; }

  material(kind: LiveSurface, hex: string): StandardMaterial {
    const key = `${kind}:${hex}`, existing = this.materials.get(key);
    if (existing) return existing;
    let maps = this.maps.get(kind);
    if (!maps) { maps = this.createSurface(kind); this.maps.set(kind, maps); }
    const material = new StandardMaterial(`surface-${key}`, this.scene);
    material.diffuseColor = Color3.FromHexString(hex);
    material.diffuseTexture = maps.color;
    material.bumpTexture = maps.normal;
    material.specularColor = kind === 'metal' ? new Color3(.22, .24, .24) : new Color3(.035, .035, .03);
    material.specularPower = kind === 'metal' ? 42 : 18;
    if (kind === 'paving') material.zOffset = -0.6;
    this.materials.set(key, material);
    return material;
  }

  private createSurface(kind: LiveSurface): { color: DynamicTexture; normal: DynamicTexture } {
    const size = 512, heights = new Float32Array(size * size);
    const color = new DynamicTexture(`${kind}-albedo`, size, this.scene, true, Texture.TRILINEAR_SAMPLINGMODE);
    const normal = new DynamicTexture(`${kind}-normal`, size, this.scene, true, Texture.TRILINEAR_SAMPLINGMODE);
    const ctx = color.getContext() as unknown as CanvasRenderingContext2D, pixels = ctx.createImageData(size, size);
    const seeds: Record<LiveSurface, number> = { plaster: 17, stone: 31, paving: 53, timber: 79, metal: 97, clay: 113 };
    const seed = seeds[kind];
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const grain = noise(x, y, seed) - .5;
      const patch = mottling(x, y, 8, size, seed);
      let shade = .88 + patch * .12 + grain * .07, height = .48 + patch * .06 + grain * .025;
      if (kind === 'stone' || kind === 'paving' || kind === 'clay') {
        const cellW = kind === 'stone' ? 128 : 64, cellH = kind === 'clay' ? 32 : 64;
        const row = Math.floor(y / cellH), shiftedX = (x + row % 2 * cellW / 2) % size;
        const sx = shiftedX % cellW, sy = y % cellH;
        const edge = Math.min(sx, cellW - 1 - sx, sy, cellH - 1 - sy);
        const bevel = smooth(clamp((edge - 1) / 3));
        const block = noise(Math.floor(shiftedX / cellW), row, seed);
        shade = .67 + bevel * (.17 + block * .15) + grain * .045 + patch * .035;
        height = .12 + bevel * (.38 + block * .04) + grain * .018;
      } else if (kind === 'timber') {
        const fibre = Math.sin(x * Math.PI / 8 + Math.sin(y * Math.PI / 128) * .8 + patch * 2);
        const seam = x % 64 < 2 ? .58 : 1;
        shade = (.84 + fibre * .075 + patch * .1 + grain * .035) * seam;
        height = (.5 + fibre * .035 + grain * .015) * seam;
      } else if (kind === 'metal') {
        const rib = Math.cos(x * Math.PI / 32);
        shade = .9 + rib * .045 + grain * .035 - Math.max(0, patch - .64) * .3;
        height = .5 + rib * .12 + grain * .008;
      }
      const index = y * size + x, at = index * 4, value = Math.round(clamp(shade) * 255);
      pixels.data[at] = value; pixels.data[at + 1] = value; pixels.data[at + 2] = value; pixels.data[at + 3] = 255;
      heights[index] = height;
    }
    ctx.putImageData(pixels, 0, 0); color.update(false);
    const normalCtx = normal.getContext() as unknown as CanvasRenderingContext2D, normals = normalCtx.createImageData(size, size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const dx = (heights[y * size + (x + size - 1) % size] - heights[y * size + (x + 1) % size]) * 2;
      const dy = (heights[((y + size - 1) % size) * size + x] - heights[((y + 1) % size) * size + x]) * 2;
      const length = Math.hypot(dx, dy, 1), at = (y * size + x) * 4;
      normals.data[at] = Math.round((dx / length * .5 + .5) * 255);
      normals.data[at + 1] = Math.round((dy / length * .5 + .5) * 255);
      normals.data[at + 2] = Math.round((1 / length * .5 + .5) * 255); normals.data[at + 3] = 255;
    }
    normalCtx.putImageData(normals, 0, 0); normal.update(false);
    color.wrapU = color.wrapV = normal.wrapU = normal.wrapV = Texture.WRAP_ADDRESSMODE;
    normal.gammaSpace = false; normal.level = .55;
    color.anisotropicFilteringLevel = 8; normal.anisotropicFilteringLevel = 4;
    return { color, normal };
  }

  water(hex: string): StandardMaterial {
    const key = `water:${hex}`, existing = this.materials.get(key);
    if (existing) return existing;
    if (!this.waterNormal) {
      const texture = new DynamicTexture('water-ripple-normal', 256, this.scene, true);
      const ctx = texture.getContext() as unknown as CanvasRenderingContext2D, pixels = ctx.createImageData(256, 256);
      for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
        const phase = Math.PI * 2 / 256, dx = Math.sin((x * 4 + y * 2) * phase) * .14;
        const dy = Math.cos((y * 6 - x * 2) * phase) * .11, at = (y * 256 + x) * 4;
        pixels.data[at] = Math.round((.5 + dx) * 255); pixels.data[at + 1] = Math.round((.5 + dy) * 255);
        pixels.data[at + 2] = 250; pixels.data[at + 3] = 255;
      }
      ctx.putImageData(pixels, 0, 0); texture.update(false); texture.gammaSpace = false;
      texture.wrapU = texture.wrapV = Texture.WRAP_ADDRESSMODE;
      texture.level = .4; texture.uScale = texture.vScale = 4; this.waterNormal = texture;
    }
    const material = new StandardMaterial(key, this.scene);
    material.diffuseColor = Color3.FromHexString(hex); material.bumpTexture = this.waterNormal;
    material.specularColor = new Color3(.62, .72, .72); material.specularPower = 96;
    this.materials.set(key, material);
    return material;
  }

  update(time: number): void {
    if (this.waterNormal) { this.waterNormal.uOffset = time * .012 % 1; this.waterNormal.vOffset = time * .008 % 1; }
  }
}

export function buildLiveSky(scene: Scene): void {
  const texture = new DynamicTexture('harbor-atmosphere', { width: 1024, height: 512 }, scene, true);
  const ctx = texture.getContext() as unknown as CanvasRenderingContext2D;
  const gradient = ctx.createLinearGradient(0, 0, 0, 512);
  gradient.addColorStop(0, '#3982b4'); gradient.addColorStop(.3, '#75b5d7');
  gradient.addColorStop(.5, '#d3dcd5'); gradient.addColorStop(.65, '#b2c5c7'); gradient.addColorStop(1, '#91afb7');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 1024, 512);
  // Broad, quiet clouds stay above the playable skyline and away from the UV seam.
  for (let i = 0; i < 20; i++) {
    const x = 160 + noise(i, 1, 41) * 704, y = 105 + noise(i, 2, 41) * 90;
    const radius = 28 + noise(i, 3, 41) * 45;
    ctx.save(); ctx.translate(x, y); ctx.scale(2.1, .35);
    const cloud = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
    cloud.addColorStop(0, 'rgba(255,250,232,0.23)'); cloud.addColorStop(1, 'rgba(255,250,232,0)');
    ctx.fillStyle = cloud; ctx.fillRect(-radius, -radius, radius * 2, radius * 2); ctx.restore();
  }
  texture.update(false);
  const material = new StandardMaterial('harbor-atmosphere-material', scene);
  // StandardMaterial adds emissiveColor to emissiveTexture; white clips the entire sky.
  material.emissiveTexture = texture; material.emissiveColor = Color3.Black();
  material.diffuseColor = Color3.Black(); material.specularColor = Color3.Black();
  material.disableLighting = true; material.fogEnabled = false; material.disableDepthWrite = true;
  const sky = MeshBuilder.CreateSphere('harbor-atmosphere-dome', { diameter: 400, segments: 24, sideOrientation: Mesh.BACKSIDE }, scene);
  sky.material = material; sky.isPickable = false; sky.infiniteDistance = true; sky.applyFog = false;
}
