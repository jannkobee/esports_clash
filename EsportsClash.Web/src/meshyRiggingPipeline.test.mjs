import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import {
  HUMANOID_GENERATION_CONTRACT,
  buildHumanoidCharacterPrompt,
  buildSeparateWeaponPrompt,
  resolveAssetBundlePaths,
  getDefaultWeaponConfigsForHero,
} from './rigging/assetContract.ts';

import {
  analyzeCharacterGeometry,
  applyAlignmentTransform,
  createDefaultAlignmentTransform,
} from './rigging/autoAlignment.ts';

import {
  detectLandmarksFromGeometry,
  updateLandmarkPosition,
  LANDMARK_COLORS,
} from './rigging/landmarkDetection.ts';

import {
  createThreeSkeletonFromLandmarks,
  STANDARD_BONE_NAMES,
} from './rigging/skeletonGenerator.ts';

import {
  applySmoothSkinning,
} from './rigging/skinningEngine.ts';

import {
  ensureWeaponSockets,
  createProceduralWeaponMesh,
  attachWeaponToCharacter,
} from './rigging/weaponAttachment.ts';

import {
  generateHumanoidAnimationClips,
} from './rigging/animationRetargeting.ts';

import {
  validateRiggedCharacter,
} from './rigging/rigValidator.ts';

import {
  executeRiggingPipeline,
} from './rigging/riggingPipeline.ts';

// Helper to create a test humanoid mesh fixture in neutral T-pose
function createTestHumanoidMesh() {
  const root = new THREE.Group();
  root.name = 'test_character_root';

  const mat = new THREE.MeshBasicMaterial({ color: 0x999999 });

  // Torso (height: 20, center y: 45)
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(5, 4, 20, 8), mat);
  torso.name = 'torso';
  torso.position.set(0, 45, 0);
  root.add(torso);

  // Pelvis (height: 8, center y: 31)
  const pelvis = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 4, 8, 8), mat);
  pelvis.name = 'pelvis';
  pelvis.position.set(0, 31, 0);
  root.add(pelvis);

  // Head (center y: 62)
  const head = new THREE.Mesh(new THREE.SphereGeometry(4.5, 8, 8), mat);
  head.name = 'head';
  head.position.set(0, 62, 0);
  root.add(head);

  // Left Arm (+X horizontal)
  const leftArm = new THREE.Mesh(new THREE.CylinderGeometry(2, 1.8, 28, 6), mat);
  leftArm.name = 'left_arm';
  leftArm.rotation.z = Math.PI * 0.5;
  leftArm.position.set(20, 50, 0);
  root.add(leftArm);

  // Right Arm (-X horizontal)
  const rightArm = new THREE.Mesh(new THREE.CylinderGeometry(2, 1.8, 28, 6), mat);
  rightArm.name = 'right_arm';
  rightArm.rotation.z = -Math.PI * 0.5;
  rightArm.position.set(-20, 50, 0);
  root.add(rightArm);

  // Left Leg (+X, y from 0 to 27)
  const leftLeg = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 1.8, 27, 6), mat);
  leftLeg.name = 'left_leg';
  leftLeg.position.set(5, 13.5, 0);
  root.add(leftLeg);

  // Right Leg (-X, y from 0 to 27)
  const rightLeg = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 1.8, 27, 6), mat);
  rightLeg.name = 'right_leg';
  rightLeg.position.set(-5, 13.5, 0);
  root.add(rightLeg);

  root.updateMatrixWorld(true);
  return root;
}

