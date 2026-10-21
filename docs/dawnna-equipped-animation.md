# Dawnna equipment and animation correction

The owner reported missing primary/off-hand weapons, a T-pose default and poor animation after rigging. They explicitly selected generation of new 3D sword and shield meshes from their uploaded PNG references.

## Root causes

- Both equipment uploads were PNG design references. Preparation did not convert them to geometry, freeze their identities or attach separate meshes.
- The studio showed the raw unrigged generated body even after preparation. The prepared inspector also defaulted to bind pose with its mixer stopped.
- Retargeting removed the donor's Idle stance and copied local deltas between incompatible arm reference poses. Structural side labels also disagreed with the actual native donor convention.
- Every unnamed finger branch was treated as rigid equipment. Locomotion's carrying correction repeated once per branch/joint.
- Integer frame loops truncated fractional clip endpoints. Dense baked export now preserves exact authored durations.
- Including props in character normalization shrank the body. The fixed studio comparison camera could also crop the raised sword even though the standardized gameplay view passed.

## Resulting pipeline

1. **Real equipment generation:** authenticated `/equipment-references/{avatar}/{slot}` and `/equipment-jobs/{id}` endpoints in the TRELLIS control extension validate original upload bytes and provenance in a separate namespace. Body references are untouched. Original engine/checkpoints/workflow, resource guards, single-job scheduling and shared GPU lease are preserved. The explicit CLI uses these authenticated endpoints; it does not write provenance records itself.
2. **Versioned installation:** `AvatarEquipmentService` verifies generated job kind, avatar, hand slot, reference SHA, artifact SHA and bytes. `TrellisGenerationService::saveGeneratedWeapon` checks the still-current reference under the existing equipment lock, archives its PNG and installs the verified GLB. These active source files affect future preparations, not existing publications.
3. **Frozen preparation inputs:** each real equipment file is uploaded into a hash-addressed private worker cache. The immutable preparation plan stores slot, hash, byte count, format and label. The job verifies and copies those exact bytes before Blender processing. PNGs remain references, and unarmed preparation is still supported.
4. **Pose and fitting:** conservative root adaptation retains original rig/rest geometry. Native-compatible side labels and world-space arm motion calibrated against a lowered Idle stance bridge the reference-pose mismatch. Equipped upper arms receive a 15-degree outward guard clearance. Only explicitly identified props receive prop handling; anatomical finger chains receive grip animation. Carrying correction applies once per hand. Separate weapon meshes are fitted relative to the real Idle palm and rigid-skinned to `HandR`/`HandL`, retaining independent materials/textures and accurate fitted tip sockets.
5. **Existing budgets:** raw generated sword/shield meshes each have approximately 40,000 triangles. Only equipment is reduced to 5,000 triangles per asset, keeping the complete prepared avatar at **47,613 triangles**, below the unchanged 50,000-face full-surface qualification limit. The body mesh is not decimated. Exact native clip durations and all ten clips are preserved. Idle is included in posed geometry qualification.
6. **Presentation:** the studio selects the latest compatible preparation of the selected generated source and opens in Idle. The raw T-pose body remains downloadable. The inspector evaluates Idle immediately, has explicit Play/Pause state, displays two equipped hands, and fits the displayed pose. Game body/ground/HUD normalization uses the body mesh rather than its weapon extents. Fitted tip metadata drives cosmetic weapon sockets. Studio comparison cameras contain the equipped pose; the standardized gameplay camera and pass thresholds are unchanged.

## Operational evidence

