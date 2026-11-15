# Adaptive execute/retake routes and released utility trails (14 November 2026)

Owner reported the unused narrow B market/fountain passage, predictable execute/retake movement, and trajectory lines appearing during pin pull. `/root` owns map navigation, live decision integration, trail rendering, focused regressions and this handoff; no delegates. Existing six attributes, manager-selected responsibilities, four personality dimensions, legal information, combat mechanics and asset boundaries are preserved.

## Passage

The gap between the yellow market house and produce stall is physically traversable, but the coarse two-metre grid omitted it. Its canopy posts also make integer X17 samples fail clearance between otherwise walkable sample points. Added a fine column at X16.9, Z16..23, with clear links to the street at (18,16) and (18,24). The northern mouth bends around the flower stall. Shared capsule clearance remains authoritative; no collision was disabled or geometry widened.

Navigation now charges actual edge metres with a Euclidean A* heuristic. Charging every fine edge two metres artificially favored the longer fountain detour. Static reverse reachability and bounded geometry caches remain. Map v11 and snapshot v19 formats remain unchanged.

## Choices and coordination

Execute routes no longer come from a fixed two-lane assignment. Players consider reachable entries, the B market gap, Mid splits and site clearance positions. Their assigned responsibility, current action, personality preferences, health, entry/utility ability, gun ability/range, positioning/judgment, known threats, available time and teammate goals affect scoring. Seeded weighted choices permit variation among plausible options; short commitments stabilize movement. Reached entries drop out so an entry cannot hold forever at its chosen choke. Quiet progress is no longer overwritten by an unconditional two-second push to site centre.

Retake cover no longer uses player-slot modulo, fixed staging points or a universal 35.5-second release. Cover players choose reachable positions around the actual planted device, preserve teammate separation, clear known threats and protect the elected defuser. The existing kit/travel/channel-aware defuser election remains authoritative. A defuser's brief local wait is limited by available time and nearby support. Without a reachable cover position within the budget, cover players hold reachable space and reassess. Personal information supplies watch directions. Removed the unconditional centre-site retake flash; the ordinary evidence/safety utility consumer remains active.

New credible pressure or entry losses can interrupt an active execute. Unengaged players wake to reassess while committed fights retain their state. Regroup readiness recognizes individually chosen approaches and carrier proximity. Team calls and utility coordination phases remain: these coordinate actions, while individual routes are evaluated from current state. Authored smoke setups remain physical map knowledge. This is bounded decision logic, not a claim of learned human intuition or guaranteed novel rounds. Identical seeds and inputs reproduce decisions.

## Released utility only

Removed all preparation trajectory rendering from both Babylon and the radar. Equip, pin pull and ready states never reveal a line. Released grenades create trails only as flight elapses; removed the previous 40–50 ms forward extension. Radar tails also clamp to elapsed time since release. Existing ballistic release, animation timing, inventory and smoke physics are unchanged.

## Focused verification

- 48/48 tests passed across `fpsLiveAutonomy.test.mjs`, `fpsLiveBrain.test.mjs` and `fpsLiveDecisionPolish.test.mjs`.
- 7/7 selected navigation/retake/trajectory regressions passed across tactics, Mid-window and pro-regression tests.
- TypeScript passed (`npx.cmd tsc -b --pretty false`).

New coverage includes real actor passage traversal in both directions without jumping, continuous capsule-clear path samples, personality/strength-dependent route frequencies, stable seeded selection, threat/time constraints, a B execute using the gap despite a legacy lane instruction, player-slot-independent retake cover, execute interruption, and Babylon NullEngine trail checks through preparation/release/elapsed flight. Logs: `tmp/fps-autonomy-tests.log` and `tmp/fps-autonomy-navigation.log`. Initial failed focused checks were corrected without weakening existing gameplay assertions.

No broad suite/build rerun, browser/GPU review, long match soak, competitive qualification, deployment, migration, live data changes, asset generation or Colab processing. Unrelated pending work remains preserved.

Changed sources: `fpsLiveMap.ts`, `fpsLiveBrain.ts`, `fpsLiveSimulation.ts`, `fpsLiveViewer.ts`, `FpsLiveBroadcast.tsx`; new focused coverage: `fpsLiveAutonomy.test.mjs`.
