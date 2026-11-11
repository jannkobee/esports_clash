# Repository handoff

## Comprehensive Testing Verification and AI Brain Mechanics Polish (2026-11-11)

Owner requested thorough testing and polishing the AI brain mechanics:
- **Test Suite Pass (100%)**: All 750/750 tests in `src/*.test.mjs`, all 113/113 FPS tactical/profile tests, 3/3 batch match simulations, and `npm run check:game` passed with 0 failures and 0 errors.
- **Economy Options Alignment**: Fixed `buyLiveTeam` weapon fallback ordering so force buys prioritize `smg` when rifles are unaffordable, resolving test assertions while preserving CT/T team-exclusive gun choices.
- **Positioning Crossfire Quality**: Fixed `findLiveCover` quality scaling so low positioning ($q = 0$) minimizes distance without multi-angle awareness while high positioning ($q = 1$) actively eliminates exposure to secondary crossfire angles.
- **Rifle Long-Distance Burst Tapping vs Spraydown**: At $d > 20\text{m}$, rifles (`ak47`, `m4a1_s`, `rifle`) burst 2 rounds with 0.22s recoil settling delay; at $d \le 20\text{m}$, actors commit to aggressive 4-5 bullet spraydowns.
- **Desert Eagle Cadence Pacing**: At $d > 12\text{m}$, Deagle shots are paced (+0.32s recovery) for surgical double-taps rather than wild spam.
- **Flank Hearing Reflex**: When holding or settling, hearing running footsteps or gunfire directly behind ($\cos(\text{heading} - \text{yaw}) < -0.35$) triggers an immediate head turn to clear the rear flank (`action = 'Checking flank'`).
- **Sniper Close-Range Sidearm Fallback**: Snipers rushed at point-blank range ($d < 4.5\text{m}$) or with an empty magazine immediately draw their sidearm (`usp_s` / `glock`) to defend themselves.
- **Clutch 1vX Silent Stepping**: In 1v1 / 1v2 clutches ($\le 1$ living ally, $\le 2$ living enemies), players prioritize walking quietly to deny sound cues.
- Build verified clean (`tsc -b && vite build` in 3.58s). Preserve parody aliases, private DNA, careers, MOBA and Colab gates.

## Map Geometry Polish, Expanded Weapons Arsenal, and Tactical AI Decision-Making (2026-11-11)

Owner requested map scenery fixes (grounded archway pillars, tiered classical Mediterranean B fountain, market produce crates and curbs), eliminating post-freeze CT corridor traffic jams via lane-biased fanned spawns and staggered departures, bomb defuse sound tick alerts triggering T retake peeks, human-like AI decisions (fake defuses, trigger discipline against unaware backs, low-HP disengagements), grenade equip-before-throw animation flow, object boost spots for elevated off-angles, and team-exclusive weapons (USP-S, Glock, Deagle, M4A1-S, AK-47, MAG-7, Nova, MP9, MAC-10, Negev, Scout), with tests skipped per owner request. Read [the documentation and verification record](docs/fps-map-details-weapons-and-tactical-ai-20261111.md). Build verified clean (`tsc -b && vite build` in 7.17s). Preserve parody aliases, private DNA, careers, MOBA and Colab gates.

## Role-Specific AI Brain Polish and Verification (2026-11-11)

