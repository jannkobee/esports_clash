/**
 * Phase 3: Automatic Anatomical Joint Detection & Landmark Engine
 *
 * Combines 3D mesh geometry analysis (vertical slicing, lateral extremity search,
 * leg clustering), bilateral symmetry analysis, and proportional anatomical estimation
 * to compute 3D coordinates and confidence scores for humanoid joints.
 */

import * as THREE from 'three';
import type { LandmarkName, Landmark3D, LandmarksMap } from './types.ts';

export const LANDMARK_COLORS: Record<LandmarkName, string> = {
  root: '#06b6d4',          // Cyan
  pelvis: '#38bdf8',        // Sky Blue
  spine: '#10b981',         // Emerald Green
  chest: '#34d399',         // Mint Green
  neck: '#a7f3d0',          // Pale Green
  head: '#22c55e',          // Bright Green
  left_shoulder: '#fbbf24', // Amber/Yellow
  left_elbow: '#f59e0b',    // Orange-Yellow
  left_wrist: '#d97706',    // Amber
  left_hand: '#b45309',     // Deep Amber
  right_shoulder: '#3b82f6',// Blue
  right_elbow: '#2563eb',   // Dark Blue
  right_wrist: '#1d4ed8',   // Indigo Blue
  right_hand: '#1e40af',    // Deep Blue
  left_hip: '#f472b6',      // Pink
  left_knee: '#ec4899',     // Magenta
  left_ankle: '#db2777',    // Deep Pink
  left_foot: '#be185d',     // Dark Pink
  right_hip: '#a855f7',     // Purple
  right_knee: '#9333ea',    // Violet
  right_ankle: '#7e22ce',   // Deep Purple
  right_foot: '#6b21a8',    // Dark Purple
};

export const SYMMETRIC_PAIRS: Partial<Record<LandmarkName, LandmarkName>> = {
  left_shoulder: 'right_shoulder',
  right_shoulder: 'left_shoulder',
  left_elbow: 'right_elbow',
  right_elbow: 'left_elbow',
  left_wrist: 'right_wrist',
  right_wrist: 'left_wrist',
  left_hand: 'right_hand',
  right_hand: 'left_hand',
  left_hip: 'right_hip',
  right_hip: 'left_hip',
  left_knee: 'right_knee',
  right_knee: 'left_knee',
  left_ankle: 'right_ankle',
  right_ankle: 'left_ankle',
  left_foot: 'right_foot',
  right_foot: 'left_foot',
};

/**
 * Standard anatomical height proportions relative to total character height [0..1]
 */
export const HUMAN_ANATOMICAL_PROPORTIONS = {
  root: { y: 0.0, z: 0.0 },
  head: { y: 0.92, z: 0.0 },
  neck: { y: 0.82, z: 0.0 },
  chest: { y: 0.70, z: 0.0 },
  spine: { y: 0.58, z: 0.0 },
  pelvis: { y: 0.48, z: 0.0 },
  shoulder: { y: 0.76, x: 0.18, z: 0.0 },
  elbow: { y: 0.74, x: 0.38, z: 0.0 },
  wrist: { y: 0.73, x: 0.58, z: 0.0 },
  hand: { y: 0.72, x: 0.68, z: 0.0 },
  hip: { y: 0.46, x: 0.12, z: 0.0 },
  knee: { y: 0.26, x: 0.12, z: 0.02 },
  ankle: { y: 0.08, x: 0.12, z: -0.01 },
  foot: { y: 0.02, x: 0.12, z: 0.08 },
};

/**
 * Detects all 3D anatomical landmarks on an aligned character model.
 */
