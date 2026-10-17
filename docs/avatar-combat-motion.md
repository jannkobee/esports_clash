# Roster combat motion — 2026-10-17

The user rejected relaxed standing as a fighting pose, supplied an Invoker reference, requested more natural motion, and explicitly clarified **the entire roster**, then authorized implementation. This pass gives all **45 avatars** directed fighting motion. It reuses existing geometry/textures and improves the poses/animation rather than claiming new character sculpts.

`avatarCombatMotion.ts` explicitly assigns every stable ID to one of eleven shared styles: caster, archer, gun, dual blades, sword, shield, fists, staff, heavy, dancer or creature. Each avatar also has weight/cadence and leading-side direction; nonhuman body accents distinguish frog, demon, void, machine, dragon, rider, beast, light and skiff silhouettes. These are shared archetypes with per-avatar direction, not 45 independently hand-animated sets.

Standing guards use lowered hips, a turned chest, staggered/widened feet, bent knees, raised hands and weapon-specific shoulder/elbow/wrist positions. Thighs spread from the hips instead of translating out of the pelvis. Knee reach compensation and inverse ankle rotation keep planted feet level. Bow/arrow and gun hands counter the complete shoulder chain to keep long weapons aimed forward through recoil and collapse. Existing headwear/armor/cape/tail attachments follow the body. Facial/finger posing, physical cloth and full two-handed weapon IK remain work.

Ten native clips ship per model: **Idle (combat ready), Walk, Run, Strafe, Attack, Cast, Hit, Death, TurnLeft and TurnRight**. Explicit anticipation/release/follow-through/recovery key timings drive arm reach, torso twist and weight shift. Clip export samples these directed curves into glTF transform channels. Constant articulated offsets are explicit, and idle/walk/run/strafe joints plus orbitals/wings/rotors close their native loops. This is code-authored skeletal motion, baked into editable keyframes; no motion-capture service was used.

`avatarMotionTimeline.ts` stores only renderer-owned numeric history: state starts, prior pose times, hit time, shot timer and yaw. `threeArenaScene.ts` supplies 160ms pose blends, shortest-path smooth turning, movement/run/strafe selection, damage recoil and a 1.25s death presentation for actors already seen alive. Expired corpses dispose normally; dead units never become combat targets or re-enter simulation. Paused time stays still and rewinds reset visual history. No borrowed world objects are retained.

Gameplay attack/projectile events are immediate in the existing simulation. Live basic-attack art therefore starts at the clip's release phase and follows through; the full anticipation is available in the native/studio clip. It does not postpone the shot, fake an earlier hit or alter attack/cast cooldowns. Current casts/effects remain mechanically authoritative. Speed selection and pose blending cannot change actual movement, range or collision.

The studio exposes all ten motions, paused poses show useful phases, and switching into animation starts the motion from zero. Reduced motion, camera controls and context/resource lifecycle stay intact. Live form/orb/Gunship/Overdrive bindings remain in place.

`public/models/avatars-v6/` contains all 45 self-contained GLBs, **145,831,924 bytes** total, with original 17-joint sets and ten revised clips. `avatarModelUrl.ts` uses v6 consistently for arena/studio/download with `art=6`. v2/v4/v5 files remain historical. `art/avatars-v6/` contains **45 texture-packed editable Blender scenes**, each with the ten actions; its manifest records actual action names, sizes and hashes. Blender imports the exact shipped keyframes rather than replacing runtime files with a rig-altering re-export. Anatomy sources and CC0 licenses remain those in `art/README.md`.

Rebuild from `EsportsClash.Web`, using the existing licensed anatomy parts (fresh-checkout part preparation is described in `avatar-stance.md`):

```powershell
node --experimental-strip-types scripts/prepare-authored-avatars.mjs --combat
node scripts/merge-authored-avatars.mjs --combat
$env:BLENDER_USER_RESOURCES = Join-Path (Split-Path (Get-Location)) '.local-tools/blender-user'
& '../.local-tools/blender/blender-4.5.3-windows-x64/blender.exe' --background --factory-startup --disable-autoexec --python-exit-code 1 --python scripts/save-avatar-blend-sources.py -- --combat
npm.cmd run check:game
npm.cmd run build
```

Validation/evidence:

- Directed-motion tests cover every ID, ten finite articulated clips, actual attack release, blend endpoints, closed locomotion loops, planted level feet, repeatability, frozen inputs, pause/rewind, shot restart, hit time and shortest turns. Saved-file tests reload v5/v6 and validate all hashes, joint sets and clip names; texture decoding is separate in Chrome.
- The scene death test verifies frozen units remain unchanged while seen corpses appear briefly and are then released. **386 game tests**, three deterministic simulations, TypeScript and the production build pass with the existing chunk advisory. Results are recorded in `avatar-combat-final-verification.json`, `avatar-combat-game-check.log` and `avatar-combat-build.log`.
- Chrome `avatar-combat-native-verification.json` covers **450 native clips**, sampling five times each, decoded maps, finite/nonexplosive posed vertices and actual scout outfit deformation. This is sampled validation, not exhaustive intersection checking.
- `avatar-combat-verification.json` covers all 45 studio selections, ten motion controls, GLB download, keyboard rotation, reduced motion, phone fit, real context recovery and disposal. `avatar-combat-arena-verification.json` covers GLB-required live layouts/controls/context/disposal and exact 3D/2D world/RNG/execution/opportunity audits at 30/60/90 seconds.
- `avatar-combat-preview.webm` and `avatar-combat-motion-sheet.png` show six actual runtime-bound GLBs through nine states. Attack/cast peak review sheets are `avatar-combat-attack-sheet.png` and `avatar-combat-cast-sheet.png` (`render-avatar-combat-motion.mjs --stills`). The video samples six styles, not the full roster matrix; native/browser checks cover the rest. `avatar-combat-video-verification.json` verifies decoding/playback/seeking and records three extracted review frames. Turnarounds for Arsenaldo, Aiselle, Knuckleberry, Vanta and Fernanda and the 45-model sheet show the fighting guards.

Limits: shared style sets, existing simple meshes/basic hands, some costume intersections, approximate weapon grips, no full terrain foot-lock IK/cloth/ragdoll or exhaustive ability choreography. Death is a short collapse followed by actor removal, without physics simulation. Assets remain uncompressed review files with lazy loading; no device FPS, full-match performance or Wild Rift production-quality claim. Gameplay/ML status/evidence, protected risk-based towers/well/Nexus, real damage/range/targeting, normal retreat, attribution, objective contests, anti-spin and parody identities remain unchanged. Owned inspection services close after verification.
