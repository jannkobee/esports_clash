# ⚡ Esports Clash: GOAT Manager ⚡

A mobile esports management simulation combining the tactical depth of **Teamfight Manager**, the card collection and evolution mechanics of **EA FC Ultimate Team**, the cozy life-simulation of a **Gaming House**, and a fast-paced 1-lane **ARAM Mayhem MOBA auto-battler** featuring chibi parodies of global esports legends.

---

## 🌟 Key Features

1. **EA FC-Style Cards & Evolutions:**
   - Hierarchy: `Bronze` ➔ `Silver` ➔ `Gold` ➔ `Platinum` ➔ `Diamond` ➔ `GOAT` (Highest tier, 96–99 OVR).
   - 6 Core Face Attributes (1–99 scale): **LAN** (Laning/Micro), **TF** (Teamfight), **IQ** (Game Sense/Macro), **CLU** (Clutch Factor), **STA** (Stamina/Tilt Resistance), and **FLX** (Champion Flexibility).
   - **Evolutions Engine:** Complete in-game combat and tournament objectives to permanently evolve cards, increase OVR, unlock **PlayStyle+ Badges**, and upgrade card borders.
   - **Tactical Coaches:** Boost chemistry, add draft ban slots, and grant macro bonuses.

2. **Chibi Esports Multiverse Parodies:**
   - **League of Legends:** *Flaker* (Faker), *Craps* (Caps), *Daft* (Deft), *Ouzi* (Uzi), *Churchy* (Chovy), *GrandCanyon* (Canyon), *TheSpicy* (TheShy).
   - **Counter-Strike:** *p1mple* (s1mple), *NeKo* (NiKo), *WooZy* (ZywOo), *m0NEY* (m0NESY).
   - **Dota 2:** *Mirecle* (Miracle-), *Godson* (Topson), *BigTail* (N0tail), *Puppet* (Puppey).
   - **Valorant:** *DNS* (FNS), *PenZ* (TenZ), *Toaster* (Boaster), *Paspas* (Aspas).

3. **Gaming House & Life Simulation:**
   - Manage facilities: **PC Scrim Room**, **Strategy VOD Room**, **Gym & Wellness**, **Streaming Studio**, **Kitchen**, and **Sleep Pods**.
   - Manage daily schedules, player fatigue, morale, chemistry bonds, and random viral/tilt events.

4. **1-Lane "ARAM Mayhem" MOBA Combat:**
   - Pick & Ban Draft Phase and real-time auto-battle with combat logs, MVP selection, and Mayhem Shrines.
   - Matches are autonomous: each player's IQ drives target selection, retreats, objective calls, and skill timing; TF influences teamfight execution and LAN helps skillshot dodges. Higher IQ improves decisions without guaranteeing perfect play.
   - **5 Initial Champions:**
     - 🛡️ **Solana, the Sun Vanguard** *(Leona)*: Solar CC tank, Sunlight Marks, *Daybreak Flare* AOE stun.
     - 🏹 **Astra, the Frost Sovereign** *(Ashe)*: Frost slows, *Frost Flurry* rapid fire, *Enchanted Crystal Comet* global stun.
     - 🔮 **Kyumi, the Nine-Tailed Spirit** *(Ahri)*: True damage orb, *Charm of Longing*, triple dash *Spirit Rush*.
     - 💥 **Buck, the Boomstick Outlaw** *(Graves)*: 4-pellet shotgun blast, *Smoke Screen* blind, *Collateral Blast* recoil cannon.
     - ⚔️ **Valkira, the Warlord Matriarch** *(Ambessa)*: Dash-on-cast, outer edge bleeds, *Executioner's Descent* lethal execute.

5. **Gacha Economy & Fair Monetization:**
   - Hard Pity system (Guaranteed Platinum at 10 pulls, Diamond at 40, GOAT at 100).
   - Rewarded video ad simulation for daily free scout packs and squad energy refills.

---

## 🚀 How to Run

### 1. Run the Interactive Console Game
```bash
dotnet run --project EsportsClash.ConsoleApp
```

### 2. Run the Automated Test Suite
```bash
dotnet test
```

---

## 📁 Solution Architecture

- **`EsportsClash.Core/`** (.NET 9 / Unity Compatible C# Library)
  - `Models/`: Cards, Attributes, Personalities, Coaches, Badges.
  - `Gacha/`: Gacha tables, pity counters, duplicate conversion, ad claims.
  - `Evolutions/`: Evolution plans, objective tracking, upgrades.
  - `GamingHouse/`: Facilities, daily activities, life-sim engine.
  - `Combat/`: 5 champion kits, combat entities, 1-lane ARAM engine.
  - `Tournaments/`: Split calendar, fixtures, standings, promotions.
- **`EsportsClash.Tests/`**: xUnit tests covering gacha, evolutions, life-sim, combat, and tournaments.
- **`EsportsClash.ConsoleApp/`**: Interactive playable CLI interface with EA FC card inspection and match visualizer.

