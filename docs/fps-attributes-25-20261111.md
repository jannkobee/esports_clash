# Revised 25-ability FPS model: local implementation

On 11 November 2026 the owner supplied `FPS_Attribute_Model_Revised_25.md` and requested implementation. That request authorizes this local rollout; the source document's planning-status sentence describes the document, not a prohibition on implementing the owner's request. Its explicit later official-activation boundary remains. `/root` owns the skill schema, local simulation consumers, lab editor, tests and this record. No agents were spawned. Desktop/browser automation remained stopped at the owner's request.

Exact supplied source: [revised 25-ability proposal](references/fps-attribute-model-revised-25-20261111.md), 32,310 bytes, SHA-256 `c9cd1092c176bdf9f368db411878f829f8afce6e636e45a70654af3acf7194dc`. This supersedes the earlier [26-attribute proposal](fps-attribute-model-plan-20261110.md) for the adopted taxonomy. The older proposal and source are retained as history.

## Active boundary

The local lab now has a separate version-1 FPS skill profile with the revised 25 keys: 9 execution, 7 tactical/information, 4 team and 5 mental. `weaponHandling` is absent. Values use a 1–10 display with fractional internal precision. Profile metadata includes player ID, revision, seed, creation time and generated/custom/imputed provenance. Invalid, incomplete, wrong-player and out-of-range profiles fail validation. A live match clones and freezes its inputs.

Providing ten profiles explicitly enables `hexatrick-live-exhibition-v6`; omitting them retains the explicit local v5 seven-attribute adapter. The lab offers this choice. Official contextual v2/v3 allocation, worker, settlement and historical replay paths do not consume these profiles. Shared `PlayerAttributes`, roster values, stored legacy CLU/LDR semantics, MOBA and career processing remain intact. No database migration, official activation or deployment was performed.

The supported registry exposes **24 active bounded consumers and one reserved ability**. Active means that a distinct local mechanism is connected and tested; it is not competitive balance, complete simulation fidelity or official scouting qualification.

## Consumer and evidence matrix

| Ability | Local consumer | Main observable evidence |
| --- | --- | --- |
| Reactions | Noticed visual contact to motor-response initiation; equipment changes wait too. | Cue/notice/response times and reaction delay; mandatory weapon draw still applies. |
| Crosshair Placement | One stable angular offset when selecting a prepared focus. | Prepared-angle error and steady held yaw; no idle scan. Height-specific placement is not implemented. |
| Flicking | Finite large acquired-target correction. | Removed correction angle and controlled large-angle acquisition. |
| Tracking | Motion estimate from personally observed samples and sustained correction. | Observed-sample tracking error/samples; estimates do not follow hidden movement. |
| Precision | Terminal correction and residual motor-input error. | Fine correction, signed error, squared error and sample count; weapon dispersion remains. |
| Recoil Control | Actor compensation between identical actual weapon-yaw impulses. | Accumulated recoil, residual before shots, changed physical shot rays. This is horizontal recoil, not a complete vertical/spray model. |
| Movement Control | Delay before issuing the brake input. | Brake-input delay and stop-to-shot timing with common physical acceleration/speed/weapon thresholds. |
| Peeking | Endpoint execution error for an already selected collision-constrained jiggle. | Planned endpoint error, actual movement/exposure and return. Shoulder/wide/jump peek catalogs are not supplied by this consumer. |
| Utility Execution | Placement error before launching the chosen real grenade. | Throw error/attempts, inventory spend, fuse and ballistic positions. |
| Awareness | Lawful visual attention cadence and delayed noticing of available sound cues. | Cue-availability/notice timing, queued sound observations, unchanged physical visibility/range. |
| Information Reading | Uncertain signal localization and interpretation of ambiguous/stale evidence; use of observed habits. | Belief age/identity/uncertainty, bounded interpretation changes and no fabricated enemy count. |
| Positioning | Cover/route choice scored against remembered angles, ally crowding and nearby escape geometry. | Cover selections and exposure to known threats; advantages result from actual geometry. |
| Timing | Preference to apply pressure during a recent personally known gunfire window. | Window count and contextual action distribution; no effect from an absent window. This is a narrow timing consumer, not full retake timing intelligence. |
| Decision Making | Contextual action comparison and routine deliberation cadence. | Selected legal actions/decisions, with objective/resource constraints preserved. |
| Adaptability | Evidence-triggered assessment delay before a justified attack rebuild. | Assessment delay/count, real protocol/route resets, retained 14-second team-plan commitment. |
| Economy Judgment | **Reserved/inert**: team policy still controls purchases. | Changing only this field produces identical seeded snapshots. Excluded from the active tactical display summary. |
| Communication | First-hand report latency and clarity/uncertainty calibration. | Report count/delay/quality; original observation time retained. |
| Trading | Additional follow-up spacing error around the shared ordered/staggered formation. | Follow distance and actual follow-up movement; 1.5-second credit rule and aim/damage unchanged. |
| Coordination | Agreed entry release spacing and protocol responsibilities. | Entry-release delay following real utility timing. |
| Calling | Caller fit/selection and acknowledgment delay on issued commands. | Command delay/count, real reinforcement movement, opposite-site guard retained. |
| Composure | Acute-pressure component of motor-input noise. | Pressure-conditioned input errors; no baseline skill, HP or damage bonus. |
| Concentration | Attention debt during prolonged quiet/divided demand, relieved by renewed activity. | Attention state and noticing intervals, separate from base Awareness. |
| Consistency | Symmetric conditional input variation. | Input error variance with zero expected signed error; no skill clipping or favorable-result selection. Mean match outcomes are not asserted equal under nonlinear geometry. |
| Resilience | Recovery of an actual elimination/round-loss attention setback. | Event-caused setback and its decay; permanent ratings unchanged. |
| Stamina | Sustained exertion accumulation and between-segment recovery. | Exertion across rounds and attention impact; no rapid full fatigue from a brief run or movement-speed bonus. |