test('Phase 1: Humanoid character asset generation contract and prompt builders', () => {
  assert.equal(HUMANOID_GENERATION_CONTRACT.pose, 'neutral_a_pose');
  assert.ok(HUMANOID_GENERATION_CONTRACT.prohibitedFeatures.includes('merged_weapons_in_body_mesh'));

  const prompt = buildHumanoidCharacterPrompt({
    name: 'Dawnna',
    role: 'Tank',
    silhouette: 'Solar crest plate',
    costume: 'Amber battle robes',
    skinColor: '#b9805d',
    hairColor: '#8f4b2c',
    anatomy: 'broad athletic adult humanoid biped',
  });
  assert.ok(prompt.includes('STRICT ANATOMICAL A-POSE'));
  assert.ok(!prompt.includes('Solar crest plate'));
  assert.ok(!prompt.includes('Amber battle robes'));
  assert.ok(!prompt.includes('#b9805d'));
  assert.ok(prompt.includes('NO MERGED WEAPONS'));
  assert.ok(prompt.includes('LEGS SEPARATED'));

  const weaponPrompt = buildSeparateWeaponPrompt({
    heroName: 'Dawnna',
    weaponType: 'long sunblade',
    description: 'Golden radiant sword',
    signatureStyle: 'Amber core glow',
  });
  assert.ok(weaponPrompt.includes('ISOLATED ASSET'));
  assert.ok(weaponPrompt.includes('Centered at world origin'));

  const paths = resolveAssetBundlePaths('c_solana');
  assert.ok(paths.characterGlbUri.includes('c_solana/character.glb'));
  assert.ok(paths.weapons.primaryGlbUri.includes('weapons/primary.glb'));
  assert.ok(paths.rig.riggedGlbUri.includes('rig/rigged-character.glb'));
});

test('A-pose arm landmarks follow lowered geometry rather than the torso slice', () => {
  const root=createTestHumanoidMesh();
  for(const [name,sign] of [['left_arm',1],['right_arm',-1]]) {
    const arm=root.getObjectByName(name);
    const pivot=new THREE.Vector3(sign*6,50,0);
    const rotation=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),-sign*Math.PI/4);
    arm.position.sub(pivot).applyQuaternion(rotation).add(pivot);
    arm.quaternion.premultiply(rotation);
  }
  const landmarks=detectLandmarksFromGeometry(root);
  for(const side of ['left','right']) {
    assert.ok(landmarks[side+'_shoulder'].position[1]>landmarks[side+'_elbow'].position[1]);
    assert.ok(landmarks[side+'_elbow'].position[1]>landmarks[side+'_wrist'].position[1]);
    assert.ok(landmarks[side+'_wrist'].position[1]>landmarks[side+'_hand'].position[1]);
  }
});

test('Phase 2: Auto-alignment calculates bounding box, centers, grounds feet, and estimates orientation', () => {
  const model = createTestHumanoidMesh();
  // Introduce offset
  model.position.set(12, 10, -8);
  model.updateMatrixWorld(true);

  const analysis = analyzeCharacterGeometry(model, 70);
  assert.equal(analysis.verticalAxis, 'Y');
  assert.ok(analysis.suggestedTransform.height === 70);
  assert.ok(analysis.suggestedTransform.confidence >= 0.7);

  // Apply alignment
  applyAlignmentTransform(model, analysis.suggestedTransform);
  model.updateMatrixWorld(true);

  const postBox = new THREE.Box3().setFromObject(model);
  assert.ok(Math.abs(postBox.min.y) < 1.0, `Feet should be grounded near Y=0, got ${postBox.min.y}`);
  assert.ok(Math.abs((postBox.min.x + postBox.max.x) * 0.5) < 1.0, 'Model should be horizontally centered on X');
});

