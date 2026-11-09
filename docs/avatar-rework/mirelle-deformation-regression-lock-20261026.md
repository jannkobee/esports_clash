# Mirelle deformation regression lock

Status date: 2026-10-27. This is the current deformation-stage record for Mirelle (`c_invoker`). It supplements the [active Babylon visual plan](../babylon-visual-rebuild.md), the [character asset gates](../character-asset-pipeline.md), and the chronological [agent handoff](../agent-handoff.md). The handoff records the full work sequence; this file consolidates the source-of-truth lineage, current candidate and rules for the next repair.

## Current decision

The tapered weight-transfer study remains the immutable comparator. The strongest measured native-GLB diagnostic is now integrated candidate `f6283980`: shoulders 44/35 and hips 51/47 at 90 degrees, versus taper's 131/81 and 255/133. Rest surface and skin weights are preserved. Paired Babylon review still finds abrupt deep-joint transitions, and the latest map isolates 208 residual contact vertices. The candidate remains **experimental, unpublished and unqualified**. Blender preserve-volume is a separate diagnostic and worsens one hip; no such mode is applied to the GLB. A signed-contact-bound surface probe is the next active experiment. These are diagnostic bends, not game animation clips; no outfit fitting or live release.

The API preparation record and retained diagnostic artifact are the source of truth for the preview. The Web preview reads the same API record; do not edit a Web-side copy of the review or infer qualification from a rendered preview.

## Immutable asset lineage

| Stage | ID | SHA-256 | Meaning |
|---|---|---|---|
| Generated Mirelle source | `26713b59-ef49-4f50-9271-35ff929c3e0d` | `f90efcde69a536fab5c5ec8bb178d1547c2cc3299634029292684557d30781dd` | 3,056,808-byte, one-mesh GLB, no skin or animations. Historical source provider is recorded as `trellis2-gguf`; do not relabel its generation as Colab. |
| Raw TokenRig preparation | `24e7f704-3abe-42d4-9c47-204627ee9e88` | `a656ab5248f2d8ca3640774fd6745a28bc244e8485be0ced57db8e231a5fe25f` | 52-joint raw rig, no game animations; the exact current generated source is the parent input. |
| Combined pivot candidate | `a3352d37-91cb-4757-b403-da09f5ac0017` | `89086aef80758e052542cfaad3bd2768d9aa47e41625a0ac18fa3bfed40866f4` | 3,375,724 bytes; previous measured pivot sensitivity candidate, not a qualified repair. |
| Collision influence profile | `99390ef5-7d0a-469a-8fdc-b0787958140a` | report `748eebbaf3664c6e40c6bb061dac641faa098c61051060141851789ea1c99ae8` | Colab-only measurement on the combined pivot candidate; changed no mesh, rig or weights. |
| Localized weight-transfer reference | `59efceaf-d39e-414e-94af-36f7ccbae738` | GLB `8416076e0ecb7b1592aafc1b4b9402ba028f21bb89c381c646f78501ce281838`; report `d82d37c0461457f1b356768efe7be37e6bc2b6abd088f85bb5f7d7969001f00c` | 3,375,716 bytes; 12% torso-to-limb donor transfer within measured shoulder/hip bounds. Limited visual review, still unqualified. |
| Tapered weight-transfer study | `3fe2b0ca-5d59-4eb7-964a-8b50607f9046` | GLB `38cd49d0375ed24af3071bb899cb498b3996c4b18024c161cbd5e6e891c8c68f`; report `4eeb7ecf1ca22b1c0784580733f4b75a627cac0f300add49c1d28a054f317799` | 3,375,716 bytes; same 12% maximum and donor/target recipe, with a 4 mm smoothstep edge taper. Numerical improvement; limited visual review confirms remaining defects. |

Candidate weight editing, diagnostic clip export and measurements ran in Google Colab T4 runtime `9d6d63438ea2f910c5b7039d4a6ed77596c6dbf1843f3f1590afe1b6b86aa4f7`, pinned environment SHA-256 `73928306c86dae9ce21c8fe672abffcebdbb4ee2a654fa3a194a6f466ee8d105`. This does not relabel the historical source generation. Local services were used only for orchestration, record storage, browser inspection and building the viewer code.

Exact final input, plan, report, runtime state, logs and GLB are retained under [the candidate evidence folder](../pipeline-audit-20261024/generated-weight-transfer-candidate-59efceaf/). The four failed/superseded runner attempts and their available partial outputs/logs are preserved in [weight-candidate-failed-attempts.zip](../pipeline-audit-20261024/weight-candidate-failed-attempts.zip); none was registered as a candidate or used as a source.

## Measured results and their limits

The Colab experiment transferred 12% of the existing torso donor mass to each target limb group, only for vertices inside the measured contact bounds. It changed 150 vertices on each shoulder, 279 on the left thigh and 257 on the right thigh. It changed weights only; rest geometry was unchanged.

After GLB export and reimport, the symmetric nearest-surface distance was max `3.0034249220989295e-7 m` and RMS `1.0932504035307813e-7 m`, below the experiment's `1e-6 m` rest-surface drift limit. Vertex count changed from 23,682 to 23,734 because the GLB importer/exporter split vertices; triangle count remained 37,578. Do not use same-index vertex comparison across GLB roundtrips; use the recorded symmetric nearest-surface measure.

The same eight arm/leg joints were bent to 45 and 90 degrees before and after export/reimport. All 16 tested poses reported zero severe-stretch edges. At 90 degrees, intersection counts were:

| Region | Parent combined-pivot candidate | Weight-transfer candidate | Change |
|---|---:|---:|---:|
| Left shoulder / upper arm | 215 | 144 | -71 |
| Right shoulder / upper arm | 137 | 85 | -52 |
| Left hip / thigh | 429 | 258 | -171 |
| Right hip / thigh | 445 | 162 | -283 |
| Left / right forearms | 0 / 0 | 0 / 0 | unchanged |
| Left / right calves | 0 / 2 | 0 / 2 | unchanged |

These counts are paired diagnostics for measuring change; improvement does not define a passing production threshold. Remaining shoulder/hip intersections and absent game clips prevent qualification. Limited Babylon review is recorded below; the shared repair/retarget chain, final dressed deformation and actual game motion remain unreviewed.

## Babylon review and backoffice corrections

- Whole-body review `3184f35b-889c-4697-9371-046ea3c89dd1` retained 44 screenshots with zero browser errors, using the exact API-retained parent/current GLBs and shipped inspector. Both derived diagnostic GLBs reproduce all 16 saved collision counts after export/reimport. Normalized clip phases `.25` and `.5` are required: a 30 fps export imports on Blender's 24 fps timeline as frames 0..48, so fixed export frame numbers are incorrect after import.
- Focused review `640258b6-72bb-47a9-a6ea-593a48220ad2` retained 16 joint close views with zero browser errors. Report SHA `3189b698118e2c5a7a3e0e801cf44db6bbb7922707d86d7b841fa40eb4fb40c4`; repaired inspector entry SHA `b53cdbbf1a7ee8cae29c18696ad56eb13e07acc2349f6e41d94e8a0adc9ccb02`. The preceding focused run `058d633c-5fa4-44f3-a225-4b0da722bd74` produced clipped/background images and is explicitly rejected as visual evidence despite technical completion.
- The limited assessment manually inspected 26 named/hash-verified screenshots across the useful whole-body/focused runs. Rest silhouette and foot placement are preserved in the inspected views. Deep flexion still produces pinching and angular shoulder/hip transitions; the right hip crease is clear in close side view. These findings keep the base/rig gate failed. Exact inspected filenames, findings and hashes are in [visual-assessment.json](../pipeline-audit-20261024/candidate-visual-3184f35b/visual-assessment.json).
- Backoffice now retains and serves the exact parent/current diagnostic clips by both visual-review ID and candidate ID. It rejects mismatched lineage and corrupted bytes. API readback and controller rendering confirm the shared preview uses that same artifact and inspector hash. Fixed a Collection/array mismatch that caused preview requests to fail, misplaced Blade loop closures that hid new comparison rows, and the camera near-plane scale that hid models when zoomed in.
- Evidence: [whole-body review](../pipeline-audit-20261024/candidate-visual-3184f35b/), [useful close views](../pipeline-audit-20261024/candidate-details-640258b6/), [rejected close views](../pipeline-audit-20261024/candidate-details-058d633c/review-assessment.json). Whole-body report SHA is `8f96408ac2191a079f8322eb9d62912cdcc8d1f79e5cac9f91ab0281a79345d0`. The whole-body folder also retains the two earlier failed export/environment attempts and their frozen inputs.

## Taper study result

The new study reproduced both immutable baselines before editing, and changed only edge falloff: maximum donor transfer remains 12%, using the same bounds, donor groups, target groups and region order as the prior experiment. The `Spine` role in this recipe maps to `bone_1`; it does not transfer `bone_2` influence. Do not assume all torso influence reported by the collision profile has been repaired.

| 90-degree region | Prior 12% candidate | Tapered candidate | Change |
|---|---:|---:|---:|
| Left shoulder | 144 | 131 | -13 |
| Right shoulder | 85 | 81 | -4 |
| Left hip | 258 | 255 | -3 |
| Right hip | 162 | 133 | -29 |

All 16 45/90-degree poses have zero severe-stretch edges. Forearms remain 0/0 and calves remain 0/2 at 90 degrees. Export/reimport symmetric nearest-surface max distance is `2.844912216914963e-7 m`; RMS `1.0658334120590185e-7 m`. Exported weights are finite and nonnegative, with zero unweighted vertices, at most four influences, and max normalization error `1.3237877283245325e-7`. Triangle count is unchanged. The new GLB/report are registered in the same API preparation record; the prior reference hash is unchanged and the preview renders both parent and reference comparisons. No qualification/publication flag changed. Exact files and API verification are in [the tapered candidate evidence](../pipeline-audit-20261024/tapered-weight-candidate-3fe2b0ca/).

Verification for the backoffice/viewer changes: focused `AvatarCloudRawRigTest` passes 7 tests / 49 assertions (including mismatched/corrupted diagnostic rejection and no qualification/publication), PHP lint and Blade compilation pass, and `npm.cmd run build:base-inspector` passes. The actual Colab close views verify the fixed near clipping plane. No gameplay rules or match actor release was changed.

## Taper visual decision and exact contact map

The paired taper review `4c509302-8caf-4edb-a034-7a54bcd1ece5` rendered 60 whole-body, skeleton, 45/90-degree and focused joint views with zero browser errors. It uses reference `59efceaf` and current `3fe2b0ca` exported directly from the API, reproducing all 16 saved bend counts for each. Report SHA `a5fdd1c531f1e0fa593b9a6b704de51c79e12ea22eccae974c2f4d8b64f7ef7f`. The oblique supplement `3a1c463c-7fa5-4d0c-bbde-e6d2792e6ff2` rendered eight more views, report SHA `52ab703db49576aa15ed91c64499342a912766702a2fe05395ac579d5455d1ff`. All use the repaired shipped inspector SHA recorded above. Explicit paused Babylon renders make screenshot poses deterministic and avoid competing continuous rendering during capture; this does not qualify live motion.

The limited manual assessment inspected 26 named/hash-verified screenshots across these two runs. Rest silhouette, skeleton/foot placement and selected 45-degree poses are preserved. Paired close/oblique views do not establish a convincing correction of the compressed joint transitions. The **base/rig deformation gate remains failed**. Exact inspected views and next repair plan are in [the taper visual assessment](../pipeline-audit-20261024/taper-visual-4c509302/visual-assessment.json); [full review evidence](../pipeline-audit-20261024/taper-visual-4c509302/) and [oblique evidence](../pipeline-audit-20261024/taper-oblique-3a1c463c/) remain immutable.

Colab diagnostic `0ba81d69-3c9a-4e1c-b3dc-703e998fa143` maps the remaining contacts on the exact tapered source SHA `38cd49d0375ed24af3071bb899cb498b3996c4b18024c161cbd5e6e891c8c68f`. Report SHA `adfe3b3a12acd788523d447ca82e185f9f083765d1b67da56e15e404d558cf03`. It reproduces the 131/81 shoulder and 255/133 hip counts and retains 517 source-bound vertex records, mesh-local indices, exact rest positions, full positive weights and per-record signatures. Region profiles now distinguish `rest_world_bounds_xyz` from `posed_world_bounds_xyz`; the historical `world_bounds_xyz` field is explicitly labeled as posed space. Evidence: [rest/posed contact map](../pipeline-audit-20261024/taper-contact-map-0ba81d69/).

The earlier transfer windows were derived from posed contact bounds, while weight selection was performed on rest-mesh positions. Those spaces differ and the windows can miss part of the failing contact patch. For example, the left shoulder's leading contact pair spans rest X `[-0.10257,-0.06894] m`, versus posed X `[-0.08050,-0.06468] m`. Preserve the historical measured results, but do not treat a posed box as an exact rest-space repair mask. Any next repair must verify the contact map's source hash, import/index convention, rest position and weight signature before using its vertices.

| Remaining 90-degree contact | Leading region pair | Pairs |
|---|---|---:|
| Left shoulder | `bone_2 / bone_26` | 68 |
| Right shoulder | `bone_2 / bone_7` | 39 |
| Left hip | `bone_0 / bone_48` | 157 |
| Right hip | `bone_0 / bone_44` | 71 |

The shoulder evidence identifies intermediate torso `bone_2`, which the previous `Spine -> bone_1` donor recipe did not address. Two subsequent frozen experiments test transfers between this group and the upper arms on verified shoulder contact patches. Both fail as recorded below. Hip Hips/thigh weighting and self-folding remain a separate unresolved repair.

Both the new visual review and contact map are appended to API state. Exact tapered bend playback SHA is `faadbbe72edf1ab61b2974c4e651867482bea7a79eaa4de1a90f1431df22e205`; [API/controller readback](../pipeline-audit-20261024/taper-visual-4c509302/api-verification.json) confirms the same file, visible review/contact records, unchanged candidate/reference hashes, `needs_review`, and false qualification/publication flags. The visual review's `parent` label is the comparison reference; it does not rewrite the candidate's actual asset-lineage parent.

The renderer now rejects mismatched review IDs, source candidates, diagnostic bytes and missing comparison roles. Six focused integrity tests pass using only mock bytes/control metadata locally; no local 3D processing was performed. The read-only [API fixture exporter](../../infrastructure/avatar-evolution/export-candidate-visual-fixture.php) and [Colab review package builder](../../infrastructure/avatar-evolution/build_candidate_visual_review.py) are repository tools, so continuing this workflow does not depend on hardcoded ignored helpers. The builder accepts explicit source/output directories, the shipped inspector, and optional prior-review/detail inputs; it only packages bytes locally. Frozen launchers perform the actual exports/rendering in Colab.

## Signed shoulder trials rejected (2026-10-27)

Both experiments start independently from taper `3fe2b0ca` / SHA `38cd49d...`, compare against reference `59efceaf`, and verify all 517 signed contact records before editing. Each reproduces both baselines, uses a maximum 12% donor transfer and a three-ring smoothstep mesh-neighbor falloff with rest-position UV-seam correspondence. Only existing positive influences among `bone_2`, `bone_26` and `bone_7` change. Source geometry, joint transforms and hip weights are held fixed.

