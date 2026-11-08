# Hexatrick lifecycle repairs

Implementation date: 8 November 2026, Asia/Manila. This follows the [codebase audit](hexatrick-codebase-audit-20261108.md). Historical audit observations remain unchanged below their dated context. This is an implementation record, not full-year production qualification.

## Delivered changes

| Area | Current behavior | Main source |
| --- | --- | --- |
| Final player statistics | Match each final champion to its unique allocated Avatar on its side, then verify its catalog archetype and exact person UUID. All ten people remain required. | `infrastructure/online/final-performance.mjs`, `browser-worker.mjs` |
| Worker recording | Serialize public snapshots once in the browser, reuse the JSON for recording, and gzip at level 1. Decoded replay/schema/fingerprints and simulation rules are unchanged. Record timing separately. | `infrastructure/online/browser-worker.mjs` |
| Invitation retries | Reuse an inactive participant row under the edition lock; increment slot attempts and retain every observed status in a separate history. New attempts receive new office notices; stale answers cannot respond to a reused participant invitation. | `CompetitionInvitations`, `CompetitionQualification`, `ClubOffice` |
| Annual qualification | Compile viable regional source definitions into the frozen annual program; bind actual edition IDs atomically before registration. Preserve total capacity with declared ranking fallback. | `AnnualQualificationGraph`, `CompetitionCalendar` |
| Staff XP | Scheduled settlement uses the allocation's staff snapshot. Historical plans without it receive no invented staff bonus. | `OnlineService`, `ClubStaffService` |
| Report recovery | Recover at most eight missing closed weeks per club job from actual records, with a persistent cursor and real generation timestamps. Current development observations are never backdated. | `ClubOffice` |
| Staff management | Weekly candidate desk, eight-week hiring, replacement/release/expiry, two-week signing fee and dated salary. Four weeks of payroll must remain after a signing. | `StaffContracts`, `ClubStaffController`, `ClubStaffRoom` |
| Bot staff decisions | At most one signing per club/week, meaningful recorded attribute improvement and eight weeks of payroll cover; use the same contract and ledger path as humans. | `StaffContracts`, `BotClubManager` |
| UI completion | Lazy report mounting, actual welcome selectors, allowlisted deep links through authentication, staff tab routing, organizer minimum/fallback choices and current invitation-slot/history display. | `FixtureReport`, `Avatarpedia`, `authNavigation`, `OrganizerWorkbench`, reference theme |
| Factual media | Rivalry summaries from completed scheduled games, published fixture previews and observed development gains. Exhibition results explicitly remain unranked. | `WorldMedia` |
| Content review | Signed-in managers report posts/replies. Administrators review, hide or dismiss; retain the report, decision and audit. Reports do not automatically suppress content. | `WorldMediaController`, `NewsModeration`, `WorldMedia` UI |

## Explicit policies

Official programs freeze geography population, qualification definitions, rules and windows when first published for the real calendar year. Vanguard, Summit and Crown draw from Dawn, Zenith and Dusk respectively. Each viable source offers one champion place, capped by the original result quota. Unallocated quota becomes ranking places. A source must be a verified edition of the same year and participant type, ending before target registration closes. Unresolved sources hold field locking for review. Once sources finish or cancel, exhausted eligible champions use the declared ranking fallback. Partial-year recovery cannot recreate missed source tournaments. Existing published programs/editions are not silently rewritten.

The read-only 2027 preview currently finds three viable club regions. Vanguard has 3 champion / 9 ranking / 4 open places; Summit 3 / 15 / 6; Crown 3 / 21 / 8. Nations has no continental source templates and therefore declares 36 ranking / 12 open places. These are previews, not created future editions or awarded results.

Existing staff retain their founding arrangement. Paid contracts are voluntary replacements, not retroactive salary changes. Candidate attributes range from 4 to 10 on the existing staff scale; salary is the attribute sum times 500 centavos per week, and the signing fee is twice that salary. Salary accrues over actual contract timestamps, prorated against seven days; release stops future accrual and does not refund the signing fee. Expiry returns the founding arrangement. This does not change the approved draft, chemistry or XP formulas. Money remains PHP; regional currency conversion and broader economy balancing remain separate product work.

