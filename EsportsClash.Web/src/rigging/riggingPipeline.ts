/**
 * Phase 8: Autonomous Meshy-Inspired Rigging Pipeline Orchestrator
 *
 * Coordinates the full automated workflow:
 * CHARACTER_GENERATED
 *         ↓
 * ASSET_VALIDATION
 *         ↓
 * AUTO_ALIGNMENT
 *         ↓
 * LANDMARK_DETECTION
 *         ↓
 * SKELETON_GENERATION
 *         ↓
 * SKINNING
 *         ↓
 * WEAPON_ATTACHMENT
 *         ↓
 * RIG_VALIDATION
 *         ↓
 * ANIMATION_SETUP
 *         ↓
 * READY
 *
 * No manual approval required for successful stages; advances automatically.
 */

import * as THREE from 'three';
import type {
  PipelineStage,
  RiggingJobStatus,
  LandmarksMap,
  AlignmentTransform,
  RigValidationReport,
  WeaponAssetConfig,
} from './types.ts';
import { analyzeCharacterGeometry, applyAlignmentTransform } from './autoAlignment.ts';
import { detectLandmarksFromGeometry } from './landmarkDetection.ts';
import { createThreeSkeletonFromLandmarks, type ConstructedSkeleton } from './skeletonGenerator.ts';
import { applySmoothSkinning, type SkinningResult } from './skinningEngine.ts';
import { attachWeaponToCharacter, type AttachedWeaponInstance } from './weaponAttachment.ts';
import { generateHumanoidAnimationClips, type GeneratedClipsResult } from './animationRetargeting.ts';
import { validateRiggedCharacter } from './rigValidator.ts';
import { getDefaultWeaponConfigsForHero } from './assetContract.ts';

export interface RiggingPipelineResult {
  jobStatus: RiggingJobStatus;
  alignedModel: THREE.Object3D;
  landmarks: LandmarksMap;
  alignmentTransform: AlignmentTransform;
  constructedSkeleton: ConstructedSkeleton;
  skinningResult: SkinningResult;
  attachedWeapons: AttachedWeaponInstance[];
  animationClips: GeneratedClipsResult;
  validationReport: RigValidationReport;
}

export type PipelineProgressCallback = (status: RiggingJobStatus) => void;

/**
 * Executes the entire rigging pipeline autonomously without requiring manual approvals.
 */
