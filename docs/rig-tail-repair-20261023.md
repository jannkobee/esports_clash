# Retained-base tail repair: 2026-10-23

The owner asked to do the next useful work after the rigging upgrade. This pass
repairs the missing tail coverage on the retained Stafford base and tests a
separate arm-transfer profile. It produces an inspectable repaired candidate;
it does not qualify a finished character or activate a production provider.

## Result

The anatomical tail is no longer dragged apart by the thighs. The final candidate
has a 12-bone tail chain, 69 joints in total, normalized skin weights with no more
than four influences, and no gross stretching in the 50 sampled frames across all
ten clips. Rest geometry, existing bind matrices (within 1e-6), and all skin
outside the recorded repair region are preserved. The raw rig and earlier failed
outputs remain immutable.

Peak full-surface intersection counts at the same five phases for common clips:

| Clip | Previous base | Repaired candidate |
| --- | ---: | ---: |
| Idle | 0 | 0 |
| Run | 2,544 | 65 |
| Walk | 2,599 | 172 |
| Attack | 1,733 | 764 |
| Death | 745 | 0 |

This is a substantial deformation improvement, not a clean collision result.
The expanded validator also measures Strafe (peak 423), TurnLeft (447) and
TurnRight (40); the preceding 35-frame report did not measure those clips, so
there is no recorded old collision baseline for them. Thresholds were not relaxed.
The earlier commentary calling Run intersection-free was incorrect; 65 is the
final measured peak. Zero applies to **gross stretch failures**, not collisions.

## Repair design and scope

`asset_pipeline/tail_repair.py` implements opt-in `single-pelvic-tail-v1`.
The caller must declare exactly one anatomical tail attached to the pelvis.
Stafford's declaration comes from the existing monkey anatomy entry in
`resources/avatars/base-anatomy.json`, not costume text or an avatar-ID branch in
the algorithm. [The frozen specification](rig-tail-repair-20261023/appendage-spec.json)
is hashed in the new plan.

The solver measures unsupported posterior geometry against actual rest skeleton
segments, finds one connected tail region, joins nearby seam/shell samples for
analysis only, and fits cross-section centroids along surface geodesic distance.
It checks attachment distance, length, tubular radius and radial variance.
Missing, multiple, existing or ambiguous appendages and broad/flat surfaces fail
explicitly. These conservative checks are not validated for arbitrary creatures,
tails wrapped against the body, wings, capes, mounts or nine-tail characters.

It adds twelve rest bones below Hips and replaces thigh influences in 3,191 core
tail vertices, with a small blended pelvic collar. Exactly 3,396 vertices change
weights in this source; weights outside the union of core and collar are checked
unchanged. Existing geometry is never moved or welded by this repair. Top-four
weights are normalized. Per-stage before/after weight digests are retained.
The chain follows the pelvis; it has no authored expressive tail gesture or
runtime cosmetic sway. A controlled thigh-separation/tail-bend preview and a
synthetic isolation regression verify that thigh motion no longer pulls the tail.

`anatomical-arms-v2` is a separate optional transfer profile. It bridges donor
clips whose starting arm stance differs from Idle, then bounds swing/twist in the
target's anatomical chest, upper-arm and forearm frames. It does not treat native
spacer/helper axes as anatomical axes. The versioned candidate limits are
conservative skin-deformation bounds, not universal physiological facts. Clip
names/durations and gameplay event timings are unchanged.

An earlier `anatomical-arms-v1` trial used helper-relative limits. Its Attack count
was lower (488), but its frame semantics were wrong; that result was not selected
as a fix. Both trial artifacts remain. The v2 regression includes an intentionally
twisted helper and compares actual target rest orientations. No limits were tuned
to just clear the collision-warning threshold; the final Attack warning remains.

Both repairs are explicit plan options. They are **not new production defaults**.
The core unflagged v5 transfer remains available; repair-bearing plans identify
themselves as `anatomical-appendage-motion-v6` and retain exact engine hashes.

## Evidence and identity

- Avatar: `c_wukong_lol` (Stafford), generation
  `d0ba4c6c-f06e-4047-90ab-5f29de0cb11d`.
- Source SHA-256: `7606b5c57b562457ee616875267315751a33a34d74dbf74f07ab59d708230e8d`.
- Raw rig: TokenRig `tokenrig-t4-fp32-sdpa-trial-v1`, SHA-256
  `bffc47c8cf223c82f4c2644138f146fdef6f7c9934e2a14c12755eacad4c1f0b`;
  retained at `/avatar-data/rig-upgrade-stafford-final-20261023/raw-rig.glb`.
- Donor SHA-256: `9ed24c98e637f9bde96a9820ec7d69b565f79024417ff66079b87e271f7f134d`.
- Final folder: `/avatar-data/rig-tail-arms-stafford-final-20261023`.
- [Repaired base GLB](rig-tail-repair-20261023/repaired-base.glb), SHA-256
  `fd9ba0b04e7d4d0da31b8f6ec59e9515b461479bdc2eb8c67e37e1fc80edd11e`.
