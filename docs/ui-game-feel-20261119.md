# Game feel: Squad, Transfers, The Wire, Hexacast, Supporter studio, Hexapedia, logo and portraits (2026-11-19)

After the [visual polish pass](ui-visual-polish-20261119.md), the owner asked for more:

- Squad should feel like a game, with more to interact with and fewer words.
- The Wire had layout bugs, and its replies did not look like replies. X.com is the reference.
- Supporter studio felt thin.
- Hexapedia needed more of the wiki feel (Liquipedia).
- A better logo and better player art.
- Hexacast in the style of Twitch, or HLTV for match listings.
- Transfers should give the feeling of "this player makes my team better".

The external sites are layout references only. No branding, names or assets are copied.

## Shared game kit (`src/components/game/`)

| File | What it is |
|---|---|
| `positions.ts` | The six attributes in radar order, with short codes (RIF, ENT, UTL, CAL, POS, SNP). Metadata for all ten positions: icon, label, job, and board placement in percent. `positionFit(stats, position)` uses exactly the weights in `FpsPlayerArchitecture::recommendedAssignments`, so the fit shown is the server's strength score. It is strength only; the assigned identity still comes from personality. Rarity tiers on the 1–10 scale: 1–2 Prospect, 3–4 Pro, 5–6 Star, 7–8 Elite, 9–10 Legend. |
| `HexRadar.tsx` | A six-axis hexagon radar, with an optional dashed comparison shape and labelled values that show up or down arrows. It animates in. |
| `PlayerCard.tsx` | A collectible-style card: rating badge, tier, flag, portrait, six stats, position chips. Optional: selection glow, slot number, flip side, drag and drop (`text/hexatrick-player`), per-stat deltas, and a ribbon. It tilts and shines on hover, except under reduced motion. `RatingBadge` is exported too. |
| `PipMeter.tsx` | A lit-pip meter with `role="meter"`. |
| `TacticsBoard.tsx` | A schematic field per side, with sites at the top and the five position nodes. Click a node to pick from the five, ranked by fit, or drag tokens between nodes. A taken position swaps the two players, so positions stay unique; the server checks uniqueness only among starters. Auto-fill uses the server's recommendations. |
| `game.css`, `tactics-board.css` | Styles for all of the above. |

## Screens

- **Squad** (`SquadRoster.tsx`, `squad-roster.css`).
  - Team overview: a rating ring, the team radar ("Strongest at …") and readiness pips (starters, T positions, CT positions), with "Set positions".
  - The starting five as large cards. Click one, then a bench card, or drag a bench card onto a starter. Cards flip to show personality, tendencies, form and wage.
  - Bench cards carry a "+N on #slot" ribbon when they would be an upgrade.
  - The save bar appears only when the lineup has changed.
  - The searchable table moved into a collapsed "Roster list".
  - `lineupReadiness` and the props are unchanged.
- **Tactics** (`FpsTacticalSystemEditor.tsx`, `tactical-system.css`).
  - The tactics board comes first.
  - Gameplan shows six philosophy tiles plus a "Custom blend" pill, then the dials.
  - Player orders are one row per player: positions as chips, instruction as an icon toggle (Balanced, Hold, Take initiative, Support), a training select, and coach, plan and chemistry fit chips. Notes and diagnostics are collapsed.
  - Requests, payloads and the `#team-roles` and `#tactical-system` anchors are unchanged.
- **Transfers** (`TransferAuctionBoard.tsx`, `transfer-cards.css`).
  - A header summarises the market: "N would walk into your five" and "Your five needs: <two weakest attributes>".
  - Each listing is a card. The impact verdict is judged against your own five (from `GET /online`):
    - "Walks into your five · starts over #k <name> · +N OVR"
    - "Rotation option"
    - "Bench depth"
  - Each card also has per-stat deltas against your five, a radar overlay against your team, and "Brings <attribute> +N over your five".
  - Live countdowns turn amber, then red and pulsing, as an auction closes. Quick bid chips: minimum, +5%, +15%.
  - A successful bid plays confetti (`canvas-confetti`, skipped under reduced motion) and shows a "You're leading" banner.
