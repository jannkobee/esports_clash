# Esports Clash: combined online product and evolution roadmap

**Latest owner steering (2026-10-18):** pause TRELLIS.2/GGUF implementation and use the [supplied Arsenaldo model](arsenaldo-supplied-model.md). The visual-generation schedule is paused; ML remains independent. Resume generative art only after official DINOv3 access and real low-memory inference/rig/browser qualification. The supplied GLB is static, with no skeletal clips; earlier animated variants remain selectable.

Latest owner priority: Part 6 **Autonomous Avatar Model Evolution** now precedes remaining ML validation and wallet/Ranked work. Its independent procedural/Blender worker, first five-candidate Arsenaldo cycle, Laravel owner review/release history and rollback are implemented and deployed locally. The five compatible experiments await owner review; no overall artistic-improvement claim or automatic publishing. See [avatar-evolution.md](avatar-evolution.md). Continuous ML remains independent and its outstanding validation is deferred.

Decision date: 2026-10-18, Asia/Manila.

The owner asked to combine the autonomous MOBA evolution proposal, the deployed Laravel/Docker foundation, and the new global online AI MOBA / intelligent Player Cards / ranked ladder / commercial packs specification, then identify what to do next. This document combines the requirements and orders the dependencies. The original source audit and plan are preserved below; subsequent implementation status is recorded separately and is not a public-launch claim.

The owner then approved the first milestone with "okay do it what's next". Its implementation, local deployment, acceptance evidence and remaining limits are documented in [online-normal.md](online-normal.md), `online-normal-verification.json` and `online-normal-recovery.json`. The table below retains the original audit so historical browser-owned features are not confused with the new trusted Normal path.

## One product, shared gameplay

Human owners manage clubs, card collections, lineups, drafts and coaches. Trusted match workers execute their AI-controlled teams. Browsers display authorized snapshots, combat events and replays. Laravel owns accounts, entitlements, matchmaking, results, Rating, currency, model/patch assignments and review workflows. Python/PyTorch trains challengers against the same gameplay execution used by trusted matches. The Evolution Lab measures card behavior and the meta, evaluates proposed patches, and records owner/delegate decisions. Cosmetic avatar evolution is an independent later workflow that cannot change hitboxes or combat timing.

No Vercel deployment. Local Docker remains the development target. Public hosting and real-money checkout remain separately gated by the owner's explicit approval, as requested in the new specification. Players will only need a browser when a public environment is eventually approved; Docker and ML runtimes are server infrastructure.

## Verified starting point

| Area | Source-backed state | Integration implication |
| --- | --- | --- |
| Laravel accounts | Sanctum registration/login and club/report endpoints exist in `EsportsClash.Api/routes/api.php` and its V1 controllers. | Reuse authentication; verify regular-account permissions and session lifecycle before extending public flows. Evolution ownership remains privileged. |
| Club persistence | `ClubProfileController` stores client-provided roster JSON, validating IDs/lineup membership rather than issuing owned cards. | This is a cloud-save boundary, not trusted production ownership or authoritative card attributes. |
| Match results | `MatchReportController::store` accepts a report and winner from the authenticated browser. | Uploaded reports remain untrusted archives; they must never settle global Rating, rewards or paid entitlements. Add a separate worker-owned result path. |
| Online rooms | `EsportsClash.Web/server.mjs` keeps rooms in an in-memory Map and accepts supplied roster/coach/Rating values. | Reuse draft concepts, but this is not persistent authenticated matchmaking or server-owned combat. |
| Ladder | `ladderRating.ts` implements Chess-style Rating with a 300 floor and browser-local profile persistence. | Preserve terminology/math; move official accounts, results and exactly-once settlement to Laravel. Existing local ladder history is not verified global Rating. |
| Packs | `App.tsx` owns `PACK_CATALOG`, random selection and local progression. `packEconomy.ts` deducts the pack price without duplicate refunds. | Port the actual current rules to transactional backend services; publish odds derived from those rules before designing new distributions. |
| Duplicate handling | Opening duplicates upgrades an owned card without refunding the purchase. A separate legacy duplicate-recycling action exists in `App.tsx`. | Do not collapse these into one conversion rule or silently reintroduce refunds on pack opening. Preserve the two distinct actions unless separately revised. |
| Card-aware learning | `adaptivePolicy.ts` includes card identity, IQ/TF/LAN/FLX, role fit, personalities and current resources. The new PyTorch pipeline fits a bounded linear task-contrast predictor. | Card conditioning exists, but this is not the requested broad neural tactical/macro policy or proven card-specific behavioral improvement. |
| Live rules | Live execution remains largely in `AramMatchView.tsx`. The Node engine has documented behavior differences. | Extract/reuse the live rules with parity checks; do not make the simplified engine authoritative by relabeling it. A private server-owned renderless browser worker is an intermediate option. |
| Evolution services | Laravel/PostgreSQL, API/worker/scheduler, Python/PyTorch runner and frontend are deployed in `compose.evolution.yaml`. | Retain orchestration, plans, artifacts, existing gates and isolated test bootstrap. |
| Queue infrastructure | This Compose stack currently uses **database-backed queues/cache**; it does not define a Redis service. | Redis in the new document is a target, not an already integrated feature. Add a project-owned service and migrate/drain jobs without resetting metadata or touching unrelated local Redis instances. |
| Approval workflow | Forty-eight-hour configurable reviews, alternatives data model, rejection/decline/defer, hashes and row locking exist. The delegate currently only chooses an eligible keep-current option. | Preserve this workflow. Multiple statistically justified mechanical alternatives, actual releases and trained preference ranking remain unimplemented. |

