# Connected avatar registry

Current override (2026-10-24): the owner requested an all-45 asset reset. Old appearances and reference/preview binaries described historically below are deleted, releases inactive, and their jobs excluded from fresh source pickers. Roster definitions and historical metadata remain. Mirelle's new private base is inspectable in Babylon but **unqualified and unpublished**. See [reset record](avatar-rework/asset-reset-20261024.md). Ordinary worker is now `teamfight-online-worker:avatar-fresh-start-v1`; 254 source hashes match, catalog definitions unchanged.

Owner decision: 2026-10-24. The backoffice is the published content baseline for the engine and asset tools.

Open **Avatars** at http://localhost:8089/evolution/registry/avatars. All 45 original identities are registered under their existing `c_*` keys. Search also finds historical names and internal aliases. Each page connects published identity/base stats, the four shared skill records, preserved design drafts, generation references, preparation reports and active visual-release evidence.

## Editing and publication

The registry stores avatar records alongside items and skills in `game_contents`. Publish a supported identity, palette, lore or base-stat change from the avatar page. Publication requires owner authentication, CSRF, bounded values and the current optimistic version. A revision is retained. Stable IDs, roles, internal names, canonical keys and behavior bindings cannot be changed through that form. Skills retain their existing separate shared editors and supported cooldown/text/image boundary; original component-based damage remains authored engine behavior.

Existing `managed_contents` designs are retained as drafts, with their original revisions. The registry links to an existing draft and the draft links back to the published record so differences can be compared. They are not bulk-overwritten or automatically published. Importing a new draft now reads the published avatar and skill records. Custom drafts do not create executable avatars or qualified assets.

`2026_10_24_000020_create_avatar_registry.php` seeds the initial 45 records from the current game catalog and `game/avatar-identities.json`. These files are installation inputs, not a second live editable registry. Previously published records are never overwritten by an import.

## Engine connection and snapshots

The existing `/api/v1/game-content` API includes the 45 avatar records in its canonical record hash. `contentChampion` applies supported published fields only when the stable avatar ID, internal alias and ability ruleset match. It retains runtime dispatch names and authored behavior.

The browser refreshes every 15 seconds while visible, on focus/visibility return and reconnection, and through its Refresh catalog button. Identical hashes do not replace the snapshot. A failed/invalid response retains the last complete catalog and changes the connection indicator to disconnected. An initial outage explicitly uses bundled offline content. Disposing a provider aborts its request and removes listeners/timers.

Hubs and subsequent local matches use the refreshed catalog. The selected avatar in the hub resolves its current data by stable ID rather than retaining stale object state. Each mounted match retains its initial catalog. New Normal allocations and peer rooms already freeze the server snapshot; the expanded records follow that same boundary. The authenticated Normal lobby also reads current published avatar values. Replays retain recorded snapshots; historical snapshots without avatar rows remain compatible.

The ordinary local online worker is `teamfight-online-worker:avatar-registry-v1`. The game definitions/catalog hash remain unchanged; its source/rules manifest was refreshed and installed with zero active matches. The peer-room process was restarted to load the expanded validator. Frozen ML/study workers and models were not rebuilt or promoted.

## Asset boundary and ownership

Owner `/root`, registry/API/UI/engine-content integration; no delegated agents. `AvatarRegistryService` joins the published identity and current skills with the exact existing art file/hash/variant. Generation, preparation and enhancements consume this shared catalog. Historical references, anatomy entries, generation plans, raw rigs, retarget artifacts, engine proofs and qualification decisions remain unchanged.

The original appearances remain unqualified. Existing bundled or released art is explicitly legacy artwork; registry publication does not qualify or publish a model. Rig/animation diagnostics come from retained preparation reports and visual-release health. No mesh, bone, weight, animation, prompt-default or provider-profile change was made. Next asset stage remains the clean-base audit/repair and contact/Death qualification described in `character-asset-pipeline.md` and the retained Stafford reports.

## Verification

- `npm run check:game`: 573 unit tests, three simplified simulation checks, TypeScript and design invariants passed.
- `npm run build`: passed; existing large-chunk warning remains.
- Full API suite: 169 tests, 2,592 assertions passed. Includes registry publication/access/stale-write/invalid-value checks, preserved draft/art identities and existing allocation snapshot tests.
- Actual local authenticated browser: all 45 avatars, four linked skills, asset evidence, mobile width 390 without horizontal overflow and connected frontend catalog validated. Version/outage/reconnection scenarios use explicitly simulated HTTP responses inside an isolated browser, with no catalog edits or asset jobs. The actual paused `AramMatchView` retains its world fingerprint/RNG and original stats during refresh; a newly mounted match consumes the updated stats. Evidence: `avatar-registry-verification-20261024.json`, desktop/mobile PNGs; reproduce with `infrastructure/evolution/verify-avatar-registry.mjs` and an isolated CDP browser on port 9244.
- Ordinary worker smoke verifies all 252 source hashes, accepts the live 45-avatar snapshot and resolves the first current identity. This does not simulate or settle a new online match.

This qualifies the catalog connection, not all 45 avatar mechanics, appearance, deformation, animation quality or full-match balance.
