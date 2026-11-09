# Original 45-avatar V3 implementation log

## Owner and source boundary

`/root` owns source intake, identity compatibility, shared kernel, the five prototype live adapters, telegraphs, tests and this ledger. No agents were delegated. The V3 files are user-supplied design inputs; repository/system instructions and the owner?s recent policy-baseline approval remain authoritative. Original card/player IDs, frozen studies/rewards, source assets and old reports stay intact. Branch: `feat/original-roster-v3`; pre-existing uncommitted work is preserved, not committed on the owner?s behalf.


## Latest implementation pass ? 2026-10-24 (unverified)

Owner explicitly requested all remaining forty kits and deferred testing until implementation is done. This overrides the earlier test-between-batches sequence. No unit tests, integration tests, typecheck, build, browser inspection, simulations or release-gate execution ran in this pass. Prior 560-test/three-simulation/build evidence belongs to the earlier five-kit source only.

All 45 keys now dispatch authored V3 effects in the opt-in `original-v3-preview-2` runtime. The forty new dispatches live in `v3Roster.ts`; shared cast/lifecycle and projectile hooks remain in `v3Combat.ts`. See [current batch inventory](ROSTER_IMPLEMENTATION_20261024.md) and [source receipt](implementation-pass-20261024.json). Every character remains `partial` and unqualified. Tests are deliberately pending; this ledger does not convert source presence into functional acceptance.

## Actual architecture and baseline

| Responsibility | Actual repository source |
| --- | --- |
| Live authoritative 30 Hz game and spell/attack/damage resolution | `EsportsClash.Web/src/components/AramMatchView.tsx` |
| Simplified simulation used by older batch tests | `matchSimulationEngine.ts`; does not replace the live arena |
| Legacy catalog and stable internal names | `mockData.ts`, `additionalChampions.ts`, `avatarIdentity.ts` |
| Inventory/card ownership and API catalog | Laravel models/services and `resources/game/catalog.json`; not renamed or backfilled destructively |
| Tactical selection and commitments | `combatDecision.ts`, `macroActionDecision.ts`, `decisionActionRecovery.ts`, existing coordinated baseline loop |
| Real movement/terrain and soft contacts | `arenaRules.ts`, `arenaUnitCollision.ts`, `unitCollision.ts` |
| Presentation | Canvas spectator; `threeArenaScene.ts`, `threeAbilityEffects.ts`, native/procedural asset library |
| Research and released policies | `arenaLearning.ts`, `intelligencePolicy.ts`, `infrastructure/evolution/runner/`; frozen jobs unchanged |
| New preview kernel and live bridge | `v3Combat.ts`, `v3Arena.ts`, `v3Telegraphs.ts`; no renderer owns effects |

Baseline code/catalog/card fixtures and input hashes are in `baseline/` and `source-receipt.json`. Baseline `npm run check:game` was executed before runtime edits and passed 534 tests, three additional simulations, design validation and TypeScript. Existing verified natural seed-71001/71002 baseline games are retained in `../baseline-*.json*`. New tests do not replace those historical fixtures.

## Missing input and discretionary decisions

- `ESPORTSCLASH_V3_IDENTITY_MANIFEST.json` was referenced but absent from Downloads and the supplied package. The 45 mappings are provisionally derived from the exact identity fields in the supplied ability-design manifest, joined by the old display alias to the actual stable `c_*` key. The derived registry is not mislabeled as the missing supplied file. Canonical spelling should be reconciled if that file is later supplied.
- 1 GU = 1 existing world unit provisionally: existing champion body radius is 17, close to design 18; existing ordinary movement is approximately 85?105 units/s, close to design 100. No map or base movement rescale.
- New baseline mana costs are provisional 30 S1 / 35 S2 / 80 R; Mirelle minor pages 45, Grand Atelier 80. Windups are 0.35s normally, Recut 0.4s, Brownout 0.75s, Grand Atelier 1s, other major casts 0.5s; base recovery 0.25s. No claim of polished balance.
- Theater beat windows use ?4 simulation ticks around +30/+60/+90 ticks. A two-hit center chime supports the theater, as required by the engine specification?s destruction counter. Recovery taxes are capped at 0.7s/cast and 1.4s in a rolling 5s window.
- First unpaired Teslan rods expire after 7s; linking sets both lifetimes to 3s. This bounds otherwise unspecified preparation lifetime. Team device cap is 16.
- Fabric support pins become breakable consumed supports; they no longer count as active S1 pins, but destruction still collapses their page. Nondegenerate triangles require twice-area >=200 world-unit squared.
- Hem speed lasts up to 1s toward the far endpoint. Ferry route length must be >=40; emergency ferry arrival shield is 100. Newly granted shields use a provisional 40% max-HP cap. These choices need calibration and review.
- Full models/rigs/portraits were not generated or republished. Preview explicitly labels legacy visual placeholders. Future original art follows the mandatory clean-adult-base -> rig qualification -> separate appearance workflow, superseding clothed-first/T-pose suggestions in the art document.

