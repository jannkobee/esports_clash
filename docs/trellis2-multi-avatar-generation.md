# Multi-avatar 3D Generation in Laravel

## Latest owner update: manual UniRig jobs and report deletion

The owner removed visual auto-admission and selected UniRig. The earlier continuous/local-surface-transfer sections below are historical. New jobs are owner-started, use actual UniRig skeleton/skin prediction, and require a separate native clip mapping/qualification stage. Read [unirig-manual-visual-workflows.md](unirig-manual-visual-workflows.md) and [the UniRig worker guide](../infrastructure/unirig/README.md). ML automation is unchanged. Delete report controls redact dashboard database details; worker artifacts/live asset metadata are separate. No avatar inference or qualification was run as part of this integration.


Open http://localhost:8089/evolution/avatars/trellis and sign in with the existing Evolution Owner account. The game remains at localhost:8088. Nothing is published to Vercel.

The owner finalized this implementation milestone on 2026-10-19 and deferred further output verification. Existing Docker jobs continue processing.

**3D Generation** creates a new source from an individual image. **3D Enhancements** at `/evolution/avatars` analyzes and improves an existing qualified source. Generation history, enhancement reports and ML reports use separate records and views. New sources never inherit an unrelated avatar's enhancement profile automatically.

## Using the studio

1. Search the 45-avatar roster by name or role. Every card retains its catalog identity and weapon brief.
2. Inspect its concept cutout, or open the design brief and upload a transparent full-body PNG. Uploads are versioned; changing the current image does not change an existing job. Initial references are provided for Dawnna, Aiselle, Vixelle, Gritlock, Vanta, Primate Minister and Arsenaldo. The other 38 show that an image is needed.
3. Choose a seed and queue generation. Multiple avatars can wait; one executes on the GPU at a time. A second active request for the same avatar is rejected. Resource admission can delay work without discarding its plan.
4. Read the automatically refreshing generation history. Forms keep your edits during refresh. Node counters are actual ComfyUI progress, not an invented overall percentage. JSON reports retain source hashes, engine/configuration, execution messages and measured resources.
5. Open the frozen input image, choose **Inspect 3D source** for orbit/view controls, or download a completed generated GLB. Each output is integrity checked. Failed attempts remain visible and do not overwrite an earlier asset.

All controls, report downloads and input images require owner login. POST controls use CSRF protection. Built-in concept previews remain available while the GPU worker is offline; online worker references override the built-in preview when you upload a new version. Development PHP supports the advertised 12 MiB PNG limit. Initial concept files and exact additional prompt provenance are under `infrastructure/trellis2/references`, `reference-prompts.md` and `reference-prompts-generated.json`.

The initial images were generated with the built-in image tool during development. An unattended Laravel text-to-image provider is **not configured**. Hugging Face DINOv3 access enables the image encoder checkpoint; it does not supply that missing concept-image service. No paid image API is silently activated, and the remaining roster does not display fabricated references.

## Compatibility and live appearance

TRELLIS outputs are `generated_unqualified` with publication disabled. A new static mesh does not have the existing avatar's rig, skin weights, clips, combat timing or ability attachments. Geometry/texture checks, rigging, identity, native movement/combat animations and browser/performance qualification must precede live replacement. Appearance remains separate from hitboxes, stats and gameplay fairness. Original assets and previous versions remain retained.

The owner's supplied Arsenaldo GLB stays selected. The older enhancement schedule remains paused, while its reports/releases and rollback history are retained. The currently qualified autonomous finishing profile covers the original animated Arsenaldo source; other avatars must obtain their own qualified profiles. Independent gameplay ML and balance approvals retain their behavior.

## Local runtime and validation

The optional GPU service uses the existing Docker project through `compose.trellis2.yaml`. It has no public worker/Comfy ports, one GPU job, bounded CPU/RAM, fixed offline checkpoints and validated workflows. API code, Blade, CSS, JS, migrations and concept previews use development mounts/hot reload. Native worker code and model-processing dependencies are deliberately rebuilt between executions.

The current low-memory target uses Q4_K_M at 512 resolution, 12 sampling steps per stage, tiled decoding, 1024 textures, a sparse-token admission cap, a 4.5 GiB anonymous-RAM budget and a 5 GiB Docker hard cap. Admission requires 5.25 GiB VM-available memory; the 768 MiB emergency VM floor and GPU budget still abort unsafe work. RSS is separately reported because mapped checkpoint pages inflate it. Device VRAM includes other applications. Hardware-specific success must be established by an actual output, not package installation or a small GPU fixture.

Verified so far: 56 Laravel tests / 417 assertions, six worker admission/reference tests, seven actual owner PNG responses, 45 cards/search, separate navigation, CSRF, live refresh preserving seed and a 390px layout without horizontal overflow. No game simulation/renderer/squad code changed, so the earlier full game validation remains applicable. Evidence: `trellis2-generation-ui-verification.json`, dashboard/roster/mobile screenshots and `trellis2-reference-verification.json`.

Actual Dawnna execution 4dfd754a-c7e6-4b6f-966f-049635938fd8 exported a real 5,003,912-byte textured GLB after the native RTX 3060 builds and lifecycle fixes. It has no skins/clips and remains unqualified/unpublished. Five additional avatar jobs were submitted; their latest outcomes are not being reviewed now. The last completed verification run preceded the final source inspector/read-only GLB fallback, which are not revalidated by owner request. Read trellis2-current-checkpoint.md for exact evidence and remaining milestones.

## Asset preparation and cancellation

Completed sources now link to [Asset Preparation](http://localhost:8089/evolution/avatars/preparation), with continuous admission, character-specific native rig/clip transfer, editable scenes and explicit qualification/publication controls. Per-job Cancel and Cancel all are available across generation, preparation and enhancements. See [avatar-asset-preparation.md](avatar-asset-preparation.md) for acknowledgement/tombstone semantics and remaining qualification limits. No generated result was reviewed or promoted during this implementation.
