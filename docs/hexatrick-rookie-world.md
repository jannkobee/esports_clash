# Rookie world and bot management — 8 November 2026

This extends the owner's global competition request. The latest instruction is to strengthen bot club management, generate original IGNs, remove direct prospect signing, remove legacy elite players from active rosters, start players weak and give every active player a nationality.

## Implemented and activated

- `PlayerIgnGenerator` creates original pronounceable gamer names from stable identity entropy. Admission checks name collisions against all current/retired people and reserves catalog aliases. UUIDs, audit sequence numbers and pro names are not used as the displayed IGN. Original catalog/parody aliases remain in immutable source definitions and retired history.
- `WorldPlayerProfiles` stores each person's own birth nationality, adult birth date, base skills, wage, potential and training baseline. Catalog records supply role/archetype compatibility; they no longer supply elite attributes to world rookies. Starters/scouts begin at **18–36** internally (1–3/10); academy graduates begin at **15–32**. All start without elite trophies, signature bonuses or evolved-card levels. New world allocations leave the unsigned senior-coach slot empty and use the engine neutral baseline.
- Verified match training already posted by the weekly server process now changes effective skills. Steps grow as `floor(sqrt(earned_xp / 40))`, capped by individual potential. Prior XP is retained as the reset baseline; it is not silently converted into elite rookie skills. Transfers retain identity, nationality and accumulated development.
- Each scheduled allocation pins the person's name, nationality and actual attributes. `worldPlayerProfile.ts` validates and consumes that snapshot in the trusted adapter. Historical plans retain their original behavior. The inherited source/catalog, learned controllers, replay validation and match settlement remain unchanged.
- The prospect-signing button is removed. The corresponding HTTP operation rejects direct non-academy signing with 410. Human recruitment uses auctions or the optional paid youth academy. Academy opening cost, coach salary, first-week gate and weekly promotion limit remain enforced.
- Bot reviews pay due payroll, protect **four weeks of wages**, improve legally compatible lineups using each person's real skills, buy needed depth or a material upgrade, cap bids at **15% of spendable money** and use ordinary escrow. Owning another person with the same role archetype does not make a target a duplicate. Reviews can fund an academy with twelve weeks of coach cover or close it under payroll pressure. Surplus sales protect the starting five. Recorded review plans and unique 15-minute receipts prevent replayed management actions. Bots can enter actual eligible scheduled events with replaceable open places.
- Official Squad and Training read server-owned people. The local prototype roster/evolution tools are removed from the ordinary Squad navigation. Training displays actual seven-skill values, nationality and earned-XP thresholds. Club Home, auctions, Avatarpedia directories/articles and player cards show nationality as a factual field, without regional chips.

## Safe migration and operational proof

Migration `2026_11_08_000012_create_rookie_world_profiles.php` adds profile/nationality/retirement columns, an explicit activation record and persistent bot management plans. Generated birth nationality has server provenance and does not require fabricating a human verifier. Existing verified eligibility and historical commitments are retained.

`world:rookies` produces a read-only report. `world:rookies --activate` checks the worker's profile capability, locks catalog/world admission, refuses active matches/matchmaking or current national squad registrations, closes stale auctions with unique bid-refund references, retires canonical legacy people and replaces their active contracts with fresh weak players. Historical IDs, aliases, reports, training records and ledger entries are preserved. Unallocated editable club orders are updated to the replacement UUIDs. Activation is idempotent.

A pre-reset PostgreSQL backup is retained in ignored `.local-tools/matchday-rehearsal/hexatrick-rookies-pre-reset-20261108.dump` (7,526,431 bytes). The migration and `world-rookies-20261108` worker were deployed with zero active matches. That image inherits `club-pilot-20261107` and replaces only the adapter/server and adds the profile-consumption helper; no model generation, ML runner or avatar qualification service was changed.

Actual reset result: **6 legacy people retired, 6 weak replacements, 222 existing fictional people given rookie profiles, 228 active players**. All 33 pre-reset auctions were closed; none had a held bid requiring a refund. The subsequent live read verified **228 distinct IGNs, zero active legacy players, zero missing nationalities, nine represented countries and all active skill values between 18 and 36**. Public player articles resolved one current contract. Example observed names included Jirer, Lisyeth, Vofek, Seryior and Baezuno.

Container approval initially failed because automatic review hit a usage limit. Work continued with local isolated tests; a later normally reviewed request succeeded. The rollout was then completed through the approved Docker commands, without bypassing the review mechanism.

The first actual post-reset management window (07:30 Manila) completed all 32 bot plans, opened 32 paid academies and published 32 actual auctions. Five bid-hold ledger events were recorded across three auctions with leading bids. The observed default queue was empty, with no failures in the checked hour. These were real management actions using the ordinary money/transfer services.

New manager admission only takes over an available Tier 5 bot club whose entire active roster is still within the rookie strength ceiling. Otherwise the manager receives fresh weak starters. Takeovers queue a bounded replenishment of the bot pool, preserving existing team history and financial commitments.

## Verification

- Local isolated Laravel suites: **54 tests, 15,620 assertions passed** across world-player, global competition and existing online behavior. Tests cover generated IGN format/variety and uniqueness, weak skills/country, earned progression, immutable allocation snapshots, archived legacy records, capability refusal, paid academy gates, bot review idempotence/payroll protection, trained-person bidding and reset refunds.
- `npm run check:game`: **615 passed, 22 pre-existing skips**, plus all **3 simulation checks** and TypeScript. This includes four new profile-adapter checks. The protected Cardrel source-alias check remains green.
- Production build passes. Existing large-chunk warnings remain.
- Live API checks verify weak public profiles, nationality, the active directory count and single current ownership.

This does not establish a completed live match with the new rookie population, balance calibration across a full year or million-club worker throughput. Those limits are separate from the successful data reset, API verification and automated pipeline/adapter checks. The existing trusted worker remains a constrained single-match deployment.
