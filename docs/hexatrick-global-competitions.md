# Hexatrick global competitions — implementation and rollout

Owner direction: 8 November 2026, Asia/Manila. The supplied competition brief initially described football. The owner explicitly selected **keep the existing Arena game and adapt the competition system**. Five distinct owned players and five legal Avatars, real Nexus finishes, immutable allocations/results and the existing replay/text pipeline remain authoritative. Football goals, formations and in-match substitutions have not been invented.

The subsequent owner instructions require one world identity per player and bot-managed clubs that humans can inherit. For pre-existing copies, the owner selected: **the earliest human owner keeps the original identity; other copies become original players, preserving their contracts, training and historical reports**.

## Audit and architecture

The application uses Laravel 13/PHP 8.3, PostgreSQL, database queue/scheduler, Sanctum, React 19/TypeScript/Vite and the existing private Arena match worker. Before this task, `ClubTournamentService` implemented a four-club Manila Signal Open through `club_tournaments`, entries and `club_fixtures`. `LockClubFixture`, `OnlineService::allocate/settle` and `PollOnlineMatch` already provided the authoritative scheduled Arena pipeline. National teams, invitation snapshots and world rankings did not exist. `TournamentView.tsx` was an unused local practice prototype; it is not the new competition authority.

The implementation extends those tournament/entry/fixture tables. New editions reference `competition_definitions`; historical four-club cups retain their existing paths, IDs and results. The server selects the appropriate progression service using the edition's definition ID. There is no frontend official kickoff or frontend result-authoring endpoint.

New services: `CompetitionCalendar`, `CompetitionEngine`, `CompetitionPairing`, `CompetitionQualification`, `CompetitionQualifiers`, `CompetitionRankings`, `GlickoRating`, `CompetitionAdministration`, `NationalTeamService`, `WorldPlayerIdentity` and `BotPopulationService`.

## Persisted features

- Actual UTC calendar years and current-year admission; configurable inaugural year, schedules and protected international windows. Missed events are skipped; partial launch years require an explicit flag. Default championship identities are Vanguard Cup, Summit Masters, Crown Championship and the annual Nations Cup. Definitions are data; editions preserve their own regulation version, sponsor list and qualification paths.
- Shared club/national formats: single elimination, double elimination with two-loss elimination and reset when required, round robin, Swiss without silent rematches, groups, open elimination qualifiers and ordered multi-stage compositions. Regional qualifiers use balanced bounded shards. Invalid or impossible draws/calendars enter review rather than generating fabricated outcomes.
- Group standings use Arena wins, a head-to-head mini-table, opponent wins and published seeding. The 48-nation format selects 24 top-two finishers and eight best third-place finishers, with cross-group comparison and deterministic no-same-group first-round matching. Optional geographic group limits are supported. The supported published fallback national sizes are 8/16/32/48.
- HGR and HNR use separate persisted Glicko-2 records and result receipts. Match skill and capped recent achievements contribute comparable 0–1000 components, initially weighted 70/30. Only accredited ranked editions contribute; money and sponsorship do not. Opponent repetition is capped, new clubs are provisional, inactivity affects the materialized score, and HCC points remain a separate annual table.
- Frozen ranking snapshots are created with database-side window queries, not full-population PHP arrays. Invitation slots, attempts, responses, rejection/expiry/withdrawal and roll-down are serialized under the edition lock. Entrants retain their exact source. Ranking, verified competition results, open entry, published wildcards and configured automatic placement are separate methods.
- Geography is a persisted continent → region → country → subregion hierarchy. Qualification filtering follows ancestry. Seed associations are configurable data, not country-specific game rules. Administrative qualifier publication partitions a declared geographic pool into independent brackets and connects their real champions to reserved finals places.
- Organizer registration, ownership checks, verification and definition approval; published sponsor information, bounded invitation rules and audit records. Ranked accreditation requires administration. Prize pools for new club events are paid from actual club escrow; completed prizes and cancelled-event refunds have unique ledger references.
- National associations are separate from club ownership and auctions. Nationality is explicitly verified against an owned player's identity; existing imported players' nationalities are not guessed. National squads reference existing players, with a configurable roster limit, captain and legal starting five. They lock at the published deadline. Manager applications, appointments, replacement, resignation, tenure and inactivity monitoring are persisted. Automated legal selection covers unattended nations; a nation without enough eligible players is held for review.
- Shared player reservations enforce non-overlap and a configurable recovery interval. National fixtures use the same Arena allocator with national identities and nullable club-user participants. National wins create HNR and international appearances/commitments, not HGR for the supplying clubs. No player is transferred to a national team.
- Annual historical snapshots use the last recorded rating event before the UTC year boundary. Finalization waits for unfinished/reviewed editions, preserves annual champions and does not reset ongoing ratings.
- World players have one stable owned UUID, unique public name and one current contract. Catalog definitions now serve as reusable skill/role archetypes, not duplicate public people. Persona names are pinned in new match plans. Legacy reports/plans remain unchanged. Player articles, market listings, official Squad and Club Home resolve the owned identity. Original parody aliases, including Cardrel, are retained for their canonical person.
- New human accounts inherit an available bot club transactionally, including its roster, finances and tournament entries. Clubs with locking or active matches are excluded from adoption. Existing human clubs may replace explicitly bot-filled open places before lock. Earned qualifier places are protected. Bot creation/population is bounded and uses unique original people.

