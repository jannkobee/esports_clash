# Player dossiers, record book, Laurels and broadcast desk

Implemented 9 November 2026 following the owner's corrections and supplied UI references. This supersedes the forced-lowercase display policy in the preceding implementation record. Protected parody/original identities and historical match allocations are unchanged.

## IGNs and fictional personal information

The generator supports a mix of lowercase words, initial capitals, restrained internal capitals and short uppercase handles. Its default distribution is 40% lowercase, 50% initial capitals and 10% short uppercase/internal capitals. These are display styles, not separate identities: collision checks remain case-insensitive, with a maximum of three equal global IGNs and no same-club admission/customization collision. Beacon's editor now preserves the casing entered by the manager and accepts 3–14 alphanumeric characters, including a leading number. Reserved catalog aliases remain protected.

`world:records --enrich` corrected display casing only for untouched generated identities without a personal biography, `original_identity` or `name_customized_at`. It appended casing audit entries, preserved permanent player IDs, skipped manager-customized/protected names and spent no customization cooldown. It added 953 biographies and changed 551 display styles. Read-only verification found 402 lowercase / 551 non-lowercase active IGNs, zero missing active biographies and unchanged match history. `world:refresh-identities` no longer lowercases names. New admissions obtain the new generator styles automatically.

`WorldPersonBiography` generates persistent fictional names, a birth date already established by the world profile, birthplace, city/country of residence, languages, hobbies, trivia and introductory Q&A. Country-specific name/city pools use the existing nationality. No legal nationality, eligibility or international commitment changes occur. These details describe game characters, not the manager's personal information; no precise home address is collected or generated. Profile introductions are labeled as character introductions. Career claims require match evidence, independently of generated biography.

Hexapedia player dossiers now include personal facts, the original transparent portrait, large career metrics, a historical win baseline, team appearances, honors/finalists, match MVPs, personal bests, a paginated match book, trivia, an introduction/coverage section, a current portrait/club-crest gallery and record references. Published Wire coverage is linked through the player's permanent ID. No historical interview, news coverage, photo or award is fabricated to fill an empty section. Existing club-provided biographies are retained and labeled separately.

The historical win estimate appears after five verified appearances. It uses a Beta(2,2) baseline: `(wins + 2) / (games + 4)`, with a clipped approximate 95% uncertainty interval using the posterior variance. It is explicitly a historical baseline across the displayed recorded scopes, not a prediction of the next opponent or a guaranteed outcome. No private orders are published.

## Permanent match records

Migration `2026_11_09_000011` adds `personal_details`, `player_record_receipts`, `player_career_records`, `annual_award_editions` and `annual_award_entries`.

`RecordPlayerCareers` runs after successful settlement commits. `PlayerRecordBook.capture` requires a completed scheduled match, accepted result hash, actual destroyed opposing Nexus, duration and ten attributable performance rows. It uses pinned player/team identities and the accepted final statistics. Each immutable receipt is keyed to the match; each career row is unique on match/player. A changed result hash is rejected. Incomplete legacy evidence is never filled with guessed statistics. Where ten-player attribution is incomplete, a zero-player receipt can record that indexing was unavailable. Matches without verifiable terminal evidence are not indexed.

Stored fields include player/club/fixture/tournament IDs, names at the time, competition, role, scope, result, rating when available, duration, K/D/A, CS, gold, damage, match MVP, completion time and source result hash. Scopes distinguish ranked, scrimmage, community and exhibition. Launch statistics and interrupted recordings cannot become verified career records. Open/practice games without a scheduled fixture are excluded.

One match MVP is selected by accepted rating, then transparent result/contribution tie breakers (winning side, kills, assists, deaths, CS, damage), then permanent UUID. This is an original Hexatrick match accolade, not a real organizer's award. Community records remain separately scoped; this indexing creates no form, training, money, official points or annual competitive award entitlement.

Career totals query the complete record book rather than just the recent 100 ratings. Team history comes from recorded appearances; settled transfer history remains the contract source. Personal bests retain their source fixture and receipt. Lifetime winning-final honors are queried independently of the recent-game page, preserving the existing winning-final rule and preventing older honors disappearing after 100 further games. Membership of a winning club alone still grants no title.

Public endpoint: `GET /api/v1/avatarpedia/players/{uuid}/records` supports scope, year, competition search, 20/50 rows and pagination. Filtering happens before pagination. `world:records` performs a bounded backfill every 15 minutes; new completed games use their own queued capture job. Existing raw ratings, performance reports, training and result hashes are not rewritten.

Current database evidence has no complete eligible performance receipts. Therefore career statistics, personal bests and match MVPs are empty/zero, rather than copied from simulated launch history. The positive settlement/indexing/MVP path has not been exercised with a new game during this work.

## Hexatrick Laurels

The original annual event takes place on the **second Saturday of January, 20:00 Manila**, honoring matches completed during the previous January–December calendar year in Manila time. The 2026 ceremony is **9 January 2027, 20:00 Manila** (12:00 UTC). Current nominees are refreshed by `world:laurels` hourly; a due ceremony freezes final entries and their evidence. A year with no eligible players records that outcome without inventing recipients. The event is separate from annual tournament-program publication and changes no frozen competition edition.

Only accredited ranked, verified competition records with a recorded rating count. Community cups, scrimmages, ordinary exhibitions, interrupted matches and launch simulations are excluded. Each category requires ten eligible games.

| Category | Selection |
| --- | --- |
| Player of the Year | `60 × mean rating / 10 + 25 × Wilson lower win bound + 15 × min(games / 40, 1)` |
| Rising Star | Same season formula; age 21 or younger at calendar-year end |
| MVP Laureate | Most recorded match MVPs, then season score |
| Playmaker of the Year | Assists per game, then season score |

