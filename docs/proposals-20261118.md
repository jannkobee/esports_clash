# What to build next: proposals (18 November 2026)

> **Status (18 November 2026):** all twelve proposals and the quick wins are implemented, with the owner's answers to the open questions. See [the implementation record](manager-loops-20261118.md) for what was built, what was decided and what is not yet deployed.

A review of Hexatrick from the manager's side: what a manager decides, what they see afterwards, and what brings them back. It ranks what to build next.

## How this was produced, and what it does not cover

- **Method.** I read the source and the records in `docs/` on 18 November 2026. I ran no tests, rendered no screens, queried no database and watched no match.
- **Verified** means I read the code path. **Assumed** marks anything inferred: an estimate from a formula, a guess about population, or behaviour I did not reproduce.
- **Rules.** The constraints I checked against are the standing invariants in `AGENTS.md`:
  - Parody aliases and protected identities stay.
  - Private DNA is never shown. Scouting uses whole 1–10 levels only (`fpsScale10`).
  - Information is lawful: observed team categories stay empty until their thresholds are met.
  - Managers choose T/CT positions; suggestions stay drafts until saved.
  - Tendencies affect decisions only.
  - Supporter is cosmetic only.
  - No result is ever fabricated.
  - Asset processing stays Colab-only.
- **Paths.** `API/` means `EsportsClash.Api/` and `WEB/` means `EsportsClash.Web/src/`. Many source files are written as very long single lines, so a line number can point to a long line.
- **Loops.** Each proposal names the loop it belongs to:
  - **Matchday:** orders, kickoff, watch, result, learn.
  - **Development:** play, earn XP, improve.
  - **Squad building:** find, sign and sell players.
  - **Club business:** cash, wages, staff and sponsors.
  - **Season:** enter competitions and move between tiers.
  - **Return:** the first week, and what brings a manager back.
  - **Supporter:** paying for presentation.

## 1. State of the game

**What is strong:**

- **Matchday infrastructure.** Fixtures are server-owned. Allocations are immutable and settlement is idempotent. A two-manager rehearsal started and settled once with both managers offline (`docs/club-management-phase-plan.md:158-165`).
- **The match engine.** Official matches run on a deterministic live 3D engine. They are simulated ahead and aired as replays that never spoil the result (`docs/fps-official-live-engine-20261118.md`).
- **The world.** Bots follow the same market, escrow and fixture rules as humans (`API/app/Services/ClubMarketService.php`, `BotClubManager.php`).
- **Navigation.** The new layout leads with derived "Needs your attention" items (`WEB/components/home/HomeSections.tsx:12-36`).

**The three biggest gaps:**

1. **The result loop is broken or thin for FPS matches.**
   - Several services still verify a winner by the MOBA-era `terminal_nexus` field, which FPS results do not carry. As a result:
     - The Results page counts FPS games as unverified (`API/app/Services/ClubMatchHistory.php:9`).
     - The public report reads a missing key (`API/app/Http/Controllers/Api/V1/WorldMediaController.php:118`).
     - Manager honors ignore FPS games (`API/app/Services/ManagerRecordBook.php:12`).
   - Fixture rows never say who won (`API/app/Http/Controllers/Api/V1/ClubFixtureController.php:24-44`, `WEB/components/matches/FixtureBoard.tsx:77`).
2. **Few of the manager's decisions have a visible effect.**
   - The training-focus options are stored but never read (`API/app/Services/FpsIdentityEngine.php:169-171`).
   - Growth is a uniform +1 to all six attributes (`API/app/Services/WorldPlayerProfiles.php:136-141`).
   - Most staff ratings feed MOBA-era coach values that the FPS engine does not read (`API/app/Services/ClubStaffService.php:91-117`).
   - Fixture orders are only a lineup, and the map is drawn after orders lock (`ClubFixtureController.php:61-63`, `API/app/Services/OnlineService.php:310`).
3. **Little brings a manager back, and little is at stake.**
   - There is no email and no account recovery (no `API/app/Mail`, `API/app/Notifications` or password-reset route).
   - Opening cash is ₱50,000 against a rookie payroll of a few hundred pesos a week (`ClubMarketService.php:11`, `WorldPlayerProfiles.php:105`).
   - Tiers only promote (`API/app/Services/WorldPyramid.php:61-66`).
   - Supporter cannot be bought (`WEB/components/SupporterStudio.tsx:29`).

## 2. Proposals

They are ranked by value: how many managers are affected and how often, how broken the area is today, and the size of the work. Fixes that later proposals depend on come first.

### P1. Every result says who won, by how much, and counts toward records
**Loop:** Matchday · **Size:** S

