# Official matches on the live 3D engine (2026-11-18)

The owner decided that every scheduled match runs on the 3D simulation, and asked for it to work at the scale of thousands of matches with the same kickoff time. Before this change:

- Official matches ran on the 2D zone engine in a worker that handled one match at a time.
- Each match started a new Node process that spent about 4.4 s loading TypeScript.
- The 3D simulation ran only in viewers' browsers, for exhibitions.

Nothing is committed or deployed.

## How it works now

1. **Allocation.** New matches pin `simulation_version: 5` and a live map (`fontessa` or `spillway`, chosen by seed; `OnlineService::FPS_LIVE_MAPS` mirrors `officialLiveMapForSeed`). `FPS_SIMULATION_VERSION=4` switches back to the recorded engine. Version-4 allocations and replays stay supported.
2. **Simulate before kickoff.** For version 5, `PollOnlineMatch` starts work `FPS_PRECOMPUTE_MINUTES` (default 90) before kickoff. `LockClubFixture` dispatches it at that time, or at once if the window is already open. The match stays `allocated`, with no `started_at` and no spectating, until kickoff.
3. **Headless official run.** `simulateOfficialLiveMatch` (`src/fps/fpsOfficialLiveMatch.ts`) builds the 3D engine from the pinned plan: cards with the six attributes, manager-chosen roles, identity, seed and map. Learners are the engine's frozen defaults. It runs the match to the end and returns the report.
4. **Report.** The report keeps the recorded engine's contract (`finalScore`, `roundResults`, `playerStats`, kill/round/objective `events`), with these additions:
   - `engine: 'live-3d'`
   - `behaviorSummary`: observed decisions as per-player, per-metric counts, applied by `FpsIdentityEngine`. One event per observation made a 10 MB report; this makes it about 75–150 KB.
   - `roundSnapshots`: positions only, for role familiarity.
   - `durationSeconds` (played time, for XP) and `broadcastSeconds` (the whole broadcast).

   Team-kills and bomb deaths are `player_eliminated` events, not kills. The report carries no DNA, skill profiles, mental state or raw tendencies; `OnlineService::validateFpsReport` checks this, and also validates `behaviorSummary`.
5. **Replay** (`src/fps/fpsLiveReplay.ts`):
   - **Recording.** While the match runs, the worker records 10 frames per second in 10-second chunks. Each chunk is a full public keyframe followed by structural deltas, plus the new events, team reports and audio cues of each frame.
   - **Privacy.** Diagnostics, mental state, skill profiles, behaviour counts and learning state are removed. Tendency values are reduced to whole 1–10 levels. Numbers are rounded to 1/1000.
   - **Files.** Chunks are written gzipped and atomically. A provisional `header.json` is written after every chunk and the final one at the end.
   - **Measured size:** about 2 KB per second of broadcast; 3.3–6.7 MB per match; chunks of 34 KB or less.
6. **Settlement waits for the broadcast.** A version-5 result that the worker finished early is not settled until `kickoff + broadcastSeconds`. Until then the match is `running` (from kickoff) and spectators can watch it. Matches without a fixture time the broadcast from the worker's start.
7. **Watching.**
   - `GET /api/v1/online/matches/{id}/live-replay` returns the header capped to what has already aired: whole chunks only, with no total length until it ends.
   - `GET .../live-replay/{chunk}` returns a chunk only once all ten of its seconds have aired. Access is the same as the existing replay (participants, or public spectating of a fixture after kickoff).
   - `FpsOfficialBroadcast` builds a `FpsLiveReplaySource` and hands it to the existing `FpsLiveBroadcast` through its new `replay` prop. The replay source offers the same `step`, `snapshot`, `drainAudioCues` and `learningDiagnostics` methods as the simulation, and interpolates bodies and grenades to 30 Hz. Live viewers join about 20 s behind the live edge and re-read the header every 10 s.
   - `OnlineNormalView` uses this for version-5 matches. Exhibitions still simulate in the browser.
