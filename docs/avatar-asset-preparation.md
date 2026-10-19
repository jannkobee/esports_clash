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
