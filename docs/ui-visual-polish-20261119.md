# Visual polish: restrained accent, finished controls, remaining screens (2026-11-19)

The owner asked for better design and UI/UX overall. The two 2026-11-18 passes fixed the shared components ([shared layer](ui-shared-layer-20261118.md)) and the grouping of screens ([information architecture](ui-information-architecture-20261118.md)). This pass fixes the visual system they sit on and the screens those passes left alone.

## What was wrong

Rendering the real signed-in app (see Checks) showed:

- **Accent everywhere.** Every panel header was a solid crimson bar, active tabs used the same fill as primary buttons, and the sidebar brand block was crimson too. With that much accent, primary actions stopped standing out. Staff appointments showed 15 identical solid "Sign eight weeks" buttons.
- **Unfinished controls.**
  - The gameplan sliders were the browser's default blue, and later rendered as a bright white track in the dark theme.
  - Email preferences were bare checkboxes.
  - Row headers (`<th>` in a table body) inherited the uppercase column-header style ("TOTAL", "OPENING BALANCE", candidate names).
- **Coach and tactical system** (Squad): an unstyled form with inline styles. It had a wall of bordered chips per player, "Unassigned — manager selects" dropdowns, raw instruction values ("balanced", "hold") and `[FRICTION]` text tags. This is where the Squad readiness check's "Assign" link leads.
- **Duplicated titles:** "Finances" then "Club finances", "Supporter studio" twice, "Competitions" then "Hexatrick competitions".
- **Settings** opened with a jargon-heavy 3D Lab panel ("Influence Maps, Blackboards, Behavior Trees…") before the account settings.
- **Practice** used crimson-header cards with "▸" glyphs. It never said that it plays the browser's practice collection, not the official squad.
- **Home:**
  - The owner's World Desk listed 29 raw metrics ("economy club cash minor units: …").
  - "Your first week" was six separately boxed rows with no visible next step.
- **Hexapedia main page:**
  - The FPS reference call-out had no padding.
  - The counts strip had an empty grey fifth cell.
- **Phone width:** Squad scrolled sideways (607 px page in a 390 px viewport). A visually hidden label inside the roster table was absolutely positioned against an ancestor outside the table's scroll wrapper.

## The rule

The accent marks **actions, the current place and live state**. Structure (panel headers, tabs, filters) stays neutral. Colour still never carries a state alone; words do.

## What changed

### Tokens and primitives (`index.css`, `personal-theme.css`, `components/ui/ui.css`)

- **Radius:** 5 / 8 / 12 px (was 3 / 4 / 6).
- **New tokens:** `--hx-accent-soft`, `--hx-focus-ring` and `--cm-surface-raised`. `accent-color` is set at the root.
- **Panel headers:** a neutral title row with a border and an accent-coloured icon, in every theme. Hexapedia record headers, Hexapedia modules and `.hx-stage-header` keep a faint 10% accent tint so records still read as Hexapedia.
- **Tabs (`.cm-tab`):** a neutral segmented control (raised surface, accent icon), also matched by `aria-pressed` and `aria-current`. The competition phase filter and the Hexacast tier filter use the same raised style with an accent underline.
- **Buttons:**
  - 600 weight, no wrapping, and a visible focus ring.
  - Hover is neutral.
  - Primary buttons get a subtle inset highlight.
- **Sidebar brand and top bar:** no crimson block. The top bar is translucent with a neutral border.
- **Top bar layout:**
  - Fixtures and Inbox shortcuts come first, then one account group: initial, name and supporter badge. Sign out is a ghost button.
  - Below 760 px, Fixtures is icon-only and the badge hides, so the bar fits on one row.
- **Range inputs:** a neutral 4 px track and a ringed thumb. An accent fill up to the value comes from a `--range-fill` custom property; without it the track stays plain.
- **Table row headers:** `tbody th` reads like data (normal case, 600 weight). Cells use tabular numbers.
- **Table wrappers:** `.cm-table-wrap` and `.pedia-table-scroll` are positioning contexts, so absolutely placed content is clipped inside them. This fixed the phone overflow.
- **New `ui/Switch.tsx`:** a `role="switch"` control with a label and description. Use it for on/off settings.

### Screens

