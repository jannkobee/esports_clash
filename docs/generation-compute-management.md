# Generation compute management

The owner can choose **Google Colab** or **Local** from the generation roster or
an avatar's **Generate model** section. Save the preference, then start a new job.
The global setting defaults to Google. The setting is stored in the database and
survives reloads/restarts. Existing jobs retain their frozen choice.

Google jobs automatically use Local when the runtime is unavailable, a probe
times out, or cloud generation raises an error. Explicit Local never probes
Google. History records the requested and actual provider and any fallback
reason. If Local also fails, the job fails with the fallback evidence retained.

The switch controls body-source generation. Equipment and rigging retain their
existing controls. Current Google generation uses experimental Shap-E. Current
Local generation reuses saved avatar geometry; it does not reconstruct the
uploaded PNG. Both require visual review and existing qualification before live
use. Failed identity/anatomy must not be treated as a successful reconstruction.

## Implementation

- Migration `2026_10_21_220000_add_generation_compute_preference.php`, setting
  `AvatarEvolutionSetting.generation_compute_preference`, service/controller and
  owner-only `trellis.compute` route persist the preference.
- `compute-controls.blade.php` is shared by the roster and individual studio.
  `generation-runs.blade.php` displays actual routing and fallback notices.
- `cloud_bridge.py` resolves preferences per plan and bounds runtime probes to
  seven seconds, below the API's ten-second deadline. Negative results are cached
  briefly; actual generation failures invalidate successful capacity cache data.
- `compose.evolution.dev.yaml` mounts avatar meshes read-only beneath the explicit
  workspace root. Without this mount the previous Local fallback could not find
  donor geometry in its container. Private worker authentication is configured.
- `Dockerfile.native` preserves the original native GPU build; the optional
  `compose.trellis2.yaml` references it. This avoids building the cloud CLI bridge
  when explicitly requesting the native TRELLIS stack.

## Verification

- Backend: 128 tests / 1,284 assertions. Generation subset after request-preference
  capture: 32 tests / 292 assertions.
- Native admission: six tests pass, including full reference metadata preservation
  across an image upgrade.
- Bridge/input/export: 16 tests, including explicit Local, Google success,
  disconnected Google, generation timeout, both providers failing, and bounded
  probe failure caching.
- Isolated deployed-container outage test: real Local GLB, 4,210,324 bytes,
  `preferred=google`, `selected=local`, fallback reason present,
  `publication_eligible=false`. No production generation record or asset changed.
- Browser: live form saves both choices, persists across roster/studio pages,
  queues no jobs, rejects a missing CSRF token with 419, restores original Google
  preference, and fits 1440/768/390/320px widths. See
  [browser report](generation-compute-ui-verification.json) and
  [screenshot](generation-compute-ui.png).
- `npm run check:game`, `npm run build`, compose validation and syntax checks pass.
  Build retains its existing bundle-size advisory.

## Reconstruction blocker

The live Colab audit found Python 3.13.15, Tesla T4 with 14,912 MiB total VRAM,
and no `trellis2`, `comfy`, `flex_gemm`, `nvdiffrast`, `cumesh` or `o_voxel` modules.
`/content/TRELLIS` is the older TRELLIS source tree, with no local model/checkpoint
directory. This host also lacks `.local-tools/trellis2/data/models`.

The native pin manifest lists 23 files totalling approximately 8.70 GiB, including
official DINOv3 weights. The [standard upstream TRELLIS.2 setup](https://github.com/microsoft/TRELLIS.2#prerequisites)
specifies at least 24 GB VRAM. The project's separate
[quantized wrapper](https://github.com/Aero-Ex/ComfyUI-Trellis2-GGUF/tree/b3b9e951874c5fb5c936566c93b908299be08b2c)
requires its own compatible environment, native CUDA dependencies and authorized
DINOv3 provisioning; it has not been validated on this session. These findings do
not prove that every quantized configuration is impossible on a T4.

No acceptable replacement Wukong reconstruction has been generated, no current
body reference was overwritten, and no rig or game appearance was published.
