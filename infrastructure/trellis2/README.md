# TRELLIS.2 multi-avatar generation

The implementation is finalized for this milestone. The owner explicitly deferred further outcome verification on 2026-10-19. Leave the Docker worker and submitted avatar queue processing; do not start more inspection/validation as part of finalization.

Owner studio: http://localhost:8089/evolution/avatars/trellis. Existing-model work is separately labeled **3D Enhancements** at `/evolution/avatars`; ML reports remain independent. No Vercel deployment.

## What is implemented

- Generation supports every ID in the 45-avatar catalog, with searchable cards, identity-specific image briefs, immutable transparent-PNG references, per-avatar seeds, single-GPU queueing, actual progress/history, JSON reports and hash-checked GLB downloads.
- Seven initial references are prepared: Dawnna, Aiselle, Vixelle, Gritlock, Vanta, Primate Minister and Arsenaldo. Files are in `references/`; `reference-index.json`, `reference-prompts.md` and `reference-prompts-generated.json` retain provenance. These used the built-in image tool. **An unattended Laravel image-generation provider is not configured.** Remaining roster entries show missing references rather than fabricated art; no paid API is enabled.
- Owner login, CSRF and private/no-store responses protect controls/assets. Built-in previews remain available while the GPU worker is offline. Dev PHP permits a 12 MiB PNG within a 14 MiB POST body. References are avatar scoped, hash addressed and archived so existing jobs keep their input across image upgrades.
- Laravel/Redis can queue different avatars; one GPU execution runs at a time. Existing executions are fetched before admission to preserve older outputs through worker upgrades. Frozen reports include engine/configuration, reference provenance and measured resources. Node progress is actual provider progress, not a guessed overall percentage.
- A local Three.js source inspector provides input/model comparison, orbit/zoom and front/side/back views. It reports real mesh/skin/clip counts and adds no synthetic animation or model fallback. The library is the game's existing Three.js 0.186.1 dependency, copied with its license; no external CDN or unrelated modeling framework is introduced.

## Actual inference and deployment

Dawnna run `4dfd754a-c7e6-4b6f-966f-049635938fd8` generated a real **5,003,912-byte** textured GLB, SHA-256 `de88922fc0339c0d9c13f62c4b4b766395aa31161d3e4b34e585d13bb5470de6`. It has one mesh/material, two embedded images, no skins and no clips. Sampled peaks were **4,286.9 MiB anonymous RAM**, **4,778.8 MiB process RSS**, and **3,171 MiB whole-device VRAM**. RAM refers to the worker/Linux VM; device VRAM includes other applications. These measurements do not establish artistic quality or live compatibility.

Aiselle, Vixelle, Gritlock, Vanta and Primate Minister were subsequently submitted (seeds 25002–25006). Their durable jobs continue independently of this agent. IDs are retained in `../../docs/trellis2-roster-queue.json`. Further result inspection is deferred.

Current image is `teamfight-trellis2:pilot`, ID `sha256:97cc501a71f16df6dedd47ac887955676c4f3630358ba54ed7389229129b6e77`. Native packages are built for Ampere 8.6+PTX: nvdiffrast `253ac4fcea7de5f396371124af597e6cc957bfae`, FlexGEMM `6dd94a859c26ee8246888502eada3dd8ad85532e`, and the required O-Voxel fork `visualbruno/TRELLIS.2@65d1e13b4a92296036044df0633242bb9e95abf6` with its pinned Eigen gitlink. Native CuMesh CUDA normals also pass. Numeric/small-geometry diagnostics stay in memory and are never exported as avatar assets. All six actual Comfy workflow classes load. Diagnostics bind both source hashes and actual image ID; see `../../docs/trellis2-gpu-diagnostics.json`.

ComfyUI is pinned to `30c259cac8c08ff8d015f9aff3151cb525c9b702`, GGUF nodes to `b3b9e951874c5fb5c936566c93b908299be08b2c`, and Torch to 2.9.1/CUDA 12.8. The source-hash-guarded `patch_nodes.py` corrects retained sparse-model references, trims freed host allocations and enforces sparse-token admission. It does not change weights or sampling settings. Supported no-pinned-memory/no-async-offload options reduce host memory pressure.

