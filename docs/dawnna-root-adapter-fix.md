# Dawnna mapper and control-root correction (2026-10-21)

The owner explicitly requested implementation of the mapping/root-adapter correction after the reviewed warning persisted. Fresh UniRig prediction is unnecessary for this case: the inspected source rig already contains the required anatomical chains.

The humanoid mapper now accepts a root-as-pelvis topology only when its three branches resolve to one torso and two legs and all existing limb-side, segment-proportion, toe-facing and one-to-one checks pass. An accepted adapter plan adds a separate non-deforming control root above the original weighted pelvis. The Blender adapter preserves the existing bone rest matrices, parents below the pelvis, deform flags, object transforms, geometry and vertex influences. Distinct Root and Hips mappings are retained. No numeric bone-name convention or duplicated joint assignment was introduced.

Head classification checks the early branch path rather than only its start, separating near-center clavicles from the neck/head chain. Cyclic hierarchies remain rejected. Missing toes, reversed facing, ambiguous branches, collapsed limbs and nonfinite joints continue to fail conservatively.

Retargeting materializes the accepted root before validating required joint availability. Rejected mapping reports now record actual detection reasons and unresolved target names separately instead of claiming every unresolved target is a missing source bone. The UI also translates older retained warnings to their recorded mapping reason and labels superseded/cancelled attempts as historical.

Changed files:

- infrastructure/avatar-evolution/bone_mapping.py: topology v3, explicit adapter plan and Blender materialization.
- infrastructure/avatar-evolution/retarget-unirig.py: adapter application, joint validation and accurate rejection evidence.
- New test_bone_mapping.py and test_root_adapter.py; actual 52-joint and saved 30-joint fixtures.
- Preparation progress/runs Blade views and PreparationProgressTest.php.

Actual recovery:

- Existing retry 821ca1f8-538c-4671-bcac-9cfe66070b3f reused the original 34c3afcc rig but had been processed by topology v2.
- Created linked preparation 6ef5ff53-a9ad-4731-bb4b-7841e1b8b2ec through normal admission, explicitly reusing the same SHA-256 a673787f1c86bd259f7a6d548b9dc81629b9cc2af3ee604c56920f6b9a06dd39. No fresh GPU rig prediction occurred.
- The corrected engine is 243308c0f1e1052b0a39171b2fd2aebb6f2715970ad23e30d23e4cb4568cd1d5. The original reports and frozen plans remain retained.
- The new preparation is ready for visual sign-off: mapping accepted, all ten native clips exported, glTF errors zero, normal full-surface geometry qualification passed, and actual game-renderer/gameplay checks passed. Qualification reasons are empty.
- Self-intersection telemetry warnings remain for Run and Walk; review the animations before visual sign-off. No qualification thresholds were changed.
- Active release remains ID 5 / version 2 / SHA-256 5ec16b2bcc616e70d6f7648439028c4e134244d3261bf53144836f3e4b962c19. Nothing was published.

Verification:

- 13 mapping regression tests pass, including the saved 30-joint mapping and attachment warning.
- Actual Blender adapter test: 52 original joints plus one helper; maximum original rest-matrix delta zero; geometry, object transforms and skin-influence digest unchanged.
- Isolated retarget and normal linked-job retarget produce the same prepared hash b4395c870f617a706731fb8ae103d6ec284773ba4b280db1a8b70d63973d8580.
- 109 backend tests / 1,131 assertions; 485 game tests plus three simulations, TypeScript/design checks and production build pass. Existing bundle-size advisory remains.
- Blade/Python syntax and scoped whitespace checks pass. Authenticated browser confirms the historical notice is accurate and the new report is ready for sign-off, with no uncaught errors or publication submitted.

Evidence: dawnna-root-adapter-preservation.json, dawnna-root-adapter-qualification.json, dawnna-root-adapter-ui-verification.json, dawnna-legacy-root-skeleton.json and dawnna-mapping-rig-evidence.json. Older container-only mapping tests lacked their historical fixture; the new reproducible suite includes both saved skeleton layouts.

This is an offline presentation-pipeline repair. Gameplay stats, timing, collision, AI, risk-based towers, attribution, objective contests, anti-oscillation and parody aliases are unchanged. Visual identity/equipment review and publication remain separate owner actions.
