# Calendar, launch championship and world media — 8 November 2026

## Owner decisions

The owner requested real calendar seasons opening in January's second or third week, preserving the five-player match format and original Hexatrick event identities. The owner explicitly approved labeled simulated launch history through the present date, separate from verified results, rankings and existing records. The owner also requested scrimmages, detailed team game records, restored original illustrated player portraits, organizer invitations, fictional media personalities, manager discussion and popular/Tier 1 match broadcasts. Automated tests are deferred for this pass.

Reference: Riot's [2026 season start](https://lolesports.com/en-US/lolesports/news/season-start-2026-lol-esports), [international event dates](https://lolesports.com/en-US/lolesports/news/msi-and-worlds-updates), and [season handbook](https://lolesports.com/en-GB/season/115547545029543948/handbook). The reference informs cadence, not copied names, teams, organizers, artwork or competition rules.

## Annual program

`CompetitionCalendar` computes the third Monday in January at 10:00 UTC / 18:00 Manila from each actual calendar year. The next official opening is **18 January 2027**. The calendar-year record freezes approved official definitions, regulations, versions and protected national-team windows with a hash and actual publication timestamp. Repeated processing uses that snapshot; later template revisions do not change published editions. Missed historical official editions are not manufactured.

Original regional Dawn, Zenith and Dusk league templates accompany Vanguard Cup (March), Summit Masters (late June–July), Crown Championship (15 October–14 November) and Nations Cup (late November–December). Regional round cadence is separate from one-hour broadcast spacing between different clubs. The protected final national-team window begins 23 November, clear of Crown's final. Existing recovery, player reservation, roster lock, geographic eligibility and verified match progression still apply. No official 2026 annual circuit was fabricated; inauguration remains 2027.

Approved independent organizers can publish editions during the actual year, independently of the frozen official program. Events may overlap in dates; clubs and players still require non-conflicting fixtures. Organizer invitations use published wildcard reservations with expiry and acceptance. The interface now names this action “Invite a team” and explains the reserved pathway.

`IndependentOrganizers` makes one bounded fictional announcement decision per ISO week. It selects a country/tier with at least four published clubs, checks legal dates and records a durable decision. Harbor Stage, Meridian Relay and Patchline Studio have original fictional sponsors. Each organizer's monthly sponsorship grant is explicitly recorded in `world_sponsor_ledger`; each announced event holds ₱3,000 for ₱2,000 champion / ₱1,000 finalist prizes. Verified tournament settlement pays the existing club ledger, and cancellation refunds the sponsorship allocation. These are in-game currency issuances, not real financial sponsorships.

The first announcement is **Harbor Open Nov 8 · Tier 5**, edition 4, registration closing 10 November and event dates 11–20 November. Its initial distinct-club spacing was corrected before lock, with only bot entrants and no fixtures, under audit `edition.prelock_cadence_corrected`; the previous rules are retained in that audit. Recovery remains 24 hours. A first failed announcement transaction rolled back entirely because a newly inserted definition's database-default version was not yet hydrated; new definitions now supply their version explicitly.

## Approved launch archive

`LaunchChampionship`, `PollLaunchHistoryGame`, `history_server.py`, `history_handler.py` and `history-match.mjs` implement the isolated **Crown 2026 Launch Exhibition**, edition 2. Its sixteen entrants are the first sixteen published clubs by registry ID, explicitly selected for a launch exhibition rather than claimed past sporting qualification. It uses current launch-roster snapshots; it does not claim those contracts existed in October.

Four groups of four play three rounds (24 games), followed by four quarterfinals, two semifinals and a final. Historical dates are October 15/20/25 and November 3–7. The November 8 evening semifinal and November 14 final remain future fixtures. The archive cutoff is fixed at installation on November 8 morning Manila time. A delayed future fixture is moved to a legal future slot or held for review; it never becomes a backdated verified match.

Historical inputs have immutable hashes and individual seeds. The runner uses the existing frozen headless historical simulation kernel in explicitly selected **historical baseline** mode. It steps to an actual match finish; the benchmark timeout winner is not used. Failure to finish is retained for review. This is not a claim that historical baseline play equals the live FPS controller. Reports contain actual simulated K/D/A, stats and event timestamps. They are labeled `launch_simulation`, include generation time, and do not have a fabricated live replay.

Archive games have separate database records. They produce no `OnlineMatch`, training, money, ranking, circuit-point or official title settlement. Future exhibition legs use the existing `ClubFixture` → order lock → server match → verified settlement path. The exhibition remains unranked. Existing allocated and completed matches retain their contents.

