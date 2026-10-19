# UniRig, manual visual jobs and report deletion (2026-10-19)

Latest owner instructions: **"do unirig, continue"**, add report delete buttons, and **"don't auto run queue for the asset preparations and 3d, I will run it"**. Remove visual enhancement automation; retain ML automation. These supersede the earlier continuous-preparation admission behavior.

## Owner controls

- **3D Generation**: http://localhost:8089/evolution/avatars/trellis. Queue each desired source explicitly; generation has no roster schedule.
- **Asset Preparation**: http://localhost:8089/evolution/avatars/preparation. Select a completed source and queue the local UniRig provider explicitly. The previous local surface-transfer provider cannot accept new plans or publish a new candidate. Old reports/assets remain historical and can be deleted through the report controls.
- **3D Enhancements**: http://localhost:8089/evolution/avatars. Start analysis explicitly. The automatic schedule UI/admission is removed. Health monitoring and rollback for existing published versions remain safety operations; they do not generate a new design.
- **ML reports**: http://localhost:8089/evolution/ml/reports. Learning schedules/runner/checkpoints and balance review deadlines/approval behavior remain unchanged.

The deployment transition disabled preparation/enhancement settings and requested cancellation for six automatically started visual jobs. No new visual task is automatically submitted. Minute-based commands only recover existing requested polls/cancellations and monitor live assets; `AvatarPreparationService::tick()` and scheduled enhancement admission are no-ops. Existing manually requested generation jobs are not silently replaced or duplicated. Services stay available while idle.

## UniRig boundary

Read [the local worker guide](../infrastructure/unirig/README.md) for pinned source/checkpoints, installation, shared GPU lease, private authentication, memory admission and cancellation. The provider predicts both a skeleton and skin weights from the actual generated mesh. A separate Blender adapter attempts native clip retargeting while preserving those predicted skin weights. Missing/ambiguous bones stop at Awaiting retarget and are visible in the report; arbitrary nearest-bone naming is not treated as compatibility.

The new bone-map editor maps native names to actual predicted UniRig names. New preparations freeze the UniRig engine, source/donor/baseline hashes, seed and map. New source/rig files remain candidates. Qualification and identity/equipment review remain gates; no gameplay stats, hitboxes or hit timing change. No generated rig has been certified or published by this installation.

## Delete report semantics

Owner-only, CSRF-protected **Delete report** buttons are available for ML, generation, preparation and enhancement reports. Active jobs must first stop/cancel; pending cancellation does not count as stopped. Completed ML studies must finish their existing balance review before deleting report details, preserving review approval behavior and preventing races with review creation.

Deletion clears the database's detailed report/state/result/error/plan payloads, scrubs matching audit detail payloads, and keeps a minimal deletion marker/identity so queued messages and explicit artifact recovery cannot resurrect the report. Prepared-release mirrored report details are cleared too. Deleted report pages/downloads return 404 and reports disappear from dashboards/counts. No existing report is deleted automatically by this implementation; the owner chooses each deletion.

Model files, worker artifacts/logs, backups, immutable balance proposals/decisions and essential deployment/rollback metadata are separate from dashboard report deletion. They are **not erased** by this button. In particular, the frozen worker data required for trusted published-model canaries remain available. The button's result message states this scope; do not claim full filesystem erasure or storage reclamation.

Migration `2026_10_19_000007_add_report_deletion.php` adds deletion timestamps without resetting tables and disables visual schedule flags. Existing original sources/releases and ML remain intact. Changed Laravel models use soft-deletion scopes after redacting the report payloads; this protects foreign-key identities without retaining the displayed report detail blobs.

## Verification boundary

PHP/Node/Python syntax checks and Blade compilation are code/deployment checks. Focused in-memory SQLite tests exercise owner access, report redaction/deletion, cancellation acknowledgement/outage/late poll guards, frozen UniRig plans and manual-only visual admission with ML left enabled. Earlier full game/backend counts are not evidence for this change.

Avatar inference, rig/animation artistic review, generated-model qualification and live publication remain deferred. No new model job should be queued as a demonstration: the owner explicitly said they will start visual work themselves. UniRig dependency/model provisioning and service readiness may be checked without running an avatar.

## Final installation evidence

Final deployment/readiness (2026-10-19): UniRig image sha256:88d4f7d21aee9b51db46f7b5696b7ad75993af0b465784b49a80623407476b5d is running idle. Private operations report models_ready=true, runtime_ready=true, manual_only=true and active=null. Native imports pass with Torch 2.5.1+cu124, CUDA runtime 12.4, FlashAttention 2.7.4.post1 and bpy 4.2.0. Import evidence is bound to actual image ID and source/package fingerprints (engine c9b3b5d04bd5ce4b40d6e6cbee58cbf5a4724b3f6e7b66247fdf94d722395f47). Full isolated Laravel verification: 67 tests / 465 assertions; final Blade compilation and PHP/Node/Python syntax checks pass. No avatar inference, generated-result review, rigging qualification or publication was run. No visual job was queued by this setup. Original ML automation/image/container remain unchanged.
