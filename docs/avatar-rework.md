# Avatar-by-avatar rework

## Direction approved on 2026-10-17

Preserve each avatar's identity; revise abilities where needed. Finish individual model, weapon contact, kit execution, descriptions and ability presentation before the crowded 5v5 visual-polish pass. Keep audio muted by default during testing. The existing native animation phase is complete; refine those clips and their runtime contacts as needed.

## First implementation: contact foundation and Voltaire

- Basic attacks record the actual released target and position. The renderer aims the primary weapon at that target's near surface, fits the wrist and adds a bounded visual step of at most 32 units, then recovers. Six two-handed melee holds select a reachable weapon tilt/roll and shared step for both palms. Actual positions, colliders, attack ranges, release clocks and damage do not change. Creature contacts retain a torso-height approximation.
- Voltaire remains a mobile lightning mage, retaining his coat, orbiting drums, names, base stats, cooldowns and existing travel legality. His right hand shows the single six-second **Overload** charge refreshed by spells. The next primary avatar/minion shot spends it at release and, on impact, adds a 65-radius, 60-base-damage burst and a brief slow. Structures and neutral monsters preserve the charge. Secondary item bolts do not duplicate it.
- **Static Remnant** is now a real stationary proximity trap: arms after 0.3 seconds, expires after four seconds, triggers on an eligible enemy avatar within 65 units and explodes once within 80 units for the existing 140 base damage. Placing it no longer instantly damages the selected target. Its electrical double remains at the placement point; it can persist after its owner's death until expiry.
- **Electric Vortex** retains its 120 cast range, 1.4-second hold, continuous 175-unit/second pull to a 36-unit gap and 75 base damage. Weapon-origin lightning and victim coils make the tether visible.
- **Ball Lightning** hides the normal body and orbiting drums during the actual dash and shows a rotating electric sphere and wake. End, terrain collision, control interruption and death restore the normal model. An arrival burst occurs at the actual completed destination. It travels at 540 units/second, up to 320 units and at most 0.75 seconds; 28-unit travel contacts and 55-unit arrival damage share one hit-ID set, including overlapping targets. Its existing 420 base damage, mana/cooldown and terrain/tower rules remain. The form grants no immunity. All ultimate entry paths now use the same capped ground-target implementation.
- Descriptions explain placement, timing, geometry, damage, movement and counterplay. Voltaire has **What you see**, **Play around it**, and four ability preview states in Avatars & Lore. Other avatars retain the existing ten studio poses.

Gameplay implementation: `src/components/AramMatchView.tsx`, `voltaireRules.ts`, `types.ts`, `mockData.ts`. Presentation: `avatarMeleeContact.ts`, `voltaireModelForm.ts`, `threeAvatarModels.ts`, `threeArenaScene.ts`, `threeAbilityDetails.ts`, `threeAbilityEffects.ts`, `abilityPresentation.ts`, `threeAvatarPreview.ts`, `components/AvatarModelPreview.tsx`, `components/ChampionHubView.tsx` (paths relative to `EsportsClash.Web`). Current v9 GLBs and Blender sources remain the asset baseline; dynamic contact/form overlays are runtime additions.

## Review gate for each avatar

Review the silhouette and equipped model; inspect guard, movement, primary/off-hand contact, attack release/recovery, and launch/impact origins. Verify the passive, Q, W and R in execution and write descriptions from that behavior, with visible cast/travel/hit/recovery cues. Record gameplay changes and any remaining approximations. Then proceed to the next avatar. Shared contact improvements do not count as a complete individual kit review.

## Queue

This is the implementation order, not a claim that the whole roster is finished. Voltaire has the first implemented kit pass; balance and longer match review remain. Dawnna is next, starting with sword/shield contact and the distinction between shield, engage and ultimate effects.

