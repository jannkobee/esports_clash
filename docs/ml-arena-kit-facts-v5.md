# Learning from kit facts and shared outcomes

The owner corrected the earlier request for an avatar guide: handwritten playstyles can bias discovery and do not scale to future avatars. The current version uses factual kit information and self-play. The intermediate v4 strategy teacher, fitted model, guide and engineering results remain historical artifacts; they are not the default or independent performance evidence.

## Current behavior

The actor uses version 3 of the 224-input schema. Its original 48 general command features remain; two 45-element vectors describe the own and visible target kits. These contain base stats, primary/secondary roles, and each ability's damage, cooldown, scaling, damage type and described control/protection/mobility/channel properties. There is no fixed one-hot avatar roster in this version. A new playable avatar obtains the same features from its catalog fields without a handwritten strategy entry.

The remaining inputs describe card identity (four stable ID projections), attributes, personalities, signature/role fit, morale/fatigue, own cooldowns, target status and local context. Card aliases and real names are not numeric inputs. Enemy cooldowns/private economy are not supplied. Privileged world state remains training-only critic/reward information.

The default foundation is an explicit adapter of the earlier general v3 foundation. The extra input weights start at zero and acquire meaning through real self-play. This retains generic starting command preferences; it is not a from-scratch experiment or a model trained to understand every kit. The adapter does no fitting and uses no per-avatar strategy examples.

All avatars use the same `terminal-potential-v1` team win/loss and discounted team-progress potential. There are no per-avatar reward weights in the current path. Actual health damage, overkill-capped objective damage and allied follow-up during confirmed stun/root/knockup are diagnostic bookkeeping. The historical actor version 2 can still reproduce its earlier auxiliary reward; current actor version 3 neither supplies nor receives it. Internal ML scores do not mint coins, prizes or card XP.

The spectator displays the current rules, factual observations, actual ten player/card combinations and catalog ability descriptions. The report binds the exact versioned reference by SHA and separates training exposures from independent results. Neither declares mastery from loss, changed decisions or training duration.

## Compatibility and remaining limits

Actual ability effects, item builds, hit detection, terrain, costs, cooldowns, visibility, crowd control, soft avatar spacing and outer/inner/Nexus-turret/all-three-barracks/Nexus order remain game mechanics. The old authored strategic loop stays bypassed in ordinary arena play. Existing actor formats remain explicit historical comparators; source/version mismatches cannot silently substitute a different controller.

Capability flags currently summarize catalog descriptions. They do not encode the full mechanics of every passive, projectile, transformation, combo or spell interaction. Misleading descriptions and unavailable actions/observations can limit learning. A new avatar still needs a correct engine implementation, exploration and independent evaluation. Professional skill is not guaranteed by elapsed time; model capacity, training scale, opponent quality and observed results matter. No League video has been imported.

The two most recent compatible qualified historical opponents bound the authenticated 1 MiB plan envelope for larger actors. Existing independent complete-match, control-repeatability, both-side/opponent and confidence gates remain unchanged. The previous source's study and seed block remain retained and are not resumed under this version.

## Verification

Final commands, source/image hashes, actual engine transitions and local study status are recorded in the accompanying dated verification JSON and latest handoff. Engineering fixtures use known seed 47 and are excluded from fresh benefit evidence. Historical role-guided engineering results are not evidence for this factual controller.
