# Remaining forty kits: source implementation pass, 2026-10-24

Owner: `/root`; no delegated agents. Gameplay/source/UI only. Production asset generation, rigs and appearance assembly were not performed.

Status: forty new authored dispatches, forty tactical candidate branches, shared effect lifecycles and live arena adapters are written. All 45 roster IDs are bound in the opt-in version-2 preview. None is qualified or declared complete. This is source implementation, not evidence that every mechanic works.

The owner requested no testing until the implementation pass is done. No tests, builds, typechecking, browser runs or simulations ran in this pass. The previous 560 tests and speed-parity evidence must not be cited as passing this source.

## Integration

- `v3Roster.ts`: declared cooldowns/categories, resource/mark ledgers, forty cast dispatches, delayed lifecycle, attacks/damage, voluntary travel and public-state AI candidates.
- `v3Combat.ts`: registers all 45; central start/commit/refund/recovery, device/effect caps, one-redirect projectile composition, serializable transport and input journal.
- `v3Arena.ts` / `AramMatchView.tsx`: actual damage, shield, CC, reveal and movement effects; spells can affect creeps/objectives through existing mechanical legality and attribution. Versioned runtime names suppress old name-dispatched attacks/passives; persisted `c_*` keys, catalog internal names and player-card ownership remain unchanged. The original internal name is retained as `legacyInternalName` on preview copies.
- `App.tsx`: full-roster seeded preview, optional canonical-name/title selection for each team slot, mirror choices for scenarios. Ordinary/online defaults remain unchanged.
- `v3Telegraphs.ts`: public construct geometry, orientations, activation countdowns, artillery cells/corridor, public resource/mark indications; debug presentation, not finished character VFX.
- `matchReplay.ts`: version-2 ruleset and manual tick-input journal in reports. Full saved replay restoration remains unfinished.

## Provisional engineering decisions

Costs remain 30/35/80 and base recovery 0.25s. Forty-kit cooldowns follow the supplied roster. Unspecified damage, shields, healing, projectile speed, reserves and minor durations use bounded provisional values in the handlers. They are not a polished balance sheet. Devices use a 16-per-team budget; transient effects have a separate 256-world cap, with commit headroom. Artillery shares a 40-GU escape strip and rejects geometry without a traversable strip. Travel also avoids a provisional 31-GU footprint around living structures.

Thalara's design has a bootstrap ambiguity: all nutrients come from ability hits but her initial line requires a nutrient. S1 can therefore deliver a 25-damage initial seed impact on a champion before connecting the first node; otherwise it requires an existing node. This is an explicit implementation decision, not an assertion that the supplied text specified that damage.

## Per-avatar authored inventory

All rows are **partial / untested**. The column lists authored slot names to identify the actual dispatch being worked on; names/data alone do not count as completion.

