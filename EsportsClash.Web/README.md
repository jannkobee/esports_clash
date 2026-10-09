# Esports Clash Web

React and TypeScript front end for the Esports Clash manager game. Run these commands from `EsportsClash.Web`:

```bash
npm install
npm run dev
npm run build
npm test
```

The playable draft launches `AramMatchView`. Its combat decisions live in `src/combatDecision.ts`. Players act on their own during matches: card IQ affects target priority, retreats, objectives, and when to use skills; TF affects teamfight target execution, while LAN and IQ affect skillshot dodging. The blue squad uses the same decision rules as the opponent. Pause and speed controls remain available for viewing the match.

The larger map has three turrets and three barracks per side. Destroying a barracks empowers the matching melee, ranged, or catapult minions in later waves. Jungle camps fight back, and Embermaw is the upper dragon objective. Every champion casts a second skill and has visible effects for all three abilities. The layout and barracks rules are in `src/arenaRules.ts`.

The match also has a lower Gravemarch golem objective, four blue and red crest buff camps, five-shot nexus defense, a home-only shop, six combat items plus boots and a free ward slot, and a docked squad HUD. Strong farmers can finish six combat items around 15:00; income, farm, recalls, and team ratings produce different timings. See `../docs/arena-mechanics.md` for the gameplay invariants and source references.
