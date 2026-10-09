# ⚡ Esports Clash: GOAT Manager ⚡

A competitive esports management simulation combining the tactical depth of **Teamfight Manager**, the card collection and evolution mechanics of **EA FC Ultimate Team**, and a fast-paced 1-lane **Bridge Arena MOBA auto-battler** featuring procedural chibi parodies of global esports legends.

---

## 🌟 Key Features

### 1. Pure Chess-Style Ranked Ladder & Multiplayer (Starts at 300 Rating)
- **Competitive Ladder**: Pure Chess Elo rating system starting at **300 Rating** (Pawn tier) with a protected 300 rating floor.
- **No LP & No Bronze/Silver/Gold**: Traditional MOBA rank tiers and League Points are completely omitted in favor of 9 authentic Chess ranks:
  - ♟️ **Pawn (Novice Contender)**: `300 – 599 Rating` *(Entry rank)*
  - ♞ **Knight (Tactical Striker)**: `600 – 899 Rating`
  - ♝ **Bishop (Diagonal Strategist)**: `900 – 1199 Rating`
  - ♜ **Rook (Fortress Commander)**: `1200 – 1499 Rating`
  - ♛ **Queen (Grand Strategist)**: `1500 – 1799 Rating`
  - 🎖️ **Candidate Master (CM)**: `1800 – 2099 Rating`
  - 🎗️ **National Master (M)**: `2100 – 2399 Rating`
  - ⚔️ **International Master (IM)**: `2400 – 2699 Rating`
  - 👑 **Super Grandmaster (GM)**: `2700+ Rating`
- **Multiplayer Vs Player Modes**:
  - **Ranked Match (Competitive Ladder)**: Real-time room match where your Chess Rating is on the line. Climb ranks, maintain win streaks, and earn promotions.
  - **Normal Match (Unranked Exhibition)**: Casual friendly multiplayer matches with zero rating risk. Ideal for testing new roster combinations and evolved cards.
- **Living Global Leaderboard**: Full leaderboard of ~40 teams spanning 300 to 2850 Elo with active direct challenge options.

### 2. EA FC-Style Cards & Evolutions Hub
- **Hierarchy**: `Bronze` ➔ `Silver` ➔ `Gold` ➔ `Platinum` ➔ `Diamond` ➔ `GOAT` (96–99 OVR).
- **Attributes**: **LAN** (Laning/Micro), **TF** (Teamfight), **IQ** (Game Sense/Macro), **CLU** (Clutch Factor), **STA** (Stamina), and **FLX** (Pool Flexibility).
- **Multi-Role Evolution**: Unlock secondary combat roles (e.g. Mage cards evolving to also pilot Support or Marksman champions) with full on-role combat scaling and signature avatar familiarities.
- **Card Pack Store**: Authentic walkout animations, themed packs, and automated duplicate recycling into Clash Coins.

### 3. 1-Lane Bridge Arena Combat & 39 Chibi Avatars
- **Tactical Roles**: Lineups organize into `FRONTLINE`, `SKIRMISHER`, `CORE PLAYMAKER`, `DAMAGE CARRY`, and `TACTICAL SUPPORT`.
- **Roster of 39 Champions**: Includes original favorites alongside deep additions:
  - **Kaelen** (Invoker spellweave duality: Pyra & Surge), **Hweilin** (Hwei calligraphy painter), **Jaxon** (Jayce hammer/cannon), **Valerie** (Vi atlas gauntlets), **Jinxy** (Jinx rocket launcher), **Paxi** (Puck faerie dragon), **Batrix** (Batrider shadow bat), **Quillback** (Bristleback quill brawler), and **Aetheris** (IO celestial wisp).
  - Every champion features a dedicated procedural TFT-style animated chibi model with directional facing, attack recoil, and skillshot effects.
- **Strategic Combat Simulation**: Objective prioritisation (Ancient Dragon Embermaw, Gravemarch Golem, jungle crests), destructible barracks, minion wave pushing, and cover-first retreat mechanics into bushes or base well.

### 4. Pro Circuit & Scouting
- Living database of 120+ authentic pro esports teams across LCK, LPL, LEC, LCS, and Challengers with tactical archetypes, dynamic rosters, and coaches.
- Champion synergy and counter-pick matrix for draft preparation.

---

## 🚀 How to Run the Web Application

The flagship application is located in `EsportsClash.Web/`:

### 1. Install Dependencies
```bash
cd EsportsClash.Web
npm install
```

### 2. Development Mode
```bash
npm run dev
```
Open `http://localhost:5173` in your browser.

### 3. Run Automated Anti-Regression Tests
```bash
npm run check:game
```
Runs the full anti-regression design verification and 70+ node test suites.

### 4. Build for Production
```bash
npm run build
```

### 5. Run the Multiplayer Room Server
```bash
npm run serve
```
Launches the real-time room server on port `4174` for online drafts and multiplayer matches.

---

## 📁 Repository Structure

- **`EsportsClash.Web/`**: Production web application (React 19, TypeScript, Vite, Tailwind CSS, Canvas).
  - `src/ladderRating.ts`: Pure Chess Elo rating calculations, 9 Chess tiers (Pawn to Grandmaster), and ladder state.
  - `src/components/RankedLadderView.tsx`: Interactive competitive ladder leaderboard, career statistics, and multiplayer matchmaker.
  - `src/components/AramMatchView.tsx`: Real-time 1-lane canvas combat simulation with procedural chibi sprite rendering.
  - `src/components/DraftPhaseView.tsx`: Pick & Ban drafting system with synergy AI and live timer.
  - `src/onlineRooms.ts` & `server.mjs`: Real-time online multiplayer room synchronization.
  - `docs/`: Invariant rules, architecture decisions, and agent handoff logs.