- [Equipment generation](dawnna-equipment-generation.json): sword job `572724ab-9024-49ba-8fe1-cf03b604de5f`, shield job `48aef7c1-bb65-4452-ac11-f94281d5dcfa`, exact uploaded hashes, worker provenance, measured resources and real GLBs.
- Existing source generation: `3e5bb0be-5095-4bc3-87aa-a32425c2c66f`. Reused original rig SHA `a673787f1c86bd259f7a6d548b9dc81629b9cc2af3ee604c56920f6b9a06dd39`; no fresh body or UniRig inference.
- The first equipped attempt `bf905396-a3ba-4ee9-a354-b10aae488869` correctly failed the unchanged face budget. Optimized attempt `9c4fc785-6c14-49d8-9ad9-de6202b8eefc` passed technical checks but retained more arm/contact warnings. Clearance/sizing revision `5e8d32c3-f317-4beb-8b51-8efac7e81d8c` passed geometry and gameplay checks but failed studio side framing. Its warnings reduced to Death/Run and draw-call count. A read-only test of the corrected camera passed all three studio views and gameplay. Earlier artifacts/reports are retained inside the same visible report.
- Final revision `36d03e9e-a0e5-4981-b525-23f82f139242` is **ready for visual sign-off**. Full-surface geometry, glTF (zero errors), all studio views and actual gameplay rendering pass with no qualification reasons. Candidate SHA `fb2d7a754a1ca06badbd453487fdac8813459742ec3a41bddc4be2ed8e472549`, 12,588,112 bytes. [Qualification evidence](dawnna-equipped-qualification.json), [pose verification](dawnna-equipped-pose-verification.json), [original rig preservation](dawnna-equipped-root-preservation.json), [browser evidence](dawnna-equipped-ui-verification.json).
- Remaining warnings: self-intersection telemetry during Death/Run, three draw calls versus the baseline and measured local frame cost above the 8% comparison threshold. These remain warnings for explicit visual/performance review, not hidden successes. Active release ID 5 / version 2 / SHA `5ec16b2bcc616e70d6f7648439028c4e134244d3261bf53144836f3e4b962c19` is unchanged; no publication occurred.

An initial attempt to write provenance records directly was rejected by automatic approval review. That action was not executed. The completed implementation uses validated authenticated uploads, records their source hashes server-side and keeps equipment and body namespaces separate.

## Verification

- 116 Laravel tests / 1,194 assertions, including generated asset provenance, exact cache receipts, original PNG preservation, wrong-slot/reference rejection and source-scoped animated studio selection. Test equipment storage is isolated from owner files.
- Three equipment control tests and six original TRELLIS admission/reference tests; 14 mapper tests including native side convention.
- Blender `verify_equipped_pose.py`: lowered forward Idle hands, rigid hand influences, 30 grip bones, 50 finite clip samples, no accumulated duplicate carrying correction and exact donor durations. Root preservation is checked separately against the retained raw rig.
- `npm run check:game`: 486 tests, three simulation tests, design/TypeScript checks. Production and avatar-review builds pass; existing large-chunk advisory remains.
- Browser `verify-equipped-avatar.mjs`: both genuine equipped previews, default playing Idle, all ten clips, explicit rest-pose inspection, pause, two equipped slots, responsive layouts and no uncaught errors.

## Remaining limits

These are calibrated native motions, not newly captured performance or a claim of finished animation art. Source mesh appearance, shoulder/armor deformation, finger/handle contact and the full attack/cast/death cycles still require visual review. Technical checks are not an artistic-quality score. Recorded collision/draw-call warnings must remain visible. Additional choreography should use reviewed sword-and-shield motions retargeted to this actual rig while preserving game event timing. Automatic fit is a starting point; unusual equipment needs reviewed fitting/profile work.

The optional manual equipment CLI is available inside the TRELLIS container; this does not enable unattended roster generation. New source uploads/revisions require new frozen preparation attempts. Live releases and their metadata remain unchanged until normal explicit sign-off and publication.

Affected code: `EsportsClash.Api/app/Services/AvatarEquipmentService.php`, `AvatarPreparationService.php`, `TrellisGenerationService.php`, `TrellisGenerationController.php`, studio/preview views and `public/generation-viewer.js`; `infrastructure/trellis2/control.py`, `equipment_cli.py`, equipment tests; avatar worker cache/preparation/retarget/contact/qualification code and `verify_equipped_pose.py`; `EsportsClash.Web/src/avatarModelAssets.ts`, `avatarWeaponSockets.ts`, `avatarEvolutionReview.ts` and socket tests; browser verification script. No combat stats, AI, collision/hitbox mechanics, ability/projectile launch timing, current risk-based tower rules, attribution, objective contestation, anti-oscillation or parody aliases change.
