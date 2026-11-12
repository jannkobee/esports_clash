# Hexatrick first deployment and Supporter studio

Implemented 9 November 2026. This is the current operational entry point for creating the playable world. Existing historical match, ML and visual evidence is preserved.

See the later [dossiers, mixed-case IGNs, Laurels and Hexacast update](hexatrick-dossiers-laurels-hexacast-20261109.md) for the current display-name policy and record features.

## First deployment

`GameInitialization` is used by `game:init`, `FirstDeploymentSeeder` and `DatabaseSeeder`. It is an explicit owner-run operation, protected by a shared lock and the durable `game_initializations.world-v1` marker. It never truncates the database, clones players, awards imaginary results or resets an existing club. A repeat with the same owner returns the original admission report. A different owner is rejected. A failed partial admission can be rerun after its prerequisite is repaired; record creation is bounded and existing records are reused.

The API/database/cache, current catalog, match worker, queue workers and scheduler must be available. Catalog installation retains the existing manifest/hash checks. The worker must advertise world-player profile schema 1. A fresh empty world activates that schema; an existing legacy player pool stops initialization for separate review instead of silently running a roster reset.

The initializer creates or reuses exactly one club for the designated owner, with permanent **Beacon** membership. Existing club names, rosters, contracts, balances and records are retained. A newly created owner club starts in Tier 5 with ordinary starter players and opening funds. Owner Supporter privileges do not grant competitive attributes, money or qualification places.

World admission installs competition definitions/geographies/media, fills at least four computer-managed founding clubs in each of six regions and five tiers (120 on a completely empty world), generates appropriate Tier 1–5 rosters and canonical talent profiles, opens future division trials and weekly community invitations, and enables scheduled competition processing. Existing populations are counted instead of duplicated. Annual publication runs only for an eligible current year not already published; 2027 remains the configured inaugural official circuit. No future year is silently published, and no backdated result is created. The historical November 2026 launch exhibition remains a separate existing archive.

Prepare a **private**, ignored JSON file with `email` and `password` fields. Do not commit credentials. From the repository root, with services already running:

```powershell
./infrastructure/evolution/init-game.ps1 -OwnerFile .local-tools/deployment-owner.json -Development
```

Omit `-Development` for the base Compose deployment. `-EnvironmentFile` accepts the private Compose environment path. The helper copies the input to a unique temporary container file, invokes migrations and `game:init`, and removes the container input afterward. It prints the admission report without printing credentials. It does not bring up or recreate services.

Inside a configured API environment, the equivalent entry points are:

```bash
php artisan game:init --owner-file=/private/owner.json
# Or configure HEXATRICK_OWNER_EMAIL / HEXATRICK_OWNER_PASSWORD privately:
php artisan migrate --force
php artisan db:seed --force
```

`game_bootstrap.php`, `.env.example` and the Compose API environment expose those optional seed variables with blank defaults. There is no tracked default password. The existing evolution backoffice bootstrap remains separate.

Current local admission: owner email `jkobe415@gmail.com`, user 4, club 4, **RAT CITY's Club**, Tier 5. The explicitly supplied password was checked against its stored hash without printing it. The owner has exactly one club, all five Supporter feature flags, no membership expiration, and one durable initialization marker. The second initializer run returned `already_initialized: true`, with zero newly created founding clubs and no historical results. The pre-admission PostgreSQL backup is `.local-tools/hexatrick-before-owner-init.dump` (9,606,057 bytes).

## Exactly two Supporter levels

| Level | Benefits |
| --- | --- |
| **Signal** | Custom crest upload, custom home/away jersey artwork, four curated interface themes, Signal badge |
| **Beacon** | Everything in Signal, custom palette and record density, player IGN edits every 30 days per player, biography/portrait edits every seven days per player, Beacon badge |

New regular registrations receive one calendar month of Beacon, using calendar-aware month addition. The initialized owner has permanent Beacon. Server checks enforce every feature; hiding a button is not the authorization boundary. Expired memberships cannot save customizations. Saved player/club artwork and identity history remain attached to their existing records. Effective interface themes revert to Cinder when membership expires; saved preferences remain available for renewal. Checkout, pricing, recurring billing and entitlement webhooks are not enabled by this work.

Settings → **Supporter studio** contains both benefit cards, membership status/expiry, Cinder/Deepwater/Evergreen/Nocturne themes, the Beacon palette builder, compact/comfortable record spacing, and the player presentation editor. Theme preferences live on the account and return through login, `/me` and `/online/supporter`. Custom text must meet 4.5:1 contrast against both chosen canvas and panel backgrounds. Accent button text is selected for legibility. Theme overrides target management/reference surfaces, not match team colors or gameplay state.

## Player identity and portraits

After clarification, the owner explicitly chose **no nationality customization**. The presentation endpoint accepts only IGN, biography and bounded vector portrait options. It rejects nationality, eligibility, attributes and other extra keys. National-team allegiance and eligibility rules are unchanged.

Editable IGNs are 3 to 14 alphanumeric characters with manager-selected casing. At most three global identities may share an IGN; same-club collisions and reserved catalog aliases are rejected. Protected historical/parody aliases, including Cardrel, remain protected. Transfers retain the same player UUID, customization cooldowns and career. A rename adds immutable revision history and appears under previous IGNs in the canonical career record. Biographies are plain text, limited to 600 characters, and explicitly labeled club-provided on Hexapedia.

Portraits use the existing original transparent SVG system, with bounded skin/hair palettes, seven hair silhouettes, optional glasses/headset and jersey/trim colors. These are 2D player portraits, separate from the protected 3D avatar pipeline. Current squad/home/market/reference projections read the same presentation record. Historical allocations/reports are not rewritten, and no current presentation is fetched into an old recording as a substitute for its pinned data.

Edits require Beacon and ownership. Catalog/club/player locking serializes changes against allocation/transfers; queued matches, a fixture awaiting its snapshot, open auctions and pending trades block edits. Each player has separate 30-day IGN and seven-day biography/portrait cooldowns, retained through transfers. Every actual change appends `player_presentation_revisions` and increments the club revision. Cosmetic edits never modify stats, nationality, training XP, form or money.

Main implementation: `GameInitialization.php`, `FirstDeploymentSeeder.php`, `PersonalThemes.php`, `PlayerPresentation.php`, `SupporterMembership.php`, `SupporterController.php`, `PersonalThemeContext.tsx`, `SupporterStudio.tsx`, `personal-theme.css`, migration `2026_11_09_000010`, and `infrastructure/evolution/init-game.ps1`.

## Validation and limits

Production TypeScript/Vite build passes. Touched PHP/Node syntax and initializer PowerShell parsing are checked separately; no test suites or test matches are run, per owner direction. Read-only inspection confirmed owner membership, one club, valid private password hash comparison, the two plan records/four presets, five editable owner players, public presentation projection and alias-history projection. Current population at inspection: 138 clubs, including 131 managed opponents (24 in each Tier 1–4 and 35 in Tier 5); the active player population changes as legitimate management jobs scout and trade. There were no recent failed jobs.

Migration 000010 is applied. The initialization service has been exercised against the existing development world, including its no-op repeat. A completely empty production database has not been rehearsed. No claim is made that payment processing, end-to-end paid renewal, live cooldown editing, full scheduled match settlement or 50,000-club capacity has been accepted. Windows Computer Use/browser access was unavailable, so rendered and signed-in interaction acceptance remains pending.

Protected interrupted match `157691b0-c281-407d-8771-1d53dff55ed8` remains interrupted at sequence 3,472 with no verified result. No game was started, resumed, statistically settled or accelerated by this initialization.
