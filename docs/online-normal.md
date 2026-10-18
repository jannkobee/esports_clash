# Trusted online Normal preview

Implemented on 2026-10-18 after the owner approved the next milestone in `global-evolution-roadmap.md`. Local Docker is the deployment target; no Vercel or public launch.

Open http://localhost:8088 and select **Online Normal**. Sign in to an account, save an eligible avatar lineup, and find an opponent. Another authenticated owner must queue. Two separate browser profiles can exercise the local preview. The server issues five starter Player Card instances once per account. Existing browser collections and cloud-save archives do not establish trusted ownership.

## Authority and persistence

Laravel owns card instances, club revisions, FIFO Normal tickets, distinct participants, immutable allocations and final results. Clients submit only owned instance IDs and avatar preferences. Card attributes come from the exported original definitions; neither IQ nor personality becomes a combat-stat multiplier. The preview uses a fixed catalog coach and baseline AI with empty adaptive memory. No failed learned model is served.

`infrastructure/online/export-catalog.mjs` exports the actual cards, avatars and coaches and hashes the catalog and game source. An allocation pins those versions, observation schema, baseline policy and random seed. `online:install-catalog` locks allocation against activation and refuses to replace the catalog/rules manifest while allocated/running matches exist. It also refuses to replace card definitions when owned instances exist until a reviewed migration is provided. Deployments must drain online matches before replacing this single-version worker. A future rolling deployment requires routing to retained worker versions.

The separate private `match-worker` executes the existing live `AramMatchView` rules through a development-only, paused/renderless bridge. It owns fixed 30 Hz simulation steps, RNG, combat and the actual Nexus finish. This deliberately reuses the live executor rather than relabeling the simpler Node simulator. It is an intermediate architecture, not a completed standalone engine extraction. One worker runs one match at a time; other allocations wait durably.

Every half simulation second produces a numbered, gzip-compressed full snapshot. The worker stores allocations, frames, latest state and completion in the `online-matches` volume. Recovery replays the same seed to the saved simulation time and checks the complete state fingerprint before advancing. Divergence fails the match without inventing a result. Laravel's scheduled `online:recover` restores polling. Queue locks and unique pending jobs bound duplicate polling; completed results are immutable and repeated identical settlement is idempotent.

Authenticated participants obtain a one-minute, single-use grant. Only its hash is stored; the browser sends the grant as the first WebSocket message, never in a URL. Private worker authentication is separate from training credentials. The worker's HTTP/WebSocket ports are internal to Docker; nginx exposes `/live`. Participant authorization also guards replay. These spectator snapshots contain the observed full world for the two owners; they are not the fog-restricted observation contract required by later learned competitive policies.

`OnlineMatchViewer` renders received frames with the existing Three renderer and Canvas fallback. Interpolation only changes display positions between received states. Browser closure cannot stop the trusted clock. Reconnection receives the latest full baseline; previous recorded events are included and saved snapshots can be retrieved by sequence. The preview has a snapshot cursor, not a polished replay timeline or production bandwidth protocol.

Completion comes from the worker's real report and terminal Nexus state. Laravel verifies allocated seed, versions, ordered card/avatar draft and winner, including existing red-Nexus-first terminal ordering. The browser-uploaded match archive endpoints remain separate and cannot settle these matches. No global Rating, currency, pack entitlements or progression is awarded.

## Deployment and verification

The additive online migration preserves the existing database. A PostgreSQL custom-format backup was restored into a temporary database and its owner/run counts checked before the migration; only that temporary restore database was removed. Local backups and verification-account credentials are ignored under `.local-tools`.

```powershell
node --experimental-strip-types infrastructure/online/export-catalog.mjs
powershell -File infrastructure/evolution/setup.ps1
docker compose --env-file .env.evolution.local -f compose.evolution.yaml build api web match-worker
docker compose --env-file .env.evolution.local -f compose.evolution.yaml run --rm --no-deps api php artisan migrate --force
docker compose --env-file .env.evolution.local -f compose.evolution.yaml run --rm --no-deps api php artisan online:install-catalog
docker compose --env-file .env.evolution.local -f compose.evolution.yaml up -d --no-deps api worker scheduler match-worker web
node infrastructure/online/verify-online.mjs
```