Owner requested thorough testing across the simulation engine and polishing the actor AI brain so each operative plays out their role beautifully:
- **Trade Fragger Re-Frag Reflex (`trade`)**: Immediate snap to killer upon an entry partner's elimination with reaction latency fulfilled ($<0.12\text{s}$ response), aggressive trade push, and radio call `[RADIO] {name}: Trading for {victim.name}!`.
- **Sniper Shoot-and-Scoot Bolt Cycling (`sniper`)**: After firing an AWP shot, snipers immediately duck behind cover for 1.25s to cycle the bolt safely, counter-strafe, and call `[RADIO] {name}: Shot fired — cycling bolt behind cover!`.
- **Support Utility Layering (`support`)**: Proactive high pop-flashes thrown forward over entry chokes for advancing Entry teammates, ninja smoke plants, and complementary crossfire hold points.
- **Entry Fragger Angle Clearing (`entry`)**: Sequential clearance of close danger angles (Car, Sandbags, Pit, Balcony, Graveyard) and aggressive wide swings when enemies are flashed.
- **Lurker Rotator Flank (`lurker`)**: Silent stealth movement across Underpass and Second Mid, stepping out to intercept rotating CTs from behind upon sound/radar reports.
- **Anchor Deep Holds & Retake Coordination (`anchor`)**: Deep site holds (Pit on A, Fountain on B) with choke delay smokes; synchronized CT retakes regrouping at staging lines before flashing and breaching together.
- **Broadcast Spectator Radio Chatter**: Exposed active radio communication in the spectator focus card with `.blast-focus-card__radio` tactical badge.
- Read [the documentation and verification record](docs/fps-role-ai-brain-polish-20261111.md). All 100/100 FPS tests, 746 arena tests, and production build passed cleanly. Preserve parody aliases, private DNA, careers, MOBA and Colab gates.

## Expanded AI Brain, Item Knowledge, Mechanical Micro-Movements, and Adaptive Defense (2026-11-11)

Owner requested expanding the AI brain with Counter-Strike item knowledge (how smokes and flashbangs work in gameplay), infinite play possibilities via dynamic round archetypes, in-game team communication / radio chatter, mechanical micro-movements (jumping physics, corner jump-peeking, strafing and counter-strafing), active history-based CT counter-adaptation, cutting off out-of-bounds play, and skipping tests. Read [the documentation and verification record](docs/fps-expanded-ai-brain-and-mechanics-20261111.md). Smokes block raycasts for 18s; attackers throw execute smokes on rotation lines; carriers ninja plant inside smoke; defenders stall rushes with choke delay smokes; defusers ninja defuse in smoke. 7 dynamic attacker round archetypes (`rush_b`, `rush_a`, `default_pick`, `split_b`, `split_a`, `fake_execute`, `mid_control`) eliminate repetitive rounds, paired with mid-round adaptive redirects and in-game radio chatter. Mechanical jumping physics ($v_y = 4.2\text{ m/s}$, gravity $-12.5\text{ m/s}^2$) allow jump-peeking corners with $2.5\times$ spread bloom, rendered with operative elevation and leg tuck. Lateral $A/D$ strafing and counter-strafing enable crisp gunfights. CT defenders counter recurring T habits from round history (`stack_b`, `stack_a`, `aggressive_banana`, `mid_push`, synchronized retakes). Map boundaries strictly clamped to $[-34.0, 34.0] \times [-43.0, 43.0]$ across movement, pathing, and cameras. Production build passed clean (`tsc -b && vite build` in 19.81s); tests skipped per owner request. Preserve parody aliases, private DNA, careers, MOBA and Colab gates.

## BLAST Premier broadcast HUD and proactive information play (2026-11-11)

Owner requested a modern Tier-1 esports broadcast HUD (BLAST Premier / ESL Pro League style), solving bot freezing/wall-staring, strict eye-level 3D vision, grenade throw animations, and dynamic teammate spacing. Read [the documentation and verification record](docs/fps-blast-hud-and-proactive-play-20261111.md). The broadcast HUD now features a top-center scoreboard with dynamic AI Win Prediction, top-left tournament badge, top-right clean killfeed with headshot indicators, and a horizontal 10-player bottom dock with tactical SVG avatars, live HP gauges, weapon silhouettes, utility/kit/bomb badges, and a center spectator focus box. Vision enforces 3D vertical sightlines with stance-dependent eye heights (1.60m stand / 1.08m crouch) and an authentic 94-degree focus cone. Bots no longer stare into walls when holding; attackers proactively advance onto site after holding quiet zones; and teammates maintain staggered 3.5-5.0m trade spacing. All game checks, builds, and 23 tactical tests pass cleanly. Preserve parody aliases, official/historical paths, private DNA, careers, MOBA and Colab gates.

