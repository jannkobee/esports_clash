# Live exhibition v5: playing from information

On 10 November 2026 the owner asked to solidify how the FPS players play from information. `/root` owns perception/memory, information-based calling, utility, observer UI and verification; no agents or asset jobs were dispatched. This advances the browser-local exhibition to `hexatrick-live-exhibition-v5` on the existing `breakwater-live-v4` geometry. Official contextual FPS v3, historical matches/replays, career settlement, private DNA, preserved `/evolution/game-modes` and Colab asset gates remain unchanged.

The prior single `contact` point let new sounds overwrite sightings and supplied little evidence for team decisions. The new implementation keeps that point only as a selected movement/aim bridge over bounded, source-aware memory. The adopted [pro-match reference](fps-crosshair-reference-20261110.md) and [professional skill mapping](fps-professional-skill-reference.md) remain the design references.

## What players can know

`fpsLiveIntel.ts` stores at most 16 contacts per actor. Each contains an original observation time, position estimate, source, observer, optional identified enemy, confidence and spatial uncertainty. Fresh useful identifications have retention priority over noise. Sighting, footsteps, gunfire, knife sounds, unseen damage and utility cues have different confidence/decay behavior. Memory expires within 14 seconds; uncertainty expands while confidence decays. It does not track hidden enemy movement.

Own vision records all personally visible opponents, rather than only the chosen firing target. Existing forward vision, walls, smoke, blindness and reaction/acquisition remain authoritative. Sounds have a nonzero localization error even at high game sense. They receive anonymous spatial/source keys, never hidden enemy IDs. Unseen damage produces an uncertain incoming-threat estimate rather than an exact shooter identity/location. Recognized shooters can produce visual evidence.

First-hand observations can be shared using the existing skill/chemistry-dependent report latency. A report preserves its original time, observer and evidence identity, attenuates confidence and increases uncertainty. It does not set a firing target. Recipients do not automatically relay received reports, and repeated reports of one identified enemy count once. Footsteps from multiple frames/listeners do not become an exact opponent count. Confirmed eliminations remove identified threats, including rejecting delayed reports about an already eliminated opponent; they do not broadcast hidden death positions.

Negative evidence comes from inspecting five points in a small remembered uncertainty area, with forward vision, smoke and walls checked. It weakens a local belief only when the sampled area is visible and no visible opponent occupies it. A large uncertainty area or an obscured point is not cleared. This is not proof that a whole lane or site is empty. Utility detonation visibility is sampled before its newly created smoke/flash blocks the observer, so a visible detonation can become an anonymous clue without revealing its thrower.

## How information changes play

- The caller uses their own received/observed memory, not an instantaneous pool of every teammate's knowledge. A/B/Mid pressure is inferred from source-weighted, aging evidence. Anonymous evidence is capped by source category; it cannot manufacture confirmed enemy counts.
- One weak cue produces a watch call while the other site stays covered. Two fresh identified contacts can draw one supporter. Corroborated activity such as gunfire plus movement can also draw one supporter, with an explicitly uncertain reason. Three strong fresh visual identifications can prompt up to two responders. The opposite site's anchor/one designated guard is preserved, and players currently engaged are not selected as responders.
- Defensive calls hold for up to five seconds (watch calls two). A materially stronger update or dead responder can interrupt commitment. Fading information returns players to their assigned lanes for a recheck. Actual reinforcement goals and facing use the threatened site's north support positions/entry angles; these are not just changed labels.
- An attacker caller can redirect a blocked default/rally from a fresh reported stack, or regroup after known entry losses. The alternative is treated as less confirmed pressure, not known empty. The change resets real route/protocol stages and cannot immediately reverse: calls require more than 14 seconds between plan changes and sufficient round time. A committed entry needs stronger stack evidence to abort. No hidden defender positions enter the call.
- Confidence and multiple known threats influence cover/reload assessment and threat-weighted navigation. Support can flash a reported allied fight subject to inventory, cooldown, range and friendly-exposure checks. Defenders can spend a real smoke to delay confirmed local pressure while help moves. Reports cannot directly create hits, damage or specialty bonuses.
- Planted-device knowledge and normal objective timing override speculative calls and retain the existing retake/save behavior. The new calling system does not replace the objective rules.

## What the viewer sees

The observed-player panel shows a qualitative information line: own sight/report/sound/utility, coarse area, last-seen identified count when supported, confidence band and age. A separate two-column **BLUE CALL / RED CALL** strip shows each caller's current reason. Planted-device messages supersede earlier uncertain calls. Raw contact arrays, report queues, responder state and DNA are not included in public snapshots. The observer minimap remains an observer view of both teams; simulated players do not read it.

Files: `EsportsClash.Web/src/fps/fpsLiveIntel.ts`, `fpsLiveSimulation.ts`, `src/components/FpsLiveBroadcast.tsx`, `fps-live-broadcast.css`, and `src/fpsLiveIntel.test.mjs`.

## Verification and remaining limits

Thirty-two final focused tests pass: 13 information regressions plus the 19 existing live tactic/aim/wall/knife checks. Coverage includes multi-contact retention/decay, report deduplication/age/delivery, anonymous sound and unseen damage, negative evidence and smoke, actual detonation cues, limited reinforcement/guard preservation/commitment/stale reset, correlated anonymous activity, stack-based attack redirects independent of hidden defender positions, real delay utility, actual elimination cleanup, snapshot privacy and objective-call precedence. Existing paired 9,000-step seeded simulation checks still pass for determinism, wall exclusion and DNA exclusion. The controlled impact diagnostic passed during integration.

The broad game run passed 691 tests with 22 skipped and zero failures, plus three additional simulation tests; TypeScript and the final production build passed with the existing large-chunk warning. Later cue/HUD refinements are covered by the final focused run. Logs: `.local-tools/fps-live-information-check-game.log`, `.local-tools/fps-live-information-focused.log`, `.local-tools/fps-live-information-build.log`.

Native Chrome inspection observed a live planted-device phase, the player's aging information line and both team-call lines, followed by a rendered first-person screenshot with the new HUD. That review exposed the stale post-plant label, corrected with a focused regression. It is not a full-match/mobile/performance qualification.

This remains a bounded exhibition AI: coarse A/B/Mid evidence, simple sound attenuation/localization, sample-based empty-angle checks, heuristic calls and existing ballistic utility. It does not model full sound propagation, exact enemy counting from footsteps, a continuous probabilistic occupancy map, learned opponent tendencies across rounds, rehearsed deceptive playbooks, complete retake synchronization, new independent skill ratings or production character assets. No official deployment occurred.
