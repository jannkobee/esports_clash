# Information-driven FPS brain and mechanical audit (11 November 2026)

The owner requested open-ended play rather than fixed round scripts: actors communicating, meaningful IGL/role decisions, active CT information play, remembered opponent tendencies, utility knowledge and audited micro movement. `/root` owned this local exhibition pass without sub-agents. No external AI service, character pipeline, official-match activation or browser automation was used.

## Decision architecture

The simulation remains deterministic for identical seeds and inputs. Variety comes from changing evidence, actor state, objectives, roles, teammates and bounded seeded choice, not randomly overriding physical rules. This is not a trained neural controller or a claim of literally infinite behavior.

`fpsLiveBrain.ts` adds an explicit local approach planner. Its inputs contain personal beliefs, friendly positions, role, clock, current call, visited positions and a short commitment. They do not contain hidden world opponents. Candidates compete on role suitability, travel, crowding, remembered danger and urgency; a short commitment prevents per-tick route oscillation. Entry/trade prefer entry space, lurkers favor alternate approaches, and caller/support/sniper roles can obtain Mid control. Reaching a position removes it from the current information search. Low time and execute calls penalize detours.

`fpsLiveSimulation.ts` removes slot/archetype-forced split, fake, Mid and lurk movement branches. The seven historical labels still influence the initial site-selection history, but they do not force actor routes or a timed utility sequence. Initial calls describe a provisional site lean. Immediate personal information, device responsibilities and mechanical legality remain authoritative.

## Communication and command

Actual sightings and anonymous cues produce throttled radio reports. Existing communication/chemistry latency, report confidence, original observation timestamps and no-echo rules remain. Hearing does not manufacture enemy identities. An explicit caller is preferred as IGL; otherwise the living player with the strongest Calling/legacy leadership is selected by the existing election. Calls appear in the radio HUD and team information text.

IGLs can authorize supported site executes, redirect against evidence, reinforce pressure, or send a scout and trading partner to check quiet space. Execute calls increase coordinated pressure preference and discourage detours after acknowledgment. CT probes reserve one defender per site, exclude anchors from the roaming group, require sufficient surviving teammates and healthy candidates, and expire. The scout checks an entry while the second actor supports from behind. Recipients acknowledge with role-specific intent. The existing opposite-site guard and skill-dependent call delay remain.

`fpsOpponentPatterns.ts` now records confirmed first-hand sightings and received sight reports for all local actors, not only detailed profiles. Memory is deduplicated by round and location, limited to 16 areas with six recorded rounds each. Area tendencies require at least two separate previous rounds in the recent six-round window; early pressure is counted from the original observation time. Footsteps cannot create a counted trend. CTs can check the opposite lane to a repeatedly observed tendency, or preempt repeated early pressure with delay smoke. These are hypotheses about habits, never current enemy locations. The older three-round remembered-angle behavior remains. Memory is local to the exhibition, resets when sides reset, and is not saved across reloads or applied to official careers.

## Utility knowledge that changes behavior

`LIVE_UTILITY_RULES` in `fpsLiveGrenades.ts` is shared by physics and planning: smoke radius/duration, flash range/front/back durations and gravity. `predictLiveGrenade` forecasts the actor's own throw against static map geometry without changing the real grenade. No unseen enemy position is consulted.

- Smoke occlusion now follows the actual three-dimensional eye ray. Smoke still does not stop bullets or movement.
- Actors remember smoke volumes they can perceive; unseen smoke is not a tactical-planner input. A newly noticed smoke has a conservative lifetime estimate, and a visibly vanished cloud is removed from memory.
- Known smoke edges can delay an unsupported crossing. Objective urgency or a communicated friendly-flash window can justify crossing. The cloud is not a collision wall.
- Friendly in-flight/known smoke coverage suppresses redundant throws. Predictions do not guarantee the real utility lands perfectly; existing execution error remains.
- Flashes warn nearby teammates using predicted landing position/time. Players turn shortly before the pop and can move after detonation with a Coordination-dependent release delay. Engaged actors also turn and suppress firing while turning. No movement window depends on a hidden enemy's actual blind state.
- A planned flash is rejected when its predicted effect would expose a teammate currently planting/defusing who cannot turn away. This uses current allied positions, not a prediction of all future allied movement.

