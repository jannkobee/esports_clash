# Mesh extraction and Colab setup (2026-10-21)

The 512 workflow uses untiled extraction, Q4_K_M sparse/shape and Q8_0 texture
checkpoints, 12 sampling steps per stage and 1024 textures. `patch_nodes.py`
converts all three FDG mesh-extraction coordinate arguments to contiguous int32
for the CUDA hashmap. It accepts only reviewed upstream or fully patched source.
Real GPU diagnostics exercise direct and tiled extraction using int64 sparse
inputs and reject empty results. The installed decoder hash is part of readiness.
Existing RAM/VRAM/deadline guards remain enabled.

## Installed Windows stack

Run `infrastructure/trellis2/start-colab-router.ps1` from PowerShell. It adds
`compose.colab-router.yaml` after evolution/dev/UniRig, obtains the installed native
image ID, preserves the existing native `trellis-worker`, mounts the reviewed
fixes and routes Laravel through a separate Google-first bridge. Do not also
include the alternative `compose.trellis2.yaml` in this startup path.

Router state is in ignored `.local-tools/trellis2/router-data`; native state
remains in `data`. Shared output is `.local-tools/trellis2/data/output`, mounted
into Laravel at `storage/trellis-sources`. Host port 8096 binds to loopback only.

`connect-colab.ps1` opens the pinned CLI's browser OAuth flow. Paste Google's
one-time code into that local terminal only. Credentials/session state stay in
ignored `.local-tools/colab-cli` (or `ASSET_COLAB_CONFIG_DIR`). This command lists
existing assignments and does not allocate a runtime. An existing T4 assignment
can be associated with `asset-quality-rpc` through `connect_existing_colab.py` and the installed CLI's `StateStore`
using its server-provided proxy information; never print or commit those tokens.
The router must report `compute.ready: true`, selected Google and provider
`google-colab` before claiming cloud readiness.

## Updating an existing Colab installation

Back up and synchronize reviewed source to `/content/esports-trellis2/src`, stop
only an idle owned native service, then run `provision_native.py --root
/content/esports-trellis2 --start` in its isolated environment. Startup applies
`patch_nodes.py --mesh-only` before diagnostics. Diagnostics fingerprint the
actual decoder and engine sources. Never copy hashes into an old report to
manufacture readiness. The regenerated downloadable notebook includes the fix
for new installations.

## Source inspection

Run `infrastructure/avatar-evolution/inspect-source.mjs source.glb report.json`
inside the avatar worker, where the official glTF validator is installed. It
checks the container, indices, finite geometry/UVs, PBR maps, 1024 PNG dimensions
and the existing 50,000-face admission limit. Blender 4.5.3 can run
`render_texture_review.py source.glb output-directory --all-views` to produce
front/side/rear orthographic and perspective views and a mesh/texture report.

These checks do not establish anatomy, identity or rig quality. Visibly malformed
sources stay unqualified. UniRig/skin repair/retargeting must preserve the source,
pass existing motion/contact/collision checks and await visual acceptance before
any live publication. No combat mechanics or parody aliases change.

## This execution

- Neutral empty-hand reference: `references/stafford-tpose-v3.png`, SHA-256
  `c783279b423ac4853d96421445716256c04eeccc80434b9e644fe2dd9870d2dc`.
- Cancelled local attempt with native acknowledgement:
  `c1601db1-ff27-40ad-b727-eabbca89d663`.
- Google T4 job, seed 25001: `0aa7ff15-9cc1-474f-800f-1225901d611c`.
- Full Laravel: 130 tests / 1302 assertions. Python: 25 routing/admission plus
  five source/dtype/profile tests. Real CUDA checks pass on local RTX 3060 and remote
  T4. Game: 486 tests plus three simulation tests and TypeScript. Build passes
  with the existing chunk-size/timing advisories.

