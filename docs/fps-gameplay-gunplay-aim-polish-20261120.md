# FPS Simulation Engine: Aim, Gunplay, Tactical Intelligence & Anti-Regression Polish (2026-11-20)

Owner request: audit and upgrade the simulation engine across performance, competitive balance, lawful tactical intelligence (enemy economy reads, free map-wide territory control, stealth creeping & man-advantage discipline, CS timing), and then run a dedicated polish pass on **aim, gunplay, movement, retakes, and multi-map correctness**, documented with strict anti-regression guards so none of it silently breaks again.

## 1. Aim & Crosshair Invariants (`fpsLiveGunplay.ts`, `fpsLiveSimulation.ts`)

Every shot still comes strictly from the hand-moved crosshair (`stepLiveManualAim` — no snapping, no head-locking, no per-tick automatic recoil compensation). Preserve these fixes:

- **Single reaction clock, never double-counted.** `getDuelMicroBt()` (`handleReactionWait`) keeps pre-reaction movement inertia while stepping `updateDuelAimAndFire(p, target, dt, true)`, and `manualAimPoint()` anchors real-duel perception delay to `p.acquired` (`Math.max(0.035, p.acquired + basePerc - this.time)`). Speculative prefires (`prediction:*`, `known:*`, `blind:*`) retain their full perception delay. Previously, `isReacting` blocked `updateDuelAimAndFire` for the full `1.0 * reaction` (making parked-crosshair `passiveCrosshairHit` / `reticleWalkIn` dead code in live matches) and then added another `0.45 * reaction` delay on top.
- **Active duel reaction is never wiped by `decide()`.** `decide()` only refreshes `p.reaction = this.reactionDelay(p) * p.reactionVariation` when `!p.target`, preserving `computeLiveAnticipationReadiness` (trade callouts, tight pre-aims, partner combat) and surprise panic penalties computed in `perceive()`.
- **Persistent aim-punch.** `applyLiveAimPunch` shifts `toPitch` and `toYaw` alongside `errPitch`/`fromPitch`/`errYaw`/`fromYaw` so settled crosshairs (`eased === 1`) keep the upward kick across subsequent ticks until the next corrective hand submovement recovers it.
- **Neck/upper-chest trigger bounds & competitive head discipline.** `liveAimTargetSize(d, 'neck')` uses tight collar/upper-torso half-axes (`0.135 × 0.145 m`) instead of full torso (`0.19 × 0.32 m`), preventing bots from firing 15 cm above a standing enemy's helmet. `liveAimZone` ramps head-level first-shot reach sharply for skilled/pro precision (`> 0.65`) while keeping average shooters (`<= 0.55`) and sustained sprays on chest/body. `p.sampledAimZone` carries the chosen zone into `manualAimAt`, and `p.sampledHeadY` converges at `0.68` blend on stance changes.
- **Strafe-reversal velocity damping.** `stepLiveManualAim` damps stale `velYaw`/`velPitch` (`* 0.35`) when a moving target reverses direction (`dYaw * velYaw < 0`), cutting long-range strafe overshoot and multi-second whiff duels.
- **Elevation-accurate pre-aim.** `preAim()` clamps horizontal range to `Math.max(2.5, d)` on holds/contacts (`source !== 'route'`) so elevated decks, balconies, and stairs pre-aim at head level rather than above close enemies.

## 2. Gunplay & Movement Invariants (`fpsLiveMovement.ts`, `fpsLiveSimulation.ts`, `fpsLiveWeapons.ts`)

- **Crouching down never freezes a spray.** In `applyMotion()`, `p.stillSince` resets only on movement (`speed > 0.12`), jumping, or **standing back up** (`!p.crouch && p.wasCrouched`) — never when crouching down into a rifle spray (`SettlingMidSpray` cut ~80%).
- **CS2 crouch-walk ("crab-walk") spraying.** `stepDuelMovement` moves at `LIVE_CROUCH_SPEED` (`1.55`) on `'crouch-strafe'`, `liveAccurateShotReady` and `liveShotSpeedLimit(..., crouch)` allow non-sniper crouched firing up to `LIVE_CROUCH_SPEED + 0.05`, and `fire()` applies `0.2x` movement spread on crab-walk sprays. Bolt-action snipers (`sniper`, `scout`) stay strict and must stop even when crouched.
- **Real `movementControl` skill in combat counter-strafing.** `moveSkill(p)` (`this.skill(p, 'movementControl', p.skills.mechanics)`) drives combat braking (`inCombatBrake`) and `liveShotSpeedLimit` everywhere in `fpsLiveSimulation.ts` instead of the old hardcoded `p.profile ? 0.5 : p.skills.mechanics`. Non-combat doorway routing keeps uniform braking so restaurant/choke traffic yielding stays deterministic.
- **Range-aware cadence & clean spray resets.** Rifles sustain at `< 16 m`, burst at `> 30 m`, and honor `learnedCadence` / player tendencies across `16–30 m`; full sustained sprays pause `0.32 + (1 - recoilControl) * 0.16 s` so `recoverLiveSpray` genuinely brings `sprayIndex` down instead of restarting at index 6–8. Non-auto pistols (`usp_s`, `glock`, `p250`, `fiveseven`, `tec9`) tap-pace beyond `18 m` (and SMGs burst beyond `22 m`) instead of mag-dumping into spam inaccuracy at 45–55 m.
- **Opening knife discipline.** `safeOpeningKnife` ends at `liveElapsed < 4.5` (down from `6.5`) and never holsters primary during an opening `pair_lead`/`pair_trade` crunch.

