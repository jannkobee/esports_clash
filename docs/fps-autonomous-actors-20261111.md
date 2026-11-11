# Adaptive FPS actor decisions (2026-11-11)

The owner authorized replacing scripted tactical sequences with proactive, information-driven actor behavior in official contextual simulation and the local live exhibition. The owner subsequently confirmed that this supersedes the profile-free v5 exhibition path as well as the earlier default/rally/utility/entry sequence. All live exhibition snapshots now identify as v7; the detailed-profile features introduced in v6 remain available.

## Live exhibition

- Each actor chooses its own next approach from its role, attributes, teammate positions, and its own bounded intel. Actors probe site angles, investigate remembered contacts, and continue checking new angles rather than waiting at a fixed rally or utility stage.
- The caller can still redirect teammates when their own evidence supports a change. Personal sightings remain gated by field of view, walls, smoke, blindness, and sampled acquisition; reports remain delayed and uncertain. Sound and utility cues do not identify hidden opponents.
- Trade/support actors keep a role- and attribute-adjusted distance behind teammates taking space. Probe targets account for nearby teammates; existing collision queuing and separation remain in force.
- Actors use utility based on their individual visible contacts or remembered evidence. The viewer animates a throw in first- and third-person views from the actor's public throw timestamp while the grenade follows its existing ballistic simulation.
- The broadcast's `ADAPTIVE` label and default/entry/post-plant phase are descriptive; they do not gate movement or utility.

## Official contextual simulation

- Contextual v3 opens with an adaptive probe instead of timed setup, fake-execute, or rush sequences. Each actor's existing personality, role, and tactical-action evaluation still applies; no-contact actors continue toward their objective.
- Actors can spread across available site zones based on observed teammate occupancy. This simulation has authored zones, not continuous 3D vision: a player observes opponents only in its current or connected zone, subject to smoke. Historical and non-contextual paths are unchanged.
- No new ability schema, official player migration, scouting/training activation, career settlement, or deployment is included.

## Verification and limits

`npm run check:game` passes: 724 tests passed, 22 skipped, zero failed; all three additional simulation checks passed, and TypeScript passed. `npm run build` succeeds; Vite reports the existing warning for chunks over 500 kB. Focused regressions cover adaptive goal selection, spacing, utility timing/throw state, deterministic movement, and early contextual movement. The simulation remains heuristic, not learned or pro-qualified. The official path remains zone-based; throw animation is a local exhibition rendering feature. No browser/desktop automation or asset processing was used.
