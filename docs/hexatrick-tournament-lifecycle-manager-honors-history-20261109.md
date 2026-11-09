# Tournament lifecycle, manager honors and club match history — 9 November 2026

## Owner request and decisions

The owner requested visible starting and ended tournament editions, table categorization/sorting, Manager of the Year and Most Improved Manager, a club match history, and separation of Supporter Studio from Settings. This implements those requests without inventing results or changing competitive/gameplay mechanics.

## Tournament registry

`TournamentDirectory` supplies the same lifecycle projection to the Competition Hub and Hexapedia. Completed status is **Completed**; cancelled status is **Cancelled**; explicit review or an elapsed end date without completion is **Needs review**; a future start is **Upcoming**; otherwise an admitted event in progress is **Ongoing**. A registration deadline that passed without progression also needs review. Legacy start/end columns are normalized, with ISO timestamp serialization. Calendar dates alone never verify a tournament finish.

The Competition Hub uses the new public `/api/v1/competitions/directory` endpoint. Both surfaces support lifecycle category chips and complete-query search, tier/year scope, date/name/prize sorting and pagination. The hub has an All Years switch. Default order groups ongoing, upcoming, completed, review and cancelled editions. Counts describe the matching year/search/tier scope before the selected lifecycle filter, rather than only the visible page. Completed editions remain in the registry.

Observed current data: **33 editions, 32 upcoming, one ongoing launch exhibition, zero completed, zero review and zero cancelled**. The previous undifferentiated 30-row page hid the final three editions behind pagination; there are no confirmed completed events to recover or fabricate. Reading page two with 20 rows returns the remaining 13. The ongoing launch exhibition retains its simulation provenance and is excluded from official rankings/rewards.

Main files: `TournamentDirectory.php`, `CompetitionController.php`, `AvatarpediaService.php`, `AvatarpediaController.php`, `routes/api.php`, `TournamentEditionTable.tsx`, `CompetitionHub.tsx`, `Hexapedia.tsx`, `avatarpedia.ts`, `hexatrick-records.css`.

## Manager records and annual honors

Migration `2026_11_09_000012_manager_records_and_annual_honors.php` adds durable manager result receipts and annual award entries. `CompetitionRankings` dispatches `RecordManagerCareers` after the rating transaction commits. `ManagerRecordBook` accepts matching hashed, completed Nexus results from verified non-community club competitions with HGR receipts. It uses **blue_user_id/red_user_id pinned at allocation**, not the club's current owner. Each result/club receipt is unique. Repeat-opponent HGR no-op results remain recorded with counted=false and do not count toward manager eligibility.

`ManagerLaurels` adds two categories to the existing Hexatrick Laurels ceremony (second Saturday of January, 20:00 Manila for the previous calendar year):

- **Manager of the Year**: 65 × Wilson lower win bound + 20 × min(counted games / 40, 1) + 15 × min(max(net skill-rating gain, 0) / 400, 1).
- **Most Improved Manager**: positive net HGR skill-rating gain earned in the year while managing. It uses the underlying skill rating, separate from HGR achievement score.

Both require at least ten counted ranked games. Ties use wins, then permanent manager account ID. Up to five finalists per category are retained. Nomination refreshes are provisional; existing awarded ceremonies remain frozen. Final awards generate one idempotent Wire announcement if there are eligible recipients, with no money, XP or attribute reward. `world:records` catches up real manager receipts, and the existing hourly `world:laurels` refreshes nominations/ceremonies.

Hexapedia has a **Managers** directory and public profiles with original portrait, current published clubs, management results/history and awarded honors. Club infoboxes link their manager. Awards and Wire links open the corresponding manager record. Public projections contain names/IDs and records, not account email or authentication fields. The world records revision includes both player and manager receipt IDs.

Observed: **138 manager profiles, zero eligible manager receipts and zero manager nominees**; current 2026 Laurels remain nominations. Do not seed fake eligibility to populate these sections.

## Club match history

`#history` is a dedicated signed-in workspace page in the sidebar and Club Home. Its authenticated `/api/v1/online/history` endpoint scopes every fixture/archive lookup to the requesting manager's club. It includes past games, verified results, wins/losses, interruptions, upcoming games and all fixtures; filters cover game type, full-query club/competition search, inclusive Manila date range, sort direction and page size.

Large rows show the teams, competition/logo, scheduled time, actual state, recorded kills/duration and available Arena/report actions. Names prefer the allocated match plan; current crests are a fallback where historical art was not pinned. Verified summary wins/losses require completed status, source hash, a legal winner and opposing terminal Nexus destruction. A legacy completed recording with incomplete evidence is labeled separately rather than assigned a verified win.

**Launch archive** is a separate view; simulation outcomes never enter verified totals. Statistical exhibition resolutions attached to interrupted fixtures link to their own report while retaining the interrupted Arena recording. Archive `game` permalinks now open and scroll to the selected report.

Read-only examples: the owner's unconfigured RAT CITY's Club has no fixtures, verified results or archive games yet. Rosegate Rooks has one interrupted fixture and four launch simulations. The interrupted fixture is unresolved as an Arena result and links both recording `157691b0-c281-407d-8771-1d53dff55ed8` and statistical exhibition report 30. Search, November date range and tournament-kind queries retain this fixture; verified wins return zero.

Main files: `ClubMatchHistory.php`, `ClubHistoryController.php`, `ClubMatchHistory.tsx`, `WorldMedia.tsx`, `App.tsx`, `ClubHome.tsx`, `authNavigation.ts`.

## Supporter Studio

`#supporter` is a dedicated sidebar/workspace destination. The membership badge opens it directly. It contains membership benefits/status, themes, palette/density controls, player presentation and a link to club crest/jersey editing. Settings retains its account/audio/diagnostic responsibilities. Membership authorization, Signal/Beacon benefits, permanent owner membership, cooldowns and nationality restrictions are unchanged. The guide documents the new navigation and record rules.

This navigation supersedes the earlier location described in the first-deployment report; historical implementation descriptions are retained as evidence.

## Verification and limits

- Migration 000012 applied after retaining `.local-tools/hexatrick-before-manager-honors.dump` (**10,111,414 bytes**).
- Web production TypeScript/Vite build passes; existing large-bundle warning remains.
- All **48 changed/new PHP files** pass PHP syntax checking.
- Read-only HTTP inspections cover both tournament directories, full-query category counts, all-years completed scope, sorted second page, manager directory/profile, awards and public revisions. Authenticated service reads cover actual owner and interrupted-club history/search/date/type scopes.
- `world:records` indexed zero missing manager/player results; `world:laurels` refreshed actual nominations without manufacturing awards. No recent failed jobs were observed.
- A new route action initially caused an API boot error. Its declaration was corrected to an explicit controller action; the API and dependent PHP services recovered. No game was started or settled for validation.
- Per owner direction, no test suites or new simulation/test games ran. A native visual review was attempted using the computer-use skill; `sky.list_apps()` reports the native pipe unavailable (`os error 2`). Rendered/signed-in interaction is therefore **not visually qualified**. Positive eligible manager capture, populated yearly honors and a real future ceremony remain unverified until qualifying real results exist.
- The interrupted exhibition remains interrupted at sequence **3,472**, result null. No protected Nexus/all-three-barracks rule, scheduled gameplay, attributes, training, finances, qualification, ML/Colab/3D evidence or unrelated dirty work was changed by this task.