## 3. Gameplay, Lawful Tactical Intelligence & Multi-Map Invariants

### Lawful Enemy Economy & Loadout Reads (`fpsLiveEconomyRead.ts`, `fpsLiveEconomy.ts`, `fpsLiveTactics.ts`)
- Tracks only public scoreboard win/loss streaks, round outcomes, survivor counts, and observed `weaponHint` sightings/killfeed — never hidden enemy cash.
- Drives anti-eco buys (SMG farm/armor, no glass-cannon AWP) and anti-eco / anti-stack / anti-AWP tactic and setup weights.
- `resetEnemyEconomyTracker` uses `this.attackTeam === 'blue'` on side swaps; `confirmed_eco` requires real low-tier sightings without false-triggering on SMGs.

### Free Map-Wide Territory Control (`fpsLiveTerritory.ts`, `fpsLiveSimulation.ts`)
- `buildMapControlZones` derives 7 reachable zones (`A_SITE`, `A_FORWARD`, `A_DEEP`, `MID_CONTROL`, `B_SITE`, `B_FORWARD`, `B_DEEP`) spanning **both halves** on any map (verified on Fontessa and Spillway, path-checked from CT spawn).
- `refreshTeamTerritoryZones` requires `roundLiveAt` and `cellClearedAt > roundLiveAt + 0.3` (or physical ally proximity) so `resetLiveInfluenceGrid`'s initial timestamp never fake-clears unvisited zones at tick 1.
- `composeFreeDefenseTerritory` caps opening pushers at **at most 2 CTs** on rifle rounds (and **at most 1** on pistol rounds unless `aggressivePair` is explicitly called) so 3 CTs always protect structured site crossfires, keeping `pair_trade` at tight `2.8 m` trade spacing and bailing cleanly on outnumbered contact.
- `freeFlow` in `decide()` pauses only for CTs explicitly listed in `order.responders` on `probe`/`rotate`/`reinforce` — non-responders and `watch`/`hold`/`recheck` CTs keep executing map control and quiet-lane empty-space expansion (`SITE -> FORWARD -> DEEP -> FLANK_WRAP`, capped at one expander per quiet lane with a live site guard retained).

