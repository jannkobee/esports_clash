# Tactical FPS v2 and `/evolution/game-modes` availability

Owner direction on 10 November 2026: replace active preferences with FPS roles and finish the tactical simulation while retaining the Laravel `/evolution/game-modes` toggle (note: frontend legacy simulation/viewer/art/tests were permanently removed on 2026-11-12 per owner instruction while `/evolution/game-modes` and frozen ML playbooks remain preserved). `/root` owns this pass; no agents or asset-processing stages were dispatched.

## Availability and player views

Laravel's owner-only **Game modes** page at `/evolution/game-modes` controls the legacy mode manifest (`moba_enabled` default off, `fps_enabled` on). `/api/v1/game-modes` exposes the uncached public state while tactical FPS stays active on Web (legacy frontend views, simulation, and tests were subsequently removed on 2026-11-12).

Squad, club home, profiles/dossiers, training and transfer views show FPS scouting role fits from current skills. Historical role values remain intact. Match assignments still consider the whole lineup and bounded personality preferences. Unsupported legacy role filters were removed rather than filtering only one page of a global registry. No database player/career rewrite occurred.

New official allocations pin `fps.simulation_version: 2`; settlement rejects a mismatched report. FPS fixture scores use `finalScore` and a round label; existing historical reports remain unchanged.

## Round simulation and replay

`src/fps/fpsRoundSimulation.ts` replaces group-power retakes with half-second tactical steps on the five map graphs. Movement visits connected zones and consumes authored edge time. Defensive posts, site approaches, setup timing and fake routing feed actual contacts. Carried smokes, flashes, HE and incendiaries are consumed. Smoke lasts 15 seconds, blindness 2 seconds and incendiary areas 7 seconds.

Hits reduce actual HP and armor. Combat kills record shooter, weapon, target and headshot; assists, opening kills, 1.5-second trades, damage and clutch outcomes come from actual events. Aim, weapon, range, cover, stamina and flexibility affect mechanical calculations. Personality affects decisions without adding aim or damage. Banks remain capped; kills pay catalog rewards, the first loss pays $1,400, retained gear is not charged twice and death loses upgraded sidearms. The buy policy can select every utility type within three carried slots.

The 15-second prep, 115-second live deadline, 3.5-second plant, 40-second planted countdown and 5/10-second defuses use simulation time. Damage interrupts objective actions. A dead carrier drops the device and an attacker must reach it to recover it. Eliminating attackers after a plant still requires defusing. Device blasts record environmental deaths without invented combat credit. Equipment saves retreat and preserve surviving gear.

Every fresh MR3 block requires four wins, resets its bank and continues recurring side swaps. The earlier two-round-lead shortcut could end a later block at 20-18; that defect is corrected. Invalid rosters/timers fail explicitly and the 1,000-round bound never fabricates a winner.

Replay consumes recorded movement, HP, armor, utility and device state. Firing does not teleport a shooter. One device marker, surviving/eliminated HP, per-round mindset, automatic round progression and up to 16x playback are available. Historical v1 replay remains readable.

## Verification and deployment

Focused FPS tests: 34 passing, covering maps/routes, deterministic output, event-derived statistics, objective timers, timeout, personality boundaries, saves, worker execution, historical compatibility and scouting roles. Backend tests: 49 passing / 551 assertions for modes, online settlement and competitions. Full game check: 649 passed, 22 skipped, plus three simulation checks. Production build passed. Final projection/UI checks are recorded in the latest handoff.

Backup `.local-tools/teamfight-before-fps-v2-20261110.dump` is retained (11,550,398 bytes). The additive game-mode migration was applied with legacy MOBA mode defaulted off (and frontend MOBA permanently removed on 2026-11-12). Zero active matches and reserved default/world jobs preceded the scoped match-worker deployment and idle default-worker refresh. Existing peer room memory and history/ML/avatar workers were preserved.

Deployed image: `teamfight-online-worker:fps-tactical-v2-20261110`, digest `sha256:7a745e877b58fdf8ab91e222b048a52977d76857b9c10750ec12b3036e423c7b`. Its private HTTP launcher completed diagnostic `b2706220-a568-402f-a9a2-7d6560d8acac`: 24 rounds, 16-8, simulation v2, recorded kills reconciled. The diagnostic creates no official fixture or career settlement; evidence remains separate. `infrastructure/online/verify-fps-runtime.py` keeps its worker token inside the container.

Live same-origin checks: mode manifest 200 with FPS active and `/evolution/game-modes` toggled off, avatar/item directories 409 and legacy room creation 403. API, frontend and replacement match worker were healthy after refresh.

## Limits

This completes the first-playable tactical simulation boundary, not a controllable first-person 3D shooter. Cover/sightlines are zone abstractions. Physical projectile/recoil/reload simulation, detailed independent lurking, polished 3D presentation, FPS-trained ML and competitive balance remain unqualified. Live official fixtures were not fabricated; isolated backend tests cover settlement/competition and a separate runtime diagnostic covers the deployed worker. No new rendered desktop/mobile acceptance is claimed.

Colab-only generation/rigging/animation processing and base-before-appearance gates remain authoritative. No generation, rigging, animation, asset publication, deleted-binary restoration or frozen ML rewrite occurred. Preserve `/evolution/game-modes` and frozen backend artifacts (frontend MOBA views/simulation removed on 2026-11-12).
