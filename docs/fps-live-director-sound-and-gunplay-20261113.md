# Local FPS broadcast timing, bomb audio, and weapon handling (13 November 2026)

Owner asked the local FPS exhibition to cut to likely fights before the first kill, stop switching focus during a duel, announce planted C4 to CTs, add proximity bomb ticks and jump noise, and make recoil and accurate shots depend more on deliberate control.

## Changes

- `fpsBroadcastDirector.ts` adds an early duel read from visible sightlines and both players' aim direction. Predictive cuts can happen after 0.28 seconds instead of the normal 1.2-second cut interval, then lock the camera subject for 2.2 seconds. A kill handoff still applies immediately if the followed player dies. First-person action framing begins on pre-contact sightlines and remains available manually.
- `fpsLiveSimulation.ts` sends a CT radio call and gives defenders an explicit planted-site retake cue as soon as the plant completes. CT planning is reevaluated immediately; the synchronized retake leaves staging after about 4.5 seconds at most, rather than waiting until the 40-second bomb clock reaches 26 seconds. Bomb ticking is queued at a spatial point every 1.05 seconds, then every 0.62 seconds under 18 seconds, and every 0.32 seconds under 7 seconds.
- `fpsBroadcastAudio.ts` renders the bomb ticks as a spatial two-tone cue audible within 22 map units. Jump takeoff and landing generate separate spatial thuds within 25 units. Jump sounds also enter the AI's anonymous footstep-hearing path; they do not reveal an actor identity.
- `fpsLiveWeapons.ts` defines bounded weapon-family recoil kicks and recovery. `fpsLiveSimulation.ts` applies rising vertical and patterned horizontal recoil to every actor. Recoil Control remains a separate 1–10 execution ability; it governs recoil recovery, rifle spray length, and settling time. The same weapon impulse is applied regardless of rating. The seven-stat compatibility path estimates it from LAN only where a detailed profile is absent. Rifle, pistol, and sniper shots get their tight accuracy only after standing still for 0.22 seconds or crouching still for 0.14 seconds; unstable shots get a larger spread penalty.

These changes apply only to browser-local exhibition matches. Official/historical simulation, MOBA, player identities, private DNA, careers, aliases, and Colab asset processing are unchanged. Synthesized cues and the custom recoil pattern are local approximations, not recorded CS2 audio or engine-level CS2 parity. Browser-rendered and competitive balance review remain outstanding.

## Affected files

`EsportsClash.Web/src/fps/fpsBroadcastDirector.ts`, `fpsBroadcastAudio.ts`, `fpsLiveSimulation.ts`, `fpsLiveWeapons.ts`, `fpsSkillProfile.ts`, `fpsLiveAttributes.ts`, `fpsSkillProfile.test.mjs`, and `docs/agent-handoff.md`.

## Verification

`npm run check:game` passed: 806 passed, 22 skipped, zero failed; the three batch simulation checks and TypeScript passed. The separate sampled MOBA diagnostic printed 0% Blue and 100% Red wins across its ten-seed report; no MOBA code was changed in this FPS task. After the final director-lock adjustment, its focused test file passed (6/6). `npm run build` passed (`tsc -b && vite build`, latest Vite build 3.79 seconds) with the existing large-chunk warning; `git diff --check` is clean. Browser visual/audio acceptance and competitive balance qualification remain incomplete.