| Experiment | Direction / eligibility | Modified vertices L/R | 90-degree shoulders L/R | Decision |
|---|---|---:|---:|---|
| Preserved taper `3fe2b0ca` | Comparator | -- | 131 / 81 | Unqualified comparator |
| `8db702c3-0015-4535-a4b1-f2dd44541ed4` | `bone_2` to arm, smooth arm-weight eligibility .25 to .5 | 140 / 26 | 137 / 81 | Rejected: +6 / 0 |
| `7a692c3c-3afb-49f9-ad6e-b4cf4b9ffb62` | Arm to `bone_2`, smooth torso-fraction eligibility .5 to .75 | 102 / 58 | 149 / 88 | Rejected: +18 / +7 |

Torso fraction is `(bone_1 + bone_2 + bone_3) / (those groups + target upper arm)`. These are bounded tests of two recipes, not proof that all weight corrections are ineffective. Non-shoulder counts remain unchanged: 90-degree hips 255/133, forearms 0/0, calves 0/2; all 45-degree counts zero. All 16 poses retain zero severe-stretch edges. Both GLB roundtrips have max rest-surface drift `3.011961098309257e-7 m`, zero unweighted vertices, at most four influences and max normalization error `1.3175304047763348e-7`.

Immutable artifact identities:

| Trial | Candidate GLB SHA-256 | Report SHA-256 |
|---|---|---|
| Arm-favoring `8db702c3` | `d9a9982ff5ed33811d9e5c2389f7ee07611e83ddc71e122904299008b4cc6eb2` | `d980b21f68cfbc56f322dd917e52125b0e6e65d7707a6028c29d241842b1c3ba` |
| Torso return `7a692c3c` | `7babc116f979aab8a291911f4a20c5dc73b3d064c8af492e7440ab21ceba787d` | `eba3b48fc210cff2493a912670a0c9a9c4719f8d517d9eedfbcc62442ad6423e` |

Candidate bytes are 3,375,872 each. Plans, exact inputs, unchanged controls, outputs, runtime receipts, tests and logs are in [arm-favoring evidence](../pipeline-audit-20261024/shoulder-contact-candidate-8db702c3/) and [torso-return evidence](../pipeline-audit-20261024/shoulder-torso-return-7a692c3c/). All asset processing and contact tests ran in the same pinned Colab T4 environment recorded above. Four tests passed for the first frozen input and five for the second (the added test covers torso-fraction eligibility).

Paired Babylon reviews `fd4cd36c-cfa5-4890-bd19-7767345e8346` and `ae7272e0-6a2f-420c-aecb-2853a50e7c6a` each retain 68 screenshots, zero browser errors and exact diagnostic exports reproducing all 16 counts for both comparator and trial. Visual report SHAs are respectively `b0b18ad86cc7e22a8156616820d9efa324c2a30164725314702fbfd3f71d16c4` and `c11fab195ac9c56c5fdffc0f88655a0f0360808b6128e90eb9d6a2d5b52727d7`. Trial diagnostic GLB SHAs are `e742962123b5b951cefb85a216bbaa1cd209e55716dd7adf0feb90bd4d96e530` and `5cdb9eab96cb6d00492de782c63a954e3b36005d988eed4dc01bab51a548e6ba`; comparator playback remains `faadbbe72edf1ab61b2974c4e651867482bea7a79eaa4de1a90f1431df22e205`.

Limited manual assessment inspected six named/hash-verified views per trial. Compressed shoulder transitions remain; no convincing shape improvement is visible. Selected rest views preserve silhouette/feet, and hip creasing remains. Both assessments are `rejected_regression`, with inspected filenames and limits in [arm assessment](../pipeline-audit-20261024/shoulder-visual-fd4cd36c/visual-assessment.json) and [torso assessment](../pipeline-audit-20261024/shoulder-torso-visual-ae7272e0/visual-assessment.json). Capturing 68 frames does not mean all were manually inspected or qualify actual motion.

Both rejected candidates and reviews are appended to the canonical API preparation record, retaining exact diagnostic playback. Controller/API readbacks return 200, show the assessments, verify all contact records and unchanged taper hash, and retain `needs_review` with false qualification/publication flags: [arm readback](../pipeline-audit-20261024/shoulder-visual-fd4cd36c/api-verification.json), [torso readback](../pipeline-audit-20261024/shoulder-torso-visual-ae7272e0/api-verification.json). An intentional mismatched contact-map hash is rejected before audit/state writes. Neither trial is a production repair default or release.

## Fixed-weight shoulder socket study (2026-10-27)

Colab study `65f0062a-b1af-44bb-822e-8bf56e51c315` starts from the exact taper and reproduces both its 16-pose baseline and the prior reference. Report SHA `be8b6528a8cb33400e893ca207b477ed1f9d56f8b9b53c2cca5e5525e2274163`. It freezes seven bilateral placements: +/-0.5% body height along lateral, forward/back and vertical directions, plus the local shoulder-section bounding-box center. Every pivot stays within the source section bounds and a 1% body-height displacement cap. This bounds geometry; it does not prove anatomical correctness. The source is normalized to height `1.002935528755188 m`; axial shifts are approximately 5.015 mm.

The study measures rest cross-sections perpendicular to each humerus at -1%, 0, +1% and +2% body height along the arm, within a 5.5% body-height radius. It retains the section points, bounds and centroids. The center variant uses bounding-box midpoints, not a vertex-count-weighted centroid or an asserted anatomical socket.

The first frozen runner `47b6145b-d5cc-4565-bcef-11bc89a297b5` stopped before generating a candidate: edit-mode head changes perturbed downstream rest matrices by up to `4.76837158203125e-7`, exceeding the new isolation guard, while the no-op edit-mode control was unchanged. This is a stopped harness attempt, not evidence that the original rig was already displaced. Exact inputs, control, report and probe are preserved in [failed-run archive](../pipeline-audit-20261024/socket-failed-47b6145b.zip) and [readable failure evidence](../pipeline-audit-20261024/socket-failed-47b6145b/); the API retains the failed diagnostic without a candidate.

The corrected, separately frozen runner edits the GLB bind data directly **in Colab**, compensates child local transforms and updates only the two target inverse bind matrices. It preserves target world axes and all unrelated world transforms rather than relaxing the isolation guard. Mesh/weight binary bytes stay unchanged at this step. Each bind intermediate is then imported, exported through Blender GLB, reimported and measured with the unchanged collision/stretch policy.

| Placement | Candidate ID | 90-degree shoulder intersections L/R |
|---|---|---:|
| Immutable taper | `3fe2b0ca-5d59-4eb7-964a-8b50607f9046` | 131 / 81 |
| Outward 0.5% | `eb38414a-532c-5307-9899-a78ca4aacc3c` | 58 / 54 |
| Inward 0.5% | `5bc6c175-d4fd-5f8b-a4e9-3ef51b88df0b` | 190 / 132 |
| Forward 0.5% | `268fd5d7-71a7-5671-9a24-2836cfaf6d84` | 63 / 42 |
| Backward 0.5% | `122fb8bc-bcd6-552d-9988-0a84f95a851e` | 209 / 148 |
| Upward 0.5% | `4c0d1ca7-6c9e-573e-9956-96f89ccfa389` | 169 / 95 |
| Downward 0.5% | `70b98577-207a-56f2-acaa-6de62bec1cf7` | 108 / 77 |
| Section-bounds center | `ac0a76ee-8179-5a72-b8f5-fe88eea01648` | 85 / 67 |

All seven complete all 16 post-export bends. Every 45-degree count remains zero; all 16 poses have zero severe-stretch edges. Non-shoulder counts remain unchanged (90-degree hips 255/133, forearms 0/0, calves 0/2). Before export, target-axis matrix error is at most `1.1102230246251565e-16`, and unrelated world-matrix error at most `6.661338147750939e-16`. Final GLB max rest-surface drift is `3.011961098309257e-7 m`. Bidirectional position/weight matching permits exporter seam splits, but finds zero unmatched vertices and max weight error `1.1920928955078125e-7`. No unweighted vertices, at most four influences and max normalization error `1.3175304047763348e-7`. These are preservation checks, not a production deformation pass.

The Colab preflight independently verifies the requested pivot coordinate conversion (max error `3.337203127736024e-8 m` on the outward test), unchanged weights and rest surface, and rejection of an intentionally altered weight. Its exact script/result/log are retained. All candidate hashes, bind intermediates, controls, plans, inputs and logs are in [socket study evidence](../pipeline-audit-20261024/shoulder-socket-65f0062a/); [summary.json](../pipeline-audit-20261024/shoulder-socket-65f0062a/summary.json) lists each complete UUID, GLB SHA and preservation values. Processing uses the same pinned Colab T4 environment above; no local geometry processing.

The forward placement has the lowest summed shoulder count among these seven; outward trades a lower left count for a higher right one. This is a numerical inspection priority, not a release selection. Forward GLB SHA is `fd243abc51b8b0dbc4c168b597c0dd5c75171bcb3a90f666ecf3229ee784a54c` (3,375,740 bytes); canonical candidate report SHA `2ba7a4952d2aecef269616540083abc8775d612e40c9df1e26727955a494a593`. It has no game clips. The other six candidates have numerical checks and retained GLBs, but no new paired manual Babylon assessment in this study.

Forward/taper Babylon review `b59855f6-eab7-4263-89f0-dd53b49ead24` renders 68 screenshots with zero errors and reproduces every saved diagnostic count on both exported clips. Report SHA `97fb2b0c50a6c7e7de8947333f9b6a27d0268e36787418a8fab91aea51e802ac`; forward playback SHA `f6e41e7f33cdc4aa1775682dc22500478e5d02ffd54c2b43cc07b339a75f7ee2`. Comparator playback remains `faadbbe72edf1ab61b2974c4e651867482bea7a79eaa4de1a90f1431df22e205`.

Limited manual review of 16 named/hash-verified frames finds no gross shoulder separation in paired oblique/selected side views, but the rounded/compressed joint transition remains. Selected front/side/back and skeleton rest views preserve overall silhouette and supported feet. Front close bend views are partly occluded by hands/forearms and cannot independently clear the armpit. Both inspected hip close views retain deep creasing. Status is **`improved_counts_deformation_unresolved`**, not qualified or published. Exact scope/findings and inspected filenames are in [visual-assessment.json](../pipeline-audit-20261024/socket-forward-visual-b59855f6/visual-assessment.json).

Backoffice retains the failed run, all seven candidates, the complete study and exact forward/taper playback in the canonical preparation record. Candidate plan UUIDs match candidate IDs; their separate `socket_study_id` preserves study lineage. Initial registrar wiring failures (state ordering and study/candidate ID mismatch) rolled back; corrected registration succeeds. A deliberate false weight-correspondence flag is rejected without changing state or the single completed-study audit. The shared preview now labels socket placements correctly, links each variant and shows failure evidence instead of calling these changes weight transfers/raw rigs. [API/controller readback](../pipeline-audit-20261024/socket-forward-visual-b59855f6/api-verification.json) verifies all seven retained hashes, unchanged taper, visible study/assessment/failure, exact playback, HTTP-controller 200 and `needs_review` with false qualification/publication. This is not an authenticated end-to-end browser test. Focused `AvatarCloudRawRigTest` passes 7 tests / 49 assertions; Blade compilation, PHP lint and Python syntax checks pass.

## Integrated shoulder and hip repair (2026-10-27)

The combined shoulder study `cfdfe771-6441-40f8-8ec4-6899c7bf290d` reproduces taper and forward-only comparisons, then applies 0.5% body-height outward plus 0.5% forward shifts to each shoulder, within the frozen 1% displacement cap and source-section box. Candidate `d38b680b-3f40-5331-8bdf-992a6ec4f272`, SHA `9a4a5efd95f5687020797402b9dcf591e3813f0b092526357793387b88b005ab` (3,375,760 bytes), yields shoulders 44/35; other bends stay unchanged. Study report SHA `d68c93d25ed3508fb88c6ed40a5f77100fdd94f698a4d94e7b3cf7ae2d9b8645`. Evidence: [combined study](../pipeline-audit-20261024/socket-combined-cfdfe771/).

Contact map `36346ebc-09b5-45d8-8fb7-1d1066abcebf` on that exact candidate retains 399 signed vertices, report SHA `588a5e644e7e3c7cfb7a77689923328d6bfb18540ec39c0669000febe9f39523`. It reproduces shoulders 44/35 and hips 255/133. [Evidence](../pipeline-audit-20261024/combined-contact-36346ebc/). The separately prepared shoulder-only visual package `4d758887` was **not dispatched**; later integrated/taper review below supplies the actual new visual evidence.

Hip studies start from `d38b680b`, holding shoulder changes, skin weights, target axes and all unrelated world transforms fixed. Initial run `59039b5f-5e22-4c1e-a6e1-ac91f99b9ac4` stops at the upward proposal's frozen section-bound guard after four partial measured variants. It is retained as failed with no usable candidates in backoffice. Partial outputs/inputs remain in [failed archive](../pipeline-audit-20261024/hip-failed-59039b5f.zip) and [readable failure record](../pipeline-audit-20261024/hip-failed-59039b5f/). No source bound or threshold was widened.

New frozen run `d2d8cc83-a767-4e77-baa6-47d409888d0a` evaluates all seven proposals, recording inadmissible placements as rejected without exporting a candidate. Five valid proposals each complete all 16 export/reimport bends. Study report SHA `ee1408d6a8b3bc0edc791e959e08b691d8b420d6bf140eaa5a10e0bd60d8762b`.

| Hip proposal | 90-degree hips L/R | Disposition |
|---|---:|---|
| Source `d38b680b` | 255 / 133 | Immutable comparison |
| Outward 0.5% | 243 / 125 | Measured diagnostic |
| Inward 0.5% | 254 / 118 | Measured diagnostic |
| Forward 0.5% | 130 / 82 | Best of this sweep |
| Backward 0.5% | 381 / 312 | Regressed |
| Upward / downward 0.5% | -- | Both rejected by the frozen zero-section box; no exports |
| Section-bounds center | 351 / 152 | Regressed |

The rejected vertical shifts fall outside the experiment's narrow zero-section AABB. This is a geometric proposal limit, **not proof of invalid anatomy or being outside the whole body**. Preserve that distinction and the rejection. Five candidate UUIDs/hashes and both rejection details are in [hip summary](../pipeline-audit-20261024/hip-socket-d2d8cc83/summary.json). Shoulder counts remain 44/35 in every measured hip variant; unaffected bends stay unchanged.

A separately frozen, evidence-guided forward extent study `3b135ec1-f4c3-4674-9f57-bb0127032995` tests 0.99% height forward from the same `d38b680b` source, comparing both the source and 0.5% hip-forward candidate `16314881`. This is an alternative placement, not another 0.99% on top of that candidate. It remains within the same 1% source-relative cap. Report SHA `76f2c03cc2d22a70adfcf649aa7ed1901cb75a859d7930968bd1944edcb141d7`.

Resulting integrated candidate **`f6283980-c4dd-5f34-bcf4-09c08e9e6346`** has GLB SHA **`494cbb1574d50b9a82985738c0f6ef03a3d7d438a5ef9b038a28a40aeaf805c7`**, 3,375,764 bytes, and canonical report SHA `c436a252171795f54b31201e1c014813894042e818e24da3d570bc745f8234be`. Its actual lineage parent is `d38b680b`; `16314881` is only the comparison reference. Shoulders stay **44/35**, hips improve to **51/47**, forearms stay 0/0, calves 0/2. All eight 45-degree cases remain zero; all 16 cases have zero severe-stretch edges. Unaffected bends match the source. [Exact integrated study](../pipeline-audit-20261024/hip-extent-3b135ec1/).