### Stealth Creeping & Man-Advantage Discipline (`fpsLiveSimulation.ts`)
- `shouldCreep()` balances `lastExposedAt` (never stamped by the bot's own sprinting, avoiding sprint self-lock) against unvisited choke uncertainty (`cellClearedAt <= roundLiveAt + 0.25`), lurk/flank timing, and late-round urgency.
- CTs assigned to `info_creep` / `deep_flank` sprint across their safe CT half and drop into silent walking once approaching the contention point (`< 16 m` / `< 26 m`) or crossing Mid.
- `holdAdvantagePair` enforces paired crossfire discipline at `advantage >= 2 && enemiesLeft >= 2 && bomb.status !== 'dropped'` (preserving 3v1/4v1 info sweeps).

### Tactical Timing (`fpsLiveTiming.ts`, `fpsLiveSimulation.ts`)
- Rotation travel-time exploit windows, chaos-triggered silent lurk/flank holds (`lastChaosAt >= armedAt + 0.6`, chaos gated to breach/plant/kills/utility/sustained fire), close-range audio vulnerability punish swings (reload, grenade pin, AWP bolt), expiring barrier pre-staging, and zone timing-gap clocks.

### CT Retake Cohesion & Multi-Map Correctness (`fpsLiveSimulation.ts`, `fpsLiveAnticipation.ts`, `fpsLiveBomb.ts`)
- When 2+ CTs are alive with ample bomb slack (`defuseSlack > 10`) and teammates are rotating in (`14–38 m`), the designated defuser stages briefly with the retake group instead of solo-charging onto the bomb 1v3. Non-defuser CTs can trigger `tradeSwing` during retakes.
- `prepareFlashTeam` opens ally swing windows right on the pop (`detonateAt - 0.04 + release` through `detonateAt + 1.5`).
- `anticipateLiveContact` (`fpsLiveAnticipation.ts`) and `liveC4Damage` (`fpsLiveBomb.ts`) take `runtime: LiveMapRuntime` (threaded from `this.map`) so Spillway and future maps never query Fontessa walls, entries, or elevation.

### Performance & Official Replay Polish (Earlier Phase 1 — Preserved)
- Bounded `nearestNode()` local clearance ring, static A* `nodePathCache` + reusable scratch buffers, `liveSmokeDepth` bounding-sphere reject, spatial queries in `fpsLiveMap.ts`, `FpsLiveReplaySource` `seek()`/`seekToRound()`/`playbackRate` + evicted-chunk reload, `fpsLiveActorTypes.ts` / `fpsLiveSimHelpers.ts` modular extraction, M4A1-S (`$2,950`, `3.95x` HS) & CT economy recovery, 48/48 IGL tendencies and v5 official report cash/set-piece/roundStartSeconds fields.

## 4. Measured Before vs. After Telemetry (36 rounds per map, seeds 101/202/303, 30 Hz)

| Metric | Fontessa Before -> After | Spillway Before -> After |
| --- | --- | --- |
| T / CT Win Rate | `77.8% / 22.2% -> 55.6% / 44.4%` | `55.6% / 44.4% -> 52.8% / 47.2%` |
| First Deaths (T / CT) | `13 / 23 -> 20 / 16` (`13 / 23` w/ pistol tap) | `16 / 20 -> 23 / 13` |
| Retake / Defuse Rate | `12.5% -> 20.0–35.7%` | `21.1% -> 26.1–29.2%` |
| Avg Time-to-Damage (TTD) | `811 ms -> 715 ms` (`-96 ms`) | `820 ms -> 630 ms` (`-190 ms`) |
| Rifle HS / Hit | `20.0% -> 26.4%` (`+6.4 pts`) | `14.2% -> 18.2%` (`+4.0 pts`) |
| Far (`>24 m`) Rifle Spray Rate | `2.0% -> 0.8%` | `3.6% -> 1.4%` |
| Settling-Mid-Spray Freezes | `98 -> 19` (`-81%`) | `133 -> 29` (`-78%`) |
| Long Whiff Duels (`>2.5 s`) | `263 -> 194` (`-26%`) | `559 -> 417` (`-25%`) |
| CT Across-Mid Control | `8.2% -> 9.3%` | `8.4% -> 9.7%` |

## 5. Anti-Regression Suites & Verification

- New dedicated anti-regression suite: `EsportsClash.Web/src/fpsGunplayAimGameplayPolish20261120.test.mjs` (**8/8 passing**) covering aim-punch persistence, `'neck'` trigger bounds & strafe-reversal damping, zero crouch-spray `stillSince` reset & crab-walk accuracy, `movementControl` skill differentiation, `decide()` reaction preservation, `duelMicroTree` non-double-counted reaction & parked-crosshair walk-ins, Spillway `anticipateLiveContact`/`liveC4Damage`, CT opening pusher cap & retake defuser staging, and long-range pistol tap pacing.
- Existing suites verified green after final edits: `fpsEngineUpgrades20261119.test.mjs` (**10/10**), `fpsLiveGunplay.test.mjs` (**17/17**), `fpsOperativeHitbox.test.mjs` (**4/4**), `fpsLiveRouting.test.mjs` (**7/7**), `fpsLiveCombatDecisions.test.mjs`, `fpsTradeConversion20261117.test.mjs`.
- `tsc -b`, Vite `npm run build`, and `node scripts/build-worker-engine.mjs` all pass.
- **Coordination & open note**: During the final full-suite run, a parallel visual-collider pass added `FONTESSA_VISUAL_COLLIDERS` (`fpsVillageColliders.ts`) and opaque Fontessa props in `fpsLiveMap.ts`, leaving 4 Fontessa geometry/collider tests (`fpsProTacticsRegression.test.mjs` #6, `fpsSpatialAwareness.test.mjs` #161, `fpsTacticalEmergence.test.mjs` #92, `fpsUtilityBrain.test.mjs` #144) failing under those new visual colliders; this pass did not modify `fpsVillageColliders.ts` or revert that parallel map geometry work. No browser GPU frame rate was measured here.
