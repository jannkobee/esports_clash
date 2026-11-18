# Round responsibilities: role architecture and team interaction (2026-11-17)

The owner asked for professional role behaviour: players who understand their responsibilities, complement each other, express their identities and adapt during the round, without rewriting the action selector, perception or reactions. Another agent will audit decision-making and reactions next; this record is the handoff for that work. Nothing is committed.

## 1. What existed (audit)

The audit found the following:

- **Roster positions.** Managers assign each player one unique T and one unique CT position (`fpsPlayerArchitecture.ts`). On T these are T_IGL, T_ENTRY, T_SUPPORT, T_LURKER and T_FLEX. On CT they are CT_IGL, CT_ROTATOR, CT_ANCHOR_A, CT_ANCHOR_B and CT_FLEX. They are frozen per match. This is correct, and it is kept.
- **Execution bridge.** `fpsExecutionRole(position)` maps each position to a permanent `role`: caller, entry, support, lurker, anchor or trade. CT_ROTATOR and CT_FLEX are both `trade`. The `sniper` role is checked in places but never assigned.
- **The main defect.** About 80 live decisions read that permanent `role` as if it were the round's job. As a result:
  - The T_ENTRY player always took first contact.
  - Only T_SUPPORT pop-flashed for the entry.
  - The carrier was chosen by role order.
  - Execute smokes went to the support role.
  - The trade reflex ranked teammates by the `trade` role.
  - CT anchors alternated deep holds by slot parity.

  Nothing moved when the entry died, was hurt, picked up an AWP or had a worse spawn. The only dynamic piece was the caller takeover (`activeCaller`).
- **Unused tendencies.** About 30 role-relevant individual and IGL tendencies were derived for every player but read by no live decision. Examples: `tradePriority`, `sacrificialEntry`, `supportFlash`, `anchorPersistence`, `retreatTiming`, `bombProtection`, `spawnExploitation`, `starUtilization`, `strengthExploitation`, `lurkTrust`, `roleFlexibility`, `leadFromFront` and `utilityDelegation`. Because of this, IGL identities and same-position players could not show different responsibilities.
- **Recorded (2D) engine.** It used the same permanent roles: entry was `tactics.role==='entry'`, and the bomb went to the support.
- **Already working, kept as is:** personality, tendency and attribute separation; call responses; caller takeover; lawful information; trade spacing; execute regroup → utility → breach; the flash-wait for the entry; fallen-site rotation; post-plant planning; drops and handoffs.

## 2. What changed

### Round duties (new: `src/fps/fpsRoundResponsibilities.ts`, pure and deterministic)

- **Jobs.** Each living player gets one job per round: `entry`, `trade`, `support`, `lurker`, `anchor` (per CT site) or `sniper` (AWP holders).
- **Whole-team election.** `assignFpsRoundDuties` searches every assignment exhaustively (at most 5!) over a slot list, so each job is held by exactly one player. T pre-plant: one entry; one support if anyone carries utility; one optional lurk; snipers; the rest trade. Post-plant has no entry. CT has an anchor per covered site; the retake has no anchors and one optional support.
- **Score per player and job.** These are the named terms:
  - **Roster prior.** The position's natural fit, weighted by gameplan structure, coach rigidity, the caller's `structuredCalling` and `roleFlexibility`.
  - **Own preference.** The player's tendencies and personality, weighted by freedom, `individualPlayAllowance` and `micromanagement`, with a floor of 0.35 so a rigid coach never erases it.
  - **Caller knowledge.** Attributes relative to the team mean, read only through the caller's `strengthExploitation` and `weaknessProtection`.
  - **Spawn and position.** Distance to the lane, weighted by `spawnExploitation`.
  - **Feasibility.** HP, weapon, carried grenades, and the bomb. The bomb is −3 for entry.
  - **Leadership.** `leadFromFront`, `utilityDelegation`, `lurkTrust` and `starUtilization`.
  - **Continuity.** +0.4 for keeping the current job.
- **CT coverage.** A site with no living home defender borrows one defender from a site that still has two or more.
- **Attributes never gate a job.** With no caller directing, attributes are not read at all.

