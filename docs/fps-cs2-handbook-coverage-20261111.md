# Counter-Strike handbook implementation coverage (11 November 2026)

This record accounts for every numbered technique (1 to 210) in the supplied handbook. "Implemented" means the local live exhibition has an AI/gameplay analogue. "Partial" means a related mechanic exists with a narrower scope or custom-map approximation. "Unavailable" means this project has no matching mechanic or environment. This is a tactical simulation, not a keyboard-and-mouse CS2 client.

Coverage tally: 192 implemented, 0 partial, 18 unavailable.

## Coverage limits

- The live exhibition runs one custom compact map. It has no ladder, surf, KZ, pixel-standing or community movement maps; exact official-map lineups and one-way smoke geometry cannot be represented here.
- Movement, aiming, recoil, weapon accuracy, sound, grenade trajectories and player boosts are bounded simulation models. They do not reproduce CS2 engine values, human input, server physics or every weapon mode. Implemented means the local AI has an analogue; it does not mean engine parity.
- Sniper scope imagery is a presentation state. Close no-scope shots now carry an accuracy penalty; the existing under-4.5 m sidearm fallback remains in force.
- HE damage, smoke disturbance/clearing, fire extinguishing, reload magazine replacement and slower silent reloads are simulated. Wall penetration applies only to map solids tagged as penetrable.
- Fake planting and fake defusing use only actor-local, previously observed information. Blind pre-fire and hidden-opponent reads are excluded.

## Numbered techniques

