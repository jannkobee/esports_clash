# FPS Match Transition Plan

**Status:** Tactical simulation v2 and reversible MOBA disabling deployed; see [current verification](fps-tactical-v2-20261110.md). Implementation authorized. Phases 0–3 implemented; the personality continuation is implemented with local verification recorded in the latest handoff. Phase 4 and deployment validation remain pending.
**Prepared:** 2026-11-10
**Authorized Mechanic Additions:** "Set piece" coordinated bombsite execute system requested and integrated.

## Goal

Replace the MOBA match experience with an original competitive tactical FPS inspired by the Counter-Strike format, while retaining the surrounding esports club-management and living-world game. Start with a lightweight, testable match simulation and five original competitive maps. Keep the player roster, identities, personalities, and the 3D asset workflow useful for a later animated 3D presentation.

“Counter-Strike 2-like” is a genre and match-format reference, not a request to copy its maps, art, interface, audio, weapon names, or other protected content.

## Scope and guardrails

- FPS is now the format for newly allocated exhibitions, scheduled fixtures, and tournament matches. Preserve legacy MOBA recordings and their replay code until the Phase 5 retirement checks pass.
- Preserve the management layer: clubs, players, staff, careers, competitions, schedules, records, and player-facing identity. Update only its match-facing terminology and integrations as needed.
- Keep stable player/card IDs, display names and aliases, nationalities, career histories, and primary/secondary personality IDs. Do not expose real names where current presentation rules require parody aliases (e.g. `Cardrel`, `p1mple`, `TheSpicy`, `Flaker`).
- Translate the meaning of existing attributes and personalities through a new FPS rules layer; do not silently overwrite historical values or make personality a substitute for mechanical skill.
- Build five original maps and make those five the initial competitive pool.
- Start with a deterministic 2D/tactical simulation. Keep its map, event, and actor data independent of rendering so a later 3D/Babylon presentation can use the same match outcomes.
- Preserve the approved 3D pipeline and evidence. The active asset direction requires Google Colab for generation, rigging, and animation processing; Babylon.js is for rendering and playback. Do not add a parallel local asset-processing pipeline or automatic local fallback.
- Important asset constraint: the existing handoff records a reset that deleted legacy avatar model/rig/animation/reference binaries and says not to restore them. Preserve the pipeline, surviving authorized assets, metadata, and historical evidence; do not claim deleted rigs are available or restore them from historical records.
- Keep old MOBA designs and artifacts as clearly marked historical evidence. Do not rewrite frozen ML artifacts, historical reports, or reset receipts to make them appear FPS-native.

## Locked First Playable Rules

The first-playable rules are locked as follows:

- **Format & Rounds:** 5 players per team. MR15 regulation (first team to 16 rounds wins, max 30 regulation rounds). Halves swap after round 15 (Blue and Red switch attacker/defender sides).
- **Tie/Overtime Policy:** If regulation ends 15–15, match enters MR3 overtime (first team to win 4 rounds, $10,000 starting overtime bank, 3 rounds per side with side swap at round 3). If overtime is disabled in exhibition mode, 15–15 is declared an official draw.
- **Objective Mode:** Attackers spawn with the explosive device. Attackers must plant and detonate the device at Bombsite A or Bombsite B, or eliminate all defenders. Defenders must prevent the plant, defuse a planted device, or eliminate all attackers prior to plant.
- **Round Timers:**
  - Buy/Prep phase: 15 seconds.
  - Live round time: 115 seconds (1m 55s). If time expires before device is planted, defenders win by timeout.
  - Bomb detonation timer: 40 seconds after plant start.
  - Device plant duration: 3.5 seconds.
  - Device defusal duration: 10.0 seconds without kit; 5.0 seconds with Defuse Kit (`gear_defuse_kit`).
