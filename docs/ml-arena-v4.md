# Learned arena controller and readable evidence, 2026-10-23

The owner explicitly approved replacing strategic restrictions with learned decisions in existing matches. They subsequently confirmed that **all three barracks** must fall before the Nexus can be attacked. The earlier safe-macro-only boundary and one-barracks Nexus unlock are historical rules.

## What now runs

Ordinary arena simulations use a shared 48-input, 32-hidden-unit command scorer. It chooses movement, basic-attack targets, skills, ultimates, recalls, wards and Kaelen orb/invoke commands. The former authored strategic loop is bypassed. Historical DEV experiments explicitly select `legacy`; an invalid arena model cannot silently switch to that controller.

The engine still enforces damage, resources, cooldowns, ability levels, range, visibility, terrain, crowd control and attack windups. Item builds, item procs and individual ability effects remain authored. The action interface does not provide unrestricted free aim or every possible inventory decision. This is an implemented learned controller, not established unrestricted mastery of the game.

Mechanical structure order is **outer turret → inner turret → Nexus turret → all three barracks → Nexus**. `structureProtection.ts` is shared by live damage, legal targets, the simplified simulator and siege charges. Damage is checked again at impact; protected structures show their prerequisite in both arena presentations. Protection is independent of learned strategy.

`arenaPlaybookV3.json` contains five mechanical explanations and 12 detailed lessons: progression, farming/waves, target selection, resources, movement/dodging, teamwork/roles, turret risk, objectives, vision, recalls, individual spells/Kaelen and converting advantages into wins. Offline numerical examples encode starting preferences; the small neural model does not interpret prose at runtime. The live spectator and ML report expose the written brief and explain this distinction.

The v3 foundation used 61,952 synthetic training examples and 2,048 held-out examples. Imitation MSE was **0.0053354036**. This measures approximation of instructional examples, not competitive improvement. Earlier foundation files and teaching scripts remain preserved. The signed job plan binds the exact playbook and foundation hashes:

- Playbook: `0598e9d24e0f1e11ff55f697724e660da8a33dc130d26f945a46a912c2e3b01c`.
- Foundation bytes: `0cefff73901294621af9f55cae80bb2df68c0744a17c777b0d1346edbc891d52`.

## Learning, previews and qualification

Candidate-scoring PPO uses actual browser-engine trajectories, a centralized training-only critic, elapsed-time rewards, on-policy probability checks and complete optimizer/RNG checkpoints. Full-cap censored unrolls bootstrap the critic; an interrupted process cannot be presented as a terminal match. Packed float32 candidate sets and one match per update bound memory. Experimental actors can continue into a later compatible study without being promoted; exact original actor bytes preserve identity across PHP/JSON serialization. The comparison incumbent remains the qualified actor or instructional foundation.

New matches may load explicitly labelled experimental checkpoints. Browser matches, peer rooms and authoritative online plans freeze the model at their start. Source mismatches select the compatible foundation or reject an incompatible peer room. New browser match reports retain the actor for same-version replay. The private mechanical terminal fixture is unavailable to ordinary spectators and is forbidden in qualification evidence.

Version4 qualification requires 32 independent fresh seed groups, both sides, two drafts, repeated controls, the planned bounded opponent league and a positive 95% paired improvement bound. Extra deaths are reported as diagnostics rather than restoring a strategic no-death veto. Historical version3 gates remain unchanged. Known seed47 controls are excluded from benefit evidence. A censored full-cap baseline can establish repeatability only; held-out censoring cannot become a win or a passed gate.

Reports explain the experiment, actual stage, recorded outcome changes, uncertainty, optimization measurements, failures and remaining limits. Partial evaluation tallies stay explicitly unfinished. Descriptive deaths, last hits, unspent gold, champion damage and duration do not independently establish better play. Raw JSON is collapsed. A report displays a teaching brief only when its frozen hash matches.

## What was actually verified