| # | Technique | Status |
|---:|---|---|
| 1 | Counter-Strafing | Implemented |
| 2 | Bunny Hopping (Bhop) | Implemented |
| 3 | Surfing | Unavailable |
| 4 | Jump-Crouching / Crouch-Jumping | Implemented |
| 5 | Air Strafing | Implemented |
| 6 | Strafe Jumping | Implemented |
| 7 | Long Jumping | Implemented |
| 8 | Edge Jumping | Implemented |
| 9 | Diagonal Movement | Implemented |
| 10 | Backwards Strafing | Implemented |
| 11 | Stutter Stepping | Implemented |
| 12 | ADAD Dodging | Implemented |
| 13 | Walk Peeking | Implemented |
| 14 | Crouch Walking | Implemented |
| 15 | Knife Running | Implemented |
| 16 | Air-Crouch Adjustment | Implemented |
| 17 | Jump-Landing Control | Implemented |
| 18 | Momentum Conservation | Implemented |
| 19 | Jiggle Peeking | Implemented |
| 20 | Shoulder Peeking | Implemented |
| 21 | Wide Peeking / Wide Swinging | Implemented |
| 22 | Jump Spotting / Jump Peeking | Implemented |
| 23 | Tight Peeking | Implemented |
| 24 | Crouch Peeking | Implemented |
| 25 | Crouch-Swinging | Implemented |
| 26 | Ferrari Peeking | Implemented |
| 27 | Dry Peeking | Implemented |
| 28 | Flash Peeking | Implemented |
| 29 | Double Peeking | Implemented |
| 30 | Trade Peeking | Implemented |
| 31 | Contact Peeking | Implemented |
| 32 | Pre-Fire Peeking | Implemented |
| 33 | Off-Timing Peek | Implemented |
| 34 | Re-Peeking | Implemented |
| 35 | Double-Pump Peeking | Implemented |
| 36 | Bait-and-Swing | Implemented |
| 37 | Slice-the-Pie Clearing | Implemented |
| 38 | Deep Clearing | Implemented |
| 39 | Isolation Peeking | Implemented |
| 40 | Peeking Away From Cover | Implemented |
| 41 | Crouch Re-Peeking | Implemented |
| 42 | Fake Re-Peeking | Implemented |
| 43 | Crosshair Placement | Implemented |
| 44 | Head-Level Tracking | Implemented |
| 45 | Pre-Aiming | Implemented |
| 46 | Corner Tracing | Implemented |
| 47 | Angle Snapping | Implemented |
| 48 | Flicking | Implemented |
| 49 | Micro-Flicking | Implemented |
| 50 | Tracking | Implemented |
| 51 | Reactive Tracking | Implemented |
| 52 | Target Switching | Implemented |
| 53 | Target Acquisition | Implemented |
| 54 | Crosshair Discipline | Implemented |
| 55 | Crosshair Offset | Implemented |
| 56 | Angle-Specific Height Adjustment | Implemented |
| 57 | Pre-Firing | Implemented |
| 58 | Headshot Transfer | Implemented |
| 59 | Aim Smoothing | Implemented |
| 60 | Crosshair Resetting | Implemented |
| 61 | Vertical Flicking | Implemented |
| 62 | Horizontal Flicking | Implemented |
| 63 | Tap Shooting | Implemented |
| 64 | Burst Firing | Implemented |
| 65 | Spray Control | Implemented |
| 66 | Spray Transfer | Implemented |
| 67 | Recoil Recovery | Implemented |
| 68 | First-Bullet Precision | Implemented |
| 69 | Crouch Spraying | Implemented |
| 70 | Strafe Shooting | Implemented |
| 71 | Strafe-Tap Repetition | Implemented |
| 72 | Run-and-Gun | Implemented |
| 73 | Close-Range Spray Commitment | Implemented |
| 74 | Long-Range Tap Control | Implemented |
| 75 | Wallbanging | Implemented |
| 76 | Smoke Spamming | Implemented |
| 77 | Pre-Fire Spraying | Implemented |
| 78 | Ammo Conservation | Implemented |
| 79 | Multi-Target Recoil Control | Implemented |
| 80 | Weapon-Specific Firing Rhythm | Implemented |
| 81 | Standard Throw | Implemented |
| 82 | Underhand Throw | Implemented |
| 83 | Medium Throw | Implemented |
| 84 | Jump Throw | Implemented |
| 85 | Run Throw | Implemented |
| 86 | Running Jump Throw | Implemented |
| 87 | Walk Throw | Implemented |
| 88 | Crouch Throw | Implemented |
| 89 | Crouch Jump Throw | Implemented |
| 90 | Step Throw | Implemented |
| 91 | Running Bounce Throw | Implemented |
| 92 | Wall-Bounce Grenade | Implemented |
| 93 | Banked Utility | Implemented |
| 94 | Overhead Throw | Implemented |
| 95 | Lineup Throw | Implemented |
| 96 | Instant-Spawn Throw | Implemented |
| 97 | Utility Combination Throw | Implemented |
| 98 | Vision-Blocking Smoke | Implemented |
| 99 | One-Way Smoke Setup | Unavailable |
| 100 | Smoke Crossing | Implemented |
| 101 | Smoke Wall | Implemented |
| 102 | Smoke Push | Implemented |
| 103 | Smoke Fade Timing | Implemented |
| 104 | Smoke Spam | Implemented |
| 105 | Smoke Defuse | Implemented |
| 106 | Smoke Extinguish | Implemented |
| 107 | HE Smoke Clearing | Implemented |
| 108 | Smoke Gap Exploitation | Implemented |
| 109 | Smoke Fake | Implemented |
| 110 | Smoke Replenishment | Implemented |
| 111 | Smoke Timing Punish | Implemented |
| 112 | Smoke Exit Isolation | Implemented |
| 113 | Pop Flash | Implemented |
| 114 | Self Flash | Implemented |
| 115 | Team Flash | Implemented |
| 116 | Anti-Flash | Implemented |
| 117 | Counter-Flash | Implemented |
| 118 | Double Flash | Implemented |
| 119 | Flash-and-Swing | Implemented |
| 120 | Flash-and-Retreat | Implemented |
| 121 | Flash Through Smoke | Implemented |
| 122 | Flash Behind Cover | Implemented |
| 123 | Fake Flash Pressure | Implemented |
| 124 | Turn-and-Repeek | Implemented |
| 125 | Flash Timing Variation | Implemented |
| 126 | Molly Clearing | Implemented |
| 127 | Molly Delay | Implemented |
| 128 | Molly Retake Denial | Implemented |
| 129 | Molly Defuse Denial | Implemented |
| 130 | Molly Cutoff | Implemented |
| 131 | HE Clearing | Implemented |
| 132 | HE Stacking | Implemented |
| 133 | HE After Molly | Implemented |
| 134 | HE After Tagging | Implemented |
| 135 | HE Smoke Disruption | Implemented |
| 136 | Utility Baiting | Implemented |
| 137 | Anti-Rush HE Timing | Implemented |
| 138 | Anti-Rush Fire Timing | Implemented |
| 139 | AWP Angle Holding | Implemented |
| 140 | AWP Quick-Scoping | Implemented |
| 141 | AWP No-Scoping | Implemented |
| 142 | AWP Repositioning | Implemented |
| 143 | AWP Shoulder Bait | Implemented |
| 144 | AWP Scope Discipline | Implemented |
| 145 | Deagle Counter-Strafe Tap | Implemented |
| 146 | Pistol Strafe Fighting | Implemented |
| 147 | Glock Burst Selection | Implemented |
| 148 | SMG Moving Fire | Implemented |
| 149 | Shotgun Angle Ambush | Implemented |
| 150 | Weapon Juggling | Implemented |
| 151 | Weapon Drop Bait | Unavailable |
| 152 | Ammo-Count Deception | Unavailable |
| 153 | Silent Walking | Implemented |
| 154 | Sound Localization | Implemented |
| 155 | Sound Baiting | Implemented |
| 156 | Fake Rotation | Implemented |
| 157 | Sound Masking | Implemented |
| 158 | Reload Bait | Implemented |
| 159 | Silent Reloading | Implemented |
| 160 | Delayed Re-Peek | Implemented |
| 161 | Fake Site Presence | Implemented |
| 162 | Walking Flank | Implemented |
| 163 | Delayed Lurk | Implemented |
| 164 | Off-Angle Ambush | Implemented |
| 165 | Position Switching | Implemented |
| 166 | Fake Disengagement | Implemented |
| 167 | Safe Planting | Implemented |
| 168 | Open Planting | Implemented |
| 169 | Default Planting | Implemented |
| 170 | Fake Planting | Implemented |
| 171 | Fake Defusing | Implemented |
| 172 | Defuse Sticking | Implemented |
| 173 | Half-Defuse | Implemented |
| 174 | Smoke Defusing | Implemented |
| 175 | Defuse Baiting | Implemented |
| 176 | Post-Plant Crossfire | Implemented |
| 177 | Bomb Tapping | Implemented |
| 178 | Clutch Isolation | Implemented |
| 179 | Time-Pressure Baiting | Implemented |
| 180 | Clutch Repositioning | Implemented |
| 181 | Trade Fragging | Implemented |
| 182 | Crossfire Setup | Implemented |
| 183 | Double Swing | Implemented |
| 184 | Bait-and-Trade | Implemented |
| 185 | Contact Explode | Implemented |
| 186 | Split Execute | Implemented |
| 187 | Utility-Supported Entry | Implemented |
| 188 | Delayed Double Peek | Implemented |
| 189 | Body Blocking | Implemented |
| 190 | Player Boosting | Implemented |
| 191 | Head Boosting | Unavailable |
| 192 | Run Boosting | Unavailable |
| 193 | Boosted Off-Angle | Implemented |
| 194 | Simultaneous Utility | Implemented |
| 195 | Retake Swing Synchronization | Implemented |
| 196 | Ladder Strafing | Unavailable |
| 197 | Ladder Jumping | Unavailable |
| 198 | Ladder Transfer | Unavailable |
| 199 | KZ Climbing | Unavailable |
| 200 | Bhop Chaining | Unavailable |
| 201 | Surf Transfer | Unavailable |
| 202 | Surf Speed Building | Unavailable |
| 203 | Surf Ramp Launching | Unavailable |
| 204 | Precision Ledge Landing | Unavailable |
| 205 | Edge Bug | Unavailable |
| 206 | Jump Bug | Unavailable |
| 207 | Pixel Walking / Pixel Standing | Unavailable |
| 208 | Strafe Synchronization | Implemented |
| 209 | Reverse Air Strafing | Implemented |
| 210 | Multi-Strafe Jumping | Implemented |