## Execution order

1. Preserve source, validate 45/180/10, add nonbreaking alias registry.
2. Test shared tick casts, recovery, constructs, geometry, projectiles and voluntary transport.
3. Integrate five preview slices in actual AramMatchView, test enemy counterplay and speed parity.
4. Fix foundation/integration failures before adding Group A, then B/C/D.
5. Expand live AI, complete bespoke presentation/animations, run real full-match and broad balance qualification before changing normal/online defaults.

## Per-avatar ledger

`partial` means code exists but the complete design/AI/art/acceptance contract has NOT passed. No avatar is called complete. Identity is partial for all rows because the separately authoritative identity manifest is missing and complete UI/API rollout is pending.

| Stable key / old alias | V3 name and title | Identity | P | S1 | S2 | R | AI | VFX | Tests |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `c_solana` / Dawnna | Solenne Vaelor ? The Sunwall Oath | partial | partial | partial | partial | partial | partial | partial | not started |
| `c_astra` / Aiselle | Ivera Frostwhistle ? The Frost Resonant | partial | partial | partial | partial | partial | partial | partial | not started |
| `c_kyumi` / Vixelle | Mireth Lune ? The Witness of False Roads | partial | partial | partial | partial | partial | partial | partial | not started |
| `c_buck` / Gritlock | Bramm Coil ? The Breach Marshal | partial | partial | partial | partial | partial | partial | partial | not started |
| `c_valkira` / Bessara | Kael Vespera ? The Oath Ledger | partial | partial | partial | partial | partial | partial | partial | not started |
| `c_kage` / Vanta | Nyxara Vale ? The Silhouette Thief | partial | partial | partial | partial | partial | partial | partial | not started |
| `c_kazemaru` / Galejandro | Serrin Galecrest ? The Crosswind Cartographer | partial | partial | partial | partial | partial | partial | partial | not started |
| `c_kindra` / Lambent | Orin and Fen ? Keepers of the Last Lantern | partial | partial | partial | partial | partial | partial | partial | not started |
| `c_cora` / Plumeira | Quillene Rook ? The Sky Loom Fletcher | partial | partial | partial | partial | partial | partial | partial | not started |
| `c_renn` / Gildan | Aurelio Vane ? The Masquerade Marshal | partial | partial | partial | partial | partial | partial | partial | not started |
| `c_sylla` / Sylvan Solo | Droven Bearmantle ? The Keeper of the Second Heart | partial | partial | partial | partial | partial | partial | partial | not started |
| `c_tequoia` / Fernanda | Thalara Rootwright ? The Mycelial Architect | partial | partial | partial | partial | partial | partial | partial | not started |
| `c_zal` / Glimmerick | Vesper Loom ? The Gossamer Chirurgeon | partial | partial | partial | partial | partial | partial | partial | not started |
| `c_xin` / Cindergent | Rux Emberchain ? The Cinder Postmaster | partial | partial | partial | partial | partial | partial | partial | not started |
| `c_raijin` / Voltaire | Teslan Veyr ? The Storm Circuit | partial | partial | partial | partial | partial | partial | partial | partial |
| `c_kaolin` / TerraByte | Joruun Jadecoil ? The Hinge Colossus | partial | partial | partial | partial | partial | partial | partial | not started |
| `c_inai` / Nulliver | Astrax Mire ? The Distance Pilgrim | partial | partial | partial | partial | partial | partial | partial | not started |
| `c_qiyana` / Crownfetti | Prismelle Cade ? The Shard Regent | partial | partial | partial | partial | partial | partial | partial | not started |
| `c_locke` / Sootcase | Ashkar Veilhand ? The Penitent Ember | partial | partial | partial | partial | partial | partial | partial | not started |
| `c_senna` / Sennova | Maris Solquill ? The Reliquary Surveyor | partial | partial | partial | partial | partial | partial | partial | not started |
| `c_largo` / Basso Croak | Odo Bogsong ? The Reed Timekeeper | partial | partial | partial | partial | partial | partial | partial | not started |
| `c_shadowfiend` / Razeberry | Mourn Ashwake ? The Furnace Mourner | partial | partial | partial | partial | partial | partial | partial | not started |
| `c_earthshaker` / Quakewell | Dolm Runesunder ? The Seismic Surveyor | partial | partial | partial | partial | partial | partial | partial | not started |
| `c_mirehook` / Rotisserie | Garruk Mawsuture ? The Jaw Foundry | partial | partial | partial | partial | partial | partial | partial | not started |
| `c_nullweaver` / Midnight Equation | Vesper Nullcode ? The Inertia Heretic | partial | partial | partial | partial | partial | partial | partial | partial |
| `c_voltgrip` / Plugsy | Coiljack Ampfist ? The Livewire Turnstile | partial | partial | partial | partial | partial | partial | partial | not started |
| `c_aetherbolt` / Relic Rick | Talan Slipshot ? The Archive Ballistician | partial | partial | partial | partial | partial | partial | partial | not started |
| `c_corsara` / Bounty Belle | Calixa Broadwake ? The Tidebound Privateer | partial | partial | partial | partial | partial | partial | partial | not started |
| `c_brewmaw` / Kegory | Brohm Caskfall ? The Fermentation King | partial | partial | partial | partial | partial | partial | partial | not started |
| `c_wraithhook` / Hooklyn | Mora Fenhook ? The Lantern Ferrier | partial | partial | partial | partial | partial | partial | partial | partial |
| `c_invoker` / Arsenaldo | Mirelle Vane ? The Atelier Prodigy | partial | partial | partial | partial | partial | partial | partial | partial |
| `c_hwei` / Inkognito | Maelis Chromabloom ? The Conservationist of Ruin | partial | partial | partial | partial | partial | partial | partial | not started |
| `c_jayce` / Hexley | Axiom Rail ? The Scrapline Engineer | partial | partial | partial | partial | partial | partial | partial | not started |
| `c_vi` / Knuckleberry | Brakka Fenn ? The Civic Enforcer | partial | partial | partial | partial | partial | partial | partial | not started |
| `c_jinx` / Boomie | Pippa Fuseburst ? The Firework Stagehand | partial | partial | partial | partial | partial | partial | partial | not started |
| `c_puck` / Fizzlewing | Lulla Faespring ? The Keeper of Unfinished Dreams | partial | partial | partial | partial | partial | partial | partial | partial |
| `c_batrider` / Wickety | Bryx Emberkite ? The Thermal Sailor | partial | partial | partial | partial | partial | partial | partial | not started |
| `c_bristleback` / Hedgehoggin | Murdle Ridgehide ? The Living Palisade | partial | partial | partial | partial | partial | partial | partial | not started |
| `c_io` / Orbiton | Nemea Halolink ? The Choir Conductor | partial | partial | partial | partial | partial | partial | partial | not started |
| `c_lulu` / Pixabelle | Thimble Briarwish ? The Walking Gardener | partial | partial | partial | partial | partial | partial | partial | not started |
| `c_silencer` / Muffleton | Sevrin Inkseal ? The Magistrate of Repetition | partial | partial | partial | partial | partial | partial | partial | not started |
| `c_wukong_lol` / Stafford | Koro Cloudtail ? The Aerial Polewright | partial | partial | partial | partial | partial | partial | partial | not started |
| `c_monkeyking_dota` / Primate Minister | Bram Stonebranch ? The Canopy Regent | partial | partial | partial | partial | partial | partial | partial | not started |
| `c_stepstone` / Kickswitch | Toma Bellbreak ? The Thirteenth Bell | partial | partial | partial | partial | partial | partial | partial | not started |
| `c_skybreaker` / Propella | Ravelle Skyrake ? The Airspace Duchess | partial | partial | partial | partial | partial | partial | partial | not started |