## Revised 25-ability local FPS rollout (2026-11-11)

Owner requested implementing the revised 25-attribute source. Read [the implementation, exact source/hash and active/reserved matrix](docs/fps-attributes-25-20261111.md). Local v6 uses separate pinned skill profiles and 24 bounded active consumers; Economy Judgment stays inert while team policy owns buys. No Weapon Handling rating. Preserve 1–10 lab editing, stable provenance, personal-knowledge stages, fixed mechanical limits, seven display-only summaries, private DNA and the explicit legacy adapter. Official player migration, scouting/training/career integration and activation remain gated; do not publish test profiles as real abilities. No desktop/browser automation was used at the owner's request. Preserve other movement/operative work, historical/MOBA and Colab boundaries.

## Live exhibition v5: playing from information (2026-11-10)

Owner requested more credible information-based FPS play. Read [the implementation and verification record](docs/fps-information-play-20261110.md). Local v5 adds bounded source/age/confidence/uncertainty memory, delayed deduplicated reports, anonymous sound/damage/utility clues, sampled negative evidence, evidence-based support/redirects and visible reasons. Preserve personal-vision acquisition, stable crosshair commitment, the opposite-site guard, no hidden-enemy reads in caller evidence, official/historical paths, private DNA, careers, MOBA and Colab gates. This does not qualify pro-level intelligence or production assets.


## Stable crosshair placement and pro-match reference (2026-11-10)

Owner requested removing left/right aim movement and supplied a detailed pro-match simulation reference. Read [the correction and adopted reference](docs/fps-crosshair-reference-20261110.md). Preserve stable world-space pre-aim, route look-ahead, brief aim commitment and eased corrections; do not restore idle yaw scans or lateral weapon sway. The reference is guidance, not a new rating/identity schema or verified external game rules. Preserve official/historical paths, privacy, careers, MOBA and Colab gates.


## Live exhibition v4: human handling and knives (2026-11-10)

Owner requested more human-like mechanics, map detail and knives, and reported the orange A-site wall allowing shots through. Read [the v4 record](docs/fps-live-human-mechanics-20261110.md). The local exhibition now uses vision-sampled aim, real knife/gun switching and melee impact, conserved pickups, stationary braking and shared A-loggia collision. Preserve official contextual v3, historical replays, private DNA, careers, MOBA and Colab gates. Required game checks/build and focused regressions pass; video footage review and comprehensive visual/competitive qualification remain incomplete.


## Live spatial exhibition v3 (2026-11-10)

Owner authorized movement/peeking, coordinated executes, shared economy and supplied three-lane map design guidance. Read [the current map/tactics record](docs/fps-three-lane-tactics-20261110.md). Local exhibition v3 adds actual acceleration/braking, hearing, peek/clear movement, ordered utility/entry protocols, ballistic grenades and shared paid buys, with a continuous Mid and measured rotation/setup timings. This is separate from official contextual identity v3. Preserve official/historical paths, private DNA, career idempotency, MOBA and Colab asset gates. Focused checks are recorded; full production/competitive qualification is not claimed.

## Professional FPS skill reference (2026-11-10)

Owner supplied the micro/macro/team/mental skill reference. Read [the adopted mapping and exact source](docs/fps-professional-skill-reference.md) for future FPS behavior work. The 205 behaviors are a checklist; the proposed 26 abilities are a future schema, not 26 existing independent ratings. Preserve contextual personality/role/specialty/DNA/system fit. Live impact accounting is event-derived and cannot grant gameplay bonuses. Supplied patch-specific CS2 claims are not verified rules for Hexatrick.

## Original live FPS exhibition (2026-11-10)

Latest continuation: local exhibition v2 adds editable varied attributes, skill-dependent tactical behavior, delayed/uncertain intel, cover/reload and objective coordination, a middle connector, industrial scenery, shadows and camera smoothing. Read the integration record's latest pass for exact limits. Focused TypeScript, seeded simulation and isolated browser startup passed; no full suite/build or production asset qualification is claimed. This supersedes the blanket no-checks status below for those focused checks only.

