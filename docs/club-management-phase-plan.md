# Hexatrick club management phase plan

## Normal queue: human-first bot fallback

The normal matchmaking queue now gives waiting human managers first priority and dispatches a delayed bot-match job after 15 seconds. It only uses bot clubs with valid saved lineups that are not already queued, in an active match, committed to an upcoming fixture, or awaiting a fixture snapshot. If none qualify, the manager remains queued and can cancel; the job keeps retrying. Bot opponents are labeled in the match UI and use the normal staff-led draft. This is separate from rating-tier scrimmage quick-match. `OnlineTest` passes (23 tests / 219 assertions), including human priority, bot pairing, and no-eligible-bot cancellation. No live match was started for the manager; confirm the default queue worker is active before trying the signed-in queue.

## Squad roster and attribute visibility

The active Squad workbench now uses an original, compact esports card treatment for its five starters and gives managers an at-a-glance view of all seven recorded attributes on starters and reserves, alongside role, overall, match form and training XP. Missing values are explicitly marked unavailable. This reuses the authenticated roster's existing player definitions cleanly.

## Staff cabinet and coach-led preparation (2026-11-09)

The manager controls the five-player starting lineup and per-fixture player orders; the club's persistent staff prepares match coach profiles. The Staff cabinet shows five roles and 1–10 attributes, with role-specific tactical, coach, and training effects. Meta uses verified completed matches with player-performance records only, bounded to 90 days / 500 results. The performance coach adds up to 15% to scheduled-match training XP. Existing match allocations and lineup data are preserved.

Focused regression coverage passes (30 tests / 364 assertions). `npm run check:game` passes (615 passed, 22 skipped, plus three simulation tests), and `npm run build` succeeds. The additive schema migration is applied locally; the match-worker was rebuilt/recreated after checking for active matches and is healthy with a matching source hash. A fresh live match plan remains unverified, so don't yet claim end-to-end combat effects.

## Hexapedia scale and career guide follow-up (2026-11-09)

Visible encyclopedia branding is now Hexapedia with `#codex` as the canonical web route; old `#avatarpedia` routes and API endpoints are retained as aliases. Player pages expose their active-catalog skills and personality descriptions with leading icons. The reference home explains the 1–10 rating words, 6 Passable default form, five-most-recent-rating form average, and the existing scheduled-match XP / 40-XP square-root progression. Server ratings are bounded to 1–10.

The local Vite proxy's allowlist includes only its internal Docker `web` hostname so the browser verifier can load the current source app. The final `npm run build` passed after the latest router/title edits; the verifier scripts pass `node --check`, the touched PHP services pass `php -l`, and the connected browser confirms `#codex` loads with the Hexapedia title and guide. `ClubManagementFlowsTest` (7 tests / 63 assertions) and `npm run check:game` (615 passed, 22 skipped, plus 3 match-simulation tests) also pass.

**Historical readiness note (superseded by the Staff section above):** at this earlier checkpoint the persistent staff roster and coach-led draft were still open; a local match was running and the active worker image was stale for performance records. That match was not suitable for rating verification. These observations describe the state before the staff implementation and local worker rollout recorded above.

## Squad and Transfer Exchange continuation (2026-11-09)

The latest code pass adds accessible lineup reordering, per-player verified match rating/form records, same-tier closest-rating scrimmage matchmaking, Squad reserve listings and a filtered, dossier-rich Transfer Exchange with manager-approved cash/player trades. Rating-based matchmaking is explicitly separate from the existing normal queue. Trade values are advisory and cash/player settlement uses server-side ownership, lineup, fixture and ledger guards; completed player movements are added to career records.

The academy currently costs ₱3,000. A ₱10,000 opening price is shown as a recommendation only; no economic setting was changed. Player illustrations are extended UUID-seeded SVG portraits, not generated 3D models.

