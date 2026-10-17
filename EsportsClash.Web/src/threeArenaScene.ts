import * as THREE from 'three';
import type { AramChampionUnit, LaneMinion, LaneStructure } from './types.ts';
import { ARAM_BUSHES, ROCK_TERRAIN } from './arenaRules.ts';
import { WELL_X } from './arenaLayout.ts';
import { AvatarModelResources, buildAvatarModel, type AvatarModel } from './threeAvatarModels.ts';
import { AvatarAssetLibrary } from './avatarModelAssets.ts';
import { ArenaAbilityEffects, type AbilityProjectile, type AbilitySpell } from './threeAbilityEffects.ts';
import {motionTimeline,type MotionTimeline} from './avatarMotionTimeline.ts';
import {avatarDesign} from './avatarDesigns.ts';
import {combatDuration} from './avatarCombatMotion.ts';

// Presentation inputs are borrowed for this frame only. Never write through them,
// retain simulation objects in meshes, or use gameplay RNG to construct artwork.
type Point = { readonly x: number; readonly y: number };
type Neutral = Point & { readonly id: string; readonly isAlive: boolean; readonly hp: number;
  readonly maxHp: number; readonly type?: string; readonly name: string };
export type ArenaSceneFrame = {
  readonly champions: readonly AramChampionUnit[];
  readonly minions: readonly LaneMinion[];
  readonly structures: readonly LaneStructure[];
  readonly camps: readonly Neutral[];
  readonly dragon: Neutral;
  readonly projectiles: readonly AbilityProjectile[];
  readonly spells: readonly AbilitySpell[];
  readonly wards: readonly (Point & { readonly id: string; readonly team: 'blue' | 'red' })[];
  readonly second: number;
};

export const ARENA_CAMERA_ELEVATION = Math.PI / 3;

function sceneFrustum(zoom: number, aspect: number, worldWidth: number) {
  const safeAspect = Math.max(.1, aspect);
  // Portrait screens keep the same vertical viewing distance and crop horizontally,
  // rather than shrinking a 2600-unit arena into the phone's width.
  const halfH = worldWidth / (2 * zoom * Math.max(16 / 9, safeAspect));
  return { halfW: halfH * safeAspect, halfH };
}

export function clampArenaSceneCamera(x: number, y: number, zoom: number, aspect: number,
  worldWidth: number, worldHeight: number) {
  const frustum = sceneFrustum(zoom, aspect, worldWidth);
  const halfW = frustum.halfW;
  const halfH = frustum.halfH / Math.sin(ARENA_CAMERA_ELEVATION);
  const clamp = (value: number, half: number, extent: number) =>
    half * 2 >= extent ? extent / 2 : Math.max(half, Math.min(extent - half, value));
  return { x: clamp(x, halfW, worldWidth), y: clamp(y, halfH, worldHeight), halfW, halfH };
}

export function applyArenaSceneCamera(camera: THREE.OrthographicCamera, x: number, y: number,
  zoom: number, aspect: number, worldWidth: number): void {
  const { halfW, halfH } = sceneFrustum(zoom, aspect, worldWidth);
  Object.assign(camera, { left: -halfW, right: halfW, top: halfH, bottom: -halfH, near: 1, far: 7000 });
  camera.position.set(x, Math.sin(ARENA_CAMERA_ELEVATION) * 3000, y + Math.cos(ARENA_CAMERA_ELEVATION) * 3000);
  camera.up.set(0, 1, 0);
  camera.lookAt(x, 0, y);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
}

// Orthographic ground-plane pan, in world units per normalized device coordinate.
export function arenaScenePan(dx: number, dy: number, zoom: number, aspect: number, worldWidth: number) {
  const { halfW, halfH } = sceneFrustum(zoom, aspect, worldWidth);
  return { x: dx * halfW, y: dy * halfH / Math.sin(ARENA_CAMERA_ELEVATION) };
}

const TEAM = { blue: '#38c9ed', red: '#f16b84' };

