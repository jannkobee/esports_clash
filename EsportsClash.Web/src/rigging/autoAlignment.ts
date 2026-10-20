/**
 * Phase 2: Meshy-Style 3D Character Alignment Engine
 *
 * Geometric analysis, automatic bounding box calculation, vertical axis determination,
 * scale normalization, ground plane alignment, horizontal centering, and forward-facing
 * orientation estimation with confidence scoring.
 */

import * as THREE from 'three';
import type { AlignmentTransform } from './types.ts';

export interface AlignmentAnalysis {
  bounds: THREE.Box3;
  size: THREE.Vector3;
  center: THREE.Vector3;
  suggestedTransform: AlignmentTransform;
  verticalAxis: 'X' | 'Y' | 'Z';
  isGrounded: boolean;
  isCentered: boolean;
  facesForward: boolean;
}

/**
 * Analyzes a 3D character mesh or group to calculate optimal alignment transforms.
 */
export function analyzeCharacterGeometry(
  root: THREE.Object3D,
  targetHeight = 70.0 // Standard MOBA hero units
): AlignmentAnalysis {
  root.updateMatrixWorld(true);

  // Compute inverse of root matrix so all bounds are in root's local coordinate frame
  const rootInv = root.matrixWorld.clone().invert();

  // 1. Calculate bounding box from all mesh geometries in root's local space
  const bounds = new THREE.Box3();
  let hasVertices = false;
  const tempV = new THREE.Vector3();
  const localMat = new THREE.Matrix4();

  root.traverse((node) => {
    if (node instanceof THREE.Mesh && node.geometry) {
      const geo = node.geometry;
      const pos = geo.attributes.position;
      if (pos && pos.count > 0) {
        hasVertices = true;
        localMat.multiplyMatrices(rootInv, node.matrixWorld);
        const step = Math.max(1, Math.floor(pos.count / 1000));
        for (let i = 0; i < pos.count; i += step) {
          tempV.fromBufferAttribute(pos, i).applyMatrix4(localMat);
          if (Number.isFinite(tempV.x) && Number.isFinite(tempV.y) && Number.isFinite(tempV.z)) {
            bounds.expandByPoint(tempV);
          }
        }
      }
    }
  });

  if (!hasVertices || bounds.isEmpty()) {
    bounds.set(new THREE.Vector3(-10, 0, -10), new THREE.Vector3(10, 70, 10));
  }

  const size = new THREE.Vector3();
  bounds.getSize(size);
  const center = new THREE.Vector3();
  bounds.getCenter(center);

  // 2. Determine vertical axis (humanoids are tallest along vertical axis)
  let verticalAxis: 'X' | 'Y' | 'Z' = 'Y';
  let rawHeight = size.y;

  if (size.z > size.y * 1.25 && size.z > size.x) {
    verticalAxis = 'Z'; // Blender/CAD Z-up model
    rawHeight = size.z;
  } else if (size.x > size.y * 1.25 && size.x > size.z) {
    verticalAxis = 'X';
    rawHeight = size.x;
  }

  // 3. Compute rotation to orient upright (Y-up)
  const rotationDeg: [number, number, number] = [0, 0, 0];
  if (verticalAxis === 'Z') {
    rotationDeg[0] = -90; // Rotate -90 on X to bring Z to Y
  } else if (verticalAxis === 'X') {
    rotationDeg[2] = 90;
  }

  // 4. Forward-facing orientation estimation
  // Analyze vertex distribution in the foot and head regions to determine if facing +Z or -Z
  let forwardConfidence = 0.85;
  let facesForward = true;

  const footVerticesZ: number[] = [];
  const headVerticesZ: number[] = [];
  const headYThreshold = bounds.min.y + rawHeight * 0.8;
  const footYThreshold = bounds.min.y + rawHeight * 0.15;

  root.traverse((node) => {
    if (node instanceof THREE.Mesh && node.geometry) {
      const pos = node.geometry.attributes.position;
      if (pos) {
        localMat.multiplyMatrices(rootInv, node.matrixWorld);
        const step = Math.max(1, Math.floor(pos.count / 500));
        for (let i = 0; i < pos.count; i += step) {
          tempV.fromBufferAttribute(pos, i).applyMatrix4(localMat);
          if (tempV.y >= headYThreshold) {
            headVerticesZ.push(tempV.z);
          } else if (tempV.y <= footYThreshold) {
            footVerticesZ.push(tempV.z);
          }
        }
      }
    }
  });

  if (footVerticesZ.length > 10) {
    // Feet typically project forward towards the toes in front (+Z)
    const avgFootZ = footVerticesZ.reduce((a, b) => a + b, 0) / footVerticesZ.length;
    const footSpan = Math.max(...footVerticesZ) - Math.min(...footVerticesZ);
    // If the feet center is behind the bounding center, model might be facing -Z
    if (avgFootZ < center.z - footSpan * 0.1) {
      facesForward = false;
      rotationDeg[1] = 180; // Flip yaw to face forward
      forwardConfidence = 0.9;
    }
  }

  // 5. Scale normalization
  const scaleFactor = rawHeight > 0.01 ? targetHeight / rawHeight : 1.0;
  const scale: [number, number, number] = [scaleFactor, scaleFactor, scaleFactor];

  // 6. Centering and Ground Alignment
  // Feet bottom at y=0, body centered on X and Z
  const positionOffset: [number, number, number] = [
    -center.x * scaleFactor,
    -bounds.min.y * scaleFactor,
    -center.z * scaleFactor,
  ];

  const isGrounded = Math.abs(bounds.min.y) < 0.1;
  const isCentered = Math.abs(center.x) < 0.2 && Math.abs(center.z) < 0.2;

  const confidence = Math.min(1.0, (forwardConfidence + (isGrounded ? 0.05 : 0) + (isCentered ? 0.05 : 0)));

  const suggestedTransform: AlignmentTransform = {
    positionOffset,
    rotationDeg,
    scale,
    height: targetHeight,
    centerOfMass: [center.x, center.y, center.z],
    forwardDirection: facesForward ? [0, 0, 1] : [0, 0, -1],
    confidence,
  };

  return {
    bounds,
    size,
    center,
    suggestedTransform,
    verticalAxis,
    isGrounded,
    isCentered,
    facesForward,
  };
}

/**
 * Applies an AlignmentTransform directly to a Three.js Object3D.
 */
export function applyAlignmentTransform(target: THREE.Object3D, transform: AlignmentTransform): void {
  target.position.set(...transform.positionOffset);
  target.rotation.set(
    THREE.MathUtils.degToRad(transform.rotationDeg[0]),
    THREE.MathUtils.degToRad(transform.rotationDeg[1]),
    THREE.MathUtils.degToRad(transform.rotationDeg[2])
  );
  target.scale.set(...transform.scale);
  target.updateMatrixWorld(true);
}

/**
 * Creates a standard identity alignment transform
 */
export function createDefaultAlignmentTransform(): AlignmentTransform {
  return {
    positionOffset: [0, 0, 0],
    rotationDeg: [0, 0, 0],
    scale: [1, 1, 1],
    height: 70,
    centerOfMass: [0, 35, 0],
    forwardDirection: [0, 0, 1],
    confidence: 1.0,
  };
}