`agent-handoff(4).md` was not found in the repository. The current `docs/agent-handoff.md`, `docs/arena-mechanics.md`, `docs/evolution-system.md`, actual source, and explicit owner instructions govern this plan. Historical feature lists are not proof of implementation.

At the read-only status check for this planning turn, final-source study `6e1523e6-15dc-4924-9d51-4c1a74ac794c` was running, with fifteen of eighty planned worlds recorded. This is a dated observation, not a current completion guarantee or fifteen valid evaluation cases. No model has been promoted. The job operates without an active coding-agent session or paid LLM calls. Preserve its frozen source/data/model boundaries; complete and audit its result before using it to justify the next ML experiment.

## First milestone: two-account authoritative Normal match

Implement the smallest complete online path before calling anything global Ranked or accepting money. Minimum ownership must precede roster validation, even though the new specification places the broader card economy after matchmaking.

1. **Protect persistence first.** Retain the pre-bootstrap in-memory test guard. Add scoped database/artifact backups and a restore check before new migrations. Use additive migrations; never reset the deployed database or artifact volume.
2. **Create the minimum trusted club/card foundation.** Reuse account authentication, add server-owned club/card definitions and owned card-instance records, and issue an idempotent starter roster. Clients submit owned instance IDs and allowed preferences; the server derives attributes, eligibility and coach/lineup configuration. Preserve local save snapshots and existing play. Define a reviewed, idempotent legacy-import policy; browser JSON alone cannot prove purchases, currency or ranked wins.
3. **Create durable Normal matchmaking and match allocation.** Require two authenticated human accounts, validate their owned lineups, persist queue tickets and match participants, prevent duplicate allocations, and lock rules/catalog/patch/policy/observation versions and seed at allocation. Pin a versioned existing AI fallback until a learned model qualifies.
4. **Run the existing live rules on a trusted worker.** The worker owns the clock, RNG, combat, purchases during the match, actions and termination. Reuse the renderless live executor as an intermediate proof if useful, while extracting a reusable engine with state/RNG/replay equivalence. Do not create a third combat implementation. Keep serving resources separate from background training.
5. **Stream one authoritative match to both browsers.** Add private WebSocket events and snapshots with sequence/schema versions, a reconnect baseline and missed-event recovery. Keep renderer interpolation separate from the authoritative tick. The match continues after either browser closes. Viewer visibility and legal AI observations remain separate concerns.
6. **Persist worker-owned completion and replay.** Authenticate worker submissions against their allocation and immutable versions. Browser reports cannot create authoritative outcomes. A terminal match commits once; retries or reconnects cannot duplicate results or rewards.