**Problem (verified):**
- **No outcome on the rows.** `/online/fixtures` returns a status but no winner, score or map (`ClubFixtureController.php:24-44`).
  - Fixtures shows "Final · 2 days ago" (`FixtureBoard.tsx:77`).
  - Home's recent results show "A vs B" and a Report button (`WEB/components/ClubHome.tsx:99-101`).
  - The manager has to open the report to find out whether they won.
- **Results page.** `ClubMatchHistory::verified()` requires `terminal_nexus` (`ClubMatchHistory.php:9`). The FPS worker's result has no such field (`infrastructure/online/fps-match-worker.mjs:134-143`). So:
  - Every FPS game is left out of "Verified games", "Wins" and "Losses".
  - Every FPS row is labelled "Legacy recording · completion evidence incomplete" (`WEB/components/ClubMatchHistory.tsx:20`).
  - The score column reads `blueKills`/`redKills` (`ClubMatchHistory.php:34`), but FPS reports carry `finalScore` (`WEB/fps/fpsOfficialLiveMatch.ts:31`).
- **Public verified report.** It reads `$m->result['terminal_nexus']` with no fallback (`WorldMediaController.php:118`). Laravel turns an undefined-key warning into an exception, so FPS reports most likely return HTTP 500. *Assumed:* inferred from the code, not reproduced; no test covers `/world/reports`.
- **Manager honors.** Manager of the Year and Most Improved return 0 for any result without a Nexus finish (`ManagerRecordBook.php:12`), so FPS games never count.
- **The fix already exists elsewhere.** `CompetitionEngine.php:44-48` and `PlayerRecordBook.php:18-22` already branch on `MR15_TACTICAL_FPS`.

**Proposal:**
- Every result row says "Won 16–11 on Fontessa" or "Lost 12–16 on Spillway".
- The Results totals count real FPS wins and losses.
- The report opens.
- Honors count the games the manager actually played.
- Technically: one shared PHP "verified winner" helper, reused by the five places above, and a fixture payload with `outcome`, `score` and `map`.

**Why it matters:**
- Clarity and trust, for every manager.
- P2, the Wire and the honors depend on it.

**Main files:**
- `ClubMatchHistory.php`, `WorldMediaController.php`, `ManagerRecordBook.php`, `ClubFixtureController.php`.
- `FixtureBoard.tsx`, `ClubHome.tsx`, `ClubMatchHistory.tsx`.
- New FPS cases in `OnlineTest`/`CompetitionTest`.

**Dependencies and risks:**
- **Rule: never fabricate results.** The helper must still require `result_hash` and a valid FPS report (round 16, map, winner). It must not loosen the check, and legacy results keep the Nexus path.
- Counting past FPS games toward honors is an owner decision (see Open questions).

**How we would know it worked:**
- The Results "Verified games" count equals the completed FPS fixtures in the database.
- `/world/reports` returns no 5xx.
- Fewer reports are opened only to read the outcome: report opens per result fall while replay views hold.

### P2. A post-match debrief that ties the result to the manager's choices
**Loop:** Matchday · **Size:** M

**Problem (verified):**
- **What the report shows today** (`WEB/components/FixtureReport.tsx:15`):
  - The winner, duration and timestamps.
  - "Total kills" (null for FPS, so "Not recorded").
  - A player table with an **Avatar** column.
  - A raw event log.
- **What already exists:**
  - The worker produces, per player: kills, deaths, assists, ADR, headshot rate, plants, defuses, first bloods, trade kills and clutches (`fps-match-worker.mjs:114-129`).
  - The report has half and overtime scores and round results (`fpsOfficialLiveMatch.ts:31`, `:135`), plus an aggregated `behaviorSummary` (`AGENTS.md`).
- **What is lost.** `WorldMediaController::report` passes on none of this (`:113-118`).
- **The result.** A manager cannot tell why they lost, or whether their roles and instructions did anything.

**Proposal:**
- **Score.** The scoreline by half and overtime.
- **Round strip.** How each round was won (elimination, bomb, defuse, time), with pistol and eco rounds marked. Each round links to its time in the replay.
- **Player line.** K–D–A, ADR, opening duels, trades, clutches and the Hex rating.
- **"Your plan in this match".** The gameplan, positions and instructions that were pinned, and what was observed. For example, "your entry took the first duel in 9 of 15 T rounds".

**Design decision: who sees the plan.**
- **Option A.** Everything in one public report.
- **Option B.** Public stats; the plan and observed behaviour only for the owning club.
- **Recommend B.** The phase plan keeps private orders and scouting with the owning club (`docs/club-management-phase-plan.md:107`).

**Why it matters:**
- Decision depth. Experienced managers can tune; new managers learn what the roles do.
- It gives the Wire facts to report.

**Main files:**
- `WorldMediaController.php`, or a new club-scoped report endpoint.
- `FixtureReport.tsx`, `WEB/fps/fpsMatchViewModel.ts`.
- Replay seek in `FpsOfficialBroadcast.tsx`.