8. **Workers.**
   - **Concurrency.** `server.py` runs up to `ONLINE_MAX_MATCHES` matches at once (default: the machine's cores).
   - **Queue.** When all slots are full, an allocation waits in a local FIFO and a dispatcher thread starts it (`202 queued`), so Laravel polls every 30 s instead of retrying every 10 s.
   - **Health.** `/health` reports `max_matches`, `running`, `queued` and `replays` (replay bytes on disk, replays retained, the last sweep's removals, free disk space and the retention settings).
   - **Engine bundle.** The image builds one engine module (`scripts/build-worker-engine.mjs`, entry `src/fps/fpsWorkerEngine.ts`). A match process loads in 0.65 s instead of 4.0 s, with an identical result hash.
   - **Several machines.** Laravel routes each match to one of `ONLINE_WORKER_URLS` by `crc32(match id)`, and replay requests follow it.
   - **Validation fixed.** The worker's validation accepts the six current attributes (it still required the retired `lan` and `tf` keys) and the live maps.
   - Each match logs its CPU seconds and peak memory.

## Determinism and verification

- **Determinism.**
  - Two runs of the same plan give byte-identical results in the same process, in separate worker processes, and from the bundle against the sources.
  - The replay decodes exactly, frame for frame, against the recorded public snapshots.
- **Frontend:** `src/fpsOfficialLiveMatch.test.mjs` (5):
  - delta round-trip;
  - frame-exact decode with no private state and 1–10 tendencies;
  - the replay source's 30 Hz interpolation, live-edge waiting and growing header;
  - the map rule;
  - one full official match validated against every report rule.
- **Backend:** `tests/Feature/FpsLiveEngineTest.php` (4):
  - version-5 pinning on a live map;
  - settlement with `behaviorSummary`, applied once (missing or foreign summaries are rejected);
  - simulating ahead with settlement only at the end of the broadcast;
  - the replay endpoints serving only whole chunks that have aired, without revealing match length.
- **Other test changes.**
  - `phpunit.xml` pins `FPS_SIMULATION_VERSION=4` for the existing suites, which test the recorded engine.
  - `tests/Support/FpsWorkerResult` also produces version-5 results.
  - `OnlineTest` had 18 failures from before this work: its fixtures lacked the manager-chosen roles that matches have required since 2026-11-14. A new `AssignsManagerRoles` trait saves them like a manager would.
- **Results:** backend focused suites 108/108. Frontend `npm run check:game` 569/569, and `npm run build` passes.

## Performance

All figures are from one 12-thread desktop.

- **One match alone:** 48–70 s of CPU for a regulation match. A 35-round overtime match takes about 210 s. Recording adds 18% (reduced from 27–60% with allocation-light rounding and deltas).
- **Engine changes.**
  - Terrain queries and `advanceElevation` no longer copy whole player objects per tick.
  - The engine bundle loads in 0.65 s instead of 4.0 s.
  - Same-match results were identical before and after.
- **Load test** (`node --experimental-strip-types scripts/load-test-match-worker.mjs --matches=24 --concurrency=12 --bundle=…`; real worker, one process per match, 12 at a time):

  | Measure | Value |
  |---|---|
  | Completed | 21 of 24 |
  | Wall time | 710 s |
  | Throughput | 106 matches per hour |
  | CPU per match under full load | 212 s (343 s maximum) |
  | Average broadcast | 41.4 minutes |
  | Replay per match | 5.4 MB |
  | Peak memory per process | 430 MB |

  - The 3 failures were a Windows-only `EPERM` when renaming over `header.json`. Atomic writes now retry, and provisional headers are best-effort.
  - Starting matches with `--max-old-space-size` gives about 250 MB per process with an identical result (`ONLINE_MATCH_HEAP_MB`, default 192).
- **Capacity for 1,000 matches with the same kickoff, at this machine's per-thread speed:**
  - **About 40 hardware threads** to simulate all of them within the 90-minute pre-kickoff window. Count about 250 MB per running match, so about 10 GB at 40 at a time.
  - **About 86 threads** if every match had to be computed in real time; precomputing avoids that.
  - **Replay storage:** about 5.4 GB per 1,000 matches.
  - **Viewer bandwidth:** about 2 KB/s per viewer, the same data for every viewer of a match, so it caches well behind a CDN.


## Replay retention (2026-11-18, later)

`infrastructure/online/replay_retention.py`, run by a thread in `server.py` at startup and then every `ONLINE_REPLAY_SWEEP_MINUTES`.

- **What is removed.** Only `/online-data/{match}/replay/`. `allocation.json`, `state.json` (with the result) and `worker.log` stay, so settlement and reports are unaffected. A `replay-expired.json` marker (time, end of airing, bytes, reason) replaces it. Removal renames the replay away first, so a half-deleted replay is never served; a leftover is finished on the next sweep. Each removal is logged as JSON with the bytes freed.
- **Age** counts from the end of airing: `max(completion, broadcast start + broadcastSeconds)`. Completion is the new `state.completed_at` written by `fps-match-worker.mjs`, or the final header's write time for older matches. The broadcast starts at the fixture kickoff, otherwise at the worker's start (as `OnlineMatch::broadcastStartsAt`).
- **Never removed:** a match running or queued on the worker; a provisional header; a failed, interrupted, allocated or running state; a version-4 recording (`frames/`); a replay still on air or before kickoff; anything whose folder is not a match id (for example `launch-history`).
- **Low-disk guard.** Below `ONLINE_REPLAY_MIN_FREE_GB` of free space, the oldest aired replays are removed first until there is room again, and only replays whose broadcast ended at least an hour ago. The guard is checked every 5 minutes.
- **Settings.**

  | Variable | Default | Meaning |
  |---|---|---|
  | `ONLINE_REPLAY_RETENTION_DAYS` | 30 | Days after airing that a replay is kept; `0` keeps replays forever (the low-disk guard still applies). |
  | `ONLINE_REPLAY_SWEEP_MINUTES` | 60 | How often the retention sweep runs (minimum 1). |
  | `ONLINE_REPLAY_MIN_FREE_GB` | 2 | Low-disk guard threshold; `0` disables it. |

  30 days keeps about a month of matchdays watchable at about 5.4 MB per match: about 160 GB at 1,000 matches a day, about 5.4 GB at 1,000 a month.
- **Viewing an expired replay.** The worker answers `410` for a removed replay. Laravel's `/live-replay[/{chunk}]` then answers `410` with `reason: replay_expired` and drops its cached header. A settled match whose worker has no replay at all (`404`) answers `410` with `reason: replay_missing`. A match that is not settled still answers `404` ("still being prepared"). The fixture report and the match result are untouched.
- **Frontend.** API errors now carry `status` and `reason`. `FpsLiveReplaySource` stops requesting chunks after a 410 (other failures still retry) and calls `onUnavailable`. `FpsOfficialBroadcast` then shows "Replay no longer available"; the result line and fixture report stay on the match page.
- **Checks.** `python -m unittest infrastructure/online/test_replay_retention.py` (9): old finished replay removed with results kept; age from end of airing; recent, running, provisional, failed, allocated, version-4, on-air and pre-kickoff replays kept; active matches kept; non-match folders ignored; header-time fallback; retention 0; the low-disk order and grace; an interrupted removal finished. `FpsLiveEngineTest` adds the `410` expired and missing cases. `src/fpsOfficialLiveMatch.test.mjs` adds the replay source's 410 handling. Results: worker 9/9; `npm run check:game` 570/570; `npm run build` passes; backend `FpsLiveEngineTest`, `OnlineTest`, `FpsIdentityTest`, `CompetitionTest` and `WorldPlayersTest` 71/71. `ClubManagementFlowsTest` has one failure from before this work: its fixture lacks the manager-chosen T roles.
- **Not done.** Not run in Docker or against a real disk. Failed or interrupted matches' partial replays are kept (they are not finished replays). Version-4 `frames/` recordings are not covered. The Laravel chunk cache can still serve chunks it fetched in the last 10 minutes.

## Open decisions and limits

- **Replay storage.** The owner decided (2026-11-18) to keep replays on the worker's disk under `/online-data/{match}/replay`, proxied through Laravel, for now. Object storage behind a CDN (with the spoiler gate kept in Laravel, for example signed URLs per chunk) remains the path for thousands of viewers and is not built.
- **Cores.** The capacity numbers below assume the load-test machine. Production cores and `ONLINE_MAX_MATCHES` are the owner's choice.
- **Not done:**
  - The Docker image was not built.
  - Nothing was deployed or migrated.
  - No real fixture was run end to end through Laravel, the queue and the worker.
  - The browser view of an official broadcast was not reviewed. It uses the reviewed live broadcast, fed by a replay source.
- **Match pages.** Completed version-5 matches show the 3D replay and the fixture report. The 2D `FpsMatchView` timeline does not render version-5 reports.
- **Live stream.** The WebSocket `/live` stream is unused for version 5; viewers fetch chunks.
- **Engine cost** remains the dominant term. The profile is flat: terrain checks, sightlines, movement and route planning. The `decide()` spikes noted earlier are still unexplained.
