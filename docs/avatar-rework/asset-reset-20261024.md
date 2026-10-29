# All-avatar fresh start and Mirelle stage handoff

The owner corrected the deletion scope from Mirelle Vane only to **all 45 avatars**. This supersedes earlier retain-artwork instructions. Roster identities, kits, owned cards, source tools, frozen ML studies and historical audit records remain.

## Completed reset

| Store | Deleted files | Bytes | Evidence |
| --- | ---: | ---: | --- |
| Initial workspace assets/references/previews | 2,409 | 4,368,095,423 | [inventory](asset-reset-20261024-inventory.json), [receipt](asset-reset-20261024-local-receipt.json) |
| Private avatar worker and baked public models | 1,225 | 1,573,331,710 | [hashed receipt](asset-reset-20261024-worker-receipt.json) |
| Review-build duplicates, router references, diagnostics and old Arsenaldo pictures | 348 | 998,312,826 | [inventory](asset-reset-20261024-extra-inventory.json), [receipt](asset-reset-20261024-extra-receipt.json) |
| **Total** | **3,982** | **6,939,739,959** | |

Workspace paths were resolved inside the workspace and size/SHA-256 checked before native PowerShell deletion. Private worker paths were checked inside specified avatar roots. The supplemental scan included ignored build folders. Git history, browser caches, whole-repository backups and Docker image layers were not rewritten. Tool-supplied example meshes and non-avatar gameplay/UI evidence are outside scope.

All 45 backoffice avatars retain their definitions and now have asset epoch `fresh-20261024`. Old active releases are inactive; automatic preparation/evolution schedules disabled. Historical jobs/releases/revisions/reports retain their identities and status. Old binary URLs may return 404. A broader audit-row mutation was rejected by automatic review and **not executed**; the applied reset preserves those rows.

New generations use a separate `asset_epoch` column, keeping provider plans unchanged. Current-source pickers exclude old epochs. Legacy URLs/previews/fallback are disabled in both renderer libraries. Qualified new releases can still use the existing publication path. Private review candidates are not releases. Do not rerun these one-time reset scripts after authoring new candidates without a new reset request.

## Mirelle candidate — unqualified

Stage owner: `/root` for mesh, raw rig, direct-authored motion, export audit and inspection; no other agents active. No old avatar geometry or donor motion was used. Image generation returned no usable output; the candidate was authored directly in Blender 4.5.3 LTS. It is a neutral bald matte mannequin, without final face/appearance, outfit, hair, weapon or texture.

[Owner Babylon inspector](http://localhost:8089/evolution/registry/avatars/c_invoker/base/1bb641cd-ce80-4e12-9018-e67de0ff6dc3): orbit, bind pose, skeleton, clip/phase/playback and hash-verified artifact downloads. Interactive inspection currently requires the local development viewer; production inspector packaging remains unfinished.

| Artifact | SHA-256 |
| --- | --- |
| Unrigged GLB | `c68113bcab08f1c8e2b17a31068a85384a00a7a33bf01e7bc25761fb2654aff9` |
| Raw rig GLB | `72aafc6946a7f440ae90de4f2d925e7fd5b32a488358f9f97a37b63d089281d8` |
| Animated GLB | `d75c61014fb21f8fbe3e80e490eda4aba099546dda8e7b201062630afc2bc78e` |

[Candidate artifacts](../mirelle-clean-base-20261024/candidate/) include separate editable Blender files and GLBs for each stage, five motion renders and reports. Full hashes are registered in the backoffice manifest. Source: 9,502 vertices/19,000 triangles; GLB: 12,476 vertices after attribute seams, one material/draw call, 48 bones, maximum four weights. Ten draft clips: Idle, Walk, Run, Attack, Cast, Hit, Death, Strafe, TurnLeft, TurnRight.

Preserved failures: initial surface had hand intersections; a separate surface-union repair gives closed, zero-intersection rest geometry. Earlier motion attempts had Death floor penetration and hand/thigh or elbow collisions. Latest orientation experiment adds shoulder collisions. No existing collision policy or deformation threshold was relaxed.

[Independent exported-file precheck](../mirelle-clean-base-20261024/candidate/independent-audit.json): finite rest positions, zero rest intersections, closed topology and normalized weights; every clip fails posed collisions. Peak intersection pairs: Attack 78, Cast 59, Death 137, Hit 63, Idle 59, Run 137, Strafe 137, TurnLeft 59, TurnRight 59, Walk 137. Five collision samples per clip are a precheck, not dense qualification.

[Khronos validator](../mirelle-clean-base-20261024/gltf-validator.json): zero errors, one `NODE_SKINNED_MESH_NON_ROOT` warning and one unused-UV info. Parent/root instance behavior needs review. [Actual browser smoke](../mirelle-clean-base-20261024/browser-verification.json): 45 roster entries, 48 bones, ten clips, 50 finite-transform seek samples, no exceptions, RTX 3060 WebGL. [Screenshot](../mirelle-clean-base-20261024/backoffice-inspector.png). These checks do not clear deformation/contact/transition/mirrored-team/performance gates.

## Next production work

1. Correct shoulder/elbow topology, weights and axial orientation on the raw rig. Compare retained stages and pass isolated controlled limb bends before motion polish. Do not hide failures with outfits or weaker validation.
2. Polish or re-author locomotion, Attack/Cast/Hit and Death. Match game event timings; validate planted soles, hand clearance, stride speed, loops and transitions.
3. Densely inspect the exact exported/reloaded GLB across whole clips. Resolve the parent warning and test independent instances, mirrored teams, movement roots, pause, seeking and playback rates in the actual Babylon match scene.
4. Complete artistic review, measured device/scene budget, production inspector packaging and reproducible export manifest. Publish only after qualification; outfit fitting follows.

## Software checks

- `npm run check:game`: 553 passed, 22 explicitly skipped deleted binary fixtures; three simulation checks, design/TypeScript pass. Build completes with the existing bundle-size warning.
- Relevant API regression suite: 57 passed/1,710 assertions. New reset/source-epoch and owner access/hash verification: two passed/15 assertions.
- Ordinary worker `teamfight-online-worker:avatar-fresh-start-v1`: healthy, all 254 source hashes match; rules hash `c46b7623210d7f756c5d67473746a19261d1d087140373cbc027995066a161c8`. Updated with zero active matches and unchanged catalog definitions; rooms restarted. Frozen ML runner/model/rewards untouched.
