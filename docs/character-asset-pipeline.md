# Character asset pipeline

## Latest compute direction (2026-10-24)

Reuse the existing generation/preparation pipeline. The owner explicitly requires Google Colab for generation, rigging and animation processing; local inference, rigging, repair/retarget/baking and automatic local fallback are not authorized for this work. Babylon handles rendering/playback/effects. The retired custom-mesh workshop is historical. The same base-first anatomy, raw-rig, deformation, appearance and qualification gates apply to cloud outputs; notebook success is not qualification. Follow [the active plan](babylon-visual-rebuild.md) for cloud readiness gaps and phased completion.

## Current visual direction (2026-10-24)

The owner superseded the painted-sprite production direction with actual modeled geometry and Babylon.js animation/effects. Existing pictures are references for the world rebuild; follow [the single active visual plan](babylon-visual-rebuild.md). The earlier sprite trial below is historical. All anatomy, base-first, rig/deformation, appearance and qualification gates in this document still apply, including to code-authored meshes and rigs. Removed generated planning guides are preserved as exact historical content in [the reset receipt](visual-reset-20261024.json); use current identity/kit JSON and supplied specifications for factual sources. No new candidate is qualified by this direction change.

## Separate painted 2.5D trial (2026-10-24)

Subsequent owner instruction: **make it live, arena first, then Mirelle**. This authorizes the limited painted terrain/scenery and two-facing Mirelle sprite presentation in the existing Babylon match and replay. It supersedes the preview-only/opt-in staging for these assets, not the 3D qualification gates. The sprite has four-frame motions and shared attack/cast gesture; full animation qualification remains pending. See [live integration evidence](arena-2d/live-integration.md).

The owner explicitly approved a separate painted-sprite workflow with its own animation checks for the Babylon arena trial. Its character illustrations do not require the 3D base-rig gate; 3D assets still do. Read [the shared 2.5D reference](arena-2d/README.md) before sprite work. Mirelle's new painted draft and all failed 3D candidates remain unqualified; no live visual release follows from this exception.

## Current owner override: fresh assets for all 45 (2026-10-24)

The owner explicitly requested deleting all existing avatar model/rig/animation/reference/preview binaries and restarting with Mirelle Vane (`c_invoker`). This supersedes earlier retention instructions **for those binaries**. Historical plans, hashes, reports and revisions remain audit evidence; their former binary links may now be absent. Do not restore Stafford or legacy geometry as Mirelle's source. Old visual releases are inactive. The new Mirelle candidate is private and **unqualified**. See [reset receipts and stage ownership](avatar-rework/asset-reset-20261024.md). All base-first, anatomy, deformation and publication gates below still apply.

Owner decision: 2026-10-21. This is the required workflow for all avatar asset work and all agents. Read the latest [agent handoff](agent-handoff.md) before acting; [arena mechanics](arena-mechanics.md) remains authoritative for protected gameplay behavior.

## Base first, appearance later

Generate a clean adult base character with clearly separated anatomy. Rig it and verify its deformation before adding the outfit and final character appearance. The owner's earlier armored cyber-soldier example supplies pose guidance; it does not make every avatar a cyber-soldier. Existing avatar IDs, intended species, body proportions, and parody aliases remain intact.

The base is a neutral matte anatomical mannequin with a smooth, close-fitting modesty layer. Keep the torso, shoulders, elbows, wrists, hips, knees, ankles, and fingers readable. Exclude armor, loose clothing, capes, sleeves, long hair, accessories, weapons, handheld objects, and other geometry that obscures the joints or bridges the limbs to the body. Do not bake these items into the base surface.

Retain species anatomy needed to rig the character: for example, a monkey character keeps its anatomical head shape, ears, hands, feet, and tail. Keep tails and other appendages visibly separated from limbs and torso. Defer decorative fur shells, elaborate hair, outfit silhouettes, signature colors, and cosmetic detailing until the rig works. Do not turn different species into an identical human body merely to share a prompt.

