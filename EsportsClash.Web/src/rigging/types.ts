/**
 * Meshy-inspired Automated 3D Character Rigging Pipeline - Types & Contracts
 */

export type PipelineStage =
  | 'CHARACTER_GENERATED'
  | 'ASSET_VALIDATION'
  | 'AUTO_ALIGNMENT'
  | 'LANDMARK_DETECTION'
  | 'SKELETON_GENERATION'
  | 'SKINNING'
  | 'WEAPON_ATTACHMENT'
  | 'RIG_VALIDATION'
  | 'ANIMATION_SETUP'
  | 'READY'
  | 'FAILED'
  | 'NEEDS_CORRECTION';

export type LandmarkName =
  | 'root'
  | 'pelvis'
  | 'spine'
  | 'chest'
  | 'neck'
  | 'head'
  | 'left_shoulder'
  | 'left_elbow'
  | 'left_wrist'
  | 'left_hand'
  | 'right_shoulder'
  | 'right_elbow'
  | 'right_wrist'
  | 'right_hand'
  | 'left_hip'
  | 'left_knee'
  | 'left_ankle'
  | 'left_foot'
  | 'right_hip'
  | 'right_knee'
  | 'right_ankle'
  | 'right_foot';

export interface Landmark3D {
  name: LandmarkName;
  position: [number, number, number];
  confidence: number;
  isSymmetric: boolean;
  symmetricPair?: LandmarkName;
  source: 'geometric' | 'ai_prediction' | 'proportional' | 'manual';
}

export type LandmarksMap = Record<LandmarkName, Landmark3D>;

export interface AlignmentTransform {
  positionOffset: [number, number, number];
  rotationDeg: [number, number, number];
  scale: [number, number, number];
  height: number;
  centerOfMass: [number, number, number];
  forwardDirection: [number, number, number];
  confidence: number;
}

export type WeaponType =
  | 'sword'
  | 'dual_daggers'
  | 'staff'
  | 'bow'
  | 'two_handed'
  | 'gun';

export type SocketName =
  | 'right_hand_socket'
  | 'left_hand_socket'
  | 'weapon_primary'
  | 'weapon_secondary'
  | 'weapon_muzzle'
  | 'weapon_tip'
  | 'projectile_origin';

export interface WeaponSocketConfig {
  socket: SocketName;
  parentBone: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
}

export interface WeaponAssetConfig {
  weaponId: string;
  name: string;
  weaponType: WeaponType;
  primarySocket: SocketName;
  secondarySocket?: SocketName;
  gripTransform: {
    position: [number, number, number];
    rotation: [number, number, number];
    scale: [number, number, number];
  };
  tipOffset: [number, number, number];
  muzzleOffset?: [number, number, number];
  isTwoHanded?: boolean;
  supportHandSocket?: SocketName;
  attackAnimationStyle: 'slash' | 'thrust' | 'shoot' | 'bow_draw' | 'cast' | 'blunt';
}

export interface BoneDefinition {
  name: string;
  parentName?: string;
  head: [number, number, number];
  tail: [number, number, number];
  isHelper?: boolean;
}

export interface SkeletonHierarchy {
  bones: BoneDefinition[];
  rootBoneName: string;
  nativeHelpers: Record<string, string>;
}

export interface RigValidationCheck {
  id: string;
  name: string;
  passed: boolean;
  score: number;
  message: string;
  severity: 'critical' | 'warning' | 'info';
}

export interface RigValidationReport {
  overallPassed: boolean;
  checks: RigValidationCheck[];
  timestamp: string;
  metrics: {
    vertexCount: number;
    triangleCount: number;
    boneCount: number;
    unweightedVertices: number;
    maxInfluencesPerVertex: number;
    hasNaNOrInf: boolean;
    deformsUnderRotation: boolean;
    groundContactError: number;
  };
}

export interface AnimationClipMetadata {
  name: 'Idle' | 'Walk' | 'Run' | 'Attack' | 'Cast' | 'Hit' | 'Death';
  duration: number;
  fps: number;
  frameCount: number;
  isLooping: boolean;
  hasRootMotion: boolean;
}

export interface CharacterAssetBundle {
  characterId: string;
  characterGlbUri: string;
  metadataJsonUri: string;
  weapons: {
    primaryGlbUri?: string;
    secondaryGlbUri?: string;
    configs: WeaponAssetConfig[];
  };
  rig: {
    riggedGlbUri: string;
    skeletonJsonUri: string;
    landmarksJsonUri: string;
  };
  animations: {
    clips: AnimationClipMetadata[];
    glbUri?: string;
  };
}

export interface RiggingJobStatus {
  jobId: string;
  characterId: string;
  currentStage: PipelineStage;
  progressPercent: number;
  stageResults: Partial<Record<PipelineStage, {
    status: 'success' | 'failed' | 'skipped' | 'needs_correction';
    durationMs: number;
    method: 'ai_inference' | 'geometric_algorithm' | 'fallback_heuristic' | 'manual';
    summary: string;
    data?: unknown;
  }>>;
  logs: string[];
  error?: string;
  autoAdvanced: boolean;
  isComplete: boolean;
}

