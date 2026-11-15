# Coordinated tactics restored with duel gunplay changes

13 November 2026. Owner: `/root`; no delegates.

The owner superseded the previous rollback: restore the coordinated tactics and improve them, with particular concern that gunplay became worse when those tactics were added. This pass owns `fpsLiveSimulation.ts`, `fpsLiveTactics.ts` and `fpsLiveMovement.ts`. Map, graphics, organizer identities and other pending work are preserved.

## Coordination

- Restored regroup, utility and breach orders, public numerical-advantage decisions, conservative CT probing when far ahead, and information-based trade responses.
- Entry approaches are assigned once per execute using known route lengths and lane occupancy. The entry player and device carrier keep their guns; available supporting players handle setup utility. The entry player must have a ready weapon before a normal utility release.
- Contacts and clock/deadline pressure release the execute. The coordinator does not clear active peeks, aim, recoil state or firing movement. It only asks unengaged players to reconsider their next move. Rotations also leave committed duels alone.
- Execute following leaves lateral room for a firing lane. It does not pull someone out of an ongoing duel, retreat or objective channel.
- Defusers can give a nearby cover player up to 1.8 seconds to join when safe. A free, covered or urgent defuse proceeds. This replaces the earlier broad waiting condition.
- Team remaining-opponent counts stay public roster/death information. Physical duel pressure and aim noise continue using local seen/reported threats; the total opponent count is not injected as five nearby threats.

## Gunplay and equipment

- Precision weapons beyond eight metres wait for the stationary recovery already used by their ballistic spread. The readiness gate and spread calculation now share the same stance-dependent settling time. Close shots, SMGs and ordinary pistols retain their existing movement limits.
- Brief shot commitments prevent starting a new strafe, abandoning a burst to peek home, or replacing a combat decision between bullets. Low HP, actual retreat, reload and an obstructed friendly-fire lane still take priority. Movement learner selection is retained across the short burst commitment.
- The current visible target has a bounded initial commitment and remains preferred during a burst. A sub-0.2-second visibility interruption retains only the last sampled aim, without updating hidden enemy coordinates or resetting reaction for that brief interruption.
- Crouching begins on a sustained rifle/heavy spray rather than automatically after every two-shot burst. Standing back up waits for a pause in shooting. Trigger discipline against an unaware back is shorter, distance-limited and stops holding the trigger if the fight becomes immediate.
- Friendly-fire lane checking traces the intended three-dimensional shot against allied hit shapes. A teammate above/below the shot does not block it merely by overlapping the two-dimensional line.
- Sidearm use has a minimum commitment and returns to the primary after disengagement, or when the empty sidearm requires a loaded primary. It no longer switches back just because the visible opponent crossed an eight-metre threshold.
- Reloading reserves only the rounds missing from the current magazine. Completing a reload adds them; cancelling refunds reserved rounds. Weapon swaps and death use the same cancellation path, preserving ammunition.
- Weapon damage, recoil patterns, mechanical spread, individual recoil-control consumers and projectile collision remain in place. No favorable-hit selection or weapon-stat buff was added.

## Friendly flashes

Source inspection found that the earlier setup called `prepareFlashTeam` before a throw existed, then called it again at release. It told all teammates within 22 metres to turn, even when walls, elevation or their facing protected them. Cancelled preparations could therefore leave false turn/wait schedules.

- Warnings and entry windows are scheduled only after a grenade is committed to release.
- Turning requires actual forecast range and three-dimensional exposure, with a further exposure check when the warning takes effect. Players already facing away do not receive a forced turn.
- Turns use the nearer safe angle rather than an unconditional 180-degree reversal.
- A flash is rejected if it would force a teammate to expose an active duel or objective channel. Utility setup checks this again before release.
- Utility retries are bounded and spaced to avoid forecasting the same unsafe setup every physics tick.

## Verification and boundaries

The owner's standing instruction to skip checks/tests remains active. No tests, builds, type/lint/syntax checks, browser/runtime review, visual comparison, benchmark or deployment was performed. These are source changes, not measured proof of improved gunplay. Existing test baselines were not rebased. New matches construct the updated local simulation. Snapshot fields remain v14; the new commitment/order fields are internal.

No official/historical identity, careers, private DNA, parody aliases, frozen learning artifacts or owner-started Colab asset gates were changed. No asset jobs were started. This supersedes the tactical rollback in the previous handoff, while retaining that record as history.
