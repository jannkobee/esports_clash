# Esports Clash Web

React and TypeScript front end for the Esports Clash manager game. Run these commands from `EsportsClash.Web`:

```bash
npm install
npm run dev
npm run build
npm test
```

For online **Vs Player**, run the room service and the Vite app in separate terminals:

```bash
npm run room-server
npm run dev
```

Vite proxies `/api` to the room service on port 4174. For a production build, run `npm run build` and `npm run serve`; the same Node service serves the built app and room API from one origin. Set `PORT` in the hosting environment if needed. Both players must use that same server URL; a static-only deployment cannot host online rooms. Rooms currently live in server memory for up to two hours of inactivity and clear on restart. Online players draft separately, then watch the same seeded AI match.

The playable draft launches `AramMatchView`. Its combat decisions live in `src/combatDecision.ts`. Players act on their own during matches: card IQ affects target priority, retreats, objectives, and when to use skills; TF affects teamfight target execution, while LAN and IQ affect skillshot dodging. The blue squad uses the same decision rules as the opponent. Pause and speed controls remain available for viewing the match.

The larger map has three turrets and three barracks per side. Destroying a barracks empowers the matching melee, ranged, or catapult minions in later waves. Jungle camps fight back, and Embermaw is the upper dragon objective. Every champion casts a second skill and has visible effects for all three abilities. The layout and barracks rules are in `src/arenaRules.ts`.

The match also has a lower Gravemarch golem objective, four blue and red crest buff camps, five-shot nexus defense, a home-only shop, six combat items plus boots and a free ward slot, and a docked squad HUD. Early turret plating and the nexus shield create siege stages. Income, farm, recalls, and player ratings determine item timing.

Use **Replay** to rerun the same draft and random seed. **Export** saves a match report that can be loaded from the draft screen. **Run 25** runs live arena simulations in side-swapped seed pairs; **Export balance** saves the resulting metrics and event timelines. See `../docs/arena-mechanics.md` for the gameplay invariants and source references.

The arena dashboard now starts with **Vs AI** and **Vs Player**. Both use one ban per side and alternating picks. Rival AI drafts from player roles, signatures, teamfight composition, and coach style; it varies close choices by seed. Skill damage, direct healing, shields, and cooldowns grow across ability ranks. Matches have no fixed duration. Late game begins at minute 8 with a 3–4 item target; super late game begins at minute 11 with a 5–6 item target for strong farmers. Balance reports record actual item counts at minutes 8, 10, 12 and 13 when matches last that long.
