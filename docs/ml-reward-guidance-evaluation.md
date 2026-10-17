# Reward-guided action execution (2026-10-16)

The user requested the next step after a task-reward model improved predictions but changed no actions. This pass diagnoses the score-unit mismatch and tests a frozen learned ranking in actual browser replays. It does not enable a new policy in ordinary matches.

## Why the previous candidate changed nothing

`scripts/prepare-reward-guidance.mjs` records the additive-authority calculation in [ml-reward-authority-analysis.json](ml-reward-authority-analysis.json). In the previous seed-87 context, the frozen model predicts +0.082617 reward for push over farm. Multiplying this by the normal learned factor 0.04 contributes only +0.003305 utility against a 0.095002 handcrafted utility gap. The action therefore remains farm. The model was trained on task-reward contrasts; these have different units from the old bounded preference factor.

Those previous cases diagnose the issue and are not reused as fresh generalization evidence. The model's bytes and training data remain fixed.

## Decision candidate and safety boundary

`src/rewardMacroDecision.ts` evaluates only an existing eligible experimental pair. The complete `safeMacroExperiment.ts` gates retain their prior limits: health, danger, tower exposure, objective/defense activity, commitment, influence, fight survival/enemy proximity, legality, tier and maximum utility gap. The adapter also checks that the incumbent is still the canonical highest-priority utility choice. It can neither invent an action nor replace an urgent/higher-tier action.

Within that existing pair, the frozen model selects the alternate only when predicted reward advantage exceeds 0.02; otherwise it retains the incumbent. Direct reward selection is limited to the trained farm/push pair; other action pairs are unsupported. This is a fixed exploratory advantage margin, not a statistical confidence bound. The normal learned factor, ordinary live selector, risk-based tower/well/Nexus rules, damage, speeds and mechanical legality are unchanged.

`pairedMacroReplay.ts` requires an explicit reward arm and model metadata. The real arena invokes the adapter only at the exact opt-in replay checkpoint. The decision overrides one already-legal macro choice; the ordinary expiring commitment, safety interrupts and replanning continue afterward. The experimental model does not take over all later decisions.

The runner's `--reward-model` option adds a fourth thirty-second continuation: the model's actual selected action. It must reproduce the matching forced-action continuation's task events, outcomes and full captured-state fingerprint, and its assignment must reach the intended executor. Thus the test verifies a learned action running in the arena, rather than inferring a result solely from an offline chosen label.

## Fresh test plan

[ml-reward-guidance-plan.json](ml-reward-guidance-plan.json) was created exclusively before the fresh collection and locks the frozen model hash, eight new seeds 93–100, two drafts/card sets, both sides, the first safe farm/push pair, a 240-second scout cap, a thirty-second outcome window and the 0.02 advantage margin. Seeds are disjoint from all prior task-training/held-out worlds. Missing targets or invalid controls remain reported. There is no refitting, threshold tuning or automatic promotion on these worlds.

A separate known seed-87 integration fixture exercises the positive-prediction branch and is excluded from the fresh-test denominator. It is a software execution check, not new evidence of generalization.

## Results and deployment decision

The known seed-87 fixture reproduced the earlier predecision fingerprint exactly. The model chose push with predicted advantage 0.082617, the assignment reached the executor and its complete thirty-second continuation matched the forced-push arm. This verifies both the switching path and the absence of a baseline predecision trajectory change. Its task reward improved by 0.1512, but the broader rubric was mixed: more economic value accompanied lower actor health and worse team structure margin. It is not counted as a fresh success.

All eight new-seed cases passed incumbent duplicate controls and learned-arm replay validation. Every learned selection reached its intended executor and matched the full state of the corresponding forced-action continuation. There were no missing-target or invalid-replay cases.

| Seed / draft / side | Card ID | Learned action | Changed from incumbent | Task reward delta |
| --- | --- | --- | --- | ---: |
| 93 / 0 / original | `p_craps` | Farm | No | 0 |
| 94 / 0 / swapped | `p_neko` | Farm | No | 0 |
| 95 / 1 / original | `p_godson` | Farm | No | 0 |
| 96 / 1 / swapped | `p_toaster` | Farm | No | 0 |
| 97 / 0 / original | `p_bigtail` | Push | Yes | -0.18 |
| 98 / 0 / swapped | `p_craps` | Farm | No | 0 |
| 99 / 1 / original | `p_turbogamer` | Farm | No | 0 |
| 100 / 1 / swapped | `p_dns` | Farm | No | 0 |

On seed 97 the model predicted +0.082583 reward, but the chosen push missed a 75-gold camp share. Both arms gained the same 21 minion gold and had no deaths. The wider rubric also classified the learned continuation as worse: actor health was lower by 0.2100, economic value by 375 and champion damage by 261; the +48 structure margin was below the rubric's material threshold. The fresh aggregate is seven unchanged task results, one worse result, zero improvements and zero additional deaths.

**This candidate is rejected for live promotion.** Connecting the model to action execution succeeded; fresh gameplay benefit did not. The frozen model and threshold were not tuned against these results. Normal matches retain their existing decision policy and 0.04 learned factor.

The model's fitted inputs contain card identity/attributes, role, personality and resources, but omit action-specific camp distance/health, cooldown detail, lane state and push destination. The positive training case and fresh counterexample for BigTail differ in farm travel and push mode while receiving almost the same prediction. This identifies a concrete input limitation; it does not prove that adding those inputs alone will solve generalization. The reward proxy also omits some gameplay value. Further work needs action-specific context and independent training examples, followed by another untouched test set.

Evidence: [frozen test plan](ml-reward-guidance-plan.json), [collection](ml-reward-guidance-collection.json), [validated analysis](ml-reward-guidance-analysis.json), [known integration fixture](ml-reward-smoke-87-original.json). Individual fresh source filenames are recorded in the analysis.

## Verification

`npm.cmd run check:game` passed 350 game tests, three deterministic simulations and TypeScript. `npm.cmd run build` passed with the existing bundle-size warning. Focused tests cover actual card-aware switching, abstention, unsupported action pairs, legal/priority/commitment/survival/tower gates and explicit model/horizon metadata. The known integration fixture, all eight fresh four-arm browser trials, model/data hashes, outcome recomputation, script syntax and `git diff --check` passed.

The unsupported-pair rejection was made explicit after collection; all planned cases use farm/push, so their decisions are unchanged, as confirmed by re-running the analysis. The complete required checks were repeated after that restriction. No game damage, range, stats, speeds, recall/retreat, attribution, tower/well/Nexus rules, objectives, anti-oscillation or aliases were changed.

Collection uses `scripts/collect-reward-guidance.mjs`. `scripts/analyze-reward-guidance.mjs` checks model/data hashes, duplicate controls, task-reward recomputation, deterministic model selection, actual execution and the full state of the model's matching arm. Raw cases are `ml-reward-fresh-<seed>-d<draft>-<side>.json`, with separate collection and analysis artifacts.

Reproduce from `EsportsClash.Web` with disposable Vite on 5174 and CDP Chrome on 9223:

```powershell
# Preparation is exclusive; retain the existing plan after collection begins.
node --experimental-strip-types scripts/prepare-reward-guidance.mjs
$env:VITE_PORT = '5174'
node scripts/collect-reward-guidance.mjs
node --experimental-strip-types scripts/analyze-reward-guidance.mjs
```

This study measures one decision's local continuation, not a full-match policy. The authored thirty-second reward omits some gameplay value and later danger. Safety gates reduce exposure but do not guarantee that an initially safe choice remains harmless. Live promotion requires stronger evidence than this exploratory execution test.
