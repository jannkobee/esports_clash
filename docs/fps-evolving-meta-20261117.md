# Lag fix, post-plant fix, T-skew investigation and the Level 6 evolving simulation (2026-11-17)

Plan: `C:\Users\User\.claude\plans\i-want-my-simulation-replicated-sedgewick.md` (owner-approved). Work done in phase order; nothing committed.

## Lag (live tick spikes)
- Cause (CPU profile of `benchmark-live-fps.mjs --map=spillway --seeds=1337`): slow ticks ran ~45 heat-weighted cross-map A* searches from one origin (one per candidate approach in `chooseLiveApproach`), and path smoothing re-tested long node-to-node segments.
- Fix (`fpsLiveMap.ts`, `fpsLivePlanning.ts`): `findPathsFrom(origin, threats, caution, heat)` is one lazily expanded Dijkstra over the same edge costs serving every destination; the per-decision route planner uses it for heat/threat routes and from the second static destination. Node-pair clearance used by smoothing is memoized (static geometry, exact). Test: `src/fpsPathSearch.test.mjs`.
- Spillway seed 1337 live ticks: before p99 23.7 / max 114.7 ms (17 ticks > 33 ms); after p99 6.9 / max 21.4 (0 > 33), idle machine. End-of-session runs (with the soak competing for CPU): Fontessa 1337 p99 12.8 max 35.0 (1 > 33), 9127 p99 11.7 max 28.6; Spillway 1337 p99 12.2 max 24.7, 9127 p99 10.1 max 37.0 (1 > 33). GPU frame rates unmeasured.

## Post-plant bug (owner report: TheSpicy stands on B after planting)
- TheSpicy is lab blue slot 0 (T_IGL). Headless trace: after planting he stood on the device (0.0 m) "Holding" for 25+ s on both maps.
- Cause: `planLivePostPlant` included the player's own position as a candidate; for the planter that is the device itself (zero travel, perfect view), so it always won.
- Fix: spots within `LIVE_POST_PLANT_OFF_DEVICE` (3.5 m) of the device are used only when nothing else is available. After: he moves 6-19 m off the device to post-plant holds. Test in `src/fpsPathSearch.test.mjs` (both maps, both sites, all slots).
- Not changed: CTs "Holding"/"Crouch-holding" for several seconds during some retakes, and one CT "Hunting for upgraded weapon" during a retake (Fontessa round 6, seed 7). Seen in the trace, not investigated.

