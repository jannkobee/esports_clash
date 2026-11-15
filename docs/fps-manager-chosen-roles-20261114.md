# Manager-chosen roles — 14 November 2026

Owner clarified that players must start without a designated role. The manager determines their responsibilities according to their strengths. `/root` owns this clarification without delegates.

Removed the automatic roster-order fallback from official team assignments and public player profiles. A player's attributes and personality do not grant an intrinsic position. Profiles show T and CT as unassigned until the current manager explicitly saves those responsibilities. Partial assignments can be saved or cleared; they never cause the other positions to be filled automatically. Existing explicit manager choices and historical match allocations remain unchanged.

The tactical editor shows players' strongest attributes and offers **Suggest roles from strengths**. Suggestions use the six attributes and the team's gameplan, populate only an editable draft when the manager clicks, and require saving. They neither write player roles on page load nor restrict manual choices. Both sides of the starting five must have complete, unique assignments before matchmaking; the same completeness check applies when an official match is allocated.

AI managers make and save their own team choices. Neutral national/exhibition team setup remains a match-specific selection, rather than a permanent role on the player. Offline exhibition presets remain available; supplied manager assignments are respected, and incomplete supplied lineups are rejected rather than silently filled.

Verified with six focused backend tests (92 assertions), one focused exhibition-context regression and the frontend TypeScript check. No broad suites, asset processing, deployment or live database changes were performed for this clarification. No database schema migration is required.
