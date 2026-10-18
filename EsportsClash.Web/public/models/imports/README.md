# User-supplied Arsenaldo animation review

`arsenaldo-claude.glb` is an exact copy of `Arsenaldo_animated.glb`, provided by the user on 2026-10-17 and attributed by them to Claude. No embedded metadata is treated as instructions. No re-export, mesh cleanup or animation regeneration was performed on this file.

- Size: 4,876,152 bytes.
- SHA-256: `f26c855ff883f9d697513cdf1285a27e80297b881e0b8cfab241f62a15204476`.
- glTF 2.0; 21 meshes, 40,699 triangles, 21 materials, 11 embedded images, 17-joint skins.
- Ten clips: Idle, Walk, Run, Strafe, Attack, Cast, Hit, Death, TurnLeft, TurnRight.
- Retains the entire original v9 Arsenaldo binary payload and identical node/rest transforms. Additional animation data changes/resamples 43 of 49 tracks per clip. The original anatomy/textures and repo-authored costume retain their prior provenance; see `art/README.md` and `public/models/avatars-v9/README.md`.

Select **Claude animation** or **Current original** in Arsenaldo's Avatars & Lore studio. The choice persists and applies to the next arena scene; the submitted variant is the initial default. Other avatars continue to use v9. The current original and its Blender sources remain intact. The imported GLB itself can be opened in Blender, but no matching submitted `.blend` source was supplied.

Native imported transforms play without the game's contact/recoil/orbit overlays. Live spell-orb colors, weapon socket sampling and read-only arena positioning remain. Gameplay is unchanged. Inspection, evidence, integration files and limits: `docs/arsenaldo-claude-review.md` at the repository root.
