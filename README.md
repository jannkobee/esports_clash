> Current Hexatrick deployment: [first-deployment initializer and Supporter runbook](docs/hexatrick-first-deployment-and-supporters-20261109.md), [living-world implementation](docs/hexatrick-living-world-ui-20261109.md), [tactical FPS broadcast architecture](docs/fps-blast-hud-and-proactive-play-20261111.md), and [active handoff](docs/agent-handoff.md).

# hexatrick

A club-management game with scheduled tactical FPS matches, a shared human/bot transfer market, global competitions, and Hexapedia as its public reference. Open the local app at `http://localhost:8088`.

Current direction and implementation are recorded in [the club phase plan](docs/club-management-phase-plan.md), [the Hexatrick living-world plan](docs/hexatrick-world-phase-plan.md), [the FPS transition plan](docs/fps-transition-plan.md), [the FPS identity integration](docs/fps-identity-v3-20261110.md), [global competitions](docs/hexatrick-global-competitions.md), and [rookie players, IGNs, nationality and bot management](docs/hexatrick-rookie-world.md). Existing project folders, service names and save keys retain their technical names for compatibility.

---

## Core Systems

- **Living World Club Management**: Weekly and seasonal competition calendars, finances, training, staff conversion, transfer exchange auctions, world wire news, career dossiers, laurels, and supporter tiers.
- **Tactical FPS Simulation & Live Broadcast**: Multi-round CS2-inspired 5v5 tactical FPS engine (`EsportsClash.Web/src/fps/`) featuring dynamic attacker round archetypes, role-driven AI brains (entry, trade, support, lurker, sniper, anchor), smoke/flashbang physics, team economy buys, real-time Babylon.js 3D viewer (`FpsLiveBroadcast.tsx`, `FpsMatchView.tsx`), BLAST-style broadcast HUD, picture-in-picture bomb-plant monitor, and the interactive `#fps-simulation` lab (`FpsSimulationLab.tsx`).
- **Hexapedia Reference**: Public encyclopedia of clubs, players, tournaments, nations, coaches, managers, talent, sponsors, tactical FPS roles, personalities, and attribute reference (`Hexapedia.tsx`, `FpsHexapediaPage.tsx`).

---

## Running the Web Application

```bash
cd EsportsClash.Web
npm install
npm run dev
```

Open `http://localhost:5173` (or `http://localhost:8088` when running the full Docker stack via `compose.evolution.yaml` + `compose.evolution.dev.yaml`).

### Verification & Build

```bash
cd EsportsClash.Web
npm run check:game
npm run build
npm run build:base-inspector
```

---

## Repository Structure

- **`EsportsClash.Web/`**: React 19, TypeScript, Vite, Tailwind CSS, Babylon.js 3D FPS broadcast and Three.js avatar inspection tooling.
  - `src/fps/`: Tactical FPS simulation engine, economy, weapons, map geometry, AI brain, and live 3D broadcast renderer.
  - `src/components/`: Club management workspace, Hexapedia, living world UI, and FPS broadcast/lab components.
- **`EsportsClash.Api/`**: Laravel backend API, authentication, living-world scheduler, competition engine, and backoffice dashboards.
- **`infrastructure/`**: Docker service definitions (`online` FPS match worker, `trellis2`/`unirig`/`avatar-evolution` Colab-backed 3D tooling).
- **`docs/`**: Architecture records, FPS design/verification docs, Hexatrick world docs, Colab 3D asset records, and [docs/agent-handoff.md](docs/agent-handoff.md).
