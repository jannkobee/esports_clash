# Local UniRig rigging worker

## Latest maintenance runtime (2026-10-19)

The first real Dawnna extraction exposed a bpy 4.2.0 process-exit segmentation fault. The final worker stage now pins bpy 4.2.22 LTS (`--no-deps`), retaining cached bootstrap requirements and regenerating `/opt/unirig-packages.txt`. Identical extraction now exits 0 with matching geometry/normals; native imports pass for image `sha256:7124c9305d253501af3d0f3529c63f9b5e63a931fbfff30d3e07e82b401a567b`, engine `4859b4b8ba2ae1deb4bd60933f6ff8c347819484a34f7f246bab60a21cea2abd`. Model/sampler/checkpoint pins are unchanged. Read `docs/wsl-memory-dawnna-continuation.md` for operational changes, original failure, verification boundaries and subsequent attempt outcomes. Older installation evidence below describes the original image, not a successful inference claim.


The owner selected UniRig, then explicitly removed automatic admission from all visual workflows. This worker receives only manually requested Laravel preparation jobs. It does not scan the roster or create jobs itself. Gameplay ML automation is separate and unchanged.

Official upstream: https://github.com/VAST-AI-Research/UniRig, pinned commit `6793c6640ff01c8fb389f3993434124bb43d2933`. Official public checkpoint revision `36842e2b5947e9e60f89275b83208c8e74071c63`; the skeleton and skin checkpoints total 5,815,082,028 bytes. `model-pins.json` contains the exact SHA-256 values. `provision.py` downloads/hash-verifies those files and the pinned OPT configuration, without a token. No paid provider or account is used.

## Install/start

From the repository root:

```powershell
python infrastructure/unirig/provision.py
docker build -f infrastructure/unirig/Dockerfile -t teamfight-unirig:local .
$env:TRELLIS_IMAGE_ID = docker image inspect teamfight-trellis2:pilot --format '{{.Id}}'
$env:UNIRIG_IMAGE_ID = docker image inspect teamfight-unirig:local --format '{{.Id}}'
docker compose --env-file .env.evolution.local -f compose.evolution.yaml -f compose.evolution.dev.yaml -f compose.trellis2.yaml -f compose.unirig.yaml up -d --no-deps unirig-worker avatar-worker trellis-worker
docker compose --env-file .env.evolution.local -f compose.evolution.yaml -f compose.evolution.dev.yaml -f compose.trellis2.yaml -f compose.unirig.yaml exec -T unirig-worker python /opt/unirig-service/native_diagnostics.py
```

These commands start services, not model jobs. Use http://localhost:8089/evolution/avatars/preparation to choose a completed TRELLIS source and manually queue UniRig. The private service is not exposed to the host internet. Native dependencies are isolated from the existing TRELLIS and ML images. No Vercel deployment.

Python 3.11, Torch 2.5.1/CUDA 12.4, compatible PyG sparse wheels, official FlashAttention 2.7.4.post1 binary and bpy 4.2 are installed in the new image. Fast-simplification is pinned to 0.1.7 because 0.1.8+ requires NumPy 2, while UniRig explicitly uses NumPy 1.26. Spconv CUDA 12 is pinned to available release 2.3.6. `pip freeze` is recorded and fingerprinted. No shell `eval` from the upstream launcher is used: inference stages receive fixed argument vectors and UUID-derived local paths.

Constrained install configuration changes set absolute local checkpoint paths, point OPT configuration at the provisioned directory and set data-loader workers to zero. Upstream model/sampler code and weights are not rewritten. Inference runs with HF/Transformers offline and W&B disabled.

## Stages and limits

Manual admission -> resource/model readiness -> mesh extraction -> skeleton prediction -> skin-weight prediction -> merge with original materials -> **rigged_unqualified**. Each native stage runs in a separate subprocess so its GPU allocations are released before the next stage. Raw skeleton FBX, skinned FBX, original textured rigged GLB and private logs remain in ignored `.local-tools/unirig/data/jobs`.

