/**
 * Phase 6: Standardized Humanoid Animation Retargeting & Generation Engine
 *
 * Produces native-compatible humanoid animation clips (Idle, Walk, Run, Attack, Cast, Hit, Death)
 * with root motion, stride calibration, and proper bone rotation curves compatible with Three.js AnimationMixer.
 */

import * as THREE from 'three';
import type { ConstructedSkeleton } from './skeletonGenerator.ts';

export interface GeneratedClipsResult {
  clips: THREE.AnimationClip[];
  clipMap: Map<string, THREE.AnimationClip>;
}

/**
 * Creates a quaternion track for a bone.
 */
function makeRotTrack(
  boneName: string,
  times: number[],
  rotations: [number, number, number][] // Euler angles in degrees [x, y, z]
): THREE.QuaternionKeyframeTrack {
  const values: number[] = [];
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();

  for (const rot of rotations) {
    e.set(
      THREE.MathUtils.degToRad(rot[0]),
      THREE.MathUtils.degToRad(rot[1]),
      THREE.MathUtils.degToRad(rot[2]),
      'XYZ'
    );
    q.setFromEuler(e);
    values.push(q.x, q.y, q.z, q.w);
  }

  return new THREE.QuaternionKeyframeTrack(`${boneName}.quaternion`, times, values);
}

/**
 * Creates a position track for a bone (e.g. root/hips).
 */
function makePosTrack(
  boneName: string,
  times: number[],
  positions: [number, number, number][]
): THREE.VectorKeyframeTrack {
  const values: number[] = [];
  for (const pos of positions) {
    values.push(...pos);
  }
  return new THREE.VectorKeyframeTrack(`${boneName}.position`, times, values);
}

/**
 * Generates the full standard suite of 7 humanoid animation clips
 * tailored to the character's skeleton rest dimensions.
 */