**Local server-error follow-up (2026-11-08).** Authenticated online requests were failing because the running API queried `club_player_match_ratings` before migration `2026_11_09_000001` was applied. A custom-format PostgreSQL backup was restored and key row counts matched (39 users, 3 online matches, 39 clubs) before applying the additive migration to the local development database. The live migration is now marked ran; no production deployment or worker rebuild occurred. Added focused regression tests for scrimmage tier/fixture behavior, ratings validation, and trade ownership/escrow/refunds. `OnlineTest` plus `ClubManagementFlowsTest` pass (26 tests / 235 assertions); `npm run check:game`, `npm run build`, and connected reference browser checks pass. The connected app is localhost:8088; the standalone port-5173 page was not serving during verification.

The worker and API have not been released together, so verified ratings in future live fixtures remain unqualified. Trade concurrency and an end-to-end live rated match still need operational verification; the tests do not qualify deployment.

## Club Office continuation (2026-11-08)

The proposed daily-management phase is implemented across the manager inbox and weekly reports, player career records, the visual organizer workbench, and record-grounded Wire/Hexacast coverage. The current UI continuation adds the Hexatrick graphite/petrol/copper treatment and icon-led Club Office labels; it does not copy external artwork or change game rules. The production web build passed. Automated tests remain deferred as requested. The latest launch-archive count reported by the owner was 12 completed games, with processing still ongoing.

**Latest direction (8 November).** Hexatrick is the current product name. The owner requested compact management/wiki styling, workspace-preserving Hexapedia links, more icons/crests, and an active human/bot world. Bots may now list and bid under shared market rules, explicitly superseding the old ban. The [living-world phase plan](hexatrick-world-phase-plan.md) records the implemented foundation and real local activation. The manager inbox, weekly reports, career records and organizer workbench are now implemented; earlier release checks below remain historical evidence, not tests of the latest changes.

**Status** — Philippine pilot deployed locally, 7 November 2026. The two-manager scheduled broadcast rehearsal is verified as of 8 November 2026. The verification and rollout record below distinguishes the deployed features from the checks for a wider release.

A manager creates a club, gives it an identity, and submits orders for a published fixture. The match starts on the server even if both managers are offline. Spectators can follow the same match or a live text broadcast. Verified match results drive standings, training, and rewards.

**Current reference name — Hexapedia.** The owner requested a Liquipedia-inspired encyclopedia using the supplied examples. Public pages at `#codex` link tournaments, teams, players, coaches, organizers and sponsors. Compatibility endpoints and historical references below document earlier milestones.

Use Hattrick as a reference for the rhythm of managing a team between matchdays, the readability of player attributes, and text coverage. Give Hexatrick its own visual language, five-player lineup sheet, competition names, and reporting style. Keep player aliases and the avatar release workflow intact. The [earlier club architecture](hattrick-chess-club-architecture.md) is historical context for the early prototype.

## Phase 0 — Map the cutover and protect existing records

- Inventory the browser paths that can create a match result, change balances, advance a bracket, or grant training. Cover Home, Play, Tournaments, Friends, Training, and Market. Identify which actions become server-backed, which become read-only, and which leave the player-facing app at cutover.
- Trace the existing [online match allocation and settlement](../EsportsClash.Api/app/Services/OnlineService.php), [scheduler](../EsportsClash.Api/routes/console.php), match worker, and match viewer. Verify the current worker and viewer agree on live rules before reusing them for fixtures.
- Define an additive migration that preserves trusted account ownership, card instances, club IDs, and verified match history. Keep prototype balances, standings, and match reports separate from authoritative records. Decide opening balances and the handling of legacy club names before migration.

**Exit gate.** The cutover checklist identifies every player-facing shortcut and its replacement. The migration is tested against a copy of existing data, with a rollback rehearsal before live changes.

## Phase 1 — Server-owned clubs, identity, and fixtures

Give each registered manager a starter club and a legal starting five. Reuse the existing server-owned starter provisioning for human clubs. Identify clubs by a stable ID so name or branding changes preserve their fixtures, history, and ownership.