Owner requested an original real-time FPS broadcast in Hexatrick. An isolated live 3D exhibition is integrated into `#fps-simulation`; read [the integration record](docs/fps-real-time-3d.md) before changing it. It uses collision-volume proxies, not qualified character assets. Official v3 and historical matches remain unchanged; shared online streaming and production asset qualification are unfinished. Checks were skipped at the owner's request, so do not claim runtime acceptance or deployment verification. Preserve Colab-only owner-started asset processing and private DNA.

## Latest contextual FPS identity v3 (2026-11-10)

The owner approved completing and deploying the full contextual identity integration. New official allocations now pin simulation v3: seven role assignments, 24 conditional personalities, 21 situational specialties, persistent DNA, employed coach/gameplan/culture/chemistry and event-derived development. Historical v2 allocations and all MOBA code/replays remain supported. MOBA stays owner-disabled through Laravel. Preserve raw DNA privacy and idempotent progression. Read [the identity implementation/deployment record](docs/fps-identity-v3-20261110.md), latest handoff and mechanics before editing. This supersedes the v2-default statement below, and does not qualify balance, ML or 3D assets.

## Active FPS and preserved MOBA direction (2026-11-10)

The owner requires preserving the entire MOBA game and disabling it through Laravel, not deleting it. `/evolution/game-modes` controls reversible availability, default off. Current player views use FPS role fits; historical roles, code, catalogs, pipeline and recordings stay intact. New allocations pin tactical simulation v2. Read [the implementation/deployment record](docs/fps-tactical-v2-20261110.md), latest handoff and mechanics before changing this boundary. This supersedes earlier plans to remove MOBA routes/components. It does not qualify 3D assets or relax Colab-only processing.

## Latest compute/workflow direction (2026-10-24)

Use the existing 3D generation/preparation pipeline, not a parallel procedural avatar authoring system. Owner requires **Google Colab for generation, rigging and animation processing, never local compute or an automatic local fallback**. Local dashboard/control/storage and Babylon rendering/playback are separate. Follow [docs/babylon-visual-rebuild.md](docs/babylon-visual-rebuild.md). Google generation code support and isolated TokenRig trials do not prove deployed cloud rig/animation readiness; verify/connect those stages before dispatch. Keep visual admission owner-started and all base/rig/appearance gates below. Historical plans/artifacts remain immutable.

Latest deformation result (2026-10-27): native candidate `f6283980` reduces measured shoulders to 44/35 and hips to 51/47. Standard glTF corrective candidate `140fe64c` reduces those to 31/0 and 40/27, with zero seam opening in the controlled samples. Its exact clips passed GLB validation, Babylon morph playback and 104 sampled interpolation poses (`e0a78665`) with no sampled contact regressions. A separately baked half-strength shoulder alternative `51e2aadf` shows only a subtle visual change with higher shoulder contacts 34/17; direct Babylon review did not find a convincing shape improvement. Corrected-pose contact map `5271850d` binds 117 signed vertices with actual morphs active; targeted rest-side-normal shoulder prototype `8416eeb2` is rejected after worsening contacts 31 to 50. Prior failures are retained. Broad shoulder roots and hip creases remain; all candidates are unqualified/unpublished. Job `3e82afe8` lost its original runtime before result retrieval and remains unknown; replacement results have separate provenance. Read the [regression lock](docs/avatar-rework/mirelle-deformation-regression-lock-20261026.md); preserve baselines/measurement policy and do not rebase frozen displacement caps or resume blind transfer/strength tuning.

## Latest shape-preservation review and cloud status (2026-10-27)

