# 3D generation — finalized implementation checkpoint (2026-10-19)

## Latest owner update: manual UniRig jobs and report deletion

The owner removed visual auto-admission and selected UniRig. The earlier continuous/local-surface-transfer sections below are historical. New jobs are owner-started, use actual UniRig skeleton/skin prediction, and require a separate native clip mapping/qualification stage. Read [unirig-manual-visual-workflows.md](unirig-manual-visual-workflows.md) and [the UniRig worker guide](../infrastructure/unirig/README.md). ML automation is unchanged. Delete report controls redact dashboard database details; worker artifacts/live asset metadata are separate. No avatar inference or qualification was run as part of this integration.


## Follow-up: preparation and cancellation implemented (2026-10-19)

Owner subsequently requested the asset-preparation path and cancel controls. These are deployed in Laravel/Docker; read [avatar-asset-preparation.md](avatar-asset-preparation.md). Continuous preparation produces rig/clip candidates, but generated-outcome verification remains deferred. Explicit qualification and identity review precede live publication. No new qualified/live model is claimed. Generation cancellation is provided by control.py around the unchanged deployed inference bridge, preserving native fingerprints.


The owner said: **"you don't need to verify now the outcomes now. Just finalize the 3d generation for now."** Finalize the implementation/documentation and leave autonomous queue processing enabled. Further output inspection, Blender checks and browser verification are deferred for this handoff; do not resume them as part of finalization.

## Deployed generation workflow

- Laravel owner studio: http://localhost:8089/evolution/avatars/trellis. **3D Generation** and **3D Enhancements** (`/evolution/avatars`) have separate navigation, operations and reports. ML reports remain separate. No Vercel deployment.
- All 45 catalog avatars can be selected through their own card/brief/reference/seed/history. Seven prepared image references: Dawnna, Aiselle, Vixelle, Gritlock, Vanta, Primate Minister and Arsenaldo. The other 38 honestly show missing images; upload controls and identity briefs are available. An unattended concept-image provider is not configured. Initial concepts used the built-in image tool; prompts and files are retained under `infrastructure/trellis2`.
- Multiple avatar jobs wait in a durable Laravel/Redis queue; one GPU job executes at a time. Inputs/provenance, configuration and engine fingerprints are frozen. Existing executions are read before admission so upgrades do not hide completed sources. History refreshes without replacing form edits. Native node counters are labeled Node progress.
- Laravel serves built-in concept previews independently of GPU availability. Development mounts expose generated GLBs to PHP read-only; exact recorded hashes/container bounds still gate owner downloads. The new **Inspect 3D source** page uses local Three.js 0.186.1 from the existing game dependency, with input comparison, orbit/zoom/view controls and truthful rig/clip counts. It adds no animation or primitive fallback. Owner authorization/CSRF/no-store protections remain.

## Actual generation established

Dawnna execution **`4dfd754a-c7e6-4b6f-966f-049635938fd8`** completed the actual TRELLIS pipeline and exported **5,003,912 bytes**, SHA-256 **`de88922fc0339c0d9c13f62c4b4b766395aa31161d3e4b34e585d13bb5470de6`**. Recorded output: one mesh, one material, two embedded images, zero skins/animation clips. State is `generated_unqualified`, publication disabled. Sampled peak: 4,286.9 MiB anonymous worker RAM, 4,778.8 MiB process RSS and 3,171 MiB whole-device VRAM. These are worker/VM measurements; VRAM includes other applications, not a claim of Windows-wide peak memory.

Additional Aiselle, Vixelle, Gritlock, Vanta and Primate Minister jobs were submitted with seeds 25002–25006 and continue through the same queue. IDs are in `docs/trellis2-roster-queue.json`. Some further outputs were observed before verification was deferred; do not infer their latest completion/quality without a later requested review. No further outcome verification was run after the owner's finalization instruction.

GPU image: **`sha256:97cc501a71f16df6dedd47ac887955676c4f3630358ba54ed7389229129b6e77`**, tag `teamfight-trellis2:pilot`. Actual CUDA rasterization, CuMesh normals, O-Voxel serialization, FlexGEMM numeric convolution and all six workflow nodes passed before deployment. Diagnostics require matching source hashes AND actual image ID. See `docs/trellis2-gpu-diagnostics.json`.

All 22 pinned checkpoint/config files (~7.37 GiB) are verified, including authorized official DINOv3. The hidden HF token remains ignored and outside builds/inference. Native nvdiffrast/FlexGEMM/O-Voxel were rebuilt for RTX 3060 sm_86. Current limit: 4.5 GiB anonymous RAM, 5 GiB container RAM/swap cap, 5.25 GiB VM admission headroom, 768 MiB VM emergency floor. Versioned source-hash-guarded lifecycle patch releases retained sparse-model references, trims freed allocations and enforces the token cap. Supported pinned-memory/async-offload disabling flags are used. Failed attempts remain retained rather than overwritten.

## Verification boundary and remaining milestones

Last completed backend run: **56 tests / 417 assertions**; worker admission/reference tests: **six passed**; actual browser verified 45 cards, seven authenticated PNGs while the GPU was offline, search, separate navigation, CSRF, live refresh preserving seed and 390px layout. **The latest 3D inspection page, local GLB fallback and preview-route tests were added after that run and were not revalidated, per the owner's instruction.** No Khronos/Blender/browser quality qualification of the generated sources is claimed.

Generated geometry is static and unqualified. Rigging, skin weights, native locomotion/combat clips, identity/attachment/clipping, render cost and runtime compatibility remain required before live replacement. An unattended concept provider, references for the remaining roster and additional qualified enhancement profiles remain future milestones. Do not silently enable a paid image API or apply an unrelated avatar's profile.

Supplied live Arsenaldo, original assets, previous releases and paused older enhancement schedule are retained. Gameplay stats/hitboxes/timing and balance approvals are unchanged. The original ML runner remains independent, with container `dbf61db38adb28dfffd289415ea06fd4ee0bebd77e672d13b75232a48078978f` and image `sha256:2feae106e9a8e36c388671113db70977f45db119f1ddca038a40a0489c29f2f6`; do not replace it or resume deferred ML qualification as this task.