## Migration and local activation

Applied additive migrations:

1. `2026_11_08_000008_extend_global_competitions.php`: definitions, geography, organizers, national associations/terms/eligibility/squads, fixtures/stages, result/rating receipts, snapshots/invitations, points, appearances, windows, settings and audits.
2. `2026_11_08_000009_unique_world_players.php`: unique persona/original-identity columns and club-manager history.
3. `2026_11_08_000010_create_competition_year_records.php`: permanent annual finalization records.

These migrations deliberately refuse a destructive automatic rollback of permanent history. Restore/reconciliation must be reviewed as a data migration.

Before activation, the local world had 54 owned players, 10 clubs, 3 bots and no active matches/reserved default jobs. A PostgreSQL custom-format backup was retained at ignored `.local-tools/matchday-rehearsal/hexatrick-competition-pre-migration-20261108.dump`. Identity migration retained 6 original identities and assigned 48 new identities. Population created 29 additional bot clubs, reaching 32. Subsequent real scheduled world recruitment brought the observed total to **228 players, 228 distinct names, zero unnamed records**, with 39 clubs and 9 national associations. These are operational records, not synthetic load fixtures.

Competition processing is enabled locally with **2027 as the inaugural year**. Current real year remains 2026. Four official championship definitions are installed; zero fabricated 2026 HCC editions were created. The existing 2026 Manila Signal Open and historical matches remain in place. No future year was advanced early.

The identity-only Arena adapter image is `teamfight-online-worker:world-identities-20261108`, derived from the existing pilot image. `infrastructure/online/Dockerfile.identities` replaces only the adapter file; the inherited engine/catalog/rules remain unchanged. The development Compose override selects this image. Activation occurred with zero active matches. ML, avatar, Colab and visual qualification services were not rebuilt or restarted.

## Player-facing interfaces and shared reference

Play → **Competition world** provides the championship registry, actual calendar, rankings with geography filters, national associations and their player pools, squad registration, organizer submissions and administration. Edition pages display actual participants, qualification sources, standings, fixtures and Arena/report links. National managers can select players and Avatars rather than enter generated player IDs. Organizer/administrator regulation editors are operational configuration forms.

Avatarpedia now includes national associations and shared edition/national views. World player directories and profiles use owned identities. Official Squad opens the server lineup; the official Training view now uses actual server development records; the old local roster/evolution controls are removed from ordinary Squad navigation. Club Home displays HGR/HCC/titles and links invitations. Public projections omit private nationality evidence, account credentials and unpublished lineup orders.

Main public routes under `/api/v1/competitions`: index, geography, rankings, edition records and national records. Authenticated routes cover `mine`, entry/withdrawal, invitation responses, manager applications/resignation/squads, organizer/definition submission, edition creation, wildcard invitations and prize funding. Owner-only routes provide settings, initialization, geography, nationality verification, qualifier publication, bot population and moderation/operational records. Full route definitions are in `routes/api.php`; authorization is enforced in the controller/services, not just hidden controls.