- **Economy & Cash Flow:**
  - Starting cash (Round 1 & Round 16 pistol rounds): $800.
  - Round win reward: $3,250.
  - Objective plant bonus (for all attackers if device is planted, even if round lost): $300.
  - Consecutive loss bonus ladder:
    - 0 prior losses: $1,400 (base loss).
    - 1 loss streak: $1,900.
    - 2 loss streak: $2,400.
    - 3 loss streak: $2,900.
    - 4+ loss streak: $3,400 (max loss bonus cap).
  - Kill rewards:
    - Standard Pistol: $300
    - Heavy Pistol: $300
    - Tactical SMG: $600
    - Assault Rifle: $300
    - Precision Sniper: $100
  - Maximum cash bank: $16,000 per player.
- **Equipment Catalog:**
  - Sidearms: Standard Pistol ($0 / free start), Heavy Pistol ($700).
  - SMGs: Tactical SMG ($1,250).
  - Rifles & Snipers: Assault Rifle ($2,700), Precision Sniper ($4,750).
  - Gear: Kevlar Vest ($650), Full Armor + Helmet ($1,000), Defuse Kit ($400, defenders only).
  - Utility: Smoke Grenade ($300), Flashbang ($200), HE Grenade ($300), Incendiary/Molotov ($400).
- **The "Set Piece" Execution Mechanic:**
  - Teams execute coordinated bombsite assaults ("Set Pieces") rather than individual unorganized duels.
  - **Set Piece Phases:**
    1. *Tactical Call & Setup:* Attacking IGL/Coach calls `set_piece_a`, `set_piece_b`, `fake_execute`, `fast_rush`, or `default_probe`.
    2. *Utility Layering:* Utility throwers expend smokes to block sightlines/rotations and flashes to blind defensive site anchors. Smokes mitigate defender crossfire advantage by 75%; flashes lower defender initial shot accuracy.
    3. *Entry Breach:* The designated entry fragger (high LAN/mechanics) pushes the site choke point first to initiate contact.
    4. *Trade Frag Window:* Close teammates (high TF/teamfight execution) swing within the trade window (1.0–1.5s). If the entry fragger falls, trade fraggers immediately challenge the anchor with trade bonuses.
    5. *Device Plant & Post-Plant Crossfire:* Once site control is secured, the bomb carrier plants under team cover. Attackers immediately transition to post-plant perimeter positions.
    6. *Defender Retake:* Surviving defenders group up, utilize remaining utility, and execute a coordinated retake against the planted site before the 40-second bomb timer expires.

## Initial five-map pool proposal

All five are original two-site competitive layouts. Each map features authored callouts, reachability routes, sightlines, choke points, cover ratings, and rotation timings:

| Map ID | Working name | Layout emphasis | Key Callouts |
|---|---|---|---|
| `breakwater` | Breakwater | Harbor warehouses, clear central rotation, close- and long-range approaches. | Harbor Spawn, Warehouse A, Docks B, Drydock Mid, Sluice Gate, Crane Walkway |
| `foundry` | Foundry | Industrial smelting plant with contested middle route and multiple connectors. | Rail Yard Spawn, Blast Furnace A, Assembly B, Boiler Mid, Vent Duct, Smelter Vat |
| `old-quarter` | Old Quarter | Dense cobblestone urban blocks, covered routes, controlled long sightlines. | Fountain Spawn, Market Square A, Church Courtyard B, Alley Mid, Cloister Gate, Balcony |
| `red-mesa` | Red Mesa | Desert canyon relay station with open exterior approaches and protected interior rotations. | Basin Spawn, Radar Terrace A, Silo B, Canyon Mid, Blast Hatch, Trench Cut |
| `northpoint` | Northpoint | Arctic research campus with separated site identities and central timing routes. | Helipad Spawn, Cryo Lab A, Drill Hall B, Ice Crevasse Mid, Decon Chamber, Server Core |

## Player identity and personality transition

The existing roster and personality attributes map cleanly into tactical FPS roles and decisions:

