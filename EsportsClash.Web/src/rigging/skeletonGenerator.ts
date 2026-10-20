/**
 * Phase 4: Standardized Humanoid Skeleton Construction Engine
 *
 * Generates an animation-ready hierarchical skeleton from detected 3D landmarks,
 * adhering to the game's humanoid runtime contract and preserving native spacer/helper nodes.
 */

import * as THREE from 'three';
import type { LandmarksMap, SkeletonHierarchy, BoneDefinition } from './types.ts';

export const STANDARD_BONE_NAMES = [
  'Root',
  'Hips',
  'Spine',
  'Chest',
  'Neck',
  'Head',
  'UpperArmL',
  'ForearmL',
  'HandL',
  'UpperArmR',
  'ForearmR',
  'HandR',
  'ThighL',
  'CalfL',
  'FootL',
  'ThighR',
  'CalfR',
  'FootR',
] as const;

export type StandardBoneName = (typeof STANDARD_BONE_NAMES)[number];

export interface ConstructedSkeleton {
  rootBone: THREE.Bone;
  bones: THREE.Bone[];
  skeleton: THREE.Skeleton;
  boneMap: Map<string, THREE.Bone>;
  hierarchy: SkeletonHierarchy;
  helpers: Map<string, THREE.Object3D>;
}

/**
 * Builds bone definitions connecting landmarks into a rigid tree.
 */
export function buildBoneDefinitionsFromLandmarks(landmarks: LandmarksMap): BoneDefinition[] {
  const L = (name: keyof LandmarksMap): [number, number, number] => landmarks[name].position;

  return [
    { name: 'Root', head: L('root'), tail: L('pelvis') },
    { name: 'Hips', parentName: 'Root', head: L('pelvis'), tail: L('spine') },
    { name: 'Spine', parentName: 'Hips', head: L('spine'), tail: L('chest') },
    { name: 'Chest', parentName: 'Spine', head: L('chest'), tail: L('neck') },
    { name: 'Neck', parentName: 'Chest', head: L('neck'), tail: L('head') },
    { name: 'Head', parentName: 'Neck', head: L('head'), tail: [L('head')[0], L('head')[1] + 6, L('head')[2]] },

    // Left Arm
    { name: 'UpperArmL', parentName: 'Chest', head: L('left_shoulder'), tail: L('left_elbow') },
    { name: 'ForearmL', parentName: 'UpperArmL', head: L('left_elbow'), tail: L('left_wrist') },
    { name: 'HandL', parentName: 'ForearmL', head: L('left_wrist'), tail: L('left_hand') },

    // Right Arm
    { name: 'UpperArmR', parentName: 'Chest', head: L('right_shoulder'), tail: L('right_elbow') },
    { name: 'ForearmR', parentName: 'UpperArmR', head: L('right_elbow'), tail: L('right_wrist') },
    { name: 'HandR', parentName: 'ForearmR', head: L('right_wrist'), tail: L('right_hand') },

    // Left Leg
    { name: 'ThighL', parentName: 'Hips', head: L('left_hip'), tail: L('left_knee') },
    { name: 'CalfL', parentName: 'ThighL', head: L('left_knee'), tail: L('left_ankle') },
    { name: 'FootL', parentName: 'CalfL', head: L('left_ankle'), tail: L('left_foot') },

    // Right Leg
    { name: 'ThighR', parentName: 'Hips', head: L('right_hip'), tail: L('right_knee') },
    { name: 'CalfR', parentName: 'ThighR', head: L('right_knee'), tail: L('right_ankle') },
    { name: 'FootR', parentName: 'CalfR', head: L('right_ankle'), tail: L('right_foot') },
  ];
}

/**
 * Instantiates real Three.js THREE.Bone instances and wires the hierarchical skeleton.
 * Also adds the required native helper nodes ('left-arm', 'right-arm', 'leg:-1', 'leg:1', 'outfit')
 * to ensure 100% backward compatibility with standingStance and avatarContactRig.
 */
