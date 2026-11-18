# Manager loops: results, debrief, training, email, fixture prep, invitations, staff, economy, scouting, tiers, billing (2026-11-18)

This record covers the implementation of the twelve proposals in [docs/proposals-20261118.md](proposals-20261118.md), with the owner's answers of 18 November 2026:

- **Development progress.** Don't show progress toward a player's next level; announce whole-level changes only.
- **Sponsors and debt.**
  - Sponsors are dynamic.
  - A manager who is deep in debt *and* inactive can be dismissed.
  - Real email is sent for this kind of event.
- **Invitations.** Every tournament invites eligible clubs automatically.
- **Relegation.** Clubs can be relegated.
- **Billing.** A mock payment provider for now.
- **Infrastructure.** Minimal cores; replays stay on local storage.

## What changed, by loop

### Matchday: results (P1)

**Shared winner check.** `OnlineMatch::verifiedWinner()`, `finalScore()` and `constrainVerified()` give one verified-winner rule for every service:
- An FPS result must carry the validated MR15 report (winner, a 16+ round score, rounds and the allocated map).
- A legacy result still needs a Nexus finish.
- Nothing is inferred.

**Before this change**, these places only understood the MOBA Nexus field:
- `ClubMatchHistory` (Results totals and rows).
- `ManagerRecordBook` (manager honors).
- `WorldMediaController::report`, which read a missing key.

**Fixture rows.** Migration `2026_11_18_000002`:
- Adds `club_fixtures.result_winner`, `result_score` (rounds and map), `map_id`, `home_plan` and `away_plan`.
- Backfills outcomes only from verified results.
- `ClubFixture::recordOutcome()` writes the outcome at settlement, so lists never load whole match results.

**What managers see:**
- `/online/fixtures` returns `outcome`, `score`, `map`, `side` and `opponent_id`.
- Fixtures, Home and Results read "Won 16–11 · Fontessa".
- Inbox result notices say the same.

**Not done:** manager honors for FPS games settled *before* this change are not backfilled.

### Matchday: debrief (P2)

`MatchDebrief` builds the report from the stored result, so it stays available after the replay expires.

**Public part** (`/world/reports/{fixture}`):
- Score by half and overtime.
- A round strip showing how each round was won, with pistol rounds marked.
- Player lines: K–D–A, ADR, opening kills, trades, clutches and the Hex rating.

**Club-only part** (`/online/fixtures/{id}/debrief`, 403 for anyone else):
- The pinned gameplan, shown as whole 1–10 levels.
- Each player's positions and instruction.
- The aggregated observed decisions, as "attempted X of Y".

No DNA or raw tendencies are exposed. `FixtureReport.tsx` no longer shows the MOBA Avatar column for FPS games.

### Matchday: fixture preparation (P6)

**Map.** The map is drawn when the fixture is created (`ClubFixture` `creating` hook, live engine only) and played at allocation. The match seed stays random.

**Fixture plan.** `PUT /online/fixtures/{id}/orders` accepts an optional `plan`:
- A six-dimension gameplan and per-player instructions.
- Positions stay club-wide.
- `FpsIdentityEngine::pin()` applies the plan for that side only.
- A different gameplan starts with less familiarity; the head coach's match preparation carries part of the club plan's familiarity over.

**Opponent report.** `OpponentScouting` (`/online/fixtures/{id}/opponent`) contains:
- Recent verified results, HGR and head-to-head.
- Observed team tendencies. These use an exact PHP port of `computeObservedTeamTendencies`, so categories stay empty below 5 appearances or 15 opportunities and are never back-filled.
- The analyst's quality sets how many of the nine categories are covered (3 to 9).

**Frontend:** the opponent report on the Next match card (`matches/OpponentReport.tsx`) and the plan editor in fixture orders (`matches/FixturePlanEditor.tsx`).

### Development (P4)

**The focus now works.** The per-player training focus was stored in `attribute_practice` and never read; choosing it also stopped system-familiarity growth.

**How growth works now** (`WorldPlayerProfiles::allocateSteps()`):
- Each earned step still adds 6 points in total.
- "System familiarity" spreads them evenly. An attribute focus puts 3 into that attribute and 1 into each of three others, rotating.
- Total growth is unchanged, so a focus shapes a player without making them stronger overall.
- Points past the potential cap move to the lowest attribute still below it.