| Existing concept | FPS interpretation | Tactical Gameplay Effect |
|---|---|---|
| LAN (mechanics) | Aim, recoil control, first-bullet accuracy | Headshot probability, opening duel win rate, entry fragging power |
| TF (teamfight execution) | Spacing, trade-fragging, crossfire coordination | Trade frag success within the Set Piece trade window, retake synergy |
| IQ (game sense) | Utility placement, rotation timing, economy | Set Piece call quality, bomb plant positioning, site read accuracy |
| CLU (clutch) | Decision making in 1vX scenarios | Accuracy and composure buff when isolated as the last surviving player |
| STA (stamina/tilt resistance) | Half-time consistency and round fatigue | Preserves aim accuracy across long 30-round matches and overtimes |
| FLX (flexibility) | Weapon mastery across roles | Ability to perform with pistols/SMGs during eco rounds and force-buys |
| IGL/leadership | Shotcalling and tactical adaptation | Success rate of tactical calls (`set_piece`, `fake_execute`, `fast_rush`) |

Personalities influence strategic preferences (e.g. "Solo Carry" prioritizes aggressive entry duels; "Stoic Mastermind" excels at utility-dense Set Pieces and late round clutches). Parody aliases (`Cardrel`, `p1mple`, `TheSpicy`, `Flaker`, etc.) remain authoritative and strictly preserved.

## Migration phases and exit checks

### Phase 0 — Inventory and freeze the boundary (COMPLETE)

- Audit completed: active match entry points identified (`AramMatchView.tsx`, `matchSimulationEngine.ts`, `AppRouter.tsx`).
- MOBA vs FPS boundary frozen: existing MOBA engine files and design checks remain untouched and passing. The new FPS domain types, maps, economy, and simulation engine live independently in `src/fps/`.
- First playable rules and the "Set piece" bombsite execute mechanic locked.

**Exit Check:** migration inventory reviewed, first-playable rules frozen, and isolated Phase 1 authorized.

### Phase 1 — FPS domain model and isolated simulation (COMPLETE)

- Add versioned FPS types (`src/fps/types.ts`) for match, round, side, player state, equipment, map, objective, event, and result.
- Implement authoritative weapon and equipment catalog (`src/fps/weapons.ts`).
- Implement the five original competitive maps (`src/fps/maps.ts`).
- Implement the "Set piece" execute and retake rules (`src/fps/setPieceRules.ts`).
- Implement MR15 economy rules (`src/fps/fpsEconomy.ts`).
- Implement deterministic headless FPS simulation engine (`src/fps/fpsSimulationEngine.ts`).
- Add comprehensive automated test suite (`src/fpsMatchSimulation.test.mjs`) verifying MR15 scoring, side swaps, plant/defuse/elimination win conditions, economy, maps, Set Piece executions, and deterministic replay.

**Exit Check:** repeatable headless matches produce valid reports and event streams for every end condition without invoking MOBA rules.

### Phase 2 — Five-map competitive pool (COMPLETE)

- Validate reachability, line-of-sight, cover ratings, and rotation times for all five maps.
- Ensure map registry allows selecting from the five-map competitive pool.

### Phase 3 — Match UI, replay, and management integration (IMPLEMENTED)

- `FpsMatchView` provides a graph-based tactical radar for all five maps, round/half scoreboard, economy and equipment state, utility/bomb markers, event log, round scrubber, playback controls, and final report.
- Local exhibitions run the deterministic simulator without affecting careers or standings. Server allocations are versioned as `fps_mr15_v1`; the online worker executes the same TypeScript engine for new matches.
- Scheduled results validate the pinned map, MR15 score progression, and all ten allocated-player stat lines before match completion. Verified reports advance tournaments and create FPS career-stat receipts while keeping stable player IDs and parody aliases.
- Existing primary/secondary personality facts now shape tactical call preferences and IGL selection through the shared personality definitions; they do not alter mechanical skill stats.
- Spectators receive the persisted FPS report; the match centre uses the FPS viewer instead of the MOBA snapshot stream for FPS allocations.
- Repeated MR3 overtime swaps sides every three rounds and continues until a winner is decided. The official worker rejects a draw.
- Component/replay tests, deterministic worker integration test, API settlement/career coverage, and tournament progression tests were added.