Use explicit anatomy descriptions for each avatar; costume descriptions often mix body features with equipment and are not a safe source for the base prompt. Intrinsic machine chassis, wings, multiple tails, or an orb/void body remain when they define the character's actual anatomy. Separate a rider from its mount and a pilot from its vehicle; each needs an appropriate base/rig treatment before later assembly. Nonhumanoids use an anatomy-appropriate neutral rest configuration with separated appendages rather than invented human arms or legs.

## A-pose specification

The owner's phrase **dynamic A-pose** means a clear, balanced, static **rest pose** here:

- Symmetrical, upright, full body visible from head to feet; neutral expression, no twist, lean, gesture, or combat action.
- Both arms straight, extending down and outward at approximately 45 degrees from the vertical torso. Elbows stay straight and both hands stay clear of the hips.
- Palms face down; fingers are individually visible, naturally separated, and free of objects.
- Clear air gaps separate the upper arms/underarms from the lateral torso and the hands from the thighs. No fused armpits or cloth bridges.
- Legs straight and slightly apart, with a visible gap between the legs; both feet supported on the same ground plane.
- Neutral front view, even lighting, plain background, no cropping; side, rear, and perspective views are used to inspect the resulting mesh.

Apply the arm/leg A-pose requirements to bipeds with those limbs. For dragons, nonhumanoid machines, orb/void forms, and other incompatible bodies, keep the same clear, symmetrical neutral-rest intent while preserving their real anatomy. Identify that exception in the prompt and evidence instead of falsely labeling the result a humanoid A-pose.

This is an input and rest-pose change. It does not by itself correct animation transfer, bind-space transformations, or leaking skin weights. Never rotate only a rendered pose and then describe unchanged bind data as a new A-pose rest mesh.

## Shared prompt template

Use this intent for every newly generated base reference, substituting only the avatar's anatomical species/body description:

> A full-body 3D character base mannequin of an adult [species and body proportions], standing in a strict, wide, symmetrical A-pose. Both arms are straight and angled 45 degrees down and outward from the vertical torso, palms facing down, fingers individually visible and separated, with clear air gaps between the arms and body and between the hands and thighs. Legs are straight and slightly apart, with both feet on the same level. Neutral expression, front view, entire body visible. Clean readable anatomy, neutral matte surface, smooth close-fitting modesty layer. Preserve [necessary species anatomy, such as the tail] with clear separation from the body and limbs. No armor, outfit, loose clothing, sleeves, cape, hair covering the anatomy, accessories, weapons, held objects, action pose, or asymmetrical stance. Ready for rigging; final clothing, hair, materials, and cosmetic character identity will be added after the base rig is validated.

This template is for compatible bipeds; replace limb-specific wording with the anatomy-appropriate rest configuration for other bodies. Selected cosmetic/design context belongs in the later outfit/appearance brief, not the clean base prompt. Equipment prompts likewise describe the later separate item rather than baking it into the body.

The image or mesh must actually satisfy the pose and separation requirements; prompt text alone is not evidence. Record a new reference artifact and hash. Do not overwrite a reference used by a frozen job or silently reuse an old equipped/T-pose image under a new prompt label. New defaults apply to new work; historical job prompts and plans retain their original meaning.

## Stage checks

| Stage | Required output and evidence | Do not claim |
| --- | --- | --- |
| Base reference and mesh | New reference/source IDs and SHA-256 hashes; front, side, rear, and perspective inspection; readable separated anatomy; preserved species proportions; glTF structure, UV/material and geometry findings. | A clean silhouette guarantees good weights, or a technical validator pass qualifies the character. |
| Raw rig | Separate rig artifact with source, provider, model/runtime/engine hashes; skeleton mapping and normalized skin-weight findings; controlled limb-bend/stress previews before shared repair or animation transfer. | Rig output proves the later repair/retarget chain works. |
| Repair and retarget | Retain raw rig; save distinct stage artifacts/evidence so the first damaging operation can be identified. Inspect Idle, Run, Attack, Cast, Hit, Death, and the remaining exported clips from multiple views. Check shoulders/arms, hands, feet, hips, and any tail/appendages. | Exported clip names or renderer success proves usable combat deformation. |
| Appearance assembly | Fit outfit, hair, accessories, and character materials to the validated base rig as separate later geometry/materials. Skin deforming pieces to the rig; attach rigid pieces to appropriate bones. Record fitting/bind transforms and inspect the dressed result across the same motion set. | Prompt changes already implement automatic clothing generation, fitting, or weight transfer. |
| Final qualification | Structural checks plus actual visual/deformation review of the final dressed character, with remaining issues and qualification status recorded through existing controls. | A failed or unreviewed candidate is ready or has been published. |

