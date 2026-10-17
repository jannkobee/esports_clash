# Player card presentation — 2026-10-17

The user requested realistic, attractive player cards alongside the ML collection expansion. The shared `CardComponent.tsx` now uses studio-style fictional player portraits, metallic tier frames, a prominent overall rating, role/origin, full attribute labels, signature avatars, personality chips and level/XP progress. Compact cards retain overall, identity, role, origin and three scouting attributes. GOAT and evolution treatments remain distinguishable by text and symbols as well as color. Selected cards have an explicit checkmark and pressed state.

This updates squad starters/reserves, inspection, pack reveals and evolution cards through the shared component. It does not replace battle avatars. IDs, parody names (including Cardrel), internal realName, ratings, progression, personalities and combat/ML data remain unchanged. Pack copies and evolved cards retain the same portrait through the stable `avatarSvg` identity key; unknown future identities use a monogram fallback. The fixed atlas map does not depend on roster sort or temporary pack IDs.

`SquadView.tsx` inspection now supports Escape, focus trapping/restoration, backdrop close, an accessible dialog/close label and a bounded scrollable mobile panel. Card selection supports Enter/Space, visible focus and reduced-motion preferences.

## Saved asset and generation provenance

- Built-in imagegen skill/tool used, without CLI/API fallback.
- Workspace asset: `EsportsClash.Web/public/images/player-portraits-v1.png` (1254 × 1254 PNG, 2,518,790 bytes).
- One 8 × 8 atlas, one stable tile for each of 64 authored players. All faces are fictional; no source-player photographs were used.
- Identity mapping: `EsportsClash.Web/src/playerPortraits.ts`.
- Presentation: `EsportsClash.Web/src/components/CardComponent.tsx` and `player-card.css`.

Final generation prompt:

> Use case: photorealistic-natural. Asset type: ONE production portrait atlas for fictional esports player trading cards. Create a square 2048x2048 (or larger square) image that is an EXACT regular 8-column by 8-row grid, 64 equally sized square cells, absolutely no gaps, borders, rounded corners, captions, typography or watermarks. Each cell is an independent professional studio publicity photo of one distinct fictional adult male esports player, head and upper chest, shoulders visible, head centered in upper middle of its cell and entirely inside its own cell. Every cell has the SAME matte dark charcoal background and cinematic soft key light with subtle cool rim light, realistic skin pores, real hair and fabric, premium sports trading-card photography. Each player wears an unbranded black technical esports jersey, understated charcoal panels. Vary identities, jaw shapes, hairstyles, glasses, occasional headsets, facial hair and adult ages 20-35. Multinational East Asian, European, Southeast Asian, South Asian, Middle Eastern, Latin American and Black players. These are entirely fictional people, do not depict or resemble actual pro players or celebrities. All eyes camera-facing, composed confident expressions, no props or hands. Top row from left: (1) East Asian with swept black hair, (2) European short sandy hair and subtle stubble, (3) East Asian neat black hair and thin round glasses, (4) East Asian medium black hair and frameless glasses, (5) European medium brown wavy hair, (6) European dark blond side part, (7) East Asian short dark hair, (8) European short black hair and trimmed beard. Remaining 56 cells equally varied and distinct. CRITICAL geometry: exactly 8 equally sized cells across and exactly 8 down, full bleed individual dark backgrounds, aligned row/column boundaries, no composite group photographs. Natural realistic proportions, no chibi, no anime, no illustration, no text, no logos. This is a texture atlas to be displayed by CSS background-position, so perfect equal grid geometry is essential.

The generator returned 1254 square pixels rather than the requested 2048. It was visually inspected and copied unchanged into the project. Tile resolution is approximately 157 pixels; large/retina zoom can look softer. A single atlas avoids 64 separate image fetches. No external image host is required.

## Browser verification

`scripts/check-player-card-ui.mjs` uses a disposable Chrome profile against the actual application. It confirms all 64 unique portrait positions and image decoding, desktop/mobile document width, keyboard selection, reserve substitution and restoration, accessible inspector open/Escape/focus restoration, and modal fit at 390 × 844. The test resets only its disposable profile's starting slots. `docs/player-card-ui-verification.json` records the results.

Visually reviewed screenshots: `docs/player-cards-desktop.png` (1440 × 1100), `docs/player-cards-mobile.png`, `docs/player-cards-inspector-mobile.png` (390 × 844). The existing pack/evolution layouts consume the shared card; their complete purchase/evolution flows were not exercised by this UI check. No tests were added for individual CSS declarations.

An additional isolated `PackOpeningModal` presentation fixture verifies the timed walkout (visible card about 222 × 535 rendered pixels), four-card summary and mobile summary overflow/close-button bounds. No coins or owned cards were changed by this fixture. `player-card-consumer-verification.json` and the visually inspected `player-cards-pack-summary.png` record this limited presentation check. The short default desktop viewport shows a scrollable card list, retaining the collection action.