The hip shift is approximately 9.929 mm, with max unrelated world-matrix error `2.220446049250313e-16` and target-axis error `1.1102230246251565e-16`. Only target inverse bind bytes change during direct bind editing; child transforms are compensated. Export/reimport max rest drift is `2.504824863081012e-7 m`, with bidirectional weight error at most `1.7881393432617188e-7` and no unmatched vertices. Zero unweighted vertices, at most four influences and max normalization error `1.3237877283245325e-7`.

A separate **Colab cumulative comparison directly from taper to `f6283980`** verifies max rest-surface distance `4.6026559630263364e-7 m`, RMS `1.2531712396316747e-7 m`, zero unmatched position/weight records and max weight error `5.960464477539063e-8`. Both have 37,578 triangles. Importer/exporter seam splitting changes vertex counts 23,734 to 23,806; do not compare indices across these assets. [Exact cumulative result and scripts](../pipeline-audit-20261024/integrated-visual-90c5282c/cumulative-bind-comparison.json).

### Residual contacts, skin-mode diagnosis and actual Babylon evidence

Final source-bound map `e44d4c06-f826-4a97-bcf7-b912845094fd` retains **208 signed contact vertices**, reproducing all four 90-degree counts. Report SHA `c6437651fb9c392edc733cb5ce2eedfa4eb33d925e97ac6f1823f803c79e5c96`. Remaining contacts include shoulder torso/arm boundaries, same-region folds, and groin/opposite-thigh contacts. This disproves a single torso-donor explanation for every residual intersection. [Exact map](../pipeline-audit-20261024/integrated-contact-e44d4c06/).

Updated-source skin-mode diagnostic `b89a083d-6ed1-497c-be5b-c9130b7e7674` reproduces the integrated linear baseline with fixed original rest collision keys, then evaluates Blender preserve-volume. At 90 degrees, linear versus preserve-volume: shoulders 44/35 versus 30/0; hips 51/47 versus 34/67; forearms 0/0 and calves 0/2 in both. Right hip regresses. Report SHA `642005e229c67b87ffcfb6ec242eefafefa2674257d481b3e3915dae6aa786f1`. This is a diagnostic on the modified source, not a reactivation of the rejected historical half-angle helper experiment. No preserve-volume GLB or runtime fix was exported/applied. [Exact evaluation](../pipeline-audit-20261024/integrated-skin-b89a083d/).

Native integrated/taper Babylon review `90c5282c-c89b-4d56-8614-82d7c0c11406` retains **68 screenshots, zero browser errors and both exports reproducing all 16 counts**. Report SHA `0a680b54147fae435ce52c5dcefe2359b7d432feb6c146fc3a9395851ce84ddc`. Current diagnostic playback SHA `726f7f1758defe33ca7c8abe45c90a996c1ccc37f84456182b0a19d2d73d3bfe` (3,531,504 bytes); taper playback remains `faadbbe72edf1ab61b2974c4e651867482bea7a79eaa4de1a90f1431df22e205`.

Limited manual inspection of **20 named/hash-verified images** covers paired deep-joint oblique views, current hip sides, bind front/back/side/skeleton and 45-degree front limb views. Rest silhouette and supported feet remain; selected moderate bends have no gross collapse. Deep shoulder transitions remain compressed, and hip/groin views retain abrupt creases/root shape changes. Front hip details have foreground-leg occlusion. Assessment is **`improved_counts_deformation_unresolved`**; no qualification or publication. [Exact assessment, images and playback](../pipeline-audit-20261024/integrated-visual-90c5282c/visual-assessment.json).

Sequential Colab batch `174e79ea-4839-4f91-8733-5b2253065645` runs contact mapping, skin-mode diagnosis and actual Babylon review without local fallback, retaining each child result before the next stage. Exact child plans/inputs stay unchanged. Batch manifests/state and hash-verified child archives are in [batch evidence](../pipeline-audit-20261024/integrated-batch-174e79ea/). The frozen skin-mode job still has the old `contact-map` stage/log alias; its actual script/method is the skin comparison. The builder now labels future jobs `skin-evaluation`; frozen receipts are not rewritten.

Backoffice canonically retains all studies, five hip candidates, bound rejections, failed partial run, final maps/mode report and exact playback. Shared Web reads the same preparation record. Candidate links now identify joint/placement and short UUID; comparisons show candidate IDs, hip studies and mode limitations. [API/controller proof](../pipeline-audit-20261024/integrated-visual-90c5282c/api-verification.json) verifies exact artifact/source/ancestor hashes, visible records, exact bend file, controller 200, `needs_review`, false qualification/publication and shipped inspector SHA. It is not an authenticated browser E2E test. Falsified bound-rejection metadata and changed reproduced-baseline counts are rejected with unchanged state/audit counts. Focused API tests pass 7/49; Blade/PHP/Python checks pass. All asset processing remains in the pinned Colab T4 runtime above.

### Completed surface probes and portable corrective bake (2026-10-27)

`/root` owns the Colab surface/corrective preparation, diagnostic animation export and backoffice evidence. No delegates or local asset processing. Same runtime/environment and immutable generated-body lineage above.

Contact-bound corrective-smoothing probe `08aabc0b-9a2e-4324-b287-d8c7ae1e4244` completed on exact `f6283980` and canonical map `e44d4c06`. Report SHA `90d95cf9c5b571e9c2c9b5ec05c20c02808980f71c99c1a7e54afd9aa9002ad9`. It verifies all 208 signed contacts and uses a three-ring seam-aware mask of 931 vertices, factor .5/eight LENGTH_WEIGHTED corrective-smooth iterations. Pinned boundaries yield 90-degree shoulders 40/38, hips 40/27, zero seam spread; right shoulder regresses. Free boundaries yield 51/50 and 91/49 with seam openings up to **17.2585 mm**, and are rejected. Rest drift stays below 7.4e-8 m; all 16 severe-stretch counts zero. [Exact probe](../pipeline-audit-20261024/joint-surface-08aabc0b/).

Joint-specific target probe `38fccb63-f252-4647-9e2c-228d32558795` uses preserve-volume plus pinned smoothing for shoulders, linear plus pinned smoothing for hips, unchanged native linear mode for other bends. Report SHA `0c5f34c3cb50142a3a972e57856b2cd7e0065687e26295eeffec291a927042b5`. Shoulders **31/0**, hips **40/27**, elbows 0/0, calves 0/2 at 90 degrees; all 45-degree cases zero, all 16 severe-stretch counts zero, seam spread zero. Eight retained 45/90-degree target surfaces have NPZ SHA `09afd8642e3bf6e4e3317db7562326451945cde8b20480d748d2595a0a2a7f3d`, 1,951,329 bytes / 23,806 vertices. This remains a Blender target evaluation until a portable bake is proven. [Exact target probe](../pipeline-audit-20261024/joint-hybrid-38fccb63/).

Portable bake attempts are separate immutable UUIDs:

| Attempt | Result | Evidence |
| --- | --- | --- |
| `6027546a-2abd-4535-9687-c13d58ed832d` | Stopped at an absolute analytical-source matrix guard. Never registered as a candidate. | [Failed receipt](../pipeline-audit-20261024/portable-corrective-6027546a/receipt.json) |
| `5f45b39c-c183-4c37-9f31-43b0bea4b4b3` | All 16 portable poses pass against the exact retained native control; zero glTF errors but a non-root skinned-mesh warning. Experimental predecessor only. | [Receipt](../pipeline-audit-20261024/portable-corrective-5f45b39c/receipt.json) |
| `140fe64c-6c59-41a5-9b8b-6bb7a35c8b97` | All 16 pass; both GLBs have zero glTF errors/warnings after verified static-identity mesh-root normalization. Babylon review follows separately. | [Receipt](../pipeline-audit-20261024/portable-corrective-140fe64c/receipt.json) |

The failed first attempt is not fixed by raising its numerical tolerance. A retained Colab skeletal-control probe shows corrective versus the **exact existing native exported clips** has zero matrix difference on all 16 poses; both native/control and corrective differ from the analytical pre-export skeleton by up to 1.3113021850585938e-6. Subsequent attempts freeze that existing control SHA `726f7f1758defe33ca7c8abe45c90a996c1ccc37f84456182b0a19d2d73d3bfe` and compare against it with the original 1e-6 limit. Analytical differences remain reported separately. Source baselines and bend counts still reproduce unchanged.

Latest base candidate `140fe64c` has SHA **`85fba1625bd539ec28c6564a037fa02c4bfb4aa886316afc345c5f05429deace`**, 4,363,028 bytes. Separate eight-clip diagnostic SHA **`dbbc0810eb315105652188a70b21bb229fb08f14a54dee5606d635eb1138f549`**. Report SHA **`2a0f49fb0b6081502fa735b1c05a2f566c4551b0110452aea859bb58b1b0439d`**. It contains four zero-default position/normal morph targets derived by inverse linear skinning of the retained joint targets. Standard glTF weight channels are baked with the existing skeletal clips, without custom Babylon skinning or helper bones. Each 90-degree target matches within 1.08e-7 m; 45-degree weights are fitted per joint and sampled at every exported frame. Rest surface/skin weights are preserved, all 16 exported contacts reproduce 31/0 shoulders and 40/27 hips, no count regressions or severe-stretch edges, zero seam spread and zero skeletal matrix difference from the retained native control. These diagnostics do **not** clear shape or motion qualification.

The final layout promotes only mesh node 52 from a verified static identity Armature wrapper to the scene root. Joint parents and animation tracks remain unchanged; both primary/stress layout proofs are retained. The pinned Khronos validator 2.0.0-dev.3.10 runs in Colab, with exact package hashes and per-GLB validation reports. [Validation](../pipeline-audit-20261024/portable-corrective-140fe64c/output/gltf-validation.json).

Backoffice retains both completed candidates, their exact private clips, the two target probes and the failed first attempt (diagnostic only, unavailable as a candidate). False qualification/publication persists. Candidate previews distinguish baked correctives from weight transfers and show how to open the measured clips. Playback now rejects any alternate clip that does not match the candidate's retained corrective bake, preventing silent loss of morph channels. Full-motion, transitions, compound/multi-axis bends, appearance and game use remain unproven.

Actual Babylon review `0a4e25c9-23ad-4c5a-a58d-db4d4588bd9d` compares this candidate with its immediate native parent `f6283980`, retaining 68 screenshots and both exact diagnostic clips. Report SHA `b6cdcd68842dbd9bbe310e16a48cd2866568329fa45978d9d099fbd3022ac8fe`; zero browser errors. Babylon's live morph influences match all recorded bend weights and the rest pose has zero influences. Limited manual assessment of 20 named/hash-verified views finds the shoulder cap fuller but still broad/rounded, with residual hip creases and partial hip occlusion; no shape-gate pass. Status `portable_correction_verified_shape_unresolved`. [Assessment, evidence and API/controller proof](../pipeline-audit-20261024/portable-visual-0a4e25c9/). The first review `b6c0f3e4-4556-4973-8ff8-303fcf847141` stopped because the comparison exporter failed to assign the named control action. It is preserved and registered as failed with no candidate; the corrected exporter is frozen in the successful new review. [Failed evidence](../pipeline-audit-20261024/portable-visual-b6c0f3e4/).

Interpolation job `3e82afe8-a0e5-4414-8f42-6595632fa066` was launched on runtime `9d6d6343...` but the runtime was replaced before its result could be retrieved; its completion status is **unknown**. Its plan/input and interruption receipt are preserved in [motion-interrupted-3e82afe8](../pipeline-audit-20261024/motion-interrupted-3e82afe8/). A different existing T4 `ad1939207493c083878091908ac9dea2b8d750bd923ab852d215ebdca85a3d70` was connected without allocation/restart; the pinned preparation setup and model files were restored. Actual new environment SHA `f658c5be302b6bef0cea34e8c571d080dc48943e56f786de38976104cb7f37fb` differs from the old environment; both installation receipt and full environment freeze are retained. The Drive mount did not persist across the replacement and a new Google authorization was requested; do not claim Drive persistence until it succeeds.

Replacement interpolation/cycle job **`e0a78665-172e-45c9-9f8f-ffd852d5ca81`** completed in the new Colab environment. Report SHA **`880ac6d454c9c68a2151da9cc33d3c4c5db674081391eb220a1d1dc6120f3984`**. It reimports the exact retained native and corrective diagnostic GLBs, samples 13 time points each along four single-joint bend-and-return cycles for each asset (**104 samples total**), and reproduces the saved 45/90-degree collision baselines. At these samples, there are **zero contact-count regressions** relative to the corresponding native pose, zero seam spread, zero severe-stretch edges, zero skeleton matrix difference from the native control, and maximum corrective-curve error `6.063796270383559e-7`. Maximum return-to-rest displacement is `4.133897423321329e-7 m` and maximum outbound/return path difference is `2.5981062314156735e-7 m`. This is a sampled single-axis diagnostic, not a continuous, compound-pose, anatomical or full game-motion qualification. [Exact study, pinned input, environment, report and API readback](../pipeline-audit-20261024/corrective-motion-e0a78665/).

Two hash-verified partial snapshots were retained independently before completion as `motion-e0a78665-checkpoint-1793101114.zip` and `motion-e0a78665-checkpoint-1793101191.zip`; the latter includes 82 samples. The first job's unknown outcome is not relabeled as the replacement result. The backoffice registers the new study in the same preparation record, displays sampled-pose/regression counts, and preserves false qualification/publication. The controller/API verification explicitly distinguishes this report's `candidate_sha256` from its raw `rig_sha256`; it is a shared controller render/readback, not authenticated browser E2E.

### Targeted shoulder shape alternative

The full preserve-volume corrective looks too rounded in the paired views. Rather than silently replacing it, independently frozen Colab target study `7da12d83-c675-4299-9457-f7fcdeb9f1e2` tests one specific hypothesis: halfway between native and hybrid shoulder target surfaces, while the hip target remains unchanged. It reproduces the 16 native and eight full-hybrid baseline counts with the same collision policy and frozen contact/target inputs. At 90 degrees the alternative shoulders are **34/17**, versus native 44/35 and full hybrid 31/0; hips stay **40/27**. No target regresses versus native and the bounded surface checks have zero seam opening or severe stretching. Report SHA `547970fc47112eedff73428b2d5d51844096e1bb39e440e44d618f9dab43b595`, new target SHA `e48289cff6583172b7e5abe3bc5766cd3fcbc1387f58c762fccd08ca9c08a397`. [Exact frozen study](../pipeline-audit-20261024/shoulder-shape-7da12d83/). This is a tradeoff and a hypothesis, not proof that the shape is better.

Colab exported the alternative as candidate `51e2aadf-5c46-4f86-b0d0-a317e2e9e864`, base SHA `1ac3a8004f69cc7b95adca63400288194771a37e091b33d6723a5397851b856f`, separate diagnostic clip SHA `d738ef5abdb04e334daec27b1c2799a9eb66f46cf49b61812ec0f9ac9cf329bd`, report SHA `271af122c75cc049ea1c0b3943b62d4410ac1e9ff481aa2e8a02e29855a2f7cd`. All 16 reimported bends pass preservation checks and both GLBs have zero Khronos validator errors/warnings. It is registered as another unqualified diagnostic, not a selected replacement. [Exact bake](../pipeline-audit-20261024/shoulder-bake-51e2aadf/).

