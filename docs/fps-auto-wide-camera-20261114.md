# AUTO WIDE camera correction (14 November 2026)

Owner reported AUTO staying in WIDE during multiple engagements and asked for better broadcast feel. `/root` owns director logic, focused camera regressions and this handoff without delegates.

The old director extended `wideUntil` to the current time plus one second on every frame with multiple exchanges. Continuous fighting therefore kept WIDE open indefinitely. Its fallback also treated isolated shooting/utility actors as separate fights without requiring opposing participants.

AUTO now uses WIDE as a short establishing cut:

- The cut has a fixed 1.25-second deadline that continuing fighting cannot extend.
- It returns to player coverage when the deadline expires or the second exchange stops.
- Another automatic overview requires a 12-second cooldown after the original deadline and a new split-fight episode. At least two seconds without separated exchanges re-arms the episode. A fight that begins during cooldown cannot trigger a delayed overview halfway through that same fight.
- Imminent kills, recent kill beats, clutches and the followed player's objective channel take priority over WIDE, including interrupting an already active overview.
- Only connected opposing exchanges with a current clear sightline and shooting/imminent-kill evidence qualify. Two utility setups or isolated allied shooters no longer manufacture a split fight.
- Manual WIDE remains available without the automatic timeout. Returning to AUTO clears its old overview timer; new rounds and match resets clear episode/cooldown state.

Player selection, fight locks, kill handoffs, bomb-plant PIP, manual camera geometry, simulation and gameplay remain unchanged. The existing WIDE fixture now supplies two real opposing exchanges instead of two isolated friendly shooters.

Verification: all 17 director tests pass, including 30 seconds of sustained split fighting, fixed-deadline expiry, immediate kill-preview interruption, utility-only false positives, cooldown/re-arming, secondary-fight loss, manual WIDE/AUTO transitions and new-round reset. TypeScript passed. Log: `tmp/fps-auto-wide.log`.

No broad suite/build rerun, browser/GPU review, deployment, live-state mutation or asset processing. Reload the broadcast to load the revised director. Preserve prior performance/animation work, parody aliases, private DNA, careers, historical paths and Colab boundaries.

Changed sources: `EsportsClash.Web/src/fps/fpsBroadcastDirector.ts`, `EsportsClash.Web/src/fpsBroadcastDirector.test.mjs`.