**Exit Check:** production web build, game checks, worker execution, backend settlement, career persistence, and competition progression pass locally. Container rebuild/deployment and rendered browser acceptance remain pending.

### Personality continuation (10 November 2026)

All 30 existing trait IDs now have FPS interpretations, bounded role/caller/call/equipment preferences, match-local round feedback and heavily outnumbered retake saves. Recorded round-start mindset is visible in replay; current player management descriptions and the guide use FPS terminology. Mechanical skill, identities, historical definitions and career records are preserved. See [FPS personality rules](fps-personalities.md) for implementation, verification and explicit remaining abstractions. This continuation does not complete the 3D phase or live worker deployment checks.

### Phase 4 — 3D-ready presentation seam (NEXT)

- Connect to Google Colab avatar generation/rigging pipeline and Babylon 3D renderer.

### Phase 5 - Preserve and disable MOBA (OWNER CORRECTION, IMPLEMENTED)

- Preserve all MOBA code, catalogs, pipelines, historical roles and recordings. The owner explicitly rejects deleting the MOBA game.
- The Laravel Game modes setting disables fresh MOBA entry and reference surfaces reversibly. FPS is active.
- See [tactical FPS v2, deployed checks and limits](fps-tactical-v2-20261110.md).

### FPS reference and watch access (10 November 2026)

The owner supplied role/personality examples and requested complete current reference content and blank-page repairs. Searchable native FPS Hexapedia now documents seven scouting specialties, all 30 traits, current weapons/equipment, maps, skills and rules. Player rows show primary/secondary skill fits; roles and caller responsibilities remain separate from personality. Settings places a public deterministic simulation launcher first, with map/seed, autoplay/scrubbing and JSON download. Laravel Game modes also links to it. Settled Settings/Hexapedia collection rendering and sidebar navigation were repaired and verified in an isolated desktop/mobile browser. See [the implementation and validation record](fps-reference-and-navigation-20261110.md). This qualifies tactical reference/watch access; Phase 4 and independent lurking remain incomplete.

## Known current implementation surfaces

Active Phase 3 surfaces:

- [FPS simulation and report types](../EsportsClash.Web/src/fps/)
- [Tactical FPS viewer](../EsportsClash.Web/src/components/FpsMatchView.tsx) and [scheduled match centre](../EsportsClash.Web/src/components/OnlineNormalView.tsx)
- [Server allocation, settlement, and FPS worker](../EsportsClash.Api/app/Services/OnlineService.php) and [online worker](../infrastructure/online/fps-match-worker.mjs)
- [Agent handoff](./agent-handoff.md) and [arena mechanics](./arena-mechanics.md) for current gameplay decisions
- [Character asset pipeline](./character-asset-pipeline.md) and [Babylon visual rebuild plan](./babylon-visual-rebuild.md) for the later 3D stage

The legacy MOBA renderer and historical report paths remain preserved. The owner corrected Phase 5 to reversible disabling, never deletion.

## Acceptance criteria for a future implementation

1. MR15 halves, side swaps, first-to-16, and the approved 15–15 policy are correct and tested.
2. Each of the five original maps is in the sole initial competitive pool and passes reachability, visibility, and balance review.
3. Match outcomes are deterministic from recorded inputs/seeds and replayable from events.
4. Player identities, aliases, personality IDs, club membership, and career/stat history survive the transition without ID churn.
5. Active personality behavior is FPS-relevant, bounded, and cannot bypass mechanical legality.
6. Club, schedule, competition, and match-record workflows continue to function.
7. The simple simulation is renderer-independent and remains authoritative when 3D playback is added.
8. No unauthorized local generation/rigging/animation processing occurs; no deleted legacy avatar binaries are restored or mislabeled as qualified.
9. Active user-facing documentation is updated only with the implementation and verified behavior; historical artifacts remain immutable.
