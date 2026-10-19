# Problem-driven autonomous art production

**Latest owner steering:** pause TRELLIS.2/GGUF and use the [supplied Arsenaldo GLB](arsenaldo-supplied-model.md). Its static-mesh variant is the new client default; the older Claude source and release history remain intact. Laravel visual generation is paused with an audit record. ML remains independent. TRELLIS scaffolding is unfinished and undeployed; see [the pause record](../infrastructure/trellis2/README.md).

Actual local finishing ran before the pause: `270b9a17-813f-49b4-a432-22c6fdc9fb0c` evaluated ten generated candidates and automatically published candidate-02 as Arsenaldo V3; `d71cba45-4cac-4c55-bcbc-9b034b24c9fa` subsequently published V4. These are procedural finishing results on the earlier animated source. They are not TRELLIS inference. Retained release health may change as trusted canaries run; publication alone does not prove every version is healthy or artistically better.

Owner specification: [autonomous-art-evolution-specification.md](autonomous-art-evolution-specification.md), supplied 2026-10-18. This replaces manual approval for **avatar and ability presentation only**. Gameplay balance reviews, deadlines, keep-current choices and owner decisions retain their existing workflow.

The implementation below describes the earlier animated-source production pilot. Its semantic material mappings do not apply to the newly supplied one-mesh asset. Qualify a separate source/profile before resuming evolution.

## Verified source and visual audit

The game uses React with plain Three.js, GLB assets, native skeletal clips, contact/foot-placement controllers and pooled/instanced ability effects. It does not use React Three Fiber. There are 45 catalog avatars with existing v9 assets; Arsenaldo defaults to the byte-exact Claude animation import. Blender saves new packed editable scenes from the selected source instead of overwriting imported/licensed files.

Original Arsenaldo has 21 mesh nodes, 21 materials, 36,346 vertices, 40,699 triangles, 11 embedded images, a common 17-joint rig and ten native clips. Its identity is a tailored orb-conjuring mage: navy brocade, ivory lapels, burgundy mantle and brass trim. It has elemental orbs, not a staff, sword or firearm. Inventing a new weapon would be an identity change.

The existing model already contains layered procedural garments/armor and licensed CC0 head/hand refinements. Adding polygons indiscriminately would not establish better art. Several profiled clothing/armor materials lack albedo and tangent-normal detail maps despite having valid UVs. The new engine classifies that missing material capability as an opportunity; it does **not** call it objective ugliness. Existing anatomy, faces, native motion limitations and posed clipping are separate concerns. Bind-pose BVH counts include intentional layers, and foot-joint drift is a diagnostic proxy rather than a complete foot-sliding assessment. Lighting and camera quality remain separate from asset quality.

## What the local pipeline actually generates

`art-profiles.json` supplies Arsenaldo's archetype, silhouette, palette, equipment, motifs, prohibited deviations, semantic component/material mappings and resource budgets. Other avatars remain unqualified until their own component profiles and actual compatibility checks exist. The owner's older Brewmaw roster selection is retained in the audit history; the latest specification selects Arsenaldo as the production pilot. Brewmaw's existing releases/reports/decisions remain intact.

`art.mjs` reads the actual current GLB and checks supported unresolved issues. If none exist, a cycle records “unchanged” without generating another asset or incrementing its version. It never advances a version just because an hourly/weekly timer elapsed.

For real supported component issues it generates original, coherent UV-based brocade weave, velvet, engraved brass or stitched leather finishes. Outputs include actual embedded PNG albedo, tangent-normal and ORM maps, with 256/512px limits and PNG compression. ORM's AO channel is neutral; this is procedural material finishing, not a claim of high-poly ray-baked ambient occlusion. Existing palette factors, face/hair, source texture bytes, native clips, hierarchy, bind matrices, skin weights and topology remain intact. Optional shallow engraved relief changes existing connected armor vertices without adding disconnected primitives or rewriting source code. It does not independently reconstruct high-quality humanoid anatomy or perform unproven skin transfer/retopology.

The source and compatible parent are immutable. Blender imports the real generated GLB, checks geometry/BVH intersections and saves a new editable `.blend` with packed textures and actions. The runtime binary stays in the native GLB workflow to preserve the Claude clip contract. The official Khronos validator checks the actual binary. Completed baseline/candidate checkpoints retain engine, plan, source and artifact hashes; recovery reuses completed evidence and refuses changed source/artifact bytes. Duplicate outputs are skipped rather than repeatedly rendered under different names.

The default candidate count remains five; the first deployed pilot uses the owner's saved count of ten. One generator processes candidates sequentially. Further cycles analyze the currently active version and only address remaining supported issues.

## Ability presentation

The existing real-event VFX engine remains authoritative. A constrained `ability_style` specifies elemental theme, opacity pulse, trail taper, zero extra draws, confirmed-impacts-only behavior and preserved warning geometry. `abilityVisualEvolution.ts` rejects malformed or incompatible parameters. It refines existing pooled meshes and instanced batches; it does not introduce fake hit events, enlarge gameplay indicators, move weapon emission sockets, extend lifetimes or write gameplay RNG/state. Paused/replayed presentation uses the same borrowed event phase. No generated JavaScript or GLSL executes.

This is an incremental local VFX finishing method, not a claim that every requested fire/ice/smoke/impact family has been redesigned into commercial-quality art. Broader VFX authoring and optional generative anatomy/motion remain separate work.

## Automatic selection and publication

