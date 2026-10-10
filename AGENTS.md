# Repository handoff

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