## Worker operation

- `competitions:install`: idempotently install original templates and default geographic associations.
- `competitions:year [--partial]`: admit only future editions in the actual current year.
- `competitions:tick`: minute recovery/admission, invitation expiry, manager monitoring and per-edition queued progression.
- `ProcessCompetitionEdition`: retryable, unique/overlap-protected per-edition work, shared match results and automatic progression. Expected invalid states become auditable review records.
- `RefreshCompetitionRatings`: daily paged materialized-score refresh, 500 rows per queued continuation.
- `FinalizeCompetitionYear`: retry-safe historical finalization after the real year ends, with separate HGR/HNR snapshots.
- `world:players`: safe identity admission/migration under the catalog lock.
- `world:populate --target=32`: bounded bot admission and open-place filling. Use small operational batches for larger populations.

Routine edition and population work use the default worker/scheduler. Large immutable snapshots and annual finalization use the dedicated competition-rankings worker (900-second jobs, 1,500-second retry lease), so million-row snapshots do not exceed the normal match/job timeout. Match concurrency remains the capacity of the deployed trusted worker; fixture intervals are configurable. No synthetic match results are used in the live world.

## Verification and limits

The new brief explicitly resumed testing. The combined competition/online suite passes **41 tests, 477 assertions** on SQLite. It covers real years, rollover/leap dates, midyear launch, Glickman's published numerical example, Swiss/round-robin pairing, 48-nation third places, actual allocation/verified settlement for bracket and national fixtures, idempotence, HGR/HNR separation, frozen invitations and roll-down, ownership/security, unique identities, bot adoption/replacement, player conflicts and annual history. The synthetic partition test represents 1,000,000 and 5,000,000 clubs with bounded allocation and exact population preservation; it is not a million simultaneous-match benchmark.

The rating implementation follows [Glickman's Glicko-2 reference algorithm](https://glicko.net/glicko/glicko2.pdf). The numeric match-period implementation is tested; predictive tuning of the 70/30 composite and achievement policy still needs competition data.

The full operational request is broader than the currently qualified deployment. In particular:

- Regional source editions, slot policies and independent schedules must be published/configured before their finals can issue real results-based invitations. Administrative qualifier generation is implemented; a fully autonomous worldwide geography/population/apportionment policy is not silently invented.
- UI/API integration and automated bracket/national tests do not establish a completed live full-year circuit or live Nations Cup. Nations with missing eligibility cannot receive fabricated players or results.
- No new injury simulation, in-match player substitutions or football formations were added to the protected Arena engine. Availability currently uses registered eligibility, commitment and recovery reservations.
- The deployed one-match worker is not qualified for millions of concurrent clubs. Database snapshot/partition checks and bounded jobs are scalability building blocks, not a production capacity claim. Horizontal match-worker admission and adversarial concurrency/load qualification remain necessary.
- Advanced manager elections, optional third-place matches and detailed individual national awards are not complete product flows. Manager appointment/moderation, international appearances, wins and championship histories are implemented.
- Existing historical avatar encyclopedia statistics still use the older read projection; a complete materialized analytics pipeline for every avatar/article remains separate work.

Do not present these remaining product/capacity items as finished merely because the schema, UI or job exists. Preserve the rollout backup and source hashes, frozen Arena/ML/avatar artifacts and all historical IDs.

## Follow-up verification and rookie extension

Supporting query indexes in migration 000011 were applied. A separate guarded PostgreSQL check materialized 100,000 ranking rows in 5.683 seconds and 1,000,000 in 60.368 seconds, with no additional measured PHP allocation and a 28 MiB PHP peak. This prompted the separate ranking queue/longer retry lease. The PostgreSQL historical JSON/window path executed successfully. The disposable database was dropped after measurement; no synthetic records entered the live database. The standard TestCase guard still forces SQLite and was not weakened.

The latest roster, nationality, IGN, prospect-signing and bot-policy changes are in [the rookie-world record](hexatrick-rookie-world.md). They supersede keeping the six original public identities active, while preserving their immutable history. Application criteria/periods and definition revisions now have configuration/authorization; previously published edition rules remain unchanged.
