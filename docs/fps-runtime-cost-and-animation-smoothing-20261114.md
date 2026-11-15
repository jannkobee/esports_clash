# Runtime cost and animation smoothing (14 November 2026)

Owner requested less lag and clean, smooth animations. `/root` owns the simulation hot paths, renderer/resource reuse, display timing, focused checks and this handoff; no delegates. This pass refines the existing fallback renderer and does not generate/process new character assets. Manager roles, six attributes, personalities, legal information, fixed physics, private DNA, careers and Colab boundaries remain.

## Runtime changes

- Added an immutable spatial broad phase for collision and sight queries. Cached cell/region candidates retain source order; the existing exact height, capsule, terrain, fountain and ray tests still decide results. No collision geometry was removed.
- Snapshots copy the small observed-behavior record directly instead of repeatedly using structured cloning, and compute each team's public enemy count once per snapshot.
- A quiet committed approach checks its own continued reachability and clock budget before constructing alternatives. New credible information, blocked routes and urgency retain reassessment. The established choice and RNG behavior remain covered by brain regressions.
- Static map routes warm one at a time during buy phase. Inputs are spawn coordinates and public map affordances; warm-up changes caches, not player actions or RNG.
- The display loop gives simulation catch-up a five-millisecond work budget between fixed ticks. At least one pending tick may run; expensive ticks cannot be preempted. Pending simulation time is retained, not discarded or replaced by larger physics steps.
- Reuse at most four held-weapon views per actor and six first-person views across equipment/camera changes. Eviction and teardown dispose their meshes and unique muzzle materials. Grenade trails update fixed-size tube/line buffers instead of recreating GPU meshes every update; release-only/elapsed-flight behavior remains.
- Retained material-based scenery batching and extended compatible batching across structural world geometry. Material, vertex layout, transparency and shadow distinctions remain. In a real-scenery-plus-map structural fixture, draw meshes decrease from 562 to 457 with identical vertex totals. Existing scenery itself already batched thousands of pieces; its 8,996-to-402 consolidation is not claimed as a new improvement.

A trial of smaller spatial render batches was rejected: four CPU frustum probes submitted 1000/241/636/1271 spatial groups versus 385/159/228/402 global groups. Keep this evidence when considering further renderer tuning; smaller batches alone were not a demonstrated improvement here. The final helper retains global compatible-material batches. Transparent geometry stays separate.

## Animation changes

Third-person action phases, first-person reload/draw/throw/bolt/pump phases, recoil/muzzle/tracer timing and cosmetic corpse motion use interpolated display time. Visual speed, scope, reload, draw and channel values interpolate between snapshots when compatible. Equipment changes retain authoritative action boundaries. Body pivots blend between poses using elapsed-time exponential weights and retained buffers; world position and aiming continue tracking the interpolated actor directly. Draw lowering uses a continuous weight. Motion/pose state resets across rounds and corpse reuse. No idle crosshair sweep or weapon sway was added.

## Verification and limits

57 distinct focused checks passed across performance/render tests, existing autonomy/routing tests, brain regressions and the articulated-animation regression. The initial performance run passed 27/28; the real-scenery fixture was corrected to inspect all scene geometry rather than only returned shadow casters, and its final rerun passed. Existing animation endpoint assertions remain; two pose fixtures now allow the requested 100 ms transition before checking their original endpoints. TypeScript passed.

Coverage includes 240 seeded indexed-versus-full-map ray comparisons, retained fixed-clock backlog, unchanged static vertex counts/transparency, bounded weapon resources, finite grenade buffers reused across updates, smooth 60/120 Hz poses, current weapon world tracking, corpse reuse, the 80-start restaurant matrix, crossing teammates, B passage traffic and all window entrances.

The final audited CPU run used seed 1337 and 1,800 fixed ticks: live median 1.65 ms, p95 9.48 ms, p99 19.33 ms, maximum 38.11 ms; first live tick 24.43 ms. Bounds/collision/cash/ammunition/utility audits passed. Round, score, event count (78) and shots (115) match the initial seed checkpoint. The earlier profiled checkpoint reported live p99 21.24 ms, max 49.81 ms, first live tick 49.81 ms, but included profiler/trace overhead. An intermediate unprofiled geometry run reported p99 16.83 ms/max 35.99 ms. These runs demonstrate remaining timing variability and do not establish a clean percentage speed-up or GPU FPS. Warm-up also redistributes work into buy time. Occasional expensive CPU decisions remain.

Receipts: `tmp/fps-lag-before.cpuprofile`, `tmp/fps-lag-before.json`, `tmp/fps-lag-geometry.json`, `tmp/fps-lag-final.json`, `tmp/fps-lag-animation-tests.log`, `tmp/fps-static-batching.log`, `tmp/fps-animation-existing.log`, `tmp/fps-lag-brain-regression.log`.

No broad suite/build rerun, browser/GPU review, all-device lag-elimination claim, deployment, live-session mutation, migration, asset processing or model promotion. Reload and start a fresh exhibition to use the updated in-memory simulation/viewer. Unrelated pending work remains preserved.

Owned sources: new `fpsStaticGeometry.ts` and `fpsLiveRenderOptimization.ts`; `fpsLiveMap.ts`, `fpsLiveSimulation.ts`, `fpsLiveBrain.ts`, `fpsSpatialWorld.ts`, `fpsLiveScenery.ts`, `fpsLiveViewer.ts`, `FpsLiveBroadcast.tsx`; new `fpsLiveRenderPerformance.test.mjs` and the timing fixture in `fpsProTacticsRegression.test.mjs`.