Direct Babylon review `34a96f56-b86c-46f9-9f85-1d1a432497ee` compares the exact `140fe64c` and `51e2aadf` models/clips; report SHA `6e3723e9233619605a1b7ef78a4abb87d0a0aabebea0ab738365109ef04d8955`. Both sets of live morph weights match their frozen clips, both reproduce all 16 measured bends, and 68 images were captured with zero browser errors. Limited manual inspection of 22 named/hash-verified images finds only a subtle reduction in shoulder fullness; the broad rounded root and compressed underside remain, and front details are partly hand/forearm occluded. Hip creases remain. Since shoulder contacts also rise to 34/17, this alternative does not demonstrate a convincing enough visual improvement to replace the full-corrective diagnostic. Status `alternative_shape_not_convincing`; no qualification/publication. [Exact assessment and paired evidence](../pipeline-audit-20261024/shoulder-visual-34a96f56/). Preserve both candidates as experimental, and do not continue a blind strength sweep.

### Map of contacts on the actual corrected model

New Colab map `5271850d-a635-4a23-a147-02060d866fbb` measures candidate `140fe64c` **with its exact retained diagnostic clips and morph weights active**, not its uncorrected rest rig. Report SHA `052ac73559a75140e992408a33036008e625f5e69c613a4ddf345a2c0ba6cb01`; it binds **117 signed rest-space contact vertices** to the exact source and verifies primary/clip rest positions, topology, weights, four recorded 90-degree counts and actual corrective weights. The vertex index space is the frozen Blender glTF import, not GLB accessor ordinals; validate rest signatures before using them. [Map, exact package and receipt](../pipeline-audit-20261024/corrected-contact-5271850d/).

All 31 remaining left-shoulder pairs are the `bone_2`/`bone_26` torso–upper-arm boundary; the right shoulder has zero counted contacts in this one bend. Left hip has 18 pelvis/thigh, 11 same-thigh, five same-pelvis and six other pairs; right hip has 16 same-thigh, seven pelvis/thigh and four other pairs. These are measured collision-region classifications, not an anatomical sculpt recipe or a visual pass. Preserve the distinction between posed bounds and signed rest positions. The 117-vertex map supersedes `e44d4c06` **only for planning work on this exact corrected pose and mesh**; `e44d4c06` remains the immutable native-candidate map.

Initial corrected-map job `b9de5849-f645-4d9c-95e9-443747df4989` failed at import because the frozen package omitted `asset_pipeline`; its full failed input/log/state are [retained](../pipeline-audit-20261024/corrected-contact-b9de5849/), registered as failed and never exposed as a valid map. The fixed builder produced the separately frozen successful job above. Backoffice registration checks exact candidate/clip hashes, runtime, morph weights and baseline counts; no automatic release follows.

### Rest-side shoulder separation trial

`/root` owns the Colab posed-surface prototype, corresponding signed-contact packaging and backoffice evidence. Trial `473def27-624e-493d-bedb-6c7c6861e8ce` reproduced both sets of 16 baselines but stopped before geometry changes: the primary GLB imports as `geometry_0` and its clip as `geometry_0.001`. A separate Colab preflight confirms both contain 23,832 vertices and 37,578 faces; name equality alone is not correspondence. [Failed attempt and preflight](../pipeline-audit-20261024/separation-473def27/) are retained and marked failed in backoffice.

Replacement trial `8416eeb2-bb79-43fd-8d50-9ea3b564e14d` verifies every signed contact on the exact primary candidate, then checks per-index clip topology, rest positions and weights before using those indices. It reproduces all 16 native and all 16 corrected baseline counts. Its single frozen hypothesis uses the sign of rest-space separation between each torso/upper-arm contact triangle to orient the posed torso normal, applies a three-ring seam-aware falloff to arm-side vertices, and limits additional posed displacement to 0.3% of body height. The conservative sum of the prior corrective bound and this added bound stays within the original 2%-height posed displacement cap; no pivot/weight cap was rebased.

**Result: reject this proposed surface.** Left-shoulder intersections increase from **31 to 50** at 90 degrees: 41 torso/arm, six same-arm, three arm/chest. Eighteen seed vertices and 81 falloff vertices were involved; no pair was classified ambiguous. Added displacement max `0.003008808178864982 m`, coincident-seam spread zero, zero severe-stretch edges under the unchanged gross-stretch policy. The frozen input clip was the exact previously verified corrective playback, but this trial only evaluated one posed surface; it did not independently recheck every morph weight in its baseline loop. It exported no candidate, produced no visual or anatomical pass, and changed no source asset. Report SHA `265cd5aed77fd09bf852c75a8cfb7aa4e42195992b6b3caba07c0971ee6e530c`; [full evidence](../pipeline-audit-20261024/separation-8416eeb2/). Backoffice retains the outcome as a diagnostic, not a selectable repair. The failure demonstrates that this rest-side-normal displacement is not a useful solution; do not promote it or blindly sweep its parameters.

### Shape-preservation alternative: retained, visually unresolved

Colab-only local ARAP experiment `a6af0c71-3de8-4b61-aed4-33d12c5ddfd0` uses the same signed shoulder contacts but a different objective: reduce local rest-edge deformation, with anchored boundaries, three-ring seam-aware falloff and at most 0.1% height added displacement. It independently reproduces the native and corrected 16-pose baselines, including corrected morph weights. At 90 degrees, contacts stay **31**, local rigid energy changes `0.74121` to `0.70183`, edge-strain metric `0.41361` to `0.39257`, seam spread and severe-stretch count remain zero. It exported no model or target because its frozen retention rule required a strictly lower contact count. [Exact study](../pipeline-audit-20261024/arap-a6af0c71/).

Separately frozen `b8f13722-4e26-4d3b-846d-69a29d35b76b` retains the same-parameter result for visual investigation when contacts are unchanged and rigid energy falls. It reproduced the same measurements and retains posed target SHA `fb35920f53b5dfe09790bc798a34eb96ff3076d2440d71b0a67862021a0a5457`. No visual improvement or qualification is claimed. [Exact study](../pipeline-audit-20261024/arap-b8f13722/). An initial registration attempt used an outdated helper and was rejected before state writes; the updated helper registered it.

Colab remap `55389b78-27da-4be0-94e3-cf1ee5491597` maps that 23,832-vertex posed target back to the exact 23,806-vertex native bake source using matching rest positions and skin weights, not shared ordinal assumptions. There are zero unmatched native vertices, max rest difference `2.766e-7 m`, max weight difference `1.192e-7`, zero ambiguous seam-target differences, 31 left-shoulder contacts and zero severe-stretch edges. Maximum change from the prior hybrid target is `0.0010029569 m`, within the frozen added bound. Remapped target SHA `3c468ccbdc943902b9feb4659d619ec2e191b9b0a67780282f39d21f6a86813c`, report SHA `4e4697935577d3ab495c39d4a6b7c32725874bba9d3c2fad002f8520affd8b43`; [exact evidence](../pipeline-audit-20261024/arap-remap-55389b78/). Previous remap `be352660` failed before processing because `mathutils` was imported before `bpy`; its frozen inputs/log/state are [retained](../pipeline-audit-20261024/arap-remap-be352660/) and recorded failed.

New Colab bake `2ca48df4-a8d9-428a-bff6-3af822965124` used the registered remapped target and unchanged native source/control. Primary GLB SHA `72bba5da100e3728c9e8e13c64bd37e4857f71f7abd05319bac318f8dab922fa`, diagnostic playback SHA `f8b4dbd21a3f7b1953e96919c5a89e518b7a5742a3e517f7ea0cb14c1129dd41`, report SHA `d461c9a68a10865dbe31b1ba2733e7a20d811060defd7b08e6402e3850d06679`; [exact bake evidence](../pipeline-audit-20261024/arap-bake-2ca48df4/). Both GLBs passed Khronos validation with zero errors or warnings. Reimport checks cover all 16 controlled bends, rest surface, weights, skeleton and seams. Shoulder/hip contacts remain 31/0 and 40/27, the same as `140fe64c`; no severe stretches or sampled count regressions. The original 2%-height corrective cap and pivot/weight limits remain unchanged.

Babylon comparison `440ba1fe-52c6-41a2-b21b-9b01a75ba8fd` retained 68 screenshots and actual morph influences; all 278 frozen input files and 68 screenshot hashes verified. Manual review of 22 named views found **no convincing shoulder improvement**; shoulder roots remain broad and hip creases remain. Front shoulder detail is partly occluded. Review SHA `9c14769792ba289fe0bb719b78ed0e5733a90fb866663847f59829a28d59211e`; [review, assessment and API/controller readback](../pipeline-audit-20261024/arap-visual-440ba1fe/). API readback confirms the exact model, playback, assessment and unqualified status; it is not an authenticated browser end-to-end test. Retain the candidate for diagnostics only. No game clips, appearance or publication are qualified.

The Colab raw-rig service was started in runtime `ad1939207493c083878091908ac9dea2b8d750bd923ab852d215ebdca85a3d70`, but the named session later disappeared before its backoffice connection could be verified. At 2026-10-27 13:20 UTC the backoffice reported generation and raw-rig disconnected, production UniRig unconnected, and animation/qualification still blocked with local processing disabled. A process start is not proof of production readiness.

### Replacement runtime restored (2026-10-27)

A new T4 was allocated for the existing `asset-quality-rpc` route, with runtime SHA `ddb07188977acba2b815846c5f2ead92802114fe87200f49fa9f665e7d698e10` and pinned preparation environment SHA `160e42e63b84d075df53fca9c416775671584a1ed926a9ea81ad71691ab2ebab`. The first install timed out downloading an NCCL wheel; its receipt and log were retained. The retry used the same pinned packages and a 300-second network timeout and completed. The raw-rig candidate service is connected through the backoffice; engine SHA `5e052e8d83d7d5144694b3dfd4b8d10cb49bdd451a4f0f554fe8a607fb2d6c69`. No inference was dispatched. [Installation, environment and readiness evidence](../pipeline-audit-20261024/colab-runtime-replacement-20261027/). Future installations default to the longer timeout while respecting an explicit override.

Generation remains unprovisioned, production UniRig disconnected, and animation/qualification blocked. Raw service connectivity is neither proof of production preparation readiness nor evidence that Mirelle's shape passes. A T4 is not presumed compatible with the native TRELLIS.2 generation profile; verify its GPU and workflow diagnostics before claiming readiness.

### Corrected contact connectivity diagnostic (2026-10-27)

Colab job `51cf4c1c-3ca8-4572-9271-3f26da367cac` used the exact `140fe64c` candidate and corrected stress playback from the backoffice and the registered `5271850d` contact map. It checked primary/clip rest positions, triangle indices and weights, then reproduced all four corrected 90-degree contact counts and morph weights. Report SHA `33c49894ca429df63db775d37fe8fdd765cd8211adff1151552999735fa0cad6`; 31 frozen input hashes verified. Runtime `ddb07188977acba2b815846c5f2ead92802114fe87200f49fa9f665e7d698e10`, environment `160e42e63b84d075df53fca9c416775671584a1ed926a9ea81ad71691ab2ebab`. [Exact input, output and backoffice proof](../pipeline-audit-20261024/contact-topology-51cf4c1c/). The supervisor's inherited stage label says `contact-separation`, but this job is connectivity measurement only; no separation was applied.

At the left shoulder, all **31** torso/arm contacting triangle pairs have no connecting path within six mesh edges under rest-position seam equivalence; their rest-centroid distance averages 61.9 mm. The right shoulder has zero measured contacts. Left hip has 12 one-edge and 28 more-than-six-edge pairs; right hip has 5 and 22 respectively. Rest-centroid distances are not penetration depths, and a greater-than-six result does not establish disconnected components. Local topology proximity also does not automatically make a reported contact benign: keep the frozen collision policy. These observations suggest investigating shoulder torso/arm interaction separately from the hip's mixture of local creasing and longer-range contacts, but do not establish root cause, visual improvement, or a repair.

The canonical API retains the report under candidate `140fe64c`, and the shared Web controller renders its connectivity table; the proof is not an authenticated browser end-to-end test. Candidate and avatar remain `needs_review`, unqualified and unpublished. No geometry, weights or animation were changed.

### Contact-centroid shoulder hypothesis (2026-10-27)

Based on the corrected contact connectivity diagnostic, a single fixed posed-surface experiment moves the arm-side contact patch along each intersecting triangle-pair centroid difference, with a three-ring seam-aware falloff and at most 0.1% of body height of additional displacement. It does not change rest geometry, skin weights or skeleton, and does not relax the original 2%-height corrective limit. This is one directional hypothesis, not a strength sweep or an automatic release. All 16 native and 16 corrective baselines, including actual corrective morph weights, were reproduced first.

First job `3833c6cf-ea05-4855-8a32-df433e1a8c5a` reduced 90-degree left-shoulder intersections **31 to 25**, with zero seam spread and severe-stretch edges; max extra displacement 0.0010029361 m. It produced no target. Report SHA `12e1de5db9a6f7dd50c8162f6dbd4df69fb4a757e55212fe44cb60bb85c9c8e0`. A separately frozen same-parameter job `c81c07a0-83aa-4caf-b627-1bcbe7e7d62b` reproduced the result and retained target SHA `081dc59b99b292771e91749beaa013a22ad1b75a565330895a9ae9b55eb86655`; report SHA `a505bd54cc4ff8de36195e6349fd74f0a442bb1090b3317e31717356bd0b5545`. Both registered under `140fe64c` in backoffice. Evidence: [first probe](../pipeline-audit-20261024/centroid-3833c6cf/) and [target probe](../pipeline-audit-20261024/centroid-c81c07a0/).

Colab remap `58c1ea4e-1733-45db-954b-8d69bfc4e88f` matches 23,806 native vertices to the corrected 23,832-vertex import using rest position and bone weights, no unmatched or ambiguous seam vertices. It reproduces 25 contacts, zero severe stretch, max change from the original hybrid target 0.0010030062 m within the fixed 0.001-height plus numerical tolerance. Target SHA `7b65a7ce545ece9210e8d1a635a79c95088c76fa33481c14b2795e852772d7a9`, report SHA `5fcdef25d33caa81e6f56c48314c9eb689a910040aacf12b814d0420bcccabb2`; [registered remap evidence](../pipeline-audit-20261024/centroid-remap-58c1ea4e/).

Portable bake `e047ce58-9193-49c7-87db-790a0f29dbbf` completed in Colab. Its primary GLB SHA `74cc2139a1e56cb79d8a9197aab6ac38bc91ae3bb9474365411973f8534ab29d`, diagnostic stress GLB SHA `4f2cf3eab7c94fff10ccef8505b9916747dded8abf461df7e82ed28ef93792e6` and report SHA `da69e0a68b33e63885ba1e6e9c82733283b03772bda002c3abb6ad63857e8188`. All 16 reimported controlled poses passed frozen checks: 90-degree shoulders 25/0, hips 40/27, calves 0/2, zero severe stretches and seam openings. Khronos validation reports zero errors and warnings for both GLBs. [Exact bake evidence](../pipeline-audit-20261024/centroid-bake-e047ce58/). Backoffice has registered the candidate and exact diagnostic playback as unqualified.

Babylon comparison `6d60a41a-28f8-4a3a-9d6a-f6d207524d72` compared `140fe64c` with `e047ce58` using their actual retained corrective clips. Report SHA `e452d4c68cfa66288e1f0c06d813ad4544a3184475df22f7553a998e3411cecd`; 68 screenshots and 278 input-file hashes verified, zero browser errors. Limited manual review of 22 named views found **no convincing visible improvement** in the left shoulder at this scale, despite the 31-to-25 contact reduction; broad shoulder roots and hip creases remain. Front shoulder detail is partly occluded by the raised hand. The backoffice retains the exact assessment and diagnostic playback as unqualified. [Visual evidence](../pipeline-audit-20261024/centroid-visual-6d60a41a/). No full-motion or qualification is claimed. Continue the separate shoulder-shape and hip analysis without rebasing caps, blindly increasing strength or fitting appearance.

