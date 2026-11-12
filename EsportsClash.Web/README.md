# Esports Clash Web (`hexatrick`)

React, TypeScript, and Babylon.js front end for the Hexatrick club management and tactical FPS broadcast web app. Run commands from `EsportsClash.Web`:

```bash
npm install
npm run dev
npm run build
npm test
```

## Verification & Tooling

- `npm run check:game`: Runs `scripts/validate-design.js`, all `src/*.test.mjs` suites, and `tsc -b`.
- `npm run build`: Type-checks (`tsc -b`) and builds the production Vite bundle (`dist/`).
- `npm run build:base-inspector`: Builds the Colab 3D base mannequin inspector bundle.
- `vite build --config vite.avatar.config.ts`: Builds the Three.js GLB avatar evolution reviewer used by the Laravel backoffice (`avatar-review-dist/`).
- `npm run lint`: Runs `oxlint`.

## Key Modules

- `src/fps/`: Tactical 5v5 FPS round/match engine, AI brains, economy, weapons, map geometry, and Babylon.js 3D live broadcast viewer.
- `src/components/FpsLiveBroadcast.tsx` / `FpsMatchView.tsx` / `FpsSimulationLab.tsx`: Real-time 3D FPS match viewer, BLAST-style broadcast HUD, PIP feed, and local FPS simulation lab (`#fps-simulation`).
- `src/components/Club*.tsx` / `World*.tsx` / `CompetitionHub.tsx` / `Hexapedia.tsx`: Club management workspace, transfer market, world wire, tournaments, dossiers, and public encyclopedia.
