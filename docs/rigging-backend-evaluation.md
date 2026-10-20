# Comprehensive Evaluation: 3D Character Rigging Solutions for MOBA Characters

This document provides a comparative technical evaluation of automated rigging backends evaluated for our automated MOBA character production pipeline, with specific focus on local execution on an **NVIDIA GeForce RTX 3060 (12 GB VRAM)**, GLB model compatibility, deformation quality, and production automation.

---

## 1. Candidate Comparison Matrix

| Evaluation Dimension | **UniRig** (VAST-AI Research) | **SkinTokens** (VAST-AI Research) | **Blender Armature & Automatic Weights** | **Pure Geometric & Harmonic Fallback Engine** |
| :--- | :--- | :--- | :--- | :--- |
| **Upstream Repository** | [github.com/VAST-AI-Research/UniRig](https://github.com/VAST-AI-Research/UniRig) | [github.com/VAST-AI-Research/SkinTokens](https://github.com/VAST-AI-Research/SkinTokens) | Official Blender (bpy 4.2 LTS / 4.5.3) | Built-in TypeScript / Three.js Engine |
| **Model Compatibility** | GLB / OBJ / FBX (reconstructed meshes up to 50k faces) | Mesh tokens / OBJ | Direct GLB / FBX / OBJ import via `bpy` | Direct `THREE.BufferGeometry` / GLTF |
| **Humanoid Support** | Excellent (humanoid, biped, quadruped) | Strong (humanoid-centric tokenization) | Full humanoid (via custom / native rig templates) | Full humanoid (18 standard joints + 6 native helpers) |
| **Skeleton Quality** | High (predicts 42 articulated joints + fingers) | High (predicts articulated hierarchy) | Deterministic; relies on anatomical template or landmark solver | Guaranteed consistent 18-bone standard hierarchy |
| **Skinning Quality** | High (neural skin-weight field prediction) | Very High (discrete skin token assignment) | Good (heat/biharmonic diff; occasional self-intersection) | Smooth Gaussian heat projection; strictly 4-weight normalized |
| **VRAM Requirement** | **8.5 GB VRAM** admission reserve (Docker VM) | **~6.5 - 8.0 GB VRAM** (PyTorch CUDA) | **0 MB GPU VRAM** (runs on CPU / shared RAM) | **0 MB GPU VRAM** (runs in WebGL / CPU worker) |
| **System RAM Requirement** | **7.1 GB VM RAM** (Docker / WSL2) | ~6 GB RAM | < 1.5 GB RAM | < 250 MB RAM |
| **Execution Time** | ~45 - 90 seconds per model | ~30 - 60 seconds per model | **< 3 - 5 seconds** per model | **< 200 milliseconds** per model |
| **Backend Integration** | Isolated Python 3.11 Docker worker (`unirig-worker:8098`) | Requires Python PyTorch service container | Headless Blender subprocess (`blender -b -P ...`) | Direct in-memory engine (Node.js & React Three Fiber) |
| **Checkpoints & Availability** | Pinned OPT-350M + 5.8 GB skeleton/skin weights (HuggingFace) | Research weights on HuggingFace | Built-in to Blender distribution (zero model download) | Zero weights / zero download required |
| **Licensing** | Apache 2.0 / Academic research check | Open-source research license | GPL v3 (Blender Foundation) | MIT / Internal proprietary game engine |
| **Local Offline Execution** | Yes, 100% offline once provisioned | Yes, offline after downloading checkpoints | Yes, completely offline | Yes, completely offline and zero dependency |

---

## 2. In-Depth Analysis of Each Candidate

### 2.1 UniRig (VAST-AI Research)
- **Strengths**:
  - Predicts both skeleton hierarchy and skin weights from raw 3D mesh geometry.
  - Automatically resolves non-standard body proportions (short brawlers, slender scouts, heavy golems).
  - Already provisioned in our local repository under `infrastructure/unirig` with frozen SHA-256 checkpoints (`model-pins.json`).
- **Constraints & Observations**:
  - **VRAM & VM Footprint**: UniRig requires 8,500 MiB free device VRAM and 7,168 MiB available WSL2/Docker RAM. On an RTX 3060 with 12 GB, running UniRig concurrently with other GPU tasks or when host memory is tight requires strict exclusive GPU locking (`visual-gpu-lease`).
  - **Helper Bone Adaptation**: UniRig outputs an arbitrary 42-bone tree. The game engine requires specific native spacer nodes (`left-arm`, `right-arm`, `leg:-1`, `leg:1`, `avatar-root`) to satisfy `standingStance` and `avatarContactRig`. A post-prediction adapter (e.g. `retarget-unirig.py`) is necessary.
  - **Interpreter Crash Sensitivity**: Upstream extraction and GLB export in Blender 4.2/4.5 can suffer segmentation faults during process shutdown unless isolated into separate subprocess steps with pinned bpy 4.2.22 LTS.

### 2.2 SkinTokens (VAST-AI Research)
- **Strengths**:
  - Formulates skinning weight prediction as discrete token sequence prediction.
  - Produces crisp boundary separation between adjacent limbs (e.g. upper arm vs torso, thighs).
- **Constraints & Observations**:
  - Upstream repository requires separate environment provisioning with specific CUDA/Torch version matching.
  - Does not generate the skeleton armature itself; requires a pre-existing skeleton or joint prediction stage.
  - Higher integration friction compared to UniRig and Blender.

### 2.3 Blender Automatic Weighting & Bone Heat Fallback
- **Strengths**:
  - Mature, robust, mathematically proven biharmonic/heat diffusion equation solver (`bpy.ops.paint.weight_from_bones`).
  - Zero VRAM consumption; runs completely on CPU in 1-3 seconds.
  - Rock-solid stability; does not depend on neural network convergence or GPU drivers.
  - Readily available in our `teamfight-avatar-tools:local` container.
- **Constraints & Observations**:
  - Requires clean manifold geometry without severe self-intersections or disjoint vertex clusters to avoid "Bone Heat Weighting: failed to find solution for one or more bones".
  - Requires a pre-constructed armature placed at anatomical joint positions.

### 2.4 Built-In Pure Geometric & Harmonic Fallback Engine
- **Strengths**:
  - Implemented in TypeScript/Three.js (`autoAlignment.ts`, `landmarkDetection.ts`, `skeletonGenerator.ts`, `skinningEngine.ts`).
  - Runs in real-time (< 200ms) directly in the browser or Node.js test environment.
  - Computes orthogonal bone segment projection with Gaussian heat falloff.
  - Guarantees 100% vertex coverage, zero unweighted vertices, strictly normalized 4-weight glTF standard.
  - Generates exact native helper nodes (`avatar-root`, `left-arm`, `right-arm`, `leg:-1`, `leg:1`, `right-grip`) ensuring zero runtime errors in `standingStance`.
  - Enables instant visual feedback in the Meshy-style alignment and landmark editor without waiting for GPU queue slots.

---

## 3. Recommended Hybrid Production Architecture

We adopt a **dual-tier autonomous pipeline**:
1. **Interactive & Rapid Tier (Geometric & Three.js Pipeline)**:
   - Executes immediately during character preview, alignment, landmark detection, and initial rig generation.
   - Provides instant 3D landmark marker positioning, real-time symmetry mirroring, and immediate deformation preview in the browser.
2. **Deep Neural Tier (UniRig Worker)**:
   - Triggered for high-fidelity offline production assets when GPU lease is available.
   - Outputs are qualified through the same 10-point automated rig validation suite.
   - If UniRig encounters VRAM pressure or is unavailable, the pipeline smoothly falls back to the deterministic geometric engine without interrupting gameplay or pipeline execution.