type Actor = { group: THREE.Group; body: THREE.Group; left?: THREE.Group; right?: THREE.Group;
  recall?: THREE.Mesh; crystal?: THREE.Mesh; avatar?: AvatarModel; height: number; key: string; motion?:MotionTimeline };

/** One read-only scene, updated by the live arena's existing animation frame. */
export class ArenaScene {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.OrthographicCamera();
  private readonly actors = new Map<string, Actor>();
  private readonly effectPool: THREE.Mesh[] = [];
  private readonly materials = new Map<string, THREE.MeshStandardMaterial>();
  private readonly shapes = {
    box: new THREE.BoxGeometry(1, 1, 1), sphere: new THREE.SphereGeometry(1, 12, 8),
    crystal: new THREE.OctahedronGeometry(1), rock: new THREE.DodecahedronGeometry(1, 0),
    cylinder: new THREE.CylinderGeometry(1, 1, 1, 12), cone: new THREE.ConeGeometry(1, 1, 8),
    ring: new THREE.RingGeometry(0.88, 1, 40), disc: new THREE.CircleGeometry(1, 24),
  };
  private readonly effectMaterial: THREE.MeshBasicMaterial;
  private readonly shadowMaterial = new THREE.MeshBasicMaterial({ color: '#071314', transparent: true, opacity: 0.32, depthWrite: false });
  private readonly poolOwner = new THREE.Group();
  private readonly avatarResources = new AvatarModelResources();
  private readonly avatarAssets = new AvatarAssetLibrary(this.avatarResources);
  private readonly abilityEffects = new ArenaAbilityEffects();
  private readonly projection = new THREE.Vector3();
  private effectsUsed = 0;