### Club Identity editor

| Area | Customization |
| --- | --- |
| Club profile | Display name, unique short tag, optional nickname, motto, and short club bio |
| Home base | Country and optional home city, displayed on the club page. Country sets the club's market configuration, including currency. |
| Branding | Crest builder with original preset shapes and marks, plus primary, secondary, and accent colours |
| Jerseys | Home and away designs with preset patterns, crest placement, and name and number styles. Preview both kits before saving. |

- Require only a name and tag during onboarding. Supply editable defaults for crest, colours, and kits. Let managers edit the rest later under **Club → Identity**.
- Validate edits and reserve tags server-side. Use preset artwork for the first release. Custom crest uploads can follow once moderation and asset storage are available. Give bot clubs fictional identities from the same preset system.
- Use saved identity on the club page, fixture list, standings, match scoreboard, and text broadcast. Apply jersey designs to team and player profile presentations where supported. If home and away colours clash, use the away design or a readable neutral treatment and retain clear team labels.
- Snapshot the published name, tag, crest, and kit colours in the locked match allocation. Completed reports and replays show the identity used on matchday. The current club profile shows the latest identity, and both link to the same stable club ID.

### Fixture lifecycle

- Store kickoff and order deadlines as UTC instants. Display date, time, and timezone explicitly. Pilot in the Philippines with Manila local time, a Saturday league window, and a midweek cup window. Start with a proposed 15-minute order lock.
- Validate roster ownership and order eligibility on the server. At lock, snapshot the submitted legal lineup or the club's saved legal default. Expose only order fields the match worker consumes. Publish what happens when neither lineup is eligible before opening competitive registration.
- Use Laravel's scheduler to find due fixtures and queue `StartFixture`. Give each fixture a unique match allocation and dispatch through the existing worker path. Pin the roster, identity, catalog, rules, policy, and seed. Recover overdue fixtures and interrupted dispatches from stored state.
- Settle only a verified match result. Make completion and competition effects idempotent. A delayed or recovering match retains its allocation and locked orders. Record and display the actual start time separately from the published kickoff.

**Exit gate.** Two clubs can create identities, submit orders from separate accounts, and log out before kickoff. The worker starts one match, and retries or restarts produce one allocation and one result. Concurrent identity edits cannot claim the same tag. Rebranding after lock preserves the old identity on that fixture.

## Phase 2 — Live match centre and UI cutover

- Make the fixture page the entry point for **Set Orders**, **Watch Live**, and **View Replay**. Viewer and text share the match ID, match clock, event sequence, and final result. Support reconnect, late joins, and replay access using the same saved match.
- Record structured events at their source in the simulation with tick, sequence, actors, targets, and resulting score where applicable. Build readable commentary from those facts. Selecting a line seeks the replay to its event time. Publish highlights and offer a detailed event log.
- Replace browser-side kickoff, quick resolution, and manual training shortcuts in the player app. Accepted friendlies create a fixture through the same scheduling system. Keep wagers outside the pilot.
- Use original dark-slate scouting sheets with full attribute names, aligned numeric values, and restrained meters. Remove region badges and inferred region filters from player cards, squad, and draft views. Keep chips for meaningful state and use text or functional icons for routine actions. Check desktop, mobile, and keyboard flows.
- Keep domain modules cleanly separated as server implementations replace prototype logic.

**First release gate.** A scheduled fixture starts with both managers offline. A late spectator can follow it in either view, text and simulation agree, and a restart settles it once. Test overlapping kickoffs before publishing a broader calendar. Each retired shortcut is absent from the player-facing routes and cannot award a result or progression.

## Phase 3 — Money, auctions, training, and recruitment

