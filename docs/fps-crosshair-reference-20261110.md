# Stable crosshair placement and adopted pro-match reference

Later continuation: [local v5 information-driven play](fps-information-play-20261110.md) implements bounded multi-contact confidence/source memory and evidence-based calls. The remaining gaps below are historical to the crosshair pass; the continuation states its precise limits.

On 10 November 2026 the owner asked to fix crosshair placement because the aim moved left to right, and supplied **Counter-Strike 2 Pro Match Analysis → FPS Simulation Mechanics**. `/root` owns the aim, broadcast UI and verification work; no agents or asset jobs were dispatched. This is a correction to browser-local exhibition v4, not an official match-rule migration.

The exact supplied reference is preserved as [fps-pro-match-analysis-20261110.txt](references/fps-pro-match-analysis-20261110.txt), 41,563 bytes, SHA-256 `ce979697c532c1ca7f56ea1e5f7f18f49b0ea7cb2183bb11b031bfe07532a3c5`. It is owner-supplied design guidance. Its match records, source links and external game-specific claims were not independently verified during this change. Its own text explicitly distinguishes reported match examples from frame-by-frame video inspection. Do not treat it as verified Hexatrick rules or claim its entire proposal is implemented.

## Crosshair correction

The previous holding code deliberately added a sinusoidal yaw scan. Moving actors also aimed at each short navigation waypoint, and holding yaw was calculated from the future goal rather than the player's actual position. These produced unnecessary lateral aim changes.

- Holding now watches a stable world-space map angle. There is no idle yaw sweep.
- Movement looks ahead six metres along the known route, or pre-aims a known frontal holding position when its geometry is exposed. Small steering corrections do not immediately redirect aim.
- Ordinary aim selections commit for 0.9 seconds; remembered-contact selections commit for 0.65 seconds. Passing the watched point or moving three metres can release the commitment. Fresh relevant contact interrupts a routine map hold; acquisition and actual combat continue to use personal sight and existing reaction delay. No hidden opponent position is consulted by pre-aim selection.
- Deliberate corner checks favor nearby frontal angles and include enough turn/settle time before resuming movement. Their selected angle persists briefly after the check rather than immediately snapping back to the route.
- Finite turns ease their final correction without overshooting. Mechanics remains the existing skill bridge; no new independent aim rating or personality accuracy bonus was introduced.
- The screen reticle uses four precisely centered bars rather than a font glyph. It remains fixed to the canvas centre. Decorative sideways weapon sway was removed; actual knife swings, drawing and recoil remain.

Code: `src/fps/fpsLiveAim.ts`, `fpsLiveSimulation.ts`, `fpsLiveViewer.ts`, `src/components/FpsLiveBroadcast.tsx` and `fps-live-broadcast.css` in `EsportsClash.Web`.

## Adopted reference boundaries

| Reference principle | Current implementation / next boundary |
| --- | --- |
| Separate placement, acquisition, tracking and movement execution | This correction adds stable pre-aim/commitment and eased corrections; v4 already samples personal vision, varies reaction and requires weapon-appropriate stopping. Detailed independently rated flick/recoil/spray-transfer abilities remain future work. |
| Perception, uncertain beliefs and communication | Existing forward vision, occlusion, uncertain hearing, delayed reports and expiring contacts remain. A richer multi-contact confidence model and opponent-pattern memory are future work. |
| Tactical movement arises from executable actions | Existing collision, acceleration, peeking, angle clearing, cover and trade spacing remain. Jumping, crouching, vertical combat and the full catalog of peek choices are not supplied by this aim correction. |
| Team plans compete and can adapt | Existing default/contact/split/rush protocols, shared buys, utility-to-entry sequence and caller-led site changes remain. Credible fakes, learned scouting/anti-strats and coordinated double peeks/retakes need separate implementation and evidence. |
| Mechanical ability, personality, specialty and role stay distinct | Preserve the approved role/personality/specialty/individual-DNA/system-fit design and existing seven-attribute bridge. The six descriptive player examples are illustrative, not six replacement classes or guaranteed powers. |
| Mental responses and adaptation must be explainable | Existing pressure/exertion/contextual identity inputs remain. No artificial comeback bonus, guaranteed highlight, new persistent emotional system or series-level learning was added. |
| Economy and historical reproducibility matter | Existing real-wallet buys, conserved drops/ammunition, survival equipment and deterministic seeded simulation remain. This reference does not adopt CS2 reward, round-count, patch or overtime rules implicitly. |

The broader priorities are adopted as future behavioral guidance alongside [the professional skill mapping](fps-professional-skill-reference.md). They do not authorize changing historical artifacts, publishing unqualified assets, exposing private DNA, duplicating career development or altering the preserved MOBA rules. Character generation/rigging/animation remains owner-started through the existing Colab-only pipeline.

## Verification

Nineteen focused live tests pass, including four new regressions: quiet holds remain steady over six seconds; alternating steering waypoints do not sweep aim; fresh contact interrupts a hold while changing callouts respect commitment; and correction approaches its angle without overshoot or dependence on hidden enemy movement. Existing wall/knife/economy/utility checks and paired 9,000-step seeded determinism/privacy/wall-exclusion checks also pass. TypeScript passed.

Native Chrome inspection observed the new four-bar reticle centered in the live first-person canvas with the round clock advancing. This is a rendered placement check, not full-match temporal or mobile acceptance. Required `npm run check:game` passed: 681 passed, 22 skipped, zero failures, plus all three additional simulation tests and TypeScript. `npm run build` passed with the existing large-chunk warning. The controlled impact attribution diagnostic also passed. Logs: `.local-tools/fps-live-crosshair-check-game.log` and `.local-tools/fps-live-crosshair-build.log`.