### Live integration (`fpsLiveSimulation.ts`)

- **`duty(p)`** replaces `p.role` at every round-job decision: entry clearing, trade follow and reflex, support and utility election, lurker silence and flanks, anchor holds and rotation guards, approach scoring (`chooseLiveApproach` now receives the duty), post-plant intent, drops and acknowledgements. `role==='caller'` stays the IGL authority check, and the buy phase keeps the roster role.
- **`refreshRoundDuties` / `updateRoundDuties`.**
  - The election runs at round start and again at freeze end. At round start it runs before the carrier is chosen, and the carrier is never the entry when another healthy rifler exists.
  - Mid-round it re-runs about once a second, and at once after a death.
  - A changed job is a communicated handover with a delay of `0.35 + (1−calling)·0.6 + (1−comms)·0.5`, plus extra time when nobody is directing or the caller is fighting. The IGL's `responsibilitySharing` scales that extra time.
  - A handover of a single-holder job (entry, support, lurk) releases the old holder in the same call.
  - Freeze time is always elected as an opening.
- **Role interaction (positioning and timing only):**
  - **Entry and trader pair.** The entry gets one paired trader, scored by `tradePriority`, `teammateCover` and distance. The trader follows from up to 30 m.
  - **Entry waits for the trade.** With no trader in range, the entry holds before first contact (pre-execute, at most 5 s per round, scaled by own patience). During the breach the entry waits for the trader inside a short window.
  - **Elected flasher.** `supportFlasher` picks the best-placed teammate with a flash, whatever that player's job, using `supportFlash` and `teammateCover`. Support only gets a bonus.
  - **Escort.** An isolated carrier (no teammate within 14 m) gets one trade escort, chosen by `bombProtection`.
  - **Anchor fallback.** An outnumbered anchor falls back to retake staging. Evidence is identified attackers, up to two separate anonymous sounds, and two or more utility landings on site. The anchor stays if persistent enough (`anchorPersistence`, `retreatTiming`). This never happens while the anchor has a target.
  - **Anchor depth.** Deep holds now come from tendencies and personality through a per-round hash, which consumes no random stream.
  - **Execute entry.** The execute follows the current entry job until the breach, then keeps the named entry unless dead.
- **Snapshot and broadcast.** `LivePlayer.duty` and `dutyReason` are in the snapshot. The broadcast focus card shows `IGL · ENTRY` and similar, with the position and reason in the tooltip. Hexapedia has a new `round-responsibilities` entry.
- **Ablation.** `diagnostics.staticRoles` makes the roster role the round job (headless comparisons only).

### Recorded engine (`fpsIdentityMatch.ts`, `fpsSimulationEngine.ts`, `fpsSetPieceRules.ts`, `fpsPersonality.ts`)

`assignRecordedRoundDuties` runs the same allocator for contextual matches, without travel. It sets the carrier (trade > lurker > sniper > support > entry) and the set-piece entry and trade order. Legacy matches are unchanged. `FpsRoundTactics.duty` and `dutyReason` are recorded in snapshots.

## 3. Invariants to keep

- Roster positions and `role` (the IGL authority and the buy bridge) never change mid-match. Duties are temporary and reset every round.
- The roster prior stays the strongest single term for a neutral roster: T_ENTRY enters, T_SUPPORT supports, T_LURKER lurks.
- One holder per single-holder job. The carrier is not the entry while a healthy rifler is available. Post-plant has no entry.
- Attributes never permit or forbid a job; they enter only through the caller's leadership tendencies. Tendencies and duties affect decisions only, never accuracy, spread, damage or reactions.
- Inputs are lawful team state: teammate HP, position, weapons and utility, and one's own intel. The anchor fallback uses only the anchor's beliefs.
- The allocator consumes no random stream, and handovers never force an immediate re-think.
- Do not restore: permanent `role` checks for round jobs, support-only entry flashes, slot-parity anchor depth, or role-order carrier selection.

## 4. Assignment rules (summary)

