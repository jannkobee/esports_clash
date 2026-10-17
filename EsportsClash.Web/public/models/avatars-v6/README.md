# Esports Clash — roster combat animation revision 6

45 self-contained GLBs; original 17-joint sets; ten native clips each: Idle (combat ready), Walk, Run, Strafe, Attack, Cast, Hit, Death, TurnLeft, TurnRight. All avatars have explicit shared fighting-style direction and per-avatar cadence/leading-side choices. Standing rigs use raised guards and planted staggered feet; creatures use body-specific accents. Total: 145,831,924 bytes. Load on demand.

The 34 textured humanoid anatomy sets and 14 scout outfits reuse Quaternius CC0 art: https://quaternius.com/packs/universalbasecharacters.html and https://quaternius.com/packs/modularcharacteroutfitsfantasy.html . Full provenance/notices are in `art/`. Original game costume/equipment accompanies the licensed parts.

All 45 packed editable Blender scenes and action/hash manifest are in `art/avatars-v6/`. Motion curves are authored in `src/avatarCombatMotion.ts`, sampled into native keyframes, then imported into Blender for editing. These are shared archetype motions, not 45 bespoke mocap sets. Existing source/binary v2/v4/v5 artifacts remain historical. See `docs/avatar-combat-motion.md` for reproduction, checks and remaining limits.
