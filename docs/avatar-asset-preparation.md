# Asset Preparation and cancellation (2026-10-19)

## Latest owner update: manual UniRig jobs and report deletion

The owner removed visual auto-admission and selected UniRig. The earlier continuous/local-surface-transfer sections below are historical. New jobs are owner-started, use actual UniRig skeleton/skin prediction, and require a separate native clip mapping/qualification stage. Read [unirig-manual-visual-workflows.md](unirig-manual-visual-workflows.md) and [the UniRig worker guide](../infrastructure/unirig/README.md). ML automation is unchanged. Delete report controls redact dashboard database details; worker artifacts/live asset metadata are separate. No avatar inference or qualification was run as part of this integration.


Owner request: implement the preparation/rigging/animation/qualification/deployment pipeline and add cancellation across it. Earlier generated-outcome verification remains deferred. The implementation is deployed locally; no new generated model is certified or published by this work.

## Dashboard and workflow

Sign in at http://localhost:8089/evolution/avatars/preparation using the existing Evolution Owner account. Navigation keeps **3D Generation**, **Asset Preparation**, **3D Enhancements** and **ML reports** separate.

1. Continuous preparation is enabled initially. Each minute the scheduler admits at most one previously unattempted completed source across the catalog. One bounded CPU asset worker runs at a time; RAM/storage admission can pause it. Pausing the schedule stops new admissions, while individual jobs remain controllable.
2. Manual preparation selects a completed generation, character profile, facing correction and optional native-bone attachment regions. Source/donor/baseline/engine hashes are frozen. Original assets and generated sources are never overwritten.
3. Blender aligns the mesh to this character's existing template, transfers up to four normalized influences per vertex from the actual native skin surface, keeps the tagged game hierarchy/skeleton/sockets/native actions, bounds geometry/textures and exports a separate GLB and packed editable Blender scene. Native clip timing is reused; this is not a newly authored animation library or arbitrary source-code rewriting.
4. The job stops at **Awaiting validation**. The owner may inspect/play the actual native GLB clips, compare baseline/candidate through the existing game asset/animation/contact/VFX renderer, and download evidence. Merely viewing a preview does not qualify it.
5. **Run runtime qualification** explicitly starts official glTF checks, sampled Blender posed finite-geometry/self-intersection/weight checks, standardized front/side/back/combat/ability previews and actual game renderer checks. Budgets compare draw calls, local frame cost, foot-drift and blend-jump measurements against the frozen live baseline. A failing candidate becomes **Needs review**; it cannot publish. Repair requires a new preparation/profile, not ignoring a failed gate.
6. **Ready** still requires a human identity/equipment/team-readability/attachment review checkbox. Publication rechecks remote evidence, source/engine/candidate hashes and current baseline under row locks, creates a new immutable visual release and schedules the existing trusted health canary. Existing scenes retain their pinned version. Visual history provides rollback; repeated trusted canary failures can quarantine and restore a healthy predecessor or shipped fallback. No deployment is performed merely because a file exists.

The common humanoid transfer is a candidate-construction method. Skin proximity is not an artistic score or proof of correct anatomy. The fox avatar and non-humanoid body classes require a custom profile. Unusual appendages need actual matching native bones; an attachment region cannot invent a tail rig. Fused weapons, robes, hidden anatomy, wrong reference pose or nonmatching topology can require mesh separation/retopology/manual repair. This implementation does not claim arbitrary TRELLIS output becomes a production-quality animated character automatically.

Attachment JSON uses normalized aligned Blender X/Y/Z coordinates (Z is height), for example `[{"bone":"HandR","min":[0.7,0,0.3],"max":[1,1,0.7]}]`. At most 32 regions are accepted. A region rigidly binds enclosed vertices to an existing named bone; invalid bones fail. Overlapping regions use the later entry. This is optional constrained data, never generated executable code.

## Cancellation contract

Each active generation, preparation or enhancement has **Cancel**. Each workflow also has **Cancel all**. Cancel all preparation/enhancement additionally pauses that workflow's schedule; generation has no automatic generation schedule. Gameplay ML keeps its existing independent stop control and is unaffected.