| Order | Avatar | ID | Individual pass |
| --- | --- | --- | --- |
| 1 | Voltaire | c_raijin | First implementation complete; balance review pending |
| 2 | Dawnna | c_solana | Next |
| 3 | Bessara | c_valkira | Queued |
| 4 | Galejandro | c_kazemaru | Queued |
| 5 | Vanta | c_kage | Queued |
| 6 | Cindergent | c_xin | Queued |
| 7 | TerraByte | c_kaolin | Queued |
| 8 | Nulliver | c_inai | Queued |
| 9 | Knuckleberry | c_vi | Queued |
| 10 | Quakewell | c_earthshaker | Queued |
| 11 | Rotisserie | c_mirehook | Queued |
| 12 | Plugsy | c_voltgrip | Queued |
| 13 | Kegory | c_brewmaw | Queued |
| 14 | Stafford | c_wukong_lol | Queued |
| 15 | Primate Minister | c_monkeyking_dota | Queued |
| 16 | Kickswitch | c_stepstone | Queued |
| 17 | Crownfetti | c_qiyana | Queued |
| 18 | Sootcase | c_locke | Queued |
| 19 | Gildan | c_renn | Queued |
| 20 | Basso Croak | c_largo | Queued |
| 21 | Hedgehoggin | c_bristleback | Queued |
| 22 | Aiselle | c_astra | Queued |
| 23 | Gritlock | c_buck | Queued |
| 24 | Lambent | c_kindra | Queued |
| 25 | Plumeira | c_cora | Queued |
| 26 | Sennova | c_senna | Queued |
| 27 | Boomie | c_jinx | Queued |
| 28 | Relic Rick | c_aetherbolt | Queued |
| 29 | Bounty Belle | c_corsara | Queued |
| 30 | Propella | c_skybreaker | Queued |
| 31 | Hexley | c_jayce | Queued |
| 32 | Vixelle | c_kyumi | Queued |
| 33 | Sylvan Solo | c_sylla | Queued |
| 34 | Fernanda | c_tequoia | Queued |
| 35 | Glimmerick | c_zal | Queued |
| 36 | Razeberry | c_shadowfiend | Queued |
| 37 | Midnight Equation | c_nullweaver | Queued |
| 38 | Hooklyn | c_wraithhook | Queued |
| 39 | Arsenaldo | c_invoker | Queued for refinement; prior dedicated spell work retained |
| 40 | Inkognito | c_hwei | Queued |
| 41 | Fizzlewing | c_puck | Queued |
| 42 | Wickety | c_batrider | Queued |
| 43 | Orbiton | c_io | Queued |
| 44 | Pixabelle | c_lulu | Queued |
| 45 | Muffleton | c_silencer | Queued |

## Evidence and limits

`src/voltaireRules.test.mjs` covers remnant arming/expiry/proximity/immune exclusions, charge consumption, stacked travel targets/arrival deduplication, form transitions and presentation facts. `src/avatarVisibility.test.mjs` retains all-45 loaded-native stability checks and adds 20 melee rigs in three directions with six supporting-palm holds.

`scripts/check-avatar-rework.mjs` loads actual v9 models into ArenaScene, checks all 20 melee target contacts, paused stability, recovery and immutable inputs, renders six melee examples and six Voltaire states, and exercises the four real studio controls and avatar switching. Evidence: `avatar-rework-melee.png`, `avatar-rework-forms.png`, `avatar-rework-studio.png`, `avatar-rework-verification.json`.

`scripts/check-arena-3d.mjs` supports `AVATAR_REWORK=1` for a draft including Voltaire and melee examples. Its GLB-required 30/60/90-second state/RNG, controls, viewport, recovery and disposal comparisons are regression checks; this does not complete the deferred crowded-fight art pass. Evidence: `avatar-rework-arena-*`.

Required final check/build results are recorded in `avatar-rework-game-check.log` and `avatar-rework-build.log` and summarized in the latest repository handoff. Temporary review services are tracked in `voltaire-owned-processes.json`.

The remnant uses a simplified electrical humanoid silhouette, with shared particle primitives; models retain their current anatomy/costume quality limits. Contact fitting covers primary weapons and a bounded step, not every alternate hand, full-body collision, or target hitbox mesh. This is not 45 completed kit reworks or an ML improvement. The headless `matchSimulationEngine.ts` still uses its existing simplified ability execution and has not received the live Voltaire trap/Overload rework; headless simulation passes do not establish parity, balance, or readiness for ML training/promotion. Existing shared damage defenses and rank/item scaling remain authoritative.

Preserve risk-based tower/well/Nexus combat, natural terrain-aware retreat, attribution, objectives, anti-spin, fictional aliases and current ML gates/evidence. Do not restore historical forced tower-abort rules.
