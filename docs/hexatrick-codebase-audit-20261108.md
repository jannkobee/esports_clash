# Hexatrick codebase and document audit

Review date: 8 November 2026 (client calendar, Asia/Manila). This is a focused review of the management, competition, worker, reference UI and handoff boundaries, not an exhaustive security or gameplay-engine audit. Source and deployment observations take precedence over older phase-plan prose. Some newer repository entries and migration filenames use 9 November; those are recorded identifiers, not authority to advance the game clock.

## Implementation follow-up

The owner authorized the repairs after this audit. The [lifecycle repair record](hexatrick-lifecycle-repairs-20261108.md) describes delivered code, applied local migrations, worker hashes and remaining acceptance gates. Findings 1-3 and 5-9 now have implementation changes; the fresh live-match gate remains an observation to complete, and global currency/economy policy remains follow-up work. The original evidence below records the pre-repair state and must not be read as the latest source status.

## Current baseline — avoid rebuilding existing features

The latest checkout already includes:

- Hexatrick branding and the **Hexapedia** public reference name. `#codex` is canonical; older compatibility aliases remain documented separately.
- Unique rookie players with nationalities, original IGNs and portraits; bot management, bidding/listing and human takeover.
- Server-owned scheduled fixtures, immutable allocations/results, live/replay streaming and synchronized text.
- Annual competition snapshots, regional/international definitions, independent organizers, invitations, rankings and national-team infrastructure.
- Club inbox, read state, weekly finance/training reports, observed player development, career appearances/transfers/honors, organizer forms, The Wire and Hexacast.
- Five persisted staff roles and coach-led preparation; managers select players. Staff/coach choices are pinned into new allocations.
- Normal matchmaking with human priority and delayed eligible-bot fallback; a separate same-tier scheduled scrimmage queue.
- Transfer Exchange, reserve listings, player/cash trades and verified-stat-based rating/form support.
- Graphite/petrol/copper reference styling in `EsportsClash.Web/src/hexatrick-reference.css`, original geometric branding and leading icons.

Latest decisions are in the newest entries of [agent-handoff.md](agent-handoff.md). The earlier [world phase plan](hexatrick-world-phase-plan.md), [global competition report](hexatrick-global-competitions.md), [rookie report](hexatrick-rookie-world.md) and [calendar/media report](hexatrick-calendar-media.md) contain useful history but do not individually describe the entire present checkout.

## Highest-priority corrections and completion work

### 1. P1 — final-stat attribution conflates person identity and catalog archetype

Evidence: `infrastructure/online/browser-worker.mjs:127` finds a player's allocated slot with `candidate.card_id === champion.player.id`. `OnlineService::validatedStarters` (`app/Services/OnlineService.php:56`) requires five distinct **instance UUIDs**, not five distinct catalog definitions. `worldPlayerProfile.ts` deliberately preserves the template's internal ID while applying a person's profile. Transfers/scouting can therefore put two distinct people with the same archetype on one side.

Impact: both final-stat rows can map to the first instance UUID. `OnlineService::validatedPerformances` correctly rejects duplicate/missing instance IDs; a genuinely finished game can consequently fail API settlement. This is a code-path finding, not a claimed reproduction against a live manager's roster.

Finish: map final units to their exact immutable allocation slot using a genuinely unique side/unit/Avatar identity or an explicit instance binding. Preserve catalog IDs and old result contracts. Cover the duplicate-archetype case when testing resumes; never weaken the ten-unique-player settlement check to hide it.

### 2. P1 — default regional-champion qualification is not fully connected

Evidence: `CompetitionCalendar.php:133` reserves results-based `regional-champions` places without an `editions` source list. `CompetitionQualification.php` resolves results only from `$path['editions'] ?? []`. `CompetitionQualifiers::build` can create and bind geographic qualifier editions, but it requires the main event to have no invitations or entries. Normal edition processing already admits open-place bot entries.