Acceptance: two actual accounts queue, submit owned valid teams, receive the same server-owned match, disconnect/reconnect, and retrieve the same persisted final result/replay after service restart. Forged wins, changed client attributes, foreign cards, duplicate allocations and result retries are rejected. This milestone does not award global Rating or enable payments.

**Local milestone completed:** the recorded two-account match ended naturally at 632.5667 seconds; 375 shared snapshots matched, browser close/rejoin and active worker recovery passed, and completed results/ownership/replay survived service restart. See [online-normal.md](online-normal.md) and the three online verification JSON files. The proof uses the private live browser executor and Canvas protocol test, not a global launch or 3D performance claim. The owner's subsequent priority is to finish the Laravel Blade dashboard relocation, then address measured ML speed/learning quality/memory/storage optimization before the wallet/pack milestone.

## Owner priority update: Laravel dashboard first, ML optimization next

The native Blade Evolution Lab is now deployed at **http://localhost:8089/evolution**, removed from the game frontend, and verified with native login/logout, live reports, owner controls, CSRF rejection, JSON downloads and desktop/mobile fit. See `evolution-blade-verification.json`.

The owner supplied a comprehensive fast-simulation/learning/storage/RAM/VRAM specification, then said to add it to the milestone plan while finishing the dashboard first. It is queued as [ML optimization](ml-optimization-milestone.md), with the full [supplied specification](ml-optimization-specification.md) preserved. No optimization deployment, cleanup or learning-threshold changes have been made. Audit/benchmark first, then accelerated parity, evidence-based learning improvements, reference-aware resource/retention management, Blade metrics/controls and a complete verified Docker cycle. Do not skip required execution checks because automatic Docker approval review is temporarily unavailable.

## Combined implementation sequence

| Order | Deliverable | Required evidence before expanding |
| --- | --- | --- |
| 1 | Trusted account/club/card minimum and authoritative Normal match above | Real two-account end-to-end run, reconnection, persistence, replay and abuse/retry tests |
| 2 | Native Laravel Blade Evolution Lab — completed | Actual owner session login/logout, CSRF, reports/downloads, scheduling/review forms, live refresh, game-tab removal, desktop/mobile checks |
| 3 | ML simulation speed, learning usefulness, RAM/VRAM and automatic storage management — next | Measured baseline/diagnosis; deterministic/full-match acceleration parity; independent unchanged gates; checkpoint continuity; resource/reference-safe cleanup; complete accelerated Docker cycle; see linked specification |
| 4 | Authoritative wallet, immutable ledger, existing pack algorithm, ownership/progression/evolution transactions | Cryptographic production randomness; reproducible test randomness; actual odds disclosure; atomic debits/grants; idempotent opening and duplicate handling; no paid checkout |
| 5 | Global Ranked foundation | Existing 300-floor Chess Rating; human-only matchmaking; compatible pinned versions; exactly-once Rating/reward settlement; real leaderboard; approved competitive power rules |
| 6 | Shared card-conditioned ML and measured card behavior | Legal/fog-restricted inputs; card/role/signature/coach/chemistry context; held-out attribute/identity ablations; meaningful diversity and decision-quality gains; full-match comparisons; no failed-model promotion |
| 7 | Self-play population and autonomous training operations | Shared live environment; archived opponents; qualified challengers; model registry; independent serving/training resource budgets; retention and recovery; optional project-owned Redis migration |
| 8 | Trusted meta analysis and real alternative patch proposals | Sufficient patch-specific full-match samples; controls for policy/card strength, side, role, composition and opponent; isolated candidate simulations with uncertainty; retain keep-current when evidence is insufficient |
| 9 | Approved weekly patch activation and rollback | Immutable manifests; configurable cadence/timezone; single eligible selected proposal; rejected proposals stay rejected; delegate reasoning; atomic version activation; no active-match mutation; tested rollback |
| 10 | Sandbox purchase infrastructure and launch preparation | Provider-neutral orders/ledger/webhook/refund design; provider/jurisdiction verification; sandbox tests; privacy/asset-rights review; no live checkout or public commercial exposure without separate approval |
| 11 | Cosmetic avatar evolution and later world expansion | Identity-preserving actual mesh/animation candidates, technical/render validation, human comparisons and recoverable assets; later regional serving, seasons/tournaments and measured global latency/load |

