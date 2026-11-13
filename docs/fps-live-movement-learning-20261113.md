# Live FPS movement decision learning (13 November 2026)

The live FPS learner now selects among existing movement tactics in two bounded contexts:

- **Duels:** strafe, hold, or crouch-strafe.
- **Reported-contact peeks:** shoulder, crouch-swing, ferrari, double-pump, bait, or fake.

The movement model is a separate contextual action-value checkpoint. Context includes the decision phase, distance band, and health band. Role and the existing heuristic provide a preference; bounded exploration and observed outcomes can move choices away from that starting preference. Enemy damage, incoming damage, kills, and the round winner contribute feedback. Movement samples contain only numerical context/action/reward data and a synthetic episode key; they do not export identities, DNA, or opponent coordinates.

The learner only selects existing actions. It does not change walk/run speeds, jump physics, collision, weapon behavior, aim, or access to enemy information. Existing profile attributes continue to affect the execution paths they already own, including movement-control braking and peek endpoint error. In the 25-ability profiles, these attributes are not rewritten by learning.

## Training and approval

Headless training emits completed-round movement samples alongside navigation and combat samples. SQLite applies samples in ingestion order and saves them into the movement checkpoint. Hourly compressed experience archives include the movement records; their summary reports movement sample and action counts.

Model bundles are v2 and require all three checkpoints. Passing candidate screening is followed by 200 paired seed comparisons (team swaps) for route-only, combat-only, and movement-only ablations against the incumbent. Each report includes paired intervals, profile groups, candidate team assignments, and attacking/defending results. Candidate bundles remain review-only and are never activated automatically.

New live exhibitions pin the compatible approved movement checkpoint in frozen mode. The explicitly selected browser-local experiment is separate; its checkpoint and reset action appear in the FPS learning panel. Approval and rollback continue through the tracked model manifest.

The production TypeScript/Vite build passed after implementation. Automated game and learner tests were not run for this change. This demonstrates integration and compilation only; movement-quality improvement, held-out competitive gain, complete-match throughput, browser acceptance, and Lightsail rollout remain unverified.