Laravel freezes a v2 plan with the current parent hash and character profile hash. The worker generates real candidates, Blender scenes and eight standardized images, including a gameplay-scale view. The actual `AvatarAssetLibrary`, native mixer/contact code and `ArenaAbilityEffects` render candidates. Checks cover ten clips, sampled posed bounds, foot-joint/transition proxies, silhouette masks, rendered palette, texture decoding, actual shader errors, pooled VFX cost and a standardized local GPU-finished frame benchmark. Worker anonymous RAM is measured while Chromium is resident; GPU VRAM is unavailable in this CPU/SwiftShader container.

An eligible candidate must resolve an observed profiled issue. It must have zero Khronos errors, preserved rig/timing/skin/identity contracts, no added triangles/materials/draw calls, no worsened animation proxies or bind-pose intersection count, at least 98% silhouette overlap, bounded rendered brightness change, at most 8 MiB added mipmapped texture memory, a GLB under 16 MiB, and the configured local frame-cost allowance (8%). The benchmark is local software-renderer evidence, not a device-FPS guarantee. No aesthetic score is treated as objective proof of beauty. Original source warnings are reported transparently.

The eligible candidate addressing the most supported issues is selected; measured local cost and file size break ties. Laravel independently checks the important gates, the worker's frozen manifest/report, current parent version and quarantined hashes. It atomically appends a versioned release and changes the backend manifest. A stale parent or no eligible improvement retains the current version. Historical v1 manual-era plans can never be automatically promoted. Their recorded states and decisions are not rewritten or deleted.

Each renderer retains its initial manifest snapshot. Existing scenes keep their loaded version; new scenes can load the new hash-addressed release. Original assets and every published release remain retained. Approval/rejection forms and deadlines are removed from visual production. The dashboard is read-only diagnostics/history plus schedule/analysis and administrative rollback controls.

## Runtime health and rollback

New automatic releases receive a private runtime canary after publication and periodically thereafter. The worker validates the immutable GLB hash and renders the baseline and release using actual asset/animation/VFX code. Resource admission, a busy worker or a failed baseline makes the check inconclusive; infrastructure unavailability alone cannot authorize rollback.

Two consecutive trusted failures quarantine a release, restore the preceding known-good version when available, or restore the original. The quarantined hash cannot be automatically republished or administratively reactivated. Publication records the successfully rendered previous baseline as health evidence. Legacy manual releases are not retroactively subjected to a new failure policy; they can become the validated baseline for a new automatic release.

Public browser loading/error signals are rate-limited, aggregated diagnostics. They cannot increment trusted failure counts, activate assets or directly cause rollback. Artifact downloads remain hash-checked. Historical asset URLs remain available after rollback.

## Docker, queues and retention

`avatar-worker` isolates Blender/Chromium/material processing with one generator, 1 CPU, 1280 MiB, persistent artifacts and a 20-minute job deadline. Browser/subprocess deadlines and owned-process cleanup bound hung work. Persistent plans/terminal reports support recovery without a coding agent. A private project-owned Redis 7.2 service and separate `avatars` queue handle art orchestration; queue metadata remains in PostgreSQL. ML and trusted-match execution remain separate. Existing ML database-backed jobs and the frozen training runner are not migrated or reset.

Redis uses AOF persistence and no-eviction memory policy. Laravel's scheduler recovers outstanding database records, including publication interrupted after collection. Cleanup only considers unreferenced failed/unchanged v2 temporary cycles older than seven days; it protects active work, all releases, parent references and recent reports. All historical v1 evidence remains retained. Protected evidence can exhaust the budget; admission pauses rather than deleting reproducibility or rollback data. JSON reports stay available after temporary-file retirement.

Docker development hot reload still serves the game at localhost:8088 and Laravel at localhost:8089. Art processors and trusted execution images remain pinned between explicit deployments. See [docker-development.md](docker-development.md).

## Optional provider research and limits

External generation remains disabled with a **zero API spending budget**. No paid generation request, gated model download or commercial registration was performed. The working provider is local procedural mesh/material finishing with Blender validation; this is not relabeled neural 3D generation. External adapters/rig conversion require separate qualification and are not production-enabled merely because a vendor has an API.

Primary sources checked 2026-10-18:

- [TRELLIS.2](https://github.com/microsoft/TRELLIS.2): model/code under MIT with separately licensed dependencies; its official setup calls for Linux, CUDA and at least 24 GB NVIDIA GPU memory. It is not enabled in this CPU-only worker.
- [Stable Fast 3D](https://github.com/Stability-AI/stable-fast-3d) and [its license](https://github.com/Stability-AI/stable-fast-3d/blob/main/LICENSE.md): textured GLB reconstruction, CPU support, roughly 6 GB default single-image VRAM; commercial registration/revenue and attribution conditions need separate confirmation for the actual operator.
- [Meshy API](https://docs.meshy.ai/en/api/text-to-3d) and [licensing/pricing](https://docs.meshy.ai/en/webapp/pricing): asynchronous asset generation/export; output/commercial terms and credits depend on plan/model. Credentials alone do not configure an authorized spending budget.
- [Tripo API](https://platform.tripo3d.ai/docs/general) and [developer terms](https://developers.tripo3d.com/en/terms): task-based generation with separate free/paid output rights and service restrictions. Not called or enabled here.
- [glTF Transform](https://gltf-transform.dev/): MIT tooling for asset/texture optimization, including compressed formats; no unqualified Draco/KTX2 decoder change was imposed on the renderer.
- [Khronos glTF Validator](https://github.com/KhronosGroup/glTF-Validator): the official validator is integrated in the actual local generation workflow.

The feasible first stage improves existing equipment/material detail and existing event-bound VFX. It does not guarantee commercial-MOBA art quality, solve every clipping/foot-contact issue, infer artistic taste, or claim that all 45 avatars were upgraded. Broader anatomy, reliable retopology, paid/local generative providers and additional qualified character profiles remain explicit limits.