- Rename **Treasury** to **Money**. Use in-game PHP (₱) for the Philippine market, with integer minor units and a server ledger for balances, wages, bid holds, and rewards. Configure currency by club market. Keep the pilot auctions in one currency market while cross-market settlement is designed.
- Replace buyouts and simulated bidders with timed auctions for eligible human managers. Publish opening bids, increments, and closing times. Reserve the leading bid, release outbid holds, and transfer ownership and payment atomically. Return unsold players to their clubs. Validate auctions against the lineup-lock rules so a sale cannot change an allocated roster.
- Add retry-safe jobs for auction close, weekly payroll and training, and scout intake. Use verified match participation for match-based training. Persist real scouting prospects on the server.
- Fill competition vacancies with bot clubs. Give bots the same fixture and roster legality rules. Bots manage orders and recruit through scouts, optional academies and the shared auction market. Use server review jobs with wage reserves, role needs and bounded bids. Keep youth academies optional and show startup costs and coach salary before activation.

**Exit gate.** Concurrent bids cannot overspend or double-sell a player. Job retries cannot duplicate payments, training, or ownership. Human and bot bids obey the same escrow/ownership rules. Both club types maintain eligible rosters through their allowed recruitment paths.

## Phase 4 — Annual circuit and Hexapedia

- Launch one real dated event with a fictional organizer. For example, **Signal Circuit** could run the **Manila Signal Open**. Expand to a published annual calendar with Tier 1–5 entry routes. Publish eligibility, registration and roster deadlines, format, tie-breaks, rescheduling rules, fictional sponsors, and funded rewards by placement.
- Use the same fixture system for leagues and cups. Derive bracket advancement and prize payouts from verified settlements. Check proposed match times against existing club fixtures before publication.
- Launch **Hexapedia** with linked player, club, organizer, competition, fixture, and results pages. Include each club's current identity, dated match records, and patch history. Keep private orders and scouting reports restricted to the owning club.

**Exit gate.** One event runs from registration through finals and pays each reward once. Test fixture conflicts and year rollover before opening more events. Hexapedia links each result to its match replay and text report.

## Verification and rollout

- For gameplay or squad UI implementation, update the [agent handoff](agent-handoff.md). Run `npm run check:game` and `npm run build` from `EsportsClash.Web`.
- Use Laravel tests and a two-account end-to-end rehearsal for permissions, clock boundaries, job retries, worker recovery, duplicate settlement, and concurrent operations. Check live spectator access separately from private club access.
- Treat the first release as one complete Philippine matchday. Money and auctions depend on verified settlement, and the wider annual calendar depends on fixture scheduling and worker capacity proven in that pilot.

## UI polish pass (8 November 2026)

The club workspace now uses short navigation labels, descriptive page headings, restrained panel borders, consistent forms and buttons, and underlined section controls. Redundant calendar and season pills and the prototype-credit balance were removed from the global header. Home identifies its local practice collection and directs managers to the official Matchday lineup. Squad profiles use a compact desktop attribute grid, full attribute names and responsive mobile rows. Routine labels use text or functional line icons. Player region labels were also removed from the practice training table.

Matchday separates Fixtures, Lineup & orders, Club identity and Friendlies. Opening coverage places the match/text report above the club tools. The signed-in account header is compact, saves give explicit confirmation, and Sign out revokes the current server token. The broadcast shows a readable match clock and actual winning club name, with recording identifiers under expandable details. Commentary separates timestamps from reports and retains exact recorded-frame seeking.

Money, scouting, the optional academy, auction listing and open bidding have clear sections and costs. Hexapedia separates competitions/results, searchable clubs, player profiles and release history. Fixture club links switch to the club directory and focus the selected record. Tournament rules remain available in an expandable schedule/rules section.

