# Contextual FPS identity v3 — implementation and activation

Owner approved the five remaining integration steps, including checks, additive migration and deployment, on 10 November 2026. `/root` owned the implementation, persistence, UI, verification and deployment. No agents, ML training, avatar generation or asset-processing stages were dispatched. This record supersedes the earlier incomplete identity handoffs for the implemented tactical graph scope.

## Player identity and decisions

The seven primary roles have distinct icons and actual responsibilities. Assignment uses current role-weighted skills and learned role familiarity, or the manager's explicit assignment. Caller is an additional responsibility when the primary assignment is another role. Snipers purchase suitable weapons when affordable and prepare angles; lurkers take a separate approach and guard flank routes; entry, trade, support and defensive posts affect movement, utility opportunities and the device carrier.

There are 24 conditional personalities and 21 specialties. Personality reactions, continuous individual DNA, instructions, familiarity, chemistry, culture and current circumstances affect a seeded softmax over legal candidates. Personality does not add mechanical skills, hit damage, health, cash or a blanket performance multiplier. Role, purchase, contact, recovery, retake, preparation and plan-rebuilding decisions have separate opportunity facts. Objective commitments and urgency constrain candidates. Scores, selected action, active trigger and instruction adherence are recorded.

New DNA uses the same tested UUID algorithm in TypeScript and PHP. DNA is persisted per player and never regenerated for a match. Initial intensity varies by player. Existing primary and secondary legacy IDs are retained; the FPS interpretation is explicitly marked as an approximate conversion. Previously prepared DNA and assigned identities are preserved. Pending mappings are filled without rerolling DNA. Unknown historical badges retain their provenance and use the documented deterministic `no_legacy_equivalent_generated_v1` interpretation. Fresh admitted players can draw all 24 identities independently of legacy badge availability. Initial specialty estimates use role fit and a stable player seed; specialties stay fixed while proficiency develops.

## Opportunity-dependent specialties

| Execution | Live opportunity rules |
| --- | --- |
| Engagement | Coordinated prepared-defender breach; allied flash window; prepared long angle; early opening sightline; observed rotation interception; assigned flank coverage; defensive crossfire; isolated contested hold; immediate trade; entry follow-up; overlapping defensive angles with allied pressure |
| Utility | Meaningful adjacent smoke coverage; flash synchronized with an entry; useful utility in a contested retake; defensive incendiary delay |
| Movement and tactical repositioning | Recently observed vacated coverage; a reported rotation; a failed execute with a surviving caller choosing an alternative route; synchronized fake pressure; relocation after revealing a sniper position; unobserved infiltration while enemy attention is diverted |

The engine establishes these facts from graph routes, visible contact, movement, utility and kill events. A badge cannot manufacture an opportunity or choose the action. A qualifying specialty improves the selected execution by at most 4% (or four percentage points for a shot); proficiency scales that cap. Movement benefits use a bounded seeded chance of arriving one half-second step earlier. Inactive effects are zero. Telemetry records the specialty, actor and applied bonus. This is a zone-level model of positioning and timing.

## Persistent coaching, systems and careers

`FpsIdentityEngine` snapshots the actual employed head coach and staff development input, the saved six-dimension gameplan, continuous culture, lineup relationships, role orders, training focus and player development. Coach philosophy is a stable preference of the person rather than a universal rating buff. Six editable philosophy presets are available. Human and bot clubs use the same pinning and simulation path.

New official allocations pin simulation revision 3 and private identity inputs inside the immutable allocation hash. The worker hydrates and validates the pinned catalog IDs, traits and system dimensions; incomplete inputs fail explicitly. Historical revision 2 allocations still run their original path.

Verified settlement applies bounded, diminishing development once per match. System familiarity, actual role experience and practiced specialty proficiency persist; adaptability develops gradually. Actual trades develop trust and communication; recorded instruction adherence develops acceptance of the caller. A loss alone does not create a relationship penalty. Culture moves gradually toward coaching, roster and practiced tactics. Coach changes impose an adjustment cost. Existing weekly training processing applies the pinned role/system/specialty focus once through the existing processed-session guard; specialty training requires recorded use. Community matches that prohibit training do not receive identity development.

