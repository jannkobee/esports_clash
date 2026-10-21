# Dawnna mapping warning review (2026-10-21)

The owner subsequently requested and authorized the correction. Implementation and the successful saved-rig revision are recorded in [dawnna-root-adapter-fix.md](dawnna-root-adapter-fix.md). The analysis below describes the earlier unchanged v2 artifact.

The owner suspected the preparation's missing-native-mapping warning was a false positive. This was a review of preparation 34c3afcc-b10e-4a8f-9da1-000de495b0a8 and the exact saved UniRig artifact a673787f1c86bd259f7a6d548b9dc81629b9cc2af3ee604c56920f6b9a06dd39 (4,845,148 bytes).

The warning is misleading as a list of missing anatomical bones. The rig contains 52 actual joints, including the pelvis, spine, chest, head, paired arms/hands and legs/feet, with skin influences on every proposed anatomical mapping. The pipeline returned an empty map after rejecting a skeleton layout it does not support. It did not individually detect 17 missing bones.

Two automatic-detection limitations were reproduced:

1. The root joint is the weighted pelvis itself. Its children are the torso and two thigh chains. The matcher assumes a separate control root above a pelvis joint, so its search for a pelvis among the root's children fails.
2. After adding a diagnostic-only control root, the mapper rejects the chest. Its head classifier examines only each branch's initial position. Both clavicles start near the centerline and above the chest, so they are incorrectly counted as additional head branches. Their descendants clearly lead laterally to elbows, wrists and fingers.

A diagnostic-only root plus checking the first three branch joints for centerline consistency allowed the otherwise unchanged mapper to recover 16 distinct anatomical joints and a separate proposed control root. Existing opposite-side, limb-proportion, one-to-one and toe-facing checks passed. The proposed map and normalized segment lengths are in [dawnna-mapping-rejection-review.json](dawnna-mapping-rejection-review.json). The original extracted Blender hierarchy and skin-influence counts are in [dawnna-mapping-rig-evidence.json](dawnna-mapping-rig-evidence.json).

This supports a false rejection by the automatic topology detector, rather than an anatomically empty or unrigged model. The runtime compatibility hold itself remains justified until an adapter adds a real non-deforming control root, preserves the pelvis/rest hierarchy and weights, and retargeting and normal qualification succeed. The diagnostic root does not exist in the saved asset. No animation, geometry, clipping or runtime-quality pass is claimed.

Recommended correction: recognize a pelvis-root humanoid conservatively, represent the required control root as an explicit adapter operation rather than a duplicate joint assignment, and classify torso branches by their paths rather than their first points alone. Regression fixtures must cover root-as-pelvis, clavicles, fingers, arbitrary names/order, scale/translation, missing toes, ambiguous branches and reversed facing. The report should expose the actual mapping_review reason instead of presenting every unresolved target name as a missing source bone.

Review only: the production mapper, frozen job, rig, skin, qualification gates and live release were not changed, and no new inference/preparation was admitted. The current tower, attribution, objective, anti-oscillation and parody-alias rules are unaffected.
