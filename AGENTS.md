# Repository handoff

## FPS simulation polish: aim, gunplay, movement, lawful intelligence, retakes & anti-regression (2026-11-20, latest)

Read [the record](docs/fps-gameplay-gunplay-aim-polish-20261120.md) before changing manual aim, recoil/cadence, counter-strafing, enemy economy reads, map-wide territory control, stealth creeping, CS timing, retakes, or multi-map anticipation/C4 physics.

- **Aim (`fpsLiveGunplay.ts`, `fpsLiveSimulation.ts`).** Every shot remains strictly hand-moved (no snapping/head-locking). Keep `handleReactionWait` stepping `updateDuelAimAndFire` with perception anchored to `p.acquired` (never double-count reaction + manualAim delay, keeping parked-crosshair `passiveCrosshairHit` alive); never let `decide()` overwrite `p.reaction` while `p.target` is active; shift `toPitch`/`toYaw` in `applyLiveAimPunch` so settled crosshairs keep the kick; use `liveAimTargetSize(d, 'neck')` tight collar bounds so neck aim never triggers above the helmet; damp stale `velYaw`/`velPitch` on strafe reversals; clamp elevated `preAim` distance at `2.5 m` for non-route holds.
- **Gunplay & movement (`fpsLiveMovement.ts`, `fpsLiveSimulation.ts`).** Crouching down into a spray never resets `stillSince` (only standing up/moving/jumping does); CS2 crouch-walk ("crab-walk") spraying is accurate for non-snipers (`LIVE_CROUCH_SPEED`), while snipers remain strict; combat counter-strafing and `liveShotSpeedLimit` use real `moveSkill(p)` (`movementControl`), keeping uniform braking out of combat for doorway routing; rifles honor `learnedCadence` across `16–30 m` and reset spray properly after deep sprays; non-auto pistols tap-pace past `18 m` and SMGs burst past `22 m`; `safeOpeningKnife` stops at `4.5 s` and stays off for opening push pairs.
- **Tactical intelligence & multi-map (`fpsLiveEconomyRead.ts`, `fpsLiveTerritory.ts`, `fpsLiveTiming.ts`, `fpsLiveAnticipation.ts`, `fpsLiveBomb.ts`).**
  - Lawful enemy economy reads use only public scoreboard/observed weapon hints (`attackTeam === 'blue'` on reset).
  - `buildMapControlZones` derives 7 reachable zones spanning both halves on any map; `refreshTeamTerritoryZones` requires `cellClearedAt > roundLiveAt + 0.3` (never fake-clear on tick 1); `composeFreeDefenseTerritory` caps opening pushers at `<=2` (`<=1` on pistol unless `aggressivePair`); `freeFlow` pauses only for CTs in `order.responders` on `probe`/`rotate`/`reinforce`; `evaluateEmptySpaceExpansion` caps one expander per quiet lane with a live site guard.
  - `shouldCreep` sprints across safe CT half before creeping near chokes/enemy half, and `move()` never self-locks sprinting via `lastExposedAt`.
  - Retake defusers with `allies >= 2` and `defuseSlack > 10` stage briefly with rotating teammates; non-defuser CTs can `tradeSwing` during retakes; `anticipateLiveContact` and `liveC4Damage` take `this.map` (never hardcoded Fontessa globals).
- **Anti-regression & checks.**
  - New `src/fpsGunplayAimGameplayPolish20261120.test.mjs` (8/8) + `src/fpsEngineUpgrades20261119.test.mjs` (10/10) + `fpsLiveGunplay` (17/17) + `fpsOperativeHitbox` (4/4) + `fpsLiveRouting` (7/7) all pass; `tsc -b`, `npm run build` (2.96 s), and `dist-worker/fps-engine.mjs` pass.
  - Dual-map 36-round audit (seeds 101/202/303): Fontessa `55.6% T / 44.4% CT` (was `77.8% T`), TTD `811 -> 715 ms`, Rifle HS `20.0 -> 26.4%`, `SettlingMidSpray 98 -> 19`; Spillway `52.8% T / 47.2% CT`, TTD `820 -> 630 ms`, Rifle HS `14.2 -> 18.2%`, `SettlingMidSpray 133 -> 29`.
  - Coordination: 4 unrelated Fontessa geometry tests currently fail under a concurrent agent's new `FONTESSA_VISUAL_COLLIDERS` (`fpsVillageColliders.ts` / `fpsLiveMap.ts`); those visual collider files were left untouched.

## Fontessa visual pass: Mercato gate, surface mapping, light balance, landmarks, grounded smoke (2026-11-20)

Read [the record](docs/fps-fontessa-mercato-and-detail-pass-20261120.md) before changing Fontessa scenery, surface textures, the sun or shadows, roofs, or smoke shape.

- **Surfaces.** Create every textured box with `wrap: LIVE_SURFACE_BOX_WRAP`. Babylon's default layout rotates and stretches the texture on the ±x, top and bottom faces.
- **Light.** Fontessa's light balance and shadow casters live in the Fontessa branch of `fpsLiveViewer.ts`. Scenery outside the play area and sub-texel rods do not cast shadows; keep it that way, or the sun's shadow map stretches again.
- **Mercato gate.** `fpsVillageMercato.ts` holds the gate, the terrace and the cheeks of all three canal stairwells. Gate dressing must stay overhead, flush with the floor, or within the actor radius of a wall (tested).
- **Roofs.** Pitched roofs over flat cutaway slabs are tagged `cutawayRoof` and hide with the slabs.
- **Draw cost.** New props bake their colour into vertex colours (`fpsVillageTint.ts`), so they share batches.
- **Smoke.** `liveSmokeSettle` rests clouds under about 3 m radius on their floor. Bots and the renderer read the same lobes. Full-size smokes are unchanged.
- **Preserved.** No collision, navigation or gameplay data changed. `fpsLiveMap.ts`, `fpsLiveTerrain.ts` and `fpsLiveSimulation.ts` were not edited. In `fpsLiveBrain.ts`, only the smoke lobes and the centre of the other agent's bounding-sphere reject changed.

## Game feel: cards, tactics board, signing cards, X-style Wire, streaming Hexacast, logo and portraits (2026-11-19)

Read [the record](docs/ui-game-feel-20261119.md) before changing Squad, Transfers, The Wire, Hexacast, Supporter studio, Hexapedia articles, the logo or portraits.

- **Kit** (`src/components/game/`): `PlayerCard`, `HexRadar`, `PipMeter`, `TacticsBoard` and `positions.ts`. Use them for any player-facing screen. Rarity tiers on the 1–10 scale: Prospect, Pro, Star, Elite, Legend.
- **Fit scores.** `positionFit` mirrors the server's `recommendedAssignments` weights. Keep the two in sync, and keep fit labelled as strength only.
- **Screens.**
  - Squad: team overview, five draggable flip cards, bench upgrade ribbons, a save bar shown only when the lineup changes.
  - Tactics: a click or drag board where a taken position swaps the two players, gameplan tiles, and orders as rows.
  - Transfers: impact verdicts against your own five, deltas, a radar overlay, countdowns and quick bids, with confetti on a successful bid.
  - The Wire: X-style posts and threaded replies. The avatar and action bar bugs are fixed.
  - Hexacast: channel rail, a stage drawn from club colours, thumbnails and an HLTV-style schedule.
  - Supporter studio: membership card, tier cards, theme mock-ups, portrait studio.
  - Hexapedia: navbox, team card, player card, latest transfers.
