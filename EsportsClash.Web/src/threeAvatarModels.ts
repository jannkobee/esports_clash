import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { avatarDesign, type AvatarDesign } from './avatarDesigns.ts';
import type { ChampionKit } from './types.ts';
import { beveledPanel, clothCape, loftSurface, taperedCurve } from './avatarSurfaceGeometry.ts';
import { sculptAvatarBody } from './avatarSculptBody.ts';
import { arsenaldoElements } from './arsenaldoModel.ts';
import { attachStandingCostume, standingStance } from './avatarStance.ts';
import {combatAnimator,getAvatarAnimProfile} from './avatarCombatMotion.ts';
import {avatarContactRig} from './avatarContactRig.ts';
import {equipmentWorkshop} from './avatarEquipment.ts';
import {AVATAR_MESH_PROFILES} from './avatarMeshProfiles.ts';
import {addCreatureMeshDetails,wingMembrane} from './avatarCreatureMeshes.ts';
import {voltaireModelForm} from './voltaireModelForm.ts';

type Shape = 'box' | 'ball' | 'gem' | 'cone' | 'rod' | 'torus' | 'robe' | 'leaf';
type V = [number, number, number];
export type AvatarPose = { animState?: string; animTimer?: number; trueFormTimer?: number;
  motionState?: string; motionTime?: number; previousMotion?: string; previousMotionTime?: number; motionBlend?: number; recoil?: number; clipPhase?:number;
  gaitPhase?:number; plantFeet?:boolean; moveX?:number; moveZ?:number;
  dash?:{readonly kind:string;readonly remaining:number};
  voltaireOverloadTimer?:number;
  kaelenOrbs?: readonly ('ice' | 'wind' | 'fire')[]; propellaRotorStacks?: number;
  propellaOverdriveTimer?: number; propellaGunshipTimer?: number };
export type AvatarModel = { body: THREE.Group; height: number; animate: (pose: AvatarPose, second: number) => void; dispose: () => void };

/** Geometry/material ownership shared by arena actors or one inspection renderer. */
export class AvatarModelResources {
  readonly owner = new THREE.Group();
  private readonly shapes: Record<Shape, THREE.BufferGeometry> = {
    box: beveledPanel([[-.45, -.45], [.45, -.45], [.45, .45], [-.45, .45]], .9, .05), ball: new THREE.SphereGeometry(1, 16, 12),
    gem: new THREE.OctahedronGeometry(1), cone: new THREE.ConeGeometry(1, 1, 8),
    rod: new THREE.CylinderGeometry(1, 1, 1, 10), torus: new THREE.TorusGeometry(1, .1, 5, 24),
    robe: loftSurface([[0, 1, 1], [.08, .97, .97], [.4, .8, .8], [.7, .55, .55], [1, .65, .65]], 24, .06),
    leaf: beveledPanel([[0, -1], [.2, -.65], [.65, 0], [.22, .6], [0, 1], [-.22, .6], [-.65, 0], [-.2, -.65]], .15, .03),
  };
  private readonly materials = new Map<string, THREE.MeshStandardMaterial>();
  private readonly merged = new Map<string, THREE.BufferGeometry>();
  private readonly surfaces = new Map<string, THREE.BufferGeometry>();

  constructor() {
    this.owner.visible = false;
    for (const geometry of Object.values(this.shapes)) this.owner.add(new THREE.Mesh(geometry, this.material('#ffffff')));
  }

  material(color: string, glow = false, twoSided = false, painted = false) {
    const key = color + glow + twoSided + painted;
    let material = this.materials.get(key);
    if (!material) {
      const metal = ['#b8c4c7', '#b8c1bd', '#a5b9ba', '#d7b16a', '#c7ab70', '#b99960', '#e0c184'].includes(color);
      material = new THREE.MeshStandardMaterial({ color, roughness: metal ? .32 : .78, metalness: metal ? .72 : .04,
        emissive: glow ? color : '#000000', emissiveIntensity: glow ? .6 : 0, vertexColors: painted,
        side: twoSided ? THREE.DoubleSide : THREE.FrontSide });
      this.materials.set(key, material);
      this.owner.add(new THREE.Mesh(this.shapes.box, material));
    }
    return material;
  }

  mesh(parent: THREE.Object3D, shape: Shape, color: string, size: V, at: V, glow = false) {
    const mesh = new THREE.Mesh(this.shapes[shape], this.material(color, glow));
    mesh.scale.set(...size); mesh.position.set(...at); parent.add(mesh); return mesh;
  }

  geometry(key: string, create: () => THREE.BufferGeometry) {
    let geometry = this.surfaces.get(key);
    if (!geometry) { geometry = create(); this.surfaces.set(key, geometry); this.owner.add(new THREE.Mesh(geometry, this.material('#ffffff'))); }
    return geometry;
  }

  batch(root: THREE.Group, identity: string): void {
    const visit = (parent: THREE.Object3D, path: string) => {
      [...parent.children].forEach((child, i) => { if (child instanceof THREE.Group || child instanceof THREE.Bone) visit(child, `${path}/${i}:${child.name}`); });
      const batches = new Map<THREE.Material, THREE.Mesh[]>();
      for (const child of parent.children) if (child instanceof THREE.Mesh && !(child instanceof THREE.SkinnedMesh) && !Array.isArray(child.material)) {
        const meshes = batches.get(child.material) ?? []; meshes.push(child); batches.set(child.material, meshes);
      }
      for (const [material, meshes] of batches) {
        if (meshes.length < 2) continue;
        const key = `${identity}/${path}/${material.uuid}`;
        let geometry = this.merged.get(key);
        if (!geometry) {
          const transformed = meshes.map(mesh => {
            mesh.updateMatrix(); const copy = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
            return copy.applyMatrix4(mesh.matrix);
          });
          const combined = mergeGeometries(transformed);
          transformed.forEach(copy => copy.dispose());
          if (!combined) throw Error(`Cannot batch avatar geometry: ${identity}`);
          geometry = combined; this.merged.set(key, geometry);
          this.owner.add(new THREE.Mesh(geometry, material));
        }
        meshes.forEach(mesh => parent.remove(mesh)); parent.add(new THREE.Mesh(geometry, material));
      }
    };
    visit(root, 'root');
  }
}