The registry and diagnostic types live in `fpsSkillProfile.ts` and `fpsDetailedExecution.ts`. Consumers live in `fpsLiveSimulation.ts`, with optional detailed cover evaluation in `fpsLiveMap.ts`. No generic average of the 25 ratings is applied to hit chance, damage or match wins. The seven card summaries are derived displays in the editor, not an additional simulation modifier.

## Knowledge, state and deterministic execution

Detailed tactical decisions use personally noticed enemy snapshots, rather than consulting currently available world targets before the attention stage. The snapshots do not update when an unobserved reload changes. Existing actor-local memory, source/age/confidence/uncertainty, delayed report delivery, anonymous cues, negative-evidence checks and objective precedence remain authoritative. Reports do not create firing targets. Confirmed public eliminations remove identified noticed threats without broadcasting hidden coordinates.

Detailed mode separates seeded action, observation, motor-execution, world-choice and simplified hit-classification streams. Changing a sensory parameter does not directly advance the action generator. Physical event differences can still create legitimately different later trajectories; this is not a guarantee that every downstream counterfactual stays identical. Legacy mode retains its prior random-stream path.

Opponent memory records personally observed/reported visual positions in coarse cells, at most one sample per cell per round, with a bounded six-round window and 16 records. At least three earlier observed rounds are required before a frontal historical hold can inform preparation. Anonymous sounds and repeated frames cannot supply those samples. It is a bounded heuristic memory, not learned omniscient scouting or a complete series/opponent model.

Mental effects have separate stage ownership: pressure changes input noise; concentration/setback/exertion affect attention; resilience shortens an event-caused setback; stamina changes sustained exertion. The legacy generic pressure/fatigue modifiers are not additionally applied to detailed shots. Profiles are never rerolled or awarded permanent skill growth after a kill/loss.

The existing flat-plane body-hit/headshot classification remains simplified. Detailed Precision does not change the headshot classification probability; full physical head volumes, vertical aim/recoil and height-sensitive crosshair placement remain future mechanics. Do not claim those features from the presence of the new skill names.