- **Art.**
  - New `HexatrickMark` and favicon.
  - `WorldPlayerPortrait` is redrawn with the same props and override semantics. The hairstyle order is fixed by Supporter studio.
- **Checks.**
  - 605/605 tests; `vite build` passes.
  - `tsc -b` errors are only in `src/fps/fpsLiveSimulation.ts`. Six `src/fps/` files were being edited elsewhere during this pass and were not touched by it.
- **Open.**
  - Live and recorded broadcasts were verified with a mock only.
  - No touch drag and drop; tap to select instead.
  - Light themes were not rendered.
  - The HUD, Crown 2026, Competitions internals and Finances have no game-kit redesign.

## Visual polish: restrained accent, finished controls, remaining screens (2026-11-19)

Read [the record](docs/ui-visual-polish-20261119.md) before restyling anything.

- **Rule.** The accent marks actions, the current place and live state. Panel headers, tabs and filter toggles stay neutral in every theme (`index.css`, `personal-theme.css`). Hexapedia headers keep a faint tint.
- **Primitives.**
  - Radius tokens are 5 / 8 / 12 px.
  - New tokens: `--hx-accent-soft`, `--hx-focus-ring` and `--cm-surface-raised`.
  - Focus rings on buttons.
  - Styled range inputs: `--range-fill` sets the filled part.
  - Body row headers (`tbody th`) are no longer uppercase.
  - New `ui/Switch.tsx` for on/off settings.
  - Table wrappers are positioning contexts.
- **Screens.**
  - Coach and tactical system is rebuilt as per-player cards (same requests and anchors).
  - Settings and Practice moved out of `App.tsx` into `SettingsPage.tsx` and `PracticeLauncher.tsx`. Practice names who plays.
  - Staff uses `FilterBar` and secondary sign buttons.
  - Home's first-week checklist marks only the next step as primary.
  - Owner operations is collapsed.
  - Duplicate titles are removed on Finances, Supporter studio and Competitions.
  - Top bar regrouped: shortcuts, then the account.
- **Checks.**
  - The real signed-in app was rendered against a fresh scratch backend (seeded world, stub worker) in headless Chrome at 1440 px and 390 px.
  - 19 routes have no horizontal overflow at 390 px. A Squad overflow is fixed.
  - `npm run check:game` 599/599; `npm run build` passes.
- **Open.**
  - Completed and live matches were not rendered (no worker).
  - Light custom themes were not rendered.
  - Transfers, Hexacast, The Wire, Crown and the HUD changed only through tokens.
  - `Inter` is not loaded.
  - `ui-harness/` is still to be deleted.

## Workspace information architecture: grouped by what the manager is doing (2026-11-18)

Read [the record](docs/ui-information-architecture-20261118.md) before changing navigation, Home, Matches or Squad.

- **Navigation.** `components/ui/navigation.ts` (`WORKSPACE_NAV`, `activeNavKey`, `areaHeading`, `navTrail`) drives the sidebar, its active state, the breadcrumb and page headers.
  - Groups: Your club (Home, Squad, Matches, Transfers, Finances), Compete, Watch & follow, Practice, Research, Account.
  - Matches holds only the club's games: Fixtures, Scrimmages and Results (the old Match history). Routes are unchanged.
  - Below 1024 px the sidebar collapses behind a menu button.
- **Fixtures** (`components/matches/FixtureBoard.tsx`): a Next match card, then Live now, Set your orders, Locked in, Needs review and Recent results.
  - Rows name the opponent with a Home/Away tag and a plain-language state line.
  - Editing fixture orders shows a context banner.
  - Scrimmages put received invitations first, then Quick match beside Invite a club.
- **Squad** (`SquadRoster.tsx`): a readiness check (`lineupReadiness`, shared with Home), the slot picker, then the roster grouped into Starting five and Reserves, with per-player Details (personality, positions, attribute bars).
- **Home** (`ClubHome.tsx`, `components/home/HomeSections.tsx`), in priority order: Needs your attention (derived items), Next match, Club at a glance, Manager's desk, Starting five with Recent results, Around the circuit. The decorative banner and the portal grid that repeated the sidebar are removed.
- **Checks.** `npm run check:game` 592/592; `npm run build` passes. Verified in a headless-Chrome harness at 1440 px and 390 px.
- **Open.**
  - The signed-in app with a live backend was not rendered.
  - Competitions, cups, Transfers, Finances, Staff, Supporter and Settings kept their internal layouts.
  - `EsportsClash.Web/ui-harness/` must be deleted by hand.

## Shared UI layer: icon registry, search, navigation, states (2026-11-18)

Read [the record](docs/ui-shared-layer-20261118.md) before adding or restyling a screen.

- **Components** live in `src/components/ui/`: `SearchField`, `FilterBar`/`SelectField`, `SectionNav`, `PageHeader`, `EmptyState`/`ErrorState`/`ListSkeleton`, `AppIcon`, and `ui.css`. Use them; do not add bare search inputs or ad hoc loading text.
- **Icons** come from `ui/icons.ts` (`ICONS`, `NAV_SETS`). Each navigation set has a distinct icon per destination, enforced by `src/uiIcons.test.mjs`. `LabelIcon` resolves registered names exactly and returns no icon for unmatched free text (it no longer falls back to a generic one).
- **Applied to:** the app shell, Match centre tabs, squad sub-tabs, Hexapedia (three groups: Start here, Game reference, World records), the squad roster (compact identity marks), and every text search.
- **Open:** signed-in screens were verified only by typecheck and a headless-Chrome harness; other modules were not redesigned; legacy search/filter CSS is partly unused and not removed.

## Broadcast schedule: tournament streams, on-air holds, kickoff cap (2026-11-18)

Read [the record](docs/fps-broadcast-schedule-20261118.md) before changing fixture scheduling, `OnlineMatch` broadcast timing or `PollOnlineMatch`.

- **Streams.** Tournament games air one at a time per `club_fixtures.broadcast_stream`, at least `broadcast_slot_minutes` (90) apart. A round has `ceil(games / games_per_stream)` streams (8 games per stream), or the `broadcast_streams` regulation.
- **On-air hold.** A live 3D game whose earlier game on the same stream is still unsettled is held, and goes on air at that game's end plus `broadcast_break_minutes` (15). The time is stored in `online_matches.on_air_at` and decided only after the earlier game ends, so no spoiler. Held games show as `delayed`. Holds are capped at `broadcast_max_hold_minutes` (180).
- **Kickoff cap.** `kickoffs_per_hour` (300) limits fixtures per UTC clock hour. Tournaments and the scrimmage queue move to the next hour with room; friendlies and `fixtures:schedule` refuse.
- **Orders deadline.** Live fixtures lock orders 105 minutes before kickoff (`ClubFixture::ordersCloseAt`: 15 plus the 90-minute precompute; 15 on version 4), so simulation gets the full window. The scrimmage queue keeps its 15-minute lock. The club's saved default lineup plays unless a fixture has its own orders, and `DELETE /online/fixtures/{id}/orders` reverts to it.
- **Checks.** `BroadcastScheduleTest` 8/8 plus the focused suites in the record; `npm run build` passes. Migration `2026_11_18_000001` has not been run in production.