const FALLBACK: AvatarDesign = { body: 'scout', width: 11, height: 68, skin: '#bf9679', hair: '#354253',
  silhouette: 'Expedition scout', costume: 'Layered tunic and boots', signature: 'Scout blade' };

export function buildAvatarModel(kit: Pick<ChampionKit, 'id' | 'primaryColor' | 'accentColor'>,
  resources: AvatarModelResources, options: { externalAnatomy?: boolean; externalOutfit?: boolean } = {}): AvatarModel {
  const id = kit.id;
  const d = avatarDesign(id) ?? FALLBACK;
  const body = new THREE.Group(), outfit = new THREE.Group(); outfit.name = 'outfit'; body.add(outfit);
  body.name = `avatar:${id}`; body.userData.designId = id;
  body.userData.artistOutfit=!!options.externalOutfit;
  body.userData.meshRevision=9;body.userData.meshProfile=AVATAR_MESH_PROFILES[id];
  const p = kit.primaryColor, a = kit.accentColor;
  const dark = new THREE.Color(p).multiplyScalar(.32).getStyle();
  const steel = '#b8c4c7', gold = '#d7b16a', ivory = '#eee7d4', leather = '#4a3c36';
  const w = d.width;
  const workshop=equipmentWorkshop(resources,id,a);
  const m = (parent: THREE.Object3D, shape: Shape, color: string, size: V, at: V, glow = false) => resources.mesh(parent, shape, color, size, at, glow);
  const group = (parent: THREE.Object3D, name: string, at: V = [0, 0, 0]) => {
    const node = new THREE.Group(); node.name = name; node.userData.avatarPart = name; node.position.set(...at); parent.add(node); return node;
  };
  const bar = (parent: THREE.Object3D, color: string, from: V, to: V, radius = 1.5, glow = false) => {
    const start = new THREE.Vector3(...from), end = new THREE.Vector3(...to);
    const delta = end.clone().sub(start);
    const mesh = m(parent, 'rod', color, [radius, delta.length(), radius], start.clone().add(end).multiplyScalar(.5).toArray() as V, glow);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()); return mesh;
  };
  const ring = (parent: THREE.Object3D, color: string, radius: number, at: V, rotation: V = [0, 0, 0], glow = false) => {
    const mesh = m(parent, 'torus', color, [radius, radius, radius], at, glow); mesh.rotation.set(...rotation); return mesh;
  };
  const feather = (parent: THREE.Object3D, color: string, at: V, length: number, lean: number) => {
    const mesh = m(parent, 'leaf', color, [3, length, 1.2], at); mesh.rotation.z = lean; return mesh;
  };
  const blade = (parent: THREE.Object3D, color = steel, length = 32, width = 4) => {
    workshop.sword(parent,color,length,width);
  };
  const gun = (parent: THREE.Object3D, length: number, radius: number, color = dark, count = 1) => {
    workshop.gun(parent,length,radius,color,count);
  };
  const staff = (parent: THREE.Object3D, color = leather, length = 66) => workshop.staff(parent,color,length);
  const crown = (parent: THREE.Object3D, color: string, count = 5, y = 73) => {
    ring(parent, color, 9, [0, y - 3, 0], [Math.PI / 2, 0, 0]);
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      m(parent, 'cone', color, [2.4, 10 + (i % 2) * 3, 2.4], [Math.cos(angle) * 8, y + 2, Math.sin(angle) * 8]);
    }
  };
  const cape = (color: string, length = 34, spread = w) => {
    const geometry = resources.geometry(`${id}:cape:${length}:${spread}`, () => {
      const geometry=clothCape(length,spread),positions=geometry.getAttribute('position');
      for(let i=0;i<positions.count;i++){const drop=THREE.MathUtils.clamp((52-positions.getY(i))/length,0,1);positions.setZ(i,positions.getZ(i)-drop*drop*4);}
      geometry.computeVertexNormals();return geometry;
    });
    const node = new THREE.Mesh(geometry, resources.material(color, false, true)); node.name = 'draped-cape'; outfit.add(node);
  };

  const sculpt = sculptAvatarBody(outfit, id, d, p, a, resources, options.externalAnatomy, options.externalOutfit);
  const { left, right, legs } = sculpt;
  // Animation references belong to the model, never to simulation objects.
  const orbiters: THREE.Object3D[] = [], rotors: THREE.Object3D[] = [], wings: THREE.Object3D[] = [];
  let bear: THREE.Group | undefined, gunship: THREE.Group | undefined;
  const floating = ['wisp', 'dragon', 'rider', 'skiff', 'demon'].includes(d.body) || id === 'c_inai';

  switch (id) {
    case 'c_solana': {
      cape(ivory, 34, 15); crown(outfit, gold, 7);
      const shield = group(left, 'dawn-shield', [0, 2, 10]);
      m(shield, 'gem', ivory, [14, 24, 4], [0, 0, 0]); ring(shield, gold, 8, [0, 1, 4]);
      m(shield, 'gem', a, [5, 6, 2], [0, 1, 5], true);
      blade(right, ivory, 42, 4); break;
    }
    case 'c_astra': case 'c_kindra': {
      cape(id === 'c_astra' ? '#17394e' : '#e3dcea', 40, 12);
      const bow = group(left, 'bow', [-3, 8, 9]);
      workshop.bow(bow,id==='c_astra'?'#bdcfd9':'#c6baa4');
      for(const upper of [true,false]){
        const string=group(bow,upper?'bowstring-upper':'bowstring-lower',[0,upper?15:-15,0]);
        m(string,'rod',ivory,[.4,30,.4],[0,0,0]);
      }
      bar(group(right,'nocked-arrow'), ivory, [0, 3, 5], [0, 3, 35], .8);
      if (id === 'c_astra') {
        if (options.externalAnatomy) {
          for (const side of [-1, 1]) bar(outfit, '#b4e7f8', [0, 68, 4], [side * 4, 69, 2], .45);
          m(outfit, 'gem', '#b4e7f8', [.9, 1.6, .5], [0, 68, 4.3]);
        } else {
          crown(outfit, '#b4e7f8', 3);
          for (let i = 0; i < 3; i++) m(outfit, 'ball', d.hair, [4, 7, 4], [4, 58 - i * 9, -8]);
        }
        for (let i = 0; i < 4; i++) bar(outfit, ivory, [5 + i * 2, 32, -10], [5 + i * 2, 57, -10], .7);
      } else {
        m(outfit, 'gem', ivory, [5.5, 5, 1.2], [0, 70, 6]);
        for (const side of [-1, 1]) bar(outfit, ivory, [side * 6, 67, 0], [side * 13, 80, -3], 2.5);
        const wolf = group(outfit, 'wolf-spirit', [-20, 30, -8]);
        m(wolf, 'ball', dark, [9, 6, 17], [0, 0, 0]); m(wolf, 'cone', ivory, [6, 17, 6], [0, 1, 20]).rotation.x = Math.PI / 2;
        for (const side of [-1, 1]) m(wolf, 'cone', dark, [4, 12, 4], [side * 5, 9, 10]);
      }
      break;
    }
    case 'c_kyumi': {
      for (let i = 0; i < 9; i++) {
        const t = (i - 4) * .28;
        const tail = group(outfit, `fox-tail:${i}`);
        const geometry = resources.geometry(`${id}:curved-tail:${i}`, () => taperedCurve([
          [Math.sin(t) * 5, 25, -6], [Math.sin(t) * 20, 32, -18 - i % 2 * 3],
          [Math.sin(t) * 32, 45 + Math.cos(t) * 10, -23], [Math.sin(t) * 31, 52 + Math.cos(t) * 11, -17]], 4.2, .12, 18));
        tail.add(new THREE.Mesh(geometry, resources.material(i % 2 ? '#ead7de' : '#f1e6df')));
      }
      for (const side of [-1, 1]) { m(outfit, 'cone', d.hair, [4.5, 14, 4], [side * 7, 73, -1]);
        m(outfit, 'cone', a, [2.5, 9, 2], [side * 7, 74, 1]); }
      m(right, 'ball', '#d7f5ff', [7, 7, 7], [2, 5, 10], true); break;
    }
    case 'c_buck': {
      cape(leather, 36, 18); gun(right, 35, 3.5, dark, 2);
      m(outfit, 'ball', d.hair, [7, 6, 5], [0, 56, 5]);
      const belt = m(outfit, 'box', leather, [4, 32, 19], [0, 39, 0]); belt.rotation.z = -.7;
      for (let i = 0; i < 5; i++) m(outfit, 'rod', gold, [1.6, 6, 1.6], [-10 + i * 4, 48 - i * 4, 10]); break;
    }
    case 'c_valkira':
      cape('#651c2c', 39, 16); blade(right, steel, 42, 7); blade(left, '#d1d8cb', 32, 5);
      m(outfit, 'leaf', d.hair, [7, 16, 5], [0, 77, -2]).rotation.z = -.4; break;
    case 'c_kage': {
      m(outfit, 'gem', '#363744', [9, 11, 8], [0, 61, 0]);
      m(outfit, 'box', '#f6b2aa', [11, 1.2, 1], [0, 62, 7.5], true);
      for (const arm of [left, right]) for (const side of [-1, 1]) m(arm, 'gem', steel, [2, 18, 1.8], [side * 3, -13, 10]).rotation.x = .5;
      for (let i = 0; i < 4; i++) m(outfit, 'gem', steel, [3, 21, 2], [0, 43, -10]).rotation.z = i * Math.PI / 4;
      break;
    }
    case 'c_kazemaru':
      blade(right, '#d8edeb', 47, 2.5); bar(outfit, dark, [-12, 19, -8], [-25, 50, -8], 2.8);
      m(outfit, 'leaf', d.hair, [5, 17, 6], [0, 78, -6]).rotation.x = -.4;
      m(outfit, 'box', '#9bd5e3', [30, 5, 4], [-10, 50, -11]).rotation.z = -.3;
      ring(outfit, leather, 11, [0, 28, 0], [Math.PI / 2, 0, 0]); break;
    case 'c_cora': case 'c_renn': {
      for (const side of id === 'c_renn' ? [-1, 1] : [-1]) for (let i = 0; i < 6; i++) {
        feather(outfit, i % 2 ? ivory : p, [side * (11 + i * 3), 41 - i * 3, -9], 23 - i, side * (.3 + i * .1));
      }
      if (id === 'c_cora') for (let i = 0; i < 4; i++) feather(right, '#e5c9ec', [(i - 1.5) * 3, -2, 7], 17, (i - 1.5) * .2);
      else { crown(outfit, gold, 3); m(outfit, 'box', ivory, [10, 20, 2], [0, 40, 8]); }
      break;
    }
    case 'c_sylla': {
      cape('#465b34', 36, 17); staff(right); m(right, 'gem', '#93c78b', [8, 11, 6], [0, 38, 5]);
      m(outfit, 'ball', '#5e513a', [8, 7, 7], [0, 72, -6]);
      for (const side of [-1, 1]) m(outfit, 'ball', '#5e513a', [3.5, 3.5, 3], [side * 7, 78, -4]);
      m(outfit, 'cone', ivory, [5, 18, 4], [0, 53, 6]).rotation.z = Math.PI;
      bear = group(body, 'ironclaw-form'); bear.visible = false;
      m(bear, 'ball', '#4d523c', [24, 26, 17], [0, 33, 0]);
      m(bear, 'ball', '#737960', [16, 16, 13], [0, 64, 1]);
      m(bear, 'ball', '#a29979', [10, 7, 10], [0, 59, 12]);
      for (const side of [-1, 1]) {
        m(bear, 'ball', dark, [5, 5, 5], [side * 12, 78, 0]);
        m(bear, 'ball', '#667053', [10, 23, 10], [side * 24, 33, 2]);
        m(bear, 'box', '#aab7b2', [14, 7, 17], [side * 14, 7, 4]);
        for (let i = 0; i < 3; i++) m(bear, 'cone', ivory, [1.5, 10, 1.5], [side * 24 + (i - 1) * 4, 17, 12]).rotation.x = Math.PI / 2;
      } break;
    }
    case 'c_tequoia': {
      cape('#20503c', 35, 15); staff(right, '#65563c');
      for (const side of [-1, 1]) {
        bar(outfit, leather, [side * 5, 67, 0], [side * 13, 83, -4], 2);
        bar(outfit, leather, [side * 9, 76, -2], [side * 21, 82, -2], 1.5);
        for (let i = 0; i < 3; i++) feather(right, '#86bf6d', [side * (5 + i * 4), 34 + i * 3, 5], 9, side * .8);
      } break;
    }
    case 'c_zal':
      m(outfit, 'gem', '#e4c996', [4, 4, 1.5], [0, 72, 5]);
      for (const side of [-1, 1]) m(outfit, 'box', '#792460', [1, 3, .5], [side * 2, 72, 6]);
      staff(right, ivory); m(right, 'gem', '#ff9ce6', [6, 10, 6], [0, 40, 5], true);
      for (let i = 0; i < 6; i++) m(outfit, 'gem', ivory, [2, 4, 2], [(i - 2.5) * 4, 45 - Math.sin(i / 5 * Math.PI) * 8, 9]); break;
    case 'c_xin':
      blade(left, '#ffca6b', 35, 4); blade(right, '#ff8c46', 35, 4);
      for (let i = 0; i < 5; i++) feather(outfit, i % 2 ? '#ffb14a' : '#e76728', [(i - 2) * 4, 77, -2], 10 + i % 2 * 4, (i - 2) * .3);
      cape('#7b3022', 28, 13); break;
    case 'c_raijin': {
      crown(outfit, ivory, 3);
      ring(outfit, '#aceaf2', 26, [0, 53, -10], [0, 0, 0], true);
      for (let i = 0; i < 3; i++) { const orb = group(body, `storm-drum:${i}`); orbiters.push(orb);
        m(orb, 'rod', gold, [5, 7, 5], [0, 0, 0]); ring(orb, '#bceafa', 5, [0, 4, 0], [Math.PI / 2, 0, 0], true); }
      break;
    }
    case 'c_kaolin':
      if(!options.externalAnatomy)m(outfit, 'box', '#357e65', [18, 13, 14], [0, 63, 0]);
      crown(outfit,'#357e65',5,70);m(outfit, 'gem', '#b5f9a2', [2, 3, 1], [0, 68, 5], true);
      staff(right, '#6aa987', 75); m(right, 'gem', '#c9e7a9', [7, 17, 6], [0, 49, 5]);
      for (let i = 0; i < 3; i++) m(outfit, 'box', '#a9dcb4', [24, 1.3, 1], [0, 34 + i * 7, 9], true); break;
    case 'c_inai':
      cape('#34234d', 41, 16); staff(right, dark, 77);
      for (const side of [-1, 1]) m(right, 'gem', '#c9afff', [6, 11, 2], [side * 4, 14 + side * 27, 5], true).rotation.z = .35;
      m(outfit, 'cone', '#e0d3ee', [5, 23, 4], [0, 51, 8]).rotation.z = Math.PI;
      ring(outfit, a, 21, [0, 33, 0], [Math.PI / 2, 0, 0], true); break;
    case 'c_qiyana': {
      crown(outfit, gold, 5); const hoop = group(right, 'elemental-hoop', [0, 21, 0]);
      ring(hoop, gold, 19, [0, 0, 0]);
      ['#60c1f4', '#87ca76', '#d2af79'].forEach((color, i) => { const angle = i * Math.PI * 2 / 3;
        m(hoop, 'gem', color, [3, 5, 2], [Math.cos(angle) * 19, Math.sin(angle) * 19, 0], true); }); break;
    }
    case 'c_locke':
      cape('#272831', 44, 13); m(outfit, 'cone', '#37323b', [16, 5, 14], [0, 73, 0]);
      blade(right, '#ffd4aa', 40, 3);
      for (let i = 0; i < 3; i++) m(outfit, 'box', ivory, [4, 19, 1], [-8 + i * 8, 24, 9]).rotation.z = (i - 1) * .16; break;
    case 'c_senna':
      cape(ivory, 44, 15); gun(right, 60, 7, '#407b74');
      for (let i = 0; i < 5; i++) m(outfit, 'rod', d.hair, [2, 33 + i % 2 * 8, 2], [(i - 2) * 3, 51, -7]);
      m(right, 'gem', '#c1fff0', [2.5, 4, 2], [0, 7, 20], true); break;
    case 'c_largo': {
      m(outfit, 'ball', d.skin, [23, 22, 17], [0, 27, 0]); m(outfit, 'ball', '#c6c382', [15, 17, 8], [0, 26, 13]);
      m(outfit, 'ball', d.skin, [25, 12, 15], [0, 48, 2]);
      bar(outfit, '#414830', [-19, 47, 14], [19, 47, 14], 1.4);
      for (const side of [-1, 1]) { m(outfit, 'ball', '#a9bb64', [8, 8, 6], [side * 14, 58, 4]);
        m(outfit, 'ball', '#171f27', [3, 3, 2], [side * 14, 59, 9]);
        m(outfit, 'ball', d.skin, [10, 6, 12], [side * 19, 6, 7]); }
      m(right, 'rod', leather, [12, 13, 12], [0, -19, 9]); ring(right, gold, 12, [0, -12, 9], [Math.PI / 2, 0, 0]);
      m(outfit, 'box', '#d47c92', [5, 2, 16], [0, 46, 23]); break;
    }
    case 'c_shadowfiend': {
      m(outfit, 'gem', dark, [21, 28, 14], [0, 41, 0]); m(outfit, 'gem', '#f7798c', [9, 14, 7], [0, 43, 10], true);
      m(outfit, 'gem', '#49303c', [13, 12, 10], [0, 69, 0]);
      for (const side of [-1, 1]) {
        bar(outfit, '#402731', [side * 7, 74, 0], [side * 22, 89, -4], 4);
        const claw = group(outfit, `soul-claw:${side}`, [side * 24, 38, 0]);
        m(claw, 'ball', '#49303c', [8, 20, 8], [0, -7, 0]);
        for (let i = 0; i < 3; i++) m(claw, 'gem', '#eeafab', [2, 13, 2], [(i - 1) * 5, -28, 6]);
      }
      for (let i = 0; i < 5; i++) m(outfit, 'cone', '#523347', [6, 22, 6], [(i - 2) * 8, 13, -2 - i % 2 * 6]).rotation.z = Math.PI;
      break;
    }
    case 'c_earthshaker':
      if(!options.externalAnatomy)m(outfit, 'ball', d.hair, [16, 14, 12], [0, 62, -1]);
      workshop.totem(right);
      m(outfit, 'gem', '#d4b482', [3, 4, 1.5], [0, 43, 7]); break;
    case 'c_mirehook': {
      m(outfit, 'box', '#6a5140', [27, 27, 1], [0, 29, 10]);
      for (let i = 0; i < 4; i++) bar(outfit, ivory, [-6, 15 + i * 7, 20], [6, 18 + i * 7, 20], .7);
      const hook = group(right, 'meat-hook', [0, -18, 7]);
      ring(hook, '#8f755e', 11, [0, 3, 0]); m(hook, 'cone', steel, [3, 15, 3], [9, 15, 0]);
      for (let i = 0; i < 5; i++) ring(left, steel, 3, [0, -7 - i * 4, 4], [0, i % 2 * Math.PI / 2, 0]); break;
    }
    case 'c_nullweaver': case 'c_io': {
      const io = id === 'c_io';
      m(outfit, io ? 'ball' : 'gem', io ? '#d9faff' : '#2f204c', [io ? 12 : 15, io ? 12 : 23, io ? 12 : 13], [0, 38, 0], io);
      if (!io) { m(outfit, 'gem', '#b9a4e5', [6, 6, 2], [0, 46, 13], true);
        for (const side of [-1, 1]) m(outfit, 'leaf', '#59467e', [9, 27, 7], [side * 17, 31, 0]).rotation.z = side * .25; }
      ring(outfit, a, io ? 19 : 27, [0, 38, 0], [.6, .3, 0], true);
      for (let i = 0; i < (io ? 5 : 4); i++) { const node = group(body, `satellite:${i}`); orbiters.push(node);
        m(node, io ? 'ball' : 'gem', io ? '#d4f8ff' : '#b096e4', [io ? 3 : 5, io ? 3 : 8, io ? 3 : 4], [0, 0, 0], true); }
      break;
    }
    case 'c_voltgrip': {
      m(outfit, 'ball', '#b49b50', [23, 22, 17], [0, 35, 0]);
      m(outfit, 'ball', '#d1b861', [13, 12, 11], [0, 64, 0]);
      m(outfit, 'box', '#76e7ec', [16, 4, 2], [0, 65, 11], true);
      m(outfit, 'ball', '#294c5c', [10, 10, 3], [0, 37, 16]); ring(outfit, '#a9eff5', 8, [0, 37, 19], [0, 0, 0], true);
      for (const [arm, size] of [[left, 9], [right, 14]] as const) {
        bar(arm, '#3f4c55', [0, 0, 0], [0, -17, 5], 4);
        workshop.gauntlet(arm,'#b2974f',size/11,[0,-21,5]);
      }
      for (let i = 0; i < 3; i++) ring(outfit, a, 6 - i, [0, 75 + i * 5, -4], [Math.PI / 2, 0, 0], true); break;
    }
    case 'c_aetherbolt':
      cape('#28495c', 23, 12);workshop.gauntlet(right,gold,.55,[0,-1,5]);
      m(left, 'box', leather, [12, 13, 7], [0, -6, -2]);
      m(outfit, 'leaf', d.hair, [7, 8, 4], [0, 68, 5]).rotation.z = -.5; break;
    case 'c_corsara':
      cape('#6f293d', 39, 15); gun(left, 24, 2.4, '#b29769'); gun(right, 24, 2.4, '#b29769');
      m(outfit, 'ball', dark, [20, 3, 12], [0, 72, 0]); m(outfit, 'cone', dark, [12, 10, 11], [0, 76, -1]);
      feather(outfit, ivory, [-13, 80, -3], 15, -.6); break;
    case 'c_brewmaw':
      m(outfit, 'box', dark, [27, 25, 1], [0, 26, 11]);
      workshop.keg(right);
      m(outfit, 'cone', d.hair, [8, 20, 6], [0, 53, 5]).rotation.z = Math.PI; break;
    case 'c_wraithhook':
      cape('#234c45', 46, 19); m(outfit, 'gem', ivory, [3, 4, 1.2], [0, 72, 5]);
      staff(right, '#89af9e', 78); ring(right, '#b9ecdb', 12, [-5, 49, 5]);
      { const lantern = group(left, 'lantern', [0, -10, 7]);
        m(lantern, 'gem', '#86f4cf', [6, 12, 6], [0, 0, 0], true);
        for (const x of [-7, 7]) for (const z of [-7, 7]) bar(lantern, dark, [x, -12, z], [x, 12, z], 1.3);
        m(lantern, 'cone', steel, [11, 6, 11], [0, 15, 0]); ring(lantern,steel,3,[0,20,0]); }
      break;
    case 'c_invoker': arsenaldoElements(body, resources); break;
    case 'c_hwei':
      cape('#254d60', 42, 14); staff(right, leather, 81);
      m(right, 'cone', ivory, [6, 21, 5], [0, 55, 5]); m(right, 'ball', '#a273d9', [4, 5, 4], [0, 64, 5], true);
      m(left, 'ball', '#b4b59c', [10, 2, 8], [0, -16, 6]);
      ['#ec7856', '#93cd6a', '#6facd6'].forEach((color, i) => m(left, 'ball', color, [2, 2, 2], [-5 + i * 5, -13, 7]));
      if (!options.externalAnatomy) m(outfit, 'box', d.hair, [13, 34, 5], [0, 53, -7]); break;
    case 'c_jayce':
      cape(ivory, 34, 16); staff(right, '#7b8d99', 56);
      {const head=new THREE.Mesh(resources.geometry('mercury-hammer-head',()=>loftSurface([[-11,3.5,3.5],[-9,5,5],[-6,4,4],[6,4,4],[9,5,5],[11,3.5,3.5]],8)),resources.material(steel));head.rotation.z=Math.PI/2;head.position.set(0,28,5);right.add(head);}
      m(right, 'gem', '#b5efff', [3, 4, 3], [0, 29, 10], true);
      bar(right, '#4d657c', [-8, 28, 5], [-8, 28, 23], 2.5); break;
    case 'c_vi':
      for (const arm of [left, right])workshop.gauntlet(arm,'#697789');
      m(outfit, 'leaf', d.hair, [4, 14, 7], [0, 75, -2]).rotation.z = .3; break;
    case 'c_jinx':
      gun(right, 49, 7, '#4e6683'); // Keep the launcher's actual bore open.
      if (!options.externalAnatomy) for (const side of [-1, 1]) for (let i = 0; i < 5; i++) m(outfit, 'ball', d.hair, [3, 5, 3], [side * (8 + i), 62 - i * 10, -6]);
      for (let i = 0; i < 5; i++) m(outfit, 'rod', gold, [2, 7, 2], [-8 + i * 4, 29, 10]); break;
    case 'c_puck': {
      m(outfit, 'ball', p, [11, 8, 21], [0, 24, 0]); m(outfit, 'ball', '#b9e3da', [10, 11, 10], [0, 30, 18]);
      for (const side of [-1, 1]) { m(outfit, 'ball', '#263b52', [3, 4, 2], [side * 6, 32, 26]);
        const wing = group(outfit, `dream-wing:${side}`, [side * 8, 28, -1]); wings.push(wing);
        wing.add(new THREE.Mesh(resources.geometry(`${id}:membrane:${side}`,()=>wingMembrane(side,false)),resources.material('#a8e9df',false,true)));
        for(const end of [[side*35,11],[side*23,-16],[side*12,-28]])bar(wing,'#83cfc7',[0,0,0],[end[0],1,end[1]],.4);
        bar(outfit, '#8ee4ee', [side * 6, 37, 19], [side * 13, 48, 18], 1); }
      break;
    }
    case 'c_batrider': {
      m(outfit, 'ball', '#635244', [13, 10, 20], [0, 24, 0]); m(outfit, 'ball', '#7c6551', [9, 9, 8], [0, 27, 20]);
      for (const side of [-1, 1]) {
        const wing = group(outfit, `bat-wing:${side}`, [side * 8, 28, 0]); wings.push(wing);
        wing.add(new THREE.Mesh(resources.geometry(`${id}:membrane:${side}`,()=>wingMembrane(side,true)),resources.material('#92574c',false,true)));
        for (let i = 0; i < 3; i++) {
          bar(wing, '#534a41', [0, 0, 5], [side * 34, 0, 13 - i * 17], 1.3);
        }
        m(outfit, 'cone', '#5d4c40', [5, 15, 5], [side * 7, 40, 20]);
      }
      m(outfit, 'ball', p, [9, 13, 7], [0, 47, -2]); m(outfit, 'ball', d.skin, [7, 8, 7], [0, 64, 0]);
      m(outfit, 'ball', leather, [8, 5, 8], [0, 69, -2]);
      for (const side of [-1, 1]) ring(outfit, gold, 3.5, [side * 4, 65, 6]);
      ring(outfit, '#f2b465', 14, [16, 48, 5]); m(outfit, 'rod', '#846750', [5, 16, 5], [0, 48, -12]); break;
    }
    case 'c_bristleback':
      m(outfit, 'ball', '#8c9460', [23, 19, 20], [0, 33, -2]);
      m(outfit, 'ball', d.skin, [14, 11, 11], [0, 49, 12]); ring(outfit, gold, 4, [0, 46, 23]);
      for (let row = 0; row < 3; row++) for (let i = 0; i < 7; i++) {
        const quill = m(outfit, 'cone', i % 2 ? ivory : '#68734d', [2.5, 25 + row * 4, 2.5], [(i - 3) * 6, 48 + row * 4, -9 - row * 6]);
        quill.rotation.set(-.6 - row * .25, 0, -(i - 3) * .16);
      } break;
    case 'c_lulu': {
      m(outfit, 'cone', '#70519c', [14, 22, 13], [0, 76, -2]);
      for (let i = 0; i < 5; i++) feather(outfit, i % 2 ? a : p, [Math.sin(i) * 10, 70, Math.cos(i) * 9], 12, i * .7);
      staff(right, '#7c6d50'); m(right, 'ball', '#d2f294', [7, 7, 7], [0, 39, 5], true);
      const moth = group(body, 'moth-familiar', [-23, 66, 4]);
      for (const side of [-1, 1]) m(moth, 'leaf', '#c6d4f1', [6, 7, 1], [side * 6, 0, 0]).rotation.z = side * .5;
      m(moth, 'ball', '#ddf8a8', [2, 4, 2], [0, 0, 0], true); break;
    }
    case 'c_silencer':
      cape('#303053', 42, 15); m(outfit, 'gem', '#a7a6c7', [6, 8, 4], [0, 72, -2]);
      if(!options.externalAnatomy)m(outfit, 'box', '#363451', [9, 2, 1], [0, 64, 6]);
      m(left, 'box', ivory, [18, 29, 3], [0, -5, 8]);
      for (let i = 0; i < 4; i++) m(left, 'box', p, [11, .8, 1], [0, 5 - i * 5, 10]);
      feather(right, '#b4afe6', [0, 1, 7], 23, -.3); break;
    case 'c_wukong_lol': case 'c_monkeyking_dota': {
      const king = id === 'c_monkeyking_dota'; staff(right, king ? '#667744' : gold, king ? 92 : 83);
      for (const y of [-25, 50]) m(right, 'rod', king ? '#a7dfaa' : '#e8c983', [2.1, 4, 2.1], [0, y, 5], king);
      if (king) { crown(outfit, '#8dc589', 5); cape('#6b573c', 30, 16); }
      else m(outfit, 'box', '#d3b7ea', [30, 5, 4], [12, 48, -10]).rotation.z = .2;
      m(outfit, 'ball', '#d7b38a', [6, 4, 4], [0, 57, 6]);
      for (const side of [-1, 1]) m(outfit, 'ball', d.skin, [4, 5, 3], [side * 9, 61, 0]);
      const tail = group(outfit, 'monkey-tail', [0, 23, -8]);
      bar(tail, d.hair, [0, 0, 0], [-15, 1, -15], 2.5); bar(tail, d.hair, [-15, 1, -15], [-25, 17, -20], 2.2);
      bar(tail, d.hair, [-25, 17, -20], [-17, 25, -21], 2); break;
    }
    case 'c_stepstone':
      m(outfit, 'box', '#e4b451', [4, 39, 2], [-4, 31, 9]).rotation.z = .23;
      for (const arm of [left, right]) { m(arm, 'rod', ivory, [4, 9, 4], [0, 1, 3]); ring(arm, gold, 4, [0, 3, 3], [Math.PI / 2, 0, 0]); }
      for (const side of [-1, 1]) m(outfit, 'gem', '#9da78f', [6, 11, 5], [side * 6, 14, 5]);
      ring(outfit, gold, 5, [0, 27, 11]); break;
    case 'c_skybreaker': {
      m(outfit, 'ball', p, [18, 10, 25], [0, 24, 0]);
      m(outfit, 'ball', '#263843', [11, 5, 13], [0, 33, -4]);
      m(outfit, 'ball', '#cd9f79', [6, 7, 6], [0, 49, -5]); m(outfit, 'ball', leather, [7, 4, 7], [0, 54, -6]);
      m(outfit, 'box', '#8dd9ea', [12, 3, 2], [0, 50, 1], true);
      m(outfit, 'ball', '#755e4a', [8, 9, 6], [0, 40, -5]);
      for (const side of [-1, 1]) {
        bar(outfit, steel, [side * 10, 24, 0], [side * 30, 24, 0], 2.5);
        ring(outfit, '#4d647b', 15, [side * 30, 27, 0], [Math.PI / 2, 0, 0]);
        const rotor = group(outfit, `lift-rotor:${side}`, [side * 30, 27, 0]); rotors.push(rotor);
        for (let i = 0; i < 3; i++) m(rotor, 'box', steel, [25, 1, 3], [0, 0, 0]).rotation.y = i * Math.PI / 3;
        m(outfit, 'leaf', a, [4, 14, 2], [side * 12, 34, -24]);
      }
      const flak = group(outfit, 'flak-cannon', [0, 21, 16]);
      for (let i = 0; i < 5; i++) { const t=i*Math.PI*2/5; bar(flak, steel,
        [Math.cos(t)*4,Math.sin(t)*4,0],[Math.cos(t)*4,Math.sin(t)*4,32],1.4); }
      ring(flak, a, 6, [0, 0, 30]);
      gunship = group(outfit, 'gunship-fins');
      for (const side of [-1, 1]) m(gunship, 'leaf', a, [25, 2, 12], [side * 27, 22, -15]).rotation.y = side * .4;
      gunship.visible = false; break;
    }
    default: body.userData.fallback = true; blade(right); break;
  }

  if(!sculpt.human)addCreatureMeshDetails(outfit,id,resources,p,a);
  attachStandingCostume(body, outfit, id);
  const motionPivot = new THREE.Group(); motionPivot.name = 'motion-pivot'; motionPivot.userData.avatarPart = 'motion-pivot';
  body.add(motionPivot); motionPivot.add(outfit);
  resources.batch(body, `${id}:${p}:${a}:${options.externalAnatomy ? 'authored' : 'source'}`);
  body.scale.setScalar(d.height / 76);
  body.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(body);
  const height = Math.max(d.height, bounds.max.y + (floating ? 10 : 0)) + 8;
  body.userData.hudHeight = height;
  body.userData.assetVersion = 2;
  if (id === 'c_invoker') body.userData.artRevision = 3;
  body.userData.floating = floating;
  body.userData.avatarPart = 'avatar-root';
  outfit.userData.avatarPart = 'outfit';
  return bindAvatarModel(body, resources);
}

