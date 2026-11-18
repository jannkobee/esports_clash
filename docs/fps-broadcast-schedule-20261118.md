# Broadcast schedule: tournament streams, on-air holds and a kickoff cap (2026-11-18)

The owner asked that tournament games follow each other like a real broadcast: each game waits for the previous one to finish, with one to two hours between games. Simultaneous kickoffs beyond what the workers can simulate should be delayed.

## What the system did before

- Games in a tournament round were scheduled one after another, **one hour apart** (`fixture_interval_hours`, default 1). Rounds were at least 24 hours apart (`recovery_hours`).
- A live 3D broadcast averages about 41 minutes and a full 30 rounds takes about 50 to 60. Overtime is unbounded, at about 9 minutes per extra six rounds. A one-hour slot could therefore overlap with the next game, and nothing waited for the previous game to finish.
- Nothing limited kickoffs across tournaments. In practice, simultaneous kickoffs were roughly the number of tournaments running at that moment, plus scrimmages. The division trials (`WorldPyramid`) are already staggered two hours apart. Community cup pods all start together, and they are the one real source of bursts.
- **Precompute is shorter than documented.** `LockClubFixture` allocates a match when orders close, which is 15 minutes before kickoff. By then the 90-minute precompute window has long opened, so a fixture starts simulating only about **15 minutes** before kickoff. The capacity figures in the live-engine record assume 90 minutes.

## What changed

| Setting (`config/competitions.php`) | Env | Default | Meaning |
|---|---|---|---|
| `broadcast_slot_minutes` | `COMPETITION_BROADCAST_SLOT_MINUTES` | 90 | Minimum time between kickoffs on one stream. |
| `broadcast_break_minutes` | `COMPETITION_BROADCAST_BREAK_MINUTES` | 15 | Gap after a game ends before the next one on its stream goes on air. |
| `broadcast_max_hold_minutes` | `COMPETITION_BROADCAST_MAX_HOLD_MINUTES` | 180 | After this long past kickoff, a held game goes on air anyway (protects against a stuck earlier game). |
| `games_per_stream` | `COMPETITION_GAMES_PER_STREAM` | 8 | Games in a round per stream. Larger rounds get more streams. |
| `kickoffs_per_hour` | `COMPETITION_KICKOFFS_PER_HOUR` | 300 | Most fixtures that can kick off in one UTC clock hour; `0` means no limit. |

- **Streams.** `CompetitionEngine::schedule` gives each fixture a `broadcast_stream`. The number of streams is `ceil(games in the round / games_per_stream)`, or the `broadcast_streams` value in the event's regulations. Games on a stream are `max(fixture_interval_hours, broadcast_slot_minutes)` apart. An eight-club bracket's first round therefore airs four games 90 minutes apart on one stream. A 24-game group round airs on three streams of eight.
- **Stream conflicts.** A fixture never kicks off within one slot of another fixture on the same tournament stream (`ClubFixture::streamBusy`).
- **Kickoff cap.** When a clock hour is full (`ClubFixture::hourFull`):
  - the tournament scheduler moves the game to the next hour that has room;
  - the scrimmage queue does the same (`nextOpenKickoff`);
  - friendly invitations and `fixtures:schedule` refuse with a 409.
  - The Manila Signal Open's two semifinals are fixed dates. They now sit one slot apart and are not capped.
- **On-air hold.** A new `online_matches.on_air_at` column records when a live 3D game actually goes on air.
  - It is the game's kickoff, unless an earlier game on the same stream, within 12 hours, is still unsettled. In that case the game is held, and goes on air at the earlier game's end plus the break.
  - The on-air time is decided only after the earlier game ends. A delay therefore never reveals in advance how long the earlier game runs.
  - `PollOnlineMatch` records `on_air_at`, or rechecks every 30 seconds while the game is held.
  - `broadcastStartsAt`, `isBeforeKickoff`, `broadcastSecondsVisible` and settlement all use the on-air time, so replay gating and spoiler protection follow the delayed start.
  - The worker keeps simulating during a hold.