- **The Wire** (`NewsFeed.tsx`, `wire-x.css`).
  - Bugs fixed: avatars sank to the bottom of posts (a stretched grid cell around a bottom-aligned portrait), and the action bar was spread across the full width.
  - New layout:
    - An avatar column, with portraits cropped to round faces.
    - A header line: name, media badge, @handle, relative time, options.
    - Quote cards for reactions, and link chips (live matches marked).
    - Icon actions: reply with count, copy link, open thread.
    - Replies show "Replying to @handle", use a "Post your reply" composer with a character ring and a Reply pill, and hang off a thread line.
  - There are no likes or reposts, because the API has none.
- **Hexacast** (`WorldMedia.tsx` BroadcastHub, `hexacast.css`).
  - A HEXACAST wordmark with live, scheduled and recording counts.
  - A live channel rail, plus "Starting soon".
  - A featured 16:9 stage drawn from both clubs' colours and crests, with LIVE, viewers, score and duration.
  - Live and recordings as a thumbnail grid. The schedule is an HLTV-style match list grouped by day: time, teams, state or score, event, featured star, action.
  - The selected-match view is unchanged; its chat is now labelled "Stream chat".
- **Supporter studio** (`SupporterStudio.tsx`, `supporter-studio.css`).
  - A holographic membership card coloured by tier.
  - Tier cards with a "Current" ribbon.
  - Theme presets drawn as small app mock-ups in each theme's colours.
  - "Player looks": a large live portrait stage and "Back to original". Every hairstyle, glasses and headset option is a thumbnail of the selected player wearing it.
  - Requests are unchanged.
- **Hexapedia** (`Hexapedia.tsx`, `hexapedia.css`).
  - A wiki navbox (every group and page) at the foot of the main page and every article.
  - Team pages: a team card (the roster as small player cards, plus a roster-average radar) above the roster table.
  - Player pages: a "Player card" section (a large card and a labelled radar, "Best at …").
  - Main page: a "Latest transfers" module from the world feed (`transfer`, `auction` and `recruitment` events).
- **Logo** (`HexatrickBrand.tsx`, `public/favicon.svg`): a faceted hexagon holding an italic H whose crossbar is a rising slash. It is drawn in `currentColor`, so it takes the theme accent.
- **Portraits** (`WorldPlayerPortrait.tsx`).
  - Redrawn with soft shading and gradients (with per-instance ids), eyes with iris and highlight, tapered brows, and a nose shadow.
  - Three mouths, beard and stubble.
  - Seven redrawn hairstyles in Supporter order (Crop, Spikes, Sweep, Curls, Short, Fringe, Classic).
  - Modern glasses; a headset with a glowing earcup ring and mic boom; a jersey with collar, trim and a hex emblem.
  - Same props, seeding, override semantics and size ratio, so `PersonPortrait` and every caller are unchanged.

## Checks

- **Preview setup.**
  - The real signed-in app, against the scratch backend from the previous pass.
  - Preview data was added to the scratch database only:
    - three high-rated players moved to the preview club, so the bench has cards;
    - eight auction rows from bot clubs;
    - two Wire posts with three replies through the API.
  - Hexacast live and recorded states were rendered with an in-browser response mock injected only into the headless test browser.
- Desktop at 1440 px. Phone at 390 px for Squad, Transfers and The Wire. No horizontal overflow on 12 redesigned routes at 390 px.
- `node --experimental-strip-types --test src/*.test.mjs`: 605/605. The design and architecture checks pass, and `vite build` passes.
- **Typecheck.** `tsc -b` reports 6 errors, all in `src/fps/fpsLiveSimulation.ts`. During this pass that file and five other `src/fps/` files (`fpsLiveBrain`, `fpsLiveEconomy`, `fpsLiveMap`, `fpsLiveWeapons`, `fpsUtilityPurpose`) were being changed by someone else. This pass did not touch them. Every file this pass changed typechecks.
- oxlint on the changed files: no new warnings beyond effect warnings that were already there.

## Not done

- Not rendered with real data: live and recorded broadcasts (mocked instead), completed matches, real Wire media posts with quote cards, and the transfers module with events.
- Light custom themes were not rendered.
- The 3D broadcast HUD, Crown 2026, Competitions internals, Finances and the tournament edition pages (`CompetitionHub`) have no game-kit redesign.
- Drag and drop uses HTML5 drag events: on touch screens, use tap to select instead.
- The board's fit number is strength only, as the server's suggestion is. Personality still shapes how a player plays the job; the picker says so.
- `ui-harness/` is still tracked.
