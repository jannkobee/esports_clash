# Hexa Weeklies and a fair business model

8 November 2026, Asia/Manila. Owner requested optional weekly community cups for every skill tier, scaling toward 50,000 managers, with prizes and no player development, and asked for monetization proposals. These are Arena clubs, not a football conversion.

## Product and implementation

Hexa Weeklies use separate 2-, 4- or 8-club single-elimination pods grouped by the club's tier at acceptance. A week has one invitation per club. Human managers accept, decline or change their answer before Wednesday at 18:00 Manila. The first-round window opens Friday at 18:00; exact fixtures are server scheduled after the field forms, with subsequent rounds at least 24 hours apart under the existing calendar/recovery rules. First real cycle: week of November 9, closes November 11, opens November 13. No games were backdated or immediately started.

Acceptance requests placement, not a false guarantee of a legal slot. Remainders become smaller power-of-two pods; a lone entrant can receive an existing same-tier bot opponent. Each bot can occupy only one pod in the week. If there is no eligible opponent or deployment capacity, acceptance remains pending. At the cycle deadline, unplaced requests receive an explicit unplaced status. Official protected windows, recovery, roster locks and Nexus verification still apply. Stalled, interrupted or failed matches go to review; no statistical victory or future result is invented.

Prizes currently implemented: original champion cosmetic trophy and finalist cosmetic badge, retained in the club's separate Community trophy shelf. No cash value, paid entry, spendable currency, skill bonus, training, form, HGR/HNR or circuit points. This avoids inflating player-market money through bot-assisted prize farming. The owner may later choose funded, capped in-game money or sponsor-funded rewards; neither is silently enabled here. Community-organizer custom recurring series remain a later extension of the organizer tools; the current automatic weekly series is hosted by the fictional Hexa Community Collective.

`CommunityCups`, `InviteCommunityClubs` and `BuildCommunityPods` handle future cycles, indexed invitations, idempotent responses, bounded invitation batches and one small pod per job/transaction. The existing CompetitionEngine/fixture jobs handle the actual bracket and Arena games. Community matches pin a trusted progression policy into the allocated match plan. Settlement retains raw Arena performance/replay evidence but posts no training or player-rating rows. Coach draft meta excludes this family before selecting its bounded sample. Audit checks recognize intentionally empty progression records. Cosmetic awards are unique per edition/club. Existing allocated plans without this classification retain their original behavior.

Migration `2026_11_09_000006_create_community_weeklies` adds cycle, invitation and cosmetic-reward tables plus a pod lookup index. Backend routes: authenticated GET `/online/community-cups`, POST `/online/community-cups/{invitation}/response`. Frontend: Match Centre → Community cups, `#play?community=cups`, also linked from the game guide and inbox. `world:community-cups` runs every five minutes; it admits no avatar jobs and never accepts human invitations. Provisioned clubs arriving between batches can receive their invitation at the desk.

## Scaling toward 50,000 managers

Assume 50,000 participating clubs, rather than 50,000 individual roster athletes. At eight clubs per pod there are 6,250 independent cups and 43,750 best-of-one games weekly. Each club plays at most three games. A single enormous Swiss bracket would require approximately 16 rounds to distinguish an undefeated winner and creates a very different time commitment; it is unsuitable as the default weekly activity. Round robin is also unnecessarily expensive for a casual cup.

Pods are the unit of scheduling, sharding, queue recovery and replay retention. Database work is bounded: invitations are unique/indexed and issued 200 clubs per job; pod formation handles at most eight clubs. A global registration page does not load all 50,000 entrants. No all-world React simulation, giant bracket DOM or client kickoff handler is introduced.

The development admission ceiling is `COMMUNITY_CUPS_MAX_PODS_PER_WEEK=128` by default, with `COMMUNITY_CUPS_ENABLED` as a pause control. Raising this to 6,250 is only a configuration change, not a throughput qualification. The current Arena has known stalls and the current deployment has a limited worker fleet. At an illustrative one worker-hour per game, 43,750 matches consume 43,750 worker-hours: about 261 continuously occupied workers over seven days, or about 608 over a 72-hour weekend, before redundancy/headroom. These are arithmetic illustrations, not measurements or a hosting quote.

