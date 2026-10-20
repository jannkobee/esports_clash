# Avatar natural motion — 2026-10-20

The owner requested donor leg motion instead of synthetic locomotion IK, 0.20-second transitions, accessory inertia, idle breathing, and velocity-synchronized strides. This authorizes replacing the prepared-model leg override and adding bounded presentation overlays. Combat clocks, stats, collision, targeting, simulation RNG, tower rules and aliases are unchanged.

## Implementation

- `infrastructure/avatar-evolution/retarget-unirig.py` preserves donor thigh, calf, foot and leg-helper rotations instead of clearing their pose matrices. `retarget_contacts.py` only adjusts vertical ankle contact within 2.5% of leg length, preserving the posed knee plane, joint lengths and foot orientation. It no longer replaces the stride or lowers the pelvis. Existing held-equipment elbow clearance remains.
- `equipment_skin.py` retains extra bone influences during surface smoothing. Anatomical paths and held equipment are excluded from automatic secondary motion. Multi-joint side branches off the head and torso receive hair/coat metadata; other extra bones retain skin without an inferred controller. Existing clavicle remapping and rigid-equipment repairs remain.
- Prepared GLBs carry measured stride distances and secondary branch metadata. `avatarModelAssets.ts` converts these distances to the model's actual rendered scale. `avatarMotionTimeline.ts` derives gait phase from observed displacement, with velocity fallback when positions are absent; a blocked unit does not cycle merely because its requested velocity remains nonzero. Pause, rewind and teleport guards remain.
- `avatarEvolutionReview.ts` uses the same model stride scale when measuring foot drift and moves Strafe laterally, keeping diagnostic travel consistent with runtime cadence.
- `threeArenaScene.ts` and `threeAvatarPreview.ts` use a shared 0.20-second fade. The asset player blends quaternion rotations by spherical interpolation and positions/scales linearly. A new transition starts from the currently displayed blend, so an interrupted action does not jump back to its previous clip. Raw mixer poses are cached separately from blended and additive poses to prevent drift while paused. Death also fades into its clip; attack/cast event timing remains authoritative.
- `avatarSecondaryMotion.ts` adds bounded damped springs driven by acceleration, movement and turning. Each clone owns its spring state. Idle chest breathing has a maximum 0.02-radian amplitude and a smaller spine stance shift; hips and feet are untouched. Rewind and long time gaps reset inertia, repeated timestamps freeze it, and death suppresses the overlay. Explicit cape sockets are supported alongside prepared hair/coat bones. Supplied/Claude Arsenaldo assets retain their authored-motion path.
- The studio renders a short transition even between paused poses, then stops its animation frame loop. Reduced-motion preference skips this transition. Animated preview poses supply nominal locomotion excitation; arena inertia uses the unit's actual velocity and facing.

## Verification

- Four new runtime tests in `avatarNaturalMotion.test.mjs`: variable-rate spring convergence/settling; acceleration/turning, pause/seek/death and limb isolation; distance-based stride cadence, scale and blocking; actual GLB transition interruptions, paused stability and clone isolation.
- Existing prepared-motion tests now permit the explicitly requested chest/spine idle overlay while still checking that other transforms and all paused transforms remain stable.
- Five Blender tests in `test_natural_motion.py`: bounded contact correction, swing clearance, foot-roll/knee-plane/joint-length preservation, untouched free FK/combat poses, accessory classification and retained normalized skin weights.
- `npm.cmd run check:game`: 465 tests, three additional simulation tests, design validation and TypeScript pass. Production build passes with the existing chunk-size advisory.
- A separate copy of Aiselle's cached rig from preparation `473a7a1f-5129-48d3-84c9-731e3a8ac921` was retargeted under the worker's temporary directory. It exported all ten clips, 13 hair/coat joints, and stride metadata. No inference, preparation admission, source overwrite or publication occurred.
- `verify-avatar-natural-motion.mjs` loads that candidate through the actual `AvatarPreview`/asset player in Chrome. It verifies actual secondary skin influences, paused pose changes, stable stopped transforms, interrupted states, finite matrices, reduced motion and disposal. No uncaught browser errors. Rerun with `node infrastructure/evolution/verify-avatar-natural-motion.mjs path/to/candidate.glb` while the local backoffice and Vite services run.
- Aiselle's full-mesh diagnostic reports zero unweighted vertices, zero invalid weight sums and finite sampled poses. It still reports elevated self-intersections in Cast, Death, Hit, Run and Walk. The current pipeline records these as warnings; this is not an artistic-quality approval.

Evidence is in `avatar-natural-motion-verification.json` and the studio screenshots `avatar-natural-motion-run.png` / `avatar-natural-motion-idle.png`. Full local diagnostic artifacts/logs are under `.local-tools/natural-motion-review/` and `.local-tools/natural-motion-*.log`.

## Remaining limits

Existing published GLBs already contain baked leg curves and consolidated weights. They need a new manual preparation and review to gain the donor-FK and skinned-accessory changes; runtime fades and breathing apply immediately after client reload. No published binary was replaced.

This is bounded joint sway, not cloth collision simulation. Topology cannot guarantee semantic classification for every generated rig. Accessories without articulated weighted branches cannot bend, and garment/body intersections still need asset review. Stride synchronization matches average authored travel to actual displacement; nonlinear donor trajectories, mismatched proportions, transitions and forced movement can still show residual foot sliding. The small vertical clamp is deliberately insufficient to repair a badly grounded rig. No full-roster regenerated-asset quality or physical-device frame-rate claim is made.

Three.js behavior references: [AnimationAction](https://threejs.org/docs/pages/AnimationAction.html) and [Quaternion interpolation](https://threejs.org/docs/pages/Quaternion.html).