The successful Google job is `c0c86ecb-ee38-4ca4-8325-406a4e39e83a`, seed
25001. Prompt inference/export took **332.91 seconds**; native execution including
startup took **344.34 seconds**, and native admission through completion took
**385.94 seconds** including checkpoint rehashing. Peak sampled GPU usage was
2329 MiB. All 23 checkpoints were verified; execution sources exactly match
passing diagnostics. The artifact is 3,906,312 bytes, SHA-256
`2022cf8b1d1a8cdee66f84a514f921d451b693e25fa51e59b85499eefc3196ee`.
It downloaded automatically to the shared worker/Laravel source directory.

The original int32 fix exposed another delay: live stack profiles showed
FlexGEMM split-K autotuning inside the learned shape decoder, before extraction.
The pinned sparse configuration now uses masked implicit GEMM with a conservative
single 32/32/32 Triton configuration on **sm_75 only**. Bounded T4 FP16/FP32
fixtures match a dense numeric reference; the full successful reconstruction
verifies this path. Other GPUs retain their original algorithm, covered by a
regression test. This changes inference implementation, never gameplay stats.

Long administrative CLI execution initially occupied the same notebook kernel as
polling, triggering a transport timeout and a correctly cancelled/fallback run.
The router now uses dedicated `asset-quality-rpc`; administrative inspection uses
`asset-quality` on the same runtime. No extra GPU/runtime was allocated. The
connection helper preserves this separation on login.

Cloud source validation: **39,865 triangles, zero glTF errors/warnings, valid UVs,
two embedded 1024x1024 PBR images**. Four actual Blender 4.5.3 views were inspected.
Evidence: `stafford-colab-source-review.json`, `stafford-colab-execution.json`,
`stafford-colab-source-views/`. The earlier local fallback is also retained at
`0aa7ff15-9cc1-474f-800f-1225901d611c` (38,424 triangles).

Local-source UniRig preparation `325e89b7-94fb-4958-817c-518fc846e247` produced
52 predicted joints. Restoring the animation worker exposed missing previously
versioned intelligence modules in its old container deployment. Recreating with
the existing dev mounts repaired that deployment. A normal acknowledged retry
`51ce11d0-c5a6-45e2-9050-b238e972ed91` freezes the current engine and reuses the
exact rig hash; no repeated inference for that source. Ten clips and valid
normalized four-influence weights export, but actual renderer views show collapsed
arms and severe tail spikes. The automatic full-surface report's technical pass
with high collision warnings is insufficient. The owner report was marked
`needs_review`, with an audited visual rejection and publication blocked; original
technical evidence is preserved.

Cloud-source preparation `7c184677-5d5f-41a5-b8a8-31bd0557dd7c` uses its own
source hash and its own 52-joint inference, valid bounded skin repairs and the ten
native clips. Its source-specific preparation also fails visual review: collapsed arms and
spiked tail in the actual front/strike/gameplay renders. The technical glTF report
has zero errors and one non-root-skinned-mesh warning; normalized weights, clip
availability and renderer compatibility pass. Full-surface collision telemetry
rises from two bind intersections to 14,969 in a sampled posed frame. Recorded
`needs_review` with a separate audited rejection; the raw technical pass report is
preserved and publication is blocked. No active Stafford release exists.

Final evidence: `stafford-colab-preparation.json`,
`stafford-colab-preparation-verification.json`,
`stafford-colab-geometry-qualification.json`,
`stafford-colab-visual-review.json`, and `stafford-colab-prepared-views/`.
The completion of generation/rigging/retarget execution does **not** complete
character quality. Targeted bind-space/secondary-joint and skin/pose repair is
still required before visual acceptance; the automated correction did not solve
this deformation.
The independent ML runner was temporarily stopped only after owner approval to
meet UniRig's unchanged 7168 MiB RAM admission, then restored after each inference.
All other temporarily stopped pipeline services were restored. No live asset or
release was published. Targeted skin/rest-pose repair remains required for the
rejected local candidate; technical validity is not artistic acceptance.