### Hip fold profile and bounded surface trial (2026-10-27)

Colab measurement `4d516962-da1e-41cf-88e7-1120a7d17663` uses the exact registered `140fe64c` model, baked morph playback and signed `5271850d` contact map. It reproduces the hip 45/90-degree contact counts and morph weights and measures edge lengths and changes in the unsigned angle between adjacent triangle normals within the 90-degree contact seeds and three-ring seam-aware patch. Report SHA `a8c3f9013d53d054ed306215ec1a3eafe2aa3f9b4042a8d6ff497c9c65a4eab4`; [frozen evidence](../pipeline-audit-20261024/hip-fold-4d516962/). At 90 degrees, left patch: 607 edges, 35 under half rest length and 85 over 1.5 times; right: 419 edges, 48 under half and 86 over 1.5. At 45 degrees these are left 7/38 and right 9/28. These thresholds are descriptive only, not a collision policy or visual gate; normal-angle changes are not oriented/signed dihedral angles, and these patch statistics do not prove root cause.

Colab trial `1e484c28-1442-4306-8187-d92d68d70a3a` uses the top 12 measured fold-increase edges per hip as seeds for separately posed local ARAP patches; three rings, fixed anchor 2.0 and max additional posed displacement 0.1% body height. It independently reproduces all 16 native and 16 corrected baselines with actual morph weights. Left 90-degree contacts **40 to 48**, edge strain 2.14385 to 2.07212; right **27 to 26**, strain 2.00220 to 1.97622. Both had zero seam spread/severe stretch and maximum displacements 0.823 mm and 0.431 mm. The bilateral proposal is **rejected** because the left count regressed; no target or GLB was exported. The single-count right reduction is not visual evidence. Report SHA `301df6fb143a0702bf1e124d27b32451ac4c8452744a5fc7a85cf581c43b3d98`; [exact evidence](../pipeline-audit-20261024/hip-arap-1e484c28/). Both reports are registered in backoffice. Do not blindly sweep this method or rebase any displacement cap. The next hypothesis must address the measured local folds while explicitly preventing new left-hip contacts, then undergo portable export and Babylon review.

### Contact-aware hip fold experiment (2026-10-27)

Colab trial `327f8a4b-1b31-4d30-9559-66173d5a2af9` reproduces the prior `1e484c28` hip ARAP proposal and both 16-pose native/corrective baselines, including morphs. For each posed hip it identifies triangle pairs introduced by that proposal, rolls back moved vertices incident to those new pairs and their coincident seam peers, and independently remeasures the unchanged collision policy and local edge strain. This single deterministic rollback is not a strength sweep. At 90 degrees, left contacts **40 to 38** (prior unconstrained proposal 48), right **27 to 26** (proposal 26); zero newly introduced pairs after rollback. Left strain 2.1438468 to 2.0822639; right 2.0021957 to 1.9762164. Both stay within 0.1% height added displacement, with zero seam spread and severe-stretch edges. The two diagnostic targets SHA `3ed7ba7802752fac8f0864e9b15afddd7d8e42992bae39d6100d47766fc37579`; report SHA `e055fd1e920c2d9b08eaa1ae80b96c5a988f0ab777b534849775f7225aa2b611`. [Exact evidence](../pipeline-audit-20261024/hip-contact-327f8a4b/). Backoffice retains the report and private targets, not a qualified asset. Initial job `1947bb1b` failed on a NumPy/Vector type mismatch and is [retained separately](../pipeline-audit-20261024/hip-contact-1947bb1b/).

Colab remap `50f9091c-1e47-45c4-ae14-2ca272b690cb` mapped both targets to the native vertex import by rest position and skin weights with zero unmatched and ambiguous seam vertices. Reproduced hip counts 38/26, max deviation from original hybrid targets 0.8235/0.4312 mm, unchanged other hybrid targets. Target SHA `57166e79665e454b56ccb343301fe4876fe86f8ae146141d5131b8dead3f72c7`, report SHA `54f9a6fad5a41c2ace0ad4f3d4ee8d063067aaead8fbcd8c228f7442f6b6a4a2`; [exact evidence](../pipeline-audit-20261024/hip-remap-50f9091c/). The frozen severe-stretch metric still reports zero, but maximum individual edge ratios are approximately 6.05/5.38; the existing combined ratio-and-extension policy does not flag these short edges. The original corrected baseline ratios are approximately 6.05/5.46, respectively. These are reasons to review shape, not a visual pass.

Prior remap `bbc0b48a-51b4-460e-9e1f-137ec54c7b6b` was deliberately interrupted after repeated NPZ decompression was identified; its status remains unknown, its exact inputs/state and interruption receipt are [retained](../pipeline-audit-20261024/hip-remap-bbc0-interrupted/), and the optimized replacement has its own UUID. Diagnostic GLB bake `89354e93-cb42-4781-aa81-fed36594f611` completed in Colab and passed all 16 controlled reimport bends; shoulders 31/0, hips 38/26, calves 0/2 at 90 degrees, with zero severe-stretch edges and seam opening. Primary GLB SHA `7fe68c53010a526b12c69d36720e373cc6407351ede046e55efc781d80ca7a1a`, stress GLB SHA `f89099aa05ac26f8e2f16d2ce4c780164b1f717bffaf06be937c1f43f4d9b531`, report SHA `3d51d98b0188e42796dcd8f6aa712a7e8d4e09f21690eaa9a9867f5737ed17f2`; zero validator errors/warnings on both. [Bake evidence](../pipeline-audit-20261024/hip-bake-89354e93/). The backoffice retains the candidate and exact diagnostic playback unqualified. Babylon comparison `0044e6e4-d800-4c20-82bb-8d4d3432c97f` compared exact registered `140fe64c` and `89354e93` clips. Report SHA `1f75e9b25d47d50a2c20314318b5d691b86a0d42b9d0b2cf025bae66189e9835`; all 68 screenshot and 278 frozen input-file hashes verified, zero browser errors. Limited manual review of 22 named views found **no convincing hip crease improvement** at this scale; raised thighs obscure much of the front details and arms/hands obscure parts of side details. Oblique views still show abrupt hip transitions; broad shoulders also remain. Backoffice retains the visual assessment and exact playback as unqualified. [Visual evidence](../pipeline-audit-20261024/hip-visual-0044e6e4/). No appearance or game motion has been admitted.

### Eight-angle hip review (2026-10-28)

Colab Babylon sweep `8c276c78-78b2-4e66-8d67-89a9261fc29c` compares exact backoffice candidates `140fe64c` and `89354e93` with active corrective morphs, eight fixed azimuths per hip and no hidden geometry. All 40 screenshot and 278 frozen input hashes verified, zero browser errors; report SHA `dd9f66d7d6a60e439b94602abfb5a0a1ee5b3be2c47886c4c3c29185c98b6317`. Limited manual review of 21 named views exposes pinching at the inner hip, especially right hip orbit 3 and left orbit 1; some other views remain occluded. No convincing visual improvement between candidates. [Exact screenshots, assessment and backoffice proof](../pipeline-audit-20261024/hip-camera-8c276c78/). Recorded views and exact clips are registered in the canonical backoffice and shared controller readback; not authenticated browser end-to-end verification. Both candidates remain unqualified.

### Fold-angle targeted hip experiment (2026-10-28)

The prior Colab runtime expired; a replacement T4 installed the pinned preparation environment, runtime SHA `6e1278f427958d83715851a16946b047ce0be97f803d9c5c5fba8e4fbb5b4caa`, environment SHA `f706010e83a63d36766b0a14b0bc12dce2ff2859a8a45aaec5b765296aa7e365`. Earlier undelivered plans were not dispatched or relabeled.

A single fixed fold-angle hypothesis uses the 12 measured high-fold edges per hip from registered `4d516962`, three-ring seam-aware falloff, 32 optimization iterations and 0.1% body-height maximum added displacement. It minimizes difference between rest and posed adjacent-face normal cosines, anchors movement and rolls back vertices causing new contact pairs. It is a localized mathematical proxy, not an anatomy or visual pass. Colab `171fbcc6-3398-4417-b1ce-05a226d431aa` reproduced both 16-pose native/corrected baselines including morphs. Left contacts 40 to 34, fold proxy 3.67676 to 1.97326; right 27 to 25, proxy 2.83001 to 0.01891. No new sampled pairs, seam spread or severe-stretch edges; max added delta 0.00100294 m each. Report SHA `79391b314471df32e012b4ec98e9010a16714241c0c36ac79b3ceeb7e7bac5a0`, retained target SHA `d32fca9703bf41a8d333df3b685685dff3a7cb95eccaf131ab39a54e3e7475b0`; [exact evidence](../pipeline-audit-20261024/hip-dihedral-171fbcc6/), registered in backoffice. No broad visual improvement or full motion is implied by an optimized proxy.

Colab remap `6ea6a15b-b7ea-4f43-8bbc-7e0946193e9a` preserved rest/weight correspondence with zero unmatched/ambiguous seam matches and reproduced 34/25 contacts. Combined target SHA `8809b1caefcbb02140124f05381a6d7dfeef3adc5b49f6dd624016f6af8f5096`, report SHA `eee9f4482de221b43c2a94d17653d48a932cfd08798278635e9e6f803dc0cb50`; [exact remap](../pipeline-audit-20261024/hip-dihedral-remap-6ea6a15b/) registered in backoffice. Max deviations from original hybrid targets remain within 0.001 height plus numerical tolerance; no source bound rebase.

Portable bake `bb3dc329-4287-4bed-8932-7658f949f214` completed on the new runtime: 16 controlled bends and zero-error/zero-warning GLB validation passed, with shoulders 31/0, hips 34/25 and calves 0/2 at 90 degrees. Primary SHA `14edb8d4a7c1883b9bf231ddbaaf946dc5931ce958f1c7cc252adbadc447d56b`, stress SHA `d7a201c621f1a595317bcef6deeb9dd44c71b15e84868481415190c038573f2e`, report SHA `f207b43d0b8278d5e6ab1858886dab9a5d27e614256ac16a25b7734e90911404`; [exact bake evidence](../pipeline-audit-20261024/hip-dihedral-bake-bb3dc329/). Backoffice has the unqualified candidate and exact clips. Eight-angle Babylon review `dd0e62a7-c514-4172-9e82-a7158179724b` completed against exact `140fe64c` playback, report SHA `3c58042f4921a293e80cd76707b0584c9a0388afec090d123c6225af23db3d77`. All 40 screenshots and 278 frozen input hashes verified; zero browser errors. Limited manual inspection of 24 named views found **no convincing visible hip crease improvement** at this scale; the inner-hip pinching remains. Some views are blocked, including right hip orbit 4 entirely. Optimizing 12 selected edges is not independent evidence of broader anatomy. [Exact review and assessment](../pipeline-audit-20261024/hip-dihedral-visual-dd0e62a7/) registered in backoffice. Candidate remains unqualified, no full motion, appearance or release.

## Regression rules for follow-on work

1. Start from the exact lineage above. Preserve every prior plan, input, report and binary; create a new UUID and evidence folder for every attempt. Never overwrite or relabel a failed, historical, or experimental artifact.
2. Keep all generation, rigging, weight editing, geometry repair, animation authoring, retargeting, baking and asset qualification processing in Google Colab. Do not use local compute or an automatic local fallback. Local API/Web code may orchestrate, retain artifacts and render the result in Babylon.
3. Before comparing a repair, prove that it uses the expected source and parent/reference candidate hashes. Reproduce both recorded baselines first. Compare the same collision policy, regions, bends (45/90 degrees on all eight arm/leg joints), edge-stretch checks, weight normalization/influence limits and symmetric nearest-surface roundtrip after GLB reimport. Sample reimported clips by normalized phase/time, not source-export frame number.
4. Treat intersection reductions and zero severe-stretch edges as experimental diagnostics only. Do not convert these measurements into a pass by changing thresholds, dropping poses/regions, or changing the collision method. Record regressions as well as improvements.
5. Inspect the exact stored candidate GLB in Babylon from front, side and rear, with skeleton and controlled-pose playback. Review ground contacts and close-up shoulder/hip shape. Record camera radius/near-plane and verify that screenshots visibly contain the intended joint; zero browser errors and a render-completed status are insufficient. Then test actual Idle, Walk, Run, attack, ability, hit and death clips through the real repair/retarget chain. Record the visual findings and engine/artifact hashes.
6. Preserve backoffice as the single source of truth: register report, lineage and candidate GLB in the API preparation record using integrity checks; confirm API readback and candidate availability; Web preview must consume that same API record. A local file, screenshot, or Web-only state is not a registered candidate.
7. Keep the clean anatomy/base and rig gates ahead of outfit fitting. No appearance work, publication, qualification or live cutover until the exact final dressed asset passes structural checks, Babylon visual deformation/contact review, complete animation review and owner release controls.

## Next work, in order

1. Combined shoulders, hips, target probes, portable four-corrective bake, exact Babylon review, sampled interpolation/cycle diagnostic and corrected-pose contact map `5271850d` are completed. The rest-side-normal shoulder separation prototype `8416eeb2` is rejected after worsening contacts 31 to 50. The subsequent bounded ARAP bake `2ca48df4` and Babylon review `440ba1fe` did not establish visible improvement; the visual gate remains failed. Use the map and actual close-up views to diagnose joint structure and skinning/topology and design a different anatomically targeted shoulder/hip repair; preserve and compare every attempt rather than blindly sweeping this failed normal offset. Portable clips and lower contacts remain diagnostic until shape and full motion evidence pass.
2. Stop blind pivot/weight tuning. Keep caps measured against their frozen study inputs (shoulders: taper; hips: `d38b680b`), never repeatedly rebase the cap onto a newer candidate to evade it. Preserve all candidates as diagnostics; residual groin/same-region folds require their own surface analysis. No automatic production defaults or advancement from count reductions alone.
3. Once controlled bends are acceptable, trace the exact post-rig repair/retarget/animation stages in the production workflow and connect/verify their Google Colab execution before running game clips. Then inspect the exported clips in Babylon.
4. Reassess the base/rig gate only after visual and full-motion review. Outfit fitting follows qualification; Mirelle's actual costume and abilities follow as separate stages.


## 2026-11-07 current-field compound-pose trials (retention in progress)

The current export branch uses the original generated body/raw52-bone skeleton, continuous-support seven-influence field `e42afed24f19eefef5e715f5378b10b805e4994523e6d63a4c931bd12eac7438`, e96c7db2 hip morphs and parent GLB `42ac17a5740ab76878ca88d49e4b03cbb2d5998e7483acce91160bc0dc6ee597`. This is separate provenance from the older integrated pivot/corrective branch above. The explicit world-direction compound poses and current weights do not replace or numerically rebase those historical comparisons, pivots or displacement limits.

Colab attempts `42facc5c`, `54ff2544`, `8c622f7c` and `2c132a25` have no accepted repair: fairing regresses; separation selects unchanged targets; current-field shoulder volume reduces isolated90 counts but regresses negative-twist motion; compound volume regresses hip42 to112 and right shoulder443 to484. No source/weight/skeleton change or production admission follows. Original source/rest and all historical failures remain immutable. Exact25-pose measurements, input/target/report hashes, runtime provenance and camera limitations are in [the current audit](../pipeline-audit-20261024/contour-repair-20261107/README.md).

First two canonical reviews are verified; final playback/readback for the latter two is pending in this chronological entry. All completed numerical targets/reports are already downloaded. Preserve frozen pelvis/seam/rest/displacement policy, source lineage and four-influence production gate. No further blind field/strength sweep, equipment fitting, game clip qualification or publication is authorized by these diagnostic results. The unresolved contour/weight correction remains agent-owned; do not relabel a solver metric or renderer pass as anatomical acceptance.