The order can overlap where independent: the current experiment continues while online foundations are built; commercial asset provenance and backup work can start early; a model registry/immutable version contract is needed in the first match slice even before automatic model promotion. The original visual evolution objective is retained rather than dropped by the expanded commercial specification.

## Design boundaries carried forward

- Protect the current risk-based tower/well/Nexus rules, ordinary terrain-aware retreat, attribution, objective contestation, anti-oscillation, aliases and visual/mechanical separation. Neither purchasing nor learned preferences can bypass legality or expose hidden information.
- Preserve current Player Card meanings and caps. IQ/personality affect decisions and marginal risk, never direct mechanical stats. Stat growth, bounded behavioral development and shared policy learning are distinct systems with independent versions and evidence.
- The specification requests normalized/capped competitive power. The existing 100-OVR equalized mode is a reference, not an automatic replacement for Ranked: blindly flattening every behavioral attribute would erase the card identities the same specification requires. Specify the exact queue-specific normalization contract and review any conflict with established card/stat rules before implementing it. Existing modes/cards are not silently changed by this plan.
- Keep actual pack prices, counts, pools, rarity selection, duplicate upgrades and separate recycling behavior as the migration baseline. New odds, pity, caps, paid entitlements or progression reinterpretation need explicit design records; never personalized hidden pack probabilities. Live commerce activation remains disabled pending the owner's explicit approval.
- Public leaderboard rows represent actual accounts/results. Local fictional rivals or demo data must remain identified as local content, not republished as real online users.
- Retain the forty-eight-hour review default, manual selection/rejection/decline/defer, strict eligibility and database locks. The current delegate is conservative automation, not a trained substitute. Future ranking may only choose validated non-rejected proposals, and may retain the current patch.
- Do not repurpose uploaded local matches as trusted competitive or balance evidence. Record game, schema, card/catalog, patch, model and execution versions so incompatible populations are not pooled silently.
- Purchased ownership must survive patches; source/asset provenance is audited without renaming protected aliases or replacing artwork automatically. Legal/provider eligibility determinations belong to the later verified commercial review, not assumptions in this architecture plan.

## Original planning update

Added this combined source-backed roadmap and linked it from the existing evolution documentation and handoff. No gameplay, economy, cards, live model, Docker configuration or running study was changed. No additional executable tests were needed for this documentation-only planning change. Prior verification remains historical and does not establish any of the proposed online/commercial features.

## ML operations implementation update

The Blade relocation is complete. The prioritized ML operations milestone is deployed locally and undergoing complete independent cycle validation. Resource budgets, fitting-only compatible replay, actual checkpoints, safe reference-aware retention and native owner controls are implemented; measured fitting memory and crash recovery evidence are recorded in [ml-operations.md](ml-operations.md). The owner has deferred further speed tuning. The two-hour schedule and 48-hour review window are preserved. Wallet/packs, Ranked, broader learning, validated alternative patches and production release remain subsequent milestones. No candidate is promoted by this update.

## 2026-10-19: Asset Preparation pipeline and cancellation

Implemented/deployed: separate Laravel preparation studio; continuous completed-source admission; native per-character skeleton/clip transfer candidates; constrained attachment regions; editable exports; explicit geometry/game-renderer qualification; identity/equipment review; existing immutable publication/canary/rollback path; per-job/bulk cancellation and durable stop acknowledgement. Outcome/quality/browser verification and feature-test execution remain deferred. No candidate qualification or live promotion is claimed. Remaining: qualify actual roster candidates, repair profile/topology/appendage failures, establish broader runtime/performance evidence, then publish only eligible reviewed versions. See avatar-asset-preparation.md.

## 2026-10-19: UniRig provider, owner-started visual jobs and report deletion

Owner selected UniRig. Added isolated pinned provider, actual skeleton/skin stages, reviewed native animation retargeting boundary and shared GPU lease with TRELLIS. Removed automatic visual job admission/schedule controls across generation/preparation/enhancements; ML automation remains. Added owner-only report deletion/redaction with active/review guards and recovery tombstones. Official checkpoints are provisioned; native build/readiness is distinct from actual inference. No visual job or runtime qualification is started automatically. Remaining model work is owner-requested rigging, mapping/profile repair where needed, qualification, then eligible publication. See unirig-manual-visual-workflows.md.