## Official matches on the live 3D engine, simulated ahead and watched as replays (2026-11-18)

Read [the record](docs/fps-official-live-engine-20261118.md) before changing match allocation, the worker, replays or official viewing.

- **Version 5.** New official allocations pin `simulation_version: 5` on a live map (`OnlineService::FPS_LIVE_MAPS`). `FPS_SIMULATION_VERSION=4` reverts to the recorded engine. Version-4 allocations and replays stay supported. `phpunit.xml` pins version 4 for the existing suites; version 5 is covered by `FpsLiveEngineTest`.
- **Engine.** `simulateOfficialLiveMatch` (`fpsOfficialLiveMatch.ts`) is deterministic and headless, with frozen learners, and returns the recorded engine's report contract plus:
  - `engine: 'live-3d'`
  - `behaviorSummary` (aggregated observed decisions; keep it aggregated, as per-observation events made 10 MB reports)
  - `roundSnapshots` (positions only)
  - `broadcastSeconds`

  Team-kills and bomb deaths are `player_eliminated`, not kills. No private identity state in reports or replays.
- **Replays.** `fpsLiveReplay.ts`: 10 frames per second, public keyframes plus deltas, 10-second gzipped chunks, a provisional header after every chunk. Tendencies appear only as 1–10 levels. `FpsLiveReplaySource` drives `FpsLiveBroadcast` through its `replay` prop. Exhibitions still simulate in the browser.
- **Timing.**
  - Simulation starts `FPS_PRECOMPUTE_MINUTES` (90) before kickoff.
  - The match becomes `running` at kickoff and settles only at `kickoff + broadcastSeconds`.
  - `/online/matches/{id}/live-replay[/{chunk}]` serves only whole chunks that have aired, and hides the match length until it ends.
- **Workers.**
  - `ONLINE_MAX_MATCHES` matches at a time per worker, with a local queue (`202 queued`).
  - Each match process has a heap cap (`ONLINE_MATCH_HEAP_MB`) and loads the prebuilt engine bundle (`scripts/build-worker-engine.mjs`).
  - `ONLINE_WORKER_URLS` routes matches by id across machines.
  - `/health` reports capacity, and each match logs its CPU seconds and peak memory.
- **Retention** (record section "Replay retention"). `replay_retention.py`, swept by `server.py` at startup and every `ONLINE_REPLAY_SWEEP_MINUTES` (60), removes only `replay/` of finished version-5 matches whose broadcast ended more than `ONLINE_REPLAY_RETENTION_DAYS` (30; `0` keeps forever) ago, leaving `state.json`/`allocation.json` and a `replay-expired.json` marker. Age counts from the end of airing (`state.completed_at` or the final header, and kickoff + `broadcastSeconds`), never from a provisional header. Running, queued, unfinished, on-air and version-4 matches are never touched. Low-disk guard `ONLINE_REPLAY_MIN_FREE_GB` (2; `0` off) removes the oldest aired replays first, never within an hour of airing. `/health` reports `replays`. Laravel answers `410` (`replay_expired`, or `replay_missing` for a settled match the worker lacks); the frontend shows "Replay no longer available" with the result and report kept.
- **Checks.**
  - `npm run check:game`: 569/569; `npm run build` passes.
  - Backend focused suites: 108/108.
  - Results are deterministic across processes and between the bundle and the sources.
  - Load test (`scripts/load-test-match-worker.mjs`): about 212 CPU-seconds per match under full load; about 40 hardware threads for 1,000 kickoffs simulated in 90 minutes; about 5.4 MB of replay per match.
- **Open.**
  - Replay storage: the owner chose the worker's disk for now; object storage plus a CDN is not built.
  - Production cores are the owner's decision.
  - The Docker image was not built; nothing was deployed or migrated.
  - No end-to-end fixture run through Laravel's queue.
  - The official broadcast view was not reviewed in a browser.

## Round responsibilities: dynamic jobs on top of fixed roster positions (2026-11-17)

Read [the record](docs/fps-round-responsibilities-20261117.md) before any role, IGL or decision-making work.

- **Positions vs jobs.** Manager-assigned positions and `role` (the IGL authority and the buy bridge) stay fixed for the match. Round jobs (`entry`, `trade`, `support`, `lurker`, `anchor`, `sniper`) come from `assignFpsRoundDuties` (`fpsRoundResponsibilities.ts`) for the whole team at once. Live code reads `duty(p)`, never `p.role`, for round jobs.
- **Inputs.** The roster prior, the player's own tendencies (floor 0.35), the caller's leadership tendencies, lawful team state (HP, weapon, grenades, bomb, distance) and continuity. Attributes are read only through the caller's strength exploitation, and never gate a job. The allocator is deterministic and uses no random stream.
- **Handovers.** Jobs re-elect about once a second and at once after a death. A changed job is a communicated handover with a delay. A single-holder job releases the old holder in the same call. Freeze time is always elected as an opening. The carrier is never the entry while a healthy rifler is available.
- **Interaction, by positioning and timing only.** A paired trader for the entry; the entry briefly holds for the trade; the best-placed teammate with a flash supports the entry, whatever that player's job; an escort for an isolated carrier; an anchor fallback when outnumbered (never during a visible duel); anchor depth from tendencies.
- **Other surfaces.** The recorded 2D engine uses the same allocator. Snapshot `duty`/`dutyReason` feed the broadcast focus card. `diagnostics.staticRoles` is a headless ablation. Diagnostics: `scripts/diagnose-role-duties.mjs`.
- **Continuation and forks** (record sections 11–12):
  - Trades: the paired trader has first claim, a second responder commits, and trade swings onto the lawfully called position happen only after the call lands. The follow point is chosen for a line onto the entry's view.
  - CT setups come from positions (`ctSlot`), not roster order. CT_ROTATOR rotates first.
  - One lost anchor gets a measured response; orders carry `firm`.
  - Rotator hesitation and lane contact (`rotationHesitation`, `laneContact`).
  - Duty-aware action scoring (`dutyActionBias`).
  - Fixes: a vault no longer wedges a player in the Mid window frame, and a player killed mid-vault is settled on the landing. Re-issued rotations keep their call time and acknowledge the order.
- **Whole-system review.**
  - The top-bar Sound button was removed (Settings keeps master sound and music).
  - Scouting and World Desk entry points on Club home and in the sidebar; a guide chapter on roles and round jobs.
  - Bulk-primed Hexapedia directories and tournaments, memoised identity readiness, cached search, a guarded index migration (`2026_11_17_000003`, not run in production), and no polling from hidden tabs.