### 2026-11-07 final retention result

All four initial current-field attempts above are retrieved, rejected and registered under immutable `combined_contour_reviews`. Exact repair report keys: `49848a9d8e26d27843c08f1c1c06c06c7ce7679a7317289b773ce9a92027d6b9`, `16fc4ed07ae5395022f47d334c1f791f8867f78f2543818e3405d7fdf18210ac`, `e1dc540e46e3c1b32a4e72cd817895da0aa172cfe0a6f45fd36eeb6453622bdc`, `7b00d341261b6e25fe8e1b3ce18401ad7e14d220fe6383350f52a98a6d5f48c1`. All 827 per-review unique artifacts matched canonical readback, shared preview 200/API equality verified together, preparation still `needs_review`. [Final receipt](../pipeline-audit-20261024/contour-repair-20261107/final-backoffice-verification.json).

No successful shoulder/chest or multi-axis hip repair is claimed. The shoulder volume branch makes roots bulkier, and the compound branch regresses hip 42 to 112 and right negative-twist shoulder 443 to 484 after reimport. Static/animated shading is not proven equivalent by a positional pass. Preserve every failed target and warning; do not select them as accepted sources or rebase caps. Existing source, seven-weight field, 52-bone skeleton, e96c7db2 parent and historical branches remain unchanged. Game motion, normal/shading quality, anatomy, appearance, device admission and publication remain unqualified.

### 2026-11-07 section handles v6 and morph normal transport retention

Attempt 5 (`61a07eaa-8371-4a72-81cf-c46239175a45`, method `combined-left-section-handles-v6`) evaluates proximal-arm cross-section translation (0.01805H) combined with coherent chest displacement (0.00349H at 60 degrees, 0 at 90 degrees) within the frozen 0.02H shoulder cap on the left shoulder. It eliminated the flat vertical notch defect caused by sheet-side handles v5 (`f89461c3`) and reduced measured left-shoulder self-intersections from 348 to 0 (60 degrees straight), 93 to 0 (90 degrees straight), 363 to 0 (60/elbow60/twist-20), 364 to 16 (60/elbow60/twist0), 396 to 63 (60/elbow60/twist+20), and 107 to 0 (90/elbow90/twist0) with zero contact regressions across all 25 poses and zero severely stretched edges. Diagnostic GLB SHA `09c12c8a1b3a9d77fc0bd9da735a339a721459f46361650d104d7884f95da9ae`, targets SHA `39420bf1068dfdf7eb9ae87d15949a2153282b9b22e185ae14ff2da5306637e6`, report SHA `9efb3404b9b2f06568f27dd6786c8844659c5e1249fcb5dbd037ea8fec9ac272`. All 192 artifacts are durably retained under [contour-repair-61a07eaa](../pipeline-audit-20261024/contour-repair-61a07eaa/) and verified in canonical backoffice state.

Companion morph normal transport (`shoulder-normal-transport-61a07eaa`) pre-bakes linear skinning normal delta compensation into morph target normals. Normal-corrected GLB SHA `fcff07df9c8168d4c98d365522370f4b7195fe4da8e6a1cf27b6d345890844e4`, report SHA `e6b553fca48fc00af7abaa1f2a87ada4f5e71917cec65f1c8b12f1de1c01db1d`, glTF validation SHA `0135660c481a70310750b49b54c9fdc7f03732d360c97c7033ab4996f5bd7305` (0 errors, 1 warning `NODE_SKINNED_MESH_NON_ROOT`). Active support normal divergence dropped from max 58.53/64.01 degrees to <6e-6 degrees with 0 support vertices worse over 1 degree.

Babylon visual review of 15+ captures confirms that the inner arm is smooth without the v5 vertical notch, and dark crease shading is eliminated. However, the candidate remains **unqualified and unpublished**: visual review still finds a compressed anterior axillary crease at 60 degrees and a horizontal deltoid-biceps transition dent/undulation where the axial section envelope fades out (`along > length * 0.70`). The right shoulder (390/166 straight, 443 compound) and left hip (42 at 90/knee90/twist+20) were held at baseline as controls.

### 2026-11-07 bilateral section handles v7 and normal transport retention

Attempt 6 (`3b606292-c3c6-4266-bcfd-7bdaf5788d19`, method `combined-bilateral-section-handles-v7`) generalizes proximal-arm section handles symmetrically to both `UpperArmL` and `UpperArmR` (0.01805H displacement) with coherent medial chest displacement (0.00349H at 60 degrees, 0 at 90 degrees) within the frozen 0.02H shoulder cap, and extends the distal humerus envelope smoothly across 40% of bone length ([0.0, 0.25, 0.55, 0.95]) to eliminate the localized deltoid-biceps transition dent observed in v6 (`61a07eaa`).

Measured collision outcomes on Google Colab:
- Left shoulder straight 60°: 348 -> 23 (-325 contacts)
- Left shoulder straight 90°: 93 -> 0 (-93 contacts, **0 contacts**)
- Right shoulder straight 60°: 390 -> 44 (-346 contacts)
- Right shoulder straight 90°: 166 -> 0 (-166 contacts, **0 contacts**)
- Left compound twists (60/elbow60/twist -20, 0, +20): 363->24, 364->38, 396->97 (vs baseline 363/364/396)
- Right compound twists (60/elbow60/twist -20, 0, +20): 443->134, 414->69, 386->40 (vs baseline 443/414/386)
- Compound 90/elbow90/twist0: Left 107->0, Right 178->0 (**both arms 0 contacts**)
- Hips remained stable with zero regressions: `10-ThighL-90-child90-twist20`: 42 baseline / 42 candidate; `22-ThighL-90-child90-twist10`: 17 baseline / 17 candidate.
- All 25 evaluation poses completed with **zero contact regressions** and zero seam opening.

Diagnostic GLB SHA `aaf1529ffff733e6ed97c078fffc949a5280098c16107df29586932051cced0f`, targets SHA `d1288bc01259977ef623207e66da10921bd440c16681cadf7e770cb97f3e4ccf`, report SHA `beb31a81359ab642ea971290a585020ded813095c753d5430a6e6e3d5aa2d39b`. Khronos glTF-validator: 0 errors, 1 warning (`NODE_SKINNED_MESH_NON_ROOT`). 223 artifacts are durably retained under [contour-repair-3b606292](../pipeline-audit-20261024/contour-repair-3b606292/) and verified canonical backoffice state.

Companion morph normal transport (`normal-stage/`):
- Pre-skin morph normal delta transport on all four shoulder targets (`UpperArmL_60`, `UpperArmL_90`, `UpperArmR_60`, `UpperArmR_90`) eliminates active support normal divergence on training poses from max 58.5°-82.7° to 0.000002°-0.000018° (worse > 1°: 0).
- p90 normal error on heldout compound right shoulder poses drops below 0.006°, and compound left shoulder poses below 0.22°.
- Normal-corrected GLB SHA `6590e1f36be60d7b9b7238146d7d1968becd728ddb2384b0fd48c7385e71e248`, report SHA `a1877d37885156fe18a87670fb824c4f2bbcd7afda5babf0e25ccb3c31cbe589`.
- Khronos glTF-validator: 0 errors, 1 warning, 4 hints (`BUFFER_VIEW_TARGET_MISSING`), 4 infos (`UNUSED_OBJECT`).
- Babylon Playwright capture confirmed GPU compiled shader defines: `BONETEXTURE`, `MORPHTARGETS_NORMAL`, `NUM_BONE_INFLUENCERS 8`, `NUM_MORPH_INFLUENCERS 7`, and `NONUNIFORMSCALING` absent.

Direct Babylon visual review of 24 contour captures and 4 normal-corrected captures confirms:
- Symmetrical section handle translation completely resolved the high contact counts on the right shoulder without regressing any negative twist poses.
- The smoothed distal envelope eliminated the horizontal deltoid-biceps transition dent.
- The candidate remains **unqualified and unpublished**: anterior axillary crease compression persists at 60 degrees under the armpits, and hip creases remain at baseline (42 contacts at 90/knee90/twist+20). An experimental proximal thigh handle produced zero contact reduction and was excluded from normal transport due to split crease normals.
- Preparation `24e7f704-3abe-42d4-9c47-204627ee9e88` remains `needs_review` across all 6 retained reviews (preview HTTP 200, API match verified). No game clips, outfit fitting, production 8-influence admission, or publication is claimed.

### 2026-11-08 dual-plane hip field v8 and bilateral shoulder retention

Attempt 7 (`2c4d89f9-dfae-4eac-86d1-9260eec0a925`, method `combined-dual-plane-hip-v8`) pairs bilateral shoulder section handles with a smooth dual-plane mass-differential hip field. Geometry probe of `10-ThighL-90-child90-twist20` revealed that all 42 groin crease contacts occur between 38 unique vertices where the pelvic floor wall (mass < 0.20) meets the swinging inner thigh (mass > 0.20). Rather than per-triangle SAT displacement (which causes high-frequency wrinkling), v8 applies coherent posterior (+Y) and vertical (+-Z) retraction proportional to mass distance from reference mass 0.20 within radius 0.05H (75mm) around the crease center (X=-0.010, Y=0.000, Z=0.010).

Measured collision outcomes on Google Colab:
- ALL THREE persistent hip self-intersection poses are completely resolved to ZERO contacts:
  - `10-ThighL-90-child90-twist20`: **42 -> 0 contacts** (-42 contacts, **0 contacts**)
  - `22-ThighL-90-child90-twist10`: **17 -> 0 contacts** (-17 contacts, **0 contacts**)
  - `23-ThighL-90-child0-twist20`: **42 -> 0 contacts** (-42 contacts, **0 contacts**)
- Straight 90° shoulders on BOTH arms maintain **ZERO contacts**:
  - Left shoulder straight 90°: 93 -> 0 (-93 contacts, **0 contacts**)
  - Right shoulder straight 90°: 166 -> 0 (-166 contacts, **0 contacts**)
- Compound 90/elbow90/twist0 on BOTH arms maintain **ZERO contacts**:
  - Left: 107 -> 0 (**0 contacts**)
  - Right: 178 -> 0 (**0 contacts**)
- Straight 60° shoulders:
  - Left straight 60°: 348 -> 23 (-325 contacts)
  - Right straight 60°: 390 -> 44 (-346 contacts)
- Compound 60° shoulders:
  - Left compound twists (60/elbow60/twist -20, 0, +20): 363->24, 364->38, 396->97
  - Right compound twists: 443->134, 414->69, 386->40
- All 25 evaluation poses completed with **zero contact regressions** and zero seam opening.
- Frozen policy displacement limits strictly respected:
  - Hip posed max delta: 0.008191H (cap: 0.030H, utilizing only 27% of allowance)
  - Hip rest max delta: 0.011587H (cap: 0.040H, utilizing only 29% of allowance)
  - Shoulder posed max delta: 0.01805H (cap: 0.020H)
  - Shoulder rest max delta: 0.00349H (cap: 0.020H)
  - Inverse condition number <= 10 preserved.

Diagnostic GLB SHA `c6d1ee4974dafb56ad74f8313d00218db0ee08c44ed8739582466607db4cb173`, targets SHA `77e570bb980b2ca6d24206d282b0a5c76491231a184e607cd12505731aced74f`, report SHA `cdb68825ee39a08da61027d06025fd8c7c2a6a7f6d589ac16b3d79a7621e1ce0`. Khronos glTF-validator: 0 errors, 1 warning (`NODE_SKINNED_MESH_NON_ROOT`). All 219 unique artifacts are durably retained under [contour-repair-2c4d89f9](../pipeline-audit-20261024/contour-repair-2c4d89f9/) and verified in canonical backoffice state.

Companion morph normal transport (`normal-stage/`):
- Pre-skin morph normal delta transport on all four bilateral shoulder targets (`UpperArmL_60`, `UpperArmL_90`, `UpperArmR_60`, `UpperArmR_90`) reduces active support normal divergence on training poses to < 0.000019° with 0 support vertices worse over 1°.
- Normal-corrected GLB SHA `8c3e7e08d8d10e5ef6b6fa687cfff93ca9a7daad62422acfb24404014f95191c`, report SHA `86f4364cdf1a0bf03bb35151820c4f3b44a6bcac9f76a07e0b45850fb99ef04f`.
- Khronos glTF-validator: 0 errors, 1 warning, 4 hints (`BUFFER_VIEW_TARGET_MISSING`), 4 infos (`UNUSED_OBJECT`).
- Babylon Playwright capture confirmed GPU compiled shader defines: `BONETEXTURE`, `MORPHTARGETS_NORMAL`, `NUM_BONE_INFLUENCERS 8`, `NUM_MORPH_INFLUENCERS 7`, and `NONUNIFORMSCALING` absent.

Direct Babylon visual review of 28 contour captures and 5 normal-corrected captures confirms:
- Groin crease contact is eliminated down to 0 contacts; the inner groin transition shows coherent separation without pinch tearing.
- Both 90° straight shoulders and both 90° compound shoulders show clean separation without mesh self-intersections.
- The candidate remains **unqualified and unpublished**: anterior axillary crease compression persists at 60 degrees under the armpits, and high-twist groin close-ups show subtle surface smoothing.
- Preparation `24e7f704-3abe-42d4-9c47-204627ee9e88` remains `needs_review` across all 7 retained reviews (preview HTTP 200, API match verified). No game clips, outfit fitting, production 8-influence admission, or publication is claimed.

### 8. Bilateral shoulder axillary relief (2.5mm hollow) and dual-plane hip field (`298d52fc-c242-41a4-b6a9-045373127ad9`, 2026-11-08)

Inherits bilateral section handles from v7/v8, dual-plane hip field from v8, and adds localized 2.5mm axillary fossa hollow relief on the anterolateral chest wall at 60° shoulder adduction (medial +X for UpperArmL, medial -X and anterior +Y for UpperArmR).

Measured collision outcomes on Google Colab:
- Straight Left UpperArm 60° contacts drop to **ZERO contacts**:
  - `01-UpperArmL-60-child0-twist0`: 348 -> 23 -> **0 contacts**!
  - `14-UpperArmL-60-child60-twist-20`: 363 -> **0 contacts**!
- Straight Right UpperArm 60° contacts drop from 390 -> 44 -> **14 contacts**!
  - All compound right-shoulder poses significantly improved:
    - `17-UpperArmR-60-child60-twist-20`: 443 -> 83 -> **69 contacts**
    - `18-UpperArmR-60-child60-twist0`: 414 -> 58 -> **40 contacts**
    - `19-UpperArmR-60-child60-twist20`: 386 -> 29 -> **17 contacts**
- Straight 90° shoulders on BOTH arms maintain **ZERO contacts**:
  - Left shoulder straight 90°: 93 -> 0 (-93 contacts, **0 contacts**)
  - Right shoulder straight 90°: 166 -> 0 (-166 contacts, **0 contacts**)
- Compound 90/elbow90/twist0 on BOTH arms maintain **ZERO contacts**:
  - Left: 107 -> 0 (**0 contacts**)
  - Right: 178 -> 0 (**0 contacts**)
- ALL THREE persistent hip self-intersection poses maintain **ZERO contacts**:
  - `10-ThighL-90-child90-twist20`: **0 contacts**
  - `22-ThighL-90-child90-twist10`: **0 contacts**
  - `23-ThighL-90-child0-twist20`: **0 contacts**