## Unfinished requirements

- All forty remaining kits now have cast/effect dispatch and tactical candidate code in `v3Roster.ts`, connected to the version-2 preview. These are untested implementations, not qualified completed characters. See `ROSTER_IMPLEMENTATION_20261024.md` for current scope and limits.
- Mirelle has ten page handlers and public-state candidate scorers using movement/projectile/health/route forecasts at 0.5/1.5/3s. This is not proof of ten intelligent live outcomes. A true radial palette, binding Recut's free page-group interaction, detailed fake windup animation and live jaw-hazard bridge interactions are unfinished. Free group selection and distinguishable decoy selection events have isolated tests; Garruk now creates typed ground-jaw hazards; the live bridge interaction is wired but not tested on this source.
- Mora?s enemy boarding and alternative disembark/interaction UI, complete route valuation, and all arrival/failure edge cases need broader live tests.
- Teslan's public-state scorer can choose Conduct/Repel/Brownout; projectile-pressure valuation, full future-windup categories and cross-hero shutdown semantics need further integration qualification. Disabled ferries/supports now interrupt transport; the isolated regression also prevents final-tick control from earning Fare or an arrival shield.
- Dedicated character meshes, rigs, animation choreography, icons and art-bible silhouettes are not implemented. Telegraphs are honest state-derived debug geometry, not finished art.
- All ten companion cross-hero combinations, every-hero 5v5/R-counteraction matrix, 500+/1000-match balance studies and live boss-contest parity are unfinished.
- No online worker/catalog, frozen ML study or production deployment has been changed. V3 uses a separate local adaptive-storage key and rejects legacy released actors rather than assuming semantic compatibility.
- Complete saved V3 replay restoration, starting adaptive snapshots are unfinished. Manual page/cast/route/letter inputs are now tick-journaled in world state and reports, but saved replay restoration and journal completeness are unverified.
- Vesper's forced/unstoppable categories and dash endpoint treatment need explicit live qualification. No full natural V3 match, 45-kit opponent matrix or long-run balance claim is supported by the short center-lane engineering fixture.