**Dependencies and risks:**
- Needs P1.
- **Rule: private DNA and the 1–10 scale.** Show counts and whole levels only, never DNA or raw tendencies.
- Keep `behaviorSummary` aggregated (per-observation events once made 10 MB reports).
- Build the report from the stored result, not from replay chunks, which expire after 30 days.

**How we would know it worked:**
- The share of completed fixtures whose owner opens the debrief.
- The share of managers who change their gameplan or instructions within 48 hours of opening one.

### P3. A guided first week
**Loop:** Return (new managers) · **Size:** M

**Problem (verified):**
- **Sign-up drops the manager straight into the workspace.**
  - Registration redirects there with no setup step (`WEB/components/AuthenticationPage.tsx:29`).
  - The manager gets either a new club named "<name>'s Club", with no tag, in Tier 5, or an inherited bot club (`OnlineService.php:43`, `:52-54`).
- **The first screen is a warning.**
  - Players start with no T/CT positions (`AGENTS.md`, architecture v4).
  - So the first Home shows "Your starting five is not ready" (`HomeSections.tsx:31-34`).
  - The fix is ten dropdowns inside a dense tactical editor (`WEB/components/FpsTacticalSystemEditor.tsx:56-91`).
- **The first competitive game is far away.**
  - Live fixture orders close 105 minutes before kickoff (`API/app/Models/ClubFixture.php:40-44`).
  - Quick match pairs only humans in the same rating band (`docs/agent-handoff.md:443`).
  - This week's Division Trials close entries on Wednesday at 18:00 Manila and start on Friday (`WorldPyramid.php:40-50`).
  - *Assumed:* with few humans in a band, a new manager may wait days for a first official game.
- **Never built.** "Guided club setup" was build priority 1 on 8 November (`docs/club-management-phase-plan.md:135`).

**Proposal:** a first-week checklist on Home, not a modal wizard. Each step ticks off from real data:
1. Name, tag and crest, using the existing identity editor.
2. "Suggest roles from strengths", which already exists (`FpsTacticalSystemEditor.tsx:56`). Two sentences explain T and CT; then the manager reviews and saves.
3. Watch your five now, in the existing 3D practice scrimmage, which has no career effects (`WEB/App.tsx:372-387`).
4. Book a scrimmage or join quick match.
5. Enter this week's Division Trials and answer the community cup.

It ends with "Your first official match: Friday 18:00".

**Why it matters:**
- Retention of new managers.
- It shortens the time to a first match that counts.

**Main files:**
- `HomeSections.tsx`, `ClubHome.tsx`.
- `ClubIdentityEditor.tsx`, `FpsTacticalSystemEditor.tsx`.
- Optionally a small `/online/onboarding` projection.

**Dependencies and risks:**
- **Rule: managers choose the roles.** Suggestions stay an editable draft until the manager saves; never auto-save them.
- An inherited bot club arrives with history and maybe fixtures, so the checklist must start from that club's actual state.
- Benefits from P7, which covers entry deadlines.

**How we would know it worked:**
- The share of new accounts with a ready five within 24 hours.
- The median time from registration to the first completed official match.
- How many new managers return on day 7.

### P4. Development the manager steers
**Loop:** Development · **Size:** M

**Problem (verified):**
- **The development focus does nothing, and costs something.**
  - The tactical editor offers "Development focus: Rifling practice, Sniping practice, …" (`FpsTacticalSystemEditor.tsx:91`).
  - The choice is written to `attribute_practice` (`FpsIdentityEngine.php:169-171`), and a repository-wide search finds no reader.
  - Choosing it also stops system-familiarity growth, which *is* read (the `else` branch). So it is worse than no choice.
- **How players actually grow.**
  - Steps are `floor(sqrt(earned XP / 40))`, and each step adds +1 to all six attributes (`WorldPlayerProfiles.php:136-141`; `API/config/world_players.php`).
  - XP is the minutes played, plus up to 15% from the performance coach, and only the five allocated starters earn it (`OnlineService.php:398-405`). **Reserves never develop.**
- **Too slow to see** (*assumed:* about 35–45 XP per match, from the 41-minute average broadcast in `docs/fps-official-live-engine-20261118.md:82`):
  - +5 on every attribute takes about 25 matches. On the 1–10 display that is usually one level, once.
  - A Tier 5 rookie (attributes 18–36) is about 15 levels' worth of steps below Tier 3's founding rosters (40–56, `WorldPyramid.php:24`).
- **Nothing to decide.** The Training page is a read-only table (`WEB/components/ClubTrainingView.tsx:18`).

