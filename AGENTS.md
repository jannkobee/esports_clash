# Repository handoff

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