- Laravel immediately commits **Cancelling**, blocking late poll updates, validation and publication. A durable job and minute-based recovery retry stop delivery.
- The owning worker writes a persistent cancellation tombstone, stops only that job's owned Blender/Chromium/node or Comfy process tree and acknowledges **Cancelled** after process exit. Other workloads are not killed. Existing artifacts/reports remain retained. A missing/unavailable endpoint never counts as acknowledgement.
- Admission checks and terminal-state guards stop a late/stale queue message from resurrecting a cancelled run, including jobs cancelled before they ever reached a worker. Published releases are managed through rollback, not job cancellation.
- An individual cancellation does not silently disable the entire schedule. Automatic preparation never recreates an already attempted/cancelled source; deliberate manual preparation is available as a new version.

GPU cancellation uses read-only `infrastructure/trellis2/control.py` around the byte-identical deployed inference bridge. It separately reports `control_sha256`, guards saves with tombstones and cancels the coroutine while awaiting normal Comfy teardown. Native image/checkpoint/service/plan hashes remain unchanged in the current deployment. A future full native image rebuild still requires fresh matching diagnostics; cancellation is not an exemption from native GPU admission.

## Implementation and deployment boundary

- Additive tables: `avatar_preparations`, `avatar_preparation_settings`; database backup retained in ignored `.local-tools/backups/before-avatar-preparation-20261019.dump`. The first migration attempt caught an incorrect Schema import before changes; corrected migration applied successfully without resets.
- Laravel: `AvatarPreparationService`, `AvatarJobCancellationService`, controllers, poll/cancel jobs, minute recovery and Blade pages. Version-3 preparation publication records reuse the existing release FK/canary infrastructure and are excluded from enhancement report lists.
- Worker: `preparation-server.mjs`, `preparation-job.mjs`, `prepare-avatar.py`, `qualify-prepared.py`; readonly TRELLIS outputs are inputs. Existing Docker image supplies the pinned Blender, Three.js, glTF validator and actual game reviewer. Dev mounts make PHP/Blade/CSS/JS visible on reload; worker code is restarted between workloads and frozen by plan fingerprints.
- No game simulation/renderer/squad source changed. Mechanical stats, collision, hitboxes, combat timing, tower/well/Nexus rules, attribution, objectives, steering and parody aliases are unchanged. Existing ability VFX/identity are reused, not rebalanced or autonomously redesigned here. The supplied Arsenaldo default remains selected; catalog releases target their existing `current`/`claude` variant and do not force a studio preference change.
- Original ML runner/image and paused older enhancement schedule are preserved. No Vercel deployment, paid image provider, source-asset deletion or live candidate promotion.

Verification performed: PHP/Node/Python syntax checks, Blade compilation, backup/additive migration and Docker startup/readiness checks. **No generated outcome inspection, rigging-result review, qualification run, feature-test execution, browser validation or live publication was performed**, as requested. Added backend regression tests cover owner authorization, pending cancellation, late poll protection, outage recovery, frozen source preparation and refusal to publish cancelled/unqualified candidates; they remain unrun. Do not reuse earlier passing test counts as evidence for this milestone.

