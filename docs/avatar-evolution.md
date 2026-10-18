# Autonomous Avatar Evolution Engine

Owner priority, 2026-10-18: defer the remaining ML validation work and implement Part 6 first, including animation and ability visuals. The ML Docker study/schedule remain independent. The supplied autonomy proposal is retained verbatim in [avatar-evolution-autonomy-specification.md](avatar-evolution-autonomy-specification.md).

Model reports now have their own owner archive at **http://localhost:8089/evolution/avatars/reports**, with model JSON downloads separate from ML reports. See [docker-development.md](docker-development.md) for report separation and the active Docker development hot reload setup.

## Runtime and owner workflow

The separate Avatar Evolution service uses Laravel's existing database queue and scheduler, a capped Docker worker, Blender 4.5.3, and the game's Three.js renderer. It requires no running Codex session, LLM, paid AI API, Redis migration, or external generative service. Docker restarts the worker automatically. Laravel checks the schedule and recovers outstanding polls every minute.

The owner panel is **http://localhost:8089/evolution/avatars**, using the same Evolution owner login. Generation defaults to **Arsenaldo, five candidates, one optimization generation, an hourly eligibility check, one generator and a 4 GiB artifact budget**. The owner can select shipped avatars, a 5-minute to weekly interval, three to ten candidates, and up to three optimization generations. Search stops when technical criteria plateau. Existing reviews for an avatar block further scheduled generation of that avatar. This is an always-on scheduled service, with explicit waiting states, rather than endless asset creation.

The owner can compare before/after GLBs, standardized images, animations, ability effects, measured validation, actual change descriptions and technical ranking. Controls support rejection with feedback, regeneration with a structured focus, approval/publishing, restoration of the shipped original, and rollback to an earlier approved version. Technical failure blocks approval. Generation never publishes automatically.

The shipped original is V1. First approval creates V2, subsequent approvals increment the visual version. Older approved assets remain addressable for rollback and already-open scenes. The public game sees only approved release records and hash-addressed GLB assets. Each renderer captures its release manifest once; an active scene never refreshes it. Missing release services/assets fall back to the original model. Review assets and worker APIs remain private to the owner/internal network.

## Actual rendering architecture

| Area | Inspected implementation |
| --- | --- |
| Renderer | Plain Three.js inside React components; no React Three Fiber dependency |
| Geometry | Parameterized procedural surfaces/equipment, exported and merged into GLBs |
| Shipped assets | 45 current v9 GLBs, with Arsenaldo's separately selected Claude-animation import |
| Blender | Existing 4.5.3 packed authoring scenes and licensed anatomy/equipment pipeline |
| Skeleton | Common 17-joint rig, skin weights, inverse bind matrices and editable grip shapes |
| Animation | Ten native GLB clips, `AnimationMixer`, per-renderer transitions, contact/foot placement, recoil and secondary motion |
| Abilities | Existing pooled geometry, instanced glow, trails, spell-specific details and material effects; scenery also uses custom shaders |

Relevant files include `avatarModelAssets.ts`, `threeAvatarModels.ts`, `avatarCombatMotion.ts`, `avatarMotionTimeline.ts`, `avatarContactRig.ts`, `avatarWeaponSockets.ts`, `threeAbilityEffects.ts`, `threeAbilityDetails.ts`, and the existing prepare/merge/Blender scripts. The engine extends these assets/controllers rather than introducing another character framework.

Arsenaldo's selected Claude import has no supplied `.blend` source. The worker imports that exact selected GLB into a **new, packed editable scene**. Existing v9 Blender scenes and both original GLB variants remain untouched. Runtime candidates are not silently replaced by a Blender re-export that might alter rigs or clip bytes.

## Analyzer and candidate generation

The analyzer reads the actual GLB header, accessors, embedded textures, skeleton, materials, animation samplers and scene transforms. It records visual bounds, head/full-visual-height ratio, shoulder spacing, arm/leg segment lengths, body-part bounds, palette/material response, topology/degenerate faces, mesh/triangle/material counts, clips and durations. Measurements identify their scope and limitations; full visual bounds include equipment, and layered garments can intentionally intersect.

Generation uses a finite parameter schema and deterministic transforms. No generated source code is executed or rewritten. Current families refine torso/waist cross-sections and silhouette; armor/equipment/cape surfaces; material roughness separation; upper-body native rotation curves; and bounded ability decoration/trail parameters. Arsenaldo's merged material batches use constrained body-space regions. Five candidates use different families/strengths; regeneration changes the bounded revision/focus. These are actual GLB and animation-output changes, not text-only suggestions or random recoloring.

Every candidate preserves the original skeleton hierarchy, inverse binds, root motion, key timestamps, topology/skin weights, embedded texture bytes and palette. Stature/visual bounds stay within the configured conservative identity envelope. This initial toolset deliberately preserves joints rather than performing unqualified automatic retargeting. Larger anatomy, new topology, joint relocation and creative generative redesign require additional validated processing tools.

The existing animation framework already supplies anticipation, wind-up/strike/recovery curves, directional locomotion, rotation interpolation, hit/death clips, blending, foot/hand contacts and secondary motion. Candidate mutation refines native curve amplitudes while retaining clip times and the current gameplay-driven visual controller. Ability parameters add small decorative geometry inside existing spell footprints/lifetimes and bounded weapon trails. They create no attacks, hit events, gameplay units, timing changes or stats.

## Automatic evaluation and review