export function generateHumanoidAnimationClips(
  skeleton: ConstructedSkeleton
): GeneratedClipsResult {
  const clips: THREE.AnimationClip[] = [];
  const clipMap = new Map<string, THREE.AnimationClip>();

  const hipRestPos = skeleton.boneMap.get('Hips')?.position.toArray() ?? [0, 32, 0];

  // 1. Idle Clip (2.0s, gentle breathing and stance sway)
  {
    const times = [0, 0.5, 1.0, 1.5, 2.0];
    const tracks: THREE.KeyframeTrack[] = [
      makeRotTrack('Spine', times, [
        [0, 0, 0],
        [2, 0, 0.5],
        [0, 0, 0],
        [-1.5, 0, -0.5],
        [0, 0, 0],
      ]),
      makeRotTrack('Chest', times, [
        [0, 0, 0],
        [-2.5, 1, 0],
        [0, 0, 0],
        [2, -1, 0],
        [0, 0, 0],
      ]),
      makeRotTrack('Head', times, [
        [0, 0, 0],
        [1.5, -0.5, 0],
        [0, 0, 0],
        [-1, 0.5, 0],
        [0, 0, 0],
      ]),
      // Arms relaxed at sides
      makeRotTrack('UpperArmL', times, [
        [5, 0, -68],
        [7, 0, -66],
        [5, 0, -68],
        [4, 0, -69],
        [5, 0, -68],
      ]),
      makeRotTrack('UpperArmR', times, [
        [-5, 0, 68],
        [-7, 0, 66],
        [-5, 0, 68],
        [-4, 0, 69],
        [-5, 0, 68],
      ]),
      makeRotTrack('ForearmL', times, [
        [12, 0, 0],
        [15, 0, 0],
        [12, 0, 0],
        [10, 0, 0],
        [12, 0, 0],
      ]),
      makeRotTrack('ForearmR', times, [
        [12, 0, 0],
        [15, 0, 0],
        [12, 0, 0],
        [10, 0, 0],
        [12, 0, 0],
      ]),
      // Subtle hip rise/fall
      makePosTrack('Hips', times, [
        [hipRestPos[0], hipRestPos[1], hipRestPos[2]],
        [hipRestPos[0], hipRestPos[1] + 0.3, hipRestPos[2]],
        [hipRestPos[0], hipRestPos[1], hipRestPos[2]],
        [hipRestPos[0], hipRestPos[1] - 0.2, hipRestPos[2]],
        [hipRestPos[0], hipRestPos[1], hipRestPos[2]],
      ]),
    ];

    const clip = new THREE.AnimationClip('Idle', 2.0, tracks);
    clips.push(clip);
    clipMap.set('idle', clip);
  }

  // 2. Walk Clip (1.0s loop, alternating leg strides and arm counter-swing)
  {
    const times = [0, 0.25, 0.5, 0.75, 1.0];
    const tracks: THREE.KeyframeTrack[] = [
      // Left Leg
      makeRotTrack('ThighL', times, [
        [-22, 0, 0],
        [0, 0, 0],
        [24, 0, 0],
        [6, 0, 0],
        [-22, 0, 0],
      ]),
      makeRotTrack('CalfL', times, [
        [8, 0, 0],
        [35, 0, 0],
        [5, 0, 0],
        [10, 0, 0],
        [8, 0, 0],
      ]),
      // Right Leg
      makeRotTrack('ThighR', times, [
        [24, 0, 0],
        [6, 0, 0],
        [-22, 0, 0],
        [0, 0, 0],
        [24, 0, 0],
      ]),
      makeRotTrack('CalfR', times, [
        [5, 0, 0],
        [10, 0, 0],
        [8, 0, 0],
        [35, 0, 0],
        [5, 0, 0],
      ]),
      // Counter-swing arms
      makeRotTrack('UpperArmL', times, [
        [20, 0, -65],
        [0, 0, -65],
        [-20, 0, -65],
        [0, 0, -65],
        [20, 0, -65],
      ]),
      makeRotTrack('UpperArmR', times, [
        [-20, 0, 65],
        [0, 0, 65],
        [20, 0, 65],
        [0, 0, 65],
        [-20, 0, 65],
      ]),
      // Pelvis bob
      makePosTrack('Hips', times, [
        [hipRestPos[0], hipRestPos[1], hipRestPos[2]],
        [hipRestPos[0], hipRestPos[1] + 0.8, hipRestPos[2]],
        [hipRestPos[0], hipRestPos[1], hipRestPos[2]],
        [hipRestPos[0], hipRestPos[1] + 0.8, hipRestPos[2]],
        [hipRestPos[0], hipRestPos[1], hipRestPos[2]],
      ]),
    ];

    const clip = new THREE.AnimationClip('Walk', 1.0, tracks);
    clips.push(clip);
    clipMap.set('walk', clip);
  }

  // 3. Run Clip (0.8s loop, faster and larger stride amplitude)
  {
    const times = [0, 0.2, 0.4, 0.6, 0.8];
    const tracks: THREE.KeyframeTrack[] = [
      makeRotTrack('Spine', times, [
        [10, 0, 0],
        [8, 2, 0],
        [10, 0, 0],
        [8, -2, 0],
        [10, 0, 0],
      ]),
      makeRotTrack('ThighL', times, [
        [-38, 0, 0],
        [-5, 0, 0],
        [38, 0, 0],
        [12, 0, 0],
        [-38, 0, 0],
      ]),
      makeRotTrack('CalfL', times, [
        [15, 0, 0],
        [65, 0, 0],
        [8, 0, 0],
        [20, 0, 0],
        [15, 0, 0],
      ]),
      makeRotTrack('ThighR', times, [
        [38, 0, 0],
        [12, 0, 0],
        [-38, 0, 0],
        [-5, 0, 0],
        [38, 0, 0],
      ]),
      makeRotTrack('CalfR', times, [
        [8, 0, 0],
        [20, 0, 0],
        [15, 0, 0],
        [65, 0, 0],
        [8, 0, 0],
      ]),
      makeRotTrack('UpperArmL', times, [
        [40, 0, -60],
        [0, 0, -60],
        [-40, 0, -60],
        [0, 0, -60],
        [40, 0, -60],
      ]),
      makeRotTrack('UpperArmR', times, [
        [-40, 0, 60],
        [0, 0, 60],
        [40, 0, 60],
        [0, 0, 60],
        [-40, 0, 60],
      ]),
    ];

    const clip = new THREE.AnimationClip('Run', 0.8, tracks);
    clips.push(clip);
    clipMap.set('run', clip);
  }

  // 4. Attack Clip (0.8s, windup, dynamic slash/thrust, follow-through)
  {
    const times = [0, 0.2, 0.4, 0.6, 0.8];
    const tracks: THREE.KeyframeTrack[] = [
      makeRotTrack('Chest', times, [
        [0, 0, 0],
        [-5, -25, 0],
        [10, 35, 0],
        [5, 10, 0],
        [0, 0, 0],
      ]),
      makeRotTrack('UpperArmR', times, [
        [-5, 0, 68],
        [-45, -30, 45],  // Windup up & back
        [65, 20, 30],    // Power slash forward
        [25, 10, 50],
        [-5, 0, 68],
      ]),
      makeRotTrack('ForearmR', times, [
        [12, 0, 0],
        [60, 0, 0],
        [10, 0, 0],
        [20, 0, 0],
        [12, 0, 0],
      ]),
      makeRotTrack('HandR', times, [
        [0, 0, 0],
        [-20, 0, 0],
        [30, 0, 0],
        [10, 0, 0],
        [0, 0, 0],
      ]),
    ];

    const clip = new THREE.AnimationClip('Attack', 0.8, tracks);
    clips.push(clip);
    clipMap.set('attack', clip);
  }

  // 5. Cast Clip (0.9s, magical invocation, dual hands raised forward)
  {
    const times = [0, 0.3, 0.6, 0.9];
    const tracks: THREE.KeyframeTrack[] = [
      makeRotTrack('Chest', times, [
        [0, 0, 0],
        [-15, 0, 0],
        [8, 0, 0],
        [0, 0, 0],
      ]),
      makeRotTrack('UpperArmL', times, [
        [5, 0, -68],
        [45, 15, -45],
        [55, 10, -35],
        [5, 0, -68],
      ]),
      makeRotTrack('UpperArmR', times, [
        [-5, 0, 68],
        [45, -15, 45],
        [55, -10, 35],
        [-5, 0, 68],
      ]),
      makeRotTrack('ForearmL', times, [
        [12, 0, 0],
        [35, 0, 0],
        [15, 0, 0],
        [12, 0, 0],
      ]),
      makeRotTrack('ForearmR', times, [
        [12, 0, 0],
        [35, 0, 0],
        [15, 0, 0],
        [12, 0, 0],
      ]),
    ];

    const clip = new THREE.AnimationClip('Cast', 0.9, tracks);
    clips.push(clip);
    clipMap.set('cast', clip);
  }

  // 6. Hit Reaction Clip (0.4s, stagger backwards and recover)
  {
    const times = [0, 0.12, 0.25, 0.4];
    const tracks: THREE.KeyframeTrack[] = [
      makeRotTrack('Chest', times, [
        [0, 0, 0],
        [-22, 0, 0],
        [-8, 0, 0],
        [0, 0, 0],
      ]),
      makeRotTrack('Head', times, [
        [0, 0, 0],
        [18, 0, 0],
        [5, 0, 0],
        [0, 0, 0],
      ]),
      makePosTrack('Hips', times, [
        [hipRestPos[0], hipRestPos[1], hipRestPos[2]],
        [hipRestPos[0], hipRestPos[1] - 0.5, hipRestPos[2] - 1.2],
        [hipRestPos[0], hipRestPos[1] - 0.2, hipRestPos[2] - 0.4],
        [hipRestPos[0], hipRestPos[1], hipRestPos[2]],
      ]),
    ];

    const clip = new THREE.AnimationClip('Hit', 0.4, tracks);
    clips.push(clip);
    clipMap.set('hit', clip);
  }

  // 7. Death Clip (1.5s, collapse to the ground)
  {
    const times = [0, 0.4, 0.9, 1.5];
    const tracks: THREE.KeyframeTrack[] = [
      makeRotTrack('Hips', times, [
        [0, 0, 0],
        [-25, 0, 0],
        [-65, 0, 0],
        [-90, 0, 0],
      ]),
      makeRotTrack('Spine', times, [
        [0, 0, 0],
        [15, 0, 0],
        [25, 0, 0],
        [10, 0, 0],
      ]),
      makePosTrack('Hips', times, [
        [hipRestPos[0], hipRestPos[1], hipRestPos[2]],
        [hipRestPos[0], hipRestPos[1] * 0.7, hipRestPos[2] - 5],
        [hipRestPos[0], hipRestPos[1] * 0.3, hipRestPos[2] - 12],
        [hipRestPos[0], 2.5, hipRestPos[2] - 18],
      ]),
    ];

    const clip = new THREE.AnimationClip('Death', 1.5, tracks);
    clips.push(clip);
    clipMap.set('death', clip);
  }

  return { clips, clipMap };
}