- **Checks.**
  - `npm run check:game`: 564/564; `npm run build` passes.
  - Backend focused suites: 80/80.
  - Pooled T win rate 0.65 dynamic against 0.63 static (noise).
  - Deaths traded within 3 s: 9.3% against 8.1% on Fontessa, 7.6% against 6.2% on Spillway.
  - Benchmark p99 is 9–14 ms.
- **Open issues.**
  - Trades are now limited by duels (reaction wait, then killer re-positioning).
  - Hesitation rarely fires, because almost all CT calls are firm. It needs ambiguous T play.
  - Unindexed player text search, per-club record table, timers while the WebSocket is connected, and 1–10-only API values (all recommended in the record).
  - Signed-in screens not rendered; the full backend suite was not run.
  - No production migration or deployment; GPU not measured.

## Duels, calculated smokes, handoffs, post-round fights, rotations, Mid door/bridge, director, utility purposes (2026-11-17)

Read [the record](docs/fps-live-corrections-20261117.md) and [the adopted utility-purpose reference](docs/fps-utility-purposes-20261117.md).

- **Duels.** Players take a duel they can see before thinking about cover. Do not restore cover moves without a trade, or the 0.3 s peek-back.
- **Smokes.** Smokes come from `fpsSmokePlanner.ts` each round (`roundSmokes`). Do not read `authoredSmokeLineups` in live decisions; it is a test fixture only.
- **Handoffs.** Items pass by physical handoff (`beginHandoff`/`stepHandoff`); drop flights use real `at`/`airUntil`.
- **Snipers** need a short scoped dwell (`scopedAt`).
- **After the round**, players fight until the next round (learners are not fed it).
- **CT** rotate on a lawful fallen-site call.
- **Mid building** has a normal door and window, and the gap beside the bridge's right stair is closed.
- **Director** adds clutch focus, a wall-view penalty, the bomb finale and a minimum shot length.
- **Utility purpose.** Every throw carries an objective, a primary purpose and secondary purposes, and an outcome is judged afterwards. It is decision-side only.
- **Forks.** Forks made planning commitments (no route re-rolls) and the rounded operative model with inventory-driven grenade pouches.
- **Checks.** `npm run check:game`: 521/521.
- **Open issues**:
  - Isolated 50–70 ms `decide()` spikes; cause not found.
  - Flashes rarely achieve their purpose.
  - GPU and live-browser review not done.

## Evolving meta: lineages, playbooks, auto-promotion, real matches; lag and post-plant fixes (2026-11-17, later)

Read [the record](docs/fps-evolving-meta-20261117.md). Learned state is never deleted: append-only Laravel lineage store (`fps_team_lineages`/`fps_model_versions`/`fps_lineage_events`, trigger-enforced), append-only `models/registry.json` (overrides `active.json`), worker `model_versions` + quarantine, utility-brain consolidation tiers (archive/aggregates) instead of eviction, IndexedDB browser cache with quarantine and experiment slots. `engineHash` is provenance only; incompatible learners are archived then forked. Two worker lineages co-evolve (`worker:main`/`worker:rival`). Archetypes/setups are data-driven seed plays (`fpsLivePlays.ts`, parity trace `scripts/trace-live-fps.mjs` identical); team playbooks (`fpsLivePlaybook.ts`) do Thompson choice, bounded innovation, per-opponent counters and lawful opponent models (decision-only). Coordinator auto-promotes after screening, four ablations and a league, monitors and auto-rolls back; owner controls are `registry.mjs pause|resume|rollback`. Club real-match experience: `POST /fps/lineages/club:{id}/experience` (own club, lawful fields only). Worker jobs resolve on child `close` (not `exit`). Route planning uses one-origin `findPathsFrom`; planters leave the device after planting. The T-side bias (63-67% at the last commit; manual aim adds ~6-7 points) is unexplained. No browser review this pass; GPU unmeasured.

## Aim paths, all-grenade utility brain, server utility learning, 1-10 scouting scale (2026-11-17)

Read [the record](docs/fps-aim-utility-server-scale10-20261117.md). Every shot comes from the manual crosshair (no snapped views); AWP/Scout flick without spray; spray index survives target changes. All grenades are calculated and learned by `fpsUtilityBrain.ts` (no solver in live throws). Utility brain travels in learning reports/bundles (optional, bounded). Scouting shows only whole 1-10 levels with labels (`fpsScale10.ts` mirrored in PHP); never raw 0-100 or DNA. Consistency is a hidden noise-only trait. Fontessa HUD/props/operatives were reviewed in headless Chrome screenshots (1920/1280/390px) and fixed; Spillway was reviewed the same way. T wins 77-82% in small headless samples (earlier Spillway record ~55%); cause unfound, likely from this pass's aim/utility changes. GPU frame rates unmeasured.

## Fontessa manual aim, CS-style recoil, signs, outskirts and HUD (2026-11-16)

Read [the Fontessa gunplay/signs/HUD record](docs/fps-fontessa-gunplay-signs-hud-20261116.md). Bots aim by hand (`fpsLiveGunplay.ts` submovement crosshair, attribute-driven); do not restore continuous head-locking or per-tick automatic recoil compensation. Preserve fixed spray patterns with learned pull-down, Deagle punch/spam penalty, double-sided correctly oriented sign lettering, facade detail on the outer houses' visible faces, wall-anchored festoons and the one-line observer card rows. Visuals are unreviewed in a browser.

## Lag spikes, smoke fixes and the learned utility brain (2026-11-16)

Read [the utility brain record](docs/fps-utility-brain-and-lag-20261116.md). Smokes are calculated by the bots (distance → throw type, static blockers → arc) and learned from real landings in `fpsUtilityBrain.ts`; do not restore pre-solved lineup throws, per-tick arc searches or the perfect-forecast release veto for smokes. Preserve per-assignment spot memory, best-aim learning, the committed seed brain (`fps-utility-brain.json`, trainer `scripts/train-utility-brain.mjs`), lab learning on by default and the per-tick defuser election cache. CPU spikes are reduced; GPU frame rates are unverified.

## Architecture v4 tendencies audit & Phase 5–6 (2026-11-16)

Read [the tendencies audit record](docs/fps-tendencies-v4-audit-20261116.md). Preserve exact TS↔PHP scouting derivation parity (`fps-tendency-vectors.json`, asserted in both suites), null-until-threshold observed team categories (5 appearances / 15 opportunities; never back-fill), bounded pressure expression in `effectiveTendency`, 2D override + contextual call acceptance parity, one-time IGL death takeover with combat-lock secondary calling via `activeCaller()`, team-union lawful opponent habit recording, and lab-only experimental tendency overrides. Tendencies remain decision-only (no accuracy/spread/damage/reaction effects).

## Spillway battlefield, lawful death-callout trading, cam-switch lag & Hexapedia/FE sync (2026-11-16)