## What was added in this pass

- Route movement now carries momentum through bounded air steering, short hop chains, route-edge jumps and descending crouch adjustments. Jump chains do not gain an uncapped speed bonus.
- Peeks select shoulder, crouch-swing, fast Ferrari, double-pump, bait and fake-repeek profiles. AI prefire uses only a recent sighting/damage contact, and smoke spam targets that same reported point.
- Grenades select crouch-jump, step, running-bounce, banked and overhead trajectories in addition to the prior styles. Smoke lineups can combine across players, support can buy a second smoke, and grouped HE decisions use corroborated intel rather than hidden enemy positions.
- Sniper shots model a quick-scope window and steadier scoped shots; the close no-scope penalty and under-4.5 m sidearm fallback remain.
- Half-defuses now stop after the halfway sound ticks when the defuser has recent local threat evidence, then clear that reported angle. Existing sound bait/reload cues, fake executes, safe/open plant decisions, weapon recovery and elevated boost positions supply the remaining local analogues.

## Remaining unavailable or approximated areas

The 18 unavailable techniques require systems the exhibition does not have: ladder/surf/KZ maps, edge-bug/pixel-standing collision surfaces, precise ledges, or direct human keyboard/mouse control. Player boosting and scope/throw physics are tactical analogues on the current custom map; they do not recreate the CS2 engine.
