# Original roster activation and barracks repair — 2026-10-24

All 45 original kit bindings now run by default in local matches and newly allocated online matches. They previously required the developer preview. IDs, card ownership and existing artwork are preserved. This activates the authored implementation; **no avatar is declared fully qualified or complete**.

The side-barracks repair addresses two separate defects: lane-only champion/minion movement never approached the side structures, and ranged basic projectiles aimed at the bottom barracks were discarded because their ground coordinate exceeded the arena boundary. Structure reach and prerequisite legality remain enforced, including all three barracks before Nexus damage.

## Verification

| Check | Result | Evidence / limit |
| --- | --- | --- |
| Game checks | 570 unit tests, 3 simulation checks, TypeScript pass | `../babylon-migration/roster-game-check.log`; simplified simulator is not live-kit qualification |
| Production build | Pass | `../babylon-migration/barracks-build.log`; large chunks remain |
| API integration | 23 tests / 162 assertions pass | `roster-api-check.log`; includes actual catalog upgrade preserving owned instances, club lineup and queued ticket |
| Live blue/red with waves | Both side barracks destroyed at 5s | `barracks-live-20261024.json` |
| Live blue/red champions alone | Both side barracks destroyed at 47s / 66s | Same report; zero uncaught errors |
| Local online cutover | New catalog and rebuilt worker active; Babylon import and health pass | `online-worker-build.log`; no full online match was played |
| Owned cards | All 20 preserved; ownership checksum identical | `ownership-before-20261024.json`, `ownership-after-20261024.json` |

The barracks scenarios use the real React/live simulation executor with prerequisite towers already destroyed, no defending heroes and attackers pre-positioned near the base. They prove approach, basic attack impacts, damage and retargeting in that fixture. They do not prove natural-match strategy or competitive balance.

## Removal and compatibility

- Replaced the playable ability definitions and removed the live old S1/S2/R cast bodies. New canonical runtime names suppress historical signature/passive dispatch. Internal aliases remain solely for stable saves, card signatures and existing art lookup.
- Migrated 180 original ability records, preserving binding IDs, image attachments and revision history. Soft-retired ten old invoked spells. Stale unversioned editor rows cannot reinstate old kits. Mirelle's ten original fabric spells appear in the pattern book UI.
- Deleted four unused arena/spellbook components, totaling 130,159 bytes; see `cleanup-20261024.json`. Retained artwork, asset tooling and frozen historical fixtures/studies/evidence.
- The reviewed online installer only advances owned-card catalog pointers after checking identical card/coach/starter definitions, 45 stable avatar IDs and unchanged base stats. Historical match catalogs remain available.
- The rebuilt local online worker pins catalog `41d18be3d22349e5bc622c37f6446dbccb8de978f3774b302e091492b1c6177f`, rules `af5256cf07974b60c6302aa6d895f8db214cf9986b7db8e44c137dbaa58a39ce`, policy `original-v3-hybrid-v2`. No active matches existed at cutover. Adaptive learning remains; installed macro releases require qualification and matching source hash. No frozen study was edited or resumed.

## Remaining work

Every avatar remains partial in `progress.json`. Individual passive/S1/S2/R fidelity, tactical AI acceptance, animation events, readable final VFX, counterplay, full-match 1x/4x determinism and long-run balance/ML improvement still require qualification and likely further fixes. Damage/cost/recovery values include provisional engineering values documented in `ROSTER_IMPLEMENTATION_20261024.md`. Missing supplied standalone identity manifest remains tracked; current mapping is derived from the provided roster. No new V3 models, portraits, rigs or dressed art have been produced. Existing artwork remains until replacements exist, as requested.
