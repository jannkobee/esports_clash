# Arsenaldo: submitted Claude animation

The user asked to inspect and integrate `C:\Users\User\Downloads\Arsenaldo_animated.glb` so they can see what Claude did. The file is now copied byte-for-byte to `EsportsClash.Web/public/models/imports/arsenaldo-claude.glb`; the source in Downloads and current v9 GLB/Blender files are preserved. The user attributes the file to Claude; its generator metadata says `pygltflib@v1.16.5`. Metadata is inspected as data, not instructions.

## What the file changes

It retains the same 51-node hierarchy/rest pose, 17-joint skins, 21 meshes, 40,699 triangles, 21 materials and 11 embedded images as the current Arsenaldo. The entire original binary payload remains an identical prefix. It appends animation data and changes/resamples 43 of 49 channel outputs per clip. It does not provide a newly detailed model. Some JSON differences add explicit glTF defaults; the rendered costume/anatomy/textures remain the existing model.

The ten native clips keep their existing names and durations: Idle (2.4s), Walk (0.8s), Run (0.6s), Strafe (1s), Attack (0.8s), Cast (1.35s), Hit (0.42s), Death (1.2s), TurnLeft/TurnRight (0.65s). Submitted replacement tracks generally sample at 60Hz, with some unchanged 25-sample tracks retained. Changed sample counts alone do not establish better choreography. Visible differences include body/arm poses and orb paths; some movements remain restrained and existing anatomy/costume intersections remain.

Submitted size: **4,876,152 bytes**, SHA-256 **f26c855ff883f9d697513cdf1285a27e80297b881e0b8cfab241f62a15204476**. Current baseline: 4,376,068 bytes, SHA-256 **1dabffb5072912c02d4a28d2e978811d3dbffba62288648d1625477cdea7b136**. Embedded resources are self-contained. Detailed report: [arsenaldo-claude-inspection.json](arsenaldo-claude-inspection.json), regenerated with `node scripts/inspect-arsenaldo-import.mjs` from `EsportsClash.Web`.

## How to see it

Open **Avatars & Lore → Arsenaldo → Model version → Claude animation**, choose a pose, then press **Animate**. Switch to **Current original** to compare. The selection persists in `esports-clash-arsenaldo-model` and applies to Arsenaldo in the next 3D arena scene. The submitted version is the initial default. Download GLB returns the selected file. Other avatars keep their existing assets and studio controls.

`avatarModelUrl.ts` handles the explicit two-version URL and preference; `avatarModelAssets.ts` caches both versions separately, clones their rigs, plays/blends the native clips and falls back to the current GLB if the submitted one cannot load. The studio reports that fallback instead of silently identifying it as Claude. `threeAvatarModels.ts` preserves submitted transforms, bypassing procedural contact, recoil and orb-position overlays that would overwrite the submitted animation. Only live spell-orb colors are updated. Imported Death holds its endpoint. `threeArenaScene.ts` snapshots the preference at scene creation and samples the posed weapon socket normally. `threeAvatarPreview.ts`, `AvatarModelPreview.tsx` and its CSS provide the studio comparison and race-safe switching. Existing review scripts now address the pose selector by accessible label.

There are no kit, stat, range, hit timing, AI, RNG, ML, tower/well/Nexus, terrain, retreat, attribution, objective, anti-spin, audio-default or fictional-name changes. No `.blend` file accompanied the submission; the existing v9 Blender source does not represent these new animation bytes. Do not regenerate this imported file through the current asset pipeline without preserving the original and explicitly reviewing that change.

## Evidence

- [Side-by-side animation video](arsenaldo-claude-preview.webm).
- [Idle, attack and cast comparison](arsenaldo-claude-comparison.png).
- [Walk, hit and death comparison](arsenaldo-claude-reactions.png).
- [Actual studio UI](arsenaldo-claude-studio.png).
- `arsenaldo-claude-verification.json`: both textured variants, all ten clips at three phases, repeated paused poses, actual ArenaScene variant/weapon socket/live orb-color checks, version persistence, pose controls, download and mobile layout.
- `arsenaldo-claude-video-verification.json` and three extracted frames: exact saved WebM decodes, plays and seeks at 1200×1370.
- `arsenaldo-claude-arena-verification.json`: GLB-required live draft including Arsenaldo, exact 3D/2D state/RNG/execution/opportunity comparisons at 30/60/90s, viewports, controls, WebGL recovery and disposal.
- `avatarImportedArsenaldo.test.mjs`: original bytes/rig/resources, raw native transform preservation against an independent mixer, paused stability, crossfade, death endpoint, preference/storage failure and load fallback. Final required game/build results are recorded in `arsenaldo-claude-game-check.log` and `arsenaldo-claude-build.log` and summarized in the repository handoff.

This is an imported animation comparison, not a completed Arsenaldo kit/model redesign or a measured full-match/device performance improvement. Bypassing procedural foot/contact overlays exposes the submitted clip's own foot placement and clipping; it is intentional for reviewing its motion. Existing spell simulation remains authoritative. The individual-avatar queue still resumes with Dawnna after this requested import.
