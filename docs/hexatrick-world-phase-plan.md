## Calendar and media continuation - 8 November 2026

See [the calendar/media rollout](hexatrick-calendar-media.md) for the January program, labeled launch archive, independent organizers, scrimmages, portraits, The Wire and Hexacast. Archive generation is still running. The next suggested phase is the daily management loop: inbox, weekly club report and actionable decisions; then player career history and richer event-driven media.

## Latest rookie-world extension

The active player reset and bot-management extension are implemented and activated. See [the rookie-world record](hexatrick-rookie-world.md).

# Latest competition extension

The owner added the global competition brief and unique-player/bot-takeover conditions. Current implementation, activation and remaining limits are in [the global competition record](hexatrick-global-competitions.md). This supersedes the earlier next-phase order below where applicable.

# Hexatrick living-world phases

The owner renamed the app to **Hexatrick**, requested a classic management/wiki interface using the supplied screenshots, and explicitly allowed bot clubs to list and bid on players. This supersedes the previous no-bot-market policy. Protected FPS rules, fictional aliases, frozen artifacts and the Colab-only avatar workflow remain in force.

## Completed foundation — navigation, identity and real club home

- Avatarpedia browsing stays in the signed-in workspace at `#codex/<category>/<id>`. Authenticated legacy `#avatarpedia/...` links normalize into that workspace. Visitors can still browse public Avatarpedia. Router, page selector, encyclopedia parser and authentication returns recognize the nested paths.
- Original hexagon/H branding, wordmark and favicon identify Hexatrick. Existing folder/service names, save keys and record IDs remain compatible.
- `classic-manager.css` supplies a centred management frame, light office panels, blue section bars, compact tables and a charcoal/olive encyclopedia. Functional reference icons and saved club crests replace generic text-only identifiers. Player/wiki base styles use cascade layers so lazy chunks cannot override the active theme.
- `ClubHome` reads the actual account-owned roster, saved five, PHP balance, academy status and fixtures. Practice Squad/training tools remain labeled and need later consolidation.

## Enabled foundation — bot management and world activity

`world:tick` dispatches one `ManageBotClub` job per bot per 15-minute UTC review window. A database receipt is unique by club/window. Market and lineup decisions commit with that receipt under the existing catalog lock. Queue uniqueness and overlap middleware provide additional protection. Reviews over 30 minutes old are skipped instead of replaying a historical backlog.

This is rule-based club management, not a new learned match controller. It uses the same catalog/ownership records that supply Avatarpedia and calls existing domain services:

1. Use weekly-limited scouting/academy intake and choose stronger legal default starters. Listed players are excluded from candidates. Fixture locks take precedence.
2. Reserve two weeks of current player wages and youth-coach salary. Available money already excludes bid holds.
3. Keep at most one open surplus listing. Only reserves can be sold. Unused roles, redundant depth, rosters over eight or cash pressure can trigger a listing while preserving the legal five. The opening request is eight weeks of catalog wage, rounded to the normal bid increment/minimum; real bids determine the final price.
4. Consider up to 100 auctions, prioritize compatible improvements or missing reserve coverage, avoid another copy of an owned definition and never bid against the club's own lead. Hold at most two leading bids and cap planned roster size at ten.
5. Bid the legal minimum. The private ceiling is at most 20% of spendable cash, additionally bounded by 125% of the last ten comparable sold prices or a twelve-week-wage fallback. These are spending limits, not a displayed appraisal. Bots receive no special grant, buyout or settlement path.
6. Enter a tier-eligible event only after human participation exists. Leave one place open during registration; existing deadline fill handles vacancies. Event registration occurs after market locks commit.

Bot and human auctions share ownership checks, bid limits, escrow, refunds, close deadlines and atomic transfer settlement. The former bot-denial assertion is updated to the new contract; the suite remains deferred by request.

`club_world_events` records actual signings, listings, bids, sold/unsold closes, bot lineup changes, entries, championships and verified results. Unique transition keys prevent duplicate feed entries. Events are written in existing action transactions where present. They contain public references and timestamps, not fabricated news or private valuation ceilings. Recruitment/transfer metadata preserves stable owned-player IDs for future career timelines. Historical records are not rewritten as new activity.

`GET /api/v1/avatarpedia/world` supplies the common public feed to Home and the encyclopedia, refreshed every 30 seconds. Unpublished club actions remain outside the public feed until the club has a tag. Account details, money balances and orders remain private.

## Local activation — 8 November 2026

The additive `2026_11_08_000007_create_club_world_activity` migration created event and review tables. A fresh local backup is retained in ignored `.local-tools/matchday-rehearsal/hexatrick-world-pre-migration-20261108.dump`. Only that migration was applied.

Before refreshing the default queue worker, zero active official matches and zero reserved default jobs were observed. Only the default club-job worker was gracefully refreshed. Online match worker images, ML runners, Colab services and avatar workers were not restarted. The first real window completed three bot reviews, published three auctions and made two tournament entries. Zero pending default jobs/recent queue failures were observed afterward. This is operational activation evidence, not a comprehensive test result.

Production build/TypeScript and PHP syntax checks pass. Automated suites and browser interaction/visual checks remain deferred at the owner's request. Existing large bundle warnings remain. New routes/theme do not inherit older browser acceptance evidence.

## Next build phase — official Squad, player careers, staff and inbox

1. **Official Squad.** Unify owned profiles, reserves, defaults and fixture orders in one account-backed screen. Move practice collections behind their own entry.
2. **Player careers.** Link each contracted player to its stable owned-player identity, verified appearances, club history and actual transfer events. Retain catalog profiles as reference/archetype pages and preserve established aliases/IDs. Do not invent past careers.
3. **Staff and youth.** Add real coach appointments/contracts, salaries and academy cohorts. Display current XP and weekly posting honestly; changing FPS attributes or training formulas is separate work.
4. **Club inbox.** Deliver persistent bid/outbid/sale, fixture deadline and academy notices to the relevant manager, with read state/preferences. Do not fabricate messages.
5. **Competition life.** Add organizer tools, published seasons and safe bot/human friendly scheduling through the fixture service. Overlapping-match expansion still depends on deferred capacity/recovery work.

This foundation enables real economic and tournament interaction. A complete social community, narrative agents, full career simulation and large-world capacity remain future work.