Read [the Spillway & FE sync record](docs/fps-spillway-20261116.md). Preserve `fontessa` as default (`getLiveMapRuntime()`), Spillway's 3-level Overpass-inspired layout (`fpsSpillwayMap.ts`/`Scenery`/`Terrain`), `3.82m` Control Deck rails with 2-1-2 B rotation, lawful observed-only death cover callouts (`describeNearbyDeathCover`, no unseen killer leaks), `radioAt` PTT release timing, `fpWeaponViews` LRU cache (`48`) + incremental prewarming, PiP 3D sightline checks, Hexapedia `liveSimulation` / live map / live weapon entries, and Manager FE live 3D practice launch with `createFpsIdentityContext` validation (keep manual unique role assignment intact). Structural/CPU/NullEngine checks do not verify browser GPU FPS.

## Decision-making, buying and utility polish (2026-11-14)

Read [the decision-making pass](docs/fps-decision-making-polish-20261114.md). Preserve own-lane buy context, armor/objective-kit reserves, paid upgrade/restock/gift accounting, individual holstered weapon cooldowns, legal-information/time-aware IGL redirects, and urgent objective priority. Smoke fire uses bounded evidence-based bursts and checks the continuing ray for allies; it cannot track hidden bodies or learn invented target IDs. Lineups require useful travel/setup time and retain a stable feasible threat-aware execute order. Skipped/covered setups are separate from actual releases; finished plans cannot keep pooling spare smokes. Grenade forecasts use indexed candidates with exact original collision/order/bounce checks. Keep real paid grenade physics, release-only trails, manager-selected roles and prior navigation/runtime/animation work. Structural/CPU checks do not qualify GPU FPS or competitive intelligence.

## AUTO WIDE broadcast pacing (2026-11-14)

Read [the AUTO WIDE correction](docs/fps-auto-wide-camera-20261114.md). Automatic overviews have a fixed 1.25-second deadline, then player coverage; continuing fights cannot renew it. Require cooldown and a new split-fight episode, and prioritize kills/clutches/objective channels. Utility-only or isolated allied activity is not a separate engagement. Manual WIDE remains available. Preserve gameplay and prior runtime/animation work.

## Runtime cost and smooth display animation (2026-11-14)

Read [the runtime/animation pass](docs/fps-runtime-cost-and-animation-smoothing-20261114.md). Preserve exact collision after indexed candidate lookup, fixed-step backlog under display work budgets, bounded weapon/trail resource reuse, buy-phase static route warm-up, interpolated display clocks and smooth body pose transitions without added crosshair sway. Existing material batches are extended across structural geometry; the recorded spatial batching trial increased submitted groups and was rejected. CPU spikes remain and GPU FPS is unverified; do not claim universal lag elimination from structural tests.

## Doorway traffic and window furnishings (2026-11-14)

Read [the routing/interior correction](docs/fps-doorway-routing-and-window-interior-20261114.md). Fontessa v12 preserves capsule-clear corner consumption, bounded stale-route repair and teammate yielding for crossing traffic; do not restore symmetric deadlocks or label blocked movement as running. Substantial window-room furnishings come from `fpsMidWindowInterior.ts` and share map, rendering and projectile geometry. Preserve all three walkable window entrances and the firing line. Snapshot v19 remains unchanged; no GPU or competitive qualification is implied.

## Adaptive routes and released-only utility trails (2026-11-14)

Read [the current route/trail correction](docs/fps-adaptive-routes-and-released-utility-20261114.md). Preserve the fine B market-house/produce-stall passage, distance-based navigation costs, individual execute/retake choices from legal information and manager responsibilities, and stable seeded variation. Do not restore fixed human/actor lane completion, player-slot retake staging/cover, or trajectory previews during equip/pin/ready. Utility trails begin only after release and stop at elapsed flight. Team coordination and physical authored smoke knowledge remain; this does not establish competitive or GPU qualification.

## Current tactical player architecture v4 (2026-11-14)

Players start without a designated team role. Human managers explicitly choose and save T/CT responsibilities using player strengths; suggestions remain editable drafts until saved. Do not restore automatic human lineup-role completion. Require complete unique assignments when entering matchmaking or allocating a match; keep generation, scouting strengths and match-specific exhibition presets separate. Read [the manager-role clarification](docs/fps-manager-chosen-roles-20261114.md).

Owner explicitly replaced the prior attribute, personality and specialty systems while preserving the FPS mechanics. Read [the v4 implementation and verification record](docs/fps-player-architecture-v4-20261114.md). Active players use exactly Rifling, Sniping, Entry, Utility, Positioning and Shotcalling; four personality dimensions support 54 combinations and 540 descriptive identities. Five unique T and CT positions are frozen per match. Retired specialties, the 25-rating lab and old trait/threshold classifications must not be restored. Internal execution channels are derived from the six attributes, not additional ratings. Preserve observed/natural identity separation, lawful information, private DNA, career guards, aliases and Colab boundaries. Historical documents below remain evidence and are superseded on the active player schema.

## Pro-Tactics AI Overhaul, 4-Slot Loadouts, Live Grenade Trails, Elevation Drops & CT/T Kit Detail (2026-11-14)

Owner requested fixing wall-scoping snipers, fixing ahead-of-flight grenade trajectory lines and fast equip timing, finer CT/T model details, window/ledge drop jumps & more direct pathing, full 4-slot loadout with mid-fight handgun swaps, and pro-reference regression testing (`Vitality`, `MOUZ`, `Spirit`, `NAVI`, `Astralis`):
- **Sniper Anti-Wall Scope & Smoke Pivot (`fpsLiveSimulation.ts`)**: `forwardClearance` prevents scoping within close walls (`< 5.5m` idle / `< 1.8m` duel) or smoked sightlines, forces immediate `'lowering'` if blocked while scoped, fixes wall-staring `preAim` fallbacks, and pivots blocked CT/post-plant AWPers off smoked sightlines to open crossfires.
- **Grenade Timing & Incremental Flight Trails (`fpsLiveWeapons.ts`, `fpsLiveSimulation.ts`, `fpsLiveViewer.ts`, `FpsLiveBroadcast.tsx`)**: Slowed grenade `liveDrawTime` (`0.68s`) and pin pull (`0.48..0.78s`), omitted `'equip'` aim previews, clamped pre-throw aim cues, grew `computeLiveGrenadeTrajectoryPoints` trails up to `renderTime` without spoiling landing destinations early, and revealed impact rings only in the final `0.22s`.
- **Detailed CT/T Kit (`fpsLiveViewer.ts`)**: Added CT NVGs/IR strobe/placard/PTT/defuse cutters, T beard/shades temples/keffiyeh drape/bandolier/wrist wraps, and shared holster pistol/chest knife/canisters/PRC radio/dump pouch/tourniquet/cargo pockets/gloves/boot tongues in `finishOperativeKit`.
- **Elevation Vault Drops & Direct Pathing (`fpsLiveMap.ts`, `fpsLiveSimulation.ts`)**: Exported `LIVE_ELEVATION_DROPS` (`mid-window-drop`, `b-apartments-west-drop`, `b-apartments-north-drop`, `market-terrace-drop`, `bridge-canal-drop`), executed crouch-jump `vaultDrop` in `move()`, lowered `nextJump` cooldowns, and tuned `findLivePath` caution multiplier (`*3`).
- **4-Slot Loadout & Handgun Swaps (`fpsLiveSimulation.ts`)**: Exported `primaryWeapon`/`secondaryWeapon`/`secondaryAmmo`/`secondaryReserve`/`meleeWeapon` on `LivePlayer`, preserved `sidearmLoadout`, and swapped to pistol whenever any non-pistol primary hits `ammo === 0` mid-fight.
- **Pro Regression Tests (`fpsProTacticsRegression.test.mjs`, `package.json`, `fpsLiveTactics.test.mjs`)**: Added NAVI/Spirit early CT smoke conservation and MOUZ smoke-fade readiness plus dedicated `"test:pro-regression"` script. Preserve parody aliases, private DNA, careers, and Colab gates.