The dedicated `history-worker` has one CPU, 1.5 GiB memory and one archive process at a time, with a private authenticated endpoint and durable files in the existing online-data volume. It has its own resource budget, separate from live playback. Restarted jobs reuse the same allocation, and results already committed remain immutable. The worker image inherits `teamfight-online-worker:club-pilot-20261107`; it adds adapters and archive entry points without replacing frozen engine/catalog sources. The activated layer digest is `sha256:bd2e3840a8df9a983fcc7c800c2586b25fed0e64bc12b98a2f43b8ba0d8eaf4c`.

**Progress at the last rollout observation:** 10 archive games completed, one running and 13 waiting group games; knockout rounds are created from completed qualifiers. The durable queue continues automatically. Do not report the entire backfill complete until the remaining group games, quarterfinals and November 7 semifinal have finished. Future evening semifinal/final results must remain undecided until their real scheduled games.

## Club and reference interfaces

- “Friendlies” / “Arrange a friendly” become **Scrimmages** / “Schedule a scrimmage”. Existing historical classifications and API identifiers are retained. Bot opponents accept an eligible invitation on the server using the same conflict and deadline checks. Human opponents accept explicitly.
- Avatarpedia team records have paginated all-game, scrimmage and tournament filters. `FixtureReport` shows actual scheduled/start/finalization times, the frozen kickoff roster and Avatar choices, verified match result, available team scores and precise recorded events. Missing individual historical statistics are not inferred.
- `WorldPlayerPortrait` is an original transparent SVG illustration system keyed to the person's UUID. Faces remain stable through transfers and do not derive skin/hair from nationality. Portraits contain no attribute labels or background plate. Squad, Club Home and Avatarpedia use them. This is player profile illustration work, not an alteration of the Colab-only modeled Avatar pipeline.
- Organizer and sponsor article links filter to their actual recorded events; independent sponsor names are projected from the same published definitions.

## The Wire and Hexacast

`WorldMedia`, `PublishWorldCoverage`, `WorldMediaController` and `WorldMedia.tsx` provide **The Hexatrick Wire**. Mara Relay (caster), Ivo Lantern (analyst) and Neri Pixels (streamer) are explicitly labeled fictional automated personalities. Their stories use recorded match results, published tournament status, HGR leaders or verified player appearances. The copy is factual template-based coverage, not a claim of autonomous human-level editorial analysis. Launch stories carry explicit simulation provenance. Managers can publish their own updates and reply; authenticated writes are throttled, length-limited and rendered as text. Authors and the designated owner can hide posts/comments through authorized endpoints.

**Hexacast** discovers genuinely live, publicly spectatable scheduled games, upcoming fixtures and completed match recordings. Featured sorting favors official/Tier 1 fixtures, then actual presence. Presence counts unique signed-in viewers with a 90-second expiry; it does not invent audiences. Watching reuses `OnlineNormalView` in broadcast-only mode, with the same server match frames and synchronized text. It is an in-app match broadcast directory, not an external video ingest/RTMP platform. Live coverage threads and completed result threads are backed by the news records.

Workspace entry points: `#play?world=news`, `#play?world=broadcasts`, `#play?world=archive`; Club Home also includes recent Wire posts. Public reference/read endpoints remain in `/api/v1/avatarpedia` and `/api/v1/world`.

## Rollout and verification limits

Migrations 000013–000014 were applied after a PostgreSQL custom-format backup, `.local-tools/matchday-rehearsal/hexatrick-world-media-pre-20261108.dump` (7,607,149 bytes). The match worker was refreshed only with no running/allocated live matches. The history worker was activated separately. No ML, generation, rigging, animation or Avatar qualification worker was restarted.

Production build (including TypeScript) passed, with existing large game/viewer chunk warnings. Changed PHP files and Python/JavaScript worker entry points passed syntax checks. Read-only runtime observations returned HTTP 200 for the new launch, news, broadcasts, verified report, public team history, tournament and sponsor projections. Ten actual requested archive games finished with no recent failed queue jobs observed; the three existing completed online matches remained intact. These are rollout observations, not a substitute for the deferred test suites. Automated tests and browser interaction/visual acceptance were not run, per owner request.

Remaining limits: backfill is still generating; future scheduled rounds have not happened; full-year calendar/qualification operation, overlapping live capacity, social moderation UX and complete tournament prize settlement still need later operational acceptance. No full-year or live-broadcast concurrency qualification is claimed.

## Suggested next phase (superseded by Club Office continuation)

The recommendation below was fulfilled by the manager inbox, weekly reports, career records, organizer workbench and record-grounded media views. See [the current handoff](agent-handoff.md#club-office-phase-and-visual-continuation-2026-11-08) for the latest implementation and verification status.

Build the daily club-management loop before adding another large subsystem: a manager inbox for invitations/deadlines/outbid notices; a weekly report for training, wages and finances; and an actionable next-decision panel. Then extend player careers with dated contracts, transfer history, appearances and honors, followed by event-driven media narratives and richer broadcast commentary. Keep each projection tied to authoritative club, competition and verified match records.