**Proposal:**
- **A weekly training plan for each player.** The manager chooses one attribute focus or "system familiarity". Each earned step is distributed by that focus, with the same total points per step, so overall power grows no faster than today.
- **Reserves can develop.** They earn practice XP from scrimmages, at a reduced rate.
- **Level-ups are announced.** The weekly inbox report names them, for example "Ezzo's Utility rose to 4 · Weak".
- **A real Training page.** Squad → Training becomes where the plan is set, instead of a hidden column in the tactical editor.

**Design decision: how a focus distributes points.**
- **Option A.** The focus attribute gets 3 of a step's 6 points; the other five share the rest.
- **Option B.** A focus only changes which attributes grow first.
- **Recommend A.** It is legible, and a manager can feel it within a month.

**Why it matters:**
- Decision depth and visible progress, for every manager.
- Reserves and rotation start to mean something.

**Main files:**
- `WorldPlayerProfiles.php` (definition, progress).
- `ClubDevelopmentService::postTraining`, `FpsIdentityEngine::train`, `OnlineService` settlement.
- `ClubTrainingView.tsx`, `FpsTacticalSystemEditor.tsx`, the `ClubOffice` weekly report.
- A migration to store per-attribute step allocations.

**Dependencies and risks:**
- **Existing players.** Changing the formula would change their derived stats and future pinned plans. Freeze today's derived values as new baselines, as `training_baseline` already does.
- **Bots.** They need a focus policy in `BotClubManager`.
- **Rule: the 1–10 scale** ("never as the raw value", `WEB/fps/fpsScale10.ts:1-5`). Announcing only whole-level changes is safe. Any "close to the next level" hint reveals finer values; see Open questions.
- Community cups stay without training.
- **Rule: tendencies affect decisions only.** This changes attributes, not tendencies, so the rule is unaffected.

**How we would know it worked:**
- The share of clubs with a non-default plan.
- Level-ups per club per week.
- Reserve appearances in scrimmages.
- The return rate in the week after a level-up.

### P5. Tell managers when something needs them, and let them back in
**Loop:** Return · **Size:** M

**Problem (verified):**
- **Only an in-app inbox.** It is the only notification channel (`API/app/Services/ClubOffice.php:9-12`). There is no `app/Mail` or `app/Notifications`, and `API/routes/api.php` has no password-reset or email-verification route.
- **Many actions have deadlines:**
  - Orders close 105 minutes before kickoff.
  - Trials and community-cup answers close on Wednesday at 18:00.
  - Trade offers expire after 48 hours.
  - Sponsor offers expire after three days (`WorldSponsorships.php:37`).
  - Auctions close after 24 hours (`ClubMarketService.php:116`).
- **A forgotten password means a lost club.** Account recovery was build priority 4 (`docs/club-management-phase-plan.md:138`).

**Proposal:**
- **Opt-in email by category:**
  - The match result, with the score and a report link.
  - Orders open and orders closing.
  - Outbid.
  - Trade and sponsor offers.
  - A weekly digest.
- **Password reset and email verification.**
- Web push can come later.

**Why it matters:**
- Retention at 7 and 30 days.
- Fewer clubs abandoned through lost access.

**Main files:**
- Laravel Notifications and a mail provider.
- A fan-out from `ClubOffice::notify`.
- A preferences table.
- `AuthController` routes and new public account pages.

**Dependencies and risks:**
- **Privacy.** Store consent, and never put another club's private orders in a message.
- Bot accounts use `@world.hexatrick.invalid` addresses (`WorldPyramid.php:18`) and must be excluded.
- The provider is an owner decision.

**How we would know it worked:**
- Day-7 and day-30 retention of new managers.
- The share of fixtures with manager-submitted orders.
- Completed password resets.

### P6. Prepare for this opponent on this map
**Loop:** Matchday (experienced managers) · **Size:** M–L

**Problem (verified):**
- **Orders are only a lineup.** Fixture orders are five starters (`ClubFixtureController.php:61-63`).
- **Plans are club-wide.** The gameplan, instructions and positions apply to every match (`fps_team_systems`, read in `FpsIdentityEngine.php:49-52`).
- **The map is decided too late.** It is drawn from the random seed at allocation (`OnlineService.php:248`, `:310`), after orders lock, so nobody can prepare for Fontessa rather than Spillway.
- **Nothing about the opponent.** The Next match card shows the opponent's name, the kickoff and the order state (`FixtureBoard.tsx:97-116`).
- **Some of it already exists:**
  - The Wire writes previews and a rivalry desk (`API/app/Services/WorldMedia.php:136-151`).
  - The engine keeps lawful observed team tendencies (`docs/fps-tendencies-v4-audit-20261116.md`).

**Proposal:**
- **(a) Map.** It is announced when orders open.
- **(b) Opponent card** on Next match and in the orders banner:
  - Recent results with scores, and their HGR.
  - Head-to-head record.
  - Their observed team tendencies, in whole 1–10 levels, once the thresholds are met.