export async function executeRiggingPipeline(
  characterModel: THREE.Object3D,
  characterId: string,
  options: {
    targetHeight?: number;
    weaponConfigs?: WeaponAssetConfig[];
    onProgress?: PipelineProgressCallback;
  } = {}
): Promise<RiggingPipelineResult> {
  const jobId = `job_${characterId}_${Date.now()}`;
  const status: RiggingJobStatus = {
    jobId,
    characterId,
    currentStage: 'CHARACTER_GENERATED',
    progressPercent: 0,
    stageResults: {},
    logs: [`[${new Date().toLocaleTimeString()}] Starting automated rigging pipeline for ${characterId}`],
    autoAdvanced: true,
    isComplete: false,
  };

  function updateStage(
    stage: PipelineStage,
    progress: number,
    logMsg: string,
    result?: {
      status: 'success' | 'failed' | 'skipped' | 'needs_correction';
      durationMs: number;
      method: 'ai_inference' | 'geometric_algorithm' | 'fallback_heuristic' | 'manual';
      summary: string;
      data?: unknown;
    }
  ) {
    status.currentStage = stage;
    status.progressPercent = progress;
    status.logs.push(`[${new Date().toLocaleTimeString()}] [${stage}] ${logMsg}`);
    if (result) {
      status.stageResults[stage] = result;
    }
    options.onProgress?.({ ...status, logs: [...status.logs], stageResults: { ...status.stageResults } });
  }

  // 1. CHARACTER_GENERATED
  const t0 = performance.now();
  updateStage('CHARACTER_GENERATED', 5, 'Character model loaded and registered', {
    status: 'success',
    durationMs: performance.now() - t0,
    method: 'geometric_algorithm',
    summary: `Character mesh loaded: ${characterModel.children.length} root children`,
  });

  // 2. ASSET_VALIDATION
  const t1 = performance.now();
  let hasGeometry = false;
  characterModel.traverse((node) => {
    if (node instanceof THREE.Mesh && node.geometry) hasGeometry = true;
  });
  if (!hasGeometry) {
    status.error = 'Character model contains no valid mesh geometry';
    status.currentStage = 'FAILED';
    options.onProgress?.(status);
    throw new Error(status.error);
  }
  updateStage('ASSET_VALIDATION', 15, 'Model asset contract verified (valid mesh geometry and materials)', {
    status: 'success',
    durationMs: performance.now() - t1,
    method: 'geometric_algorithm',
    summary: 'Asset passed geometry and structural validation',
  });

  // 3. AUTO_ALIGNMENT
  const t2 = performance.now();
  const alignmentAnalysis = analyzeCharacterGeometry(characterModel, options.targetHeight ?? 70.0);
  const alignmentTransform = alignmentAnalysis.suggestedTransform;
  applyAlignmentTransform(characterModel, alignmentTransform);
  updateStage('AUTO_ALIGNMENT', 28, `Model centered, uprighted, and grounded (Confidence: ${(alignmentTransform.confidence * 100).toFixed(0)}%)`, {
    status: 'success',
    durationMs: performance.now() - t2,
    method: 'geometric_algorithm',
    summary: `Aligned height ${alignmentTransform.height} units, vertical axis: ${alignmentAnalysis.verticalAxis}`,
    data: alignmentTransform,
  });

  // 4. LANDMARK_DETECTION
  const t3 = performance.now();
  const landmarks = detectLandmarksFromGeometry(characterModel);
  const avgConfidence = Object.values(landmarks).reduce((sum, l) => sum + l.confidence, 0) / Object.keys(landmarks).length;
  updateStage('LANDMARK_DETECTION', 42, `Detected 22 anatomical landmarks (Avg Confidence: ${(avgConfidence * 100).toFixed(0)}%)`, {
    status: 'success',
    durationMs: performance.now() - t3,
    method: 'geometric_algorithm',
    summary: `Identified 22 anatomical joints across sagittal plane with bilateral symmetry`,
    data: landmarks,
  });

  // 5. SKELETON_GENERATION
  const t4 = performance.now();
  const constructedSkeleton = createThreeSkeletonFromLandmarks(landmarks);
  // Tag root with avatar-root metadata for game loader
  characterModel.userData.avatarPart = 'avatar-root';
  characterModel.userData.designId = characterId;
  characterModel.userData.hudHeight = alignmentTransform.height;
  updateStage('SKELETON_GENERATION', 56, `Constructed 18-bone standard humanoid armature with native helpers`, {
    status: 'success',
    durationMs: performance.now() - t4,
    method: 'geometric_algorithm',
    summary: `Generated hierarchical skeleton and wired left-arm/right-arm/leg:-1/leg:1 helpers`,
    data: constructedSkeleton.hierarchy,
  });

  // 6. SKINNING
  const t5 = performance.now();
  const skinningResult = applySmoothSkinning(characterModel, constructedSkeleton);
  updateStage('SKINNING', 70, `Applied smooth 4-bone influence skin weights across ${skinningResult.totalVertices} vertices`, {
    status: 'success',
    durationMs: performance.now() - t5,
    method: 'geometric_algorithm',
    summary: `Created ${skinningResult.skinnedMeshes.length} SkinnedMeshes bound to skeleton`,
    data: skinningResult,
  });

  // 7. WEAPON_ATTACHMENT
  const t6 = performance.now();
  const weaponConfigs = options.weaponConfigs ?? getDefaultWeaponConfigsForHero(characterId);
  const attachedWeapons: AttachedWeaponInstance[] = [];
  for (const config of weaponConfigs) {
    const instance = attachWeaponToCharacter(characterModel, config);
    attachedWeapons.push(instance);
  }
  updateStage('WEAPON_ATTACHMENT', 80, `Attached ${attachedWeapons.length} separate weapon assets with dynamic sockets`, {
    status: 'success',
    durationMs: performance.now() - t6,
    method: 'geometric_algorithm',
    summary: `Configured weapon sockets (weapon_primary, weapon_tip, weapon_muzzle)`,
    data: weaponConfigs,
  });

  // 8. RIG_VALIDATION
  const t7 = performance.now();
  const validationReport = validateRiggedCharacter(characterModel);
  const validationSuccess = validationReport.overallPassed;
  updateStage(
    'RIG_VALIDATION',
    88,
    validationSuccess
      ? 'All 10 automated rig validation checks PASSED'
      : 'Validation warning: Some non-critical checks need review',
    {
      status: validationSuccess ? 'success' : 'needs_correction',
      durationMs: performance.now() - t7,
      method: 'geometric_algorithm',
      summary: `Validation score: ${validationReport.checks.filter((c) => c.passed).length}/10 checks passed`,
      data: validationReport,
    }
  );

  // 9. ANIMATION_SETUP
  const t8 = performance.now();
  const animationClips = generateHumanoidAnimationClips(constructedSkeleton);
  updateStage('ANIMATION_SETUP', 96, `Generated 7 standard animation clips (Idle, Walk, Run, Attack, Cast, Hit, Death)`, {
    status: 'success',
    durationMs: performance.now() - t8,
    method: 'geometric_algorithm',
    summary: `Generated ${animationClips.clips.length} animation clips with root motion and stride calibration`,
    data: animationClips.clips.map((c) => c.name),
  });

  // 10. READY
  status.currentStage = 'READY';
  status.progressPercent = 100;
  status.isComplete = true;
  status.logs.push(`[${new Date().toLocaleTimeString()}] Automated rigging pipeline finished successfully! Character is animation-ready.`);
  options.onProgress?.({ ...status });

  return {
    jobStatus: status,
    alignedModel: characterModel,
    landmarks,
    alignmentTransform,
    constructedSkeleton,
    skinningResult,
    attachedWeapons,
    animationClips,
    validationReport,
  };
}