The manager desk exposes coach fit, gameplan fit, chemistry, familiarity, role learning, specialty coverage and recorded observations. Scouting remains qualitative and labels its evidence confidence. Exact DNA is private. Squad cards, profiles, player reference records and transfer listings expose the new badges; transfer personality filters query persistent identities globally. Identity badges do not add a universal price multiplier or alter financial/consent rules.

## Privacy and compatibility

The private allocation stays server-side. The worker removes initial/final raw identity state from public reports, settlement rejects raw DNA, and model/API serialization redacts private identity inputs. Public round snapshots include only role, personality/specialty names and match mindset. Event-driven replay supports v2 and v3, including recovered equipment. `/evolution/game-modes` compatibility remains retained (legacy frontend views removed 2026-11-12); aliases, historical matches, frozen ML and Colab-only asset gates are preserved.

## Verification

- Required game check: 662 passed, 22 skipped, plus all three simulation checks.
- Final focused FPS run: 47 passed, including deterministic v3 matches, unchanged input state, all personality reactions, specialty activation/inactivity caps, legal candidates, all role assignments and controlled failed-execute rebuilding.
- Backend integration: 63 passed / 15,751 assertions across identity, online, competition and world-player tests. The final identity suite adds persistent-personality transfer filtering and passes 6 tests / 91 assertions. It covers revision/ownership guards, cross-language DNA vectors, immutable preparation, private-state rejection, v3 settlement and idempotent progression.
- A stale reset-auction test fixture was updated to establish the already-required player transfer consent before bidding. The consent rule was preserved.
- TypeScript and production build passed. Existing bundle-size warnings remain.
- Isolated browser acceptance passed Settings, reference directories/details, manager role/gameplan edits, current-rule exhibition autoplay and mobile reference layout with zero application rendering exceptions. API writes were intercepted in the isolated test profile. Screenshots/results: `.local-tools/fps-identity-final-browser-review-20261110/`.
- Seeded diagnostic audit: 105 synthetic matches, with conditional activation counts and decision entropy in `.local-tools/fps-identity-audit.json`. Some rare opportunities did not occur in that sample; controlled tests cover failed-execute rebuilding. The audit is not competitive balance certification.

## Migration and running stack

Backup: `.local-tools/teamfight-before-fps-identity-v3-20261110.dump`, 12,282,223 bytes, SHA-256 `457275a950b1ff6c3ec4b478992974771d8d99d647e9a5c015113a2d5b544414`.

Applied the two additive identity migrations (000018 and 000019), prepared 953 existing profiles with zero unmapped identities, then enabled new v3 allocations. No historical player skills, IDs, nationality, transfers, match results or legacy badge fields were rewritten. The preparation command is idempotent.

Deployed `teamfight-online-worker:fps-identity-v3-20261110`, image `sha256:a151595a9c3fa2735e368c9c74a0665075850f6e4606d57617300ba810fc182c`. The match worker was replaced with zero active official matches; the idle default/world PHP worker was refreshed. Room, history, avatar and ML workers were preserved. The API and frontend use the existing mounted development sources, and the production frontend build also passed.

Private runtime diagnostics on the replacement worker:

- v3: `47fef950-8bc8-41c2-92ea-e8b42609d26b`, 29 rounds, 13–16; event-derived kills reconciled and private identity state absent from the public report.
- v2 compatibility: `88c658ea-5085-4cd5-b845-7e00ba27da30`, 24 rounds, 16–8; original path remains operational.

These diagnostics create no official fixtures, standings or career awards. Official settlement is verified in isolated backend tests; no live official fixture was fabricated to claim end-to-end acceptance.

Operational commands: `php artisan fps:identity-release status`, `prepare`, `enable`, `disable`. Disabling affects future allocations only; already pinned v3 matches retain their original rules. Keep the v3-capable worker while any v3 match is outstanding. Never roll back by deleting identity/career tables or rewriting old allocations.

## Practical limits

The implementation is the contextual identity system for the existing tactical graph simulator. Cover, sightlines, flanks, fakes and interpersonal interpretation remain abstractions. Long-run balance, universal personality dominance, market-demand calibration, rare-event frequency and multi-season career realism require observational tuning. This work does not establish physical FPS simulation, first-person 3D, trained FPS ML or asset qualification.