| Stable key | Original identity | P / S1 / S2 / R | Runtime | Verification |
| --- | --- | --- | --- | --- |
| `c_solana` | Solenne Vaelor ? The Sunwall Oath | Earned Daylight / Sun Dial / Pivot Order / Noon Divide | New roster handlers | Deferred |
| `c_astra` | Ivera Frostwhistle ? The Frost Resonant | Overtone / Tuning Shot / Singing Ice / Glass Rapture | New roster handlers | Deferred |
| `c_kyumi` | Mireth Lune ? The Witness of False Roads | Witness Marks / Counterpath / False Exit / Map of Might-Have-Beens | New roster handlers | Deferred |
| `c_buck` | Bramm Coil ? The Breach Marshal | Structural Survey / Anchor Ram / Brace Exchange / Tunnel Cut | New roster handlers | Deferred |
| `c_valkira` | Kael Vespera ? The Oath Ledger | Outstanding Balance / Collection Line / Witness Required / Terms of Mercy | New roster handlers | Deferred |
| `c_kage` | Nyxara Vale ? The Silhouette Thief | Blind Side / Shadow Pin / Light Theft / Total Eclipse, Partial Truth | New roster handlers | Deferred |
| `c_kazemaru` | Serrin Galecrest ? The Crosswind Cartographer | Weather Reading / Compass Slash / Tack Change / Eye of the Crosswind | New roster handlers | Deferred |
| `c_kindra` | Orin and Fen ? Keepers of the Last Lantern | Scent of Trouble / Track Lantern / Fen, Guard / Road Home | New roster handlers | Deferred |
| `c_cora` | Quillene Rook ? The Sky Loom Fletcher | Airborne Fletching / Tetherbolt / Crosswind Stitch / Harrier Net | New roster handlers | Deferred |
| `c_renn` | Aurelio Vane ? The Masquerade Marshal | Perfect Partner / Mark the Floor / Change Partners / The Grand Procession | New roster handlers | Deferred |
| `c_sylla` | Droven Bearmantle ? The Keeper of the Second Heart | Shared Heartbeat / Hark, Settle / Shelter Under Shell / Carry the Line | New roster handlers | Deferred |
| `c_tequoia` | Thalara Rootwright ? The Mycelial Architect | Spores in Soil / Root Survey / Transplant / The Living Understory | New roster handlers | Deferred |
| `c_zal` | Vesper Loom ? The Gossamer Chirurgeon | Recorded Injury / Suture Tag / Stitch Circuit / Emergency Triage | New roster handlers | Deferred |
| `c_xin` | Rux Emberchain ? The Cinder Postmaster | Return Address / Express Mail / Courier's Crossing / Dead Letter Office | New roster handlers | Deferred |
| `c_raijin` | Teslan Veyr ? The Storm Circuit | Closed Circuit / Drive Rod / Reverse Current / Brownout Protocol | First-five kernel | Deferred |
| `c_kaolin` | Joruun Jadecoil ? The Hinge Colossus | Counterweight / Raise Slab / Hinge Swing / The Great Door | New roster handlers | Deferred |
| `c_inai` | Astrax Mire ? The Distance Pilgrim | Footfall Record / Measure Out / Mile Marker / Reckoning of Roads | New roster handlers | Deferred |
| `c_qiyana` | Prismelle Cade ? The Shard Regent | Royal Refraction / Facet Screen / Claim the Angle / Coronation in Glass | New roster handlers | Deferred |
| `c_locke` | Ashkar Veilhand ? The Penitent Ember | Witness the Hurt / Ember Brand / Ash Intercession / Public Penance | New roster handlers | Deferred |
| `c_senna` | Maris Solquill ? The Reliquary Surveyor | Borrowed Sunlight / Waypoint Lantern / Twilight Survey / The People's Atlas | New roster handlers | Deferred |
| `c_largo` | Odo Bogsong ? The Reed Timekeeper | The Beat Goes On / Offbeat Drum / Syncopation / The Long Measure | New roster handlers | Deferred |
| `c_shadowfiend` | Mourn Ashwake ? The Furnace Mourner | Ash Residue / Ember Tongs / Draft Open / Second Combustion | New roster handlers | Deferred |
| `c_earthshaker` | Dolm Runesunder ? The Seismic Surveyor | Strain Lines / Tilt Plate / Pendulum Strike / Continental Drift | New roster handlers | Deferred |
| `c_mirehook` | Garruk Mawsuture ? The Jaw Foundry | Scrap Appetite / Set Jaws / Forge Drag / Factory Floor | New roster handlers | Deferred |
| `c_nullweaver` | Vesper Nullcode ? The Inertia Heretic | Unspent Momentum / Tangent Fault / Mass Argument / Borrowed Orbit | First-five kernel | Deferred |
| `c_voltgrip` | Coiljack Ampfist ? The Livewire Turnstile | Impact Audit / Turnstile Bar / Earth Clip / Inspection Grid | New roster handlers | Deferred |
| `c_aetherbolt` | Talan Slipshot ? The Archive Ballistician | Proof Mark / Set Mirror / Evidence Shot / Closed Case | New roster handlers | Deferred |
| `c_corsara` | Calixa Broadwake ? The Tidebound Privateer | Hold the Weather / Signal Buoy / Tack Across / Port Authority | New roster handlers | Deferred |
| `c_brewmaw` | Brohm Caskfall ? The Fermentation King | Pressure Reserve / Lay the Head / Repressurize / Cellar Breach | New roster handlers | Deferred |
| `c_wraithhook` | Mora Fenhook ? The Lantern Ferrier | Crossing Fees / Mooring Post / Departing Bell / The Last Crossing | First-five kernel | Deferred |
| `c_invoker` | Mirelle Vane ? The Atelier Prodigy | Pattern Memory / Pin the Hem / Recut / Pattern Book | First-five kernel | Deferred |
| `c_hwei` | Maelis Chromabloom ? The Conservationist of Ruin | Surface Memory / Unroll the Canvas / Restore the Missing / Private Exhibition | New roster handlers | Deferred |
| `c_jayce` | Axiom Rail ? The Scrapline Engineer | Gauge Check / Lay Track / Switch Engine / Terminal Delivery | New roster handlers | Deferred |
| `c_vi` | Brakka Fenn ? The Civic Enforcer | Repeat Offender / File Complaint / Right of Way / Writ Served | New roster handlers | Deferred |
| `c_jinx` | Pippa Fuseburst ? The Firework Stagehand | Cue Card / Rack and Spark / Move the Spotlight / Opening Night | New roster handlers | Deferred |
| `c_puck` | Lulla Faespring ? The Keeper of Unfinished Dreams | Drowse Ledger / Hang the Chime / Borrowed Yawn / Intermission Theater | First-five kernel | Deferred |
| `c_batrider` | Bryx Emberkite ? The Thermal Sailor | Read the Updraft / Plant Thermal / Trim Sail / Thermocline Crossing | New roster handlers | Deferred |
| `c_bristleback` | Murdle Ridgehide ? The Living Palisade | Plate Accounting / Shed a Wall / Recall Shell / Fortress Migration | New roster handlers | Deferred |
| `c_io` | Nemea Halolink ? The Choir Conductor | Audible Interval / First Note / Second Note / Chorus Arrival | New roster handlers | Deferred |
| `c_lulu` | Thimble Briarwish ? The Walking Gardener | Seedbank / Plant Shelter / Wheelbarrow Walk / Traveling Orchard | New roster handlers | Deferred |
| `c_silencer` | Sevrin Inkseal ? The Magistrate of Repetition | Case Law / Mark Jurisdiction / Appeal Granted / Precedent Review | New roster handlers | Deferred |
| `c_wukong_lol` | Koro Cloudtail ? The Aerial Polewright | Measured Landing / Plant Vault / Pole Transfer / Scaffold Crossing | New roster handlers | Deferred |
| `c_monkeyking_dota` | Bram Stonebranch ? The Canopy Regent | Old Growth / Root Column / Leaf Intercept / Kingdom of Shade | New roster handlers | Deferred |
| `c_stepstone` | Toma Bellbreak ? The Thirteenth Bell | Listen for the Stroke / Open Palm / Return Stroke / Thirteenth Bell | New roster handlers | Deferred |
| `c_skybreaker` | Ravelle Skyrake ? The Airspace Duchess | Surveyed Grid / Spotting Flare / Reposition Skiff / Designated Airspace | New roster handlers | Deferred |

## Requirements still unfinished or unqualified

- This pass has not been compiled or executed. Type/runtime errors, balance defects, missing edge cases and AI failures remain possible. Full 1x/4x equality must be re-established for version 2.
- Full 45-avatar matchup/counteraction matrices, natural full V3 games, boss-contest scenarios and long-run balance studies are pending.
- Dynamic-cover steering for all NPCs, comprehensive healing-link interception of legacy item/regeneration events, complete player interaction affordances and every transport cancellation/landing category need further implementation review. Current consent inputs and several primary interactions exist, but do not establish full mechanical fidelity.
- Full tactical blackboard/formation following and calibrated outcome prediction are unfinished. Current hero-specific candidates use public observations and bounded forecasts; intelligent mastery is unproven.
- Mirelle's real radial palette and detailed decoy animation, bespoke VFX/rigs/animations for all heroes and visual readability qualification remain unfinished.
- Missing standalone canonical identity manifest, complete non-preview UI/API migration, saved replay restoration, source-pinned compatible ML training and online deployment remain pending. No frozen studies or production assets were modified.

Next work is the deferred qualification/debugging pass, plus the listed fidelity gaps. Do not mark characters implemented/complete merely because the registry contains 45 handlers.