1. Freeze source/plan hashes and retain the original/approved parent.
2. Analyze geometry and immutable compatibility signatures.
3. Generate real candidate GLBs with structured changes.
4. Import each exact output in Blender, measure bind-pose BVH intersections, and save a separate packed `.blend`.
5. Load it through the real `AvatarAssetLibrary` and native/contact animation controller in headless Chromium.
6. Exercise all ten clips and sampled transitions, measure finite posed bounds, planted-foot drift and blend displacement.
7. Render identical front/side/back and attack/ability samples. Record silhouette occupancy/cropping, triangles, draw calls, textures and local frame timings.
8. Compare original identity bounds and parent technical measurements. Reject invalid rigs, images, bounds, foot/transition regressions and excessive new intersections.
9. Rank remaining candidates by explainable technical penalties. Store every candidate, failed result, image, scene and manifest.
10. Present the candidates for owner judgement. Only explicit approval publishes a compatible candidate.

**Technical rank is not artistic quality.** BVH counts include intentional overlaps. Posed clipping uses sampled bounds, rather than a complete continuous collision proof. Foot and transition samples are technical proxies, not universal animation-quality scores. Docker rendering uses CPU/SwiftShader and does not establish phone FPS or Windows GPU performance. Human comparison remains necessary.

## Preservation, resources and security

Avatar work has a separate persistent volume and worker capped at one CPU / 1280 MiB. Blender and Chromium run sequentially. Node generation has a bounded heap; work has per-process and total timeouts, a single admission lock and bounded restart launches. Resource admission checks available VM RAM and managed storage. Required originals, accepted versions and review evidence are retained; budget pressure pauses new work instead of pruning volumes or overwriting sources. Artifact expiry/compaction beyond this conservative budget policy remains future work.

Owner operations require the designated Laravel session, CSRF, validated inputs and audit records. Approval rechecks the worker manifest/report, candidate pass status and current parent version under database locks. Rollback is atomic. Public downloads expose only approved, hash-verified releases; arbitrary private file paths and artifact symlinks are rejected. Source files and scripts are versioned, and the Blender archive checksum is pinned in the Dockerfile.

No mechanical balance, hitbox, range, cooldown, damage, team identity, tower/well/Nexus safety, objective behavior, anti-oscillation or Player Card alias is changed. Animation and ability mutations remain presentation-only.

## Implementation and verification status

The independent worker, Laravel schedule/review/release/rollback workflow and private comparison renderer are deployed. Three generator tests verify five real Arsenaldo variants and immutable compatibility data; **38 Laravel tests / 283 assertions** pass, including owner access, failed-candidate blocking, stale/tampered review rejection, V2 publishing, rollback and immutable old-release downloads with tamper rejection. **439 game tests, three deterministic simulations, TypeScript and build pass.** New game tests cover per-renderer release snapshots, original fallback, hash-addressed URLs and bounded decorative effects without borrowed-event mutation.

The first actual Docker run is **`9aff3ccf-ecb5-47da-8068-429e66b2f823`**. All **five candidates** passed the configured compatibility gates and await owner review. Every candidate has an actual GLB, packed Blender scene, seven standardized images, ten-clip samples, contact/blend measurements and explainable changes. The original asset hash remains unchanged; all five stored GLB hashes and immutable rig/timing/topology/texture/palette signatures were checked again after deployment. Candidate 03's packed scene reloads in Blender with 22 meshes, ten actions and eleven packed images.

The final renderer reproduced the original recorded model poses for the baseline and both decoration configurations. The owner browser workflow passes login/logout, private downloads, real GLB hash verification, missing-CSRF rejection, unchanged settings save and desktop/phone comparisons. Visual inspection found an embedded-canvas resize problem; a ResizeObserver now reframes it, and the phone check verifies each iframe/canvas width as well as the page width (326px within a 390px page). No candidate was published during validation. Publishing and rollback were exercised using isolated test records, rather than making an aesthetic decision for the owner.

Actual resource snapshot: roughly **66.7 MiB** of avatar artifacts including compatibility witnesses; idle anonymous RAM **73.5 MiB**, cgroup lifetime peak **1023.8 MiB**, under the 1280 MiB cap. These are scoped Docker measurements, not Windows physical RAM or GPU measurements. Automatic generation is enabled at 60 minutes and the scheduler heartbeat advances independently. The current Arsenaldo cycle waits for owner review.

Evidence: [complete first cycle](avatar-evolution-first-cycle.json), [frozen execution](avatar-evolution-execution.json), [artifact/deployment verification](avatar-evolution-deployment-verification.json), [final renderer qualification](avatar-evolution-renderer-qualification.json), [owner browser verification](avatar-evolution-ui-verification.json), [desktop comparison](avatar-evolution-owner-dashboard.png), [phone comparison](avatar-evolution-owner-mobile.png).

Compatibility passing does **not** establish overall technical or artistic improvement. Baseline bind-pose BVH pairs were 11,546; candidate counts range from 11,543 to 12,269, including intentional garment overlaps. Foot-joint drift proxies were unchanged; animation candidates slightly increased the sampled blend displacement within the configured allowance. These tradeoffs remain visible for review. The archived first report's initial-generation improvement flag compared against an empty search population, not the original model; it is not improvement evidence. Subsequent first generations record that comparison as unavailable. The archived report was retained unchanged.

Scope remains a first Arsenaldo procedural optimization pipeline, extendable to the catalog. It is not a trained creative 3D foundation model, guaranteed AAA art, complete automatic retopology/retargeting, a full continuous self-intersection proof, or a measured improvement for every avatar/ability.