- **Display.** A held game keeps the status `allocated`.
  - The club calendar already showed "Delayed".
  - Hexapedia and the broadcast desk now report `delayed` (shown as "Delayed" / "DELAYED"). The desk keeps held games in "Upcoming".
  - Queries that load only some match columns now include `on_air_at`. The club calendar's match query now also loads `spectator_ready`, which `can_watch` needs.
- **Migration:** `2026_11_18_000001_add_broadcast_streams` adds `club_fixtures.broadcast_stream` (default 0, indexed with tournament and kickoff) and `online_matches.on_air_at`. Existing fixtures are all on stream 0. It has not been run in production.

## Orders lock before the precompute window (owner decision, same day)

The owner chose to lock orders 15 minutes before the 90-minute precompute window, so live fixtures get the full head start.

- **Deadline.** `ClubFixture::ordersCloseAt(kickoff)` is kickoff minus `ordersLeadMinutes()`. That is 15 plus `online.precompute_minutes` on the live engine (105 by default), and 15 on the recorded version-4 engine.
- **Where it applies.**
  - Tournament fixtures (`CompetitionEngine`; the first possible start now leaves the whole window).
  - The Manila Signal Open semifinals and final.
  - `CompetitionCalendar::validateSlot`.
  - Friendly invitations: kickoff must be at least 2 hours ahead, and invitations inside the window are no longer listed.
  - `fixtures:schedule`.
- **Lock and simulation.** `LockClubFixture` still runs when orders close. It allocates the match then, and starts simulating 90 minutes before kickoff.
- **Scrimmage queue unchanged.** It keeps kickoff 30 minutes after pairing with a 15-minute lock, because both lineups come from the queue tickets. Fixtures already published keep their old deadlines.
- **Default orders.** These already existed. `LockClubFixture` uses a fixture's own orders when they are valid, and otherwise the club's saved default lineup (`starters`/`lineup`). The club's tactical system (roles, gameplan) is also club-level.
  - Added `DELETE /online/fixtures/{id}/orders` (`useDefault`), which drops a fixture's override before the lock.
  - The fixture card now shows "Custom orders" or "Default lineup".
  - The fixture editor explains the default and offers "Use default lineup".
  - The guide's fixtures chapter now gives the 105-minute deadline.

## Capacity

A match takes about 212 CPU-seconds under load, and the 90-minute precompute allows about 25 matches per concurrent match slot. A 16-thread worker running 14 at a time therefore takes about 350 same-minute kickoffs. The default `kickoffs_per_hour = 300` leaves margin for that machine. Raise it by about 25 for each added match slot, or re-measure on the production machine with `scripts/load-test-match-worker.mjs`. Quick-play scrimmages still get only 15 minutes of precompute, but they are few.

## Checks

- `BroadcastScheduleTest` (new, 8 tests, 52 assertions) covers the 105/15-minute orders lead, overriding and reverting to the default lineup, and:
  - one-stream spacing and two-stream splitting;
  - the hourly cap pushing overflow;
  - a held game going on air at the previous game's end plus the break;
  - no delay when the previous game ended in time;
  - the hold limit.
- `FpsLiveEngineTest` 6/6, `CompetitionTest` 23/23, `OnlineTest` 24/24, `FpsIdentityTest` 7/7, `WorldCareersTest` 19/19, `WorldPlayersTest` 11/11, `WorldDirectoryScalingTest` 3/3.
- Failures already present before this work, in tests that don't touch scheduling:
  - `ClubManagementFlowsTest`: 1 error, roles not assigned in the fixture.
  - `CoachDraftTest`: 1 error, same cause.
  - `WorldVoicesTest`: 1 error and 1 failure, personality data.
- `npm run build` passes.
- Not done: a browser review of the Delayed labels, an end-to-end run through the real queue and worker, and the production migration.