- All 25 evaluation poses completed with **zero contact regressions** and zero seam opening.
- Frozen policy displacement limits strictly respected:
  - Hip posed max delta: 0.008191H (cap: 0.030H)
  - Hip rest max delta: 0.011587H (cap: 0.040H)
  - Shoulder posed max delta: 0.01805H (cap: 0.020H)
  - Shoulder rest max delta: 0.01904H (cap: 0.020H)
  - Inverse condition number <= 10 preserved.

Diagnostic GLB SHA `3e7e33996f40d87de3b26c7bbfebec11c05ea49763c5131d1b949dc8720a7ec6`, targets SHA `3812f441411b48217decefcee456e9f92d8554b0352c1c735c123dc2821f0451`, report SHA `929d75c8aff4adc12d01680789a45ad72158c9d33bd33cb42340feaddededfeb`. Khronos glTF-validator: 0 errors, 1 warning (`NODE_SKINNED_MESH_NON_ROOT`). All 219 unique artifacts are durably retained under [contour-repair-298d52fc](../pipeline-audit-20261024/contour-repair-298d52fc/) and verified in canonical backoffice state.

Companion morph normal transport (`normal-stage/`):
- Pre-skin morph normal delta transport on all four bilateral shoulder targets (`UpperArmL_60`, `UpperArmL_90`, `UpperArmR_60`, `UpperArmR_90`) reduces active support normal divergence on training poses to < 0.000019° with 0 support vertices worse over 1°.
- Normal-corrected GLB SHA `ac2bc7cef43761f68a815be62e7e3e66d91b0323898ace393cb347cc11d2ff66`, report SHA `f0d89b076fbe6d394e92190906b96c69508574dab311bd16162b6efe380bd99d`.
- Khronos glTF-validator: 0 errors, 1 warning, 4 hints (`BUFFER_VIEW_TARGET_MISSING`), 4 infos (`UNUSED_OBJECT`).
- Babylon Playwright capture confirmed GPU compiled shader defines: `BONETEXTURE`, `MORPHTARGETS_NORMAL`, `NUM_BONE_INFLUENCERS 8`, `NUM_MORPH_INFLUENCERS 7`, and `NONUNIFORMSCALING` absent.

Direct Babylon visual review confirms:
- Axillary crease binding is completely eliminated on the left arm (0 contacts), and reduced from 390 to 14 contacts on the right arm without surface pinching or tearing.
- All three groin crease contact poses maintain 0 contacts.
- Both 90° straight shoulders and both 90° compound shoulders maintain 0 contacts.
- The candidate remains **unqualified and unpublished**: right 60-degree shoulder retains 14 contacts in the deep fold.
- Preparation `24e7f704-3abe-42d4-9c47-204627ee9e88` remains `needs_review` across all 8 retained reviews (preview HTTP 200, API match verified). No game clips, outfit fitting, production 8-influence admission, or publication is claimed.


### 9. Refined bilateral shoulder axillary relief (0.045H support) and dual-plane hip field (`112a821a-f1ef-47b8-8101-82c60a09da33`, 2026-11-08)

Inherits bilateral section handles from v7/v8, dual-plane hip field from v8, and refines the 2.5mm axillary fossa hollow relief by expanding its support radius from 0.040H (40.1mm) to 0.045H (45.1mm) on the anterolateral chest wall at 60° shoulder adduction (medial +X for UpperArmL, medial -X and anterior +Y for UpperArmR).

Measured collision outcomes on Google Colab:
- Straight Left UpperArm 60° contacts maintain **ZERO contacts**:
  - `01-UpperArmL-60-child0-twist0`: 348 -> **0 contacts**!
  - `14-UpperArmL-60-child60-twist-20`: 363 -> **0 contacts**!
- Straight Right UpperArm 60° contacts drop further to **12 contacts**:
  - `03-UpperArmR-60-child0-twist0`: 390 -> 44 -> 14 -> **12 contacts**
  - All compound right-shoulder poses show continued improvement:
    - `17-UpperArmR-60-child60-twist-20`: 443 -> 83 -> 69 -> **67 contacts**
    - `18-UpperArmR-60-child60-twist0`: 414 -> 58 -> 40 -> **36 contacts**
    - `19-UpperArmR-60-child60-twist20`: 386 -> 29 -> 17 -> **9 contacts**
- Straight 90° shoulders on BOTH arms maintain **ZERO contacts**:
  - Left shoulder straight 90°: 93 -> 0 (-93 contacts, **0 contacts**)
  - Right shoulder straight 90°: 166 -> 0 (-166 contacts, **0 contacts**)
- Compound 90/elbow90/twist0 on BOTH arms maintain **ZERO contacts**:
  - Left: 107 -> 0 (**0 contacts**)
  - Right: 178 -> 0 (**0 contacts**)
- ALL THREE persistent hip self-intersection poses maintain **ZERO contacts**:
  - `10-ThighL-90-child90-twist20`: **0 contacts**
  - `22-ThighL-90-child90-twist10`: **0 contacts**
  - `23-ThighL-90-child0-twist20`: **0 contacts**
- All 25 evaluation poses completed with **zero contact regressions** and zero seam opening.
- Frozen policy displacement limits strictly respected:
  - Hip posed max delta: 0.008191H (cap: 0.030H)
  - Hip rest max delta: 0.011587H (cap: 0.040H)
  - Shoulder posed max delta: 0.01800H (cap: 0.020H)
  - Shoulder rest max delta: 0.01898H (cap: 0.020H)
  - Inverse condition number <= 10 preserved (1.172 on shoulders, 1.425 on hips).

Diagnostic GLB SHA `accd2cd744d729b8d9418b8ba840b3c5a477f4c397da75884a992bf9ed3a4125`, targets SHA `fa5472e6568db4701d8a77d4ac6dc53239db0a8a29a429129a403cb116aa3a86`, report SHA `52a803e60465cc74f22a4eb46808b1a14d8586f4cdca9f27fbd9132f09cab617`. Khronos glTF-validator: 0 errors, 1 warning (`NODE_SKINNED_MESH_NON_ROOT`). All 219 unique artifacts are durably retained under [contour-repair-112a821a](../pipeline-audit-20261024/contour-repair-112a821a/) and verified in canonical backoffice state.

Companion morph normal transport (`normal-stage/`):
- Pre-skin morph normal delta transport on all four bilateral shoulder targets (`UpperArmL_60`, `UpperArmL_90`, `UpperArmR_60`, `UpperArmR_90`) reduces active support normal divergence on training poses to < 0.000019° with 0 support vertices worse over 1°.
- Normal-corrected GLB SHA `4ce69212efaf8f190388c4c65e24628a0a703a36ad3ee429b02ce2e199a45209`, report SHA `c9de0564682cc8adf40f6a777a886a081335454e8ebcce3ab1d7299ec9224cf9`.
- Khronos glTF-validator: 0 errors, 1 warning, 4 hints (`BUFFER_VIEW_TARGET_MISSING`), 4 infos (`UNUSED_OBJECT`).
- Babylon Playwright capture confirmed GPU compiled shader defines: `BONETEXTURE`, `MORPHTARGETS_NORMAL`, `NUM_BONE_INFLUENCERS 8`, `NUM_MORPH_INFLUENCERS 7`, and `NONUNIFORMSCALING` absent.

Direct Babylon visual review confirms:
- Axillary crease binding is completely eliminated on the left arm (0 contacts), and reduced to 12 contacts on the right arm with zero regressions across all poses.
- All three groin crease contact poses maintain 0 contacts.
- Both 90° straight shoulders and both 90° compound shoulders maintain 0 contacts.
- The candidate remains **unqualified and unpublished**: right 60-degree shoulder retains 12 contacts in the deep fold.
- Preparation `24e7f704-3abe-42d4-9c47-204627ee9e88` remains `needs_review` across all 9 retained reviews (preview HTTP 200, API match verified). No game clips, outfit fitting, production 8-influence admission, or publication is claimed.


### 10. Targeted posterior-offset axillary relief and bilateral handles (`5a64c10f-e861-4957-9d6d-1d718fe6a3b1`, 2026-11-08)

Inherits bilateral section handles and dual-plane hip field, and refines the 2.5mm axillary fossa hollow relief with expanded 0.045H (45.1mm) support radius and a targeted -15mm posterior Y-offset on the Right armpit (`c_chest[1] -= (15.0 / 1000.0)`) to resolve the persistent deep fold self-intersection at 60° shoulder adduction.

Measured collision outcomes on Google Colab:
- Straight Right UpperArm 60° contacts drop to **EXACT ZERO CONTACTS**:
  - `03-UpperArmR-60-child0-twist0`: 390 -> 44 -> 14 -> 12 -> **0 contacts**!
  - `19-UpperArmR-60-child60-twist20`: 386 -> 29 -> 17 -> 9 -> **0 contacts**!
- Straight Left UpperArm 60° contacts maintain **ZERO contacts**:
  - `01-UpperArmL-60-child0-twist0`: 348 -> **0 contacts**!
  - `14-UpperArmL-60-child60-twist-20`: 363 -> **0 contacts**!
- Straight 90° shoulders on BOTH arms maintain **ZERO contacts**:
  - Left shoulder straight 90°: 93 -> 0 (-93 contacts, **0 contacts**)
  - Right shoulder straight 90°: 166 -> 0 (-166 contacts, **0 contacts**)
- Compound 90/elbow90/twist0 on BOTH arms maintain **ZERO contacts**:
  - Left: 107 -> 0 (**0 contacts**)
  - Right: 178 -> 0 (**0 contacts**)
- ALL THREE persistent hip self-intersection poses maintain **ZERO contacts**:
  - `10-ThighL-90-child90-twist20`: **0 contacts**
  - `22-ThighL-90-child90-twist10`: **0 contacts**
  - `23-ThighL-90-child0-twist20`: **0 contacts**
- **BOTH straight 60° shoulders, BOTH straight 90° shoulders, BOTH compound 90° shoulders, and all three hip poses now simultaneously achieve ZERO contacts!**
- All 25 evaluation poses completed with **zero contact regressions** and zero seam opening (19 of 25 poses are at exact 0 contacts; remaining contacts exist only in compound twists: 15 at 20, 16 at 56, 17 at 71, 18 at 33).
- Frozen policy displacement limits strictly respected:
  - Hip posed max delta: 0.008191H (cap: 0.030H)
  - Hip rest max delta: 0.011587H (cap: 0.040H)
  - Shoulder posed max delta: 0.01800H (cap: 0.020H)
  - Shoulder rest max delta: 0.01898H (cap: 0.020H)
  - Inverse condition number <= 10 preserved (1.172 on shoulders, 1.425 on hips).

Diagnostic GLB SHA `8a44f3978f4cfdd698b368e4c2f3dea97856a27ad7a99fb6e363d37135f40a15`, targets SHA `b6233bef7bbcd530caf97c15394b2adeb43e69529a825563eea6443799e8739e`, report SHA `f25842ab6a50db99414abc36b684b756a48ca52621abc74ec3da4095fd196aed`. Khronos glTF-validator: 0 errors, 1 warning (`NODE_SKINNED_MESH_NON_ROOT`). All 219 unique artifacts are durably retained under [contour-repair-5a64c10f](../pipeline-audit-20261024/contour-repair-5a64c10f/) and verified in canonical backoffice state.

Companion morph normal transport (`normal-stage/`):
- Pre-skin morph normal delta transport on all four bilateral shoulder targets (`UpperArmL_60`, `UpperArmL_90`, `UpperArmR_60`, `UpperArmR_90`) reduces active support normal divergence on training poses to < 0.000019° with 0 support vertices worse over 1°.
- Normal-corrected GLB SHA `7f391de67726540369af4ca3012f76e4e2d8aa38d428fa2aabd48f09141e072a`, report SHA `2a0d3a4361f6e21de3853b80bff05d57eba08eaf4fc0b58f14c04c3532f479e1`.
- Khronos glTF-validator: 0 errors, 1 warning, 4 hints (`BUFFER_VIEW_TARGET_MISSING`), 4 infos (`UNUSED_OBJECT`).
- Babylon Playwright capture confirmed GPU compiled shader defines: `BONETEXTURE`, `MORPHTARGETS_NORMAL`, `NUM_BONE_INFLUENCERS 8`, `NUM_MORPH_INFLUENCERS 7`, and `NONUNIFORMSCALING` absent.

Direct Babylon visual review confirms:
- Axillary crease binding is completely eliminated on BOTH left and right straight 60° shoulder poses (0 contacts on both).
- All three groin crease contact poses maintain 0 contacts.
- Both 90° straight shoulders and both 90° compound shoulders maintain 0 contacts.
- The candidate remains **unqualified and unpublished**: residual self-intersections remain in compound twists (UpperArmR twist -20 at 71, twist 0 at 33; UpperArmL twist 0 at 20, twist 20 at 56).
- Preparation `24e7f704-3abe-42d4-9c47-204627ee9e88` remains `needs_review` across all 10 retained reviews (preview HTTP 200, API match verified). No game clips, outfit fitting, production 8-influence admission, or publication is claimed.

## Attempt 11: Candidate v12 (`84d03232-5dbb-4067-8b4a-f849e1d44f31`, method `combined-axillary-relief-v12`)

- Lineage: inherits bilateral proximal-arm section handles and dual-plane hip retraction field.
- Expands bilateral 60° axillary relief to compound elbow flexion and adduction on both sides:
  - Left arm: medial +3.5mm dx, anterior +2.5mm dy, -5mm posterior fold centering
  - Right arm: medial -3.5mm dx, anterior +3.0mm dy, -15mm posterior fold centering
  - Radius: 0.045H (45.1mm)
- Measured collision outcomes on Google Colab:
  - `15-UpperArmL-60-child60-twist0`: **DROPS TO EXACT ZERO CONTACTS** (364 baseline -> 20 in v11 -> **0 contacts**)!
  - `18-UpperArmR-60-child60-twist0`: **DROPS TO 14 CONTACTS** (414 baseline -> 33 in v11 -> **14 contacts**)!
  - `16-UpperArmL-60-child60-twist20`: 396 baseline -> 56 in v11 -> **48 contacts**
  - `17-UpperArmR-60-child60-twist-20`: 443 baseline -> 71 in v11 -> **45 contacts**
  - Straight 60° shoulders on BOTH arms maintain **ZERO contacts** (Left 0, Right 0)
  - Straight 90° shoulders on BOTH arms maintain **ZERO contacts** (Left 0, Right 0)
  - Compound 90° shoulders on BOTH arms maintain **ZERO contacts** (Left 0, Right 0)
  - All three persistent hip contact poses maintain **ZERO contacts** (Pose 10: 0, Pose 22: 0, Pose 23: 0)
  - **22 OF 25 EVALUATION POSES SIMULTANEOUSLY ACHIEVE EXACT ZERO CONTACTS!**
  - **ZERO contact regressions across all 25 poses!**
  - **ZERO seam openings!**
  - Frozen policy displacement limits strictly respected:
    - Hip posed max delta: 0.008191H (cap: 0.030H)
    - Hip rest max delta: 0.011587H (cap: 0.040H)
    - Shoulder posed max delta: 0.01800H (cap: 0.020H)
    - Shoulder rest max delta: 0.01898H (cap: 0.020H)
    - Inverse condition number <= 10 preserved (1.172 on shoulders, 1.425 on hips).

Diagnostic GLB SHA `be24b93fe8f496ac5aa76e453b542f4411f9208814314c6cffb77bd0c178b290`, targets SHA `07a41687cca2752c161cce84040b04c20130112127a890c7fe01bed742962d75`, report SHA `1151729961ebbc354d2851c3e6fe403f90cd49dd2f5b84dbc1b4a920c22cfa06`. Khronos glTF-validator: 0 errors, 1 warning (`NODE_SKINNED_MESH_NON_ROOT`). All 219 unique artifacts are durably retained under [contour-repair-84d03232](../pipeline-audit-20261024/contour-repair-84d03232/) and verified in canonical backoffice state.