Verification covers the five primary screens signed out at 1440px and 390px, plus signed-in identity, five-slot lineup, friendlies, Money, club search and player profiles at 1440px, 390px and 320px. The rehearsal club's unchanged default lineup was saved through the UI. The completed replay, commentary seek, final-frame return and server sign-out were exercised in a disposable browser. Checked pages had no document overflow or runtime exceptions. Web game checks passed with 611 tests, 22 existing skips and three additional simulation checks; the production build passed. Local screenshots and proof are under ignored `.local-tools`. No worker image, catalog or backend schema changed in this pass. Concurrent-match capacity and wall-clock performance remain separate rollout checks.

## Pilot operating guide

### Public entry and next build sequence (8 November 2026)

The owner prioritized building the public product entry and deferred tests for this pass. The root URL now opens an original landing page with a management guide, a real upcoming fixture when available, and links to dedicated sign-in and registration pages. `#discover` exposes public Hexapedia. `#sign-in` and `#register` use the existing server account endpoints; successful authentication opens the requested club workspace or replay. Workspace routes require an account, and sign-out is in the shared header. Embedded account forms were removed from Matchday and cloud backup settings. The game workspace loads separately from the public pages. The production build passes; automated suites and runtime/browser reviews are deferred, so the earlier UI verification does not qualify these new flows.

Build next in this order:

1. **Guided club setup.** After registration, guide the manager through club name/tag, home city, crest, colours and jerseys, then confirm the starter lineup and show the next way to obtain a fixture. Reuse the server-owned club and identity endpoints.
2. **Authoritative club home.** Replace the practice collection summary as the primary dashboard with the signed-in club's actual roster, PHP balance, next fixture, order deadline, recent result and pending actions. Give practice tools their own clearly marked place.
3. **Competition centre.** Give managers one entry point for eligible tournaments, entry status, published rules/rewards, brackets and linked live/replay coverage, using the existing tournament/fixture records.
4. **Account recovery.** Add password reset and email verification to the backend and dedicated account pages. These are not implemented by the new sign-in form.

The existing concurrency/performance and live-tournament rollout checks remain deferred work. They are not represented as completed by this build-first sequence.

- Open **Play → Scheduled matchday** to create or open a club, set its identity and default lineup, manage fixture orders, and accept a dated friendly invitation. The server closes orders 15 minutes before kickoff. If submitted orders have become ineligible, it tries the legal default lineup. If neither lineup works, the fixture goes to review.
- Open **Market** for the PHP balance, human auctions, scout signings and the optional academy. The pilot opens a club ledger at ₱50,000. Auctions run for 24 hours with a ₱50 minimum increment. Scout signing costs ₱1,000 and can be used once per Manila week. The academy costs ₱3,000 to open and its coach earns ₱750 per week. Each verified fixture grants the participating player one training XP per started minute, posted on the next Manila weekly cycle. Training XP is shown on the player record.
- Open **Hexapedia** for club identities, player profiles, official results, and tournament registration. Authenticated spectators can open an eligible scheduled broadcast from its fixture record.
- Operators can publish a league fixture with `php artisan fixtures:schedule <home-club-id> <away-club-id> <ISO-8601-kickoff>`. The `--competition` option names the league. Pass Manila offsets explicitly, for example `2026-11-14T18:00:00+08:00`.
- Operators can publish a Manila Signal Open with `php artisan events:publish-manila <tier> <ISO-8601-first-semifinal>`. There is one event per tier and Manila calendar year. Lantern Relay funds ₱10,000 for the champion and ₱4,000 for the runner-up as in-game prize credits. The champion moves up one tier. The second semifinal is an hour after the first, and the final is one week after the first semifinal. Eligible bot clubs can fill open places when at least one human club registers.
- Operators can create a bot with `php artisan clubs:create-bot <tag> <name> --tier=5`. Its initial legal roster comes from the catalog scout pool. Existing weekly recruitment/lineup selection remains available. `world:tick` adds 15-minute reviews for legal lineup, surplus auctions, bounded bids and eligible event entry. Bots share the normal auction API/service rules.
- The scheduler runs `fixtures:lock-due`, `online:recover`, `market:close-due`, `events:advance`, and `clubs:weekly`. Use the rules-only catalog exporter to prepare the worker source manifest when deploying these changes. The API catalog and worker image must agree on the rules hash before kickoff.