## 2026-10-19: Owner content studio

Avatar management and Item management added to Laravel: versioned editable drafts, per-skill gameplay / VFX / animation prompts, avatar / item appearance briefs, structured stats, manual item creation, validation, review completeness, exports and restore. Existing-avatar appearance prompts hand off to manual 3D concept workflow. See `content-management.md`. Live custom-content publishing, arbitrary new-mechanic code generation and an autonomous concept-image provider remain future work; no visual automation re-enabled.


## 2026-10-19: Asset Preparation visibility and report cleanup

Live catalog publishing paused at owner request. Asset Preparation now has a real observed ten-stage tracker, explanations, timestamps, bounded transition history and labeled resource samples, plus confirmed atomic bulk preparation-report deletion. Existing manual qualification/publication, cancellation acknowledgements and asset rollback metadata remain protected. Migration 9 deployed; 79 backend tests / 852 assertions and browser UI checks pass. See `preparation-progress-and-deletion.md` for scope and the resource-wait observation. This does not establish successful inference/rigging qualification.


## 2026-10-19: Preparation lifecycle controls

Pause (confirmed dual-worker stop), Resume and stop-before-Retry added with unique linked attempts, pending-request cancellation, bounded admission recovery and report-deletion protection. Migration 10 deployed; 85 tests / 912 assertions and Blade compilation pass. Native model-memory checkpointing is not provided: unfinished work may repeat. Owner authorized Dawnna continuation; the next blocker is the ~8 GiB Docker VM cap and Windows host memory pressure. A 10 GiB WSL cap / global VM restart is prepared for review and has not been applied. See `preparation-pause-resume-retry.md`.

## 2026-10-19: Approved maintenance applied; actual UniRig inference

The owner approved the prepared WSL change and confirmed apps closed. The 10 GiB cap/restart is now applied and original services restored, superseding the earlier pending note. Dawnna actually produced a predicted skeleton and skin weights after compatible extraction, bit-identical inference-only checkpoint and single-file handoff repairs. Material-export compatibility and subsequent animation/runtime qualification are tracked in `wsl-memory-dawnna-continuation.md`. Live model remains protected. ML automation remains enabled; its restored study failed a historical evidence integrity check and produced no proposal. No live catalog publishing work resumed.

Dawnna actual outcome: rigging and ten native clips exported, but qualification rejected skin coverage/clipping and the game helper-node hierarchy. No live deployment. Next asset milestone is attachment/helper preservation and skin/deformation repair followed by fresh qualification and identity review. Specific errors/partial evidence now survive failures. See `wsl-memory-dawnna-continuation.md`.

## 2026-10-19: Prepared-model repairs and completed-source guard

Fixed real helper hierarchy/coordinate handling, explicit native-clip playback, Blender helper weight false positive, and Laravel's missing viewer module. Completed generated GLBs now block duplicate generation in UI/backend including report-deletion tombstones. Actual Dawnna renders successfully, but sampled clipping and texture quality remain unresolved; no live publication. Deleted/redacted source/preparation records block a fresh tracked retry until clarified. See `avatar-preparation-repairs-20261019.md` for implementation, validation and the higher-precision texture diagnostic lead.

Final repair checks pass: 451 game tests plus 3 simulations/TypeScript, production build, 86 backend tests / 925 assertions. Owner confirmed intentional report/settings cleanup; no history restoration or ML re-enablement. Candidate still requires clipping/texture repair and human review before deployment.

Clickable generation cards completed: per-avatar status/history with scoped 10-second refresh, owner protection and existing output links, no admission on click or deleted-report restoration. 14 generation tests / 108 assertions and actual 45-card browser navigation pass. Higher-precision texture comparison remains a separate active repair.

Texture corruption fixed for the verified 512 profile: matched local Q4/Q8 comparison, Q4 geometry plus pinned Q8 texture deployed, source surfaces preserved, original assets retained. Existing rigged-model clipping remains unresolved and prevents publication. Cards also open scoped status pages. Evidence and remaining boundaries: `trellis-texture-precision-repair.md` and `trellis-texture-comparison.html`. No visual automation, deleted-report restoration or ML setting change.
