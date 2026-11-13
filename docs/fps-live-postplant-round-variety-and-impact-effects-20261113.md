# Local FPS post-plant priorities, round variety, and impact effects (13 November 2026)

Owner asked for a more deliberate local FPS broadcast and smarter round behavior: remove the generic crosshair for sniper weapons, vary CT setups, keep Ts defending a planted bomb, reduce unnecessary jumping, make the bomb tick visibly accelerate, and add hit/near-miss audio plus blood that stays through the round.

## Changes

- `fpsLiveTactics.ts` selects among six CT opening formations. It avoids repeating the previous formation against the same attacking side, and only biases stacks from confirmed planted sites. Aggressive Banana, Mid-push, and connector-flex setups now move the assigned CTs to different opening positions.
- `fpsLiveSimulation.ts` gives each T a numbered post-plant priority, announces the plan over team radio, clears stale peeks/routes when the plant completes, disables stale-contact investigations after planting, and holds post-plant watch points. Low-health cover remains near the planted device. CTs still receive the immediate planted-site cue and retake assignment.
- Automatic route jumps now have a 24–40 second initial cooldown and a 26–40 second repeat cooldown. Contextual jump-peeks have an 18–26 second cooldown. Bunny-hop chaining was removed; a jump-peek remains available when it can reveal a real sightline over cover.
- Bomb ticks remain spatially limited to nearby listeners, but now accelerate from 0.9 seconds to 0.5, 0.28, and 0.14 seconds as the timer runs out. The urgent/final ticks are louder and higher pitched.
- The generic first-person crosshair is hidden while holding a sniper or scout; the scope reticle remains in the scoped overlay.
- Bullet/knife impacts emit synthesized head/body cues and create persistent ground splatter marks. Bullets that pass within 1.05 metres of an enemy without hitting emit a spatial near-miss sound. Marks stay in the snapshot and renderer until `startRound` clears them.
- The local snapshot advances to v10 for `bloodMarks`. The additions remain in the browser-local exhibition and do not change official or historical simulations.

## Affected files

`EsportsClash.Web/src/components/FpsLiveBroadcast.tsx`, `EsportsClash.Web/src/fps/fpsBroadcastAudio.ts`, `fpsLiveMechanicsLearning.ts`, `fpsLiveSimulation.ts`, `fpsLiveTactics.ts`, `fpsLiveViewer.ts`, `EsportsClash.Web/src/fpsLiveTactics.test.mjs`, `EsportsClash.Web/src/fpsLiveIntel.test.mjs`, `EsportsClash.Web/src/fpsSkillProfile.test.mjs`, and `docs/agent-handoff.md`.

## Verification

`npm.cmd run check:game` passes: 221 tests, zero failures; design checks and TypeScript pass. The focused tactical regression file passes 44/44. `npm.cmd run build` passes in 3.81 seconds with Vite's large-viewer-chunk warning. `git diff --check` passes; Git printed only LF-to-CRLF conversion notices.

Browser-rendered blood visibility and synthesized sound quality have not been reviewed. The scope reticle remains when scoped, and the effects are local approximations rather than recorded CS audio or competitive-balance qualification.
