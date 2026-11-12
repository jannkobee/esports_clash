# Living world, public identity and presentation

Current implementation record, 9 November 2026. Follow the [first-deployment and Supporter runbook](hexatrick-first-deployment-and-supporters-20261109.md) to admit a new world.

## Public interface

The landing page now leads with “Start unknown. Become the headline.”, an original club-stage illustration, the actual next fixture and the Tier 5→1 climb. `ClubLoader` replaces the plain loading screen with an original animated monitor/Hexatrick H on a dark overlay; it supports reduced motion. This is CSS/SVG interface work, not new raster or 3D generation.

`hexatrick-world.css` unifies public/club graphite, crimson and warm-white styling. The Wire uses available workspace width. Region/independent competition lists and regulations are visible instead of hidden in disclosure dropdowns. Identity preset controls use selectable buttons; selective chips carry tier, role and membership context. Theme customization extends this palette through semantic account tokens.

Public club/news/market/reference displays no longer attach “Bot club” or “automated” badges to fictional people. Server control flags and audit provenance remain intact. Simulation/archive labels are deliberately preserved, so historical launch evidence cannot be mistaken for verified live results. Founding NPC clubs use original names, crests, color sets and manager identities; generated legacy random club labels and duplicate club names were refreshed with audit records. Past match plans/reports remain unchanged.

## Competition pyramid

`WorldPyramid` fills six eligible regions at Tier 1–5. New established founding rosters use raw attribute bands 74–88 / 57–73 / 40–56 / 28–39 for Tier 1–4; Tier 5 retains weak starter profiles. This foundation is labeled as an initial profile source, not invented training history. Higher divisions have wages and recorded opening capital appropriate to payroll; existing human contracts and balances are untouched. New human admissions remain Tier 5 and adoption excludes overpowered rosters and conflicting fixture locks.

Thirty weekly regional division trials are currently published, eight places each, initially four managed entrants per division. Human managers can take the remaining legal open places. Registration closes Wednesday at 18:00 Manila; Friday starts the first-round windows, staggered by region/tier. The real calendar, recovery constraints and server allocation checks remain authoritative. `world:pyramid` reviews registration/active ladder editions every 15 minutes in bounded batches. A verified champion at Tier 5–2 advances one tier through the idempotent `club_tier_movements` record. Tier 1 produces ranked evidence for official regional entry; published regional champions then feed Vanguard/Summit/Crown under the annual graph. Community fun cups remain separate and grant no training, player ratings, official points or competitive promotion.

Future regional official templates restrict eligibility to Tier 1 and rank invitation candidates within the eligible pool before bounded selection. Existing frozen annual editions were not rewritten. Official annual processing remains enabled with inaugural year 2027; an empty November 2026 official program is expected, rather than a backdated championship program. Existing launch history has its separate provenance.

Migration `2026_11_09_000009` replaces the old global `(year,tier)` tournament uniqueness with a legacy-only partial index. Modern editions retain definition/year/scope uniqueness. This permits simultaneous regional trials and community pods without weakening edition identity.

Current opponents genuinely run management jobs: squad selection, legal auctions/bids, payroll, staffing and scouting. A read-only check observed 131 distinct managed clubs reviewed in the preceding 30 minutes. This does not prove a complete verified match or promotion cycle: current trials are future scheduled, with no fabricated ladder result. Known simulation and deployment capacity limits still apply to uninterrupted weekly completion.

## IGNs and the public registry

Generated IGNs now mix short words, phonetics, compounds and occasional restrained digits, in lowercase. The style direction was informed by short and varied professional handles visible on [official T1](https://lolesports.com/en-US/teams/t1), [official Gen.G](https://lolesports.com/en-US/teams/geng), [ropz](https://www.hltv.org/player/11816/ropz) and [frozen](https://www.hltv.org/player/9960/frozen) player pages; fictional combinations are original. This is an inference about naming style, not copied names or impersonation. The migration lowercased generated existing identities, retaining player IDs and historical plans. Migration 000008 replaces global persona-name uniqueness with an indexed, advisory-lock-enforced limit of three equal lowercase IGNs. New admissions also reject same-club collisions. The directory shows the owning club to distinguish peers. Original/protected parody aliases are unchanged.

`WorldTalent` creates canonical fictional caster, analyst, streamer, host, referee, observer and manager records, expanding coverage daily with population. The public registry currently has 176 records, including seven referees and seven observers. Profiles link to actual published coverage and recorded match appointments. Crews are assigned at fixture locking with collision avoidance; old matches do not receive fictional backdated staff. Hexapedia talent search/directory/article, role filters, news bylines and crew links all read that canonical source. No private email, account token or payroll is exposed.

## Real-time and cache boundaries

The independent `world-live` gateway uses `ws`, an explicit origin/host check, heartbeat, a 1KB inbound limit, slow-client termination and no compression. It serves public topic invalidations, not private snapshots, balances or control commands. Nginx proxies `/world-live` in dev and base deployments. Gateway health and an actual revision message through the proxy were observed. The design follows the [official ws server/heartbeat guidance](https://github.com/websockets/ws).

One shared backend revision read is cached for two seconds. Public registry projections use short revision-keyed caches and bounded five-second browser memory caching; private management reads bypass shared caching. Relevant Wire/club/market/reference/fixture/finance/competition views refresh on changed topics, with slower HTTP fallback and visibility-aware reconnect. Connection ownership guards prevent stale sockets from changing the active socket during React remounts; hidden tabs stop reconnect/fallback polling. Kickoff and settlement remain backend jobs. The gateway does not solve online simulation throughput or historical performance limits.

Operational work retained `.local-tools/hexatrick-before-living-pyramid.dump` (8,875,482 bytes), applied migrations 000007–000010, started the isolated world-live service and gracefully reloaded its nginx proxy. The existing match worker/P2P service was not restarted for this gateway. Read-only inspection found no recent failed jobs and preserved the interrupted exhibition at sequence 3,472, result/hash unset. PHP/Node syntax and production builds pass; suites remain skipped and native browser UI acceptance remains unavailable.

Primary files: `WorldPyramid.php`, `WorldClubIdentity.php`, `WorldTalent.php`, `PlayerIgnGenerator.php`, `WorldPlayerIdentity.php`, `AnnualQualificationGraph.php`, `CompetitionQualification.php`, `WorldRevisionController.php`, `worldLiveServer.mjs`, `world-live-gateway.mjs`, `worldLive.ts`, `LandingPage.tsx`, `ClubLoader.tsx`, `Hexapedia.tsx`, `CompetitionHub.tsx`, `ClubIdentityEditor.tsx` and final theme styles.