Only the existing smoke/flash arsenal is modeled here. HE, incendiary and decoy reasoning were not added, and these rules describe Hexatrick's implemented mechanics rather than a verified reproduction of a current Counter-Strike patch.

## Mechanical audit

- Pressure strafing previously kept issuing lateral movement above the shot-speed limit. It now alternates short movement and settling windows, allowing counter-strafing and actual fire. Crouch commitments can release after burst recovery instead of remaining stuck for an engagement.
- SMG/pistol/sniper movement thresholds now use weapon categories, so MP9/MAC-10, Glock/USP-S and Scout inherit the appropriate family rules. Deagle retains the stricter precision threshold. Detailed-profile physical limits remain common; no new damage/speed bonuses were added.
- A cautious jiggle can return behind cover after its brief exposure, including while retaining a visible contact. Swept wall collision remains authoritative.
- Fixed-landmark automatic jumps were removed. An information jump requires a recent personal clue and a real predicted visibility gain over low cover. Jump physics lands normally; jump accuracy penalties remain. A movement command releases an elevated hold into gravity rather than allowing a moving actor to remain suspended.
- Trigger-discipline awareness no longer reads the opponent's private target/last-seen state; it uses visible facing, recent gunfire and personal damage instead.

## Verification

- Required `npm.cmd run check:game`: successful, main suite 769 tests / 747 passed / 22 existing skips / zero failures, plus three batch simulation checks and TypeScript. One additional jump regression was added afterward and is covered by the final focused run below.
- Final focused brain/tactics/intel/profile/strategy suite: **85/85 passed**. Includes no hidden-enemy input to CT calls, site-guard preservation, role/clock/crowding/evidence choices, round-deduplicated tendency decay, IGL execute without firing-target acquisition, actual strafing/braking/shots, positive and negative jump selection, grenade prediction without mutation, smoke-eye geometry and flash timing. Existing deterministic/profile privacy tests remain green.
- Production build passed (Vite 11.01 seconds); existing >500 kB chunk warning remains.
- Three detailed-profile live soaks: 18,000 fixed steps each (600 simulated seconds), seeds 1337/421/99017. All reached round 7. Scores were 2-4, 4-2 and 1-6; shots 266/402/347; kills 36/31/38; CT probe-call counts 5/6/4; plants 7/6/7; zero sampled round-timeout results. Finite coordinates, map bounds and actor-radius wall exclusion were checked once per simulated second. These are progress/diversity checks, not full-match balance or exhaustive collision certification.
- Logs/artifacts: `.local-tools/fps-brain-focused.log`, `fps-brain-types.log`, `fps-brain-game.log`, `fps-brain-build.log`, `fps-brain-soak.mjs`, `fps-brain-soak.log`, `fps-brain-soak.json`. The soak harness initially used navigation-clearance margin instead of physical actor radius and a mismatched plant-event string; both measurement mistakes were corrected before the final successful runs.

## Boundaries

No rendered visual acceptance, professional-strength benchmark, long-term training, cross-session opponent database, new network protocol or official deployment is claimed. Current utility/retake/boost/ballistics remain simplified exhibition mechanics. Timers still enforce actual cooldowns, signal delay, commitments and urgency; eliminating fixed plays does not mean eliminating physical timing. Preserve official/historical matches, career idempotency, parody aliases, private DNA, inert Economy Judgment, stable profiles, `/evolution/game-modes` availability and owner-started Colab asset gates.

Affected code: `fpsLiveBrain.ts`, `fpsLiveSimulation.ts`, `fpsOpponentPatterns.ts`, `fpsLiveGrenades.ts`, `fpsLiveMovement.ts`; tests `fpsLiveBrain.test.mjs` and updated `fpsLiveTactics.test.mjs`.