The Wire uses factual templates and explicitly fictional media desks. Development coverage is bounded and checkpointed; no historical observations or player opinions are invented. This is a report/review workflow, not a complete social platform: blocking, notification preferences, appeals and external video ingest remain outside this release.

## Local rollout and verification

- Backups retained before schema changes: ignored `.local-tools/matchday-rehearsal/hexatrick-lifecycle-pre-20261108.dump` and `hexatrick-staff-contracts-pre-20261108.dump`.
- Additive migrations `2026_11_09_000003` through `000005` are applied locally: invitation history/report cursor, staff contracts and social review/checkpoint records. Their filenames are identifiers; the real clock remains 8 November.
- Worker image `teamfight-online-worker:lifecycle-20261108` is active locally, digest `sha256:9ddb877fe314d75c775ecc61ec8799426cf967551fe4be6f6bda244fd0fa5aec`. It inherits the frozen pilot engine. Browser worker SHA-256 `b327fd83b8650bcb42dcebf2e683666b68cb58b3d86117f38695ac9f9191f2f2`; performance helper `448b36f6d2b39cb3ae91ac6856774805f34484d7114086867627b66df60eace0`. Running files match workspace hashes. History worker was not restarted. During the scheduled game, the local 1.5 GiB memory limit accumulated 610 pressure hits with no OOM kill. It was raised without restart to 3 GiB (4 GiB memory/swap) and persisted in the development override; the next observations showed no additional limit hits. This is local resource tuning, not capacity qualification.
- PHP syntax checks pass for touched services/controllers/jobs/routes. Both worker modules pass `node --check`. Web TypeScript/production build passes, with existing large-bundle warnings. Log: ignored `.local-tools/matchday-rehearsal/lifecycle-repair-build.log`.
- App, Hexapedia, Wire and broadcast HTTP reads return 200; anonymous JSON moderation access returns 401.
- Local annual preview and world-media command execute successfully; expected authenticated moderation routes are registered. All 228 existing progress observations were reviewed without inventing development increases. No future annual record was created.
- The first bot cycle signed 30 paid staff contracts, with 30 matching signing-fee ledger rows totaling 1,003,000 centavos and no human paid appointments. No salary period/expiry has yet elapsed.
- `online:match-audit <id>` is a read-only operational command for exact people, staff, ratings, XP and Nexus evidence; it never starts or settles a match.
- Automated suites remain deferred at the owner's request. These checks do not replace duplicate-archetype, concurrency, salary-boundary and full-year regression tests when testing resumes.
- Connected browser inspection was unavailable: native pipe and browser access host were absent. Build success does not establish desktop/mobile visual acceptance or authenticated workflow acceptance.

## Live acceptance and remaining gates

The retained prior failure `c998bf5b-6f36-4a66-846a-e5e7b1bcd5f5` remains unchanged, with no timeout winner. Its last retained public snapshot had sequence 2,052, Arena time 1,025.5 seconds, 15,178 events and a 2,207,465-byte recording. This showed serialization growth worth reducing; it does not prove serialization was the sole cause of the time-budget failure.

Use the already scheduled **Crown Launch Exhibition semifinal, fixture 3**, on **8 November, 18:00 Manila** for live acceptance. Allocation is `157691b0-c281-407d-8771-1d53dff55ed8`, with pinned staff. Do not restart its active worker or create a competing exhibition just to obtain a pass. Verify real Nexus finish, ten UUID-bound ratings, scheduled training and idempotent settlement before claiming that gate passed. The launch game's official-ranking exclusion remains in force. Follow the latest handoff for subsequent observations.

Single-worker overlap capacity, complete annual/Nations operation, real paid-contract payroll/expiry, invitation-retry concurrency, browser acceptance, global display currencies and sustainable economy balance remain unqualified. No Arena/ML combat rules or Colab-only 3D pipeline stages were changed by these repairs.