Clothing can hide the base body's surface in the finished asset, but must not conceal an unresolved rig failure. Retain separate raw-rig, geometry-cleanup, weight-repair, rest/coordinate-calibration, and retarget outputs, and inspect the same controlled poses after each operation to isolate the first regression. Any geometry cleanup or weight repair must be evaluated against the retained pre-repair artifact. Do not assume that joining meshes, exploding parts, or smoothing weights is appropriate for every model; use stage-specific evidence and preserve the original.

## Current implementation and known limit

Latest retained-base pass (2026-10-23): optional `single-pelvic-tail-v1` reconstructs
Stafford's missing tail coverage from a declared anatomical tail and measured
unsupported tube geometry. Its 12-bone chain removes gross gait stretching while
preserving rest geometry, existing bind matrices and unrelated body weights.
Optional `anatomical-arms-v2` uses actual target joint frames and bridges changed
clip-start stances. The v6 candidate passes 50-frame/all-ten-clip structural checks
with collision warnings, but fails independent contact/collision quality comparison;
Death still ends upright. It remains unqualified, undressed and unpublished.
These are explicit experimental plan options, not new production defaults or a
deployed TokenRig provider. Exact artifacts, tests and limits:
[tail repair report](rig-tail-repair-20261023.md). Earlier failed v5 evidence below
retains its original meaning.

2026-10-23 upgrade: the shared retargeter preserves the target rest arm stance
instead of importing crossed procedural-donor Idle directions. The runtime now
recognizes TokenRig clips and avoids controller-construction reparenting for
preserved motion. Valid body weights are no longer smoothed without a defect.
These corrections resolve the reviewed neutral arm collapse, but the retained
Stafford candidate still fails locomotion: its tail lacks a dedicated predicted
chain and stretched tail edges have thigh influences. The new full-surface
`deformation-edge-stretch-v1` gate rejects Run/Walk; Attack/Death also require
further skin/pose review. No outfit fitting, qualification, provider deployment
or publication follows. Frozen evidence below retains its original meaning.
See [the upgrade report](rigging-upgrade-20261023.md) for exact stage/engine/artifact
hashes, motion views, checks, remaining failures and the interactive Colab notebook.

The prompt implementation now uses contract `base-first-a-pose-v1`:

- [base-anatomy.json](../EsportsClash.Api/resources/avatars/base-anatomy.json) supplies explicit anatomy entries for all 45 catalog avatars. Unknown avatars or missing anatomy fail explicitly rather than falling back to costume text.
- [AvatarAssetPromptService.php](../EsportsClash.Api/app/Services/AvatarAssetPromptService.php) builds the anatomy-only default body prompt and a fourth `outfit` prompt for later appearance work. Legacy body overrides are archived and ignored by the new body contract; their original text remains readable. Older three-field saves preserve an existing optional outfit brief.
- [asset-editor.blade.php](../EsportsClash.Api/resources/views/evolution/avatars/asset-editor.blade.php) sends imported selected-design context only to outfit/equipment briefs, keeping it out of the clean body prompt.
- [avatar-base-first-prompts.json](avatar-base-first-prompts.json) records the prompt export for all 45 avatars.