UniRig and TRELLIS use the same exclusive Linux file lock on the named `visual-gpu-lease` volume, held through process/model shutdown. UniRig requires 8,500 MiB free device VRAM and 7,168 MiB available Docker VM RAM before admission; its container hard cap is 8 GiB with no extra swap allowance. An inadequate VM waits rather than stopping ML or changing system settings. The official upstream minimum is a CUDA GPU with at least 8 GB VRAM; these local admission reserves are deliberately separate from that published minimum. During stages, a 768 MiB VM emergency floor, 11,500 MiB whole-device VRAM ceiling and 20-minute per-stage deadline stop unsafe work. VRAM includes other applications.

The Laravel CPU worker downloads the exact recorded rig hash, keeps UniRig's predicted skeleton/skin and runs a separate native-animation retarget candidate. It does not fall back to the previous nearest-surface skin transfer. Native/recognized Mixamo names can be matched exactly; ambiguous or missing mappings stop at **awaiting_retarget** and expose the predicted names. The owner can submit a new preparation with a reviewed native-to-UniRig bone map. Extra tail/wing motion can require additional character-specific work. No claim that a predicted rig automatically matches the game's animation/contact contract.

Cancellation is durable in Laravel, UniRig and the CPU worker. It writes tombstones before stopping owned process groups, awaits termination and acknowledges only after both relevant workers stop. An unavailable GPU controller does not prevent attempting the CPU stop, and never counts as a completed cancellation. Original sources and live releases remain intact.

After retargeting, qualification remains explicitly requested. Native clips, glTF/geometry, identity/equipment, actual renderer performance and gameplay timing compatibility must pass before publication. Installation/readiness is not evidence of rigging quality. No avatar inference or outcome qualification is authorized by merely starting the worker.

## Final installation evidence

Final deployment/readiness (2026-10-19): UniRig image sha256:88d4f7d21aee9b51db46f7b5696b7ad75993af0b465784b49a80623407476b5d is running idle. Private operations report models_ready=true, runtime_ready=true, manual_only=true and active=null. Native imports pass with Torch 2.5.1+cu124, CUDA runtime 12.4, FlashAttention 2.7.4.post1 and bpy 4.2.0. Import evidence is bound to actual image ID and source/package fingerprints (engine c9b3b5d04bd5ce4b40d6e6cbee58cbf5a4724b3f6e7b66247fdf94d722395f47). Full isolated Laravel verification: 67 tests / 465 assertions; final Blade compilation and PHP/Node/Python syntax checks pass. No avatar inference, generated-result review, rigging qualification or publication was run. No visual job was queued by this setup. Original ML automation/image/container remain unchanged.

## 2026-10-19 actual-inference compatibility updates

- Final bpy extraction runtime is 4.2.22 (bootstrap layer 4.2.0 is upgraded explicitly).
- `prepare_inference_checkpoint.py` creates a separate verified skin inference checkpoint; `inference-pins.json` anchors source/output hashes, size and the digest of every model tensor. Only optimizer/scheduler state is omitted. The original training checkpoint is retained.
- Single-file skeleton prediction exports FBX. The worker now extracts that FBX and supplies its `raw_data.npz` to skin prediction, matching upstream `generate_skin.sh`.
- Textured GLB export reproducibly crashes during bpy interpreter shutdown, even in a minimal round trip. `merge-blender.py` runs the unchanged upstream transfer in standalone Blender 4.5.3, copied from the already built `teamfight-avatar-tools:local` stage. Build that checksum-pinned tools image first (see avatar-evolution/Dockerfile). Python dependencies remain pinned; Blender supplies its built-in bpy/NumPy. A separate 2 GiB diagnostic transfer exited zero and shut down normally. No crash exit is ignored.
- Current deployed UniRig image: `sha256:cc5b474e13b3b089ae62859032cf7973d8aa3f260a2375ef4b311c50197b8586`, engine `378e3042a5005e0f6201342d45c512b829bedc0394ad3c66b07b30b98a4775f0`. Native imports passed for this exact image; models verified. Earlier image hashes above describe historical attempts. All adapter files participate in the engine fingerprint; model/sampler pins are unchanged.
- Actual linked Dawnna attempt: `b761a7fd-e425-49b2-b4cd-072866d5ae7d`. Rest joints, parents, names and tails match the inspected 42-bone skeleton exactly. The explicit 17-joint map remains a candidate that must pass animation and runtime checks. See `docs/wsl-memory-dawnna-continuation.md` for final outcome and memory/ML limits.