- **(c) Optional per-fixture plan.** A gameplan preset and per-player instruction overrides, saved with the fixture orders and pinned at lock.

**Design decision: map choice.**
- **Option A.** Draw the map when the fixture is created, from its own stored seed.
- **Option B.** Map pick and ban by the two managers.
- **Recommend A now.** Keep B for finals later.

**Why it matters:**
- Decision depth for experienced managers.
- It gives scouting, the playbook and P2's debrief something to act on.
- Head-to-head adds rivalry (social).

**Main files:**
- `ClubFixture` and a migration (map, fixture plan).
- `ClubFixtureController`, `LockClubFixture`, `OnlineService::allocate`.
- `FpsIdentityEngine::pin`, `FixtureBoard.tsx`.

**Dependencies and risks:**
- **Rule: lawful information.** Opponent tendencies come only from observation, never DNA, and stay empty until their thresholds are met, with no back-filling.
- **Rule: positions are frozen per match.** Every T/CT position must stay unique; overrides must validate.
- Keep the engine seed random at allocation; only the map choice moves earlier.
- Bots need a default fixture plan.

**How we would know it worked:**
- The share of fixtures with a fixture-specific plan.
- Visits between orders opening and the lock.
- Map-specific results for managers who adapt.

### P7. A weekly club calendar and standing entries
**Loop:** Season · **Size:** S (calendar) + S–M (standing entries)

**Problem (verified):**
- **The week has fixed beats:**
  - Monday: payroll and training post (`ClubMarketService.php:84-90`, `ClubDevelopmentService.php:16`).
  - Wednesday 18:00: Division Trials close entries (`WorldPyramid.php:40-50`), and community cups close replies (`docs/hexatrick-weeklies-and-business-20261108.md:7`).
  - Friday: first rounds.
- **Home never shows them.** The attention list covers live games, open orders, held fixtures, lineup readiness and debt, and says "Nothing optional goes here" (`HomeSections.tsx:11-36`). Entry deadlines never appear.
- **Bots enter themselves.** They join trials automatically (`BotClubManager.php:244`); humans must remember every week.

**Proposal:**
- **"This week" strip** on Home and Competitions: Monday payroll and training, Wednesday 18:00 deadlines, Friday first round. Each deadline has one-click Enter or Decline.
- **Opt-in standing entries:** "Enter my tier's Division Trials every week" and "Accept community cups". Each can be cancelled before the deadline and is confirmed in the inbox.

**Why it matters:**
- Retention, and fewer missed weeks.
- Clarity for new managers.

**Main files:**
- `HomeSections.tsx`, `CompetitionHub.tsx`, `CommunityCups.tsx`.
- Entry code in `CompetitionEngine`/`ClubTournamentService`.
- `CommunityCups::respond`.

**Dependencies and risks:**
- **Rule: community cups never auto-accept human invitations** (`docs/hexatrick-weeklies-and-business-20261108.md:15`). A standing entry is the manager's own explicit choice, but it needs the owner's approval.
- Lineup legality is still checked at the lock; failures still go to review.

**How we would know it worked:**
- The weekly share of active human clubs entered in trials.
- The number of held or no-show fixtures.

### P8. Staff whose ratings matter in the FPS game
**Loop:** Club business · **Size:** M

**Problem (verified in code):**
- **Staff cost real money.** Managers hire on visible 1–10 attributes (`WEB/components/ClubStaffRoom.tsx:41-61`, `:108`) at about ₱380–₱1,730 a week (`API/app/Services/StaffContracts.php:17`). A rookie player costs ₱15–36 (`WorldPlayerProfiles.php:105`).
- **Most attributes feed MOBA-era values:**
  - Tactics, drafting, meta reading, leadership, teamwork, communication and resilience produce `playbookBonus`, `chemistryBonus` and styles such as "Pick & Burst" and "Scaling Poke" (`ClubStaffService.php:91-117`).
  - They also feed the avatar draft (`API/app/Services/CoachDraftService.php:86-88`).
- **The FPS engine doesn't read those values.**
  - The FPS worker reads `plan.fps_identity` (`fps-match-worker.mjs:56`, `:71`).
  - A search of `WEB/fps/` and the worker finds no reader of the coach-card values.
- **What does reach an FPS match:**
  - The head coach's *philosophy*, derived from a private DNA hash of the contract key, not from the attributes shown (`FpsIdentityEngine.php:20-34`).
  - The performance coach's development rating and XP bonus.
  - Chemistry, which comes from player relationships, not the psychologist (`FpsIdentityEngine.php:63-65`).
- **The page still describes the old game.** It says "Meta source: Verified Arena … picks" and "Playbook strength /20" (`ClubStaffRoom.tsx:100-103`).
- **So, as far as the code shows,** a dearer "Tactical planning" coach costs more and changes nothing measurable in an FPS match.

