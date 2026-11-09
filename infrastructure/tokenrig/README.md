# TokenRig candidate

The owner requested evaluating SkinTokens/TokenRig as the replacement for UniRig.
This directory contains an isolated trial, not a deployed Laravel provider.
The existing preparation records and published assets are not rewritten.

Sources: [official repository](https://github.com/VAST-AI-Research/SkinTokens),
[checkpoint model card](https://huggingface.co/VAST-AI/SkinTokens), and
[FlashAttention GPU support](https://github.com/Dao-AILab/flash-attention#nvidia-cuda-support).
The code and checkpoints are MIT licensed. Keep upstream license notices when
redistributing them. Both checkpoint files and the Qwen configuration revision
are frozen in `model-pins.json`; no Qwen base weights are needed.

Upstream specifies at least 14 GB VRAM and hardcodes BF16/FlashAttention 2.
The existing Tesla T4 has 15 GB but lacks native BF16 and standard FA2 support.
The local RTX 3060 supports those features but has only 12 GB. Memory use and
output quality require an actual trial; the published minimum is not a measured
admission threshold for our candidate.

The experimental T4 profile uses FP32 and PyTorch SDPA. Query chunking bounds
temporary attention allocations while preserving full key visibility. The
patch validates all pinned source hashes before writing and binds the upstream
Blender helper to loopback. It must run against a fresh, separate checkout.
It does not modify the existing TRELLIS installation or UniRig service.

The initial Colab Python 3.12 trial could not install Blender's Python wheel.
A separate Python 3.11 environment now contains PyTorch 2.7.0/cu128, Blender
4.5.3 LTS, Transformers 4.57.6, Diffusers 0.35.1 and Lightning 2.6.1.
The owner explicitly approved uploading and testing these trial scripts in the
existing Colab T4 after initially preferring a local trial. The unused isolated
local trial container is stopped; its public source cache is retained.

After installing the upstream requirements in a dedicated environment:

```sh
python download_models.py /path/to/SkinTokens
python prepare_t4_trial.py /path/to/SkinTokens
python verify_attention.py /path/to/SkinTokens
python run_trial.py /path/to/SkinTokens source.glb result.glb \
  --source-sha256 <source-sha256> --profile t4-fp32
```

`prepare_t4_trial.py` is for the T4 experiment only. On supported hardware,
omit that step and use `--profile native`. Run inference within a supervisor
that holds the same GPU lease as other jobs, limits execution time, and kills
the complete process group on timeout (including the Blender helper).

The trial keeps seed 25001 and upstream sampling settings, including ten beams,
and uses `--use_transfer` to preserve source textures and scale. It explicitly
enables evaluation/inference mode. Every result remains `rigged_unqualified`.
Inspect the raw rig with posed renders before applying our deformation repair
or combat retargeting: those stages can independently introduce deformation.
Only a passing result should receive a distinct TokenRig provider/profile,
engine identity, cache namespace and qualification report in the application.
Do not present a TokenRig result as a frozen UniRig preparation.

On Colab, mount Google Drive before provisioning to enable the optional
revision-pinned checkpoint cache. The two large checkpoints and small Qwen
configuration are stored under `MyDrive/Teamfight/TokenRigCache/<revision>`.
The cache is verified against the frozen sizes and SHA-256 values before use;
the active virtual environment and working checkout remain on Colab's local
disk, so dependencies still need installation after a runtime reset. To seed
Drive from an already installed runtime, generate and run the one-time cache
cell with `deploy_colab.py --mode cache`; the transfer copies only pinned model
files and does not perform inference.

## Measured Stafford result (2026-10-21)

Cloud trial completed on the existing T4: 99.01 seconds including imports,
64.80 seconds inside the runner, 4499.47 MiB peak Torch-allocated VRAM.
The raw GLB has 34 predicted joints, 39,865 triangles, two 1024 PBR maps,
valid UVs, zero glTF errors and one skinned-parent warning. All 37,205 exported
body vertices have normalized weights and at most four influences. The raw
stress views show distinct bending limbs and a stable tail.

The same source-specific TokenRig rig also transferred all ten native clips in
an isolated local trial using `retarget_trial.py`. That wrapper records the
retarget source hash and substitutes only provider labels/proof filenames in
memory; it does not change deployed code or register a preparation in Laravel.
The actual browser renderer technically passed, but inspected Idle and Attack
views again show folded/collapsed arms and distorted clothing. This is a visual
failure; nothing is qualified or published. The exact defect within the shared
cleanup/weight-repair/transform/retarget chain still needs isolation.

See [trial receipt](../../docs/stafford-tokenrig-trial.json),
[raw stress poses](../../docs/stafford-tokenrig-raw-views/), and
[combat evidence](../../docs/stafford-tokenrig-retarget-review/).
The trial has ended and released the cloud GPU. Deployment remains UniRig until
there is a separately identified TokenRig provider and qualified combat result.

## Interactive Colab notebook (2026-10-23)

Open `tokenrig_colab.ipynb` in Google Colab and select a GPU runtime. Run the
cells in order. It embeds the pinned trial tools, installs an isolated Python
3.11 environment, selects the native or experimental T4 compatibility profile,
verifies checkpoints/source identity, accepts one clean base GLB, and runs one
15-minute-bounded inference. Download the result ZIP, environment and receipt.
There is no application daemon, tunnel, application token or publication step.
Do not run this while another task owns the same GPU.

Regenerate the notebook after editing its embedded tools:

```sh
python infrastructure/tokenrig/build_colab_notebook.py
```

The generator compiles every Python cell. The new notebook bootstrap itself has
not been run end to end on Colab; earlier T4 inference evidence is separate.
Fresh dependency installation and other avatars can fail or use more memory.
Reuse the retained Stafford raw rig for local retarget work instead of paying
for another inference. Colab resources and GPU availability vary; consult
[Google's FAQ](https://research.google.com/colaboratory/faq.html).

## Optional retained-rig anatomy repair (2026-10-23)

`diagnose_retarget.py` accepts `--appendage-spec FILE` and `--motion-repairs FILE`
for a new isolated plan. Supported anatomy is exactly
`[{"kind":"tail","count":1,"attachment":"pelvis"}]`; supported optional arm
profile is `{"arms":"anatomical-arms-v2"}`. Other anatomy/profile requests fail.
Both input JSON hashes are frozen in the new plan. The wrapper verifies raw rig,
generation and donor identities and refuses to reuse its output directory.

The single-tail solver uses actual rest geometry/skeleton support and tubular
cross-sections, not avatar IDs or vertex-index masks. The retained Stafford
candidate now has no gross stretching across all ten sampled clips, and its
tail stays coherent under gait and controlled bending. It remains unqualified:
shoulder collisions, contact/blend regressions and an upright Death pose persist.
The default API provider and unflagged preparations are unchanged. These profiles
have not been qualified for automatic rollout or arbitrary species.

See [the retained-base repair report](../../docs/rig-tail-repair-20261023.md) for
artifact/engine hashes, comparison failures, motion sheets and the inspectable
repaired GLB. This work reused the existing raw rig; no new Colab/GPU inference.

## Retarget correction and remaining failure (2026-10-23)

The shared retargeter now transfers reference-relative donor arm motion around
the target's own rest stance; it does not import the procedural donor's crossed
Idle joint directions. The runtime recognizes TokenRig clip ownership and skips
procedural controller construction that reparents arm helpers. Valid body skin
is preserved; explicit rigid equipment repair no longer smooths unrelated skin.

Diagnostics retain separate stage `.blend` files and a hash/joint manifest when
a new isolated plan sets `rig_stage_diagnostics: true`. Existing frozen trial
records are not edited. The local `diagnose_retarget.py` wrapper creates a new
folder and checks raw-rig, source-generation and donor identities before running.

The corrected Stafford Idle is coherent in Blender and the actual browser.
However, all-ten-clip review exposes serious tail/leg stretching during gait,
and residual Attack/Death skin pinching. The raw predicted skeleton lacks a tail
chain and stretched tail surface edges contain thigh influences. The new
`deformation-edge-stretch-v1` full-surface gate rejects Run and Walk instead of
allowing finite, normalized but grossly stretched geometry to pass. This is not
a qualified replacement provider or a dressed/published character. Full evidence
and limitations: [rig upgrade report](../../docs/rigging-upgrade-20261023.md).
