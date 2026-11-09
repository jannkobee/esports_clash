# Hexapedia (Avatarpedia compatibility)

**Current interface:** [8 November reference/UI rework](hexatrick-ui-reference-rework-20261108.md). The main component is Hexapedia.tsx; guide/laboratory/catalog are resource tabs inside Hexapedia. Nested routing is preserved and the duplicate Encyclopedia/Sparring switcher is removed. Older observations below remain historical.

**Hexatrick update (8 November).** The public reference now serves Hexatrick. Signed-in browsing uses nested `#codex/<category>/<id>` paths and retains the club shell; authenticated legacy public links normalize into that context. Visitors still use `#avatarpedia/...`. This supersedes the earlier single public-link behavior documented below. Original reference icons, saved crests and the classic theme are shared across these views.

`GET /api/v1/avatarpedia/world` now exposes durable public world events, read by both Club Home and the encyclopedia. The source records are real signings, listings, bids, transfers, lineup updates, tournament entries/titles and verified results. Bot clubs are explicitly allowed to participate in the same auction market; their 15-minute decision policy, activation and next phase are recorded in the [living-world plan](hexatrick-world-phase-plan.md). Older no-bot-market plans are superseded. Private balances/orders and unreleased model assets remain outside the public projection.

Avatarpedia is the shared public reference for Hexatrick. It replaces the Clashbook name and directory. The owner supplied Liquipedia examples for the main page, tournament calendars, event pages, participant rosters and player profiles. The implementation uses those information patterns with original branding, colours, layout and text. No real-world competition records, biographies, logos or photographs were imported. Automated access to the [reference page](https://liquipedia.net/leagueoflegends/Main_Page) returned HTTP 403; the supplied screenshots were the visual reference.

## Information architecture

- **Main page** — actual record counts, scheduled/live matches, recent verified results, tier-filtered events, standings and links into the encyclopedia.
- **Tournaments** — year-based directory and an article with organizer, sponsor, registration deadline, eligibility/rules, registered participants and current roster cards, published bracket, match schedule, winner and PHP prize table.
- **Teams** — published club identity, management type, home location, complete current-catalog roster, training XP, verified win/loss record, recent fixtures and tournament participation.
- **Players** — fictional public alias, published age/role/overall, seven attributes, current clubs, signature Avatars, verified appearances/wins/losses/minutes and linked results. Each active world player has one person UUID and one current owner. Catalog archetypes can be reused internally; they are not duplicate people. Historical allocations retain their original identities.
- **Coaches** — catalog profile, style/tier and published coaching attributes/bonuses.
- **Avatars** — current name/title, role/archetype/lore, base statistics, abilities (including associated invoked/library skills when published), signature players and verified appearances.
- **Items** — current published cost in Arena gold, stats, suitable roles and passive effect. Arena gold is distinguished from club PHP money.
- **Releases** — installed catalog identity, date, active status and exact rules/ruleset provenance. Installed releases are not presented as authored patch notes.
- **Organizers and sponsors** — fictional entities from the actual tournament definitions, linked to published events.

Articles have stable links, breadcrumbs, a contents rail, section navigation, an information panel and source metadata. On narrow screens the contents rail becomes an expandable menu and the information panel stacks above the article. Global search crosses all nine record categories. Category directories support searching and pagination. Match centre countdowns only describe the published kickoff; server state controls whether a match is live. Reference pages refresh every 30 seconds.

## Shared source contract

`AvatarpediaService` is the common public read projection, rather than a separately maintained copy of game data.

| Information | Authoritative records |
| --- | --- |
| World players, nationality and development | Unique `OwnedPlayerCard` identity/profile and recorded progress, projected against the active catalog |
| Catalog archetypes and signature bindings | Active `OnlineCatalog` |
| Club staff and terms | `ClubStaff`, retained paid contracts and immutable allocated staff snapshots |
| Avatar presentation/abilities and items | Active catalog plus the existing `GameContentService` projection |
| Team identity and current contracts | `OnlineClub` and `OwnedPlayerCard` |
| Tournament rules, dates and participants | `ClubTournament` and `club_tournament_entries` |
| Match schedule, score and winner | `ClubFixture` and verified completed `OnlineMatch` results |
| Historical allocations | Their existing immutable match plans and reports |

Operational edits continue through existing club, market, tournament and backoffice services. Avatarpedia reads their published outcomes. Private account information, balances, scouting details, orders, allocation seeds, unreleased model assets and source `realName` fields are not included in the public projection. A wiki article cannot start a match or change a combat rule. The only account action in the encyclopedia is tournament entry through the existing eligibility checks.

The landing page reads its fixture preview through `/avatarpedia`. The workspace sidebar, public navigation and footer use the new name. Player cards and official lineup names link to player articles; published club names link to team articles. Existing Avatar laboratory and catalog tools remain available as tools alongside the encyclopedia, backed by the same underlying content service.

## Routes

Public frontend entry is `#avatarpedia`. Direct article links use `#avatarpedia/<category>/<id>`, for example `#avatarpedia/tournaments/1`. Category links omit the ID. `#discover` remains a compatible entry point. Tournament registration preserves the article destination through the centralized sign-in flow. Replay links preserve their scheduled match ID.

- `GET /api/v1/avatarpedia` — main-page read model
- `GET /api/v1/avatarpedia/search?q=...` — global article search
- `GET /api/v1/avatarpedia/directory/<category>?q=...&page=...` — paginated directory
- `GET /api/v1/avatarpedia/articles/<category>/<id>` — linked article record
- `POST /api/v1/avatarpedia/events/<id>/register` — existing authenticated registration action

The old `/clashbook` read/registration URLs are aliases of the new controller, preserving older clients and saved links. There is one public read implementation. No schema migration or worker rebuild is involved.

## Current limits

The main page shows up to 30 pending/live fixtures and 30 completed fixtures from the last 30 days. Team articles show up to 100 recent fixtures; player/Avatar articles show up to 30 results, while their participation totals cover all completed scheduled matches. Directories paginate at 30 records. Global search shows up to five matches per category. These are bounded pilot read projections, not a claim of million-club search throughput.

Participant roster cards describe current contracts, not a reconstructed event roster history. Careers and transfer timelines use actual records; individual KDA/ratings require verified worker performance payloads. The Wire provides factual fictional coverage and manager discussions with content reporting/admin review. Invented historical biographies, external video ingest, public wiki editing and authored patch notes are not claimed. Avatar/model qualification remains under the existing Colab and visual-release gates. Existing appearance statistics are evidence of match participation, not asset qualification or pro-level controller performance.

Verification for this build pass is TypeScript/production build and PHP syntax checks. Automated suites and browser runtime/visual checks remain deferred at the owner's request. Earlier browser proofs do not qualify this new encyclopedia.
