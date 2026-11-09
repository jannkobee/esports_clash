# Shared item and ability catalog

Owner request, 2026-10-23: connect the backoffice and web for items and skills,
provide CRUD and images, and include supported gameplay values.

## Use it

- Backoffice: **Items** (`http://localhost:8089/evolution/catalog/item`) and
  **Skills** (`http://localhost:8089/evolution/catalog/skill`).
- Web: **Items & Skills** in the navigation (`http://localhost:8088`).
- Edit and save an entry, then reload the web to load its latest catalog.
  Running matches keep their starting values. New authoritative Normal matches
  and peer rooms receive server-owned catalog snapshots.
- Upload PNG, JPEG or WebP images, up to 4 MB and 32–4096 pixels per side.
  Images appear in the catalog, ability inspection and item inspection/inventory.
  Placeholder thumbnails remain until an image is uploaded.
- Delete entries to remove items from future purchases or disable active skills
  in new matches. Use the **Deleted** filter to restore them. Deleting a passive
  hides its catalog entry; innate passive engine behavior remains implemented.

## Supported editing

The initial catalog contains 49 items, 135 standard ability slots, 45 passive
entries and Arsenaldo's ten invoked spells: 239 records in total.

Items support names, descriptions, images, cost, tier, suitable roles and the
existing stat bonus fields. New items grant those stat bonuses. Existing item IDs
retain their authored procs; prose does not create a new proc.

Standard active abilities and invoked spells support names, descriptions, images,
base damage and base cooldown. Existing rank/card/item scaling and effect behavior
remain. Some secondary effect, heal, shield and passive values remain authored
constants and are not exposed as editable fields. Unchanged ultimate fields keep
their original runtime cooldown curves; an explicitly changed cooldown overrides
the runtime base while retaining applicable scaling.

Create a library skill, save it, then use **Apply saved skill to an avatar slot**
to copy its name, description, image, damage and cooldown into an existing slot.
The destination keeps its executable behavior and targeting. New effect types,
crowd-control rules and new slot types require engine work.

The older item/avatar design workspaces remain drafts with prompts. They are
separate from the shared catalog; existing drafts are preserved and are not
automatically published.

## Persistence and match boundaries

`game_contents` and `game_content_revisions` persist edits, soft deletions and
history. Owner authentication, CSRF and optimistic versions protect mutations.
The read-only `/api/v1/game-content` endpoint supplies records and a content hash.
Images have immutable SHA-256 filenames, restricted MIME types and public image
routes; old files remain usable by retained snapshots.

The browser loads the catalog before interactive play and freezes it at match
mount. Offline browser play uses the bundled catalog and displays offline status.
Normal allocations embed an immutable catalog and its canonical JSON/hash in the
stored plan. The worker checks both and applies the allocated snapshot. Rooms
freeze their catalog when created. Match reports retain their catalog for replay;
historical reports without one select bundled definitions explicitly.

Raw bundled definitions and current frozen ML study images/plans were not edited
in place. Private study fixtures omit the live catalog provider. Existing owned
cards and card/avatar IDs are unchanged. The local Normal worker uses the new
`teamfight-online-worker:catalog-v1` image and a rules-only manifest update; the
previous worker image remains available. No production deployment occurred.

## Verification

- Game design checks, 529 unit tests, three simulation tests, TypeScript and build.
- Full Laravel suite, including catalog CRUD, authentication, stale writes, image
  validation, slot assignment and frozen online allocation tests.
- Actual authenticated browser uploads, catalog display, mobile layout and a real
  engine fixture verifying edited stats/damage/cooldown and mount-time freezing.
- Bounded source-pinned authoritative-worker smoke fixture; no played result,
  winner, reward or qualification is fabricated.

Evidence: [verification JSON](game-content-verification-20261023.json),
[backoffice](game-content-20261023/catalog-item-editor.png),
[web item](game-content-20261023/catalog-web-item.png),
[web skill](game-content-20261023/catalog-web-skill.png),
[mobile](game-content-20261023/catalog-web-mobile.png).