The new selected Stafford reference is [stafford-base-apose-v1.png](../infrastructure/trellis2/references/stafford-base-apose-v1.png), generated with imagegen and retained as a separate artifact with SHA-256 `43c2464d7af854a76e703d40e0bdd3783b5aa4b533335ca899ce2f87a34581a4`. Its Google-generated source `d0ba4c6c-f06e-4047-90ab-5f29de0cb11d` succeeded: GLB SHA-256 `7606b5c57b562457ee616875267315751a33a34d74dbf74f07ab59d708230e8d`, 37,474 triangles, and zero glTF errors/warnings.

The new isolated cloud TokenRig raw rig succeeded in 121.38 seconds inclusive, with 4499.47 MiB peak allocation, 52 joints, normalized weights with at most four influences, and no unweighted body vertices. Its SHA-256 is `bffc47c8cf223c82f4c2644138f146fdef6f7c9934e2a14c12755eacad4c1f0b`; six raw rest/stress views in [stafford-base-apose-raw-views](stafford-base-apose-raw-views/) were inspected clean. The base and raw rig are promising results for the new input policy, with limited inspection rather than final combat qualification.

The isolated shared-combat trial `/avatar-data/61d04a2e-a5b1-421a-9048-06e31e754ea6` exported all ten clips and passed the actual browser's technical checks, but **failed visual review**. Inspected front, side, and strike views show severe shoulder/arm folding or twisting behind or into the torso and distorted feet. Evidence: [stafford-base-apose-retarget-review](stafford-base-apose-retarget-review/). No API preparation was created for this isolated trial. The clean raw rest/stress output followed by damaged combat output helps isolate the defect to the shared post-rig chain; the exact failing transform or repair operation has not been identified. An unclothed A-pose does not resolve that defect. No outfit fitting, character qualification, or publication was completed.

Verification of the prompt/UI implementation: the full Laravel suite passed 132 tests / 1,589 assertions; game checks and production build passed. Browser checks covered all four prompt tabs at widths 1440, 768, 390, and 320 pixels with no overflow or errors. These application checks do not replace deformation review.

As of this decision, the production API preparation provider remains UniRig. SkinTokens/TokenRig succeeded as an isolated cloud trial on the existing Tesla T4 using a separate FP32/SDPA compatibility profile. That trial is not a deployed production provider. See [the TokenRig trial instructions](../infrastructure/tokenrig/README.md) and [Stafford trial evidence](stafford-tokenrig-trial.json).

In the earlier clothed-source trial, Stafford's raw TokenRig rig passed limited rest and controlled stress inspection, then the existing shared repair/retarget chain folded the arms into the torso again. That historical failure and its artifacts remain valid evidence; the exact damaging operation remains unresolved. A cleaner A-pose base is the new input policy; raw-rig success is not evidence that this downstream defect has been fixed. Keep raw-rig validation separate from post-repair, post-retarget, and dressed-character validation.

The staged appearance process above is the required workflow, not a claim that an automated dressing system already exists. Do not relabel existing equipment-generation controls as full clothing/hair fitting without implementing and validating the missing behavior.

The existing motion-transfer pipeline does not support every creature profile. An anatomy-appropriate base prompt does not create a compatible skeleton or animation donor. Record an unsupported creature/mount/vehicle stage honestly; do not force it through humanoid mapping or imply its combat animation is qualified.

Historical Stafford references, source jobs, failed preparations, reports, and frozen hashes remain immutable. They are useful comparison evidence and are not replaced by updating prompt defaults. No publication follows from this documentation change.

## Current Mirelle deformation status and regression lock (2026-10-27)

The fresh generated Mirelle source and raw TokenRig rig have been measured through combined pivot and localized/tapered weight-transfer experiments in Google Colab. Limited paired Babylon review of both the 12% reference and taper confirms remaining compressed shoulder/hip transitions. Lower counts do not clear the base/rig gate. A new source-bound contact map records exact vertex signatures and separate rest/posed bounds for the next isolated joint repair; do not use posed contact boxes as exact rest-space masks. Neither candidate has game clips. They remain experimental diagnostic artifacts: no outfit fitting, qualification or publication. Do not treat measured improvement, valid GLB import, normalized weights, zero severe-stretch edges, or zero browser errors as the deformation gate passing.

