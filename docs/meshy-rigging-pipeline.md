# Meshy-Inspired Automated 3D Character Rigging Pipeline

## 1. Executive Summary

This document specifies the architecture, implementation, and integration of our **Meshy-inspired automated 3D character rigging, alignment, skinning, weapon attachment, and animation retargeting pipeline**.

The pipeline transforms raw, unrigged 3D humanoid character models (such as those generated via TRELLIS 2, generative 3D backends, or artist submissions) into fully rigged, weighted, weapon-socketed, animation-ready characters that deform smoothly in the game engine without requiring manual approval for normal successful cases.

---

## 2. Pipeline Architecture & Workflow

The pipeline executes as an orchestrated asynchronous sequence:

```text
CHARACTER_GENERATED
        ↓
ASSET_VALIDATION
        ↓
AUTO_ALIGNMENT
        ↓
LANDMARK_DETECTION
        ↓
SKELETON_GENERATION
        ↓
SKINNING
        ↓
WEAPON_ATTACHMENT
        ↓
RIG_VALIDATION
        ↓
ANIMATION_SETUP
        ↓
READY
```

All successful stages execute automatically. No manual approval is required. If a non-critical defect is detected, the pipeline automatically attempts geometric recovery or fallback before flagging the model for optional review.

---

## 3. Detailed Phase Implementation

### Phase 1: Character Generation Requirements & Asset Contract (`assetContract.ts`)
- **Strict Anatomical Contract:**
  - Neutral T-pose: Arms extended horizontally at 90° from torso, palms facing down/forward.
  - Facing forward along primary +Z axis, Y-up upright orientation.
  - Separated legs: Minimum spacing between thighs, knees, and feet.
  - Visible joints: Unobstructed view of neck, shoulders, elbows, wrists, hips, knees, and ankles.
  - **Zero Merged Weapons:** Weapons, shields, and held props must never be physically merged into the body mesh.
- **Separate Weapon Assets:**
  - Weapons are generated as standalone 3D assets (`weapons/primary.glb`, `weapons/secondary.glb`).
  - Configurable weapon sockets with custom grip transforms (position, rotation, scale).
- **Directory Layout:**
  ```text
  characters/
    character-id/
      character.glb
      character-metadata.json
      weapons/
        primary.glb
        secondary.glb
      rig/
        rigged-character.glb
        skeleton.json
        landmarks.json
      animations/
        idle.glb
        walk.glb
        attack.glb
  ```

### Phase 2: Meshy-Style 3D Character Alignment (`autoAlignment.ts`)
- **Geometric Analysis:**
  - Evaluates mesh bounding box and principal variance to identify the vertical axis (automatically rotates Blender Z-up models by -90° on X to Three.js Y-up).
  - Scale normalization: Scales raw geometry to standard MOBA height (70 game units).
  - Ground alignment: Evaluates minimum vertex elevation in the foot region and translates the model so the bottom of the feet rests precisely at `y = 0`.
  - Centering: Translates the model horizontally so the center of mass aligns with `x = 0` and `z = 0`.
  - Forward direction estimation: Slices vertices at the head and foot regions to compute sagittal depth asymmetry. If the model faces -Z, applies a 180° yaw rotation.
  - Generates an `AlignmentTransform` record containing position offsets, Euler rotation degrees, scale factors, and an alignment confidence score.

### Phase 3: Automatic Anatomical Joint Detection (`landmarkDetection.ts`)
- **22 Standard Humanoid Landmarks:**
  - Central: `root`, `pelvis`, `spine`, `chest`, `neck`, `head`.
  - Left: `left_shoulder`, `left_elbow`, `left_wrist`, `left_hand`, `left_hip`, `left_knee`, `left_ankle`, `left_foot`.
  - Right: `right_shoulder`, `right_elbow`, `right_wrist`, `right_hand`, `right_hip`, `right_knee`, `right_ankle`, `right_foot`.
- **Hybrid Detection Algorithm:**
  - Vertical slicing: Slices geometry at height intervals (head at 85-98%, neck at 79-85%, chest at 66-76%, spine at 53-63%, pelvis at 44-52%, knees at 22-30%, ankles at 5-10%).
  - Lateral extremity analysis: Identifies arm span in the shoulder-height band to detect shoulder, elbow, wrist, and hand positions along the X-axis.
  - Leg clustering: Partitions lower-body vertices into left (X > 0) and right (X < 0) clusters to find true leg shafts and knee centroids.
  - Bilateral symmetry: Mirrored coordinates along the sagittal plane (X = -X) with confidence scoring.
  - Interactive marker editor support: Distinct colors per joint, click-and-drag 3D positioning, and a symmetry toggle for asymmetrical characters.

### Phase 4: AI-Assisted Rigging & Fallback Architecture (`skeletonGenerator.ts`, `skinningEngine.ts`, `docs/rigging-backend-evaluation.md`)
- **Backend Evaluation:**
  - Detailed evaluation comparing UniRig (neural skeleton and skin prediction requiring 8.5 GB VRAM), SkinTokens (discrete token-based skinning), Blender Automatic Weighting (biharmonic heat diffusion on CPU), and our Built-in Geometric & Harmonic Engine.
- **Skeleton Generation:**
  - Standard 18-bone humanoid armature (`Root` -> `Hips` -> `Spine` -> `Chest` -> `Neck` -> `Head`, clavicles, upper arms, forearms, hands, thighs, calves, feet).
  - Injects native runtime helper nodes (`avatar-root`, `left-arm`, `right-arm`, `leg:-1`, `leg:1`, `outfit`, `right-grip`) to ensure 100% backward compatibility with `standingStance` and `avatarContactRig`.
