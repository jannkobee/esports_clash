# Esports Clash — standing pose revision 5

45 current self-contained GLBs, with a relaxed, arched standing pose for the 36 human/monkey rigs. Nine creature/vehicle designs retain their appropriate nonhuman posture. Existing 34 textured Quaternius CC0 anatomy sets and 14 scout outfits are reused. Artist sources: https://quaternius.com/packs/universalbasecharacters.html and https://quaternius.com/packs/modularcharacteroutfitsfantasy.html . Full licenses, pinned hashes and editable sources are in `art/`.

The standing pose curves pelvis/lumbar/thoracic joints, shifts weight, bends knees, levels planted feet, and relaxes arms/wrists. Armor, headwear, capes and tails follow appropriate joints. Native Idle/Walk/Attack/Cast clips are newly baked with explicit constant joint offsets so switching clips restores the intended pose. The original 17-joint set and mesh skin weights remain; the arm transform groups now follow the chest. Animation bytes intentionally differ from historical v2/v4 files.

`manifest.json` records all 45 hashes and clip digests. Total: 134,993,336 bytes. GLBs load on demand. Three packed Blender examples are in `art/avatars-v5/`. See `docs/avatar-stance.md` for rebuild/review evidence. Historical v2/v4 assets and Blender scenes remain available. No gameplay or ML changes.