- **508 game tests**, three additional simulation tests, TypeScript and production build pass. Logs: `.local-tools/arena-v4-terminal-verified-{check,build}.log`.
- **54 Laravel tests / 433 assertions**, **43 Python worker tests**, five strategy/registry tests pass. Worker tests include independent recomputation of synthetic arena qualification and preserve the historical death gate. Synthetic tests are never gameplay-benefit evidence.
- The prior complete-image preflight passed 506 tests, the three simulations and build under one CPU / 2 GiB. Its measured tests took about206s plus117s for the additional simulation suite; version4 now allows600s for the required checks. The final study independently reruns508 tests/build in its own frozen image before baseline collection.
- A known full-cap self-play run produced **7,959 transitions**, updated PPO, restored the checkpoint exactly and changed greedy play/world state. Its 120s greedy control recorded1,653 choices; the trained arm recorded1,734. These are influence measurements, not evidence that the choices improved. The foundation control **did not finish within1,200 simulated seconds**. It is censored, not a win. Preserved record: `ml-arena-v4-verification-20261023.json`; raw files remain in `.local-tools/arena-v4-engine-check-20261023-e/`.
- Final review found a same-tick terminal-credit edge. The corrected collector retains legitimate zero-duration terminal transitions, marks a started winning attack before the match closes and stops further controller decisions after game over. A deliberately synthetic private fixture destroyed the Nexus through the real damage path, retained **five same-tick terminal rows** and completed PPO. Record: `.local-tools/arena-v4-terminal-engine-20261023/terminal-edge-proof.json`. It cannot qualify competitive improvement.
- A real headless ordinary Developer Random match displayed **30 choices / 30 commands started**, the foundation label and the detailed lessons; the private trusted bridge was absent. Screenshot and checks: `.local-tools/arena-live-ui-20261023/`. The real new report also renders with its exact frozen brief. Room creation through the local web proxy returns the source-pinned arena actor.

## Current local run and immutable history

Current source hash: **`6bdaf0aefa29d91e17cc6063e3e6706fd9dcc946c7e6ca31fb9e6a71ac52066c`**.

Current study: **`a0d353cf-5ca3-4690-85e7-b9399780bead`**, version4 / `arena`, reserves **62001–63000**. Evaluation seeds are **62257–62288**, separate from its training seeds and known engineering fixtures. The last directly observed stage was **self-play, with at least three completed updates**, after its own software checks and four reproducible baseline controls. At least three real research checkpoints have now been published. A fresh ordinary spectator was verified displaying **experimental checkpoint / update3**, and a peer room loaded the compatible research actor. The first two updates used7,981 and8,556 transitions respectively. Independent competitive benefit and a qualified arena champion remain unestablished. New matches can now use the labelled research checkpoints; a running match retains its frozen version. Evidence: `ml-arena-v4-live-checkpoint-20261023.json` and `.local-tools/arena-live-checkpoint-ui-20261023/`.

Local schedule: arena learning enabled,30-minute invocation windows,24-hour total allowance, the existing single-simulator resource limits and automatic recovery of budget windows. Pausing selected intelligence automation no longer silently starts the old trainer. Source/judge/runtime changes still require a new study.

Retained attempts:

- Former v3 parameter study `28a52c48-5f08-4b89-97b4-eb56389063bf`,58001–59000: normally cancelled for this approved direction change.
- Intervening legacy scheduled `ee52ab27-ae43-4569-926f-ee677b12c236`,59001–60000: failed its time budget. `2c2f83fb-3331-45f5-95fe-d93948080a1e`,60001–61000: completed legacy work. Neither establishes arena-controller improvement; their records and seed allocations remain.
- First v4 study `47b8f1ff-0517-48f1-8371-5c3583b3ab8a`,61001–62000: normally stopped for the terminal-recorder correction. Its original source/image/plan stay preserved; its seeds were not reclaimed.

Only local development was updated. Runner image: `sha256:0d33ab87e5f30694778957db77342f870b58c07af037a2a91d9de2a21d19d6cc` (`teamfight-evolution-runner:arena-v4-terminal`). Online image: `sha256:e682164efb3c5984dfbc46eca7dba8aa872800ef5e9c08e9b8076193d5d95981`. The card catalog remains byte-identical, ID `79f8710120bea9194262c257763a3f9e481caf9626a09551caf4e6023755a3c9`; owned cards were preserved and the rules switch refused active matches. Avatar/TRELLIS/rigging workers and asset bytes were not changed. No production/Vercel publication or paid/cloud compute occurred.

After any future simulation-source change, freeze a new worker image, install its compatible online manifest between matches, and restart the local Vite/room processes so their source pins match. Do not resume this frozen study under different code. Improvement remains **unproven**; initial learned policies can stall or play poorly, and every reported advantage must come from the independent gate.