## Comprehensive Testing Verification and AI Brain Mechanics Polish (2026-11-11)

Owner requested thorough testing and polishing the AI brain mechanics:
- **Test Suite Pass (100%)**: All 750/750 tests in `src/*.test.mjs`, all 113/113 FPS tactical/profile tests, 3/3 batch match simulations, and `npm run check:game` passed with 0 failures and 0 errors.
- **Economy Options Alignment**: Fixed `buyLiveTeam` weapon fallback ordering so force buys prioritize `smg` when rifles are unaffordable, resolving test assertions while preserving CT/T team-exclusive gun choices.
- **Positioning Crossfire Quality**: Fixed `findLiveCover` quality scaling so low positioning ($q = 0$) minimizes distance without multi-angle awareness while high positioning ($q = 1$) actively eliminates exposure to secondary crossfire angles.
- **Rifle Long-Distance Burst Tapping vs Spraydown**: At $d > 20\text{m}$, rifles (`ak47`, `m4a1_s`, `rifle`) burst 2 rounds with 0.22s recoil settling delay; at $d \le 20\text{m}$, actors commit to aggressive 4-5 bullet spraydowns.
- **Desert Eagle Cadence Pacing**: At $d > 12\text{m}$, Deagle shots are paced (+0.32s recovery) for surgical double-taps rather than wild spam.
- **Flank Hearing Reflex**: When holding or settling, hearing running footsteps or gunfire directly behind ($\cos(\text{heading} - \text{yaw}) < -0.35$) triggers an immediate head turn to clear the rear flank (`action = 'Checking flank'`).
- **Sniper Close-Range Sidearm Fallback**: Snipers rushed at point-blank range ($d < 4.5\text{m}$) or with an empty magazine immediately draw their sidearm (`usp_s` / `glock`) to defend themselves.
- **Clutch 1vX Silent Stepping**: In 1v1 / 1v2 clutches ($\le 1$ living ally, $\le 2$ living enemies), players prioritize walking quietly to deny sound cues.
- Build verified clean (`tsc -b && vite build` in 3.58s). Preserve parody aliases, private DNA, careers, and Colab gates.

## Map Geometry Polish, Expanded Weapons Arsenal, and Tactical AI Decision-Making (2026-11-11)

Owner requested map scenery fixes (grounded archway pillars, tiered classical Mediterranean B fountain, market produce crates and curbs), eliminating post-freeze CT corridor traffic jams via lane-biased fanned spawns and staggered departures, bomb defuse sound tick alerts triggering T retake peeks, human-like AI decisions (fake defuses, trigger discipline against unaware backs, low-HP disengagements), grenade equip-before-throw animation flow, object boost spots for elevated off-angles, and team-exclusive weapons (USP-S, Glock, Deagle, M4A1-S, AK-47, MAG-7, Nova, MP9, MAC-10, Negev, Scout), with tests skipped per owner request. Read [the documentation and verification record](docs/fps-map-details-weapons-and-tactical-ai-20261111.md). Build verified clean (`tsc -b && vite build` in 7.17s). Preserve parody aliases, private DNA, careers, and Colab gates.

## Role-Specific AI Brain Polish and Verification (2026-11-11)

Owner requested thorough testing across the simulation engine and polishing the actor AI brain so each operative plays out their role beautifully:
- **Trade Fragger Re-Frag Reflex (`trade`)**: Immediate snap to killer upon an entry partner's elimination with reaction latency fulfilled ($<0.12\text{s}$ response), aggressive trade push, and radio call `[RADIO] {name}: Trading for {victim.name}!`.
- **Sniper Shoot-and-Scoot Bolt Cycling (`sniper`)**: After firing an AWP shot, snipers immediately duck behind cover for 1.25s to cycle the bolt safely, counter-strafe, and call `[RADIO] {name}: Shot fired — cycling bolt behind cover!`.
- **Support Utility Layering (`support`)**: Proactive high pop-flashes thrown forward over entry chokes for advancing Entry teammates, ninja smoke plants, and complementary crossfire hold points.
- **Entry Fragger Angle Clearing (`entry`)**: Sequential clearance of close danger angles (Car, Sandbags, Pit, Balcony, Graveyard) and aggressive wide swings when enemies are flashed.
- **Lurker Rotator Flank (`lurker`)**: Silent stealth movement across Underpass and Second Mid, stepping out to intercept rotating CTs from behind upon sound/radar reports.
- **Anchor Deep Holds & Retake Coordination (`anchor`)**: Deep site holds (Pit on A, Fountain on B) with choke delay smokes; synchronized CT retakes regrouping at staging lines before flashing and breaching together.
- **Broadcast Spectator Radio Chatter**: Exposed active radio communication in the spectator focus card with `.blast-focus-card__radio` tactical badge.
- Read [the documentation and verification record](docs/fps-role-ai-brain-polish-20261111.md). All 100/100 FPS tests, 746 arena tests, and production build passed cleanly. Preserve parody aliases, private DNA, careers, and Colab gates.

## Expanded AI Brain, Item Knowledge, Mechanical Micro-Movements, and Adaptive Defense (2026-11-11)

Owner requested expanding the AI brain with Counter-Strike item knowledge (how smokes and flashbangs work in gameplay), infinite play possibilities via dynamic round archetypes, in-game team communication / radio chatter, mechanical micro-movements (jumping physics, corner jump-peeking, strafing and counter-strafing), active history-based CT counter-adaptation, cutting off out-of-bounds play, and skipping tests. Read [the documentation and verification record](docs/fps-expanded-ai-brain-and-mechanics-20261111.md). Smokes block raycasts for 18s; attackers throw execute smokes on rotation lines; carriers ninja plant inside smoke; defenders stall rushes with choke delay smokes; defusers ninja defuse in smoke. 7 dynamic attacker round archetypes (`rush_b`, `rush_a`, `default_pick`, `split_b`, `split_a`, `fake_execute`, `mid_control`) eliminate repetitive rounds, paired with mid-round adaptive redirects and in-game radio chatter. Mechanical jumping physics ($v_y = 4.2\text{ m/s}$, gravity $-12.5\text{ m/s}^2$) allow jump-peeking corners with $2.5\times$ spread bloom, rendered with operative elevation and leg tuck. Lateral $A/D$ strafing and counter-strafing enable crisp gunfights. CT defenders counter recurring T habits from round history (`stack_b`, `stack_a`, `aggressive_banana`, `mid_push`, synchronized retakes). Map boundaries strictly clamped to $[-34.0, 34.0] \times [-43.0, 43.0]$ across movement, pathing, and cameras. Production build passed clean (`tsc -b && vite build` in 19.81s); tests skipped per owner request. Preserve parody aliases, private DNA, careers, and Colab gates.