## Local release record

- The pilot is available at `http://localhost:8088` under Play, Market and Hexapedia. All six migrations applied to the local PostgreSQL database after an isolated restore, apply and rollback rehearsal. The rehearsal preserved four existing club records, 20 player instances and two historical matches. The local backup is under the ignored `.local-tools/matchday-rehearsal` directory.
- The developer stack uses the `teamfight-online-worker:club-pilot-20261107` image. The previous worker image is retained. The rules-only export preserved the catalog content hash and the active API and worker were checked for rules agreement.
- The first league fixture is Taal Relay vs Pasig Array on Saturday, 14 November 2026 at 18:00 Manila. The Tier 5 Manila Signal Open closes registration on 20 November at 18:00, with semifinals on 21 November at 18:00 and 19:00, and the final on 28 November at 18:00. Three fictional bot clubs are available to fill open slots.
- Verification includes 20 Laravel feature tests with 185 assertions, the web game checks and production build, and a disposable browser check of the seven-attribute squad cards, matchday entry and published reference records at 390px. The feature tests cover kickoff time boundaries, duplicate processing, friendlies, auction escrow, bot permissions, training, bracket advancement and prize settlement. A disposable browser also loaded an actual saved worker snapshot and verified its clock, ordered event ticks and source-name redaction.
- The pilot uses a single PHP market and one match worker. Tournament publication is operator-managed. Training XP is a development record and has no combat stat modifier. Jersey customization uses presets for patterns, palette, crest placement, lettering and number styles. Playback seeks to the first recorded frame at or after the event tick. Simultaneous kickoff capacity remains a release check for wider rollout.

### Completed two-manager matchday rehearsal

Fixture 2, **Matchday Rehearsal 8004E9**, used two separately authenticated human test managers and an unrelated authenticated spectator. Both managers submitted owned legal lineups through the HTTP API. Both sessions were revoked at 22:56:19 Manila on 7 November, before the shortened rehearsal order deadline and scheduled kickoff at 22:58:28. The scheduler and worker started match `bafa247c-648e-41c8-8d56-0dc7c5d10c5e` at 22:58:37, a nine-second delay, without manager interaction. Normal published fixtures retain their 15-minute order window.

- The spectator opened the public live link and rendered authoritative frames. Closing the spectator socket triggered a successful reconnect from sequence 24 to 26. Selecting a tick-586 commentary event loaded replay sequence 41, the first capture at or after that event. The checked replay contained no internal `realName` fields. The browser reported zero runtime exceptions.
- The server verified the terminal result at 23:35:19 Manila, with a final sequence of 3,023 and a match clock of 25:11. Wall time from worker start to recorded settlement was 36:42. This proves offline scheduled execution and a complete result, but does not establish exact wall-clock playback speed or overlapping-match capacity on the development machine.
- Public standings contained one win and one loss. Repeating settlement with the stored worker result and invoking the polling job again preserved result hash `b59e6c35058d4ab761e3c8a57d40a327fba0341c0714191b2f6ddfac1b512cf6`. Exactly ten participation records remained, each with 26 XP pending the next Manila weekly cycle. No training was posted early.
- A fresh disposable browser opened the completed fixture's replay and report, rendered the final frame and winner, and displayed the saved commentary without runtime exceptions. All three rehearsal login tokens were revoked afterward. The labeled clubs and verified match remain as historical pilot evidence. Local scripts and machine-readable proof are retained under ignored `.local-tools/matchday-rehearsal`; credentials are excluded from these documents.

The live rehearsal covered the scheduled league path. Tournament advancement and one-time prize payments remain covered by the isolated feature tests; a full dated tournament has not yet played through on this local pilot. Broader launch still requires simultaneous-kickoff and sustained-capacity verification.