## Lab and persistence

`FpsSkillEditor.tsx` presents four groups with 25 number fields, 24 editable controls and the disabled Economy Judgment field with its reason. The detailed editor consistently uses 1–10. The explicit legacy comparison retains its old seven-field controls. The seven new compact summaries use full FPS names: Mechanics, Teamplay, Tactics, Calling, Composure, Stamina and Adaptability.

Default detailed profiles are independent fictional lab generation, not a reverse inference of 25 real abilities from club cards. Generated profiles are stable for the player/release seed, stored under `hexatrick:fps-skill-lab:v1`, and retain metadata/revisions across refreshes. Edits produce custom test revisions. Import/export validates all ten profiles. Equalization pins all abilities to 10 for the match without overwriting stored varied profiles. Browser storage failure falls back to session-only experimentation.

The optional `legacy_estimate_v1` generator is explicitly model-imputed and is not automatically applied to existing players; in particular old CLU does not identify new Composure. A distinct match export contains seed, pinned test profiles and public diagnostics. It excludes the private identity/DNA context. It is a diagnostic artifact, not a newly qualified official replay format.

## Integration and verification

Affected code: new `src/fps/fpsSkillProfile.ts`, `fpsDetailedExecution.ts`, `fpsOpponentPatterns.ts`, `src/components/FpsSkillEditor.tsx`, and `src/fpsSkillProfile.test.mjs`; integration changes in `fpsLiveSimulation.ts`, `fpsLiveMap.ts`, `FpsSimulationLab.tsx`, `FpsLiveBroadcast.tsx`, and `fps-live-broadcast.css` under `EsportsClash.Web`.

The workspace also received owner movement/operative changes during this pass. Those were preserved, including crouching, ordered/staggered trade spacing and existing operative rendering. This pass added the missing crouch snapshot field for type integration and applied detailed Trading around the current formation rather than reverting it. No character generation, rigging, animation processing or asset qualification was performed.

Verification:

- 25 new profile/causal tests passed. Together with the current live information/tactics tests, the final focused run passed **60 tests**, zero failures. Tests cover profile validation/provenance/pinning, lawful cue stages and independent reaction/draw timing, steady placement, flick/track/precision boundaries, symmetric noise, physical recoil, braking, throws, geometric positioning, actual selected peeks, contextual timing/decisions, command/replan/follow-up timing, event-caused recovery, observed opponent samples and reserved Economy Judgment.
- The detailed pair runs 4,500 fixed steps with only Economy Judgment changed, requiring identical public snapshots, real shots/round progression, actual body-wall exclusion and private-DNA exclusion. Navigation-grid safety padding is not confused with the smaller physical actor radius.
- Required `npm run check:game` passed: **722 passed, 22 skipped**, zero failures; all three additional simulation checks and TypeScript passed. Existing controlled opening/trade/flash/overkill/sample/immutable-impact diagnostic also passed.
- React server rendering checked the editor without opening a browser: 25 numeric fields, 24 enabled, one reserved, four groups, no Weapon Handling, equalization disabling all 25. Evidence: `.local-tools/fps-attributes-editor-ssr.html` and `.json`.
- Final production build passed, with the existing large-chunk warning. Logs: `.local-tools/fps-attributes-check-game.log`, `.local-tools/fps-attributes-focused-final.log`, `.local-tools/fps-attributes-build.log`.

No browser/desktop automation was used. Pixel layout, interactive import/download behavior, full-match presentation, long-series balance, population/tier calibration and performance remain unqualified. A successful build is not deployment acceptance.

## Later official/career gate

The source's later phase is not activated by the local lab: real-player profile migration, backend skill persistence, public scouting estimates, skill-specific training/career progression, lineup-wide complementarity assessment, calibrated new-player admission and an official versioned worker adapter remain staged work. Existing official profiles and careers retain their authoritative data. These need calibrated evidence, privacy, idempotent settlement/training and historical/economic compatibility checks before explicit official activation. No provisional lab values are published as established scouting or injected into transfers, wages, training, official matches or career results.
