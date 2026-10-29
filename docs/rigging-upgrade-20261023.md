# Rigging upgrade: 2026-10-23

The owner approved implementing the reviewed upgrade after reporting folded arms
on the latest generated Stafford. Work covers shared post-rig processing, runtime
animation ownership, browser base inputs, deformation checks, and an interactive
Colab notebook. No new inference, API preparation, outfit fitting or publication.

## Findings and correction

1. Retained stage comparison reproduces coherent anatomy before arm calibration
   and severe folding immediately afterward. The native procedural donor's
   absolute Idle joint directions cross the torso. Calibration faithfully copied
   those inappropriate anatomical directions. `retarget_motion.py` now preserves
   the target rest stance/roll and transfers reference-relative donor world
   rotations. This preserves the A-pose as the neutral animated stance; it does
   not create a finished combat guard pose.
2. `avatarModelAssets.ts` previously recognized UniRig but not TokenRig as owning
   its exported clips. TokenRig therefore received procedural pose/contact edits.
   Both providers now preserve their clips.
3. `bindAvatarModel` constructed `standingStance` even when preserving clips.
   That constructor reparents helpers to the chest, changing the hierarchy on
   which local animation tracks depend. `threeAvatarModels.ts` now returns the
   preserved-motion binding before constructing procedural controllers. The
   regression compares against an untouched standalone mixer, rather than binding
   both the expected and actual scenes through the same destructive constructor.
4. Valid weights previously received whole-body smoothing regardless of numerical
   defects. `conditional-skin-correction-v2` preserves valid unarmed skin exactly;
   explicit equipment repair touches eligible rigid parts without smoothing the
   valid body. Invalid input still uses bounded repair/rollback. Numerical validity
   does not establish anatomical correctness.

## New evidence and gates

`asset_pipeline/rig_stages.py` records opt-in, separate raw, cleanup, mapping,
weight-repair, helper, coordinate-frame, pre-arm, post-arm and post-contact Blender
snapshots with file hashes, joint transforms and evaluated bounds. A nonempty
stage folder fails instead of overwriting prior evidence. Use a new trial folder.
Raw snapshots now precede mapping/root adapter insertion; the first diagnostic
baseline captured its raw snapshot after that adapter, which did not deform it.

`browser.mjs` adds an optional `motionReview` capture of all ten clips at phases
0.15, 0.42 and 0.82, front and side. Default browser review stays compact. This is
sampling, not exhaustive continuous animation or transition qualification.

`deformation-edge-stretch-v1` evaluates every geometric triangle edge, deduplicating
rest-coordinate seam copies and retaining the worst posed copy. A length ratio
above 4 with extension above 5% of rest-surface height rejects a humanoid candidate.
This conservative gross-stretch envelope is versioned; it is not a calibrated
artistic quality score. Rigid-motion, face/vertex permutation, winding, seam-copy
and nonfinite regressions are covered. Collision telemetry and visual review
remain separate. Frozen historical qualification reports retain their old policy.

The browser studio now uses an anatomy-only `base-first-a-pose-v1` prompt, matte
A-pose demonstration geometry, and lowered-arm landmark sampling. Costume, hair
and signature colors are excluded from the base prompt. The helper requires
explicit biped anatomy. This does not add creature retargeting or automatic outfit
fitting. Geometric landmarks and procedural skinning still require visual review.

## Artifact identity

- Avatar: `c_wukong_lol` (Stafford).
- Generation: `d0ba4c6c-f06e-4047-90ab-5f29de0cb11d`.
- Source SHA-256: `7606b5c57b562457ee616875267315751a33a34d74dbf74f07ab59d708230e8d`.
- Raw TokenRig SHA-256: `bffc47c8cf223c82f4c2644138f146fdef6f7c9934e2a14c12755eacad4c1f0b`.
- Raw profile: `tokenrig-t4-fp32-sdpa-trial-v1`; model/runtime hashes remain in
  [the original execution receipt](stafford-base-apose-tokenrig-execution.json).
- Donor SHA-256: `9ed24c98e637f9bde96a9820ec7d69b565f79024417ff66079b87e271f7f134d`.
- Historical failed folder: `/avatar-data/61d04a2e-a5b1-421a-9048-06e31e754ea6`.
- New stage baseline: `/avatar-data/rig-upgrade-stafford-baseline-20261023`.
- New final output: `/avatar-data/rig-upgrade-stafford-final-20261023`;
  GLB SHA-256 `1ea011c9465e26f911c75ecec967f9f3c997612cb3fea575a3460433d0fba168`.