## T-side skew investigation (before Phase 3)
- Raw T% mixes side advantage with team strength when a match ends early (seed 22 is 16-0 / 0-16 in every configuration). `balance-live-fps.mjs` now reports `sideAdjustedTWinPct` (each team's T win rate minus its CT win rate). Diagnostics-only switches: `--off=aim,utility,consistency` (`LiveSimulationDiagnostics`: snap aim after the perception delay, skip the consistency trait; utility = empty frozen brain).
- Six seeds (11..66), ~130-170 rounds each, SE about +-4 points, side-adjusted T%:

| Configuration | Fontessa | Spillway |
|---|---|---|
| Current (before post-plant fix) | 77.6 | 66.7 |
| Manual aim off | 71.0 | 60.0 |
| Utility brain off | 76.9 | 59.4 |
| Consistency off | 72.2 | 68.5 |
| All three off | 65.2 | 66.4 |
| Last commit `ca1de99` (partial: 3 / 5 matches) | 67.3 | 63.4 |
| After post-plant fix (145 / 133 rounds) | 73.5 | 70.6 |

- The post-plant fix moved Fontessa -4.1 and Spillway +3.9, both within noise (no measurable shift).
- Reading: manual aim shifted it most (~6-7 points on both maps); the utility brain shifted Spillway (~7) but not Fontessa; consistency within noise. A 63-67% T bias already existed at the last commit. The earlier "~55%" came from `benchmark-spillway.mjs` with different profiles. Cause of the base bias not found. Playbook statistics compare plays within a side, so a constant side bias does not by itself favour one play over another.

## Phase 1: never-lose persistence
- Laravel: append-only `fps_team_lineages`, `fps_model_versions`, `fps_lineage_events` (update/delete triggers on SQLite/MySQL/Postgres; payloads > 256 KB are content-addressed files verified on read). `FpsLineageStore` folds promote/rollback/pause events into the current version. `GET /api/v1/fps/lineages/{key}/current|history` (verbatim bytes), worker writes `POST .../versions|events` with `FPS_LEARNING_WRITER_TOKEN` (`config/automatic_learning.php`).
- Approved bundles: `models/registry.json` (append-only promote/rollback/pause/resume) takes precedence over `active.json`; old bundles and the legacy pointer stay valid.
- Utility brain: eviction replaced by consolidation. Memories leaving the 800-entry working set move to a compacted `archive` (style, flight, aim, record) and are revived on use; spots likewise (`spotArchive`); only a 20,000-entry archive overflow folds into per-target `aggregates`. Oversized stored brains consolidate on load instead of being truncated. Round deltas replay the tiers exactly. Bundle limit 8 MB (TS and PHP).
- Browser: IndexedDB cache behind the existing sync storage (`fpsLearningCache.ts`), seeded synchronously from localStorage (localStorage values kept). No size-based silent drops; unreadable values are quarantined under a dated key, never overwritten; "Reset" became "Start new ... experiment (keep current)" (dated slot keys).
- Worker: `engineHash` is provenance only; compatibility is per learner. An incompatible checkpoint is archived exactly (`model_versions` row + `versions/<sha>.json`, trigger-enforced append-only) and only that learner forks from its prior. Hourly, fork, candidate and promotion snapshots are recorded.

## Phase 2: per-team learning identity
- Per-team utility brains (`teamLearning[team].utilityLearning`). `fetchTeamLearning(lineage)` loads a team's current lineage once at match start (cache, then approved fallback). The lab's frozen exhibitions field `worker:main` vs `worker:rival`.
- Worker: two co-evolving lineages (`worker:main` = legacy model; `worker:rival` forked from it), lineage-tagged experience, alternating sides and maps (Fontessa/Spillway).
- The manager practice launch has no club id client-side (both sides come from one roster), so it still uses the approved bundle.

## Phase 3: Level 6 tactics
- Data-driven plays (`fpsLivePlays.ts`): every archetype/setup branch in `fpsLiveSimulation.ts` reads a `LiveAttackPlay`/`LiveDefensePlay` field; the 7 archetypes and 6 setups are seed plays with the old constants. Parity: `scripts/trace-live-fps.mjs` (rounds, tactics, sites and a position/health/action hash every 30 ticks; seeds 11, 22, 1337, 12,000 steps, both maps) is byte-identical to the pre-refactor code, and stays identical with all Phase 3 wiring once both sides include the post-plant fix.
- Team playbook (`fpsLivePlaybook.ts`), per team per map: Thompson sampling over plays (overall and per-opponent results), with the existing archetype weights (gameplan, IGL tendencies, lawful enemy reads) as the decision prior; IGL `strategyVariation` sets exploration. Without a playbook the old choosers run unchanged (same random stream).
- Innovation: bounded mutation/recombination of strong plays every 16 rounds per side (max 3 candidates). Promotion after 12+ trials at parent win rate + 4 points; give-up archive after 36; active book capped at 18, with the weakest archived. Nothing is deleted. Deterministic from round ids, so replaying records reproduces the book.
- Counter-strategies: per-opponent results drive selection against that opponent; a lawful cross-match opponent model (plants, first-blood area, observed-habit flags; no opponent play ids) biases priors after 5 observed rounds.
- Telemetry: `LiveRoundTelemetry` adds tactic, setup, site, first-blood site, play ids. Worker bundles carry `playbooks` (per map) and `opponents`; `playbook` records apply with the same function. PHP `FpsPlaybookValidator` mirrors the loaders (refuses unlawful opponent fields).
- Decisions only: plays change calls, positions and utility timing, never aim, spread, damage or reaction.

## Phase 4: automatic promotion with safety
- Coordinator: screening, then route-, combat-, movement- and playbook-only ablations (each pins the rest, including playbooks, to the incumbent), then a league against up to 3 earlier promoted versions (must not be significantly worse). With `autoPromote` (default) a passing candidate is stored by hash and a `promote` event with an Elo-style rating is appended. A monitor then plays it against the replaced version and appends `rollback` on a significant regression. Owner controls: `registry.mjs status|pause|resume|rollback`, or a `PAUSE_PROMOTION` file. Per-cycle `reports/meta-<cycle>.json`. Export publishes `models/registry.json` and promoted bundles.
- Robustness found by the soak: (1) a learned bundle with a playbook was rejected by key-order-sensitive validation, so every later job aborted. Fixed with canonical comparison and seed specs in loader order. (2) Long matches ended as `worker-exit:0` and the coordinator later crashed with `Unknown play`. Cause: the coordinator resolved jobs on the child's `exit` event, which can fire before queued IPC messages arrive, so the last records and the result of long matches were dropped (a dropped innovation record then left the stored book without a variant the next job called). Fixed by resolving on `close` (pre-existing code path; the extra playbook records made it show). Also hardened: variant records carry their spec (a book missing it adopts it as a candidate), unappliable records are quarantined (`quarantine` table) instead of stopping training, and `worker-exit` records the exit code/signal. (3) The worker's position/collision invariants were Fontessa-only and failed every Spillway job; they now use the job map.

## Phase 5: real-match experience
- `POST /api/v1/fps/lineages/club:{id}/experience` (Sanctum, own club only, throttle 10/min, 256 KB, unique per lineage and match, append-only): called plays, results and only lawful observations; unknown fields are refused. The worker pulls `GET /api/v1/fps/lineage-experience` (writer token) when `LEARNING_API_URL`/`LEARNING_API_TOKEN` are set, applies rows atomically to the club lineage (forked from `worker:main` on first use, ledger-deduplicated, bad rows rejected whole) and publishes a promoted version.
- Client: `FpsLiveBroadcast` `contributeTo` submits each contributing team's round results when the match finishes (`fpsLineageExperience.ts`). No screen passes a club lineage yet (see Not done).

## Observed results (exact commands, from `EsportsClash.Web` unless noted)
- `node scripts/sync-fps-player-architecture.mjs --check`: "FPS architecture packages match."
- `npm run check:game`: 503/503 pass. `npm run test:pro-regression`: 16/16. `npx tsc -b && npm run build`: exit 0.
- `php artisan test --filter='FpsIdentity|AutomaticLearningBundle|FpsPlayerArchitecture|FpsManagerRoles|FpsLineage|FpsPlaybook|LearningReportSummary'` (from `EsportsClash.Api`): 40 passed.
- `node scripts/benchmark-live-fps.mjs --map=<m> --seeds=1337,9127`: see Lag.
- `node scripts/balance-live-fps.mjs --map=<m> --seeds=11,22`: Fontessa raw T 43/47 rounds, side-adjusted 90.8%; Spillway raw T 22/37, side-adjusted 58.6%. Single seeds swing widely, so see the six-seed table.
- Soak: SOAK_RESULT

## Not done / not reviewed
- Nothing was reviewed in a browser this pass (IndexedDB cache, relabelled lab buttons and the broadcast are typechecked and built only). GPU frame rates unmeasured.
- No multi-hour league soak; the soak above is one short run with reduced evaluation sizes. No promotion has been observed improving play.
- Club matches do not yet pass a club lineage to the live broadcast (no club id in the manager practice launch), so real-match submission is wired but unused by any screen.
- Raw experience archives still follow the existing 30-day retention (`retentionDays`); learned models are never deleted. Whether raw archives should also be kept forever is an open owner decision.
- The base T bias (63-67% at the last commit) and the T bias after the post-plant fix remain unexplained.