test('Phase 3: Automatic anatomical joint detection identifies all 22 landmarks with sagittal symmetry', () => {
  const model = createTestHumanoidMesh();
  const landmarks = detectLandmarksFromGeometry(model);

  assert.ok(landmarks.head, 'Head landmark exists');
  assert.ok(landmarks.neck, 'Neck landmark exists');
  assert.ok(landmarks.chest, 'Chest landmark exists');
  assert.ok(landmarks.pelvis, 'Pelvis landmark exists');
  assert.ok(landmarks.left_shoulder, 'Left shoulder exists');
  assert.ok(landmarks.right_shoulder, 'Right shoulder exists');
  assert.ok(landmarks.left_elbow, 'Left elbow exists');
  assert.ok(landmarks.right_elbow, 'Right elbow exists');
  assert.ok(landmarks.left_wrist, 'Left wrist exists');
  assert.ok(landmarks.right_wrist, 'Right wrist exists');
  assert.ok(landmarks.left_knee, 'Left knee exists');
  assert.ok(landmarks.right_knee, 'Right knee exists');
  assert.ok(landmarks.left_ankle, 'Left ankle exists');
  assert.ok(landmarks.right_ankle, 'Right ankle exists');

  // Verify head is higher than pelvis and knees
  assert.ok(landmarks.head.position[1] > landmarks.chest.position[1]);
  assert.ok(landmarks.chest.position[1] > landmarks.pelvis.position[1]);
  assert.ok(landmarks.pelvis.position[1] > landmarks.left_knee.position[1]);
  assert.ok(landmarks.left_knee.position[1] > landmarks.left_ankle.position[1]);

  // Bilateral symmetry test: left arm (+X) and right arm (-X) have mirrored X coordinates
  assert.ok(landmarks.left_wrist.position[0] > 0);
  assert.ok(landmarks.right_wrist.position[0] < 0);

  // Manual update with symmetry mirror test
  const updated = updateLandmarkPosition(landmarks, 'left_elbow', [28, 50, 0], true);
  assert.equal(updated.left_elbow.position[0], 28);
  assert.equal(updated.right_elbow.position[0], -28);
});

test('Phase 4: Skeleton hierarchy construction and smooth 4-weight vertex skinning', () => {
  const model = createTestHumanoidMesh();
  const landmarks = detectLandmarksFromGeometry(model);
  const constructed = createThreeSkeletonFromLandmarks(landmarks);

  assert.equal(constructed.bones.length, STANDARD_BONE_NAMES.length);
  assert.ok(constructed.boneMap.has('Root'));
  assert.ok(constructed.boneMap.has('Hips'));
  assert.ok(constructed.boneMap.has('Spine'));
  assert.ok(constructed.boneMap.has('Chest'));
  assert.ok(constructed.boneMap.has('UpperArmL'));
  assert.ok(constructed.boneMap.has('UpperArmR'));

  // Verify native game helpers are attached
  assert.ok(constructed.helpers.has('left-arm'));
  assert.ok(constructed.helpers.has('right-arm'));
  assert.ok(constructed.helpers.has('leg:-1'));
  assert.ok(constructed.helpers.has('leg:1'));
  assert.ok(constructed.helpers.has('outfit'));

  // Skinning application
  const skinResult = applySmoothSkinning(model, constructed);
  assert.ok(skinResult.skinnedMeshes.length > 0);
  assert.ok(skinResult.totalVertices > 0);

  // Verify skin attributes
  const mesh = skinResult.skinnedMeshes[0];
  const weights = mesh.geometry.attributes.skinWeight;
  const indices = mesh.geometry.attributes.skinIndex;

  assert.equal(weights.itemSize, 4);
  assert.equal(indices.itemSize, 4);

  // Check normalization for sample vertices
  for (let i = 0; i < Math.min(20, weights.count); i++) {
    const sum = weights.getX(i) + weights.getY(i) + weights.getZ(i) + weights.getW(i);
    assert.ok(Math.abs(sum - 1.0) < 0.01, `Vertex ${i} weight sum must be 1.0, got ${sum}`);
  }
});

test('Phase 5: Automatic weapon socket configuration and procedural weapon attachment', () => {
  const model = createTestHumanoidMesh();
  const sockets = ensureWeaponSockets(model);

  assert.ok(sockets.has('right_hand_socket'));
  assert.ok(sockets.has('left_hand_socket'));

  // Attach weapon
  const weaponConfigs = getDefaultWeaponConfigsForHero('c_solana');
  const attached = attachWeaponToCharacter(model, weaponConfigs[0]);

  assert.equal(attached.config.weaponType, 'sword');
  assert.ok(attached.tipMarker);
  assert.equal(attached.tipMarker.name, 'weapon_tip');

  // Verify procedural meshes for all 6 weapon types
  const types = ['sword', 'dual_daggers', 'staff', 'bow', 'two_handed', 'gun'];
  for (const type of types) {
    const wMesh = createProceduralWeaponMesh(type, 'test');
    assert.ok(wMesh.children.length > 0, `Weapon mesh for ${type} should have parts`);
  }
});

