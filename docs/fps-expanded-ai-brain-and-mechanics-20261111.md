# Expanded AI Brain, Item Knowledge, Mechanical Micro-Movements, and Adaptive Defense (2026-11-11)

## Overview
At the user's request, the live exhibition AI brain was significantly enlarged with deep Counter-Strike item mechanics (smokes, flashbangs), dynamic round strategy archetypes for infinite play possibilities, active team communication/radio chatter, mechanical micro-movements (jumping physics, corner jump-peeking, gunfight strafing and counter-strafing), history-based CT defensive counter-adaptation, and strict out-of-bounds containment. Tests were skipped during this iteration per the user's explicit instruction.

---

## 1. AI Item Mechanics Knowledge (Smokes & Flashes)

The AI actors now understand the physical and tactical rules of CS items and let that information dictate their decisions:

### Smoke Mechanics
- **Vision Blocking**: Smokes produce a 4.0m radius opaque sphere for 18 seconds, completely blocking raycast line of sight.
- **Attacker Execute Smokes**:
  - When executing B, attackers throw smokes to cut off CT rotation crossfires at Speedway (`{ x: 18, z: 25 }`) and Church/Ruins (`{ x: 27, z: 24 }`).
  - When executing A, attackers smoke off Arch/Moto (`{ x: -16, z: 24 }`) and Library (`{ x: -11, z: 30 }`).
- **Ninja Smoke Plant**:
  - When the bomb carrier reaches the bombsite under pressure or enemy contact, if they carry a smoke, they deploy smoke directly at `{ x: p.x, z: p.z }` and execute a ninja smoke plant inside the cloud.
  - Team callout: `"[RADIO] {player}: Smoking site for ninja plant!"`
- **Defender Delay Smokes**:
  - Defenders holding Banana (`{ x: 20, z: -4 }`) or A Main (`{ x: -19, z: 3 }`) who detect rushing footsteps or gunfire immediately deploy delay smoke at the choke to deny vision and stall the rush for 18 seconds.
  - Team callout: `"[RADIO] {player}: Smoking choke to stall rush!"`
- **Ninja Smoke Defuse**:
  - When a defender defuses a planted bomb while enemies are still alive, they deploy smoke directly over the bomb (`{ x: bomb.x, z: bomb.z }`) to defuse unseen.
  - Team callout: `"[RADIO] {player}: Smoking bomb for ninja defuse — cover me!"`
- **Smoke Discipline**:
  - Players avoid dry-running blindly through active hostile smoke clouds unless low on round clock (<12s) or popping a flashbang through it. Instead, they hold crosshairs on the smoke edge for enemies pushing through.

### Flashbang Mechanics
- **Entry Pop-Flashing**: Support players throw high-trajectory flashbangs over walls and chokes right before entries swing (`"[RADIO] {player}: Pop-flash out! Swing now!"`).
- **Exploiting Flashed Enemies**: When an observed enemy is blinded (`target.blinded > 0.3s`), nearby teammates immediately push with aggressive stance (`'pressure'`) to swing and trade/eliminate the blinded player.
- **Flashed Reaction**: When an operative is blinded (`p.blinded > 0.4s`), they immediately crouch down, turn away from incoming fire, and backpedal into cover rather than standing vulnerable in the open.

---

## 2. Infinite Possibilities: Dynamic Round Archetypes & Active Team Comms

Replaced repetitive fixed rounds with varied tactical round archetypes:

### Attacker Strategy Archetypes (`LiveTacticArchetype`)
1. `'rush_b'`: 5-man fast Banana rush with early pop-flashes and entry sprint.
2. `'rush_a'`: 5-man fast A Main blitz into Pit/Balcony.
3. `'default_pick'`: 2-1-2 spread default (2 Banana, 1 Mid/Underpass, 2 Apartments). Hold quiet angles, probe for picks/pushes, gather info, then execute the weaker site.
4. `'split_b'`: Pincer attack on B (3 Banana + 2 Underpass to Speedway flank).
5. `'split_a'`: Pincer attack on A (3 A Main + 2 Balcony drop).
6. `'fake_execute'`: Heavy smoke/flash feint at A to draw CT rotations, while bomb carrier quietly wraps through Underpass to plant at empty B.
7. `'mid_control'`: Focus 3 players taking Mid and Underpass, cutting off CT rotations between A and B, then pinching a site.