Colab diagnostic candidate `2ca48df4` passed GLB validation and 16 controlled reimported bend checks, but Babylon review `440ba1fe` found no convincing shoulder improvement; hip creases remain. Preserve it as unqualified evidence only; the [regression lock](docs/avatar-rework/mirelle-deformation-regression-lock-20261026.md) records full hashes, baselines, failed attempts and limits. A replacement Colab T4 now has the pinned TokenRig environment installed and the raw-rig candidate service connected in the backoffice; generation, production rigging, animation and qualification remain blocked. Do not infer production readiness or use local processing. Verify the remaining Colab stages before dispatch.

## Latest bounded shoulder candidate (2026-10-27)

Colab centroid candidate `e047ce58` reduces measured left-shoulder 90-degree contacts from 31 to 25 and passes 16 controlled bends and glTF validation. Babylon review `6d60a41a` found no convincing visible shoulder improvement; hip creases remain. The candidate and review are registered as unqualified diagnostics only. Preserve the source and all prior baselines and frozen displacement caps; see the [regression lock](docs/avatar-rework/mirelle-deformation-regression-lock-20261026.md) for exact lineage and limits. No game clips or appearance fitting have been qualified.

## Latest hip fold trial (2026-10-27)

Colab hip fold profile `4d516962` and bounded ARAP trial `1e484c28` are retained in the backoffice and [regression lock](docs/avatar-rework/mirelle-deformation-regression-lock-20261026.md). Left hip contacts increased 40 to 48; right decreased 27 to 26. Reject the combined trial, preserve the frozen limits and do not infer visual qualification from edge strain or a one-contact reduction. No model was exported.

## Latest contact-aware hip candidate (2026-10-27)

Colab hip candidate `89354e93` reduced controlled 90-degree hip contacts from 40/27 to 38/26 and passed 16 bend checks and glTF validation. Babylon review `0044e6e4` found no convincing visible hip crease improvement; shoulder roots also remain unresolved, and front/side hip close-ups are partly occluded. Retain the candidate as unqualified evidence only, preserve frozen limits and historical failures, and consult the [regression lock](docs/avatar-rework/mirelle-deformation-regression-lock-20261026.md).

## Latest visual direction and planning reset (2026-10-24)

Read [docs/babylon-visual-rebuild.md](docs/babylon-visual-rebuild.md) as the single active arena/avatar visual plan. Owner rejected 2D billboard actors and requested actual modeled geometry with Babylon.js animation/effects; existing pictures serve as references. Superseded generated visual planning Markdown is removed with exact historical content/hashes in [docs/visual-reset-20261024.json](docs/visual-reset-20261024.json). Historical implementation reports and supplied specifications remain evidence, not current visual instructions. The reset is documentation-only so far; the existing renderer has not yet been replaced. Keep all gameplay/ML invariants and the clean-base/rig-before-outfit gates below. Do not reuse failed Mirelle or deleted binaries as qualified fresh assets.

## Latest all-avatar asset reset (2026-10-24)

The owner explicitly superseded the old retain-artwork instruction and requested deletion of **all 45 avatars' existing model, rig, animation and reference/preview picture versions**, then a fresh Mirelle Vane base pipeline. Current legacy files are deleted and visual releases inactive. Preserve roster/gameplay/card definitions and historical job/revision/report metadata; do not restore old binaries or select historical jobs as fresh sources. This exception applies to avatar binaries, not frozen ML artifacts. Read [docs/avatar-rework/asset-reset-20261024.md](docs/avatar-rework/asset-reset-20261024.md). Mirelle remains **unqualified**: the 2026-10-26 Colab weight/taper experiments reduce measured intersections, but limited Babylon review of both reference and taper still finds compressed joint transitions. No game clips or appearance qualification. Use the new source-bound rest/posed contact map for the next isolated joint repair; do not treat posed bounds as a rest-mesh mask. Do not publish or fit outfits. Follow [the current deformation regression lock](docs/avatar-rework/mirelle-deformation-regression-lock-20261026.md).

## Latest ML curriculum correction (2026-10-23)