**Proposal: give each role a clear FPS effect, and show it.**
- **Head coach.** Their philosophy (tempo, structure, aggression and so on) is shown in 1–10 levels, with its fit to your gameplan. The editor already computes `coach_fit` (`FpsTacticalSystemEditor.tsx:91`).
- **Assistant coach.** How fast players learn a new system.
- **Analyst.** How good the opponent reports in P6 are.
- **Performance coach.** Training, as today.
- **Psychologist.** How fast teammates build chemistry.
- **Candidates.** They are rated on these role-specific attributes.

**Design decision: the attribute schema.**
- **Option A.** Reuse the existing attribute keys with new meanings and labels.
- **Option B.** A new staff schema, keeping the old ratings as history.
- **Recommend A.** It keeps signed contracts intact and is cheaper.

**Why it matters:**
- Trust, because money spent should do something.
- Decision depth in hiring.
- Clarity.

**Main files:**
- `ClubStaffService.php`, `StaffContracts::candidates`.
- `FpsIdentityEngine::coach`/`pin`.
- `ClubStaffRoom.tsx` and the Hexapedia guide.

**Dependencies and risks:**
- **Rule: private DNA.** The philosophy comes from DNA. Showing it in whole 1–10 levels matches how player tendencies are shown, but needs the owner's approval.
- **Rule: tendencies affect decisions only.** Staff effects must stay on the decision side: no accuracy or damage.
- Existing contracts were priced on the old attributes; keep their terms.

**How we would know it worked:**
- Whether staff spend relates to rating movement.
- Hires where the coach fit improves.
- Fewer contracts ended within two weeks.

### P9. Money that forces choices
**Loop:** Club business · **Size:** L

**Problem:**
- **Cash barely binds (verified).**
  - Every new club opens with ₱50,000 (`ClubMarketService.php:11`).
  - A rookie's weekly wage is the mean of their attributes in pesos, at least ₱15 (`WorldPlayerProfiles.php:105`).
  - *Assumed:* an eight-player rookie roster therefore costs about ₱150–300 a week, so opening cash lasts years.
- **Income comes from a few sources (verified).**
  - It comes from prizes, sales and sponsors.
  - There are three sponsors, each with ₱80,000 that is never refilled: "No daily money mint" (`API/app/Services/WorldSponsorships.php:7-13`).
  - Deals pay ₱100–500 a week for four weeks (`:24`), shared by the whole world.
- **Wage curves differ.** Founding Tier 1 wages grow with the cube of skill, to about ₱1,700 a week (`WorldPyramid.php:26`), on a different formula from rookies'.
- **The effect (*assumed*, depends on population):** new clubs rarely face a money decision, and an old world slowly runs out of sponsor income. "Cash available" on Home (`ClubHome.tsx:80`) rarely prompts anything.

**Proposal:**
- **A season economy.** Each season, the sponsor pool is refilled from a published budget proportional to active clubs.
- **Sponsors pay for performance.** By tier, by verified results and by Hexacast audience.
- **One wage curve** for every new contract.
- **A pre-season budget screen:** wage bill, staff, expected income and weeks covered. `ClubFinances` already computes weeks covered (`API/app/Services/ClubFinances.php:45`).

**Design decision: the money source.**
- **Option A.** A funded seasonal sponsor budget. Capital stays finite and is refilled on a schedule.
- **Option B.** Per-match matchday income, which mints money and is inflationary.
- **Recommend A.** It keeps the owner's no-mint principle.

**Why it matters:**
- Decision depth for experienced managers: transfers, staff and wages become trade-offs.
- Long-term health of the world economy.

**Main files:**
- `WorldSponsorships.php`, `ClubMarketService::weeklyWages`.
- The wage formulas in `WorldPlayerProfiles`/`WorldPyramid`.
- `ClubFinances` and the Finances page.
- Bot policies (`WorldManagerPolicy`, `BotClubManager`).

**Dependencies and risks:**
- Existing contracts and founding terms must not be repriced (a recorded owner rule); the new curve applies only to new contracts.
- Bot bidding depends on cash and needs retuning.
- **Rule: Supporter is cosmetic only.** Money is never sold.
- Benefits from P8, so staff spend is worth something.

**How we would know it worked:**
- The share of human clubs making at least one money decision per week: a bid, a sale, a staff contract or a sponsor deal.
- The spread of weeks covered across clubs.
- The sponsor pool balance over a season.

### P10. Scouting the manager directs
**Loop:** Squad building · **Size:** M

