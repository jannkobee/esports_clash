import { arenaGroundHeight, RIDGE_HEIGHT } from './arenaElevation.ts';
import { LANDSCAPE } from './arenaLandform.ts';
import { ARENA_LIGHTING } from './arenaArtDirection.ts';
import * as THREE from 'three';
import type { AramChampionUnit, LaneMinion, LaneStructure } from './types.ts';
import { AvatarModelResources, buildAvatarModel, type AvatarModel } from './threeAvatarModels.ts';
import { AvatarAssetLibrary } from './avatarModelAssets.ts';
import type { VisualRelease } from './avatarVisualRelease.ts';
import { ArenaAbilityEffects, type AbilityProjectile, type AbilitySpell, type WeaponImpact } from './threeAbilityEffects.ts';
import {motionTimeline,type MotionTimeline} from './avatarMotionTimeline.ts';
import {AVATAR_CROSSFADE_SECONDS} from './avatarSecondaryMotion.ts';
import {avatarDesign} from './avatarDesigns.ts';
import {combatDuration} from './avatarCombatMotion.ts';
import {bindWeaponSocket} from './avatarWeaponSockets.ts';
import {bindMeleeContact} from './avatarMeleeContact.ts';
import {STRUCTURE_HIT_RADIUS} from './basicAttackRangeRules.ts';
import {getArsenaldoModelVariant} from './avatarModelUrl.ts';
import {ArenaScenery} from './threeArenaScenery.ts';
import {creatureAttackPose} from './creatureAnimation.ts';

// Presentation inputs are borrowed for this frame only. Never write through them,
// retain simulation objects in meshes, or use gameplay RNG to construct artwork.
type Point = { readonly x: number; readonly y: number };
type Neutral = Point & { readonly id: string; readonly isAlive: boolean; readonly hp: number;
  readonly maxHp: number; readonly type?: string; readonly name: string;
  readonly attackTimer?: number; readonly facingX?: number };
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
  readonly impacts?:readonly WeaponImpact[];
};

export const ARENA_CAMERA_ELEVATION = Math.PI / 3;

function sceneFrustum(zoom: number, aspect: number, worldWidth: number) {
  const safeAspect = Math.max(.1, aspect);
  // Portrait screens keep the same vertical viewing distance and crop horizontally,
  // rather than shrinking a 2600-unit arena into the phone's width.
  const halfH = (worldWidth + 96) / (2 * Math.max(.1,zoom) * Math.max(16 / 9, safeAspect));
  return { halfW: halfH * safeAspect, halfH };
}