| Event | Rule |
|---|---|
| Entry dies | Re-elected at once; the next suitable non-carrier takes entry after the handover delay; the reason names the dead player |
| Entry hurt | About 30 HP or less on a neutral team (earlier with high `roleFlexibility`): hands entry over and plays trade or support |
| AWP picked up | Becomes `sniper` at the next election |
| Lurker best placed | Can take entry, mostly after entry losses near the site; the optional lurk slot falls back to trade |
| Utility | Support goes to who carries it; an aggressive rifler with the grenades still supports |
| Bomb planted | T: entry dissolves into trade. CT: anchors dissolve; one optional retake support |
| CT site empty | One defender from a site with two or more covers it (`Covers A — site left empty`) |
| Nobody directing | No leadership terms; slower handovers |

## 5. IGL and secondary callers

- The designated IGL directs elections.
- When the IGL is combat-locked, the existing `activeCaller` secondary voice directs instead: `secondaryCallerTrust ≥ .45`, and the secondary player needs `midroundInitiative > .58`. A secondary voice has 0.55 of the IGL's authority on leadership terms.
- With no one directing, players self-organise from their own preferences, with longer delays.
- The IGL designation never transfers. Shotcalling sets the caller's handover speed only; leadership identity comes from tendencies.

## 6. Integration points for decision-making work

- **Reading the job.** `duty(p)` is the round job and `p.roundDuty` holds `reason`, `since`, `pending` and `home`. `p.tradeFor` is the entry a player is paired to trade. `p.escortId` is the carrier being escorted.
- **Approach scoring** (`fpsLiveBrain.chooseLiveApproach`) gets the duty as `role`.
- **Call responses** (`evaluateCallResponse`) and action scoring (`evaluatePlayerAction`) do not yet read the duty. That is the natural next step: for example, an entry's pressure weight, or a trader's coordinate weight.

### Guidance for the next agent (decision-making and reactions)

1. **Make action scoring duty-aware first.** This is where roles still have the least effect. Candidates:
   - The entry's `pressure` value when the paired trader is in range.
   - The trader's `coordinate` value when the entry is fighting.
   - The anchor's `prepare` value before the retake.

   Keep it decision-only, and keep the 0.35 own-preference floor in spirit: a duty biases a choice, it does not dictate it.
2. **Trades.** The pairing closes distance, but conversion is decided after the entry's death:
   - The trade reflex (`tradeAlly` in `damage`) picks within 18 m by duty and distance.
   - Check the reaction, re-peek and line-of-sight timing between the trader's `follow` point and the entry's duel angle. The trader often stands where the killer is not visible.
3. **CT reads.** These are where defence is weakest:
   - Individual rotation hesitation on `reinforce` (`rotationCommitment` and `informationVerification` are unused here).
   - The single-death full rotation in `callFallenSiteRotation`.
   - Aggressive defenders who never ask for support.
4. **Don't measure from one match.** Use `scripts/diagnose-role-duties.mjs` with at least 3 seeds per map, and `--static` as the baseline. A 45-round sample has about ±0.07 noise on win rate.

## 7. Measured results

All figures come from `node --experimental-strip-types scripts/diagnose-role-duties.mjs`, run on the final build with 40,000 steps per seed. *Static* is the `staticRoles` ablation, which is the old behaviour. The JSON receipts are in `tmp/role-v3-*.json` and `tmp/role-flash-*.json`.

**Dynamic against static** (seeds 11/22/33 and 55/66/77, both maps):

| | Fontessa dynamic | Fontessa static | Spillway dynamic | Spillway static |
|---|---|---|---|---|
| Rounds | 91 | 96 | 82 | 75 |
| T win rate | 0.68 | 0.68 | 0.62 | 0.52 |
| Ticks with two entries | 0 | 0 | 0 | 0 |
| Round-start entry is T_ENTRY | 82/95 | 101/101 | 72/86 | 81/81 |
| Nearest teammate at an entry's death | 8.5 m | 13.0 m | 10.0 m | 10.3 m |
| Entry deaths traded within 3 s | 5/34 | 3/33 | 5/47 | 7/47 |
| Anchor fallbacks (alive 10 s later) | 6 (2) | 0 | 1 (0) | 0 |
| Carrier escorts / CT coverage moves | 24 / 3 | 0 / 0 | 21 / 6 | 0 / 0 |

