# Learning from kit facts instead of avatar strategy guides

The current version uses factual inputs and self-play. It has no authored per-avatar strategy or reward weights.

## Understand the information supplied to the learner

- Your own health, mana, level, cooldowns, shields, attack reach and legal commands are observations. They describe what is possible, not which action to select.
- Each own or visible target kit is represented by base stats, roles, and ability damage, cooldown, scaling, damage type and described control, protection, mobility and channel properties.
- These kit features are derived automatically from the playable catalog. A new avatar does not require a handwritten strategy entry. The engine must still implement its mechanics correctly.
- Capability flags currently summarize catalog descriptions; they are not a full simulation of every passive, combo, travel path or spell interaction. Missing observations can limit what the policy learns.

## Discover strategy through actual matches

- The policy may explore any mechanically legal choice. No role script forces a tank to engage, a support to protect or an assassin to chase.
- All avatars share the team win/loss objective and the same team-progress potential. There is no bonus for acting like an authored avatar guide, casting often or taking damage.
- Shared kit features allow experience with one ability pattern to help another. A new kit still needs exploration and evaluation; transfer is not guaranteed.
- The starting model retains basic generic command preferences from an earlier foundation. Extra kit and card inputs begin with zero weights and learn from self-play; this is not a from-scratch experiment.
- Training duration, changed decisions and optimization loss cannot establish professional skill. Independent complete matches against capable opponents must establish improvement.

## Player card identity

- A player card and an avatar are separate identities. The card supplies its stable ID, six attributes, preferred-role fit, signatures, morale, fatigue and both personality categories.
- Identities and attributes are observations, not extra damage, range, immunity or a mandatory personality script. Fictional card aliases remain presentation only.
- Avatar names and IDs identify reports; the current actor uses transferable kit facts instead of a fixed 45-avatar one-hot table. Identical kits have identical kit inputs even with a new ID.
- A shared policy can develop different decisions for different kits and card contexts. Per-card or per-avatar mastery must be measured rather than inferred from seeing that identity in training.

## Shared learning objective

- Every avatar has the same actual Nexus win/loss objective. Common discounted potential shaping reflects team deaths, structures, economy, health and objectives; the potential closes to zero at real termination.
- Confirmed health damage, objective damage and control-follow-up counters are diagnostics. No avatar-specific weights turn them into personal rewards in this version.
- Internal training scores update model weights. Club coins, card XP and prizes are separate game systems.
- Interrupted matches cannot train. Full-cap censored unrolls bootstrap and receive no fabricated terminal win. Independent qualification still requires complete fresh matched games.