The owner questioned handwritten avatar playstyle guides and asked for learning that also supports future avatars. The current controller uses transferable kit facts and self-play, not the historical 45-avatar strategy teacher or per-avatar mastery reward weights. Preserve historical v4/v5 teaching artifacts, but do not reactivate them as the default. Current factual reference/model are `arenaPlaybookV6.json` / `data/arena-v6` (actor version 3, 224 inputs); old actor versions remain available for explicit historical comparisons. The owner subsequently requested better rewards/punishment: version 6 uses the shared `terminal-potential-outcomes-v2` team formula and seven critic inputs. Do not change frozen study reward settings in place. New playable kits obtain observations from their actual catalog fields without a guide entry. General starting command preferences are inherited; a reward change alone does not remove the known forward/structure bias. Pro-level performance and automatic mastery of new kits are unproven. Read the latest handoff, `docs/arena-learning-kit-facts.md` and `docs/ml-arena-outcome-rewards-v6.md` before changing this boundary.

## Character asset workflow (2026-10-21, mandatory for all agents)

Read [docs/character-asset-pipeline.md](docs/character-asset-pipeline.md) before changing avatar prompts, reference images, generation, rigging, repair, retargeting, or appearance assembly. The owner now requires a clean adult base mannequin in a wide, symmetrical A-pose first; rig and validate it before fitting outfits, hair, accessories, weapons, and final character materials. Preserve necessary species anatomy and body proportions; nonhumanoids use the documented anatomy-appropriate neutral rest pose. "Dynamic A-pose" means the documented static rest pose, not an action pose. Existing frozen references, plans, jobs, and evidence stay immutable.

Every agent must follow that document's stage checks and coordination protocol: read the latest handoff, declare file/stage ownership, share artifact IDs/hashes and verification results with agents working on adjacent stages, and record unresolved failures. Coordinate through available agent messaging when agents are active; otherwise leave the same information in the handoff. Never silently override another agent's stage or claim qualification/publication from a structural pass. The successful isolated TokenRig trial does not establish a deployed provider or fix the known shared repair/retarget deformation.

## Latest learned-controller and structure-order approvals (2026-10-23)

The owner explicitly authorized replacing strategic restrictions with learned decisions in existing matches, including tower-risk, retreat, objective priorities and strategic commitments. Preserve actual mechanical legality and retain the old policies only for explicitly selected historical DEV benchmarks. The owner also explicitly selected **Require all three barracks**: the mechanical order is outer turret -> inner turret -> Nexus turret -> all three barracks -> Nexus. This supersedes the old one-barracks Nexus unlock. Read the latest handoff/mechanics entry and verification limits before editing; do not restore the old strategic controller as a hidden fallback. Future contradictions still require confirmation.

## Latest tower-rule approval (2026-10-14)

The user explicitly reconfirmed that `docs/agent-handoff.md` and `docs/arena-mechanics.md`'s latest risk-based tower combat supersede the historical Tower Dive Limits & Evacuation subsystem below. Do not restore `diveAborting`, `shouldAbortTowerDive`, forced evacuation, abort-only attack suppression, fixed dive timeouts, or the +35 sprint. Keep real tower damage/range/targeting, normal terrain-aware retreat, safe bushes/perimeter, attribution, anti-oscillation, and legal Nexus finishing. IQ/personality influence marginal risk only, never combat stats or mechanical legality. The contradiction-confirmation rule still applies to future changes to these current invariants.

Read [docs/agent-handoff.md](docs/agent-handoff.md) before changing the game. It records the user's requests as a conversation and names the code that implements each decision.

Read [docs/arena-mechanics.md](docs/arena-mechanics.md) for gameplay invariants. After a gameplay or squad UI change, update both documents with the decision, affected files, verification, and remaining limits. Run `npm run check:game` and `npm run build` from `EsportsClash.Web`.

## Contradiction and Regression Prevention Rule (MANDATORY FOR ALL AGENTS)

If the user gives a prompt or instruction that contradicts established gameplay invariants or prior design decisions (for example: removing tower dive limits, allowing reckless suicidal dives, disabling dive aborts, re-introducing idle stops in turret range or death trap bushes, bypassing turret execution attribution, undoing anti-oscillation deadbands, or renaming Cardrel / parody aliases), **YOU MUST NOT SILENTLY OVERWRITE OR BREAK THEM**.