**Problem (verified):**
- **"Scouting" is only a directory.** The sidebar item opens the Hexapedia player directory (`WEB/components/ui/navigation.ts:40`).
- **Humans can't commission scouting.** Paid scout signing was removed for them (`docs/agent-handoff.md:495`).
- **The academy is a lottery.** It promotes one prospect a week. The archetype is the first catalog card the club doesn't own (`ClubMarketService.php:58`), and the person is random.
- **No say in what comes in.** The manager cannot pick a role or a region.

**Proposal:** scout assignments.
- **Brief.** The manager chooses a need (an AWPer, an IGL candidate, a CT anchor), a region and a budget.
- **Shortlist.** A few days later, three prospects arrive, with uncertain 1–10 estimates. A better scout narrows the range.
- **Decision.** Sign one, or pass.
- **Staff link.** The existing `scout` office role (`StaffContracts.php:28`) carries the quality; this ties in with P8.

**Why it matters:**
- Decision depth in squad building.
- New managers get a guided way to fill missing positions.

**Main files:**
- `ClubMarketService::scout`.
- `WorldPlayerProfiles` generation, with stats weighted by role.
- `WorldPlayerIdentity`.
- A scouting-report table and a Transfers tab.

**Dependencies and risks:**
- **Rule: the 1–10 scale and private DNA.** Show whole-level estimates only.
- Nationality stays server-generated: a region preference steers where scouts look, and must not act as paid nationality editing.
- Bots use the same path, so keep it bounded.

**How we would know it worked:**
- Scouted signings that reach the starting five within four weeks.
- Fewer rosters with no natural player for a needed position.

### P11. Stakes in the tier ladder
**Loop:** Season · **Size:** M

**Problem (verified):**
- **Promotion only.** Weekly Division Trials promote the champion one tier (`WorldPyramid.php:61-66`). Nothing in `API/app` or `API/config` moves a club down.
- **Bots climb too.** They enter trials and can be promoted.
- *Assumed:* over time tiers drift upward. A tier then means "won once", not "plays at this level", and losing a trial costs nothing.

**Proposal:** a season-end tier review, published in advance.

**Design decision: how clubs move down.**
- **Option A.** Automatic relegation of the lowest-rated clubs (by HGR) within each tier and region.
- **Option B.** The lowest clubs play a tier-defence playoff against the next tier's best.
- **Recommend B.** It is decided in real matches and creates fixtures and stories.

**Why it matters:**
- Retention through weeks that matter.
- Competitive meaning for experienced managers.

**Main files:**
- `WorldPyramid.php`.
- A season-end hook in `CompetitionCalendar`.
- `club_tier_movements`.
- `CompetitionHub.tsx` and the inbox.

**Dependencies and risks:**
- Protect a human club's first season.
- Keep at least four bot clubs per region and tier (`WorldPyramid::populate`).
- **Rule: never fabricate results.** Playoffs are real matches, and any rating review uses only verified receipts.
- Benefits from P7.

**How we would know it worked:**
- A stable tier distribution.
- Trial participation.
- Churn after a relegation, watched for harm.

### P12. Let supporters pay
**Loop:** Supporter · **Size:** M on the app side, once a payment provider is chosen

**Problem (verified):**
- **Signal and Beacon exist.** They are enforced on the server and cosmetic only.
- **The trial leads nowhere.**
  - New registrations get one month of Beacon (`docs/hexatrick-first-deployment-and-supporters-20261109.md:45`).
  - The Studio says "Purchases will open when billing is available" (`SupporterStudio.tsx:29`).
  - When the trial ends, a manager who wants to keep custom jersey art, themes or IGN edits has no way to pay.

**Proposal:**
- Checkout and renewal for Signal and Beacon.
- Reminders before the trial ends, stating exactly what reverts. Themes go back to Cinder; saved artwork stays attached.
- A receipts page.
- Later, one disclosed cosmetic collection, as the business record suggests.

**Why it matters:**
- Monetization: this is the only revenue path.
- It targets committed and experienced managers.
- It is ranked here because paid conversion depends on retention, which P1–P7 improve first.

**Main files:**
- `SupporterMembership.php`, `SupporterController.php`.
- A billing webhook controller and entitlement history.
- `SupporterStudio.tsx`.

**Dependencies and risks:**
- **Rule: Supporter is cosmetic only.** Nothing that affects strength is for sale: money, players, scouting, training, staff or qualification.
- No cash prizes: payment providers restrict skill games with cash prizes (`docs/hexatrick-weeklies-and-business-20261108.md:45`).
- Tax and regions are owner decisions.

**How we would know it worked:**
- Trial-to-paid conversion.
- Monthly churn.
- The refund rate.

## 3. Quick wins