Implementation references: [Blender glTF exporter](https://docs.blender.org/api/4.5/bpy.ops.export_scene.html), [Blender slotted-action migration](https://developer.blender.org/docs/release_notes/4.4/upgrading/slotted_actions/). Exported rigs/animation slots still require actual candidate qualification; documentation lookup is not runtime evidence.


## 2026-10-19 progress and bulk controls

See `preparation-progress-and-deletion.md` for the current observed stage tracker, detailed transition messages and atomic bulk preparation-report deletion. This supersedes the earlier minimal status-only history; manual qualification and publication gates remain unchanged.


## 2026-10-19: Conservative automatic humanoid mapping

Owner authorized per-model automatic mapping and asked whether it reduces errors. New bone_mapping.py uses rest positions and skeleton topology, never numeric names. Existing explicit maps/native/Mixamo aliases retain priority. Fallback requires a single root/pelvis, unambiguous torso/head and paired limb chains, measured limb proportions, opposing limb sides and toe-confirmed forward orientation. Conflicts, missing joints, unsupported anatomy or uncertain orientation stay awaiting_retarget. Evidence/reasons/warnings are stored in mapping_review and exposed in the Laravel preparation details; long hand branches require equipment/influence review and remain qualification problems. Automatic mapping is technical compatibility screening, not an artistic score or guarantee against clipping/poor skin weights.

Engine manifest includes the new module, image COPY already includes it, and Docker dev mounts it. Deployed on idle avatar worker; manual admission unchanged, existing frozen preparations/reports untouched. Actual Blender4.5.3 import of the current Dawnna rig yields all17 reviewed joints, with bone20 equipment warning. Eight unit tests cover real rest skeleton, arbitrary renumbering/order, scale/translation, reversed facing, missing toe, extra pelvis branch, collapsed leg and nonfinite input. No new GPU inference, no live publication and no gameplay changes. Existing awaiting_retarget attempts require a new manually admitted preparation under the updated engine.


## 2026-10-19: Attachment/animation correction, remaining contact gates

Owner authorized repair of current Dawnna's long hand branch and six self-clipping failures. Separate diagnostic candidate now resolves the opposite-hand attachment using actual skin evidence; neutral-relative native animation transfer and algebraic hip-to-weighted-root motion remove imported stance and stationary-garment deformation. Bounded equipment-specific Attack/Death motion gains retain clip timing. Unchanged sampled clipping checks now pass (worst140?24, limit28); skin weights, rest geometry and clip ranges preserved. Actual game renderer passes, but baseline foot drift5.19045>1.26013 and hand-blend jump0.51861>0.51625 still block release. No publication or historical report overwrite; no new GPU inference/queue admission. Future manual preparations use deployed corrections. Details/evidence/tests/limits: dawnna-motion-repair-20261019.md. Gameplay and ML unchanged.


## 2026-10-19: Foot contact and hand-blend regressions corrected

Owner reported the remaining planted_foot_step_drift/blend_hand_step_jump failures. A separate corrected candidate now measures0.576513/0.513101 against the native1.260133/0.516251, with unchanged tolerances and passing sampled clipping. Added phase-synchronized prepared locomotion, measured-length two-bone contact IK with reachable-pelvis solve, proportionate swing lift, closed gait endpoints and connected shield-carry elbow clearance; refined equipment Attack gain0.65?0.64. Skin weights, rest geometry, joint lengths, clip durations and all mechanical timing remain unchanged. Rebuilt/deployed worker; original reports stay immutable, visual jobs remain manual, no new GPU inference or live publication. Details/evidence/checks/remaining identity-release requirements: dawnna-contact-repair-20261019.md. Required full game/build check outcomes appended when complete.

## 2026-10-19: General 3D pipeline fixes, Livewire integration, and categorized backoffice UI rework

- **Permanent Avatar-Agnostic 3D Pipeline:**
  - `mesh_validation.py`: Added cyclic triangle permutation tree (`shifted = BVHTree.FromPolygons(points, [(f[1], f[2], f[0]) for f in faces], all_triangles=True)`) and symmetric orientation pair queries. Collision measurement is strictly invariant under arbitrary face/vertex permutations and winding. All 9 tests in `test_mesh_pipeline.py` pass.
  - `equipment_skin.py`: Added general `regularize_skin_weights(obj, rig, mapped_bones, equipment_repairs)` to automatically remap unmapped helper bones (clavicles, fingers, toes, hair/cape chains) into anatomical ancestors, damp high-shear distal limb weights toward torso roots, and regularize connected single-mesh skin weights through a 3D volumetric trilinear weight field while preserving 100% rigid binding on disconnected equipment components (`bone_20`, weapons, shields).
  - `retarget-unirig.py` & `retarget_contacts.py`: Zeroed non-root bone translations to keep hip sockets and limbs intact; initialized rest leg transforms before two-bone IK; centered contact reference Y under thigh socket head Y; anchored rigid equipment bone transforms to follow the linear-blend-skinned arm deformation surface.
- **Backoffice Livewire & Categorized UI:**
  - Integrated `livewire/livewire` v4.4.7 with `@livewireStyles`, `@livewireScripts`, and `wire:navigate`.
  - Upgraded `evolution.js` and `evolution.css` to provide seamless no-reload form handling (AJAX submissions, button loading spinners, DOM morphing, scroll/details state retention, and glassmorphic toast notifications).
  - Categorized all backoffice information into clean failure vs success cards (`.failure-box` vs `.success-box`), interactive status filter pills (`[All]`, `[✓ Succeeded / Ready]`, `[✕ Issues / Failed]`, `[⏳ Active / Running]`), compact `.stat-chips`, and folded raw technical details inside `<details class="clean-details">`.
- **Verification:**
  - All 94 PHPUnit tests in `EsportsClash.Api` pass.
  - All 452 game tests, 3 batch simulations, and TypeScript checks in `EsportsClash.Web` pass.