| Screen | Change |
|---|---|
| **Squad → Coach and tactical system** (`FpsTacticalSystemEditor.tsx`, `tactical-system.css`) | Header with progress ("x of 5 starters have both positions"). Gameplan dials show their leaning in words ("Leaning fast") with end labels and culture. One card per player, starters first: state tag ("Positions set", "One position missing", "Needs positions"), compact identity marks, strengths, then T position, CT position, Instruction and Training focus (sides without the "T · " prefix; instructions as Balanced, Hold, Take initiative, Support), then fit as a definition list. Diagnostics use severity pills. A sticky save bar. Requests, payloads, state and the `#team-roles` / `#tactical-system` anchors are unchanged. |
| **Squad → Staff** (`ClubStaffRoom.tsx`) | The terms paragraph became four bullets. `FilterBar`, `SearchField` and `SelectField` replace the bare search. Candidate rows use normal case with the role as a small label. "Sign for 8 weeks" is a small secondary button with a per-candidate `aria-label`. |
| **Settings** (new `SettingsPage.tsx`, `settings-page.css`, moved out of `App.tsx`) | Order: Email, Sound, Practice roster backup, then Simulation and 3D lab. Email and sound use switches, and the email address shows a Confirmed / Not confirmed pill. The lab section is link cards in plain language; the online normal sandbox sits under a collapsed Diagnostics disclosure. The backup copy now points to Squad (it pointed to "Matchday"). |
| **Practice match** (new `PracticeLauncher.tsx`, `practice-launcher.css`, moved out of `App.tsx`) | Names the ten players who will play (practice five vs practice side) and says practice uses the browser's practice collection and changes nothing. Two format cards, with live 3D featured and the only primary button. No "▸" glyphs. |
| **Home** | "Your first week" is one panel with a progress bar. Done steps are condensed with a check. Only the next step has a primary button and an accent marker (`FirstWeek.tsx`, `home.css`). Owner operations is a collapsed disclosure with a two-column metric list (`WorldDesk.tsx`, `world-desk.css`). |
| **Finances, Supporter studio, Competitions** | The duplicate inner titles are gone; the subtitle and actions stay. Finance KPI cards lost the crimson top border. Competitions: the Hexapedia link reads "Tournaments in Hexapedia", and the edition search uses `FilterBar` (`TournamentEditionTable.tsx`). |
| **Hexapedia main page** | The FPS reference call-out has a header and padded body, and the counts strip auto-fits its four items. |

## Checks

- **Real signed-in app, not a harness.**
  - A fresh SQLite database in the session scratchpad: all migrations, then `db:seed`, which runs `GameInitialization`. It used a fake owner email and a stub worker answering `/health`.
  - SQLite needs a preview-only bootstrap: math functions (`SQRT`) and a no-op `SET TRANSACTION`. Both lived only in the scratchpad.
  - Three fixtures were added with `fixtures:schedule`. `QUEUE_CONNECTION=null`, so nothing simulated.
  - The API ran on PHP's built-in server and the frontend on Vite with `VITE_API_URL`; headless Chrome drove both over CDP.
  - The developer database, `.env` and repository config were not touched.
- **Widths:** every changed screen at 1440 px. Home, Squad, Settings and Practice at 390 px.
- **Overflow sweep:** 19 workspace routes at 390 px. All report `scrollWidth == clientWidth` after the table-wrapper fix (Squad was 607 before).
- `npm run check:game`: 599/599. `npm run build` passes. `npx tsc -b` clean.
- oxlint on the changed files: no new warnings. Two pre-existing effect warnings remain in `TournamentEditionTable.tsx` and `FpsTacticalSystemEditor.tsx`.

## Not done

- **Not rendered:**
  - Completed matches, live matches and replays: the stub worker simulates nothing, so Results and Recent results showed only empty states.
  - Light custom Beacon themes. Everything uses tokens, but only Cinder was rendered.
- **Not redesigned:**
  - Transfers, Hexacast, The Wire, Crown 2026 and the 3D broadcast HUD changed only through the global tokens.
  - Competitions' internal sections beyond the header and filters.
- **Font:** `Inter` is named first but never loaded, so Windows shows Segoe UI and macOS shows the system font. Loading a webfont (self-hosted or not) is the owner's decision.
- **Practice data:** practice still plays the local practice collection (`mockData` plus localStorage), not the official squad. The page now says so; changing it is a gameplay decision.
- **Harness:** `EsportsClash.Web/ui-harness/` is still tracked and still marked for deletion by hand.

## Rules for new screens

- Do not fill structural elements (panel headers, tabs, filter toggles) with the accent. Use it for the one primary action, the current place and live state.
- One primary button per decision. Repeated row actions use `cm-btn` or `cm-btn-sm`.
- On/off settings use `Switch`. Sliders set `--range-fill`.
- Do not repeat the page title inside the page. `PageHeader` already shows it.
- Grid containers that hold tables use `minmax(0, 1fr)` tracks, so wide tables scroll inside their wrapper.