### Active In-Game Team Communication
- Tactical callouts broadcast via `this.emit('objective')`, displayed in the HUD live calls bar and player intent box:
  - `"[RADIO] Caller: Fast B Banana rush — flood site and plant!"`
  - `"[RADIO] Caller: Ts favored B — stacking B Basin with delay smokes"`
  - `"[RADIO] Caller: 2-1-2 Default — gather info and look for opening picks"`
  - `"[RADIO] Caller: Split B — Banana and Underpass pincer attack"`
  - `"[RADIO] Caller: Fake A execute — make noise A, plant B!"`
  - `"[RADIO] {player}: Smoking site for ninja plant!"`
  - `"[RADIO] {player}: Pop-flash out! Swing now!"`
  - `"[RADIO] {player}: Enemy flashed! Swing together!"`

---

## 3. Mechanical Micro-Movements: Jumping, Peeking & Strafing

Restored and expanded mechanical micro-play across both simulation and 3D rendering:

### Vertical Jumping Physics
- Implemented `advanceLiveJump` with authentic gravity:
  - Initial vertical velocity $v_y = 4.2\text{ m/s}$
  - Gravity $g = -12.5\text{ m/s}^2$
  - Airtime $\approx 0.67\text{ s}$, peak height $\approx 0.71\text{ m}$
- **Jump-Peeking**: Entry fraggers and scouts peeking contested corners (Banana corner, A Main, Apps window) perform tactical jump-peeks to spot enemy positions with reduced headshot vulnerability.
- **Jump Accuracy Bloom**: Weapon spread increases by $2.5\times$ while airborne (`spread * 2.5`), matching CS2 ballistics.
- **3D Viewer Integration**:
  - Operative mesh root position elevated by `jumpY`.
  - Tactical leg tuck animation during jump (`leftLeg.rotation.x = -0.38`, `rightLeg.rotation.x = -0.28`).
  - Viewmodel weapon and first-person camera eye height seamlessly follow jump height.

### Strafing & Counter-Strafing
- In gunfights (`p.target` engaged), operatives apply lateral $A/D$ strafe movement perpendicular to the target vector.
- **Counter-Strafing**: High-mechanics players tap the opposite direction to rapidly brake to $0\text{ m/s}$ in 1–2 physics ticks for pinpoint first-shot accuracy.
- **Jiggle-Peeking**: Brief shoulder-peek out of cover ($0.9\text{m}$), spot/fire 1 tap, and counter-strafe back behind the wall.

---

## 4. Active CT Defense & History-Based Counter-Adaptation

CT defenders no longer passively sit in corners. They analyze past rounds from `roundHistory` and actively adapt their setups:

- **B Stack (`'stack_b'`)**: When Ts have attacked B in $\ge 2$ of the last 3 rounds, CTs deploy 4 defenders to B (Car, Sandbags, Fountain, Church) with early delay smokes, leaving a solo anchor on A Pit.
- **A Stack (`'stack_a'`)**: When Ts have favored A, CTs deploy 4 defenders to A (Pit, Balcony, Loggia, Graveyard).
- **Aggressive Banana Push (`'aggressive_banana'`)**: When Ts played slow default, CT callers send 2 aggressive players pushing down Banana with utility to take early map control.
- **Mid Flank Push (`'mid_push'`)**: CT scout pushes through Underpass/Mid to flank rotating attackers from behind.
- **Synchronized Retake**: When bomb is planted, living CTs regroup at retake choke points (Speedway/Church for B, Arch/Library for A), wait for each other, pop retake flashes together, and push in staggered trade spacing.

---

## 5. Cut Off Out-of-Bounds Play

Enforced strict map boundaries across all systems:
- Clamped all player swept movement in `applyMotion` strictly to $x \in [-34.0, 34.0]$ and $z \in [-43.0, 43.0]$.
- Tightened `liveWalkable` to $|x| \le 34.5$ and $|z| \le 43.8$.
- Clamped destination selection in `safeLivePoint` to $[-34.0, 34.0]$ and $[-43.0, 43.0]$.
- Clamped first-person, third-person, and overview spectator camera positions in `fpsLiveViewer.ts` so cameras never drift outside stadium boundaries or clip behind outer perimeter walls.

---

## 6. Verification
- `npm run build`: Production build completed cleanly with exit code 0 (`tsc -b && vite build` in 19.81s).
- Tests skipped per user's explicit instruction (`"Skip tests"`).
- All core gameplay invariants, parody aliases (`Cardrel`, `Zypoo`, `d4nk`, `flopz`, etc.), and MOBA gates preserved.