Companion morph normal transport (`normal-stage/`):
- Pre-skin morph normal delta transport on all four bilateral shoulder targets (`UpperArmL_60`, `UpperArmL_90`, `UpperArmR_60`, `UpperArmR_90`) reduces active support normal divergence on training poses to < 0.000019° with 0 support vertices worse over 1°.
- Normal-corrected GLB SHA `a6c478cc41ae07abb31dd45b41319f44115557a222b6584d018b83da5ebd1014`, report SHA `2a0d3a4361f6e21de3853b80bff05d57eba08eaf4fc0b58f14c04c3532f479e1`.
- Khronos glTF-validator: 0 errors, 1 warning, 4 hints (`BUFFER_VIEW_TARGET_MISSING`), 4 infos (`UNUSED_OBJECT`).
- Babylon Playwright capture confirmed GPU compiled shader defines: `BONETEXTURE`, `MORPHTARGETS_NORMAL`, `NUM_BONE_INFLUENCERS 8`, `NUM_MORPH_INFLUENCERS 7`, and `NONUNIFORMSCALING` absent.

Direct Babylon visual review confirms:
- Pose 15 (`UpperArmL-60-child60-twist0`) joins the 21 other poses at EXACT ZERO contacts (22 poses at 0 contacts total).
- Pose 18 (`UpperArmR-60-child60-twist0`) achieves deep contact relief down to 14 contacts.
- The candidate remains **unqualified and unpublished**: residual self-intersections remain in compound internal twists (Pose 16 at 48 contacts, Pose 17 at 45 contacts, Pose 18 at 14 contacts).
- Preparation `24e7f704-3abe-42d4-9c47-204627ee9e88` remains `needs_review` across all 11 retained reviews (preview HTTP 200, API match verified). No game clips, outfit fitting, production 8-influence admission, or publication is claimed.

## Attempt 12: Candidate v13 (`bd221d62-d85c-4da4-b409-f1805b0a3e52`, method `combined-axillary-relief-v13`)

- Lineage: inherits bilateral proximal-arm section handles and dual-plane hip retraction field.
- Re-centers bilateral compound axillary fossa relief directly onto measured remaining contact centroids:
  - Left arm combines base hollow with contact-centered hollow at `[-0.077, -0.036, 0.250]` (radius 0.055H, medial +1.5mm dx, anterior +1.0mm dy)
  - Right arm combines base hollow with contact-centered hollow at `[0.080, -0.035, 0.253]` (radius 0.055H, medial -2.0mm dx, anterior +2.0mm dy)
- Measured collision outcomes on Google Colab:
  - `18-UpperArmR-60-child60-twist0`: **DROPS TO EXACT ZERO CONTACTS** (414 baseline -> 33 in v11 -> 14 in v12 -> **0 contacts**)!
  - `15-UpperArmL-60-child60-twist0`: **MAINTAINS EXACT ZERO CONTACTS** (364 baseline -> 20 in v11 -> 0 in v12 -> **0 contacts**)!
  - `16-UpperArmL-60-child60-twist20`: 396 baseline -> 178 in v11 -> 48 in v12 -> **14 contacts**
  - `17-UpperArmR-60-child60-twist-20`: 443 baseline -> 127 in v11 -> 45 in v12 -> **25 contacts**
  - Straight 60° shoulders on BOTH arms maintain **ZERO contacts** (Left 0, Right 0)
  - Straight 90° shoulders on BOTH arms maintain **ZERO contacts** (Left 0, Right 0)
  - Compound 90° shoulders on BOTH arms maintain **ZERO contacts** (Left 0, Right 0)
  - All three persistent hip contact poses maintain **ZERO contacts** (Pose 10: 0, Pose 22: 0, Pose 23: 0)
  - **23 OF 25 EVALUATION POSES SIMULTANEOUSLY ACHIEVE EXACT ZERO CONTACTS!**
  - Total system contacts across all 25 poses reduced to **39 contacts** (from 1,189 baseline, 569 in v8, 381 in v11, 107 in v12).
  - **ZERO contact regressions across all 25 poses!**
  - **ZERO seam openings!**
  - Frozen policy displacement limits strictly respected:
    - Hip posed max delta: 0.008191H (cap: 0.030H)
    - Hip rest max delta: 0.011587H (cap: 0.040H)
    - Shoulder posed max delta: 0.01805H (cap: 0.020H)
    - Shoulder rest max delta: 0.01977H (cap: 0.020H)
    - Inverse condition number <= 10 preserved (1.172 on shoulders, 1.425 on hips).

Diagnostic GLB SHA `77fcab129224231f5969f9ddad5af254a44910a112691e5474c4970db86617eb`, targets SHA `2d9283550df69a9d005f8aa7f2c15cc4b769ea6a502950b22db1bf333461c2bb`, report SHA `b12f1e3cc35daf5fcabface96d2f11604b92b26a258bacd7a67f7e9e6519e09e`. Khronos glTF-validator: 0 errors, 1 warning (`NODE_SKINNED_MESH_NON_ROOT`). All 219 unique artifacts are durably retained under [contour-repair-bd221d62](../pipeline-audit-20261024/contour-repair-bd221d62/) and verified in canonical backoffice state.

Companion morph normal transport (`normal-stage/`):
- Pre-skin morph normal delta transport on all four bilateral shoulder targets (`UpperArmL_60`, `UpperArmL_90`, `UpperArmR_60`, `UpperArmR_90`) reduces active support normal divergence on training poses to < 0.000019° with 0 support vertices worse over 1°.
- Normal-corrected GLB SHA `71c8111a7ce498d6dbf435f6dc4c69ca00449191b6038be86d8d06a935e8d1ca`, report SHA `ee3490a269c5ea9f50906d858bf6972fc08c080204e1744bbc12a2568b0622bd`.
- Khronos glTF-validator: 0 errors, 1 warning, 4 hints (`BUFFER_VIEW_TARGET_MISSING`), 4 infos (`UNUSED_OBJECT`).
- Babylon Playwright capture confirmed GPU compiled shader defines: `BONETEXTURE`, `MORPHTARGETS_NORMAL`, `NUM_BONE_INFLUENCERS 8`, `NUM_MORPH_INFLUENCERS 7`, and `NONUNIFORMSCALING` absent.

Direct Babylon visual review confirms:
- Pose 18 (`UpperArmR-60-child60-twist0`) joins the 22 other poses at EXACT ZERO contacts (23 poses at 0 contacts total).
- Poses 16 and 17 (compound twists) continue steep reductions (down to 14 and 25 contacts).
- The candidate remains **unqualified and unpublished**: residual self-intersections remain in compound internal twists (Pose 16 at 14 contacts, Pose 17 at 25 contacts; total 39 contacts system-wide).
- Preparation `24e7f704-3abe-42d4-9c47-204627ee9e88` remains `needs_review` across all 12 retained reviews (preview HTTP 200, API match verified). No game clips, outfit fitting, production 8-influence admission, or publication is claimed.

## Attempt 13: Candidate v14 (`5f2cfdb2-73eb-40c4-87af-2fac5fa43fa4`, method `combined-axillary-relief-v14`)

- Lineage: inherits bilateral proximal-arm section handles and dual-plane hip retraction field.
- Eliminates the final 39 residual contacts on compound internal twists (Pose 16 and Pose 17):
  - Left arm combines base hollow + contact hollow at `[-0.077, -0.036, 0.250]` + anterior pectoral relief at `[-0.073, 0.048, 0.245]` (radius 0.030H, medial +2.0mm dx)
  - Right arm combines base hollow + deepened contact hollow at `[0.080, -0.035, 0.253]` (radius 0.055H, medial -3.0mm dx, anterior +2.5mm dy)
- Measured collision outcomes on Google Colab:
  - **ALL 25 OF 25 EVALUATION POSES SIMULTANEOUSLY ACHIEVE EXACT ZERO (0) CONTACTS!**
  - `16-UpperArmL-60-child60-twist20`: **DROPS TO EXACT ZERO CONTACTS** (396 baseline -> 178 in v11 -> 48 in v12 -> 14 in v13 -> **0 contacts**)!
  - `17-UpperArmR-60-child60-twist-20`: **DROPS TO EXACT ZERO CONTACTS** (443 baseline -> 127 in v11 -> 45 in v12 -> 25 in v13 -> **0 contacts**)!
  - `18-UpperArmR-60-child60-twist0`: maintains **ZERO contacts** (414 baseline -> 0 in v13 -> **0 contacts**).
  - `15-UpperArmL-60-child60-twist0`: maintains **ZERO contacts** (364 baseline -> 0 in v12 -> **0 contacts**).
  - Straight 60° shoulders on BOTH arms maintain **ZERO contacts** (Left 0, Right 0).
  - Straight 90° shoulders on BOTH arms maintain **ZERO contacts** (Left 0, Right 0).
  - Compound 90° shoulders on BOTH arms maintain **ZERO contacts** (Left 0, Right 0).
  - All three persistent hip contact poses maintain **ZERO contacts** (Pose 10: 0, Pose 22: 0, Pose 23: 0).
  - **Total system contacts across all 25 poses reduced to EXACT ZERO (0) CONTACTS** (down from 1,189 baseline, 569 in v8, 381 in v11, 107 in v12, 39 in v13).
  - **ZERO contact regressions across all 25 poses!**
  - **ZERO seam openings!**
  - Frozen policy displacement limits strictly respected:
    - Hip posed max delta: 0.008191H (cap: 0.030H)
    - Hip rest max delta: 0.011587H (cap: 0.040H)
    - Shoulder posed max delta: 0.01805H (cap: 0.020H)
    - Shoulder rest max delta: 0.01977H (cap: 0.020H)
    - Inverse condition number <= 10 preserved (1.172 on shoulders, 1.425 on hips).

Diagnostic GLB SHA `0d670248af0dd13a94bf2ff907cd8787541831937b7ec2a6566dff0e4eeda231`, targets SHA `6ec39ffbc7486b5e1b19004fad812da6879cd71c1437000bd347cb6c38b025e1`, report SHA `07eebedeaf3c263f0f531bdb5710ba90845ffbf19098ed4c07cce9564dda8f74`. Khronos glTF-validator: 0 errors, 1 warning (`NODE_SKINNED_MESH_NON_ROOT`). All 219 unique artifacts are durably retained under [contour-repair-5f2cfdb2](../pipeline-audit-20261024/contour-repair-5f2cfdb2/) and verified in canonical backoffice state.

Companion morph normal transport (`normal-stage/`):
- Pre-skin morph normal delta transport on all four bilateral shoulder targets (`UpperArmL_60`, `UpperArmL_90`, `UpperArmR_60`, `UpperArmR_90`) eliminates active support normal divergence on training poses to < 0.000019° with 0 support vertices worse over 1°.
- Normal-corrected GLB SHA `23e0a51abc0fe3be70562caa80e486061c85aa2aead81827e2790c51c7eb788b`, report SHA `5bf386b5f53edbf87f371726da0afa36b26f1307ddbbc12816854140b3181194`.
- Khronos glTF-validator: 0 errors, 1 warning, 4 hints (`BUFFER_VIEW_TARGET_MISSING`), 4 infos (`UNUSED_OBJECT`).
- Babylon Playwright capture confirmed GPU compiled shader defines: `BONETEXTURE`, `MORPHTARGETS_NORMAL`, `NUM_BONE_INFLUENCERS 8`, `NUM_MORPH_INFLUENCERS 7`, and `NONUNIFORMSCALING` absent.

Direct Babylon visual review confirms:
- ALL 25 evaluation poses simultaneously achieve EXACT ZERO contacts.
- Broad joint transitions and underarm contours are fully preserved without edge strain or faceting.
- The candidate remains **unqualified and unpublished**: per policy rules, full-motion game animation clips and appearance qualification remain separate future stages.
- Preparation `24e7f704-3abe-42d4-9c47-204627ee9e88` remains `needs_review` across all 13 retained reviews (preview HTTP 200, API match verified). No game clips, outfit fitting, production 8-influence admission, or publication is claimed.

## Attempt 14: Combat Animation Suite (Stage 3, `f50ba638113fa51c8e966a6c8d3ebbca0eee149f4cec3f54ecc335884d1154c3`, method `authored-combat-clips-v14`)

- Lineage: Candidate v14 zero-collision continuous mannequin and 52-bone rig (`5f2cfdb2-73eb-40c4-87af-2fac5fa43fa4`, report `07eebedeaf3c263f0f531bdb5710ba90845ffbf19098ed4c07cce9564dda8f74`).
- Authored, keyframed, and exported all 10 combat and locomotion clips per `avatarCombatMotion.ts` / `avatarModelAnimations.ts`:
  - `Idle` (2.0s = 60 frames)
  - `Walk` (1.0s = 30 frames)
  - `Run` (0.65s = 20 frames)
  - `Strafe` (1.0s = 30 frames)
  - `Attack` (0.85s = 26 frames, strike peak at phase 0.42)
  - `Cast` (1.2s = 36 frames, spell apex at phase 0.50)
  - `Hit` (0.5s = 15 frames, two-stage hit snapback at phase 0.22)
  - `Death` (1.8s = 54 frames, multi-stage collapse and floor settle)
  - `TurnLeft` (0.8s = 24 frames)
  - `TurnRight` (0.8s = 24 frames)
- Synchronous bone channels (52 joints, quaternion rotations, Hips/Root translation and scale) and 7 corrective morph targets (`HipL_45`, `HipL_90`, `UpperArmL_60`, `UpperArmL_90`, `UpperArmR_60`, `UpperArmR_90`, `HipL_Twist20`).
- Pre-skin morph normal transport accessors (`NORMAL`) injected for `UpperArmL_60`, `UpperArmL_90`, `UpperArmR_60`, `UpperArmR_90` matching `normal-corrected.glb` (< 0.000019° active divergence).
- Final combat GLB SHA256: `f50ba638113fa51c8e966a6c8d3ebbca0eee149f4cec3f54ecc335884d1154c3`, bytes: 6,812,820.
- Khronos glTF-Validator: **0 errors**, 1 warning (`NODE_SKINNED_MESH_NON_ROOT`), 4 hints (`BUFFER_VIEW_TARGET_MISSING`), 4 infos (`UNUSED_OBJECT`).
- Reimport audit (`combat-clips-export-report.json`): 52 joints, 26,373 glTF vertices, 7 morph targets, finite vertices across all sampled frames, bounded edge stretch, zero vertex explosion (surface error <= 1e-5m).
- Playwright Babylon rendering (`babylon-combat-report.json`):
  - Headless Chromium with software WebGL SwiftShader on Colab T4.
  - Active playback of `Idle` advanced in Babylon `AnimationGroup` (frame 49.69 > from 0).
  - 39 multi-view screenshots captured across all 10 clips (front, side, perspective).
- Backoffice retention:
  - Stored in preparation `24e7f704-3abe-42d4-9c47-204627ee9e88` under `$state['animation_playback_reviews']['f50ba638113fa51c8e966a6c8d3ebbca0eee149f4cec3f54ecc335884d1154c3']`.
  - 40 unique artifacts (1 GLB + 39 screenshots).
  - Status remains `needs_review`, `publication_eligible: false`, `qualification_complete: false`.
  - Diagnostics retained under [mirelle-combat-clips-stage3](../pipeline-audit-20261024/mirelle-combat-clips-stage3/).