Current low-memory target: Q4_K_M, 512 resolution, 12 steps per stage, tiled decoding, 1024 textures, a 4.5 GiB anonymous-RAM budget and 5 GiB Docker hard RAM/swap cap. Admission requires 5.25 GiB VM headroom; the 768 MiB VM emergency floor and 11,000 MiB device-VRAM limit remain active. Unsafe candidates stop while originals remain intact. Failed/superseded attempts stay in history.

## Credentials, development and operation

All 22 pinned checkpoint/config files (~7.37 GiB) were downloaded/hash verified, including the authorized official DINOv3 model. The token is only in ignored `.local-tools/trellis2/hf-token.txt`, excluded from Docker contexts and never mounted into inference. Offline inference uses the local model cache. No gated-model mirror bypass is used.

The optional GPU service is defined in `compose.trellis2.yaml`; it exposes no host worker/Comfy port and restarts unless stopped. Standard development mounts reload PHP/Blade/CSS/JS/migrations and expose concept references and generated output files read-only to Laravel. Native GPU source/dependency changes require a deliberate rebuild between executions. Stored GLB downloads still require exact hash/container checks; production without the shared read-only mount uses the authenticated worker download endpoint.

For a future deliberate rebuild/validation, when requested and with no active GPU job:

```powershell
docker build -f infrastructure/trellis2/Dockerfile -t teamfight-trellis2:pilot .
$env:TRELLIS_IMAGE_ID = docker image inspect teamfight-trellis2:pilot --format '{{.Id}}'
docker compose --env-file .env.evolution.local -f compose.evolution.yaml -f compose.trellis2.yaml run --rm --no-deps trellis-worker python diagnose.py
docker compose --env-file .env.evolution.local -f compose.evolution.yaml -f compose.evolution.dev.yaml -f compose.trellis2.yaml up -d --no-deps trellis-worker
```

Never replace the independent ML runner or reset its data during a visual-worker rollout. Preserve `.local-tools/trellis2/data`, original assets, source versions and release history.

## Qualification and verification boundaries

Outputs are `generated_unqualified` with publication disabled. Raw geometry cannot replace a rigged animated avatar until rigging, skin weights, native movement/combat timing, identity, clipping/attachments and actual renderer/performance gates pass. The supplied Arsenaldo remains selected, the older enhancement schedule remains paused and gameplay/balance approval behavior is unchanged.

Last completed backend run: **56 tests / 417 assertions**; six worker admission/reference tests and expanded real GPU diagnostics pass. Chromium verified 45 cards, seven authenticated PNGs while the GPU was offline, search, navigation, CSRF, automatic history refresh preserving seed and a 390px layout. **The latest 3D inspector/local GLB fallback were finalized afterward and were not revalidated, as requested.** No generated-source artistic, rig, Khronos, Blender or browser qualification is claimed. No game simulation/renderer/squad source changed.

See [the owner guide](../../docs/trellis2-multi-avatar-generation.md) and [the finalization handoff](../../docs/trellis2-current-checkpoint.md) for remaining milestones and the owner's verification deferral.

## 2026-10-19: verified 512 mixed-precision texture profile

The default image now uses Q4_K_M for sparse/shape generation and independently pinned Q8_0 for the **512** texture flow. Q4 texture corruption was reproduced in a matched local control. Q8 fixes that corruption in the tested preserved-source result; no universal beauty/anatomy or rig-readiness claim. The 1024 pipeline is not qualified by this change. Additional texture-only preprocessing uses sparse shape guidance and releases its local flow-model reference before decode to preserve the existing RAM budget. All guards/manual admission and old immutable sources remain unchanged. Full pins, actual comparison, failed/successful pilot evidence and deployment: `docs/trellis-texture-precision-repair.md`. Use `texture_pilot.py` only as an explicit offline diagnostic CLI; it is not a roster scheduler. `Dockerfile.texture-control` is a control experiment and must never replace the production tag. Corrected static sources still require separate rigging/animation/clipping qualification.