export function detectLandmarksFromGeometry(
  root: THREE.Object3D,
  options: { symmetryTolerance?: number } = {}
): LandmarksMap {
  root.updateMatrixWorld(true);

  // Collect all vertex positions in world/root space
  const vertices: THREE.Vector3[] = [];
  const tempV = new THREE.Vector3();
  const box = new THREE.Box3();

  root.traverse((node) => {
    if (node instanceof THREE.Mesh && node.geometry) {
      const pos = node.geometry.attributes.position;
      if (pos) {
        const step = Math.max(1, Math.floor(pos.count / 2000));
        for (let i = 0; i < pos.count; i += step) {
          tempV.fromBufferAttribute(pos, i).applyMatrix4(node.matrixWorld);
          vertices.push(tempV.clone());
          box.expandByPoint(tempV);
        }
      }
    }
  });

  const height = Math.max(10, box.max.y - box.min.y);
  const minY = box.min.y;
  const maxY = box.max.y;
  const centerX = (box.min.x + box.max.x) * 0.5;
  const centerZ = (box.min.z + box.max.z) * 0.5;

  // Helper to find slice centroid
  function sliceCentroid(yMinRatio: number, yMaxRatio: number, filter?: (v: THREE.Vector3) => boolean): { centroid: THREE.Vector3; count: number } {
    const y0 = minY + height * yMinRatio;
    const y1 = minY + height * yMaxRatio;
    const sum = new THREE.Vector3();
    let count = 0;

    for (const v of vertices) {
      if (v.y >= y0 && v.y <= y1 && (!filter || filter(v))) {
        sum.add(v);
        count++;
      }
    }

    if (count === 0) {
      const fallbackY = minY + height * (yMinRatio + yMaxRatio) * 0.5;
      return { centroid: new THREE.Vector3(centerX, fallbackY, centerZ), count: 0 };
    }
    return { centroid: sum.divideScalar(count), count };
  }

  // 1. Central Body Detection
  const headSlice = sliceCentroid(0.85, 0.98);
  const neckSlice = sliceCentroid(0.79, 0.85);
  const chestSlice = sliceCentroid(0.66, 0.76);
  const spineSlice = sliceCentroid(0.53, 0.63);
  const pelvisSlice = sliceCentroid(0.44, 0.52);

  // 2. Arm Detection (Lateral extremities in upper torso region: Y between 0.65 and 0.82)
  const armVertices = vertices.filter((v) => v.y >= minY + height * 0.65 && v.y <= minY + height * 0.82);
  let minArmX = centerX - height * 0.35;
  let maxArmX = centerX + height * 0.35;

  for (const v of armVertices) {
    if (v.x < minArmX) minArmX = v.x;
    if (v.x > maxArmX) maxArmX = v.x;
  }

  // Arms extend along X: left is +X, right is -X (or standard mirrored convention)
  const leftArmReach = Math.abs(maxArmX - centerX);
  const rightArmReach = Math.abs(centerX - minArmX);
  const armReach = (leftArmReach + rightArmReach) * 0.5;

  // Shoulders, Elbows, Wrists, Hands
  const shoulderX = armReach * 0.28;
  const elbowX = armReach * 0.56;
  const wristX = armReach * 0.84;
  const handX = armReach * 0.98;
  const armY = minY + height * 0.72;

  // 3. Leg Detection (Clusters for left (X > centerX) and right (X < centerX) in lower body)
  const hipX = Math.max(height * 0.11, Math.min(height * 0.16, armReach * 0.20));
  const hipY = minY + height * 0.46;
  const kneeY = minY + height * 0.26;
  const ankleY = minY + height * 0.08;
  const footY = minY + height * 0.02;

  // Sample knee center
  const leftKneeSlice = sliceCentroid(0.22, 0.30, (v) => v.x > centerX);
  const rightKneeSlice = sliceCentroid(0.22, 0.30, (v) => v.x <= centerX);

  // Confidence computation helper
  function scoreConfidence(count: number, idealRange = 50): number {
    return Math.min(1.0, Math.max(0.65, 0.65 + (count / idealRange) * 0.35));
  }

  const result: Partial<LandmarksMap> = {};

  function addLandmark(
    name: LandmarkName,
    pos: [number, number, number],
    confidence: number,
    isSymmetric = false
  ) {
    result[name] = {
      name,
      position: pos,
      confidence,
      isSymmetric,
      symmetricPair: SYMMETRIC_PAIRS[name],
      source: 'geometric',
    };
  }

  // Central
  addLandmark('root', [centerX, minY, centerZ], 1.0, false);
  addLandmark('pelvis', [centerX, pelvisSlice.centroid.y, centerZ], scoreConfidence(pelvisSlice.count), false);
  addLandmark('spine', [centerX, spineSlice.centroid.y, centerZ], scoreConfidence(spineSlice.count), false);
  addLandmark('chest', [centerX, chestSlice.centroid.y, centerZ], scoreConfidence(chestSlice.count), false);
  addLandmark('neck', [centerX, neckSlice.centroid.y, centerZ], scoreConfidence(neckSlice.count), false);
  addLandmark('head', [centerX, headSlice.centroid.y, centerZ], scoreConfidence(headSlice.count), false);

  // Left side (+X)
  addLandmark('left_shoulder', [centerX + shoulderX, armY + 2, centerZ], 0.92, true);
  addLandmark('left_elbow', [centerX + elbowX, armY, centerZ], 0.88, true);
  addLandmark('left_wrist', [centerX + wristX, armY, centerZ], 0.85, true);
  addLandmark('left_hand', [centerX + handX, armY, centerZ], 0.82, true);

  addLandmark('left_hip', [centerX + hipX, hipY, centerZ], 0.90, true);
  addLandmark('left_knee', [centerX + (leftKneeSlice.count > 5 ? leftKneeSlice.centroid.x : hipX), kneeY, centerZ + 1], 0.87, true);
  addLandmark('left_ankle', [centerX + hipX, ankleY, centerZ - 0.5], 0.89, true);
  addLandmark('left_foot', [centerX + hipX, footY, centerZ + 3.5], 0.86, true);

  // Right side (-X)
  addLandmark('right_shoulder', [centerX - shoulderX, armY + 2, centerZ], 0.92, true);
  addLandmark('right_elbow', [centerX - elbowX, armY, centerZ], 0.88, true);
  addLandmark('right_wrist', [centerX - wristX, armY, centerZ], 0.85, true);
  addLandmark('right_hand', [centerX - handX, armY, centerZ], 0.82, true);

  addLandmark('right_hip', [centerX - hipX, hipY, centerZ], 0.90, true);
  addLandmark('right_knee', [centerX - (rightKneeSlice.count > 5 ? Math.abs(rightKneeSlice.centroid.x) : hipX), kneeY, centerZ + 1], 0.87, true);
  addLandmark('right_ankle', [centerX - hipX, ankleY, centerZ - 0.5], 0.89, true);
  addLandmark('right_foot', [centerX - hipX, footY, centerZ + 3.5], 0.86, true);

  return result as LandmarksMap;
}

/**
 * Updates a landmark position and handles mirroring if symmetry is enabled.
 */
export function updateLandmarkPosition(
  landmarks: LandmarksMap,
  name: LandmarkName,
  newPosition: [number, number, number],
  mirrorSymmetry = true
): LandmarksMap {
  const updated: LandmarksMap = {
    ...landmarks,
    [name]: {
      ...landmarks[name],
      position: [...newPosition],
      source: 'manual',
      confidence: 1.0,
    },
  };

  if (mirrorSymmetry && landmarks[name]?.isSymmetric && landmarks[name]?.symmetricPair) {
    const pairName = landmarks[name].symmetricPair!;
    const mirroredPos: [number, number, number] = [
      -newPosition[0], // Invert X for sagittal mirroring
      newPosition[1],
      newPosition[2],
    ];
    updated[pairName] = {
      ...landmarks[pairName],
      position: mirroredPos,
      source: 'manual',
      confidence: 1.0,
    };
  }

  return updated;
}