export function disposeAvatarRig(body: THREE.Object3D) {
  const skeletons = new Set<THREE.Skeleton>();
  body.traverse(node => { if (node instanceof THREE.SkinnedMesh) skeletons.add(node.skeleton); });
  skeletons.forEach(skeleton => skeleton.dispose());
}

/** Rebind exported node metadata after a GLB load, without retaining unit data. */
export function bindAvatarModel(body: THREE.Group, resources: AvatarModelResources, options?: { drivenByMixer?: boolean;preserveNativeMotion?:boolean }): AvatarModel {
  const id = String(body.userData.designId), height = Number(body.userData.hudHeight);
  const parts = new Map<string, THREE.Object3D>();
  body.traverse(node => { const key = node.userData.avatarPart; if (key) parts.set(key, node); });
  const left = parts.get('left-arm')!, right = parts.get('right-arm')!, outfit = parts.get('outfit')!;
  const forearms = ['ForearmL', 'ForearmR'].map(name => body.getObjectByName(name));
  const calves = ['CalfL', 'CalfR'].map(name => body.getObjectByName(name));
  const legs = [-1, 1].map(side => parts.get(`leg:${side}`)).filter(Boolean) as THREE.Object3D[];
  const orbiters = [...parts].filter(([key]) => /^(element-orb|storm-drum|satellite):/.test(key)).map(([, node]) => node);
  const rotors = [...parts].filter(([key]) => key.startsWith('lift-rotor:')).map(([, node]) => node);
  const wings = [...parts].filter(([key]) => /^(dream-wing|bat-wing):/.test(key)).map(([, node]) => node);
  const bear = parts.get('ironclaw-form'), gunship = parts.get('gunship-fins'), pivot = parts.get('motion-pivot');
  const chest = body.getObjectByName('Chest');
  const elementalColors = { ice: '#8ad9f8', wind: '#b5a4f3', fire: '#ff9960' };
  const stance = standingStance(body, id);
  const combat = combatAnimator(body, id);
  const contacts=avatarContactRig(body,id);
  const abilityForm=voltaireModelForm(body,resources);
  return { body, height, dispose: () => disposeAvatarRig(body), animate(pose, second) {
    if(options?.preserveNativeMotion){
      // Imported review clips own every transform. Only live spell colors may
      // change; contacts/recoil/orbit curves would overwrite the submitted work.
      if(id==='c_invoker'&&pose.kaelenOrbs)orbiters.forEach((orb,i)=>{
        const element=pose.kaelenOrbs?.[i]??(['ice','wind','fire'] as const)[i];
        orb.traverse(node=>{if(node instanceof THREE.Mesh)node.material=resources.material(elementalColors[element],true);});
      });
      return;
    }
    if (!options?.drivenByMixer) {
      contacts.reset();
      const walk = pose.animState === 'walk', attacking = pose.animState === 'attack', casting = pose.animState === 'cast';
      const swing = Math.sin((pose.animTimer ?? 0) * 14);
      left.rotation.x = casting ? -.7 : attacking ? -.5 : walk ? Math.sin(second * 10) * .3 : .04;
      right.rotation.x = casting ? -.85 : attacking ? -.8 + swing * .45 : walk ? -Math.sin(second * 10) * .3 : -.07;
      forearms.forEach(arm => { if (arm) arm.rotation.x = casting ? -.65 : attacking ? -.8 : -.15; });
      if (id === 'c_invoker') {
        left.rotation.z = casting ? -.32 : -.12; right.rotation.z = casting ? .4 : .16;
        if (!walk && !attacking && !casting) {
          if (forearms[0]) forearms[0].rotation.x = -.32;
          if (forearms[1]) forearms[1].rotation.x = -.42;
        }
      }
      legs.forEach((leg, i) => { leg.rotation.x = walk ? Math.sin(second * 10 + i * Math.PI) * .4 : 0; });
      calves.forEach((calf, i) => { if (calf) calf.rotation.x = walk ? Math.max(0, -Math.sin(second * 10 + i * Math.PI)) * .65 : 0; });
      body.position.y = body.userData.floating ? 8 + Math.sin(second * 2.2) * 2 : walk ? Math.abs(Math.sin(second * 10)) * 1.6 : 0;
      stance(pose, second);
      combat(pose, second);
      contacts.apply(pose,second);
    } else {
      const profile = getAvatarAnimProfile(id);
      const hipsNode = body.getObjectByName('Hips');
      const hit = pose.motionState === 'hit' ? 1 : 0;
      const death = pose.motionState === 'death' ? 1 : 0;
      const isTurn = pose.motionState === 'turnleft' || pose.motionState === 'turnright';
      const turnDir = pose.motionState === 'turnleft' ? -1 : 1;
      const turnPhase = pose.motionTime ?? 0;
      const turnWave = isTurn ? Math.sin(Math.PI * turnPhase) : 0;

      if (chest) {
        chest.rotation.x -= (pose.recoil ?? 0) * .2;
        // Per-avatar hit reaction snap on top of the Blender clip base.
        chest.rotation.z += hit * (profile.hitWeight ?? 1) * .12;
        // Per-avatar turn banking on top of the Blender clip base.
        chest.rotation.z += turnWave * turnDir * (profile.turnBank ?? 0) * .2;
      }
      if (hipsNode) {
        // Per-avatar hit displacement.
        hipsNode.position.z -= hit * (profile.hitWeight ?? 1) * 1.5;
        // Per-avatar death drop on top of the Blender clip base.
        hipsNode.position.y -= death * (profile.deathDrop ?? 22);
      }
      // Creature pivot banking for skiffs/dragons/riders.
      if (pivot && isTurn) {
        pivot.rotation.z += turnWave * turnDir * (profile.turnBank ?? 0) * .15;
      }
      contacts.apply(pose, second);
    }
    orbiters.forEach((orb, i) => {
      const angle = (pose.clipPhase===undefined?second*1.4:pose.clipPhase*Math.PI*2) + i * Math.PI * 2 / orbiters.length;
      orb.position.set(Math.cos(angle) * (id === 'c_io' ? 25 : 29), 55 + Math.sin(angle) * 11, Math.sin(angle) * 19);
      if (id === 'c_invoker') {
        const element = pose.kaelenOrbs?.[i] ?? (['ice', 'wind', 'fire'] as const)[i];
        orb.traverse(node => { if (node instanceof THREE.Mesh) node.material = resources.material(elementalColors[element], true); });
        const orbitTime=pose.clipPhase===undefined?second:pose.clipPhase*Math.PI*2;
        orb.rotation.set(Math.sin(orbitTime + i) * .3, pose.clipPhase===undefined?second*.6+i:orbitTime+i, Math.sin((pose.clipPhase===undefined?second*.7:orbitTime) + i) * .2);
      }
    });
    rotors.forEach(rotor => { rotor.rotation.y = pose.clipPhase===undefined?second * ((pose.propellaOverdriveTimer ?? 0) > 0 ? 40 : 23):pose.clipPhase*Math.PI*8; });
    wings.forEach((wing, i) => { wing.rotation.z = Math.sin(pose.clipPhase===undefined?second*7:pose.clipPhase*Math.PI*2) * .18 * (i % 2 ? -1 : 1); });
    if (bear) { bear.visible = (pose.trueFormTimer ?? 0) > 0; bear.scale.setScalar(bear.visible ? 1 : 0); outfit.visible = !bear.visible; }
    if (gunship) { gunship.visible = (pose.propellaGunshipTimer ?? 0) > 0; gunship.scale.setScalar(gunship.visible ? 1 : 0); }
    abilityForm(pose,second);
  } };
}