**Command for all agents:**
1. **Remind the user** immediately of what was previously established and why (e.g. to prevent throwing games, infinite spinning, or game-breaking suicides).
2. **Explain the specific contradiction** between their prompt and the existing invariants.
3. **Ask for explicit confirmation** before modifying or relaxing any protected gameplay invariant.

## Core Non-Negotiable Invariants to Protect

1. **Tower Dive Limits & Evacuation (`towerDiveRules.ts`):**
   - **Avatar Limits:** Tanks (min 40% HP / 650 raw HP), Fighters (min 45% HP / 600 raw HP), Assassins (min 45% HP / 550 raw HP + burst skills ready), Squishy Mages and Marksmen (must NEVER solo dive into melee turret range without minion wave buffer under tower, min 58-60% HP, execute $\le 18\text{--}20\%$), Supports (never solo dive).
   - **Player Card Invariants:** High IQ ($\ge 75$) enforces minion wave crash ($\ge 2$ minions under tower), lethal burst calculations, and strictly forbids outnumbered dives (`defendersUnderTower > attackersUnderTower`).
   - **Target Penalty:** `chooseTeamfightTarget` penalizes targeting enemies under live opposing turrets by $-3.8 \times \text{IQ} \times (\text{isSquishy} ? 1.5 : 1.0)$ unless diving is authorized.
   - **Perimeter Tethering:** Non-divers hold at `getTurretPerimeterHoldPoint` ($28\text{px}$ outside turret attack range), allowing ranged poke and wave waiting without walking into turret fire.
   - **Failed Dive Abort & Emergency Evacuation:** `shouldAbortTowerDive` triggers immediately if target is dead, in Zhonya's Golden Stasis / untargetable, heavily shielded, diver takes turret fire with dropping HP, dive duration exceeds $2.6\text{s}$, or minions are wiped. Diver sets `diveAborting = true`, displays `🏃 ABORT DIVE!`, acquires `getTurretEvacuationVector` away from the turret toward home lane safety, gains $+35$ movement speed evacuation sprint, and suppresses basic attacks until safely outside turret range $+50\text{px}$.
   - **Turret-Safe Bushes:** `isBushSafeFromTowers` filters out bushes inside or near enemy turret ranges (e.g. `bush_red_river`). Retreating units must never choose a bush inside turret range and must never freeze in `idle` inside turret range.

2. **Turret Execution & Kill Attribution (10-Second Window):**
   - Turret shots deal true damage. If an avatar dies from a turret without a direct champion killer, the kill and gold go to the last enemy champion who damaged them if within 10 seconds.
   - If $> 10$ seconds elapse without champion damage, the death is an authentic turret execution (`🏰 TURRET EXECUTION!`), no champion gets kill credit, and the 300g bounty is split evenly (60g each) among all 5 defending teammates.

3. **Opponent Objective Contestation (`objectiveRules.ts`):**
   - Contesting teams scouting opponents at Dragon Embermaw or Siege Golem Gravemarch prioritize engaging the enemy champions in a teamfight rather than running directly into the pit to hit the boss. They only turn to the boss when it falls to $\le 32\%$ execution HP.

4. **Steering Behavior & Anti-Spin Damping:**
   - 12px directional deadband hysteresis (`setUnitFacing`) to stop 30Hz left/right flipping.
   - Decision state commitment (`decisionCommitTimer`: 0.45s retreat / 0.35s fight) to prevent stuttering between fighting and retreating.
   - Target stickiness hysteresis (+1.4 score) and kiting hysteresis.

5. **Parody Aliases:**
   - Keep `Cardrel` as the requested parody alias. Player card faces must display fictional gamer parody aliases (e.g. Zypoo, d4nk, p1mple, M0cke, flopz, Spl1t, SneakBro, Fisha), never the source person's real name. Preserve card IDs and internal `realName` values.