Impact: the advertised regional-champion places cannot fill from default templates alone. A late manual qualifier setup can be blocked after ordinary registration begins. The existence of format/pairing code does not make the regional-to-global pathway autonomous.

Finish: resolve and freeze an explicit, capacity-balanced annual qualification graph before entry/invitation admission. Publish deterministic policies for absent regions and insufficient population. Use only real completed source results; do not turn missing champions into fabricated invitations or silently discard reserved pathways.

### 3. P1 — wildcard slots cannot safely be reused after expiry/rejection

Evidence: `CompetitionController.php:218–228` permits a wildcard slot when no pending/accepted invitation occupies it, but the subsequent insert omits `attempt`, leaving its default at 1. Migration `2026_11_08_000008` has unique constraints on `(tournament_id, slot_key, attempt)` and `(tournament_id, participant_type, participant_id)`.

Impact: inviting a different team into a previously expired/rejected slot can hit the old attempt-1 constraint. Re-inviting the same team encounters the participant constraint as well. The interface can present an apparently available slot and then receive a server error.

Finish: define a retained invitation-attempt/history model, increment attempts under the edition lock, and handle participant re-invitations explicitly. Keep prior responses/audit evidence. Do not remove uniqueness protections without replacing their concurrency guarantees.

### 4. P1 operational gate — complete one fresh staff-drafted live match

Observed local deployment: both `2026_11_09_000001` and `000002` migrations are applied; staff, trade and rating tables exist. The database contains three completed old online matches and one failed trial, `c998bf5b-6f36-4a66-846a-e5e7b1bcd5f5`, with recorded error **“Match worker time budget exceeded; no result awarded”**. There are zero persisted `club_player_match_ratings` rows. These observations do not establish that the latest staff worker caused that older failure.

Evidence: `browser-worker.mjs` caps the real execution loop at 45 minutes and rejects simulation clocks over 1,800 seconds. The latest handoff explicitly says that the current staff-drafted path has no completed new authenticated live acceptance run.

Finish: inspect the retained failed-run timing/recording evidence, establish the actual worker/source versions, then arrange an authorized fresh scheduled match and follow it through draft, match/text, verified finish, ten player ratings, training and idempotent settlement. Preserve failed history. Do not award a timeout/gold-lead winner or change protected combat/learning rules to get a pass. Single-worker overlapping-game capacity remains a separate concern.

## Important follow-up work

### 5. P2 — training settlement reads current staff rather than pinned staff

`OnlineService.php:375` calls `ClubStaffService::trainingBonusPercent($club)` at settlement, although allocation already stores `plan.staff`. That service reads the current staff table. If staff data changes while a match runs, earned XP need not correspond to the frozen match snapshot. Current staff has no ordinary hiring/editing flow, so this is chiefly a determinism gap to close before adding one. Derive the bonus from the pinned plan, with an explicit policy for historical plans that lack it.

### 6. P2 — weekly report recovery only considers the immediately previous week

`ClubOffice::weekly` always computes `startOfWeek()->subWeek()`. If processing is unavailable for several weeks, older missed reports never get created. Add bounded checkpoint recovery for weeks backed by real ledger/match records. Keep the actual generation timestamp; do not invent historic player-stat observations. Existing report snapshots remain immutable.

### 7. P2 — staff exists, but its management/economic lifecycle is unfinished

`ClubStaffService::ensure` supplies five persistent staff members and ratings. The API currently exposes the roster rather than hiring, renewal, replacement and dismissal flows. `ClubMarketService::weeklyWages` includes player wages and the optional youth-coach cost, but no salaries for the five staff roles. Decide and implement an explicit staff contract/economy policy, rather than describing the current fixed roster as a completed staff market. Do not alter approved draft/chemistry/training mechanics as an incidental UI change.

### 8. P2 — UI consolidation and report loading need a finishing pass