test('Phase 6: Animation generation produces 7 standard humanoid clips with valid keyframe tracks', () => {
  const model = createTestHumanoidMesh();
  const landmarks = detectLandmarksFromGeometry(model);
  const constructed = createThreeSkeletonFromLandmarks(landmarks);

  const animResult = generateHumanoidAnimationClips(constructed);
  assert.equal(animResult.clips.length, 7);

  const clipNames = animResult.clips.map((c) => c.name);
  assert.ok(clipNames.includes('Idle'));
  assert.ok(clipNames.includes('Walk'));
  assert.ok(clipNames.includes('Run'));
  assert.ok(clipNames.includes('Attack'));
  assert.ok(clipNames.includes('Cast'));
  assert.ok(clipNames.includes('Hit'));
  assert.ok(clipNames.includes('Death'));

  for (const clip of animResult.clips) {
    assert.ok(clip.duration > 0);
    assert.ok(clip.tracks.length > 0);
    for (const track of clip.tracks) {
      assert.ok(track.times.length > 0);
      assert.ok(track.values.every(Number.isFinite));
    }
  }
});

test('Phase 7: Programmatic 10-point automated rig validation suite passes', () => {
  const model = createTestHumanoidMesh();
  const landmarks = detectLandmarksFromGeometry(model);
  const constructed = createThreeSkeletonFromLandmarks(landmarks);
  applySmoothSkinning(model, constructed);
  ensureWeaponSockets(model);

  const report = validateRiggedCharacter(model);
  assert.equal(report.checks.length, 10);
  assert.ok(report.metrics.vertexCount > 0);
  assert.equal(report.metrics.hasNaNOrInf, false);
  assert.equal(report.metrics.unweightedVertices, 0);

  const criticalFailed = report.checks.filter((c) => c.severity === 'critical' && !c.passed);
  assert.equal(criticalFailed.length, 0, `All critical checks must pass. Failures: ${criticalFailed.map((c) => c.name).join(', ')}`);
});

test('Phase 8: Autonomous end-to-end pipeline execution from raw mesh to animation-ready', async () => {
  const model = createTestHumanoidMesh();
  const stagesVisited = [];

  const result = await executeRiggingPipeline(model, 'c_solana', {
    targetHeight: 70,
    onProgress: (status) => {
      stagesVisited.push(status.currentStage);
    },
  });

  assert.equal(result.jobStatus.currentStage, 'READY');
  assert.equal(result.jobStatus.isComplete, true);
  assert.equal(result.jobStatus.progressPercent, 100);

  // Verified all stages executed autonomously
  assert.ok(stagesVisited.includes('CHARACTER_GENERATED'));
  assert.ok(stagesVisited.includes('ASSET_VALIDATION'));
  assert.ok(stagesVisited.includes('AUTO_ALIGNMENT'));
  assert.ok(stagesVisited.includes('LANDMARK_DETECTION'));
  assert.ok(stagesVisited.includes('SKELETON_GENERATION'));
  assert.ok(stagesVisited.includes('SKINNING'));
  assert.ok(stagesVisited.includes('WEAPON_ATTACHMENT'));
  assert.ok(stagesVisited.includes('RIG_VALIDATION'));
  assert.ok(stagesVisited.includes('ANIMATION_SETUP'));
  assert.ok(stagesVisited.includes('READY'));

  // Result contracts intact
  assert.ok(result.validationReport.overallPassed);
  assert.equal(result.animationClips.clips.length, 7);
  assert.equal(result.attachedWeapons.length, 1);
});