**Existing players** keep their current values: `ensureAllocation()` records the steps they have already earned as even growth. The SQL growth used by auction filters (`AuctionDirectory`) follows the stored allocation.

**What managers see:**
- Weekly training posts announce whole-level changes in the inbox.
- Progress toward the next level is no longer sent (`training_progress` was removed from `/online`). The Squad XP column and the Home XP total are removed.
- The Training tab (`ClubTrainingView.tsx`) is now the training plan.

**Reserves.** Reserves earn practice XP from scrimmages, recorded as `club_training_sessions.kind = 'practice'` (migration `000003`). The share is set by the performance coach's reserve development (25–65%). The match audit counts only `kind = 'match'`.

### Staff (P8)

**What the ratings do now:**
- The visible ratings fed MOBA-era coach-card values that the FPS worker never reads. They now set decision-side learning rates (`ClubStaffService::learningRates`) from the staff snapshot pinned at allocation, in `FpsIdentityEngine::apply()`:
  - Gameplan learning.
  - Familiarity kept when the head coach changes.
  - Role learning.
  - Chemistry growth.
  - Acceptance of the IGL's calls.
- Analyst quality sets the opponent-report depth.
- Load management sets reserve practice XP.
- Plans without staff stay exactly neutral.
- No staff rating touches aim, damage or reaction.

**Staff room:**
- It describes these effects (`attribute_effects`, `fps_effects`).
- It shows the head coach's philosophy, and each head-coach candidate's, as whole 1–10 levels with the fit to the gameplan.
- The MOBA coach card and draft policy are no longer sent.
- The "Meta analyst" role is renamed "Analyst".

### Return and email (P5)

**Email.** `ManagerMail` sends real email through Laravel's mailer:
- Categories: results, orders, competitions, market, club, plus account email that cannot be switched off.
- Each email has a one-click unsubscribe link (`/notifications/unsubscribe/{token}`).
- Each event is sent once (`manager_emails`, migration `000004`).
- Bot clubs and `.invalid` addresses never receive email.
- New inbox events of emailing kinds also email (`ClubOffice::notify`).
- `manager:notify` (every 10 minutes) refreshes human clubs' inboxes, so absent managers hear about results, order deadlines and invitations.

**Account recovery:**
- `/auth/forgot-password` (the answer never reveals whether an account exists) and `/auth/reset-password` (signs out every session).
- A signed email-verification link, sent at registration and resendable.
- Frontend: `#forgot-password` and `#reset-password`, a verify banner, and Settings → Email preferences.

**Compose:**
- `MAIL_*` and `APP_FRONTEND_URL` are added to the base environment; the default mailer is `log`.
- The dev override sends to a new Mailpit service (`http://localhost:8025`).
- Production must set a real SMTP relay.

### Season and competitions (P7, P11)

**Automatic invitations** (`CompetitionAutoInvites`, `competitions:auto-invite` every 15 minutes):
- Every club edition with open places invites every eligible human club, with an inbox entry of kind `entry` and an email.
- Bots keep entering through their own reviews.
- An invitation never enters a club by itself.
- A decline sticks for that edition.

**This week** (`/online/week`) on Home lists:
- Invitations, with Enter and Decline.
- Competitions the club has entered, and the community cup.
- The weekly beats: Monday payroll and training, Wednesday 18:00 deadlines, Friday first rounds, and the season end.

**Relegation** (`TierReview`, `world:tier-review` daily, migration `000007`):
- At the end of each four-week season, each regional tier relegates as many clubs as Division Trials promoted into it that season, so the pyramid keeps its shape.
- The order is decided on verified competition results that season (no scrimmages or community cups), then HGR, then games played.
- Clubs promoted that season and human managers in their first season are protected.
- The first review after deployment is a baseline that relegates no one.
- It adds no matches, so it costs no simulation capacity. This is why the review uses results rather than playoffs.

### Onboarding (P3)

`home/FirstWeek.tsx` is a checklist on Home: name the club, assign positions, watch a practice scrimmage, book a first game, enter a competition and play a first official match.
- Each step ticks off from real data; the practice step is remembered in this browser.
- Roles stay the manager's draft until saved.
- The checklist hides when done or dismissed.