## BLAST Premier broadcast HUD and proactive information play (2026-11-11)

Owner requested a modern Tier-1 esports broadcast HUD (BLAST Premier / ESL Pro League style), solving bot freezing/wall-staring, strict eye-level 3D vision, grenade throw animations, and dynamic teammate spacing. Read [the documentation and verification record](docs/fps-blast-hud-and-proactive-play-20261111.md). The broadcast HUD now features a top-center scoreboard with dynamic AI Win Prediction, top-left tournament badge, top-right clean killfeed with headshot indicators, and a horizontal 10-player bottom dock with tactical SVG avatars, live HP gauges, weapon silhouettes, utility/kit/bomb badges, and a center spectator focus box. Vision enforces 3D vertical sightlines with stance-dependent eye heights (1.60m stand / 1.08m crouch) and an authentic 94-degree focus cone. Bots no longer stare into walls when holding; attackers proactively advance onto site after holding quiet zones; and teammates maintain staggered 3.5-5.0m trade spacing. All game checks, builds, and 23 tactical tests pass cleanly. Preserve parody aliases, official/historical paths, private DNA, careers, and Colab gates.

## Revised 25-ability local FPS rollout (2026-11-11)

Owner requested implementing the revised 25-attribute source. Read [the implementation, exact source/hash and active/reserved matrix](docs/fps-attributes-25-20261111.md). Local v6 uses separate pinned skill profiles and 24 bounded active consumers; Economy Judgment stays inert while team policy owns buys. No Weapon Handling rating. Preserve 1–10 lab editing, stable provenance, personal-knowledge stages, fixed mechanical limits, seven display-only summaries, private DNA and the explicit legacy adapter. Official player migration, scouting/training/career integration and activation remain gated; do not publish test profiles as real abilities. No desktop/browser automation was used at the owner's request. Preserve other movement/operative work and Colab boundaries.

## Live exhibition v5: playing from information (2026-11-10)

Owner requested more credible information-based FPS play. Read [the implementation and verification record](docs/fps-information-play-20261110.md). Local v5 adds bounded source/age/confidence/uncertainty memory, delayed deduplicated reports, anonymous sound/damage/utility clues, sampled negative evidence, evidence-based support/redirects and visible reasons. Preserve personal-vision acquisition, stable crosshair commitment, the opposite-site guard, no hidden-enemy reads in caller evidence, official/historical paths, private DNA, careers, and Colab gates. This does not qualify pro-level intelligence or production assets.


## Stable crosshair placement and pro-match reference (2026-11-10)

Owner requested removing left/right aim movement and supplied a detailed pro-match simulation reference. Read [the correction and adopted reference](docs/fps-crosshair-reference-20261110.md). Preserve stable world-space pre-aim, route look-ahead, brief aim commitment and eased corrections; do not restore idle yaw scans or lateral weapon sway. The reference is guidance, not a new rating/identity schema or verified external game rules. Preserve official/historical paths, privacy, careers, and Colab gates.


## Live exhibition v4: human handling and knives (2026-11-10)

Owner requested more human-like mechanics, map detail and knives, and reported the orange A-site wall allowing shots through. Read [the v4 record](docs/fps-live-human-mechanics-20261110.md). The local exhibition now uses vision-sampled aim, real knife/gun switching and melee impact, conserved pickups, stationary braking and shared A-loggia collision. Preserve official contextual v3, historical replays, private DNA, careers, and Colab gates. Required game checks/build and focused regressions pass; video footage review and comprehensive visual/competitive qualification remain incomplete.


## Live spatial exhibition v3 (2026-11-10)

Owner authorized movement/peeking, coordinated executes, shared economy and supplied three-lane map design guidance. Read [the current map/tactics record](docs/fps-three-lane-tactics-20261110.md). Local exhibition v3 adds actual acceleration/braking, hearing, peek/clear movement, ordered utility/entry protocols, ballistic grenades and shared paid buys, with a continuous Mid and measured rotation/setup timings. This is separate from official contextual identity v3. Preserve official/historical paths, private DNA, career idempotency, and Colab asset gates. Focused checks are recorded; full production/competitive qualification is not claimed.

## Professional FPS skill reference (2026-11-10)

Owner supplied the micro/macro/team/mental skill reference. Read [the adopted mapping and exact source](docs/fps-professional-skill-reference.md) for future FPS behavior work. The 205 behaviors are a checklist; the proposed 26 abilities are a future schema, not 26 existing independent ratings. Preserve contextual personality/role/specialty/DNA/system fit. Live impact accounting is event-derived and cannot grant gameplay bonuses. Supplied patch-specific CS2 claims are not verified rules for Hexatrick.

## Original live FPS exhibition (2026-11-10)

Latest continuation: local exhibition v2 adds editable varied attributes, skill-dependent tactical behavior, delayed/uncertain intel, cover/reload and objective coordination, a middle connector, industrial scenery, shadows and camera smoothing. Read the integration record's latest pass for exact limits. Focused TypeScript, seeded simulation and isolated browser startup passed; no full suite/build or production asset qualification is claimed. This supersedes the blanket no-checks status below for those focused checks only.

Owner requested an original real-time FPS broadcast in Hexatrick. An isolated live 3D exhibition is integrated into `#fps-simulation`; read [the integration record](docs/fps-real-time-3d.md) before changing it. It uses collision-volume proxies, not qualified character assets. Official v3 and historical matches remain unchanged; shared online streaming and production asset qualification are unfinished. Checks were skipped at the owner's request, so do not claim runtime acceptance or deployment verification. Preserve Colab-only owner-started asset processing and private DNA.

## Latest contextual FPS identity v3 (2026-11-10)

The owner approved completing and deploying the full contextual identity integration. New official allocations now pin simulation v3: seven role assignments, 24 conditional personalities, 21 situational specialties, persistent DNA, employed coach/gameplan/culture/chemistry and event-derived development. Historical v2 allocations remain supported. Preserve raw DNA privacy and idempotent progression. Read [the identity implementation/deployment record](docs/fps-identity-v3-20261110.md), latest handoff and mechanics before editing. This supersedes the v2-default statement below, and does not qualify balance, ML or 3D assets.

## Active FPS direction and MOBA cleanup (2026-11-12)