1. **Hide the inactive "practice" development options** until P4 ships, or label them "no effect yet" (`FpsTacticalSystemEditor.tsx:91`; `FpsIdentityEngine.php:169-171`). Choosing one today also stops system-familiarity growth.
2. **Use one 1–10 conversion.**
   - `toScale10` (`WEB/marketBatchEngine.ts:28-40`) disagrees with the owner-mandated `fpsScale10` (`WEB/fps/fpsScale10.ts:13-15`). For example, an attribute of 25 shows as 2 on Squad, Training, Home and the editor's strengths, but as 3 under `fpsScale10`.
   - `toScale10` also returns 5 ("Passable") for a missing value (`:29`).
   - Switch the nine components that import it.
   - Displayed numbers will change for many players, so announce it.
3. **Make readiness update straight after saving roles.**
   - The tactical editor has no save callback (`WEB/components/OnlineNormalView.tsx:270`).
   - The readiness panel reads `/online`, which is polled every 15–30 seconds (`:81`).
   - So "Not ready" can stay on screen after a successful save. Reload on save.
4. **Remove MOBA-era wording from manager-facing text:**
   - The **Avatar** column in the verified report (`FixtureReport.tsx:15`).
   - "Real Nexus finishes" in the Division Trials terms (`WorldPyramid.php:49`).
   - "Meta source: Verified Arena … picks" in the Staff room (`ClubStaffRoom.tsx:103`).
   - "Arena duration" and "Arena matches" (`WEB/components/GameGuide.tsx:39`, `ClubTrainingView.tsx:18`). "Arena" may still be the intended product word; see Open questions.
5. **Fix labels that promise something else.**
   - "Scouting" opens a player directory; rename it "Player directory" until P10 exists (`navigation.ts:40`).
   - The practice card's text reads like engineering notes ("Influence Maps, Blackboards, prewarmed 1P/3P/Director/PiP cameras", `App.tsx:387`); say what a manager gets instead.

## 4. Do not build (yet)

- **Live calls during a match** (timeouts, tactical switches). Version 5 simulates up to 90 minutes before kickoff and airs a replay (`docs/fps-official-live-engine-20261118.md:14`, `:28`). Live input would undo the precompute and capacity model.
- **Fatigue, injuries and morale.** Definitions hard-code `morale 70, fatigue 0` (`WorldPlayerProfiles.php:149`), and the competition work deliberately left injuries out. They would add chores before the existing decisions (P4, P6) have any effect.
- **Anything that sells strength:** money, players, scouting results, training speed or staff. It contradicts the Supporter rules and the business record.
- **Cash prizes or paid entry.** Payment-provider and legal constraints are recorded in the business record.
- **A third map or more broadcast polish before the management work.** Two maps already rotate, and the gaps above are in what managers decide, not what they watch. *This is a judgement, not a measurement.*
- **Regional currencies.** The single PHP market works, and the conversion policy is undecided (`docs/hexatrick-codebase-audit-20261108.md:87`).
- **Direct messages between managers.** The moderation, report and block workflow is incomplete (`docs/hexatrick-codebase-audit-20261108.md:83`).
- **One giant weekly Swiss event.** It was already rejected at about 16 rounds (`docs/hexatrick-weeklies-and-business-20261108.md:19`).

## 5. Open questions for the owner

1. **Past honors (P1).** Should past FPS games count toward Manager of the Year once the winner check is fixed? Their competition receipts exist.
2. **Development visibility (P4).** For their own players, may managers see a hint of progress toward the next whole level, or only whole-level changes?
3. **Economy (P9).** Do you accept a scheduled sponsor refill under the no-mint principle? How large should it be per active club?
4. **Standing entries (P7).** May a manager opt into automatic weekly trials or community-cup entry, given the "never auto-accept humans" rule?
5. **Coach philosophy (P8).** May it be shown in whole 1–10 levels, although it is derived from private DNA?
6. **Relegation (P11).** Yes or no? Should a human club's first season be protected?
7. **Maps (P6).** Should the map be announced when orders open? Pick and ban for finals later?
8. **Billing (P12).**
   - Which payment provider, and what prices?
   - Philippines only, or global from the start?
   - Does the free month of Beacon for new accounts continue?
9. **Email (P5).** Which provider? Which categories are on by default?
10. **Production capacity.**
    - How many production cores, for the 300-kickoffs-per-hour cap?
    - Where are replays stored: the worker's disk, or object storage?
    - These limit how many trials and community-cup pods can run each week. The development cap is 128 pods a week.
11. **Naming.** Is "Arena" still the intended word for a match?

## Measuring

There is no product analytics. Most of the signals above can be computed from existing tables:
- `club_fixtures.home_orders`/`away_orders` (custom orders).
- `club_inbox.read_at`.
- `online_clubs.manager_seen_at` (activity).
- `club_money_entries`.
- `fps_team_systems.revision`.
- `club_tier_movements`.

A small weekly metrics job that writes these to a table is a reasonable first step (S) before P3–P7.
