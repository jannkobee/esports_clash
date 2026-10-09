# Repository handoff

Read [docs/agent-handoff.md](docs/agent-handoff.md) before changing the game. It records the user's requests as a conversation and names the code that implements each decision.

Read [docs/arena-mechanics.md](docs/arena-mechanics.md) for gameplay invariants. After a gameplay or squad UI change, update both documents with the decision, affected files, verification, and remaining limits. Run `npm run check:game` and `npm run build` from `EsportsClash.Web`.

Keep `Cardrel` as the requested parody alias. Player card faces should display fictional aliases, never the source person's name. Preserve card IDs and the internal `realName` values when renaming aliases so research references and draft data remain stable.