## Live-lag follow-up

The owner asked why playback was laggy and whether games use WebSockets. The live path already uses a grant-authenticated WebSocket; HTTP polling supplies management/status and replay reads. At roughly 17 minutes of Arena time, worker timing had accumulated 774 seconds in snapshot capture/serialization versus 552 seconds stepping the simulation, over 1,438 wall seconds. That is measured server slowdown, separate from network delivery and browser rendering. Changing the transport alone cannot eliminate it.

The read-only viewer now smooths positions using observed packet cadence, includes minions/projectiles in position interpolation, snaps on replay seeks/large discontinuities and resizes its overlay only when dimensions actually change. The commentary tab renders at most 100 recorded events at once, with older/newer/follow-latest controls; all source events and exact replay links remain. Combat, clocks, results and historical recordings are unchanged. A production build passes; connected-browser visual acceptance remains unavailable.

`server.py` also has a bounded shared cache of the latest exact recorded JSON, with file revision detection and off-loop reading. Authorized WebSocket viewers share that payload instead of repeating full-history JSON decoding/encoding every 100 ms. Prepared image: `teamfight-online-worker:lifecycle-stream-20261108`, digest `sha256:51e5985627775fb3eac4b00bb679972c83b2133935865f808104c59a28a0a000`. Python syntax and image build pass; this is not proof of deployed streaming throughput. It it must only replace the active server after the current match terminates. The latest handoff records actual deployment status. Frozen simulation sources remain unchanged. Further work is still needed to reduce the frozen engine snapshot/fingerprint cost; this follow-up does not claim steady real-time server execution or proven 60-FPS playback.

## Final owner-approved exhibition resolution

The owner subsequently approved a **separate statistical exhibition result**, after the accelerated original engine still stalled at the remaining barracks. This explicitly supersedes the pending live acceptance attempt above for this particular game. No Arena winner was manufactured: the online match remains interrupted, without a result hash, while launch game 30 stores a distinct immutable statistical report. Hexa IWLFYSD (club 16) advances. The report explains its deterministic `exhibition-strength-draw-v1` model, inputs, probability and committed draw. It uses pinned mean skills/coach tactics plus actual observed kills/structure progress; no final combat statistics, duration or events are invented.

All 2,769 original/accelerated recording frames remain. The two paused runners and their original browser were terminated after saving interrupted state. Database reads confirm zero ratings, training sessions, official result receipts and matching money rewards. Final fixture 4 is scheduled for **14 November 18:00 Manila**. The statistical report and interrupted recording are accessible separately in the launch archive; the partial recording also appears in broadcasts/calendar. Verified report endpoints still reject an interrupted Arena.

Backup before the exception: ignored `.local-tools/matchday-rehearsal/hexatrick-before-statistical-exhibition.dump`. There was no schema change for this exception. `LaunchExhibitionResolution` requires owner approval and only accepts the unranked launch scope; settled results cannot be replaced. The command has no ordinary manager-facing simulation endpoint.

After zero active matches, the streaming cache/terminal-state image was deployed, digest `sha256:96d35aaaf98e11b23cdfaa9a3edce9109a9351a76ae6f22db4cfe2c0022d88c2`. The live server SHA-256 `6d6af68982afc89f1a85ae0af27188975e54c5ddc5638c5ceaee5bed4d281536` matches source; health passes and read-only inspection confirms exact cached JSON. Final production build passes (4.89 seconds); touched syntax checks pass. Automated suites remain deferred and browser visual acceptance unavailable. No active games or recent failed jobs were observed.

An optional POST allocation check was rejected by automatic approval review because it could restart a match. It was not executed or bypassed; read-only cache/file/database/public HTTP checks completed instead. The original real-time gate remains unqualified. Further snapshot/fingerprint optimization, gameplay finishing, concurrent capacity and global economy/social follow-ups remain separate work.
