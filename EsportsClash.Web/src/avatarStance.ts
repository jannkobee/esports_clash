import * as THREE from 'three';
import { avatarDesign } from './avatarDesigns.ts';
import type { AvatarPose } from './threeAvatarModels.ts';

export function hasStandingAnatomy(id: string) {
  return ['knight', 'scout', 'robe', 'brawler', 'stone', 'monkey'].includes(avatarDesign(id)?.body ?? '');
}

/** Attach rigid costume pieces before batching, while the skeleton is still in bind pose. */
export function attachStandingCostume(body: THREE.Group, outfit: THREE.Group, id: string) {
  if (!hasStandingAnatomy(id)) return;
  body.updateMatrixWorld(true);
  const hips = body.getObjectByName('Hips')!, spine = body.getObjectByName('Spine')!;
  const chest = body.getObjectByName('Chest')!, head = body.getObjectByName('Head')!;
  for (const child of [...outfit.children]) {
    if (!(child instanceof THREE.Mesh) || child instanceof THREE.SkinnedMesh) continue;
    child.geometry.computeBoundingBox();
    const center = child.geometry.boundingBox!.getCenter(new THREE.Vector3()).applyMatrix4(child.matrix);
    const bone = child.name === 'draped-cape' ? chest : center.y >= 57 ? head : center.y < 36 ? hips : center.y < 44 ? spine : chest;
    bone.attach(child);
    if(child.name==='draped-cape'){
      const hinge=new THREE.Group();hinge.name='cape-motion';hinge.userData.avatarPart='cape-motion';bone.add(hinge);hinge.add(child);
    }
  }
  for (const child of [...outfit.children]) {
    if (child.userData.avatarPart?.startsWith('fox-tail:')) hips.attach(child);
  }
}

/** Absolute presentation transforms: repeatable at the same simulation time, with planted feet. */
export function standingStance(body: THREE.Group, id: string) {
  if (!hasStandingAnatomy(id)) return () => {};
  const hips = body.getObjectByName('Hips')!, spine = body.getObjectByName('Spine')!;
  const chest = body.getObjectByName('Chest')!, head = body.getObjectByName('Head')!;
  const arms = ['left-arm', 'right-arm'].map(name => body.getObjectByName(name)!);
  body.updateMatrixWorld(true);
  for (const arm of arms) if (arm.parent !== chest) chest.attach(arm);
  const parts = new Map<string, THREE.Object3D>();
  body.traverse(node => { if (node.userData.avatarPart) parts.set(node.userData.avatarPart, node); });
  // GLTFLoader sanitizes ':' in display names; stable exported metadata survives loading.
  const legs = [-1, 1].map(side => parts.get(`leg:${side}`)!);
  const calves = ['CalfL', 'CalfR'].map(name => body.getObjectByName(name)!);
  const feet = ['FootL', 'FootR'].map(name => body.getObjectByName(name)!);
  const hands = ['HandL', 'HandR'].map(name => body.getObjectByName(name)!);
  const forearms = ['ForearmL', 'ForearmR'].map(name => body.getObjectByName(name)!);
  const type = avatarDesign(id)!.body;
  const curve = type === 'brawler' || type === 'stone' ? .8 : type === 'scout' ? 1.05 : 1;
  return (pose: AvatarPose, second: number) => {
    const walking = pose.animState === 'walk', combat = pose.animState === 'attack' || pose.animState === 'cast';
    const settle = walking ? .35 : combat ? .55 : 1;
    const breath = Math.sin(second * 2.2) * .012;
    // Pelvis forward, lumbar forward, thorax back, head balanced over the support foot.
    hips.position.set(-.9 * settle, 32, .9 * settle);
    hips.rotation.set(.20 * curve * settle, 0, .065 * settle);
    spine.rotation.set(-.38 * curve * settle + breath, 0, -.12 * settle);
    chest.rotation.set(.18 * curve * settle - breath * .7, walking ? Math.sin(second * 10) * .035 : .035 * settle, .045 * settle);
    head.rotation.set(-.025 - breath * .3, -.035 * settle, .01 * settle);
    arms[0].rotation.z = pose.animState === 'cast' ? -.32 : -.11;
    arms[1].rotation.z = pose.animState === 'cast' ? .40 : .16;
    hands[0].rotation.set(-.06, -.1, 0); hands[1].rotation.set(-.035, .08, 0);
    if (!walking && !combat) {
      arms[0].rotation.x = -.08; arms[1].rotation.x = -.16;
      forearms[0].rotation.x = -.27; forearms[1].rotation.x = -.38;
    }
    legs.forEach((leg, i) => {
      if (!walking) {
        const bend = combat ? .16 : i ? .20 : .065;
        leg.rotation.x = -bend; calves[i].rotation.x = bend * 1.8;
        // Counter-rotate the ankle and lower the hip pivot by the leg's lost vertical reach.
        feet[i].rotation.x = -leg.rotation.x - calves[i].rotation.x;
        leg.position.y = 33 - 17 * (1 - Math.cos(bend)) - 12 * (1 - Math.cos(bend * .8));
      } else {
        leg.position.y = 33; feet[i].rotation.x = -.12;
      }
    });
  };
}
