# FPS Role-Specific AI Brain Polish and Verification Record (2026-11-11)

## Context & Request
The owner requested:
1. Thorough automated testing across the FPS simulation engine to verify zero regressions.
2. Polishing and upgrading actor AI brains so each operative plays out their role beautifully:
   - **Entry Fragger (`entry`)**: Corner-peeking close danger angles (Car, Sandbags, Pit, Balcony, Graveyard), dynamic aggressive swings when enemies are flashed.
   - **Trade Fragger (`trade`)**: Shoulder-tethered follow spacing ($3.5-5.0\text{m}$), instantaneous re-frag reflex snapping aim and eliminating reaction latency upon an entry partner's elimination.
   - **Support (`support`)**: Layering utility, proactive pop-flashes ahead of entry breachers at choke points, ninja smoke plants, and post-plant crossfire discipline.
   - **Lurker (`lurker`)**: Stealth discipline, silent walking, holding transition choke routes (Underpass, Second Mid, Speedway), cutting off CT rotators from behind upon sound or visual reports.
   - **Sniper (`sniper`)**: Long-range sightlines, "shoot-and-scoot" cycling mechanic ducking into nearby cover for 1.25s after firing bolt shots.
   - **Anchor (`anchor`)**: Deep site holds (Pit on A, Fountain on B), stalling enemy rushes with choke delay smokes and calling rotations.
   - **CT Retake Coordination**: Grouping at retake staging lines outside site before executing synchronized multi-angle breaches with flashbang coverage.
   - **Broadcast Radio Chatter**: Exposing tactical radio chatter in the BLAST-style spectator focus card.

## Implementation Details

### 1. Trade Fragger Re-Frag Reflex (`fpsLiveSimulation.ts`)
- In `damage()`, upon a fatal hit (`victim.hp === 0`), the nearest living teammate with `role === 'trade'` (or within 18m) executes a reflex snap:
  - Snaps `target` and `aimPoint` to the killer.
  - Offsets `acquired` timestamp so reaction delay is fulfilled (`tradeAlly.acquired = this.time - tradeAlly.reaction + 0.06`), simulating pre-aimed trade readiness within Counter-Strike's trade window.
  - Sets `action = 'Trading'` and broadcasts `[RADIO] {name}: Trading for {victim.name}!`.

### 2. Sniper Shoot-and-Scoot Bolt Cycling (`fpsLiveSimulation.ts`)
- In `fire()`, if `p.weapon === 'sniper'`, immediately initiates tactical bolt cycling:
  - Sets `retreatUntil = this.time + 1.25`.
  - Queries `findLiveCover()` against the target and repaths toward cover.
  - Sets `action = 'Cycling bolt in cover'` and `intent = 'Shoot and scoot — cycling sniper bolt in cover'`.
  - Emits `[RADIO] {name}: Shot fired — cycling bolt behind cover!`.

### 3. Support Proactive Pop-Flashes & Utility Layering (`fpsLiveSimulation.ts`)
- In `useInformationUtility()`:
  - When an Entry teammate approaches a site choke point (<22m from entry gate) and enemy pressure is reported, Support launches a forward pop-flash over the choke:
    - Verifies friendly eye flash exposure ($\le 1$).
    - Emits `[RADIO] {name}: Pop-flash out for {entry.name}! Swing now!`.
    - Triggers `entry.decision = 'pressure'` for immediate swing synchronization.

### 4. Entry Fragger Angle Clearing & Flashed Aggression (`fpsLiveSimulation.ts`)
- In `decide()`:
  - When entering site approaches, Entry Fraggers inspect and clear close danger angles:
    - Site B: Car (`{x: 21, z: -2}`), Sandbags (`{x: 21, z: 4}`), Dark (`{x: 18, z: 27}`).
    - Site A: Balcony (`{x: -18, z: 12}`), Pit (`{x: -27, z: 16}`), Graveyard (`{x: -22, z: 24}`).
  - Sets pre-aim focus, pauses for 0.35s angle check, and sets action to `'Clearing an angle'`.
  - When observing blinded defenders (`blinded > 0.2`), switches to aggressive wide swing with `[RADIO] Entry swinging on blinded defender!`.

### 5. Lurker Rotator Interceptions (`fpsLiveSimulation.ts`)
- Lurkers maintain stealth walking discipline across Underpass (`{x: -4, z: -10}`) and Second Mid.
- When CT rotator footsteps or audio cues are heard crossing Speedway or Mid, lurkers step out of cover to flank from behind with `[RADIO] Flanking CT rotators from behind!`.

### 6. CT Anchor Deep Holds & Retake Coordination (`fpsLiveSimulation.ts`)
- CT Anchors maintain deep defensive site positions (Pit on A: `{x: -23, z: 18}`, Fountain / Dark on B: `{x: 22, z: 30}`) and stall rushes with choke smokes.
- On bomb plant, surviving CTs rally at retake staging points outside site until regrouped ($\ge 2$ CTs) or timer reaches urgent threshold (<26s), then pop-flash onto site and breach simultaneously in crossfire.

### 7. HUD Radio Chatter Integration (`FpsLiveBroadcast.tsx`, `fps-live-broadcast.css`)
- Added `.blast-focus-card__radio` badge to the spectator focus card, displaying live radio messages (e.g. trading, pop-flash, cycling bolt) in cyan tactical styling.

## Verification & Test Results
- Automated Test Suite:
  - `node --test EsportsClash.Web/src/fpsLiveTactics.test.mjs`: **27/27 passed** (including 4 new tests for trade reflex, sniper shoot-and-scoot, support pop-flash, and entry clearance).
  - `node --test EsportsClash.Web/src/fpsLiveIntel.test.mjs`: **13/13 passed**.
  - `node --test EsportsClash.Web/src/fpsIdentity.test.mjs EsportsClash.Web/src/fpsSkillProfile.test.mjs EsportsClash.Web/src/fpsPersonality.test.mjs EsportsClash.Web/src/fpsRoundSimulation.test.mjs EsportsClash.Web/src/fpsMatchSimulation.test.mjs`: **60/60 passed**.
  - Total FPS test suite: **100/100 tests passed**.
  - `npm --prefix EsportsClash.Web run check:game`: **746 MOBA/arena tests, 3 multi-seed simulation checks, design validation all passed**.
  - `npm --prefix EsportsClash.Web run build` (`tsc -b && vite build`): **Passed cleanly in 7.36s with zero errors**.