## Verification and inspection

Executed checks and exact immutable evidence paths are recorded in `verification-20261023.json`. The isolated tests cover actual effects and failure boundaries, not merely names/descriptions. Live proof runs mount the actual `AramMatchView`, verify embedded compiled-source hashes, compare full fingerprints/RNG/V3 state at 1x/4x and with rendering enabled, and reject legacy signature state on the five migrated units. Normal-baseline proof reproduces the retained natural seed-71001 match with V3 off and compares its full fingerprint and duration. These are distinct scopes.

`v3-styled-preview-20261023.png` was visually inspected: both Mirelle selectors expose ten pages, the explicit prototype/legacy-art label is visible, and geometry renders over the real map. Multiple labels overlap in the center-lane cluster, so readability remains unqualified. The private paused stepping harness leaves the wall-HUD time at zero while world effects advance; its metadata records actual tick time. It is not a polished spectator acceptance screenshot.

The first baseline source had 534 passing unit tests. Subsequent source snapshots and failed attempts remain historical evidence. One intermediate baseline verification deliberately rejected a source change during the run; it is not passing proof. The 2026-10-23 verification used its own frozen rebuilt source and fresh output names; it is historical evidence and does not verify ruleset 2. `check:v3-release` is an intentional failing readiness gate, separate from passing unit/integration/build checks: zero fully qualified avatars and a missing separately supplied identity manifest. The historical gate also reported forty missing handlers; those handlers now exist but have not been tested. Missing production art is allowed only when explicitly labeled as placeholders, never counted as finished assets.