Up to five finalists are stored per category. Ties ultimately use the permanent player UUID. Final entries preserve the award-time alias and supporting counts; the UI also links the current name to the same identity. This is a published original rubric, not an imitation of external award voting. Tier/opponent-strength weighting and jury voting are not part of v1. Recognition grants no attributes, XP or money. An actually awarded ceremony publishes one idempotent Wire dispatch linked to its evidence; no announcement is posted for an empty nominee pool.

Open **Hexapedia → Laurels** (`#codex/awards`). The page shows the ceremony, eligibility, status, nominees/winners and scoring explanation, with an archive year selector. The current 2026 edition is in nominations with zero entries. No award has been created from historical simulation.

## Hexacast, HGR and information-rich rows

Hexacast has an original broadcast masthead, next/featured fixture, team crests, live-channel count, live/schedule/recording collections, search, tier chips and larger full-width rows. Rows show actual competition logos, kickoff, status, replay duration/final kill score when available, assigned crew faces and relevant actions. Crew appearances reference real assignments; no unassigned caster is invented. National fixtures link to national-team articles. The watch view retains the existing server-owned Arena and matching conversation. Viewer presence only reflects signed-in viewers who open a live channel. Interrupted recordings and launch exhibitions retain their original provenance.

The broadcast API now filters the full fixture query before paging, with separate schedule/replay totals and pages. Tournament and crew metadata are fetched in batches instead of one tournament query per row. There is no client kickoff, completion, fake live score or generated viewer audience. The initial read showed two upcoming channels and two available recordings.

CompetitiveRecord replaces the small HGR line with prominent score, global position, latest actual score movement, ranked appearances, provisional progress, annual circuit points and ranked titles. The next target explains the club's current tier promotion step and the published regional invitation path. Estimated skill uncertainty is labeled separately from HGR score. No HGR formula, eligibility or qualification rule changes were made. Unrated clubs remain honestly unplaced; ten appearances clear a provisional label, rather than constituting a new qualification requirement.

Hexapedia navigation is one wrapping rail containing main categories, Laurels, game guide, laboratory and catalog tools in the same style. Directory pages support complete-query tier/year/status/player-role/nationality filters and 20/30/50 rows. Rankings have team search, tier and established-record filters. Staff appointments have name/role filtering and larger person rows with faces, skills, salary and contract terms. Existing salaries, founding terms and contracts are preserved.

Every existing personality has a distinct Lucide icon and accessible name/description. Auctions, reserve previews, player directories and personality detail panels use the same `PersonalityMarks` component and canonical trait IDs. Staff, candidates, catalog coaches, Wire personalities, talent profiles and match crews use consistent original SVG faces through `PersonPortrait`; current paid candidate keys retain the same face after appointment. These are 2D people portraits, separate from the protected 3D Arena-avatar pipeline.

The auction board previously fetched at most 100 rows and searched only those. `AuctionDirectory` and `GET /online/market/auctions` now filter/search/sort the complete active listing query and return 20/50-row pages. Role, nationality, personality, skill band, ownership and sort all apply on the server. Effective-overall sorting/filtering follows the current raw-stat/training-step/potential formula and the actual 1–10 display boundaries (including 88/95). The balance/reserve desk avoids fetching an unused extra 100-row auction list. Read-only inspection found **131** matching listings, 20 on each requested page, correctly ordered effective overalls and a personality filter matching all returned rows. The old hidden tail is now accessible.

Record and award revisions participate in the shared public WebSocket/cache invalidation scheme. Hexapedia, open record books and Laurels refresh on the relevant topics. All actual game state, accepted results and settlement remain backend-owned.

## Files and verification

Core backend: `WorldPersonBiography.php`, `PlayerIgnGenerator.php`, `PlayerPresentation.php`, `PlayerRecordBook.php`, `RecordPlayerCareers.php`, `AnnualLaurels.php`, `AuctionDirectory.php`, `PlayerRecordsController.php`, affected public/market controllers, `CompetitionRankings.php`, `PlayerCareer.php`, `WorldRevisionController.php`, model casts/relations and scheduled commands.

Core frontend: `PlayerDossier.tsx`, `AwardsHall.tsx`, `CompetitiveRecord.tsx`, `PersonalityMarks.tsx`, `PersonPortrait.tsx`, `WorldMedia.tsx`, `TransferAuctionBoard.tsx`, `ClubStaffRoom.tsx`, `Hexapedia.tsx`, shared types and `hexatrick-records.css`.

Migration 000011 applied after saving `.local-tools/hexatrick-before-dossiers.dump` (9,762,339 bytes). Production TypeScript/Vite build and touched PHP syntax pass. Read-only HTTP and service inspection confirmed biographies, dossier fields, zero invented statistics, paginated full-dataset filters, PH nationality scope (104 profiles), Tier 1 registration scope (six editions), broadcast metadata, empty valid Laurels nominations, no recent failed jobs and the preserved interrupted match at sequence 3,472 with result unset.

Automated suites and new test matches remain skipped per owner direction. Computer-use skill/browser review was attempted; native pipe and browser host were unavailable, so desktop/mobile visual and signed-in interaction acceptance are not claimed. Non-empty annual nominations/ceremony, new verified MVP/receipt settlement and full 50,000-manager throughput remain unqualified. Existing large Babylon/application build chunks remain a warning. No protected gameplay, learned-controller, frozen ML, cloud-generation/rigging, 3D artifact or historical allocation was changed.
