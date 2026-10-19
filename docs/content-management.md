# Avatar and item management

Laravel owner screens:

- Avatar management: http://localhost:8089/evolution/management/avatar
- Item management: http://localhost:8089/evolution/management/item

Use the existing Evolution owner login. These are Laravel Blade modules on the backend server, separate from ML reports and visual job reports.

## Owner workflow

1. Open an existing imported design or select Create avatar / Create item. The current 45 avatars and 49 authored items (including boots) are copied into editable drafts. Import is an explicit POST or server command and never replaces an existing imported draft.
2. Define identity and appearance. Avatar fields include display name, title, roles, archetype, palette, passive description and prompt, six base stats, and the existing Skill 1 / Skill 2 / Ultimate layout. Each skill has name, description, damage, damage type, cooldown, targeting, and separate gameplay, VFX and animation prompts. Zero cooldown is supported for special kits such as Arsenaldo.
3. Item fields include name, gold cost, tier, icon character, passive name/description, suitable roles, all 15 existing item stats, appearance prompt and effect prompt. Percentage fields use the actual game units: crit, armor penetration and lifesteal are 0?100; attack speed bonus is a ratio (0.20 means +20%). Empty bonuses are omitted. Existing Legendary/Mythic price transforms are captured in the item snapshot.
4. Save draft explicitly. Required structured fields, numeric bounds and enums are checked on the server; rejected input is retained with a summary and inline errors. Prompts may remain incomplete while drafting. Leaving an unsaved form warns; saved-version review/export controls are blocked by the browser while changes are pending.
5. Mark ready for review checks the avatar appearance plus all three per-skill prompts, or the item appearance and effect prompts. This is a completeness state, not approval, balance qualification or publication. Any later save returns the design to Draft.
6. Download the combined saved prompt or export the saved version as JSON. Imported avatars can carry their saved appearance prompt into the manual 3D Generation concept brief via a link. A concept-image provider is not configured: generate/create the PNG externally, upload it, then manually queue TRELLIS. No generation starts from save, import, review or export.
7. Archive hides no live asset and preserves history. Restore to drafts, or restore an earlier revision as a new draft revision. Paginated history retains all versions. Concurrent edits/actions check the version under a database row lock; stale saves cannot overwrite a newer version.

## Boundaries

These records are proposed content, not executable source code. Prompts do not automatically implement arbitrary skill behaviors, passives, item effects, humanoid anatomy or animations. Existing engine-specific skill metadata survives editing without being rewritten by generated text. The initial editor exposes the existing core combat fields; custom status effects, engine-specific timing/scaling parameters and novel mechanics still need implementation work.

Live online catalogs, Web authored definitions, simulation and ML training catalogs are unchanged. New custom avatars/items receive stable custom IDs but require a reviewed game/catalog/renderer integration before live use. There is intentionally no publish button that bypasses balance review or existing asset rigging/animation/runtime qualification. JSON exports identify themselves as design drafts and include `live: false`; they are not the signed online-catalog format. Supplied Arsenaldo, protected tower/combat rules, hitboxes, hit timing, aliases and ML automation are preserved. Visual admission remains manual-only.

## Implementation / deployment

Migration `2026_10_19_000008_create_content_management` adds `managed_contents` and `managed_content_revisions`, with immutable source identity, owner attribution, version snapshots and no destructive changes to existing tables. Routes use existing owner middleware, authentication and CSRF protection. The module does not dispatch jobs or call an AI provider.

Source files: `ContentManagementController`, `ContentManagementService`, `ManagedContent`, `ManagedContentRevision`, `resources/views/evolution/management`, `public/content-management.js`, and the navigation/style additions. `TrellisGenerationController` accepts an owner-only saved-design link; its Blade concept prompt override changes no generation worker logic.

The item snapshot is `EsportsClash.Api/resources/game/management-items.json`, with source SHA-256. Regenerate it from trusted authored TypeScript using `node infrastructure/evolution/export-management-items.mjs` from repository root after intentional item changes. This does not alter the gameplay catalog or overwrite existing drafts. Dev Compose mounts this single snapshot into the API; normal built images include resources already. API source/Blade/CSS/JS hot reload remain available.

Apply additive migrations, then run `php artisan content:import` once to populate drafts using the existing owner account. Both imports preserve previous edits. No scheduler invokes this command. Docker deployment updates only the API container; ML and visual workers need no restart.

## Verification

`tests/Feature/ContentManagementTest.php` covers owner access, rendering, bounds/enums, rejected input retention, review completeness, creation/update/export/archive/restore, optimistic concurrency, revision history, idempotent catalog imports, every current definition round-tripping with extra skill metadata preserved, live-catalog isolation, no dispatched jobs, and manual generation prompt handoff. Generated model outcome checks are outside this change.


Deployed verification on 2026-10-19: Docker Laravel suite passed **74 tests / 798 assertions**. Blade compilation passed. `node infrastructure/evolution/verify-content-management.mjs` authenticated through the existing owner login and checked imported counts, 18-card pagination, Arsenaldo's zero-cooldown kit form validity, three animation prompt fields, all 15 item stats and six roles, no 390px overflow, and unsaved-review blocking. It submitted no design changes or generation jobs. Evidence: `content-management-ui-verification.json`, `content-management-desktop.png`, `content-management-mobile.png`. Migration 8 and initial 45 / 49 draft imports are applied to the local Docker database.