For an existing deployment, preserve `.env.evolution.local`, database and named volumes. The online Dockerfile derives from the existing local training image; build that base during initial setup. Do not rebuild/recreate an active training runner to deploy online changes. New source hashing does not rewrite the running study's frozen image/evidence.

The end-to-end verifier administratively provisions two clearly named, ordinary local test accounts on `example.com`; their random credentials stay in an ignored file. It does not weaken production registration's DNS checks. It exercises the production web bundle in two isolated browser contexts, private grants, matching fingerprints, browser closure/rejoin, full termination, consistent persisted results and first/terminal replay. It blocks foreign ownership, privileged Evolution access and forged browser completion. Temporary login tokens are revoked. This protocol test explicitly disables WebGL and exercises the production Canvas fallback: two simultaneous software-GL viewers saturated the two-CPU test container and delayed grant/stream processing. `online-normal-live.png` separately captures the actual Three view, including that interrupted connection; it is visual evidence, not a performance or successful-stream claim.

`node infrastructure/online/verify-recovery.mjs` performs a real active-worker restart and records the resumed allocation/sequence in `online-normal-recovery.json`. The recorded run advanced from sequence 968 (483.5 seconds) to 974 (486.5 seconds) after a 4.724-second restart/replay check. The training runner was untouched. `capture-online.mjs` can capture the live verification browser for visual review.

Required validation passed: **436 game tests, three deterministic simulations, TypeScript, production build and 21 API tests / 123 assertions**. The build retains the existing bundle-size advisory. The real two-account match completed at 632.5667 simulation seconds with red destroying the blue Nexus, sequence 1267. Both browsers shared 375 identical fingerprints; closing/rejoining, actual worker seed recovery, ownership/privilege/forged-result rejection, first/terminal replay and phone width 390/390 with no alerts passed. See `online-normal-verification.json`. The initial timing assertion and software-GL protocol attempt were not counted as successes.

`node infrastructure/online/verify-persistence.mjs` restarted API, queue and match-worker after completion. Both clubs/card-instance IDs, completed status/sequence, result hash and terminal replay fingerprint survived unchanged (`online-normal-persistence.json`). The ML runner was untouched.

Ignored backups now include the pre/post migration PostgreSQL dumps, a durable training artifact snapshot (8,741,972 bytes; restored five run plans / 409 files) and the completed online volume (26,080,671 bytes; restored all 1267 frames and the identical terminal fingerprint). Training backup excludes transient browser profiles, symlinks and temporary writes. It is a live snapshot, not a synchronized cross-service point-in-time recovery guarantee. Temporary restore directories were removed; live volumes remain intact.

Backend tests use in-memory SQLite with environment overrides and a persistent-database guard before application bootstrap. Tests preserved the three users and five study records; both verification accounts retained exactly five cards. The final deployment snapshot additionally includes the owner's separate five-card starter grant (15 total), with no duplicated grants. Never run `migrate:fresh` against the deployed database.

## Next scope

The owner's updated priority is to finish the native Laravel dashboard relocation (now deployed at localhost:8089/evolution), then address the queued [ML speed/quality/memory/storage milestone](ml-optimization-milestone.md). After that comes the authoritative free wallet/immutable ledger and existing pack algorithm, with transactional ownership/progression and published odds. No paid checkout. Preserve existing duplicate upgrades and separate recycling semantics. Then add global Ranked settlement once competitive normalization and version compatibility are explicitly defined. The continuous training study and balance-review workflow remain separate: a configurable 48-hour review, manual approval/decline and a conservative keep-current delegate; validated alternative mechanical patches and release activation remain later work.

Remaining limits include one local region, a single match executor, fixed coach, no online pick/ban phase, no ranked rewards, no legacy paid-ownership import, no active-version routing, no load/physical-device performance claim, and no production moderation/email-verification system. Catalog/card-definition migrations must preserve owned instances before future catalog replacement. This preview is not a global commercial launch.
