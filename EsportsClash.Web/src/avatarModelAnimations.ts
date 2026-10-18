import * as THREE from 'three';
import type { AvatarModel } from './threeAvatarModels.ts';
import {COMBAT_CLIPS,combatDuration} from './avatarCombatMotion.ts';

/** Bake presentation poses into standard glTF transform/joint channels. */
export function avatarModelAnimations(model: AvatarModel): THREE.AnimationClip[] {
  const nodes: THREE.Object3D[] = [];
  model.body.traverse(node => { if (node instanceof THREE.Bone || node.userData.avatarPart) nodes.push(node); });
  const specs = COMBAT_CLIPS.map(name=>({name,state:name.toLowerCase(),duration:combatDuration(String(model.body.userData.designId),name.toLowerCase())}));
  const clips = specs.map(spec => {
    const times: number[] = [], positions = nodes.map(() => [] as number[]), rotations = nodes.map(() => [] as number[]),scales=nodes.map(()=>[] as number[]);
    for (let i = 0; i <= 24; i++) {
      const time = i / 24 * spec.duration; times.push(time);
      model.animate({animState:spec.state,motionState:spec.state,motionTime:time,animTimer:time,clipPhase:i/24},time);
      nodes.forEach((node, j) => { positions[j].push(...node.position.toArray()); rotations[j].push(...node.quaternion.toArray());scales[j].push(...node.scale.toArray()); });
    }
    const tracks: THREE.KeyframeTrack[] = [];
    const changes = (values: number[], size: number) => values.some((v, i) => Math.abs(v - values[i % size]) > .00001);
    nodes.forEach((node, i) => {
      const articulated = node instanceof THREE.Bone || ['left-arm', 'right-arm', 'leg:-1', 'leg:1'].includes(node.userData.avatarPart);
      // Constant offsets can differ between clips (idle hip shift versus walk/combat).
      // Store them explicitly so a consuming mixer cannot retain the preceding clip's pose.
      if (articulated || changes(positions[i], 3) || node === model.body) tracks.push(new THREE.VectorKeyframeTrack(`${node.uuid}.position`, times, positions[i]));
      if (articulated || changes(rotations[i], 4)) tracks.push(new THREE.QuaternionKeyframeTrack(`${node.uuid}.quaternion`, times, rotations[i]));
      if(node.userData.avatarPart?.startsWith('bowstring-')||node.userData.avatarPart==='nocked-arrow')tracks.push(new THREE.VectorKeyframeTrack(`${node.uuid}.scale`,times,scales[i]));
    });
    return new THREE.AnimationClip(spec.name, spec.duration, tracks);
  });
  model.animate({ animState: 'idle', animTimer: 0 }, 0);
  return clips;
}
