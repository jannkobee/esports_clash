# Tactical FPS player architecture v4 — 14 November 2026

Owner requested replacing attributes, personality, specialties and rating-derived identities with the supplied architecture, while prioritizing the existing gameplay. `/root` owns model, gameplay integration, migration, UI and verification. No delegates, asset processing, deployment or live database migration were used.

## Implemented model

- Exactly six stored core attributes: Rifling, Sniping, Entry, Utility, Positioning and Shotcalling. Club attributes retain 1–99 precision; the local profile editor uses 1–10. Existing aim, reaction, movement, grenade, information and calling consumers derive their execution quality from these six values. Internal consumer names are not separately editable attributes. Mental execution limits remain shared; temperament changes decisions rather than aim.
- Four validated personality dimensions generate all 54 combinations. The 18 base profiles and all T/CT identity names are declarative metadata. Labels never inspect attributes, kills or K/D. All 540 position/personality configurations are supported.
- Five unique assignments on each side are frozen in each match allocation. The internal responsibility bridge feeds the existing entry, support, trade, anchor, caller and lurking mechanics. Flex can buy either rifle or sniper equipment; using an AWP does not create another position.
- Legal action scoring combines observed context, personality preferences, coach instructions, the gameplan and learned cooperation. Personality now also affects live approach selection and whether an IGL presses independently or follows trade spacing. All decision styles can reassess evidence. Existing perception, smoke, map collision, weapon physics, four-slot equipment, grenade preparation, elevation drops and bomb rules still resolve the chosen action.
- Removed the old 30/24-trait catalogs, specialty catalog and activation bonuses, 25 independent ability values, skill-derived role classifications, old badges UI and the legacy identity toggle. Explicit import/data migration is the only consumer of old rating keys.
- Natural identities stay separate from opportunity-normalized observed behavior. Observations record decisions, not kills; published observed summaries require at least five matches and 30 engagement opportunities. Insufficient evidence stays unestablished. Match snapshots retain the four dimensions and the assigned position.
- Coaching, scouting, transfer filters, generated players, national teams, training and AI recruitment use the new model. AI managers persist the same gameplans and side assignments available to human managers. Historical reports, player IDs, contracts, XP, privacy, parody aliases and career settlement guards remain intact.

## Main implementation files

`EsportsClash.Web/src/fps/fpsPlayerArchitecture.ts` and `fps-player-architecture-v4.json` contain the canonical dimensional model and identity mappings. `fpsIdentity.ts`, `fpsIdentityMatch.ts`, `fpsSkillProfile.ts`, `fpsLiveSimulation.ts`, `fpsLiveBrain.ts`, `fpsEconomy.ts`, `fpsRoundSimulation.ts` and `fpsSimulationEngine.ts` connect it to the existing engines. The lab, profile editor, scouting marks, tactical editor and replay/broadcast views consume those fields.

Backend counterparts are `FpsPlayerArchitecture`, `FpsIdentityProfiles`, `FpsIdentityEngine`, `WorldPlayerProfiles`, `BotClubManager` and the existing tactical-system controller. Worker allocations now pin revision 4. Completed historical recordings remain readable; an older pending allocation must use its original worker revision rather than being silently simulated with new rules.

## Packaging correction

The first implementation imported the catalog from outside the frontend package, which failed in the owner's frontend-only `/workspace/EsportsClash.Web` preview. The canonical JSON now lives next to the TypeScript module and uses a relative import. The API resource is a generated, hash-checked package copy; `scripts/sync-fps-player-architecture.mjs` synchronizes or verifies it. This is one authored catalog with two packaging locations. PHP caches the verified catalog and composed profiles for the process/request, avoiding repeated filesystem hashing and profile generation.

Vite HTTP checks returned 200 for both the module and JSON import and confirmed no `EsportsClash.Api` import remains. No browser/GPU visual acceptance is claimed.

## Migration policy

`2026_11_14_000001_replace_fps_player_architecture.php` archives original identity rows, world profiles, catalogs, team instructions and player wire profiles before replacing their active fields. It retains private DNA without using it as a competing personality system. It initializes previously missing identities and removes old personality/specialty columns after the new records are populated. Re-running the migration preserves the same personality and archive rows.

No reliable opportunity-normalized behavioral history existed for assigning the new dimensions. Existing players therefore receive a documented, deterministic FNV-1a selection from their player ID, shared by PHP and TypeScript. Old badges are not silently reinterpreted. Permanent dimensions do not reroll with training, skill changes, a new match seed or one poor match.

Legacy attribute conversion, bounded to 1–99:

| New attribute | Legacy input |
|---|---|
| Rifling | LAN |
| Sniping | 55% LAN + 35% CLU + 10% IQ |
| Entry | 60% LAN + 40% TF |
| Utility | Mean TF and FLX |
| Positioning | IQ |
| Shotcalling | LDR, or IQ when unavailable |

These are migration estimates, not newly observed professional abilities. Archived inputs remain available for audit. The local 25-value profile import has a separate explicit six-value conversion, keeps its migration provenance and retains the original browser storage key.

The configured local SQLite database was inspected read-only: it has zero player, match and catalog records and lacks several earlier FPS prerequisites. Unrelated pending migrations were not applied. The new migration was exercised against isolated test databases containing legacy records. Production migration and deployment remain unperformed.

## Verification and limits

- Full frontend `check:game`: **280/280 passed**, including design checks and TypeScript. This covers all 54 combinations through live decisions and recorded rounds, all 540 labels, deterministic replay, lawful information, assignment validity, observed behavior and personality/attribute separation.
- A final targeted weapon-choice test plus the six-attribute profile checks: **5/5 passed**. The full frontend suite was not repeated after this small final Flex purchase correction.
- All six existing pro gameplay regressions passed, including wall-safe sniper scope behavior, live grenade trails, elevation drops, loadouts and sidearm swaps.
- Initial focused backend identity/integration tests: **11/11 passed (290 assertions)**. A broader run reached **93/95**; its two FPS fixture/national-settlement issues were corrected. Final targeted checks passed **7/7 (219 assertions)**, including those two failures and migration/persistence coverage.
- The attempted full backend suite produced **355/373**, including obsolete FPS settlement fixtures subsequently corrected, an obsolete `lan` assertion subsequently updated, and unrelated avatar/Trellis failures. It was not rerun. Do not describe the whole backend suite as passing.
- Production TypeScript/Vite builds passed; the final process exit code was **0**. A final compile also caught and corrected the viewer bolt animation's boolean/number expression by using numeric zero when inactive. Existing large viewer bundle size remains a warning. Focused lint completed with warnings and no errors; receipts are recorded in `tmp/fps-v4-*` logs.
- Corrected an existing recording-clock issue exposed by the new decision logs: metadata entries no longer add artificial time to the live round.

No full competitive balance, GPU appearance, production worker rollout, production data migration, asset qualification or approved learning-model promotion is claimed. Existing frozen ML artifacts and Colab-only, owner-started asset gates were preserved.

## Source receipts

Supplied implementation task: `docs/references/fps-player-architecture-v4-20261114.md`, SHA-256 `cf979bcc9405536293d85c7ace1e02bc4a5588ea8ecac0748e7677d7a990c5bb`.

Canonical identity catalog SHA-256: `7a39d5a72277b890e2f7dffd4df90ea7e4fcef6e94287832a6f9d6e06b577eaf`. The API package contains the identical bytes.
