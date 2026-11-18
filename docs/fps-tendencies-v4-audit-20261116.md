# Architecture v4 tendencies: Phase 1–4 audit, Phase 5–6 completion (2026-11-16)

## Audit fixes (Phases 1–4)

- **Server/client parity**: `FpsPlayerArchitecture::deriveTendencies` previously used its own arithmetic and omitted the FNV jitter, so scouting `top_tendencies` / `igl_identity` disagreed with the client. It now mirrors `deriveFpsTendencies` exactly (same preference fractions, operation order and jitter) for its 20 scouting keys. Shared vectors: `EsportsClash.Api/tests/Fixtures/fps-tendency-vectors.json` (54 cases), asserted by both `fpsPlayerTendencies.test.mjs` and `FpsIdentityTest::test_scouting_tendencies_match_shared_typescript_vectors_without_exposing_dna`. Regenerate with `FPS_WRITE_TENDENCY_FIXTURE=1` on the TS test. Scouting labels now come from the shared catalog.
- **Observed team tendencies**: `computeObservedTeamTendencies` back-filled missing metrics with 50, which fabricated observations. Each of the 9 categories is now `null` until its metrics reach `FPS_OBSERVED_TEAM_MIN_OPPORTUNITIES` (15) and the roster reaches `FPS_OBSERVED_TEAM_MIN_MATCHES` (5 appearances). Weights renormalize over the qualifying metrics, and a `sufficient` flag is returned. Match views may pass `{minMatches:1}` and must label the result as a single-match sample.
- **Pressure context**: `effectiveTendency` accepts `pressure` and `pressureSensitivity`. These shift impulsive keys up and composed keys down by at most 0.12 and change only expression; natural values and capability are unchanged.
- **2D call acceptance**: `fpsRoundSimulation.ts` ignored `tendencyOverrides` and read raw natural values. It now caches natural tendencies with overrides, reads them through `effectiveTendency` (team context and pressure), and blends tactical freedom with the IGL's `playerAutonomy`, matching the 3D path.
- **Caller takeover** (`fpsLiveSimulation.ts`): after an IGL death, `order.callerId` kept pointing at the dead IGL, so the takeover radio call repeated (10 times in the regression test before the fix). The new caller is now recorded, and the call is announced once. Combat lock is new: `activeCaller()` lets a trusted secondary voice (IGL `secondaryCallerTrust ≥ .45`, ally `midroundInitiative > .58` and not fighting) call while the IGL is in an immediate fight. The IGL designation never transfers.
- **Lawful opponent memory**: round-end habit recording used only the first teammate's pattern memory. It now uses the union of the observing team's own records. `heavyEarlyUtility` additionally requires that an observer actually saw an early smoke (`knownSmokes`).
- **Snapshot cost**: `topSignatureTendencies` / `describeIglLeadershipIdentity` were recomputed for every player on every snapshot. They are now cached per player and caller flag. `callResponse` is exposed on `LivePlayer` and resets each round.
- Verified unchanged: catalog 48 IGL / 178 individual / 4 presets, synced; derivation reads only personality + DNA; tendency channels in live code reach decisions only (no spread/accuracy/damage/reaction terms); economy hooks only reorder lawful purchase options and keep armor/donor budget checks.

## Phase 5 surfaces

- Broadcast focus card: a call-response chip (`broadcast-focus-card__call`) inside the existing tendencies row.
- Simulation Lab: `LabTendencyEditor` exposes every catalog key by category (IGL categories only for IGLs). It is marked experimental and lab-only, and applies to both 3D live and 2D recorded runs. Official persistence is unchanged; public reports already reject `identityExperiment`.
- Tactical System Editor: three-way identity (Coach vision / IGL leadership identity with summary and weakness / Observed team), the 9-category observed table only when `sufficient`, and a coaching diagnostics list. `FpsIdentityMarks` shows IGL style only for assigned IGLs and qualitative tendency notes instead of raw values.
- Match view: a match-only observed-tendencies panel built from recorded `behavior_observation` events up to the replay position.
- Hexapedia (`liveSimulation`): `player-igl-tendencies`, `igl-leadership-tendencies`, `contextual-call-acceptance`, `three-way-team-identity`, `lawful-opponent-adaptation`.

## Limits

The client still derives tendencies from ID-based DNA (stored DNA is private), while the server uses stored DNA. If development has changed stored DNA, client-side diagnostics can differ from server scouting. UI changes were type-checked and built but not reviewed in a browser. No GPU, balance or competitive qualification is implied.