export function createThreeSkeletonFromLandmarks(landmarks: LandmarksMap): ConstructedSkeleton {
  const definitions = buildBoneDefinitionsFromLandmarks(landmarks);
  const boneMap = new Map<string, THREE.Bone>();
  const helpers = new Map<string, THREE.Object3D>();

  // 1. Create all bones
  for (const def of definitions) {
    const bone = new THREE.Bone();
    bone.name = def.name;
    boneMap.set(def.name, bone);
  }

  // 2. Establish hierarchy and compute local transforms
  const rootBone = boneMap.get('Root')!;
  rootBone.position.set(...landmarks.root.position);

  for (const def of definitions) {
    const bone = boneMap.get(def.name)!;
    if (def.parentName) {
      const parentBone = boneMap.get(def.parentName)!;
      parentBone.add(bone);
      // Local position relative to parent head
      const parentHead = landmarks[getLandmarkKeyForBone(def.parentName)]?.position ?? [0, 0, 0];
      bone.position.set(
        def.head[0] - parentHead[0],
        def.head[1] - parentHead[1],
        def.head[2] - parentHead[2]
      );
    }
  }

  // 3. Attach native game spacer/helper nodes for runtime animation binding
  const chest = boneMap.get('Chest')!;
  const hips = boneMap.get('Hips')!;

  const leftArmHelper = new THREE.Group();
  leftArmHelper.name = 'left-arm';
  leftArmHelper.userData.avatarPart = 'left-arm';
  leftArmHelper.position.copy(boneMap.get('UpperArmL')!.position);
  chest.add(leftArmHelper);
  helpers.set('left-arm', leftArmHelper);

  const rightArmHelper = new THREE.Group();
  rightArmHelper.name = 'right-arm';
  rightArmHelper.userData.avatarPart = 'right-arm';
  rightArmHelper.position.copy(boneMap.get('UpperArmR')!.position);
  chest.add(rightArmHelper);
  helpers.set('right-arm', rightArmHelper);

  const legLeftHelper = new THREE.Group();
  legLeftHelper.name = 'leg:-1';
  legLeftHelper.userData.avatarPart = 'leg:-1';
  legLeftHelper.position.copy(boneMap.get('ThighL')!.position);
  hips.add(legLeftHelper);
  helpers.set('leg:-1', legLeftHelper);

  const legRightHelper = new THREE.Group();
  legRightHelper.name = 'leg:1';
  legRightHelper.userData.avatarPart = 'leg:1';
  legRightHelper.position.copy(boneMap.get('ThighR')!.position);
  hips.add(legRightHelper);
  helpers.set('leg:1', legRightHelper);

  const outfitGroup = new THREE.Group();
  outfitGroup.name = 'outfit';
  outfitGroup.userData.avatarPart = 'outfit';
  rootBone.add(outfitGroup);
  helpers.set('outfit', outfitGroup);

  // Weapon socket groups attached to hands
  const rightHand = boneMap.get('HandR')!;
  const rightGrip = new THREE.Group();
  rightGrip.name = 'right-grip';
  rightGrip.userData.avatarPart = 'right-grip';
  rightHand.add(rightGrip);
  helpers.set('right-grip', rightGrip);

  const leftHand = boneMap.get('HandL')!;
  const leftGrip = new THREE.Group();
  leftGrip.name = 'left-grip';
  leftGrip.userData.avatarPart = 'left-grip';
  leftHand.add(leftGrip);
  helpers.set('left-grip', leftGrip);

  // 4. Update matrices and assemble Three.js Skeleton
  rootBone.updateMatrixWorld(true);
  const orderedBones = STANDARD_BONE_NAMES.map((name) => boneMap.get(name)!);
  const skeleton = new THREE.Skeleton(orderedBones);

  const hierarchy: SkeletonHierarchy = {
    bones: definitions,
    rootBoneName: 'Root',
    nativeHelpers: {
      'left-arm': 'UpperArmL',
      'right-arm': 'UpperArmR',
      'leg:-1': 'ThighL',
      'leg:1': 'ThighR',
      'right-grip': 'HandR',
      'left-grip': 'HandL',
    },
  };

  return {
    rootBone,
    bones: orderedBones,
    skeleton,
    boneMap,
    hierarchy,
    helpers,
  };
}

function getLandmarkKeyForBone(boneName: string): keyof LandmarksMap {
  switch (boneName) {
    case 'Root': return 'root';
    case 'Hips': return 'pelvis';
    case 'Spine': return 'spine';
    case 'Chest': return 'chest';
    case 'Neck': return 'neck';
    case 'Head': return 'head';
    case 'UpperArmL': return 'left_shoulder';
    case 'ForearmL': return 'left_elbow';
    case 'HandL': return 'left_wrist';
    case 'UpperArmR': return 'right_shoulder';
    case 'ForearmR': return 'right_elbow';
    case 'HandR': return 'right_wrist';
    case 'ThighL': return 'left_hip';
    case 'CalfL': return 'left_knee';
    case 'FootL': return 'left_ankle';
    case 'ThighR': return 'right_hip';
    case 'CalfR': return 'right_knee';
    case 'FootR': return 'right_ankle';
    default: return 'root';
  }
}

