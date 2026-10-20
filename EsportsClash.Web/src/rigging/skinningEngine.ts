/**
 * Phase 4: Smooth Vertex Skinning Engine
 *
 * Computes anatomical bone-influence weights via bone-segment orthogonal projection
 * and Gaussian-heat distance falloff, enforces max 4 influences per vertex, normalizes
 * weights strictly to 1.0, and binds a true THREE.SkinnedMesh that deforms in real-time.
 */

import * as THREE from 'three';
import type { ConstructedSkeleton } from './skeletonGenerator.ts';

export interface SkinningResult {
  skinnedMeshes: THREE.SkinnedMesh[];
  unweightedVertices: number;
  totalVertices: number;
  maxInfluences: number;
}

/**
 * Approximate influence radius for each bone type in character units
 */
const BONE_RADII: Record<string, number> = {
  Root: 15,
  Hips: 14,
  Spine: 12,
  Chest: 14,
  Neck: 7,
  Head: 9,
  UpperArmL: 6.5,
  ForearmL: 5.5,
  HandL: 4.5,
  UpperArmR: 6.5,
  ForearmR: 5.5,
  HandR: 4.5,
  ThighL: 8.5,
  CalfL: 7.0,
  FootL: 6.0,
  ThighR: 8.5,
  CalfR: 7.0,
  FootR: 6.0,
};

/**
 * Computes shortest distance from point P to line segment AB.
 */
function distanceToSegment(p: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3): number {
  const ab = new THREE.Vector3().subVectors(b, a);
  const ap = new THREE.Vector3().subVectors(p, a);
  const abLenSq = ab.lengthSq();

  if (abLenSq < 1e-6) return p.distanceTo(a);

  const t = Math.max(0, Math.min(1, ap.dot(ab) / abLenSq));
  const projection = new THREE.Vector3().copy(a).addScaledVector(ab, t);
  return p.distanceTo(projection);
}

/**
 * Applies smooth skinning weights to all mesh geometries in the hierarchy
 * and converts standard meshes into SkinnedMeshes bound to the skeleton.
 */
export function applySmoothSkinning(
  characterRoot: THREE.Object3D,
  constructedSkeleton: ConstructedSkeleton
): SkinningResult {
  const { skeleton, bones, hierarchy } = constructedSkeleton;

  // Build map of bone indices in skeleton
  const boneIndexMap = new Map<string, number>();
  bones.forEach((b, idx) => boneIndexMap.set(b.name, idx));

  // Compute world positions for bone heads and tails
  const boneSegments = new Map<string, { head: THREE.Vector3; tail: THREE.Vector3; radius: number }>();
  for (const def of hierarchy.bones) {
    const headV = new THREE.Vector3(...def.head);
    const tailV = new THREE.Vector3(...def.tail);
    const radius = BONE_RADII[def.name] ?? 8.0;
    boneSegments.set(def.name, { head: headV, tail: tailV, radius });
  }

  const skinnedMeshes: THREE.SkinnedMesh[] = [];
  let totalVertices = 0;
  let unweightedVertices = 0;

  // Find all standard meshes to skin
  const meshesToSkin: THREE.Mesh[] = [];
  characterRoot.traverse((node) => {
    if (node instanceof THREE.Mesh && !(node instanceof THREE.SkinnedMesh)) {
      meshesToSkin.push(node);
    }
  });

  for (const mesh of meshesToSkin) {
    const geometry = mesh.geometry.clone();
    const pos = geometry.attributes.position;
    if (!pos || pos.count === 0) continue;

    const count = pos.count;
    totalVertices += count;

    const skinIndices = new Uint16Array(count * 4);
    const skinWeights = new Float32Array(count * 4);

    const vertexWorld = new THREE.Vector3();

    for (let i = 0; i < count; i++) {
      vertexWorld.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);

      // Compute influence from each bone
      const influences: { index: number; weight: number }[] = [];

      for (const [boneName, segment] of boneSegments) {
        const boneIdx = boneIndexMap.get(boneName);
        if (boneIdx === undefined) continue;

        const dist = distanceToSegment(vertexWorld, segment.head, segment.tail);
        const r = segment.radius;

        // Gaussian heat falloff
        const heat = Math.exp(-(dist * dist) / (2 * r * r));
        if (heat > 0.001) {
          influences.push({ index: boneIdx, weight: heat });
        }
      }

      // Fallback if no bone within heat radius: pick closest bone
      if (influences.length === 0) {
        let closestBone = 0;
        let minDist = Infinity;
        for (const [boneName, segment] of boneSegments) {
          const dist = distanceToSegment(vertexWorld, segment.head, segment.tail);
          if (dist < minDist) {
            minDist = dist;
            closestBone = boneIndexMap.get(boneName) ?? 0;
          }
        }
        influences.push({ index: closestBone, weight: 1.0 });
        unweightedVertices++;
      }

      // Sort influences descending by weight
      influences.sort((a, b) => b.weight - a.weight);

      // Keep top 4
      const top4 = influences.slice(0, 4);

      // Normalize top 4 weights
      const sumWeight = top4.reduce((sum, item) => sum + item.weight, 0);
      const normalizer = sumWeight > 1e-6 ? 1.0 / sumWeight : 1.0;

      for (let j = 0; j < 4; j++) {
        const item = top4[j];
        if (item) {
          skinIndices[i * 4 + j] = item.index;
          skinWeights[i * 4 + j] = item.weight * normalizer;
        } else {
          skinIndices[i * 4 + j] = 0;
          skinWeights[i * 4 + j] = 0.0;
        }
      }
    }

    geometry.setAttribute('skinIndex', new THREE.BufferAttribute(skinIndices, 4));
    geometry.setAttribute('skinWeight', new THREE.BufferAttribute(skinWeights, 4));

    // Create SkinnedMesh with original material
    const skinnedMesh = new THREE.SkinnedMesh(geometry, mesh.material);
    skinnedMesh.name = mesh.name || 'skinned_character_mesh';
    skinnedMesh.castShadow = mesh.castShadow;
    skinnedMesh.receiveShadow = mesh.receiveShadow;
    skinnedMesh.frustumCulled = false;

    // Bind skeleton
    skinnedMesh.add(constructedSkeleton.rootBone);
    skinnedMesh.bind(skeleton, mesh.matrixWorld);

    // Replace old mesh with skinned mesh in parent
    const parent = mesh.parent ?? characterRoot;
    parent.remove(mesh);
    parent.add(skinnedMesh);

    skinnedMeshes.push(skinnedMesh);
  }

  return {
    skinnedMeshes,
    unweightedVertices,
    totalVertices,
    maxInfluences: 4,
  };
}