- The new theme styles `.pedia-hero`, while the current encyclopedia landing markup uses `.pedia-welcome`. Some intended visual rules therefore miss the actual header. Check current desktop/mobile layouts rather than inheriting historical screenshots as proof.
- `Avatarpedia.tsx` mounts `FixtureReport` inside every closed `<details>` row. The child fetches immediately, so a list can download every full event report before the manager opens one. Mount/fetch on expansion and consider paginated event logs.
- `authNavigation.ts:17` preserves match links but strips known inbox/report/world query parameters through sign-in. Extend the explicit allowlist, retaining open-redirect protection.
- The organizer form hardcodes `minimum: capacity`, offers an editable invitation slot number without showing occupied attempts, and defaults the edition scope to `main` even though the annual definition/year/scope tuple is unique. Provide minimum/fallback choices and visible slot/edition availability.
- The normal organizer setup now avoids raw JSON; technical regulation/admin displays still exist. Keep technical diagnostics out of ordinary manager decisions where a readable summary suffices.

### 9. P2 product completion — richer narratives and social/broadcast operation

`WorldMedia` currently publishes templates for actual results, edition status, live threads, HGR leaders and player appearance spotlights. It does not yet implement richer rivalry histories, fixture previews or observed-development emergence stories. These must reference actual records and retain simulated-archive provenance. Moderation endpoints exist; a complete moderator/report/block workflow, notifications/preferences and larger social operating policy remain unfinished. Hexacast is a match live/replay directory, not an external video-ingest platform; do not describe it as full Twitch infrastructure.

### 10. P2 product policy — global club economy still uses PHP

The current market, prize and report projections use PHP/centavos while the world supports several nationalities/geographies. That delivers the Philippine starting experience, but the earlier region-dependent currency request is not a completed global-currency system. Decide the shared market unit of account, regional display currencies and any conversion/rounding policy before implementing conversions. Likewise, review sustainable club revenue against player/youth/staff costs before expanding the financial simulation. Do not silently substitute real-world exchange rates or rebalance existing contracts as part of a presentation change.

## Documentation upgrades

1. Maintain one short current-state/release checklist that links to historical decision logs and names actual deployment proof. Avoid multiple old “next phase” sections presenting inbox, careers or staff as absent.
2. Mark earlier Avatarpedia/Clashbook names and old bot spending/retention policies as historical. Preserve compatibility URLs and immutable historical evidence.
3. Update launch status: the approved past backfill has completed **29 simulated games** (24 group games, four quarterfinals and the November 7 semifinal). The other semifinal is scheduled; the final is created only after that live result. The archive remains separate from rankings/rewards. Older “10/12 games complete” observations are historical checkpoints.
4. Keep migration/source, worker deployment and completed live verification separate. A successful build or feature test does not prove a new worker's full match lifecycle.

## Verification and scope of this audit

- Fresh `npm.cmd run build` succeeded: TypeScript plus Vite, 25.04-second bundling, with existing large-chunk warnings. Log: ignored `.local-tools/matchday-rehearsal/codebase-audit-build.log`.
- Read-only PostgreSQL observations checked migration status, archive status, inbox/report/development counts and the failed trial's recorded error. At the recorded management snapshot there were 14 inbox rows, four weekly reports and 228 development observations; queue counts are transient.
- Automated tests were **not** run in this audit, following the user's earlier defer-tests instruction. Earlier tests recorded by subsequent handoffs are historical evidence, not fresh results from this review.
- This audit did not modify gameplay, fixtures, rankings, staff, trades, player records, worker images or frozen artifacts. It did not initiate a new match. Build output is generated locally; substantive audit deliverables are documentation and a continuation prompt.

Recommended order: correct attribution and invitation attempts; connect annual qualification before admission; complete the fresh live-match gate; then finish report recovery, staff contracts, UI loading/navigation and factual narratives. Add another major subsystem only after these existing flows hold together.
