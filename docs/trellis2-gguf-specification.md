# ESPORTS CLASH — TRELLIS.2 GGUF LOW-VRAM IMPLEMENTATION

Update the existing TRELLIS.2 Avatar Evolution Engine implementation to prioritize low-VRAM inference using the community GGUF/ComfyUI approach.

## Reference sources

Official TRELLIS.2:
https://github.com/microsoft/TRELLIS.2

Original TRELLIS, for reference only:
https://github.com/microsoft/TRELLIS

Low-VRAM tutorial:
https://www.youtube.com/watch?v=FuFm8zBHDWI

Community GGUF integration:
https://github.com/Aero-Ex/ComfyUI-Trellis2-GGUF

ComfyUI TRELLIS.2:
https://github.com/visualbruno/ComfyUI-Trellis2

Treat TRELLIS and TRELLIS.2 as separate implementations. Do not accidentally load original TRELLIS checkpoints into a TRELLIS.2 workflow.

## 1. Hardware-aware setup

My development machine uses an NVIDIA RTX 3060 and approximately 16 GB RAM.

Detect the actual GPU VRAM, CUDA driver, available system RAM, and operating system before choosing inference settings.

The official TRELLIS.2 implementation requires at least 24 GB VRAM, but the supplied tutorial demonstrates a community GGUF implementation with lower memory requirements.

Investigate and validate the exact workflow used in the video.

Prefer quantized local inference rather than requiring a remote GPU.

Start with Q4_K_M or another verified low-memory checkpoint appropriate to the detected hardware.

Do not assume 6 GB VRAM compatibility guarantees that 16 GB system RAM is sufficient.

Record measured peak RAM and VRAM usage.

## 2. Choose the correct installation strategy

The provided tutorial primarily uses Windows 10/11, ComfyUI Easy-Install, Torch/CUDA-compatible packages, GGUF model weights, and community custom nodes.

My existing Laravel and ML infrastructure runs through Docker.

Do not blindly execute Windows BAT installers inside a Linux Docker image.

Evaluate two architectures:

A. Run ComfyUI TRELLIS.2 GGUF in a separate local Windows environment and connect it to Laravel through a private authenticated service interface.

B. Build a dedicated Linux Docker worker using verified compatible GGUF nodes and CUDA dependencies.

Choose the approach that has the best actual compatibility with my hardware and preserves the existing Docker infrastructure.

Keep the TRELLIS.2 worker isolated from gameplay ML dependencies.

Audit community installation scripts and pinned dependencies before execution.

Do not expose ComfyUI's raw API to the public internet.

## 3. Actual generation

Use a real TRELLIS.2 GGUF inference workflow.

The system must:

- Accept a single full-body character reference image.
- Preprocess and validate the reference.
- Submit a generation job.
- Track actual execution progress.
- Generate textured 3D geometry.
- Export a real GLB.
- Store generation parameters, checkpoint identifiers, and artifact hashes.
- Handle OOM and invalid mesh errors.

Do not substitute procedural primitives or placeholder GLBs when inference fails.

## 4. Low-memory operation

Implement configurable:

- GGUF quantization level.
- Model loading/offloading behavior.
- Resolution and sampling steps.
- Maximum generation duration.
- Maximum VRAM/RAM usage.
- Worker concurrency.
- Texture resolution.
- Model unloading after generation.

Start with one generation at a time.

Use low-memory options actually supported by the installed workflow.

Do not invent unsupported flags or assume all quantization formats are compatible.

When memory is insufficient, abort safely and preserve the existing avatar.

Separate TRELLIS.2 generation from gameplay ML training so both services do not compete for GPU resources.

## 5. Laravel automation

Create a TRELLIS.2 provider adapter in the existing Avatar Evolution Engine.

Laravel should be able to:

1. Queue an avatar-generation job.
2. Submit the job to the local ComfyUI worker.
3. Track the job using its real execution identifier.
4. Retrieve the actual generated GLB.
5. Trigger Blender post-processing.
6. Validate rig and animation compatibility.
7. Optimize the GLB for Three.js.
8. Run browser rendering and performance checks.
9. Automatically deploy a qualified visual version.
10. Roll back after detected regressions.

Use the supported ComfyUI API and a versioned workflow definition.

Make jobs idempotent and restart-safe.

Do not require the ComfyUI browser UI to remain open.

## 6. Blender and animation integration

The output of TRELLIS.2 is not automatically game-ready.

Import the generated GLB into Blender.

Attempt compatible retopology, skin-weight transfer, and binding to the existing Arsenaldo skeleton.

Validate idle, movement, attacks, ability casting, and weapon attachment points.

If full-body rigging fails, keep the original animated body and consider safe modular improvements using generated rigid equipment.

Do not publish static geometry as a fully animated character.

## 7. Automated deployment

Preserve my requirement for no manual visual-asset approval.

Automatically deploy only when all required technical, visual, animation, identity, and performance checks pass.

Keep immutable asset versions and automatic rollback.

Do not weaken the existing gameplay balance approval system.

## 8. First pilot: Arsenaldo

Start with the Arsenaldo character concept image.

Extract the neutral full-body reference rather than passing the entire multi-view sheet as one image.

Produce at least one real TRELLIS.2-generated GLB.

Then evaluate:

- Geometry detail.
- Material quality.
- Character identity.
- Rig compatibility.
- Animation performance.
- WebGL rendering performance.
- RAM and VRAM consumption.
- Generation duration.

Compare the output against the existing Arsenaldo asset inside the real game.

Only after a successful end-to-end pilot should the system expand to additional avatars.

## 9. Acceptance criteria

Do not claim implementation success unless actual local generation is demonstrated.

Show:

- Exact checkpoint and quantization version.
- Exact generation workflow.
- Actual peak VRAM and RAM.
- Generation time.
- Exported GLB validation.
- Blender processing results.
- Animation compatibility results.
- Real browser rendering screenshots.
- Deployment or rejection outcome.

If the available hardware cannot complete the generation, document the specific limitation rather than silently substituting another generator.

## Final objective

Make Microsoft TRELLIS.2 GGUF operate as a real autonomous image-to-3D generation backend for Esports Clash.

Prioritize low VRAM, bounded RAM usage, local inference, automated Laravel orchestration, Blender-based finishing, and production-compatible GLB output.

The system must continue functioning without ongoing Codex participation.

Begin by validating the tutorial's low-VRAM implementation on my actual hardware, then integrate a working generation pipeline into the existing Evolution Lab.