Two subsequent signed shoulder-contact transfers, each starting from the preserved taper and verifying all 517 records, are rejected: arm-favoring `8db702c3` yields 137/81 and torso-return `7a692c3c` yields 149/88 shoulder intersections, versus taper's 131/81. Non-shoulder checks remain unchanged. Each has a 68-view Colab Babylon review and limited six-view manual assessment without convincing shape improvement. API state retains rejected assessments and exact playback with no release change.

Fixed-weight socket study `65f0062a` completes seven bounded shoulder placements; forward `268fd5d7` reduces shoulder counts to 63/42. Later combined shoulders and isolated hip/forward-extent studies yield integrated `f6283980`, shoulders 44/35 and hips 51/47. Every exported candidate completes all 16 bends with preserved weights/rest surface; two hip proposals are rejected by unchanged source-section bounds. Cumulative taper-to-integrated preservation is verified separately in Colab. The final map isolates 208 contact vertices. Paired native Babylon review has 68 captures and limited manual inspection of 20: rest/moderate bends are preserved, but deep-joint transitions/creases remain. A separate preserve-volume comparison worsens one hip and is diagnostic only. Backoffice retains all failed/rejected/experimental records and exact playback. **No qualified rig, appearance fitting or publication.**

The signed-contact surface probes completed and produced portable corrective candidate `140fe64c` on `f6283980`. Its four baked corrective morphs and exact diagnostic playback survive GLB validation, Babylon review and 104 sampled native/corrective interpolation poses, but limited manual review still finds broad shoulder roots and hip creases; it remains unqualified. The first intermediate-motion job lost its runtime before result retrieval and remains unknown; replacement `e0a78665` records its own runtime provenance. Preserve every attempt and stop blind transfer/pivot tuning or repeated cap rebasing.

Use [the complete Mirelle regression lock](avatar-rework/mirelle-deformation-regression-lock-20261026.md) for the immutable source/parent/candidate IDs and hashes, exact Colab runtime provenance, failure history, comparison values, backoffice registration, and ordered next work. The lock is authoritative for continuing Mirelle's deformation work; update it and the chronological handoff after each new attempt. Keep the API preparation record as the single source of truth for candidate/report state consumed by Web.

## Agent coordination protocol

1. Before editing, read `AGENTS.md`, the latest handoff entries, and this document. State the stage and files you own to collaborating agents. Inspect the current workspace so existing work is preserved.
2. Before consuming another stage's output, identify the exact avatar ID, job/preparation ID, artifact path and SHA-256, provider/profile, and relevant engine/model hashes. Do not substitute a similarly named source or a mutable latest-file path without verifying its contents.
3. When changing a shared stage or interface, message active agents responsible for adjacent stages. State what changed, what output they should consume, and any compatibility or verification limit. Use the available agent messaging tools; no external email or chat service is implied. If no agent is active, put the same handoff in repository documentation for the next agent.
4. Keep file ownership explicit and avoid concurrent edits to the same file. Do not silently override another agent's artifacts, frozen plans, provider identity, or qualification decision. Resolve interface mismatches through conversation and record the resolution.
5. Report actual checks and inspected views with results, artifact hashes, and unresolved failures. Distinguish raw rig, repaired rig, retargeted model, and dressed model. A stage that failed visually stays failed even if its structural checks passed.
6. Update the [agent handoff](agent-handoff.md) with the decision, affected files, verification, current artifacts, and next unresolved stage. Follow the existing `AGENTS.md` requirements for gameplay or squad UI changes and regression checks. Asset work must preserve the protected gameplay invariants and existing publication controls.

Suggested handoff format:

```text
Owner / stage / files:
Avatar and source job ID:
Input path / SHA-256:
Output path / SHA-256:
Provider / profile / model and engine hashes:
Checks and inspected views / result:
Known failures and qualification status:
Interface changes communicated to:
Next unresolved stage:
```
