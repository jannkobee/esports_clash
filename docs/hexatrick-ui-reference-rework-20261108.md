# Transfer Exchange, The Wire and Hexapedia rework

8 November 2026, Asia/Manila. The owner supplied screenshots and requested a presentation and navigation pass. No Arena, learning, Colab, asset qualification or auction settlement rules changed.

## Delivered interface

- **Transfer Exchange:** separate Auctions, Sell a player, Direct trades and Youth academy sections. The balance strip describes actual auction/reserve counts. Removed the academy pricing recommendation from the product interface; live fees remain unchanged.
- **Selling:** an eligible-reserve picker, portrait/profile preview, plain seven-attribute columns, current wage, 24-hour terms, opening-price field and named publish action. A stale/ineligible selection is cleared instead of silently switching to a different player. Squad links into this same sell desk with the selected person.
- **Bidding:** compact auction rows replace the repeated card wall. Only one bid desk opens at a time, showing the current minimum, available money, currency field, next-price shortcut and local feedback. Leading bidders cannot accidentally raise their own bid through this interface. Server eligibility and escrow remain authoritative.
- **Filters:** balanced search, role, every displayed skill band, nationality, closing/price/skill/name sorting, own-listing/leading-bid views and clear filters. Skill filters use the actual band function, including the rookie population.
- **The Wire:** journal masthead, measured article width, topics, collapsed club composer, distinct media-desk marks, readable stories, contextual recording links and a sidebar for desk profiles/world links/moderation. Reply counts update after posting/removal; replies can be refreshed. Existing permissions remain.
- **World activity and club summary:** added missing layout styles. Activity has its own class instead of colliding with the precise-event log. Crest, actor, timestamp, message and links align in rows. Summary labels/values align in a ledger, and panel headings no longer spread their title away from its leading icon.

## Hexapedia organization and corrections

Hexapedia is the single outer reference destination. The duplicate Encyclopedia/Sparring opponents/laboratory/catalog switcher was removed. Laboratory and catalog now render inside Hexapedia resources at #codex/laboratory and #codex/catalog, preserving the existing tools and asset gates. The guide has its own #codex/guide tab. Historical sparring source and unrelated gameplay state were not deleted.

The main UI component/style are now Hexapedia.tsx and hexapedia.css. The avatarpedia.ts helper, API paths and legacy links remain compatibility boundaries.

The guide has 14 chapters: first matchday, players/attributes, lineup/draft, staff, fixtures, ratings/form, training, money, transfers, academy, circuit, nations, living world and reference records. It uses current handbook, rookie-world, calendar and lifecycle documents, checked against code. It documents the actual nonuniform skill bands, XP thresholds 40/160/360/640, pinned bonuses, paid staff terms, real calendar and statistical-exhibition distinction. Older plans are not presented as implemented features.

Specific bugs corrected:

1. AppRouter was rewriting signed-in canonical nested reference URLs to #codex. Only legacy aliases are normalized now; directories, articles and resource tabs retain their destination.
2. Authentication preserves resource routes and allowlisted market tab/player links. Explicit workspace URLs take precedence over a stale practice-session flag. Reference-to-Arena links retain the match UUID in the URL.
3. Missing/invalid dates display an announcement placeholder instead of throwing.
4. Tournament facts use published capacity, stages, dates and open-tier labels instead of describing every event as a four-club semifinal bracket.
5. Embedded edition/national pages have real overview/source anchors instead of links to nonexistent legacy sections.
6. Sponsor association lookup includes every published sponsor ID, rather than only the first.
7. Homepage league tables select published regional-league editions; rehearsal fixtures are not promoted to league standings. Historical records remain untouched. Removed the invented wins-times-three column.
8. Wire responses include the linked match's public status, so interrupted coverage links are named correctly. Old broadcast announcements are presented as announcements rather than current-live claims.

## Source boundaries

New components: TransferAuctionBoard.tsx, ReserveTransferListing.tsx, NewsFeed.tsx and GameGuide.tsx, with dedicated styles. WorldMedia.tsx retains broadcasts/archive and re-exports NewsFeed for existing consumers. Market actions still use existing authenticated services.

Backend changes are public read projections in AvatarpediaService and WorldMediaController. No schema change, financial mutation, worker refresh, game execution or test fixture creation was required.

## Verification and limits

- TypeScript and production web build pass. Final log: ignored .local-tools/matchday-rehearsal/ui-rework-build.log. Existing bundle-size warnings remain.
- Touched PHP projections pass syntax checks.
- Read-only HTTP requests loaded all ten reference directories and a sample article from each. Observed counts: tournaments 3, teams 35, nations 9, players 228, coaches 3, avatars 45, items 49, releases 2, organizers 3, sponsors 2.
- The homepage no longer returns a rehearsal league table. Wire returns 25 stories, three editorial desks and an interrupted status on the relevant recording. The local app returns HTTP 200.
- Automated suites remain deferred. No bids, listings, posts, replies or reports were submitted on the owner's behalf.
- Browser/native access was unavailable (missing browser host/native pipe). Responsive rules are implemented, but no fresh rendered desktop/mobile or authenticated interaction acceptance is claimed.
- This does not claim every possible Hexapedia defect, unfinished gameplay, full-year operation, regional currency or 3D qualification is complete.