Before promising uninterrupted weekly play at that size: resolve Arena stalls; measure worker CPU/memory and match duration; add regional capacity reservations, queue-age monitoring, bounded retries and stall review; validate peak concurrent admissions and database/replay storage; add per-pod scheduling fairness and match observability. Load and lifecycle suites remain deferred at the owner's request. Current code establishes the tournament structure, not a 50k operational guarantee.

## Recommended revenue model — proposal, not a payment integration

Keep the management game, weekly participation and essential reports free. Sell identity and fandom rather than roster strength:

| Offer | Illustrative PHP price | What customers receive |
| --- | ---: | --- |
| Hexatrick Supporter | 149/month | Cosmetic profile themes, enhanced trophy display, supporter mark, saved visual layouts; no exclusive competitive information |
| Team style collections | 49–299 | Original jersey patterns, crest ornaments and profile backgrounds, with ordinary club identity editing remaining free |
| Seasonal supporter collection | 199–399 | A disclosed cosmetic collection with no randomized power rewards or training boosts |
| Community organizer cosmetics | Quote after validation | Event branding, broadcast overlays and cosmetic trophies; ordinary hosting/entry remains accessible |
| Sponsorship packages | Negotiated | Clearly labeled event/broadcast placements, free entry and disclosed cosmetic rewards |

Treat those prices as hypotheses for user interviews and experiments, not researched willingness-to-pay. Start with Supporter and one polished team-style collection after the match experience is reliable. Avoid selling club pesos, players, scouting outcomes, training acceleration, roster slots or stronger staff; those would undermine the shared auction economy and fairness of weekly cups. Do not add loot-box mechanics as a shortcut to revenue.

Illustration only: 50,000 monthly active managers × 5% subscribing × PHP149 = PHP372,500 monthly gross subscription sales. At 3%, that becomes PHP223,500. Registered accounts are not monthly active users, and neither number is profit. Hosting/Arena compute, staff, support, payment fees, refunds, tax and content costs still need actual quotations and operating measurements. A large free population can lose money if game execution costs exceed supporter revenue. Track retention, conversion, churn, average revenue per paying user, cost per completed game and gross margin before buying acquisition traffic.

Steam's own guidance favors purchases that improve other players' experience and describes backend-authorized microtransaction flows: [Steamworks microtransactions](https://partner.steamgames.com/doc/features/microtransactions), [implementation guide](https://partner.steamgames.com/doc/features/microtransactions/implementation). This supports the cosmetic-first direction; it does not establish that Hexatrick is integrated with Steam or accepted for distribution.

Keep real-money entry and cash/material prizes out of the initial launch. Stripe explicitly lists games of skill with cash prizes among businesses it cannot support: [restricted-business FAQ](https://support.stripe.com/questions/prohibited-and-restricted-business-list-faqs). This is a payment-platform constraint, not a legal classification of Hexatrick. If real prizes are later desired, obtain Philippines-specific legal/payment advice and a provider's approval before designing payment and payout flows. Club PHP remains fictional in-game accounting and cannot be withdrawn or purchased through this work. No checkout, subscription charge, advertising contract or real-money prize service was enabled.

## Deployment and evidence

Database backup before additive migration: `.local-tools/hexatrick-before-community-weeklies.dump` (8,861,899 bytes). Migration applied. Initial future cycle has seven human invitations, zero accepted invitations and zero community fixtures. Recent failed-job count was zero at inspection. Those are actual read-only database observations, not a simulated acceptance test. No human was auto-entered, and no match, winner, training, rating or paid contract was generated for verification. End-to-end acceptance, bracket completion and cosmetic award behavior require later lifecycle verification; no claim of live completion is made.