- **T win rate.** Pooled across both maps it is 0.65 dynamic against 0.61 static. That is inside sample noise (about ±0.05). Spillway alone leans toward T, at about 1.3 standard errors; watch it.
- **Elected support flashes for the entry** (seeds 11/22/33):
  - Fontessa: 21 in 44 rounds. 16 came from the support job and 5 from riflers or AWPers. Static: 6 in 49, all from support.
  - Spillway: 24 in 43. 15 came from the support job and 9 from others. Static: 2 in 37.
  - Flashes for a teammate already fighting: 6 on Fontessa against 0 static.
- **Trades.** Spacing improved on Fontessa only. Trade conversion did not measurably improve.

**IGL identities** (same roster on Fontessa, seeds 11/22/33, both teams' IGLs set to the preset; about 45 rounds each):

| IGL preset | IGL on first contact at round start | IGL on support | Round-start entries by position |
|---|---|---|---|
| Fragging playmaker | 15/46 | 2 | T_ENTRY 30, T_IGL 15 |
| Tactical architect | 2/48 | 9 | T_ENTRY 44 |
| Player-centric facilitator | 4/46 | 14 | T_ENTRY 31, T_FLEX 10; 28 AWP handovers |
| Adaptive mastermind | 3/49 | 4 | T_ENTRY 37, T_FLEX 9; 20 lurker-to-entry handovers |

**Coaching** (Fontessa, seeds 11/22/33):
- Structured coach: T_ENTRY starts 47/48 rounds as entry and is the execute entry 36/44 times.
- Free coach: T_ENTRY starts 28/48 (T_FLEX 15), and execute entries are spread: T_ENTRY 19, T_FLEX 14, T_SUPPORT 7.

**First kills** involve the entry job in 12–27% of rounds, in both modes.

## 8. Remaining weaknesses and edge cases

> Updated by sections 11–12. Since then: rotators have individual hesitation, a single lost anchor no longer pulls the whole team, CT homes come from positions, action scoring reads the duty, and trades have swings and second responders. The rest below still stands.

- **First kills rarely involve the entry job** (12–27%). Openings happen in Mid, through CT aggression or the lurker. Where first contact happens is a map-control decision, outside this pass.
- **Entry trades within 3 s stay low**, especially on Spillway. The pairing and holds shorten gaps; the trade itself is decided by the duel and reaction systems.
- **Rotators pick by path travel only.** There is no individual hesitation on `reinforce` (incomplete information), and nobody requests support when aggressive. `rotationProactivity` is read only for coverage moves.
- **Fallen-site rotation** (2026-11-17) still sends the whole team after a single anchor death near the site when no other home defender is alive. This is exploitable by lurker picks.
- **`defenseHome`** still assigns CT_IGL, CT_ROTATOR and CT_FLEX homes by slot order (`slot<3 → A`), so the rotator has no positional meaning of its own beyond the `trade` job.
- **The breach freezes the execute entry.** A hurt entry still swings once the breach starts.
- **T AWPers** use the generic `control` approach weight. `sniperPriority`, `delegation`, `informationDemand`, `teamProtection` and 12 other IGL keys are still unused.
- **Recorded 2D movement** does not read CT duties (defensive posts are by index), and it has no metric travel.
- **The `leadershipAbsent` trigger** (`callerAlive`) counts the support job as a caller. This quirk was there before; it now reads the duty.
- **The T-side bias is unchanged and unexplained** (see results). GPU and live-browser review were not done.

## 9. Modified files

- New: `EsportsClash.Web/src/fps/fpsRoundResponsibilities.ts`, `EsportsClash.Web/src/fpsRoundResponsibilities.test.mjs`, `EsportsClash.Web/scripts/diagnose-role-duties.mjs`.
- Modified: `EsportsClash.Web/src/fps/fpsLiveSimulation.ts`, `fpsIdentityMatch.ts`, `fpsSimulationEngine.ts`, `fpsSetPieceRules.ts`, `fpsPersonality.ts`, `fpsReference.ts`, `EsportsClash.Web/src/components/FpsLiveBroadcast.tsx`.

## 10. Tests and performance

- `npm run check:game` (from `EsportsClash.Web`): **548/548** pass, plus `tsc -b` (the baseline before this pass was 531/531). The log is `tmp/role-check-final.log`.
- New tests: `src/fpsRoundResponsibilities.test.mjs` (17). They cover:
  - Uniqueness over 300 random teams.
  - Spawn-based first contact.
  - The hurt entry handover, and the AWP job.
  - A utility-carrying aggressive rifler taking support.
  - Fragging against tactical IGLs, and player-centric star protection.
  - Identical attributes with different personalities.
  - Attributes not gating jobs.
  - Structured against free coaching.
  - CT anchor re-election and coverage, and retake jobs.
  - The broadcast snapshot.
  - The communicated (non-instant) entry handover.
  - The elected flasher, compared with the ablation.
  - Anchor fallback, including no fallback during a visible duel or against one attacker.
  - Recorded-engine parity, the ablation itself, and the escort.
  - A regression for the post-plant round-start bug found in diagnostics.
- One existing test failed during development: Pro Regression 12. A handover forced a re-think and woke a frozen actor. Handovers now respect the normal think cadence.
- **Performance** (`node scripts/benchmark-live-fps.mjs --seeds=1337,9127`, machine otherwise idle):

  | Map, seed | p99 tick | Max tick |
  |---|---|---|
  | Fontessa 1337 | 10.5 ms | 34.2 ms |
  | Fontessa 9127 | 7.7 ms | 15.6 ms |
  | Spillway 1337 | 9.0 ms | 37.0 ms |
  | Spillway 9127 | 7.9 ms | 21.5 ms |

  The previous record was a p99 of 9.8–13.6 ms with 52–72 ms spikes.
- **Allocator cost.** One team election is about 0.12 ms. Elections run once a second per team, and at once after deaths. They use straight-line distance, not pathfinding, and handovers never force re-thinks.
- Not done: GPU and live-browser review of the focus-card change, and a backend or PHP suite run (no backend files changed).

## 11. Continuation: the open items (same day)

The owner asked to do the items left open above. This section records that work; earlier sections describe the first pass and are kept as written.

### Changes

- **Trades.** Diagnosis (`scripts/diagnose-trades.mjs`): about 60% of untraded T deaths had a teammate within 18 m who could not see the killer. The reflex only snapped when the trader already had sight.
  - The paired trader now has first claim on the trade (up to 24 m); otherwise the closest teammate takes it.
  - Without sight, the trader commits a **trade swing** once the victim's lawful death call has landed. It is a wide or crouch swing (by `wideSwing` and `crouchPeek`) toward the called position.
  - When no step-out spot exists within 2.8 m (`findPeek` failed in 56 of 77 swings), the trader retakes the angle the teammate died on and stops at the first point that sees the called position.
  - An opening smoke lineup is dropped for the swing.
- **CT setup from positions.** `ctSlot` replaces roster order. Homes, stacks, the aggressive pair and the Mid pair now come from the assigned CT position, so any listing order gives the same 3–2 split. Default-ordered lineups are unchanged.
- **Rotator first.** `rotationCost` makes CT_ROTATOR the first rotation responder, then players by `rotationProactivity`, then by travel.
- **Measured fallen-site response.** A full, firm rotation needs commitment evidence: two defenders lost there, site pressure strength ≥ 1.6, or the device seen there. One lost anchor sends at most two rotators, and the other site stays guarded. If evidence escalates, the call is upgraded. Orders carry `firm`.
- **Rotator hesitation.** On a non-firm call, a responder with fresh own contact at home holds and reports, unless `rotationCommitment` is high. Verifiers briefly confirm a `reinforce` call (`rotationHesitation`).
- **Duty-aware action scoring.** `dutyActionBias` adds small decision-only terms to `evaluatePlayerAction`:

  | Job | Term |
  |---|---|
  | Entry | Pressure +0.18 with a trader in range, −0.05 without |
  | Paired trader | Coordinate +0.15 |
  | Utility support | Coordinate +0.12 |
  | Lurker | Probe +0.1; pressure +0.2 on the breach |
  | Anchor and AWP | Prepare +0.12 |

- **Fixes found while measuring:**
  - A vault that timed out inside the Mid window frame left the player wedged in the lintel. It now finishes the drop. A player killed mid-vault is settled on the landing (`settleDeadVaulter`); the corpse keeps the real death point.
  - Re-issuing the same fallen-site rotation reset `issuedAt` and `readyAt` every 8 s. Responders re-acknowledged and briefly paused each time; the original call is now kept.
  - Rotation responders acknowledged with their job ("holding my site solo") instead of the order. They now say "on my way to A".
- **Ablation.** Every new behaviour is off under `diagnostics.staticRoles`. Static runs reproduce exactly from build to build: 0.59 over 37 rounds, and 0.56 over 43 rounds.

### Results before the forks (6 seeds per map per arm; T deaths before the plant)

| | Fontessa dynamic | Fontessa static | Spillway dynamic | Spillway static |
|---|---|---|---|---|
| Rounds | 88 | 86 | 82 | 77 |
| T win rate | 0.74 | 0.63 | 0.46 | 0.64 |
| Traded within 3 s | 17/113 (15.0%) | 20/137 (14.6%) | 18/185 (9.7%) | 14/139 (10.1%) |
| Trade swings (T / CT) | 59 / 98 | 0 | 93 / 58 | 0 |

- **T win rate.** Pooled it is 0.61 dynamic against 0.63 static. The per-map gaps point in opposite directions and are seed noise. Separate seed groups of about 40 rounds range from 0.30 to 0.76 on the same build, so compare at least 170 rounds per arm.
- **Trade conversion is unchanged within noise.** Swings now happen and produce kills, but conversion is decided by the duel after the trader arrives.
- **Measured rotations and hesitation** are rare. There were 1–5 measured rotations per ~42 rounds. Verify holds happened twice per map, and own-contact holds never.

## 12. Forks: trade conversion, hesitation, browser review, whole system (same day)

The owner asked for one fork per remaining job, plus a whole-system review. Each fork owned separate regions. The parent ran the final gate on the merged tree.

### Trade conversion (`fpsLiveSimulation.ts`: trade reflex in `damage`, trade-follow in `decide`)

- **Causes.**
  - "Never had sight" is the largest untraded bucket. Only one teammate reacted, and a swing that didn't regain the line lost the trade.
  - The follow point sat behind the same corner the entry died around.
  - Not facing the killer was ruled out (in view on 3,031 of 3,493 line-of-sight ticks).
  - Many traders target the killer but never fire. That comes from the normal reaction wait plus the killer re-positioning within about 0.8 s, which is gunfight work and was left alone.
- **Changes.**
  - A second teammate within 14 m also commits to the trade. Without a line to the called position, that player swings 0.25 s after the death call lands. Otherwise only the think time is moved up; no reaction shortcut and no information before the call.
  - The trade-follow point tries straight behind, then ±1.6 m and ±2.8 m sideways, taking the first spot with a line to where the entry is looking.
- **Tests.** `src/fpsTradeConversion20261117.test.mjs` (3). `diagnose-trades.mjs` gained `--both` (CT deaths too) and per-death breakdowns.

### CT rotation hesitation (`rotationHesitation`, `laneContact`, the CT part of `callFromInformation`)

- **Why it was inert.** About 90% of CT calls that send rotators are firm (losses, the device, all located). The few weak calls happened when the responder's own information agreed with them.
- **Changes.**
  - The home lane is now the site plus its entries, holds and Mid split. Lane contact means one identified attacker, two separate sounds, or one confident fresh sound on site.
  - Sounds-only reinforce calls are verified first, scaled by `informationVerification`, `rotationCommitment` and the caller's `uncertaintyTolerance`.
  - The caller sends one fewer responder when the other lane is still contested.
  - Unchanged re-issued calls keep their call time.
- **Effect.** Holds remain rare: 2 in about 89 Fontessa rounds, and both calls turned out right. Making hesitation matter needs ambiguous T play (fakes, splits, sound-only pressure).
- **Tests.** `src/fpsRotationHesitation20261117.test.mjs` (5). `diagnose-role-duties.mjs` counts `noiseVerifies`, `laneHeldCalls` and `holdOutcome`.

### Browser review of the focus-card round job

- **Method.** Headless Chrome (SwiftShader) at 1920, 1280, 768 and 390 px; Fontessa rounds 1–3, including a plant.
- **Findings.** Chips fit on one line, update live (handover, coverage, post-plant and retake changes), and tooltips are correct.
- **Fixed.** The chip was hidden at 768 px and below. There is now a compact chip in `fps-live-broadcast.css` (≤768 px media query).
- **Also fixed.** The fork found misleading reasons after phase changes. `reasonFor` now says "Post-plant — hold a trade angle on the device" or "Retake — trade into the site together", and a test covers it.
- **Limits.** No GPU frame-rate claim; Spillway was not captured.

### Whole-system review (app shell, Hexapedia, world, Laravel)

- **Connections fixed.**
  - Scouting now has an entry point: the sidebar "Scouting & System" section and Club home links.
  - The World Desk now appears on Club home.
  - The sidebar footer link goes to the guide.
  - The guide has a new "Roles & round jobs" chapter linking to the round-responsibilities reference, plus a Supporter studio chapter split out and the 1–10 scouting rule stated.
- **Sound.** The top-bar Sound/Muted button was removed from `App.tsx`. Master sound and music stay in Settings; broadcast audio is untouched.
- **Scalability fixed.**
  - Bulk-primed player rows (`WorldPlayerProfiles::prime`), so a directory or roster page costs the same queries as one row.
  - Per-request memoised identity readiness.
  - Indexed catalog lookup and batched tournament rows.
  - Hexapedia search cached for 10 s per world revision.
  - Leaner club record selection.
  - New guarded index migration `2026_11_17_000003_index_world_directory_scaling.php`, exercised only on the test database.
  - Hidden tabs stop polling (`visibleInterval` in `worldLive.ts`).
- **Recommended, not done.**
  - Trigram or searchable-column player search (it currently scans the whole table with `LIKE`).
  - A per-club record table instead of loading every fixture.
  - Stop the fixed timers while the WebSocket is connected.
  - Return only 1–10 values from the public API.
- **Tests.** Backend focused suites 80/80, including the new `WorldDirectoryScalingTest` (3). Six pre-existing fixture failures (missing manager-chosen T/CT roles) were fixed in the test fixtures only. Frontend focused tests 22/22.
- **Limits.** Signed-in screens were not rendered. The full backend suite was not run, and no production migration or deployment was done.

### Merged tree: final verification

- `npm run check:game`: **564/564** pass, plus `tsc -b`. `npm run build` passes.
- **Seeded comparison** (seeds 11/22/33 and 88/99/111, `diagnose-trades --all-deaths --both`; deaths traded within 3 s, both sides, before the plant):

  | | Fontessa dynamic | Fontessa static | Spillway dynamic | Spillway static |
  |---|---|---|---|---|
  | Rounds | 88 | 86 | 85 | 77 |
  | T win rate | 0.61 | 0.63 | 0.68 | 0.64 |
  | Deaths traded | 9.3% (32/343) | 8.1% (27/334) | 7.6% (27/353) | 6.2% (20/322) |

  Pooled T win rate: 0.65 dynamic (173 rounds) against 0.63 static (163 rounds), within noise.
- **Benchmark** (seeds 1337 and 9127): p99 8.8 / 10.1 ms on Fontessa and 13.8 / 11.1 ms on Spillway, with max ticks of 18–37 ms.