- Final pipeline: `target-rest-relative-v5`. Exact per-file engine hashes:
  [final-engine.json](rig-upgrade-20261023/final-engine.json).
- All-ten-clip browser fixture: `/avatar-data/74b80e62-728c-497d-a713-b58acaf8f16e`.
  It uses the preceding metadata revision, with identical GLB binary payload
  (geometry, textures and animation), SHA-256
  `ae86d1f2faf5396373ceb797189e756f83e1dee027c79816daa3eec1cc54ef25`.
  [Artifact comparison](rig-upgrade-20261023/artifact-comparison.json).
- Stage snapshots remain in the worker artifact volume. Repository evidence
  retains manifests, views and reports rather than duplicate large `.blend` files.

## Verification and limits

- `npm run check:game`: 524 tests, 3 simulation tests, design checks and TypeScript
  pass. `npm run build` and the avatar reviewer build pass with existing bundle
  size/timing advisories.
- Linux asset suite: 66 tests, 65 pass and 1 Blender-only cleanup test skipped.
  New Blender rig regressions: 4 pass; existing natural-motion tests: 5 pass;
  existing pipeline-motion tests: 9 pass. The live worker correctly refused a
  resource-sensitive test with only 309 MiB available; the suite then passed in
  an isolated 1 GiB Linux container. No resource threshold was weakened.
- Actual browser technical and gameplay checks pass. Sixty motion views plus
  eight standard views are retained. Inspected front/side motion sheets show
  coherent Idle arms, but do not establish finished combat quality.
- [Final geometry qualification](rig-upgrade-20261023/final-geometry.json) now
  **rejects Run and Walk for gross stretching**. The former finite-only gate
  passed the same geometry despite up to 2,599 self-intersections. Run phase 0.42
  has 519 severely stretched edges under the new gate. Attack still has elevated
  collisions; Death shows wrist/hand pinching and is not a satisfactory fall.
- The raw skeleton has fingers and toes but no dedicated tail chain. Inspected
  stretched tail edges have mixed thigh influences; source-specific edge evidence
  shows up to roughly 15x expansion. The earlier limited raw stress test did not
  exercise a full gait and must not be generalized to full appendage qualification.
- Clothing/hair fitting remains deferred. Production inference provider remains
  UniRig; recognizing TokenRig clips in the renderer does not deploy a TokenRig
  inference provider. No historical references/jobs/reports were overwritten.
- The local worker reviewer bundle was updated for verification (old bundle
  retained in `/tmp/avatar-review-before-rig-upgrade-20261023`). The worker image
  itself was not rebuilt. Repository Docker builds include the updated sources.

Motion sheets: [Idle/Run/Attack/Cast/Hit](rig-upgrade-20261023/final-runtime/motion-sheet-0.png),
[Walk/Strafe/Death/Turns](rig-upgrade-20261023/final-runtime/motion-sheet-1.png).

## Colab

[tokenrig_colab.ipynb](../infrastructure/tokenrig/tokenrig_colab.ipynb) is a
self-contained notebook for interactive raw-rig inference. It embeds the pinned
trial tools, creates a Python 3.11 environment, checks GPU capacity, preserves
input/checkpoint hashes, supervises inference including its Blender helper for
15 minutes, and downloads the rig/log/environment/manifest ZIP. It runs without
application credentials, tunnels or a background production service.

Every generated Python cell compiles. The new notebook bootstrap was not executed
on a fresh Colab session; prior successful T4 trials are separate evidence.
Dependency installation, runtime availability and other meshes remain unverified.
The current retarget investigation reused the retained rig and did not need a GPU.

## Next unresolved stage / coordination

Owner `/root`; no delegated agents. Files/stages owned: shared post-rig transfer,
weight correction, runtime binding, browser base contract, deformation qualification,
isolated diagnostics and notebook packaging. Next work consumes the exact raw rig
and donor above: add/validate anatomy-appropriate tail coverage and targeted
skin/pose correction against the failing gait/Attack/Death views. Preserve the
working raw input and each failed output. Do not fit an outfit, qualify or publish
this candidate merely because its arms now remain separated in Idle.