  constructor(ground: THREE.Mesh, worldWidth: number, worldHeight: number) {
    this.scene.background = new THREE.Color('#0c1b21');
    this.scene.add(new THREE.HemisphereLight('#e1f7ed', '#243344', 2.1));
    const sun = new THREE.DirectionalLight('#ffecd2', 2.6);
    sun.position.set(-600, 1700, 800); this.scene.add(sun);
    const rim = new THREE.DirectionalLight('#76b9df', 1.1);
    rim.position.set(800, 500, -700); this.scene.add(rim);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(worldWidth / 2, -0.8, worldHeight / 2);
    ground.material = (ground.material as THREE.ShaderMaterial).clone();
    (ground.material as THREE.ShaderMaterial).depthTest = true;
    (ground.material as THREE.ShaderMaterial).depthWrite = true;
    this.scene.add(ground);
    this.mesh(this.scene, 'box', '#172b29', [worldWidth + 20, 18, worldHeight + 20], [worldWidth / 2, -11, worldHeight / 2]);
    // Actual collision contours, including open camp entrances, are shared with simulation.
    ROCK_TERRAIN.forEach((rock, i) => {
      const mesh = this.mesh(this.scene, 'rock', i % 3 === 0 ? '#71817c' : '#4d6460',
        [rock.radius, rock.radius * 1.25, rock.radius], [rock.x, rock.radius * .65, rock.y]);
      mesh.rotation.y = i * 2.4;
    });
    ARAM_BUSHES.forEach(bush => {
      for (let i = 0; i < 17; i++) {
        const angle = i * 2.4, radius = Math.sqrt(i / 17) * .8;
        const x = bush.x + Math.cos(angle) * bush.width * .5 * radius;
        const z = bush.y + Math.sin(angle) * bush.height * .5 * radius;
        this.mesh(this.scene, 'cone', i % 2 ? '#416947' : '#638451', [6, 16 + i % 4 * 3, 6], [x, 9, z]);
      }
    });
    // Trees stay outside the playable ground. They never imply a new collision wall.
    for (let i = 0; i < 66; i++) {
      const x = 35 + (i % 33) * (worldWidth - 70) / 32;
      const z = i < 33 ? -25 - (i % 3) * 12 : worldHeight + 28 + (i % 3) * 12;
      const height = 42 + i % 5 * 8;
      this.mesh(this.scene, 'cylinder', '#4b4236', [5, height, 5], [x, height / 2, z]);
      this.mesh(this.scene, 'cone', i % 2 ? '#224e40' : '#315b47', [29, height, 29], [x, height, z]);
      this.mesh(this.scene, 'cone', '#426d50', [21, height * .8, 21], [x, height * 1.35, z]);
    }
    for (const team of ['blue', 'red'] as const) {
      const x = WELL_X[team];
      this.mesh(this.scene, 'cylinder', '#536370', [48, 9, 48], [x, 4, 380]);
      this.flat(this.scene, 'ring', TEAM[team], 43, x, 380, 9);
      for (let i = 0; i < 5; i++) this.mesh(this.scene, 'crystal', TEAM[team], [5, 17, 5],
        [x + Math.cos(i * Math.PI * .4) * 35, 20, 380 + Math.sin(i * Math.PI * .4) * 35], true);
    }
    // Invisible resource owner keeps cached shared geometry/materials reachable for disposal,
    // even after the last actor/effect using them has left the scene.
    this.effectMaterial = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .55,
      depthWrite: false, side: THREE.DoubleSide });
    this.poolOwner.visible = false;
    Object.values(this.shapes).forEach(shape => this.poolOwner.add(new THREE.Mesh(shape, this.shadowMaterial)));
    this.poolOwner.add(new THREE.Mesh(this.shapes.disc, this.effectMaterial));
    this.scene.add(this.poolOwner);
    this.scene.add(this.avatarResources.owner);
    this.scene.add(this.avatarAssets.owner);
    this.scene.add(this.abilityEffects.root);
    this.batchStaticProps();
  }

  private batchStaticProps(): void {
    const batches = new Map<THREE.BufferGeometry, Map<THREE.Material, THREE.Mesh[]>>();
    for (const object of this.scene.children) {
      if (!(object instanceof THREE.Mesh) || Array.isArray(object.material)) continue;
      let byMaterial = batches.get(object.geometry);
      if (!byMaterial) { byMaterial = new Map(); batches.set(object.geometry, byMaterial); }
      const batch = byMaterial.get(object.material) ?? [];
      batch.push(object); byMaterial.set(object.material, batch);
    }
    for (const [geometry, byMaterial] of batches) for (const [material, meshes] of byMaterial) {
      if (meshes.length < 2) continue;
      const instances = new THREE.InstancedMesh(geometry, material, meshes.length);
      meshes.forEach((mesh, index) => { mesh.updateMatrix(); instances.setMatrixAt(index, mesh.matrix); this.scene.remove(mesh); });
      instances.instanceMatrix.needsUpdate = true;
      instances.computeBoundingSphere();
      this.scene.add(instances);
    }
  }

  private material(color: string, glow = false) {
    const key = color + glow;
    let material = this.materials.get(key);
    if (!material) {
      material = new THREE.MeshStandardMaterial({ color, roughness: .68, metalness: .18, flatShading: true,
        emissive: glow ? color : '#000000', emissiveIntensity: glow ? .65 : 0 });
      this.materials.set(key, material);
      this.poolOwner.add(new THREE.Mesh(this.shapes.box, material));
    }
    return material;
  }

  private mesh(parent: THREE.Object3D, shape: keyof ArenaScene['shapes'], color: string,
    scale: [number, number, number], position: [number, number, number], glow = false) {
    const mesh = new THREE.Mesh(this.shapes[shape], this.material(color, glow));
    mesh.scale.set(...scale); mesh.position.set(...position); parent.add(mesh); return mesh;
  }

  private flat(parent: THREE.Object3D, shape: 'ring' | 'disc', color: string, radius: number, x = 0, z = 0, y = .5) {
    const mesh = this.mesh(parent, shape, color, [radius, radius, radius], [x, y, z], true);
    mesh.rotation.x = -Math.PI / 2; return mesh;
  }

  private actor(id: string, key: string, build: () => Actor): Actor {
    let actor = this.actors.get(id);
    if (actor?.key !== key) {
      if (actor) { actor.avatar?.dispose(); this.scene.remove(actor.group); }
      actor = build(); actor.key = key; this.actors.set(id, actor); this.scene.add(actor.group);
    }
    actor.group.visible = true;
    return actor;
  }

  private champion(unit: AramChampionUnit): Actor {
    const group = new THREE.Group();
    const avatar = this.avatarAssets.instantiate(unit.champion.id) ?? buildAvatarModel(unit.champion, this.avatarResources);
    this.avatarAssets.request(unit.champion.id);
    group.add(avatar.body);
    const shadow = new THREE.Mesh(this.shapes.disc, this.shadowMaterial);
    shadow.rotation.x = -Math.PI / 2; shadow.scale.set(24, 16, 1); shadow.position.y = .1; group.add(shadow);
    this.flat(group, 'ring', TEAM[unit.team], 22);
    const recall = this.flat(group, 'ring', '#a5f3fc', 31, 0, 0, 1); recall.visible = false;
    return { group, body: avatar.body, avatar, recall, height: avatar.height, key: '' };
  }

  private structure(st: LaneStructure): Actor {
    const group = new THREE.Group(), body = new THREE.Group(); group.add(body);
    const color = TEAM[st.team];
    const nexus = st.type === 'nexus', barracks = st.type === 'barracks';
    const r = nexus ? 43 : barracks ? 22 : 25;
    this.mesh(body, 'cylinder', '#4d606b', [r + 8, 10, r + 8], [0, 5, 0]);
    this.mesh(body, 'cylinder', '#91a39f', [r, barracks ? 14 : 22, r], [0, barracks ? 15 : 21, 0]);
    this.flat(body, 'ring', color, r - 2, 0, 0, barracks ? 23 : 34);
    let crystal: THREE.Mesh;
    if (nexus) {
      for (let i = 0; i < 4; i++) this.mesh(body, 'box', '#b0aca0', [12, 48, 12], [Math.cos(i * Math.PI / 2) * 35, 34, Math.sin(i * Math.PI / 2) * 35]);
      crystal = this.mesh(body, 'crystal', color, [23, 42, 23], [0, 57, 0], true);
    } else if (barracks) {
      this.mesh(body, 'box', '#657c84', [37, 22, 32], [0, 22, 0]);
      crystal = this.mesh(body, 'crystal', color, [11, 17, 11], [0, 48, 0], true);
    } else {
      this.mesh(body, 'cylinder', '#788c91', [15, 53, 15], [0, 53, 0]);
      for (let i = 0; i < 4; i++) this.mesh(body, 'box', '#c4ba9d', [9, 28, 9], [Math.cos(i * Math.PI / 2) * 20, 73, Math.sin(i * Math.PI / 2) * 20]);
      crystal = this.mesh(body, 'crystal', color, [12, 22, 12], [0, 91, 0], true);
    }
    return { group, body, crystal, height: nexus ? 110 : barracks ? 75 : 125, key: '' };
  }

  private creature(color: string, size: number, kind: string, team?: 'blue' | 'red'): Actor {
    const group = new THREE.Group(), body = new THREE.Group(); group.add(body);
    const ranged = kind === 'caster', cannon = kind === 'cannon';
    const monster = !team || kind === 'bear' || kind === 'siege';
    this.flat(group, 'ring', team ? TEAM[team] : '#cfb87b', size * 1.2);
    this.mesh(body, monster ? 'rock' : ranged ? 'cone' : 'box', color,
      [size, size * 1.2, size * .8], [0, size * 1.2, 0]);
    this.mesh(body, 'sphere', monster ? color : '#bdb4a3', [size * .6, size * .6, size * .6], [0, size * 2.6, size * .15]);
    for (const side of [-1, 1]) {
      this.mesh(body, 'box', '#425359', [size * .4, size, size * .5], [side * size * .6, size * .5, 0]);
      if (monster) this.mesh(body, 'cone', '#d0b98d', [size * .22, size, size * .22], [side * size * .5, size * 3, 0]);
    }
    if (ranged || cannon) this.mesh(body, 'cylinder', '#e1b56a', [size * .22, size * 2, size * .22], [size * .5, size * 1.7, size], true).rotation.x = Math.PI / 2;
    if (kind === 'dragon_boss' || kind === 'drakes') for (const side of [-1, 1]) {
      const wing = this.mesh(body, 'cone', '#b77257', [size * 1.6, size * 1.3, size * .2], [side * size * 1.4, size * 2, 0]);
      wing.rotation.z = side * .8;
    }
    return { group, body, height: size * 4, key: '' };
  }

  private effect(shape: 'sphere' | 'ring' | 'disc' | 'box', color: string, opacity: number,
    x: number, y: number, height: number, sx: number, sy = sx, sz = sx) {
    let mesh = this.effectPool[this.effectsUsed++];
    if (!mesh) {
      mesh = new THREE.Mesh(this.shapes[shape], this.effectMaterial.clone());
      this.effectPool.push(mesh); this.scene.add(mesh);
    }
    mesh.geometry = this.shapes[shape];
    const material = mesh.material as THREE.MeshBasicMaterial;
    material.color.set(color); material.opacity = opacity;
    mesh.visible = true; mesh.position.set(x, height, y); mesh.scale.set(sx, sy, sz);
    mesh.rotation.set(shape === 'ring' || shape === 'disc' ? -Math.PI / 2 : 0, 0, 0);
    return mesh;
  }

  update(frame: ArenaSceneFrame): void {
    const present = new Set<string>(); this.effectsUsed = 0;
    for (const unit of frame.champions) {
      if (!unit.isAlive) {
        const corpse=this.actors.get(unit.id);
        if(corpse?.avatar&&corpse.motion&&frame.second>=corpse.motion.second){
          corpse.motion=motionTimeline(corpse.motion,unit,frame.second,corpse.motion.yaw);
          if(frame.second-corpse.motion.death<1.25){
            present.add(unit.id);corpse.group.children.forEach(child=>{if(child!==corpse.body)child.visible=false;});
            corpse.avatar.animate({motionState:'death',motionTime:frame.second-corpse.motion.death},frame.second);
          }
        }
        continue;
      }
      present.add(unit.id);
      const actor = this.actor(unit.id, unit.champion.id + unit.team + this.avatarAssets.has(unit.champion.id), () => this.champion(unit));
      actor.group.children.forEach(child=>{child.visible=true;});
      actor.group.position.set(unit.x, (unit.knockupTimer ?? 0) > 0 ? 24 : 0, unit.y);
      const moving=unit.animState==='walk'&&Math.hypot(unit.vx,unit.vy)>1;
      const strafing=moving&&Math.abs(unit.vy)>Math.abs(unit.vx)*1.5;
      const targetYaw=moving&&!strafing?Math.atan2(unit.vx,unit.vy):unit.facing==='right'?Math.PI/2:-Math.PI/2;
      actor.motion=motionTimeline(actor.motion,unit,frame.second,targetYaw,(avatarDesign(unit.champion.id)?.height??76)/76);
      actor.body.rotation.y=actor.motion.yaw;
      const elapsed=frame.second-actor.motion.started,transition=frame.second-actor.motion.changed;
      actor.avatar?.animate({...unit,motionState:actor.motion.state,motionTime:elapsed+(actor.motion.state==='attack'?combatDuration(unit.champion.id,'attack')*.42:0),
        previousMotion:actor.motion.from,previousMotionTime:actor.motion.fromTime+transition,motionBlend:Math.min(1,transition/.16),
        recoil:Math.max(0,1-(frame.second-actor.motion.hit)/.32),gaitPhase:actor.motion.gaitPhase,
        plantFeet:moving&&!((unit.knockupTimer??0)>0)&&!unit.dash,moveX:unit.vx,moveZ:unit.vy},frame.second);
      if (unit.shield > 0 || unit.zhonyaActive) this.effect('ring', unit.zhonyaActive ? '#facc15' : unit.champion.accentColor, .8, unit.x, unit.y, 3, 28);
      if (actor.recall) { actor.recall.visible = !!unit.isRecalling; actor.recall.rotation.z = frame.second; }
      if (unit.stunTimer > 0 || unit.charmTimer > 0) this.effect('sphere', '#ffe9a3', .95, unit.x, unit.y, actor.height + 3, 4);
    }
    for (const st of frame.structures) {
      present.add(st.id);
      const actor = this.actor(st.id, st.type + st.team, () => this.structure(st));
      actor.group.position.set(st.x, 0, st.y);
      actor.body.scale.y = st.isAlive ? 1 : .12;
      if (actor.crystal) { actor.crystal.visible = st.isAlive; actor.crystal.rotation.y = frame.second * .6; }
    }
    for (const minion of frame.minions) {
      if (!minion.isAlive) continue;
      present.add(minion.id);
      const kind = minion.summonedBearOwnerId ? 'bear' : minion.prismWardenOwnerId ? 'prism' : minion.siegeGolem ? 'siege' : minion.type;
      const size = kind === 'siege' ? 27 : kind === 'bear' ? 22 : kind === 'cannon' ? 14 : 10;
      const actor = this.actor(minion.id, kind + minion.team, () => this.creature(TEAM[minion.team], size, kind, minion.team));
      actor.group.position.set(minion.x, 0, minion.y);
      actor.body.rotation.y = (minion.facingX ?? (minion.team === 'blue' ? 1 : -1)) > 0 ? Math.PI / 2 : -Math.PI / 2;
      actor.body.rotation.x = Math.sin(minion.attackTimer * 8) * .08;
    }
    for (const camp of [...frame.camps, frame.dragon]) {
      if (!camp.isAlive) continue;
      present.add(camp.id);
      const kind = camp.type ?? 'dragon_boss';
      const color = kind.includes('blue') || kind === 'golem' ? '#6ca4b8' : kind === 'wolves' ? '#9693a8' : '#b58565';
      const actor = this.actor(camp.id, kind, () => this.creature(color, kind === 'dragon_boss' ? 30 : kind === 'siege_golem' ? 28 : 20, kind));
      actor.group.position.set(camp.x, 0, camp.y); actor.body.position.y = Math.sin(frame.second * 2) * 1.4;
    }
    for (const ward of frame.wards) {
      present.add(ward.id);
      const actor = this.actor(ward.id, ward.team, () => {
        const group = new THREE.Group();
        this.mesh(group, 'cylinder', '#9b8762', [2, 20, 2], [0, 10, 0]);
        this.mesh(group, 'crystal', TEAM[ward.team], [5, 7, 5], [0, 25, 0], true);
        return { group, body: group, height: 35, key: '' };
      });
      actor.group.position.set(ward.x, 0, ward.y);
    }
    this.abilityEffects.update(frame.projectiles, frame.spells, frame.second, frame.champions);
    for (let i = this.effectsUsed; i < this.effectPool.length; i++) this.effectPool[i].visible = false;
    for (const [id, actor] of this.actors) if (!present.has(id)) {
      actor.avatar?.dispose();
      this.scene.remove(actor.group); this.actors.delete(id);
    }
  }

  project(x: number, y: number, height: number, width: number, screenHeight: number) {
    this.projection.set(x, height, y).project(this.camera);
    return { x: (this.projection.x + 1) * width / 2, y: (1 - this.projection.y) * screenHeight / 2 };
  }

  actorHeight(id: string): number { return this.actors.get(id)?.height ?? 50; }
  close() { this.avatarAssets.close(); }
  stats() { const abilities = this.abilityEffects.stats(); return { actors: this.actors.size,
    effects: this.effectsUsed + abilities.effects, pooledEffects: this.effectPool.length + abilities.pooledEffects }; }
}