- **Vertex Skinning Engine:**
  - Projects each mesh vertex onto bone segments to compute orthogonal distance.
  - Applies smooth Gaussian heat falloff ($e^{-d^2 / 2r^2}$) based on bone-specific anatomical radii.
  - Restricts vertex influence to the top 4 bones (`skinIndex` and `skinWeight`).
  - Enforces strict normalization ($\sum_{j=0}^3 w_j = 1.0 \pm 10^{-4}$).
  - Binds a real `THREE.SkinnedMesh` that actively deforms when bone transforms change.

### Phase 5: Automatic Weapon Attachment & Socket System (`weaponAttachment.ts`)
- **Socket System:**
  - Standardized attachment anchors: `right_hand_socket`, `left_hand_socket`, `weapon_primary`, `weapon_secondary`, `weapon_muzzle`, `weapon_tip`, `projectile_origin`.
- **Supported Weapon Classes:**
  - One-handed sword (Sunblade)
  - Dual crescent daggers
  - Arcane staff / wand
  - Composite recurve bow
  - Two-handed greatsword / axe
  - Double-barrel flak gun
- **Modular Binding:**
  - Procedural weapon asset generators create authentic 3D weapon meshes when standalone GLBs are pending.
  - Two-handed weapon coordination tethers support hand sockets.
  - Weapon sockets track parent bones in real time and export world coordinates for VFX trails and projectile spawning.

### Phase 6: Humanoid Animation Retargeting (`animationRetargeting.ts`)
- **Standard Animation Suite:**
  - Generates 7 standard animation clips: `Idle` (2.0s loop), `Walk` (1.0s loop), `Run` (0.8s loop), `Attack` (0.8s), `Cast` (0.9s), `Hit` (0.4s), and `Death` (1.5s).
  - Generates valid `THREE.QuaternionKeyframeTrack` and `THREE.VectorKeyframeTrack` instances.
  - Preserves root motion and calibrates stride distances to character proportions.

### Phase 7: Automated 10-Point Rig Validation Suite (`rigValidator.ts`)
- Programmatic checks verify:
  1. Standard humanoid bone presence (17+ required bones).
  2. Single-root hierarchical armature structure without cyclic loops.
  3. Skinning weight coverage and normalization (sum = 1.0, 0 unweighted vertices).
  4. Transform numerical sanity (zero NaN or Infinity in matrices).
  5. Feet ground plane contact in rest pose.
  6. Active skeletal deformation under bone rotations (vertex displacement verified).
  7. Bounding volume continuity (no disconnected runaway vertices).
  8. Weapon socket presence and tracking.
  9. Three.js engine and `bindAvatarModel` compatibility.
  10. PBR materials and texture preservation.
- Recovery heuristics automatically retry with relaxed tolerances or fallback before failing.

### Phase 8: Autonomous Pipeline Orchestration (`riggingPipeline.ts`)
- `executeRiggingPipeline(model, characterId, options)` coordinates all 10 stages asynchronously.
- Emits real-time progress events, structured logs, and stage metrics.
- Automatically advances on success without blocking user prompts.

### Phase 9: Meshy-Inspired Frontend Studio (`MeshyRiggingStudio.tsx`, `meshy-rigging-studio.css`)
- Interactive Three.js 3D viewport with OrbitControls, directional lighting, and ground grid.
- Camera preset views (Front, Side, Back, Top, 3/4 Perspective).
- Alignment Tab: Rotation X/Y/Z, Ground offset, Scale, Auto-Align, and Reset actions.
- Landmarks Tab: 3D colored marker spheres, clickable selection, coordinate sliders, symmetry mirror toggle, and confidence badges.
- Skeleton Tab: 18-bone hierarchy inspection and bone overlay toggle.
- Weapons Tab: Weapon class selector, grip transform adjustment, and socket tip/muzzle markers.
- Animations Tab: Play/pause, speed multiplier (0.5x, 1x, 2x), and clip switcher (`Idle`, `Walk`, `Run`, `Attack`, `Cast`, `Hit`, `Death`).
- Validation Tab: Real-time 10-point check report with pass/fail indicators and one-click "Accept & Deploy" button.
- Embedded directly into `ChampionHubView.tsx` via the "Open 3D Rigging Studio (Meshy AI)" action.

---

## 4. Verification & Test Evidence

- **Unit & Integration Suite (`meshyRiggingPipeline.test.mjs`):**
  - 8/8 comprehensive subtests pass cleanly:
    - Phase 1: Generation contract, prompts, asset paths.
    - Phase 2: Bounding box, centering, grounding, orientation.
    - Phase 3: 22 landmarks, bilateral symmetry, manual mirror edits.
    - Phase 4: Skeleton hierarchy, native helpers, smooth 4-influence skinning.
    - Phase 5: Weapon sockets, procedural meshes for all 6 weapon types.
    - Phase 6: 7 standard animation clips, keyframe tracks.
    - Phase 7: 10-point rig validation suite.
    - Phase 8: Autonomous end-to-end pipeline execution from raw mesh to animation-ready.
- **Full Game Suite (`npm run check:game`):**
  - All 485 unit tests pass (0 failures).
  - All 3 batch multi-seed simulations pass (10/10 seeds).
  - Anti-regression and gameplay invariant checks pass.
- **Production Web Build (`npm run build`):**
  - TypeScript compilation (`tsc -b`) exits 0 with 0 errors.
  - Vite client bundle build succeeds cleanly.

