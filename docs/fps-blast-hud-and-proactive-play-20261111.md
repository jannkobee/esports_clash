# BLAST Premier Broadcast HUD and Proactive Information Play (2026-11-11)

## Overview
At the user's request, the live exhibition broadcast HUD was redesigned to emulate modern Tier-1 esports broadcasts (BLAST Premier and ESL Pro League), while resolving the bot freezing behavior, enforcing strict eye-level 3D vision, adding grenade throwing animations, and improving tactical teammate spacing.

## 1. BLAST Premier & ESL Pro League Broadcast HUD

### Top-Center Match Scoreboard
- **CT / T Team Blocks**: Dedicated high-contrast score tiles (`13` vs `11`), team crests, and team names (`CT FORCE` / `T FORCE` / `BLUE FIVE` / `RED FIVE`).
- **Match Clock & Bomb Status**: Centered timer in bold tabular numbers (`1:30`). When the device is planted, converts to a pulsing red warning timer with bomb icon (`💣 0:34`).
- **AI Win Prediction Bar**: Real-time calculated win probability based on alive players, HP, weapons, bomb plant status, and round context, displayed as `[Blue %] AI PREDICTION [Red %]` with a dual-color progress bar.
- **Tournament Header**: Top-left pill displaying `BLAST PREMIER / HEXATRICK · BREAKWATER YARD · MR15`.

### Signature Bottom 10-Player Broadcast Dock
- Replaced the side columns with a horizontal dock spanning the bottom of the screen:
  - **Left 5 Cards**: Blue Team operatives.
  - **Right 5 Cards**: Red Team operatives.
  - **Center Focus Box**: Dedicated spectator camera card.
- **Player Card Features**:
  - **Tactical SVG Avatar**: Distinct CT Navy helmet with reflective visor and comms headset, or T crimson jacket with balaclava and aviator sunglasses. When eliminated, card displays a skull icon and dims into grayscale.
  - **High-Contrast HP**: Bold white numbers (`100`), with an animated health bar depleting smoothly.
  - **Economy & Aliases**: Displays cash (`$800`), role, and player gamertag (`Zypoo`, `d4nk`, `M0cke`, `flopz`, `SneakBro`, `Cardrel`, etc.).
  - **Gear Strip**: SVG silhouettes for primary/secondary weapon (Rifle, Sniper, SMG, Pistol, Knife), grenade pips (Flash, Smoke), Armor & Helmet icons, Defuse Kit icon for CTs, and glowing Bomb icon for the bomb carrier.
  - **Spectator Focus Indicator**: Golden glowing border and `▲` pointer indicating the currently observed player; clicking any player card immediately switches spectator camera to them.
- **Center Spectator Focus Card**:
  - Displays followed player profile, callout location (`📍 Banana Car`), current weapon, large ammo display (`30 / 90`), real-time action, tactical intent, and quick camera mode toggles (`1P`, `3P`, `AUTO`, `MAP`).

### Killfeed & Minimap
- **Killfeed (Top Right)**: Stacked dark pills displaying killer in team color, weapon silhouette, glowing red headshot reticle (`⌖`), and victim.
- **Tactical Minimap (Top Left)**: Features bombsite capture zones, dropped/planted bomb indicators, smoke clouds, and player dots with directional $94^\circ$ eye-vision cones.

## 2. Strict Eye-Level 3D Vision ("Only on their eyes")
- **Eye Heights**: Standing eye level ($1.60\text{m}$) vs crouched eye level ($1.08\text{m}$).
- **3D Vertical Ray Occlusion**: Tested against solid obstacles in `fpsLiveMap.ts` (`liveSightline(a, b, eyeA, eyeB)`):
  - Standing players can look over $1.1\text{m}$ sandbags and $1.15\text{m}$ half-crates.
  - Crouched players behind low cover are completely occluded and cannot see or be seen over the obstacle.
  - Full-height geometry ($2.5 - 4.5\text{m}$) blocks standing and crouched vision alike.
- **Human Focus Vision Cone**: Tightened from $155^\circ$ down to authentic $94^\circ$ ($\pm 0.82\text{ rad}$) peripheral focus cone.

## 3. Proactive Information Play & Wall-Staring Fix
- **Pre-Aim Wall Occlusion Check**: In `preAim()`, bots no longer blindly lock onto static world positions behind solid geometry (such as the B fountain pedestal). If the assigned hold point is occluded, bots look toward the nearest unoccluded choke or entry angle.
- **Proactive Progression**: When attackers hold an approach or choke for $>2.0\text{s}$ with no enemy contact, their brain transitions to actively taking space toward the bomb site and executing the plant rather than freezing indefinitely in `Holding`.
- **Dynamic Trade Spacing**: Teammates maintain $3.5 - 5.0\text{m}$ trailing distance with a $1.5\text{m}$ lateral offset, forming a staggered dual-angle wedge that prevents lining up in single file, eliminates teammate jamming, and creates crossfire opportunities.

## 4. Verification
- `npm run check:game`: Passed (746 tests passed/skipped, 0 failures; match simulation invariant passed).
- `npm run build`: Built clean in 5.60s.
- `node --test src/fpsLiveTactics.test.mjs`: All 23 tactical tests passed.
