# Frontend module routes, Hexapedia repairs and complete country flags — 9 November 2026

## Owner request

Rename frontend routes to the actual module names (especially codex → hexapedia), repair Hexapedia bugs, and show real flag icons with hover names and a complete country list. This is frontend navigation, reference projection and additive country metadata work; it does not change protected game mechanics, historical player nationality or existing published qualification rules.

## Module URLs

`frontendRoutes.ts` is the canonical route adapter. The workspace uses these public routes:

| Module | Public route |
| --- | --- |
| Club home | `#club-home` |
| Squad | `#squad` |
| Match centre / recordings | `#match-centre` / `#match-centre?match=<uuid>` |
| Transfer Exchange | `#transfer-exchange` |
| Finances | `#finances` |
| Hexapedia and its records | `#hexapedia` / `#hexapedia/<kind>/<id>` |
| Club match history | `#match-history` |
| Supporter Studio | `#supporter-studio` |
| The Wire | `#wire` |
| Hexacast | `#hexacast` |
| Crown launch exhibition | `#launch-championship` |
| Competitions | `#competitions?tab=<section>` |
| Community cups | `#community-cups` |
| Scrimmages | `#scrimmages` |
| Arena practice | `#arena-practice` |
| Settings | `#settings` |

Old `#codex`, `#avatarpedia`, `#discover`, `#play`, `#market`, `#home`, `#history` and `#supporter` bookmarks are canonicalized with `history.replaceState`. Match IDs, thread/report IDs, competition tabs and supported query parameters survive the change. Auth return destinations validate the named module and retain those parameters. Workspace view state remains separate from the URL adapter; no match lifecycle moves into the frontend.

`avatarpedia.ts` has been renamed to **hexapedia.ts**, and source imports and outgoing links updated. Existing backend `/avatarpedia` endpoints remain supported; the owner requested frontend URL renaming.

## Hexapedia repairs

- Public/signed-in routing and authentication returns agree on the Hexapedia root, including resources and yearly honors.
- Player dossier sections now use the same anchor IDs as the article contents links.
- Unknown sections, malformed encoded IDs and extra resource path segments show an explicit invalid-address state instead of silently showing the main page.
- Aborted article, directory and global-search requests cannot replace newer navigation with stale cached responses.
- Directories subscribe to reference/world revision updates, including the country registry.
- Organizer/sponsor article lookup no longer stops at the first 30 directory entries. Related tournaments are filtered by the actual association before projection, removing the old 100-event cutoff. Directory caps that silently omitted organizer/sponsor identities were removed.
- Competition sections now read their deep-link tab and keep top-level tab navigation in the URL. Home/history recording links retain the match UUID for reloads.
- National fixture links and nation profiles use country flags; actual game reports, scores and provenance remain unchanged.

## Full country registry

The previous seed had **nine countries**. The bundled manifest now includes **249 ISO countries and territories**, with 249 matching locally served 4:3 SVG assets and complete national-team directory entries. The frontend and API manifests are byte-identical. Names/IDs of the existing nine countries are preserved.

Sources are the MIT-licensed [flag-icons 7.3.2 package](https://www.npmjs.com/package/flag-icons/v/7.3.2) and [Unicode CLDR 47 territory containment](https://github.com/unicode-org/cldr-json/tree/47.0.0/cldr-json/cldr-core/supplemental). Licenses and package provenance are included under `EsportsClash.Web/public/flags`. Country flags load from the app, with no third-party image dependency at runtime.

Migration **000013** replaces geography uniqueness on code alone with uniqueness on **kind + code**. This matters because existing continent/region codes AS, AF, AM, NA and SA collide with American Samoa, Afghanistan, Armenia, Namibia and Saudi Arabia. Existing geography IDs and parent paths are retained; country lookup/validation now explicitly scopes kind=country. New countries receive CLDR-consistent region/continent parents. New region metadata is inactive for automatic circuit admission; the **six existing active regional circuits remain unchanged**. This work does not manufacture tournaments or alter a published edition's geographic rules. Activating additional regional competition programs remains a separate calendar/admission decision.

`CountryCatalog` is additive and shared by the migration and first-deployment geography installer. New national-team identities do not invent player eligibility, appointments, squads or results. Antarctica, Bouvet Island and Heard/McDonald Islands remain visible metadata but are excluded from generated player nationality. Existing player nationality and permanent international commitments are not edited.

## Flags and interaction

`CountryFlag` provides local SVG artwork, country-name/code tooltips, keyboard focus and readable labels. Unknown/unrecorded countries use a neutral globe, never an invented flag. `CountrySelect` is a shared searchable, keyboard-operable country picker with real flags, country/code search, all entries, visible count, outside/Escape dismissal and viewport-aware placement. Club identity, auctions and Hexapedia nationality filters use it.

Flags also appear in squad/home/development rows, auction/reserve profiles, player biographies/residence/infoboxes, nation directory and articles, talent nationality, match reports and national broadcast marks. This uses existing original player/staff portraits and does not touch the protected 3D/Colab pipeline.

## Verification and limits

- A **10,254,664-byte** backup is retained at `.local-tools/hexatrick-before-country-registry.dump`; migration 000013 applied successfully.
- Production TypeScript/Vite build passes. Existing large-bundle warnings remain.
- **51 changed/new PHP files** pass syntax checking.
- Read-only API inspection confirmed 249 country codes, 249 national teams, six active regions, country/region code coexistence and the ninth/last national-directory page (nine rows at 30 per page).
- The first real article from each of all twelve Hexapedia categories loaded successfully. Local `/flags/ph.svg` returned HTTP 200 as image/svg+xml (1,382 bytes). No test records or matches were created.
- Direct route-function inspection confirmed legacy-to-named conversion and preservation of match/report/thread and competition parameters.
- Computer-use review was attempted; `sky.list_apps()` still reports the native pipe unavailable (`os error 2`). Rendered visual/keyboard acceptance is unqualified. No test suites or new simulation games ran, following the owner's standing instruction.
- Fresh-empty-deployment rehearsal, additional active regional circuits and positive future manager-award ceremonies remain outside this verification. Historical/frozen gameplay, ML, Colab and avatar evidence and unrelated dirty work are preserved.