Per explicit owner instruction on 2026-11-12, all frontend MOBA simulation, viewer, art, audio, tests, and MOBA-only documentation have been permanently removed. Preserve the Laravel `/evolution/game-modes` endpoint, online worker Docker setups, frozen arena ML playbooks (`src/data/arena-v2..v6/`, `src/data/arenaPlaybook*.json`), and Colab-only 3D asset workflow. Current player views and live simulation use FPS role fits and tactical FPS simulation (`EsportsClash.Web/src/fps/`). Read [docs/agent-handoff.md](docs/agent-handoff.md) and the `docs/fps-*.md` records before editing.

## Latest compute/workflow direction (2026-10-24)

Use the existing 3D generation/preparation pipeline, not a parallel procedural avatar authoring system. Owner requires **Google Colab for generation, rigging and animation processing, never local compute or an automatic local fallback**. Local dashboard/control/storage and Babylon rendering/playback are separate. Follow [docs/babylon-visual-rebuild.md](docs/babylon-visual-rebuild.md). Google generation code support and isolated TokenRig trials do not prove deployed cloud rig/animation readiness; verify/connect those stages before dispatch. Keep visual admission owner-started and all base/rig/appearance gates below. Historical plans/artifacts remain immutable.

Latest deformation result (2026-10-27): native candidate `f6283980` reduces measured shoulders to 44/35 and hips to 51/47. Standard glTF corrective candidate `140fe64c` reduces those to 31/0 and 40/27, with zero seam opening in the controlled samples. Its exact clips passed GLB validation, Babylon morph playback and 104 sampled interpolation poses (`e0a78665`) with no sampled contact regressions. A separately baked half-strength shoulder alternative `51e2aadf` shows only a subtle visual change with higher shoulder contacts 34/17; direct Babylon review did not find a convincing shape improvement. Corrected-pose contact map `5271850d` binds 117 signed vertices with actual morphs active; targeted rest-side-normal shoulder prototype `8416eeb2` is rejected after worsening contacts 31 to 50. Prior failures are retained. Broad shoulder roots and hip creases remain; all candidates are unqualified/unpublished. Job `3e82afe8` lost its original runtime before result retrieval and remains unknown; replacement results have separate provenance. Read the [regression lock](docs/avatar-rework/mirelle-deformation-regression-lock-20261026.md); preserve baselines/measurement policy and do not rebase frozen displacement caps or resume blind transfer/strength tuning.

## Latest shape-preservation review and cloud status (2026-10-27)

Colab diagnostic candidate `2ca48df4` passed GLB validation and 16 controlled reimported bend checks, but Babylon review `440ba1fe` found no convincing shoulder improvement; hip creases remain. Preserve it as unqualified evidence only; the [regression lock](docs/avatar-rework/mirelle-deformation-regression-lock-20261026.md) records full hashes, baselines, failed attempts and limits. A replacement Colab T4 now has the pinned TokenRig environment installed and the raw-rig candidate service connected in the backoffice; generation, production rigging, animation and qualification remain blocked. Do not infer production readiness or use local processing. Verify the remaining Colab stages before dispatch.

## Latest bounded shoulder candidate (2026-10-27)

Colab centroid candidate `e047ce58` reduces measured left-shoulder 90-degree contacts from 31 to 25 and passes 16 controlled bends and glTF validation. Babylon review `6d60a41a` found no convincing visible shoulder improvement; hip creases remain. The candidate and review are registered as unqualified diagnostics only. Preserve the source and all prior baselines and frozen displacement caps; see the [regression lock](docs/avatar-rework/mirelle-deformation-regression-lock-20261026.md) for exact lineage and limits. No game clips or appearance fitting have been qualified.

## Latest hip fold trial (2026-10-27)

Colab hip fold profile `4d516962` and bounded ARAP trial `1e484c28` are retained in the backoffice and [regression lock](docs/avatar-rework/mirelle-deformation-regression-lock-20261026.md). Left hip contacts increased 40 to 48; right decreased 27 to 26. Reject the combined trial, preserve the frozen limits and do not infer visual qualification from edge strain or a one-contact reduction. No model was exported.

## Latest contact-aware hip candidate (2026-10-27)

Colab hip candidate `89354e93` reduced controlled 90-degree hip contacts from 40/27 to 38/26 and passed 16 bend checks and glTF validation. Babylon review `0044e6e4` found no convincing visible hip crease improvement; shoulder roots also remain unresolved, and front/side hip close-ups are partly occluded. Retain the candidate as unqualified evidence only, preserve frozen limits and historical failures, and consult the [regression lock](docs/avatar-rework/mirelle-deformation-regression-lock-20261026.md).

## Latest visual direction and planning reset (2026-10-24)

Read [docs/babylon-visual-rebuild.md](docs/babylon-visual-rebuild.md) as the single active arena/avatar visual plan. Owner rejected 2D billboard actors and requested actual modeled geometry with Babylon.js animation/effects; existing pictures serve as references. Superseded generated visual planning Markdown is removed with exact historical content/hashes in [docs/visual-reset-20261024.json](docs/visual-reset-20261024.json). Historical implementation reports and supplied specifications remain evidence, not current visual instructions. The reset is documentation-only so far; the existing renderer has not yet been replaced. Keep all gameplay/ML invariants and the clean-base/rig-before-outfit gates below. Do not reuse failed Mirelle or deleted binaries as qualified fresh assets.

## Latest all-avatar asset reset (2026-10-24)

The owner explicitly superseded the old retain-artwork instruction and requested deletion of **all 45 avatars' existing model, rig, animation and reference/preview picture versions**, then a fresh Mirelle Vane base pipeline. Current legacy files are deleted and visual releases inactive. Preserve roster/gameplay/card definitions and historical job/revision/report metadata; do not restore old binaries or select historical jobs as fresh sources. This exception applies to avatar binaries, not frozen ML artifacts. Read [docs/avatar-rework/asset-reset-20261024.md](docs/avatar-rework/asset-reset-20261024.md). Mirelle remains **unqualified**: the 2026-10-26 Colab weight/taper experiments reduce measured intersections, but limited Babylon review of both reference and taper still finds compressed joint transitions. No game clips or appearance qualification. Use the new source-bound rest/posed contact map for the next isolated joint repair; do not treat posed bounds as a rest-mesh mask. Do not publish or fit outfits. Follow [the current deformation regression lock](docs/avatar-rework/mirelle-deformation-regression-lock-20261026.md).

Every agent must follow that document's stage checks and coordination protocol: read the latest handoff, declare file/stage ownership, share artifact IDs/hashes and verification results with agents working on adjacent stages, and record unresolved failures. Coordinate through available agent messaging when agents are active; otherwise leave the same information in the handoff. Never silently override another agent's stage or claim qualification/publication from a structural pass. The successful isolated TokenRig trial does not establish a deployed provider or fix the known shared repair/retarget deformation.

Read [docs/agent-handoff.md](docs/agent-handoff.md) before changing the game. It records the user's requests as a conversation and names the code that implements each decision.

## Parody Aliases

Keep `Cardrel` as the requested parody alias. Player card faces must display fictional gamer parody aliases (e.g. Zypoo, d4nk, p1mple, M0cke, flopz, Spl1t, SneakBro, Fisha), never the source person's real name. Preserve card IDs and internal `realName` values.