- [Final engine](rig-tail-repair-20261023/final-engine.json),
  [plan](rig-tail-repair-20261023/final-plan.json),
  [repair report](rig-tail-repair-20261023/final-preparation.json), and
  [stage manifest](rig-tail-repair-20261023/final-stages.json).
- All stage `.blend` files, including `03b-appendage-repair.blend`, remain in the
  persistent artifact volume. The controlled stress stage is separately retained
  at `/avatar-data/rig-tail-stafford-stress-20261023`.
  Twenty-one exact engine/runner source files are archived in the final folder's
  `engine-sources/`; [the receipt](rig-tail-repair-20261023/engine-source-receipt.json)
  verifies their hashes and Blender build identity for future reproduction.
- Browser fixture `/avatar-data/41323ce2-25f3-49fc-b7e8-a88c3e0a6894` contains
  68 views of the preceding metadata revision. Its binary payload **and scene JSON
  excluding extras** match the final candidate; [the exact comparison](rig-tail-repair-20261023/artifact-comparison.json)
  verifies geometry, textures, animation, binding and node transforms.
- Matching current-renderer donor baseline:
  `/avatar-data/5c02aa3e-9b6f-4e84-80f5-4a141050fd87`.
- Rejected setup `/avatar-data/rig-tail-stafford-v1-20261023` failed before rig
  execution because of malformed temporary JSON. A separate file corrected it;
  the empty folder was not reused. Tail-only v2 and arm v3/v4 trials remain distinct.

Views: [tail coverage](rig-tail-repair-20261023/proposal-side.png),
[controlled bend](rig-tail-repair-20261023/controlled-stress-side.png),
[Idle/Run/Attack/Cast/Hit](rig-tail-repair-20261023/motion-v4/motion-sheet-0.png),
[Walk/Strafe/Death/Turns](rig-tail-repair-20261023/motion-v4/motion-sheet-1.png).

## Verification and remaining limits

- Nine new Blender regressions pass: explicit anatomy, ambiguity, flat-surface
  rejection, rest/unrelated-skin preservation, independent thigh motion, actual
  tail bending, repeated-repair refusal, quaternion twist/sign, clip reference,
  and anatomical-versus-helper frame handling (some assertions share a test).
  Existing rig/natural-motion/pipeline-motion tests pass 4/5/9.
- Linux asset suite passes 65 tests with one Blender-only cleanup skip. Python
  compilation, Node syntax checks and targeted diff checks pass. No web/gameplay
  source changed in this pass, so prior game/build checks were not repeated.
- Official glTF validation has zero errors and the retained
  `NODE_SKINNED_MESH_NON_ROOT` warning. Actual browser technical/gameplay checks
  pass, with all ten clips captured front/side at 0.15/0.42/0.82.
- [Geometry qualification](rig-tail-repair-20261023/final-geometry.json) samples
  all ten exported clips at 0/0.15/0.42/0.7/1 under
  `ten-clips-five-phases-v1`, with actual validator/edge-engine hashes. It passes
  finite/skin/skeleton/stretch checks **with collision warnings** for Attack,
  Strafe and TurnLeft. This is sampled structural evidence, not continuous
  collision-free animation or final artistic acceptance.
- Independent [quality comparison](rig-tail-repair-20261023/quality-comparison.json)
  **fails** the unchanged rubric for intersection growth, foot drift, hand jump
  and the recorded render-cost comparison. Foot drift is 4.509922 versus the
  matching Stafford baseline's 2.755808; hand jump is 1.622126 versus 0.980496.
  The software-render timing comparison contains a 60.2 ms candidate outlier
  (mean 6.067 ms versus 5.133 ms); it is not controlled proof of device FPS or of
  a causal tail-repair performance regression. It remains recorded as a failure.
- Death no longer pinches the wrists, but still ends upright with raised arms.
  It is not an acceptable finished death/fall animation. The neutral A-pose also
  remains a base stance rather than a finished fighting guard. Tail motion lacks
  authored expression. Full clothing/character identity review is still deferred.

No API preparation, live asset, inference-provider deployment, new generation or
GPU/Colab inference was needed. No failed or historical evidence was overwritten.

## Ownership / next stage

Owner `/root`; no delegated agents. Files owned: `tail_repair.py`, arm transfer,
retarget orchestration, diagnostic runner/inspection helpers, ten-clip validation,
Blender regressions and this evidence. No schema/UI integration of the optional
profiles was activated. Next work consumes the exact final source/donor and repair
records above: shoulder deformation and contact-aware locomotion/transitions,
followed by a target-compatible Death pose and combat guard. Keep the character
unqualified and do not fit an outfit to conceal those remaining failures.