export function clampArenaSceneCamera(x: number, y: number, zoom: number, aspect: number,
  worldWidth: number, worldHeight: number) {
  const frustum = sceneFrustum(zoom, aspect, worldWidth);
  const halfW = frustum.halfW;
  const halfH = frustum.halfH / Math.sin(ARENA_CAMERA_ELEVATION);
  const clamp = (value: number, half: number, extent: number, margin: number) =>
    half * 2 >= extent ? extent / 2 : Math.max(half-margin, Math.min(extent-half+margin, value));
  // Border headroom keeps raised structures and nameplates inside the camera.
  return { x: clamp(x, halfW, worldWidth,48), y: clamp(y, halfH, worldHeight,96), halfW, halfH };
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
  recall?: THREE.Mesh; crystal?: THREE.Mesh; avatar?: AvatarModel; height: number; key: string; motion?:MotionTimeline;
  weaponSocket?: ReturnType<typeof bindWeaponSocket>;meleeContact?:ReturnType<typeof bindMeleeContact> };

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
  private readonly shadowMaterial = new THREE.MeshBasicMaterial({ color: '#071314', transparent: true, opacity: 0.28, depthWrite: false });
  private readonly contactOcclusionMaterial = new THREE.MeshBasicMaterial({ color: '#020608', transparent: true, opacity: 0.48, depthWrite: false });
  private readonly poolOwner = new THREE.Group();
  private readonly avatarResources = new AvatarModelResources();
  private readonly avatarAssets:AvatarAssetLibrary;
  private readonly arsenaldoVariant=getArsenaldoModelVariant();
  private readonly abilityEffects = new ArenaAbilityEffects(arenaGroundHeight);
  private readonly projection = new THREE.Vector3();
  private effectsUsed = 0;
  private readonly scenery:ArenaScenery;
  private readonly ground:THREE.Mesh;

  constructor(ground: THREE.Mesh, worldWidth: number, worldHeight: number,visualSnapshot?:Promise<ReadonlyMap<string,VisualRelease>>) {
    this.avatarAssets=new AvatarAssetLibrary(this.avatarResources,undefined,visualSnapshot);
    this.ground=ground;
    this.scene.background = new THREE.Color('#0c1b21');
    this.scene.add(new THREE.HemisphereLight(ARENA_LIGHTING.sky, ARENA_LIGHTING.earth, ARENA_LIGHTING.ambient));
    const sun = new THREE.DirectionalLight(ARENA_LIGHTING.sun, ARENA_LIGHTING.sunIntensity);
    const center=new THREE.Vector3(worldWidth/2,0,worldHeight/2);
    sun.target.position.copy(center);
    sun.position.copy(center).add(new THREE.Vector3(...ARENA_LIGHTING.sunDirection).multiplyScalar(1800));
    this.scene.add(sun,sun.target);
    const rim = new THREE.DirectionalLight(ARENA_LIGHTING.rim, ARENA_LIGHTING.rimIntensity);
    rim.target.position.copy(center);rim.position.copy(center).add(new THREE.Vector3(800,500,-700));
    this.scene.add(rim,rim.target);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(worldWidth / 2, -0.8, worldHeight / 2);
    ground.material = (ground.material as THREE.ShaderMaterial).clone();
    (ground.material as THREE.ShaderMaterial).depthTest = true;
    (ground.material as THREE.ShaderMaterial).depthWrite = true;
    const relief=(ground.material as THREE.ShaderMaterial).uniforms?.uRelief;if(relief)relief.value=1;
    this.scene.add(ground);
    for(const x of [LANDSCAPE.left/2,worldWidth-LANDSCAPE.left/2])this.mesh(this.scene,'box','#404a41',[LANDSCAPE.left,RIDGE_HEIGHT,worldHeight],[x,RIDGE_HEIGHT/2-1,worldHeight/2]);
    this.mesh(this.scene, 'box', '#23392d', [worldWidth + 320, 18, worldHeight + 360], [worldWidth / 2, -11, worldHeight / 2]);
    this.scenery=new ArenaScenery(worldWidth,worldHeight);this.scene.add(this.scenery.root);
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
      if (actor) this.releaseActor(actor);
      actor = build(); actor.key = key; this.actors.set(id, actor); this.scene.add(actor.group);
    }
    actor.group.visible = true;
    return actor;
  }

  private releaseActor(actor:Actor){
    actor.avatar?.dispose();
    // Structure ornaments own their instance buffers, while their geometry and
    // materials remain shared with scenery until the whole scene is disposed.
    actor.group.traverse(node=>{if(node instanceof THREE.InstancedMesh)node.dispose();});
    this.scene.remove(actor.group);
  }

  private champion(unit: AramChampionUnit): Actor {
    const group = new THREE.Group();
    const variant=unit.champion.id==='c_invoker'?this.arsenaldoVariant:'current';
    const avatar = this.avatarAssets.instantiate(unit.champion.id,variant) ?? buildAvatarModel(unit.champion, this.avatarResources);
    this.avatarAssets.request(unit.champion.id,undefined,variant);
    group.add(avatar.body);
    const shadow = new THREE.Mesh(this.shapes.disc, this.shadowMaterial);
    shadow.rotation.x = -Math.PI / 2; shadow.scale.set(24, 16, 1); shadow.position.y = .1; group.add(shadow);
    const contactAO = new THREE.Mesh(this.shapes.disc, this.contactOcclusionMaterial);
    contactAO.rotation.x = -Math.PI / 2; contactAO.scale.set(13, 8.5, 1); contactAO.position.y = .12; group.add(contactAO);
    this.flat(group, 'ring', TEAM[unit.team], 22);
    const recall = this.flat(group, 'ring', '#a5f3fc', 31, 0, 0, 1); recall.visible = false;
    return { group, body: avatar.body, avatar, recall, height: avatar.height, key: '', weaponSocket:bindWeaponSocket(avatar.body,unit.champion.id),meleeContact:bindMeleeContact(avatar.body,unit.champion.id) };
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
    this.scenery.decorateStructure(body,st);
    return { group, body, crystal, height: nexus ? 110 : barracks ? 75 : 125, key: '' };
  }

  private creature(color: string, size: number, kind: string, team?: 'blue' | 'red'): Actor {
    if (!team) return this.neutralCreature(color, size, kind);
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

  private neutralCreature(color: string, size: number, kind: string): Actor {
    const group = new THREE.Group(), body = new THREE.Group(); group.add(body);
    body.scale.setScalar(size);
    const frost = kind === 'golem' || kind === 'blue_buff';
    const dragon = kind === 'dragon_boss' || kind === 'drakes' || kind === 'red_buff';
    const wolf = kind === 'wolves', brute = kind === 'behemoth';
    const shell = frost ? '#638c91' : wolf ? '#5c586b' : brute ? '#4b6950' : dragon ? '#994d38' : '#536958';
    const eye = frost ? '#89eff0' : wolf ? '#c7a5f0' : '#ffd18a';
    const part = (shape: keyof ArenaScene['shapes'], tint: string, scale: [number,number,number], at: [number,number,number], glow = false) => this.mesh(body, shape, tint, scale, at, glow);
    const shadow = new THREE.Mesh(this.shapes.disc, this.shadowMaterial);
    shadow.rotation.x = -Math.PI / 2; shadow.scale.set(size * 1.7, size * 1.2, 1); shadow.position.y = .05; group.add(shadow);
    if (wolf || brute || dragon) {
      part('sphere', shell, [wolf ? .62 : 1.05, .70, wolf ? 1.15 : 1.25], [0, 1.05, 0]);
      part('sphere', shell, [.64, .69, .68], [0, 1.45, .95]);
      part('sphere', color, [wolf ? .28 : .48, .28, .65], [0, 1.23, 1.5]);
      part('box', '#463b32', [.53, .10, .70], [0, 1.04, 1.60]);
      for (const side of [-1, 1]) {
        for (const z of [-.74, .72]) {
          part('sphere', shell, [.26, .49, .30], [side * .65, .61, z]);
          part('sphere', shell, [.26, .23, .40], [side * .65, .20, z + .13]);
          for (let claw = 0; claw < 3; claw++) part('cone', '#d4c4a0', [.045, .19, .045], [side * .65 + (claw - 1) * .12, .13, z + .46]).rotation.x = Math.PI / 2;
        }
        part('cone', '#d2b18c', [.21, wolf ? .60 : .83, .19], [side * .45, 2.13, .85]).rotation.z = side * -.25;
        part('sphere', eye, [.095, .085, .08], [side * .36, 1.61, 1.47], true);
        part('cone', '#e1d6b7', [.06, .24, .06], [side * .23, 1.02, 1.86]).rotation.x = Math.PI;
      }
      for (let i = 0; i < 5; i++) {
        const tail = part('sphere', shell, [.23 - i * .026, .20 - i * .02, .42], [Math.sin(i * .6) * .35, 1.03 - i * .06, -1.15 - i * .44]); tail.rotation.y = Math.sin(i * .6) * -.3;
      }
      if (dragon) {
        for (let i = 0; i < 6; i++) part('cone', '#d5a46a', [.17, .47 + i % 2 * .13, .17], [0, 1.76, .8 - i * .37]);
        for (const side of [-1, 1]) {
          const wing = new THREE.Group(); wing.name = side < 0 ? 'left-wing' : 'right-wing'; wing.position.set(side * .58, 1.55, -.25); body.add(wing);
          const rib = this.mesh(wing, 'cone', '#d4a26f', [.10, 2.0, .10], [side * .85, .6, -.1]); rib.rotation.z = -side * 1.0;
          for (let i = 0; i < 4; i++) {
            const membrane = this.mesh(wing, 'cone', i % 2 ? '#ae664d' : '#824138', [.55, 1.65 - i * .15, .09], [side * (1.0 + i * .18), .35 - i * .20, -.15 - i * .27]); membrane.rotation.z = side * -.85; membrane.rotation.x = -.3;
          }
        }
      } else if (brute) for (let i = 0; i < 7; i++) part('rock', i % 2 ? '#6c8556' : '#485a42', [.42, .34, .39], [Math.sin(i * 2) * .72, 1.67, .65 - i * .23]);
    } else {
      part('rock', shell, [1.08, 1.12, .64], [0, 1.45, 0]);
      part('rock', shell, [.62, .54, .50], [0, 2.75, .16]);
      part('crystal', eye, [.23, .42, .23], [0, 1.65, .62], true);
      for (const side of [-1, 1]) {
        part('rock', color, [.62, .54, .65], [side * 1.05, 2.14, 0]);
        part('rock', shell, [.39, .66, .40], [side * 1.35, 1.30, .12]);
        part('rock', color, [.46, .41, .48], [side * 1.43, .75, .21]);
        part('rock', shell, [.38, .55, .39], [side * .54, .57, 0]);
        part('rock', color, [.46, .24, .63], [side * .54, .20, .21]);
        part('sphere', eye, [.085, .08, .07], [side * .22, 2.77, .62], true);
        for (let j = 0; j < 3; j++) part('crystal', eye, [.14, .52 + j * .14, .14], [side * (1.0 + j * .13), 2.62, -.12 + j * .13]);
      }
    }
    // Keep detailed camps affordable: static pieces share one draw per surface.
    // Wings remain separate groups so their borrowed-clock motion still works.
    for (const parent of [body, ...body.children.filter((node): node is THREE.Group => node instanceof THREE.Group)]) {
      const batches = new Map<string, THREE.Mesh[]>();
      for (const node of parent.children) if (node instanceof THREE.Mesh && !Array.isArray(node.material)) {
        const key = node.geometry.uuid + node.material.uuid;
        const meshes = batches.get(key) ?? []; meshes.push(node); batches.set(key, meshes);
      }
      for (const meshes of batches.values()) {
        if (meshes.length < 2) continue;
        const batch = new THREE.InstancedMesh(meshes[0].geometry, meshes[0].material, meshes.length);
        meshes.forEach((mesh, i) => { mesh.updateMatrix(); batch.setMatrixAt(i, mesh.matrix); parent.remove(mesh); });
        batch.computeBoundingSphere(); parent.add(batch);
      }
    }
    return {group, body, height: size * 3.6, key: ''};
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
    mesh.visible = true; mesh.position.set(x, height + arenaGroundHeight(x,y), y); mesh.scale.set(sx, sy, sz);
    mesh.rotation.set(shape === 'ring' || shape === 'disc' ? -Math.PI / 2 : 0, 0, 0);
    return mesh;
  }

  update(frame: ArenaSceneFrame): void {
    this.scenery.update(frame.second);
    this.scenery.visibility.begin();
    const groundMaterial=this.ground.material;
    if(groundMaterial instanceof THREE.ShaderMaterial&&groundMaterial.uniforms.uTime)groundMaterial.uniforms.uTime.value=Math.max(0,frame.second);
    const present = new Set<string>(); this.effectsUsed = 0;
    for (const unit of frame.champions) {
      if (!unit.isAlive) {
        const corpse=this.actors.get(unit.id);
        if(corpse?.avatar&&corpse.motion&&frame.second>=corpse.motion.second){
          corpse.motion=motionTimeline(corpse.motion,unit,frame.second,corpse.motion.yaw);
          if(frame.second-corpse.motion.death<1.25){
            present.add(unit.id);corpse.group.children.forEach(child=>{if(child!==corpse.body)child.visible=false;});
            const transition=frame.second-corpse.motion.changed;
            corpse.avatar.animate({motionState:'death',motionTime:frame.second-corpse.motion.death,
              previousMotion:corpse.motion.from,previousMotionTime:corpse.motion.fromTime+transition,
              previousGaitPhase:corpse.motion.gaitPhase,motionBlend:Math.min(1,transition/AVATAR_CROSSFADE_SECONDS)},frame.second);
          }
        }
        continue;
      }
      present.add(unit.id);
      const variant=unit.champion.id==='c_invoker'?this.arsenaldoVariant:'current';
      const actor = this.actor(unit.id, unit.champion.id + unit.team +variant+ this.avatarAssets.has(unit.champion.id,variant), () => this.champion(unit));
      actor.group.children.forEach(child=>{child.visible=true;});
      actor.group.position.set(unit.x, arenaGroundHeight(unit.x,unit.y)+((unit.knockupTimer ?? 0)>0?24:0), unit.y);
      actor.body.position.x=0;actor.body.position.z=0;
      const moving=unit.animState==='walk'&&Math.hypot(unit.vx,unit.vy)>1;
      const intent=unit.actionIntent;
      const aiming=(unit.animState==='attack'||unit.animState==='cast')&&intent&&['champion','structure','minion','camp','objective'].includes(intent.kind);
      const actualStrike=unit.basicAttackVisual,hitAge=actualStrike?frame.second-actualStrike.releasedAt:Infinity;
      const strikeActive=actualStrike&&hitAge>=0&&hitAge<.22;
      const aimTarget=(strikeActive||aiming)?[...frame.champions,...frame.minions,...frame.structures,...frame.camps,frame.dragon].find(target=>target.id===(strikeActive?actualStrike.targetId:intent?.targetId)):undefined;
      const aimX=aimTarget?.x??intent?.targetX,aimY=aimTarget?.y??intent?.targetY;
      const strikeX=aimTarget?.x??actualStrike?.x,strikeY=aimTarget?.y??actualStrike?.y;
      // Locomotion follows travel direction; stationary attacks/casts still face their target.
      const targetYaw=moving?Math.atan2(unit.vx,unit.vy):strikeActive&&strikeX!==undefined&&strikeY!==undefined?Math.atan2(strikeX-unit.x,strikeY-unit.y):aiming&&aimX!==undefined&&aimY!==undefined&&Math.hypot(aimX-unit.x,aimY-unit.y)>1?Math.atan2(aimX-unit.x,aimY-unit.y):
        unit.facing==='right'?Math.PI/2:-Math.PI/2;
      actor.motion=motionTimeline(actor.motion,unit,frame.second,targetYaw,(avatarDesign(unit.champion.id)?.height??76)/76,actor.avatar?.body.userData.strideDistances);
      actor.body.rotation.y=actor.motion.yaw;
      const elapsed=frame.second-actor.motion.started,transition=frame.second-actor.motion.changed;
      const attackSpeedScale = actor.motion.state === 'attack' ? Math.max(0.5, (unit.champion.aspd + (((unit as {censerBuffTimer?: number}).censerBuffTimer ?? 0) > 0 ? 0.25 : 0)) / Math.max(0.1, unit.champion.aspd)) : 1;
      const attackMotionTime = actor.motion.state === 'attack' ? elapsed * attackSpeedScale + combatDuration(unit.champion.id, 'attack') * .42 : elapsed;
      actor.avatar?.animate({...unit,motionState:actor.motion.state,motionTime:attackMotionTime,
        previousMotion:actor.motion.from,previousMotionTime:actor.motion.fromTime+transition,motionBlend:Math.min(1,transition/AVATAR_CROSSFADE_SECONDS),
        recoil:Math.max(0,1-(frame.second-actor.motion.hit)/.32),gaitPhase:actor.motion.gaitPhase,
        previousGaitPhase:actor.motion.gaitPhase,motionYaw:actor.motion.yaw,
        plantFeet:moving&&!((unit.knockupTimer??0)>0)&&!unit.dash,moveX:unit.vx,moveZ:unit.vy},frame.second);
      if(strikeActive&&actualStrike.melee&&!unit.dash&&strikeX!==undefined&&strikeY!==undefined){
        const dx=strikeX-unit.x,dz=strikeY-unit.y,distance=Math.hypot(dx,dz)||1;
        const structure=frame.structures.find(st=>st.id===actualStrike.targetId);
        const radius=structure?STRUCTURE_HIT_RADIUS[structure.type]:frame.minions.some(m=>m.id===actualStrike.targetId)?10:16;
        const weight=hitAge<.07?1:Math.max(0,1-(hitAge-.07)/.15);
        actor.meleeContact?.({x:strikeX-dx/distance*radius,y:arenaGroundHeight(strikeX,strikeY)+(structure?35:30),z:strikeY-dz/distance*radius,weight},delta=>{
          const world=actor.body.getWorldPosition(new THREE.Vector3()).add(delta);actor.group.worldToLocal(world);actor.body.position.copy(world);actor.body.updateWorldMatrix(true,true);
        });
      }
      if (unit.shield > 0 || unit.zhonyaActive) this.effect('ring', unit.zhonyaActive ? '#facc15' : unit.champion.accentColor, .8, unit.x, unit.y, 3, 28);
      if (actor.recall) { actor.recall.visible = !!unit.isRecalling; actor.recall.rotation.z = frame.second; }
      if (unit.stunTimer > 0 || unit.charmTimer > 0) this.effect('sphere', '#ffe9a3', .95, unit.x, unit.y, actor.height + 3, 4);
    }
    for (const st of frame.structures) {
      present.add(st.id);
      const actor = this.actor(st.id, st.type + st.team, () => this.structure(st));
      actor.group.position.set(st.x, arenaGroundHeight(st.x,st.y), st.y);
      actor.body.scale.y = st.isAlive ? 1 : .12;
      if (actor.crystal) { actor.crystal.visible = st.isAlive; actor.crystal.rotation.y = frame.second * .6; }
    }
    for (const minion of frame.minions) {
      if (!minion.isAlive) continue;
      present.add(minion.id);
      const kind = minion.summonedBearOwnerId ? 'bear' : minion.prismWardenOwnerId ? 'prism' : minion.siegeGolem ? 'siege' : minion.type;
      const size = kind === 'siege' ? 27 : kind === 'bear' ? 22 : kind === 'cannon' ? 14 : 10;
      const actor = this.actor(minion.id, kind + minion.team, () => this.creature(TEAM[minion.team], size, kind, minion.team));
      actor.group.position.set(minion.x, arenaGroundHeight(minion.x,minion.y), minion.y);
      actor.body.rotation.y = (minion.facingX ?? (minion.team === 'blue' ? 1 : -1)) > 0 ? Math.PI / 2 : -Math.PI / 2;
      actor.body.rotation.x = Math.sin(minion.attackTimer * 8) * .08;
    }
    for (const camp of [...frame.camps, frame.dragon]) {
      if (!camp.isAlive) continue;
      present.add(camp.id);
      const kind = camp.type ?? 'dragon_boss';
      const color = kind.includes('blue') || kind === 'golem' ? '#6ca4b8' : kind === 'wolves' ? '#9693a8' : '#b58565';
      const actor = this.actor(camp.id, kind, () => this.creature(color, kind === 'dragon_boss' ? 30 : kind === 'siege_golem' ? 28 : 20, kind));
      const attack = creatureAttackPose(camp.attackTimer ?? 0, 1.35);
      actor.group.position.set(camp.x, arenaGroundHeight(camp.x,camp.y), camp.y);
      actor.body.position.y = Math.sin(frame.second * 2) * 1.2 + attack.windup * 2;
      actor.body.rotation.y = (camp.facingX ?? 1) > 0 ? Math.PI / 2 : -Math.PI / 2;
      actor.body.rotation.x = attack.windup * -.1 + attack.strike * .15;
      for (const [name,side] of [['left-wing',-1],['right-wing',1]] as const) {
        const wing = actor.body.getObjectByName(name); if (wing) wing.rotation.z = side * Math.sin(frame.second * 2.4) * .17;
      }
    }
    for (const ward of frame.wards) {
      present.add(ward.id);
      const actor = this.actor(ward.id, ward.team, () => {
        const group = new THREE.Group();
        this.mesh(group, 'cylinder', '#9b8762', [2, 20, 2], [0, 10, 0]);
        this.mesh(group, 'crystal', TEAM[ward.team], [5, 7, 5], [0, 25, 0], true);
        return { group, body: group, height: 35, key: '' };
      });
      actor.group.position.set(ward.x, arenaGroundHeight(ward.x,ward.y), ward.y);
    }
    // Resolve after native clips, contacts, root yaw and knock-up transforms.
    // Borrowed world inputs are copied; only renderer-space socket values leave the rig.
    const sources=frame.champions.map(unit=>{
      const actor=this.actors.get(unit.id),socket=unit.isAlive?actor?.weaponSocket?.():undefined;
      // VFX use surface-relative heights, then lift each endpoint exactly once.
      const relative=(p:[number,number,number]):[number,number,number]=>[p[0],p[1]-arenaGroundHeight(p[0],p[2]),p[2]];
      return {...unit,weaponSocket:socket?{...socket,tip:relative(socket.tip),base:relative(socket.base)}:undefined,
        visualEvolution:actor?.avatar?.body.userData.visualEvolution,
        attackAge:actor?.motion?.state==='attack'?frame.second-actor.motion.started:undefined};
    });
    this.abilityEffects.update(frame.projectiles, frame.spells, frame.second, sources,frame.impacts);
    for (let i = this.effectsUsed; i < this.effectPool.length; i++) this.effectPool[i].visible = false;
    for (const [id, actor] of this.actors) if (!present.has(id)) {
      this.releaseActor(actor);this.actors.delete(id);
    }
    // Only already-rendered living bodies drive cutaways; no visibility/AI state is written.
    for(const unit of frame.champions){
      const actor=this.actors.get(unit.id);
      if(unit.isAlive&&(unit.stealthTimer??0)<=0&&actor?.group.visible)
        this.scenery.visibility.protect(this.camera,unit.x,actor.group.position.y,unit.y,actor.height);
    }
    for(const camp of [...frame.camps,frame.dragon]){
      const actor=this.actors.get(camp.id);
      if(camp.isAlive&&actor?.group.visible&&frame.champions.some(unit=>unit.isAlive&&(unit.stealthTimer??0)<=0&&Math.hypot(unit.x-camp.x,unit.y-camp.y)<190))
        this.scenery.visibility.protect(this.camera,camp.x,actor.group.position.y,camp.y,actor.height,32);
    }
  }

  project(x: number, y: number, height: number, width: number, screenHeight: number) {
    this.projection.set(x, height+arenaGroundHeight(x,y), y).project(this.camera);
    return { x: (this.projection.x + 1) * width / 2, y: (1 - this.projection.y) * screenHeight / 2 };
  }

  actorHeight(id: string): number {
    const actor=this.actors.get(id);if(!actor)return 50;
    return actor.height+Math.max(0,actor.group.position.y-arenaGroundHeight(actor.group.position.x,actor.group.position.z))+6;
  }
  close() { this.avatarAssets.close(); }
  stats() { const abilities = this.abilityEffects.stats(); return { actors: this.actors.size,
    effects: this.effectsUsed + abilities.effects, pooledEffects: this.effectPool.length + abilities.pooledEffects }; }
}
