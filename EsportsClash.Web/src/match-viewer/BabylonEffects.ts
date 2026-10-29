import { MeshBuilder, Vector3, Color3, StandardMaterial, type Scene, type LinesMesh, type Mesh } from '@babylonjs/core';
import { arenaGroundHeight } from '../arenaElevation';
import type { ViewerSnapshot, ViewerConstruct } from './MatchViewer';
import { AbilityWorldEffects } from './AbilityWorldEffects';

const color = (value: string) => (/^#[a-f0-9]{6}$/i.test(value) ? Color3.FromHexString(value) : new Color3(1, 0.8, 0.4));

export class BabylonEffects {
  private lineMeshes = new Map<string, { mesh: LinesMesh; count: number }>();
  private volumetricMeshes = new Map<string, Mesh>();
  private materials = new Map<string, StandardMaterial>();
  private world: AbilityWorldEffects;

  constructor(private scene: Scene) {
    this.world = new AbilityWorldEffects(scene);
  }

  private getMaterial(tint: string): StandardMaterial {
    let mat = this.materials.get(tint);
    if (!mat) {
      mat = new StandardMaterial(`effect-mat:${tint}`, this.scene);
      mat.disableLighting = true;
      mat.emissiveColor = color(tint);
      mat.diffuseColor = Color3.Black();
      mat.specularColor = Color3.Black();
      mat.disableDepthWrite = true;
      this.materials.set(tint, mat);
    }
    return mat;
  }

  private line(id: string, points: readonly { x: number; y: number }[], tint: string, height = 3) {
    if (points.length < 2 || points.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y))) return;
    const positions = points.map(p => new Vector3(p.x, arenaGroundHeight(p.x, p.y) + height, p.y));
    let entry = this.lineMeshes.get(id);
    if (entry && entry.count !== points.length) {
      entry.mesh.dispose();
      this.lineMeshes.delete(id);
      entry = undefined;
    }
    if (!entry) {
      entry = { mesh: MeshBuilder.CreateLines(id, { points: positions, updatable: true }, this.scene), count: points.length };
      this.lineMeshes.set(id, entry);
    } else {
      MeshBuilder.CreateLines(id, { points: positions, instance: entry.mesh }, this.scene);
    }
    entry.mesh.color = color(tint);
    entry.mesh.setEnabled(true);
  }

  private circle(id: string, x: number, y: number, r: number, tint: string, height = 3) {
    this.line(
      id,
      Array.from({ length: 49 }, (_, i) => ({
        x: x + Math.cos((i * Math.PI) / 24) * r,
        y: y + Math.sin((i * Math.PI) / 24) * r,
      })),
      tint,
      height,
    );
  }

  private projectile(id: string, x: number, y: number, radius: number, angle: number, tint: string) {
    const gh = arenaGroundHeight(x, y) + 20;
    let sphere = this.volumetricMeshes.get(id + ':head');
    const size = Math.max(5.5, radius * 2.2);
    if (!sphere) {
      sphere = MeshBuilder.CreateSphere(id + ':head', { diameter: size, segments: 8 }, this.scene);
      sphere.isPickable = false;
      sphere.material = this.getMaterial(tint);
      this.volumetricMeshes.set(id + ':head', sphere);
    }
    sphere.position.set(x, gh, y);
    sphere.setEnabled(true);

    // Trailing comet tracer
    const tailX = x - Math.cos(angle) * (radius * 4.5);
    const tailY = y - Math.sin(angle) * (radius * 4.5);
    this.line(id + ':tracer', [{ x: tailX, y: tailY }, { x, y }], tint, 20);
  }

  private beam(id: string, sx: number, sy: number, ex: number, ey: number, tint: string) {
    const sgh = arenaGroundHeight(sx, sy) + 68;
    const egh = arenaGroundHeight(ex, ey) + 20;
    const path = [new Vector3(sx, sgh, sy), new Vector3(ex, egh, ey)];
    let tube = this.volumetricMeshes.get(id);
    if (!tube) {
      tube = MeshBuilder.CreateTube(id, { path, radius: 3.2, tessellation: 8, updatable: true }, this.scene);
      tube.isPickable = false;
      tube.material = this.getMaterial(tint);
      this.volumetricMeshes.set(id, tube);
    } else {
      MeshBuilder.CreateTube('', { path, radius: 3.2, instance: tube }, this.scene);
    }
    tube.setEnabled(true);
  }

  private shockwave(id: string, x: number, y: number, radius: number, tint: string, age = 0) {
    const gh = arenaGroundHeight(x, y) + 3;
    let ring = this.volumetricMeshes.get(id);
    const diameter = Math.max(8, radius * 2);
    if (!ring) {
      ring = MeshBuilder.CreateTorus(id, { diameter, thickness: 2.2, tessellation: 24 }, this.scene);
      ring.isPickable = false;
      ring.material = this.getMaterial(tint);
      this.volumetricMeshes.set(id, ring);
    }
    ring.position.set(x, gh, y);
    ring.scaling.setAll(1 + age * 1.8);
    ring.visibility = Math.max(0, 1 - age);
    ring.setEnabled(true);
  }

  update(snapshot: ViewerSnapshot) {
    this.world.update(snapshot);

    for (const entry of this.lineMeshes.values()) entry.mesh.setEnabled(false);
    for (const mesh of this.volumetricMeshes.values()) mesh.setEnabled(false);

    for (const e of snapshot.effects) {
      const id = `effect:${e.kind}:${e.id}`;
      if (e.kind === 'projectile') {
        const angle = e.angle ?? 0;
        this.projectile(id, e.x, e.y, e.radius, angle, e.color);
      } else if (e.kind !== 'impact' && e.sourceX !== undefined && e.sourceY !== undefined) {
        this.beam(id, e.sourceX, e.sourceY, e.x, e.y, e.color);
      } else if (e.kind === 'impact') {
        this.shockwave(id, e.x, e.y, Math.max(8, e.radius), e.color, e.age ?? 0);
      } else if (e.halfWidth !== undefined && e.halfHeight !== undefined) {
        this.line(
          id,
          [
            { x: e.x - e.halfWidth, y: e.y - e.halfHeight },
            { x: e.x + e.halfWidth, y: e.y - e.halfHeight },
            { x: e.x + e.halfWidth, y: e.y + e.halfHeight },
            { x: e.x - e.halfWidth, y: e.y + e.halfHeight },
            { x: e.x - e.halfWidth, y: e.y - e.halfHeight },
          ],
          e.color,
        );
      } else {
        this.circle(id, e.x, e.y, Math.max(2, e.radius), e.color, 3);
      }
    }

    for (const c of snapshot.constructs ?? []) this.construct(c, snapshot.tick);

    for (const a of snapshot.actors) {
      if (!a.alive) continue;
      if (a.kind === 'champion') {
        const dir = a.facing < 0 ? -1 : 1;
        this.line(`facing:${a.id}`, [{ x: a.x + dir * 20, y: a.y - 5 }, { x: a.x + dir * 27, y: a.y }, { x: a.x + dir * 20, y: a.y + 5 }], a.team === 'blue' ? '#77ddf0' : '#ffaf87', 3);
      }
      if ((a.shield ?? 0) > 0) this.circle(`shield:${a.id}`, a.x, a.y, 23, '#a1e9e9', 12);
      if (a.recalling) this.circle(`recall:${a.id}`, a.x, a.y, 27, '#9ac6ff', 2);
      if (a.controlled) this.circle(`control:${a.id}`, a.x, a.y, 9, '#ffdc8a', 80);
    }

    for (const [id, entry] of this.lineMeshes) {
      if (!entry.mesh.isEnabled()) {
        entry.mesh.dispose();
        this.lineMeshes.delete(id);
      }
    }
    for (const [id, mesh] of this.volumetricMeshes) {
      if (!mesh.isEnabled()) {
        mesh.dispose();
        this.volumetricMeshes.delete(id);
      }
    }
  }

  private construct(c: ViewerConstruct, tick: number) {
    const tint = c.disabledUntil > tick ? '#73818a' : c.arm !== undefined && c.arm > tick ? '#ffdd72' : c.team === 'blue' ? '#77ddf0' : '#ffaf87';
    const id = `construct:${c.id}`;
    if (c.points.length > 1) {
      const points = [...c.points];
      if (points.length === 3) points.push(points[0]);
      this.line(id, points, tint);
    }
    if (c.kind === 'stage-cell' || c.kind === 'airspace-cell') {
      const r = c.radius;
      this.line(
        id + ':cell',
        [
          { x: c.x - r, y: c.y - r },
          { x: c.x + r, y: c.y - r },
          { x: c.x + r, y: c.y + r },
          { x: c.x - r, y: c.y + r },
          { x: c.x - r, y: c.y - r },
        ],
        tint,
      );
      if (c.safeY !== undefined) {
        for (const side of [-1, 1]) {
          this.line(id + ':safe:' + side, [{ x: c.x - r, y: c.safeY + side * 20 }, { x: c.x + r, y: c.safeY + side * 20 }], '#8affc8');
        }
      }
    } else if (c.radius > 0) {
      this.circle(id + ':radius', c.x, c.y, c.radius, tint);
    }
    if (c.attackable) this.circle(id + ':device', c.x, c.y, 6, tint, 12);
    const end = { x: c.x + Math.cos(c.angle) * 20, y: c.y + Math.sin(c.angle) * 20 };
    this.line(id + ':direction', [{ x: c.x, y: c.y }, end, { x: end.x + Math.cos(c.angle + 2.5) * 8, y: end.y + Math.sin(c.angle + 2.5) * 8 }], tint, 5);
  }

  diagnostics() {
    return { ...this.world.diagnostics(), volumetricMeshes: this.volumetricMeshes.size, visible: this.volumetricMeshes.size };
  }

  dispose() {
    this.world.dispose();
    for (const e of this.lineMeshes.values()) e.mesh.dispose();
    for (const m of this.volumetricMeshes.values()) m.dispose();
    for (const mat of this.materials.values()) mat.dispose();
    this.lineMeshes.clear();
    this.volumetricMeshes.clear();
    this.materials.clear();
  }
}
