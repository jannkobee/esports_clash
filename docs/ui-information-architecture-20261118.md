# Workspace information architecture: grouping by what the manager is doing (2026-11-18)

The owner asked for a production-quality remake of how screens are grouped, so a manager understands at first sight what needs doing. This builds on the shared UI layer ([docs/ui-shared-layer-20261118.md](ui-shared-layer-20261118.md)). That pass fixed components and icons; this one changes what goes where.

## Principles

1. **Group by intent, not by implementation.** Running the club, competing, watching, practising and researching are different jobs. Each gets its own place.
2. **Lead with what needs action.** Every screen opens with what the manager must do or watch now, then reference information.
3. **Say the state in words.** "Default lineup · orders close in 3 h", "Delayed · waiting for the previous game on this stream". Colour reinforces the state but never carries it alone.
4. **Scan first, details on demand.** Rows hold only what a manager compares; everything else opens per item.
5. **One destination, one place.** Nothing appears twice in the navigation, and Home no longer repeats the sidebar.

## Navigation (`src/components/ui/navigation.ts`)

A single config, `WORKSPACE_NAV`, drives the sidebar, its active state (`activeNavKey`), the breadcrumb (`navTrail`) and the page header (`areaHeading`). Every item is an existing route; no URLs changed.

| Group | Items |
|---|---|
| Your club | Home · Squad · Matches · Transfers · Finances |
| Compete | Competitions · Community cups |
| Watch & follow | Hexacast · The Wire · Crown 2026 |
| Practice | Practice match · 3D Broadcast Lab |
| Research | Scouting · Hexapedia |
| Account | Supporter studio · Settings |

- **Before:** the Match centre had six tabs mixing your games (Fixtures, Scrimmages), world competition (Competitions, Community cups), watching (Hexacast) and a tool (Practice). Match history was a separate item, and Scouting, Circuit professionals and Hexapedia all led into Hexapedia.
- **Now:** **Matches** holds only your games, under three tabs: Fixtures, Scrimmages and Results (the old Match history). Competitions, cups, Hexacast and Practice have their own sidebar items. Circuit professionals lives in Hexapedia's World records.
- **Small screens:** the sidebar collapses behind a menu button that names the current page. When opened, it shows the groups as columns.
- **Breadcrumb:** the top bar shows `Group / Page`.

## Matches → Fixtures (`components/matches/FixtureBoard.tsx`)

- **Before:** one flat list filtered by Upcoming / Past / All, with a status pill.
- **Now:** a **Next match** card, then groups by what the manager needs to do:

| Group | Contains | Action |
|---|---|---|
| Live now | On air | Watch live |
| Set your orders | Orders open | Set / Edit orders. The row says default lineup or custom, and when orders close. |
| Locked in | Orders locked, including delayed games ("waiting for the previous game on this stream") | None needed |
| Needs review | Held fixtures | Explained |
| Recent results | Last 30 days, five shown, link to all results | Replay & report |

- **Rows:** date and time, competition, the **opponent** with a Home/Away tag (your club plays every fixture, so it isn't repeated), a plain-language state line, and one action.
- **Times:** shown in Manila time with relative times ("in 3 h 15 min", "2 days ago"), refreshed every 30 seconds.
- **Empty board:** offers "Enter a competition" and "Arrange a scrimmage".
- **Fixture orders:** editing them shows a context banner with the match, kickoff, deadline, whether custom orders are set, "Use default lineup" and "Back to fixtures". The old "STAFF-LED DRAFT" badge is gone.

## Matches → Scrimmages

Ordered by urgency:
1. **Invitations for you**, with Accept. Previously these were the last item on the page.
2. Two side-by-side ways to get a game: **Quick match** (the same-tier queue and its states) and **Invite a club** (tag and kickoff form).

## Squad (`components/SquadRoster.tsx`)

1. **Readiness.** "Ready / Not ready for official matches", with three checks: five starters, T positions x of 5, CT positions x of 5. "Assign" scrolls to the tactical system (`#tactical-system`). `lineupReadiness` is exported and shared with Home.
2. **Starting five:** the slot picker, with one-line instructions.
3. **Club roster:** search and sort, then one table grouped into **Starting five** and **Reserves**.
   - Rows show player (name, role fit, nationality, slot number), Overall, Form, Wage / week, Development, and the action.
   - Only reserves get the primary "Start in slot N"; starters get a secondary "Move to slot N".
   - **Details** opens personality and tendencies, T/CT positions and best fit, attribute bars, and "List for auction" for reserves not in the saved five.
   - The old "Show" filter became the grouping itself.

## Home (`components/ClubHome.tsx`, `components/home/HomeSections.tsx`)

- **Before**, top to bottom: a decorative banner, a nine-link grid repeating the sidebar, the inbox, the calendar, the team summary, the starting five table, recent reports, the championship record, news, activity and the world desk.
- **Now**, by priority:
  1. **Club line:** crest, name, tag · tier · city, Edit club identity.
  2. **Needs your attention** and **Next match**, side by side.
     - Attention items are derived from data, not hand-picked: live match, open orders with the first deadline, fixtures needing review, an unready starting five (with counts), and debt.
     - When nothing applies, it says so and gives the next kickoff.
  3. **Club at a glance:** cash, players, HGR rating, circuit points. Each links to its page.
  4. **Manager's desk** (inbox and weekly reports), unchanged.
  5. **Starting five** (compact list) and **Recent results**, side by side.
  6. **Around the circuit:** news, activity and the world desk, demoted to the end.

## Checks

- `npx tsc -b` clean.
- `src/uiIcons.test.mjs` covers the new `sidebar` and `matches` icon sets.
- A temporary harness rendered the real shell markup, `FixtureBoard` with fixtures in every phase, the Home sections and `SquadRoster` with realistic data, in headless Chrome at 1440 px and in 390 px frames.
  - Found and fixed there: the phone-width row rule leaking into the Next match card, a repeated "Next match" label on Home, and loud primary buttons on starters.
- `npm run check:game`: 592/592. `npm run build` passes.
- A review after the harness fixed a stale sidebar highlight: App now tracks the URL hash in state, so moving between Scouting and Hexapedia, or between Matches tabs, updates the active item.
- **Not done:**
  - The signed-in app with a live backend was not rendered.
  - Competitions, Community cups, Transfers, Finances, Staff room, Supporter studio and Settings keep their internal layouts; only their place in the navigation changed.
  - The harness folder `EsportsClash.Web/ui-harness/` must be deleted by hand; the safety check blocked removing it.
