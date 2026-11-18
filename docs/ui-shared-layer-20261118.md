# Shared UI layer: icons, search, navigation and states (2026-11-18)

The owner reviewed the Match centre, Squad and Hexapedia screens and found them chaotic and hard to read at first glance. Icons were reused across unrelated pages. The search and filter components were not production quality.

## What was wrong

- **Icons.**
  - `LabelIcon` guessed an icon from free text with a long regex chain, and fell back to a generic pulse icon. Unrelated headings ended up with the same icon.
  - The sidebar used the crossed swords for Play and for the 3D Broadcast Lab; the Match centre tabs used it for Scrimmages and Practice too.
  - Squad "Staff" reused the Squad icon, Transfer Exchange "Sell a player" reused it again, and Competitions "National teams" did too.
  - Every FPS reference tab used the same crosshair.
  - `ReferenceIcon` gave organizers the nations flag, and talent and managers the players icon.
- **Search.** About twelve hand-rolled inputs. A global `.cm-shell input` rule overrode their padding, so text sat under the search icon. Each had its own clear/empty/loading behaviour; some had none.
- **Hexapedia navigation.** 22 links wrapped across two rows. FPS reference pages then showed a second copy of the same ten links. A loading directory showed an empty table with headers and "Loading records…".
- **Squad roster.** Each player row carried five or more bordered chips ("T: UNASSIGNED", "CT: UNASSIGNED", up to three "TENDS TO" items) in uppercase, because the player cell is a table row header. The table was wider than its container and clipped the Selection buttons.
- **Match centre.** The top panel showed "MATCHDAY / club name" and nothing useful.

## What changed

New folder `src/components/ui/`:

| File | Purpose |
|---|---|
| `icons.ts` | The icon registry: one icon per destination. `NAV_SETS` lists each navigation set (sidebar, Match centre, Hexapedia overview, reference and records). |
| `AppIcon.tsx` | Renders a registered icon. |
| `SearchField.tsx` | The one search input. Leading icon, clear button, Escape to clear, busy spinner, optional status line and combobox wiring, and styled so page rules cannot push text under the icon. |
| `FilterBar.tsx` | `FilterBar` (search, filters, result count and a "Clear filters" button that appears only when a filter is active) and `SelectField`. |
| `SectionNav.tsx` | Two-tier navigation: a short row of groups, then only the active group's pages as a grid. |
| `PageHeader.tsx` | Eyebrow, icon, title, description, actions. |
| `States.tsx` | `EmptyState`, `ErrorState` (with retry) and `ListSkeleton`. |
| `ui.css` | Styles for all of the above, on the `--cm-*` tokens so every personal theme applies. Imported last in `main.tsx`. |

Applied:

- **App shell** (`App.tsx`): every sidebar and Match centre tab icon comes from the registry; the page title uses `PageHeader`; squad sub-tabs (Lineup, Practice training, Staff) have their own icons.
- **`LabelIcon`:** exact lookup for registered destinations first. Free text that matches no keyword now gets no icon, not a generic one.
- **Hexapedia:**
  - Three groups: **Start here** (Main page, Game guide), **Game reference** (the ten FPS sections) and **World records** (nine record kinds, Laurels).
  - Global search and directory search use `SearchField`.
  - Directories use `PageHeader`, `FilterBar`, skeleton rows while loading, and an empty state that offers to clear the filters. The empty table is no longer rendered.
  - The FPS reference page lost its duplicate section row, and its search and category filter use the shared components.
- **Other searches** now use `SearchField`: Game guide chapters, Transfer Exchange listings, World career desk, player dossier records, Wire account search, squad roster.
- **Squad roster:**
  - `FpsIdentityMarks` has a `compact` mode: one personality line, T/CT positions only when assigned (no "Unassigned" chips), and at most two tendencies in plain text with the rest in a tooltip.
  - Row headers no longer inherit the uppercase column-header style.
  - The table fits its container above 1100 px and scrolls below.
- **Match centre:** the top panel now reads "Your club" and the next fixture with its kickoff and orders deadline.
- **Other tab icons:** Transfer Exchange "Sell a player" is a price tag; Competitions "National teams" is a flag; `ReferenceIcon` gives each record kind its own icon.

## Checks

- `src/uiIcons.test.mjs` (7 tests): no navigation set repeats an icon; every FPS reference section and record kind has its own icon.
- `npx tsc -b` clean and `npm run build` passes.
- `npm run check:game`: 576 of 577 passed. The one failure was `fpsTacticalEmergence.test.mjs` "Emergence 7" (average tick CPU 5.308 ms against its 5 ms limit) in the simulation engine, which this work does not touch. The file passes 7/7 when run alone, so it is a timing threshold that can fail when the machine is busy.
- A temporary harness (deleted) rendered the new components and the roster in headless Chrome at 1280 px and in a 390 px frame. Layout, spacing and wrapping were checked from those screenshots.
- Not done:
  - The signed-in screens were not rendered. They need the backend, so Match centre, the real sidebar, Squad with live data and Hexapedia with live data are verified by typecheck and the harness only.
  - Modules not listed above (Club home, Finances, Staff room, Organizer workbench, Supporter studio, Community cups, Settings, the Wire and the 3D broadcast HUD) were not redesigned.
  - The old per-module search and filter CSS (`.squad-roster-toolbar`, `.pedia-directory-toolbar`, `.record-filters` and others) is now partly unused and was not removed.
  - No keyboard or screen-reader pass beyond the labels, roles and focus styles built into the components.

## Rules for new screens

- Use `SearchField` for any text search and `FilterBar` for search plus filters. Do not add a bare `<input type="search">`.
- Pick icons from `icons.ts`. A new navigation destination gets a new registry entry, and the test fails if it repeats an icon within its set.
- Use `PageHeader` for page titles, `SectionNav` when a page family has more than about eight sections, and the `ui/States` components for loading, empty and error views.
