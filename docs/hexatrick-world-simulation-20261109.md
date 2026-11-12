# Local character simulation

Active implementation record, 9 November 2026. The owner asked to replace the narration dependency with an engine that does not rely on AI. This supersedes the cloud activation direction in the retained [Wire voices record](hexatrick-world-voices-20261109.md). The engine is ordinary backend application logic; the Colab-only 3D generation/rigging/animation boundary is unchanged.

## Active behavior

WorldNarration is now a compatibility entry point into WorldVoiceSimulation. Its active implementation has no HTTP client, model endpoint, API key lookup or provider fallback. Config and compose no longer pass narration credentials to the application. Private keys and historical provider-attempt rows were preserved. The prior billing-error pause was not cleared and no rejected external request was retried.

The simulation separates choosing an action from expressing it:

- WorldSocialMind derives stable expression, curiosity, caution, teamwork and ambition from permanent identity and the player's recorded primary/secondary personalities. Manager social traits inherit their existing management preferences. Current goals, mood, interests, relevance, familiarity, topic fatigue and recent speech influence utility scores. Mood decays toward a baseline; observed events change it. Accepted results can raise/lower a participating club member's confidence using the actual winning side. This is stateful simulation, not a trained controller.
- WorldVoiceSimulation considers current public event sources and relevant people. It prioritizes personal career events, current club context, patch notes mentioning the player's actual role, professional interests and actual fixture appointments. Referees/observers need a recorded appointment. Human-controlled organizations/managers and the game/tournament publishers cannot be impersonated by the reaction engine. Manager automation ends when their club becomes human-controlled. Current organizer ownership is checked directly from the organizer record for listing and publishing, including a handover.
- WorldVoiceGrammar composes a frame, goal-specific noun phrase, speech act and any necessary announcement qualifier. Questions, analysis, support, caution, resolve, observation and proposed content discussions are available. The source, goal and personality influence the result. New player signings can refer to their actual current club when the source and membership agree. Announced updates stay hypothetical. Proposed discussions do not assert that a video/stream exists.
- Memories persist the actual source, topic, chosen goal/intent, salience, outcome, composition and body hash. Silence is a valid recorded observation. Interests and goals evolve with exposure. Relationship records count observed encounters and attention toward actual player/club/tournament identities; they do not invent personal friendships or feuds.
- Author cooldowns, lexical similarity checks, topic fatigue, source limits and an attention penalty for recently dominant professions reduce repetition. They do not guarantee unlimited novel prose. The language is a finite authored grammar, and long-run style/semantic diversity still need play review.

No simulation reaction creates a match, advances a fixture, invents statistics, changes an auction, moves money, changes a player/coach's combat attributes or deploys a balance update. Human managers still make their own club decisions. Actual management continues through its existing legal market/staff/fixture services. Frozen ML/Colab/3D evidence and historical results remain protected.

## Sources and limits

The five-minute `world:voices` task admits missing identities and queues a local cycle. A cycle considers at most 40 recent factual sources from the previous two days, bounded professional/player candidate pools, at most 12 decisions and at most three new posts. Default successful-publication budgets are 18/hour, 144/UTC day, four per source, and one per author per eight hours. An empty or irrelevant world does not produce filler to meet those budgets. Existing media coverage and human-written posts keep their own limits.

Hidden records, generated reactions, community chatter, launch simulations and the statistical exhibition cannot become factual narration sources. Topics derive from actual identity IDs and event categories. Source excerpts stay exact in retained facts; a separate `source_quote_display` projects embedded machine timestamps into readable Manila dates in the UI. Reactions show the triggering event excerpt and link to its post.

Player profiles expose a short current-focus/disposition projection without exposing internal scoring or private orders. World Desk uses `narration.mode=simulation` and the local enabled/disabled status. Owner operations show local decisions/posts instead of API-call counts. The Guide and account finder describe current people/jobs, and the backend makes the no-provider requirement explicit.

## Configuration and persistence

Additive migration `2026_11_09_000015_world_voice_simulation` creates:

- `world_voice_states`: stable traits, current goals, mood and interests.
- `world_voice_memories`: source-bound observations and publication outcomes; account/source uniqueness prevents duplicate processing.
- `world_voice_relationships`: evidence-counted attention toward actual entities.

Use these optional environment settings; no model setup is needed:

```dotenv
WORLD_VOICES_ENABLED=true
WORLD_VOICES_DAILY_POSTS=144
```

The retired `WORLD_NARRATION_ENABLED` flag was set false in the private development environment; the remaining old provider keys are unused. Changing old cloud settings cannot select a model through this engine. The inherited GenerateWorldVoice job name remains compatible with queues, while its unique key and implementation now identify the simulation. Source-bound historical provider failures are retained separately and are not counted as local post attempts.

## Verification and limits

- Backup before migration: `.local-tools/hexatrick-before-local-voices-20261109.dump`, 10,782,782 bytes. Migration 000015 applied successfully.
- Zero active online matches were confirmed before refreshing only API/default worker/scheduler. Match, history, ML and avatar workers were not refreshed for this change.
- A real local cycle returned three observations/three publications. Subsequent observations confirmed twelve retained memories, twelve character states and 24 attention relationships at that checkpoint. The public same-origin API returned `narration={status:enabled,mode:simulation}`, source-linked reactions and current profile focus. Retained external-provider attempts remained exactly three: the prior two OpenAI 429 failures and one Gemini 402 failure. No external narration request was added.
- Initial live text exposed awkward phrase composition. Noun-phrase/act agreement, comma capitalization, source context and club-specific framing were refined for future posts. Those early samples remain retained evidence; they were not silently rewritten as better outputs. Sampled later reactions refer to their actual club/source and current goal, but are not a long-run prose-quality pass.
- `WorldVoicesTest` passed **23 tests / 111 assertions**, using the existing guarded in-memory database and `Http::preventStrayRequests`. Coverage includes absence of cloud dependencies, old-backoff independence, idempotence, traits/attention, goal/mood changes, silence, cooldowns, limits, profession saturation, actual-role relevance, both appointment denial and an accepted appointment, evidence-counted familiarity, future player admission, human control, ownership handover, source isolation, readable/exact evidence, shared World Desk and match-patch announcement safeguards.
- Required `npm run check:game` passed: 615 passed, 22 skipped, plus all three match simulations and TypeScript. Final production build passed with the existing large-bundle warning. The earlier unrelated obsolete IGN-casing assertion remains historical; no approved names were changed to satisfy it.
- Full desktop/mobile interaction and 50,000-club throughput remain unqualified. The simulation processes bounded work and stores real state, but the current admission size and short live samples do not establish production scale or indefinitely natural dialogue. Existing combat/mechanical/ranking/qualification invariants remain unchanged.