### Club business (P9)

**Dynamic sponsors** (`ClubEconomy`, `clubs:economy` daily, migration `000005`):
- Every four-week season, each sponsor's capital is topped up, once, to ₱80,000 plus ₱4,000 per active club. Capital stays finite.
- Sponsors approach human clubs without a deal.
- Offers are priced by verified recent results and by tier (Tier 1 pays three times Tier 5), as well as exposure and fit.

**Debt:**
- A club in debt is warned.
- A manager who is past the board's limit (minus the larger of ₱10,000 or eight weeks of wages) *and* has not managed the club for 21 days gets a final warning by email.
- After 7 more days, the board dismisses the manager. The club passes to an AI caretaker with its players, finances, history and fixtures, and the dismissal is recorded (`manager_dismissals`).
- An active manager is never dismissed.
- Returning lifts the final warning.
- A dismissed manager can start again with a new club. They can never re-adopt the club that dismissed them, and nobody adopts a club in debt.

**Finances page:** shows the season budget, the expected cash at season end, the sponsorship and the board's limit.

**Wages:** newly generated players use one wage curve (`WorldPlayerProfiles::wageFor`). Existing players keep their wages.

### Squad building (P10)

`ScoutingAssignments` (Transfers → Scouting, migration `000006`):
- **Brief.** The manager chooses a position need (seven needs) and an optional region, and pays ₱1,500.
- **Search.** After 48 hours, the scout returns three original rookie prospects, stronger in the need's attributes.
- **Estimates.** Shown as ranges of whole 1–10 levels; the club's appointed scout narrows them.
- **Decision.** Sign one, or pass. Exact attributes stay on the server until signing.
- **Nationality** is generated within the region, never chosen.
- **Shortlists** arrive by inbox and email (`scouting:due`).
- The sidebar's "Scouting" item, which only opened the player directory, is renamed "Player directory".

### Supporter (P12)

**Provider:** `App\Billing\BillingProvider` with `MockBillingProvider` (`config/billing.php`, `BILLING_PROVIDER=mock`).

**What it does** (`SupporterBilling`):
- Checkout: an in-app test page answers paid or declined.
- Idempotent activation, which extends from the later of now and the current end.
- Monthly renewal, with three attempts before a membership lapses.
- Cancel and resume at the end of the period.
- Receipts (`supporter_payments`, migration `000008`), by email too.
- Reminders before a trial or a cancelled membership ends.

**Prices:** ₱99 (Signal) and ₱149 (Beacon), labelled as test payments everywhere. No money moves. Entitlements are unchanged and cosmetic only.

## Quick wins

- **One 1–10 scale.** Manager-facing components use the mandated `fpsScale10`. The auction level filter matches it. The legacy practice market engine keeps its own conversion internally.
- **Readiness refresh.** Readiness reloads right after roles are saved.
- **Wording.** MOBA wording is removed from the trials terms, the training and staff guide chapters, the staff room and the report.
- **Practice card.** It now says what a manager gets.

## Checks

- **Backend.**
  - `ManagerLoopsTest`: 16 tests / 165 assertions, covering every loop above.
  - `ClubManagementFlowsTest` and `CoachDraftTest` now assign manager roles in their setup. Their earlier failure came from the 2026-11-14 roles requirement; `CoachDraftTest` also asserts the new staff payload.
  - See the full-suite result in the handoff entry.
- **Frontend.** `npx tsc -b` is clean; `npm run check:game` and `npm run build` results are in the handoff entry.
- **Compose.** `docker compose ... config --services` validates with the new Mailpit service.

## Not done

- Nothing was deployed or migrated.
  - The running dev API mounts only `app/`, so the new routes, config and migrations need a rebuild and `php artisan migrate`.
  - The eight migrations (`2026_11_18_000002`–`000008`) have not been run against the dev or production database.
- No screen was rendered in a browser, and no live FPS match was played through the new settlement path.
- Real email needs an SMTP relay in production. Dev mail goes to Mailpit.
- **Billing.** Only the mock exists. A real provider, prices, tax and markets are owner decisions.
- **Interpretation.** "They can invite any players" was read as "invitations go to every eligible club, human or bot". Managers' scrimmage invitations by club tag were already in place.
