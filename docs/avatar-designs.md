# Avatar design roster — 2026-10-17

The user requested a design for each avatar after the live 3D foundation. All 45 current avatars now have explicit art direction and individual procedural models used in the arena and the Avatars & Lore model studio. These are original code-built meshes; no external character assets or generated mockups are used.

Open **Avatars & Lore**, select an avatar, and use its model studio to drag/rotate, inspect idle/walk/attack/cast poses, animate, or reset. One preview renderer is reused across selections. Motion starts paused, offscreen animation stops, reduced-motion changes stop animation, and artwork remains available if WebGL is unavailable. The mobile studio stacks its controls beneath the model.

The design registry is `EsportsClash.Web/src/avatarDesigns.ts`. Actual models and shared geometry/material ownership are in `src/threeAvatarModels.ts`; `threeArenaScene.ts` mounts them as visual actors. `threeAvatarPreview.ts` and `components/AvatarModelPreview.tsx` use the same builder for inspection. The roster below follows current live ability kits, including poison/support Glimmerick, nature mage Fernanda, rhythm frog Basso Croak and void mage Midnight Equation.

[All 45 actual models](avatar-designs-roster.png) · [Desktop studio](avatar-designs-studio.png) · [Phone studio](avatar-designs-studio-mobile.png) · [Live arena](avatar-designs-arena-desktop.png)

## Implementation and verification

- Models use explicit stable IDs, body shapes, skin/hair/cloth materials, equipment and signature ornaments rather than role-based recoloring or a name hash. Colors follow authored avatar palettes; card rating and IQ never affect artwork dimensions or combat geometry.
- Shared primitives and materials plus cached meshes merged by material limit draw calls and reuse GPU geometry after respawn. Moving arms, legs, wings, rotors and orbitals keep separate transform groups. Cached resources remain reachable for complete disposal even after the last visible actor has gone.
- Animation reads simulation time and state only. Sylla's Ironclaw model follows the actual True Form timer; Arsenaldo's orbs follow the real element array; Propella's fins follow Gunship and her rotors follow Overdrive. These visual callbacks never trigger attacks or change game rules. Other per-avatar transformations and detailed skill effects remain incomplete.
- Focused tests cover all 45 authored branches, distinct geometry independent of colors, finite bounds, frozen input reads, repeated-build resource reuse, real-state form/orb/fins changes, deterministic transforms and disposal. The required game check passes 368 tests, three deterministic simulations and TypeScript.
- `scripts/check-avatar-designs.mjs` selects every avatar through the actual studio, verifies one renderer and active model, keyboard rotation, pose selection, animate/reset, mobile fit, actual WebGL loss/restoration and unmount cleanup. It exports the model sheet directly from the same builder. Results: `avatar-designs-verification.json`.
- The existing live 3D checker, now supporting `OUTPUT_PREFIX`, preserves historical evidence while recording new `avatar-designs-arena-*` artifacts. Seed 47 matches captured state/RNG and execution/opportunity audits between 3D and 2D at 30/60/90 seconds. Camera controls, three layouts, context recovery and disposal pass. This controlled comparison does not exercise every avatar's full ability kit or establish full-match/device performance.
- Protected combat, towers/well/Nexus risk, normal retreat, target legality, objective contesting, attribution, anti-oscillation, card stats and parody aliases remain authoritative in simulation. No ML candidate is promoted; the previous source/model freezes describe their historical studies and remain untouched.

## Art limits

These are stylized procedural designs, not sculpted, textured or skinned production assets. Shared faces and simple cloth/armor forms remain visible in close-up. Weapon motion uses transform groups rather than skeletal clips. Some descriptions specify a direction for later material detail, such as cloth lining, engraved runes and weathering; those details are simplified in the current mesh. Existing 2D artwork/icons and richer Canvas spell effects have not all been redesigned to match these models.

The next art stages are silhouette/material refinement, authored mesh topology/textures, skeletons and animation clips, and individual skill VFX. Full 45-avatar battle/ability combinations, physical phones and frame-time/thermal profiling remain unmeasured.

## Individual designs

| Avatar | Silhouette | Outfit | Signature feature |
| --- | --- | --- | --- |
| Dawnna | Solar shield and radiating crown | Ivory plate over amber cloth; sunburst shoulders | Dawn shield and long sunblade |
| Aiselle | Swept frost bow and split winter cape | Midnight quilted coat, ice-blue trim, silver braid | Crystal longbow and arrow quiver |
| Vixelle | Nine fanned fox tails and pointed ears | Rose wrap jacket, pearl skirt panels, dark thigh boots | Foxfire pearl and nine white-tipped tails |
| Gritlock | Broad trench coat and double-barrel shotgun | Weathered leather, brass ammunition bandolier, beard | Seismic double-barrel shotgun |
| Bessara | Asymmetric war plate and two cleavers | Crimson half-cape, exposed sword arm, silver hair crest | Paired crescent execution blades |
| Vanta | Bladed forearms and angular shadow mask | Charcoal lamellar armor with crimson seams | Twin wrist blades and back shuriken |
| Galejandro | High tied hair, wind scarf and long katana | Indigo half-robe, rope belt and single shoulder guard | Storm katana and lacquered sheath |
| Lambent | Horned lamb mask and trailing spectral wolf | Ivory fur over violet wraps and cloven greaves | Crescent spirit bow with wolf companion ornament |
| Plumeira | One sweeping fan of long feather blades | Plum feather mantle, fitted leather and silver talons | Razor-feather fan and feather knives |
| Gildan | Two rising gold feather wings and dancer stance | Open gilded vest, asymmetric feather coat and light boots | Layered herald plumage |
| Sylvan Solo | Bear-pelt hood, antler staff and heavy beard | Moss wraps, bark plates and copper animal charms | Bear shaman staff and Ironclaw true form |
| Fernanda | Branch antlers, leaf skirt and living staff | Deep forest robes, bark corset and seedpod jewelry | Forked living-oak staff |
| Glimmerick | Tall ritual mask and crooked bone staff | Violet spirit wraps, magenta sash and bone charms | Venom mask and sanctuary staff |
| Cindergent | Flame crest and two curved fire swords | Burnt-orange martial robes and brass bracers | Twin ember sabers |
| Voltaire | Round storm spirit with floating lightning drums | Teal cloud coat, copper coils and luminous eyebrows | Storm halo and lightning satellites |
| TerraByte | Segmented jade golem and square stone spear | Carved jade armor with bright fault-line inlays | Mountain remnant spear |
| Nulliver | Floating split robe, white beard and crescent blade | Violet astral panels around an open dark core | Double-ended void glaive |
| Crownfetti | Oversized elemental ring blade and stepped crown | Turquoise silk panels and engraved gold guards | Three-gem elemental hoop |
| Sootcase | Wide ash hat, long coat and ember-edged saber | Charcoal exorcist coat, parchment seals and burnt lining | Ash saber and talisman streamers |
| Sennova | Long pale locs and a shoulder-length relic cannon | White mantled coat over teal armor and heavy greaves | Oversized mist relic cannon |
| Basso Croak | Wide frog mouth, throat pouch and round drum | Marsh bandleader vest, reed collar and gold buttons | Bogbeat drum and ribbon tongue |
| Razeberry | Horned furnace torso, long claws and trailing smoke | Obsidian rib plates around a hot rose soul core | Soul furnace and raking talons |
| Quakewell | Heavy stone shoulders and enormous horizontal totem | Ochre fur, slate plates and gold seismic runes | Runic earthquake totem |
| Rotisserie | Stooped scavenger, hook arm and stitched apron | Mire-green bulk, patched leather and rusted chain | Barbed hook and hanging chain |
| Midnight Equation | Faceless floating void shell with orbital fragments | Layered violet carapace around a dark singularity | Gravitic halo and floating shards |
| Plugsy | Round riveted chassis and oversized grappling fist | Aged brass shell, dark joints and cyan power cell | Rocket fist and exposed electric coil |
| Relic Rick | Short explorer jacket and one luminous gauntlet | Blue expedition coat, satchel and bronze buckles | Celestial casting gauntlet |
| Bounty Belle | Broad privateer hat and two long pistols | Wine captain coat, cream blouse and brass epaulettes | Twin privateer flintlocks |
| Kegory | Round brewmaster with a massive strapped cask | Patched russet apron, rope harness and gold keg hoops | Oak vintage cask |
| Hooklyn | Hooded chain warden, hooked scythe and lantern | Tattered green mantle, dark ribs and pale spirit mask | Spectral hook and caged lantern |
| Arsenaldo | High split collar and three separate elemental orbs | Ivory coat over warm gold armor with long red lining | Ice, wind and fire orbital arsenal |
| Inkognito | Long ink hair, flowing sleeves and oversized brush | Petrol-blue art robes with three pigment vessels | Broad calligraphy brush and ink palette |
| Hexley | Square inventor shoulders and split hammer-cannon | Cobalt engineering plate, cream coat and copper joints | Mercury hammer with plasma barrel |
| Knuckleberry | Two giant industrial gauntlets and swept mohawk | Short magenta jacket, dark work trousers and brass plates | Paired hydraulic breaker fists |
| Boomie | Two long blue braids and oversized rocket tube | Blue utility harness, red straps and mismatch boots | Mayhem launcher and ammunition belt |
| Fizzlewing | Small hovering faerie dragon with four petal wings | Mint scales, pearl belly and cyan wing veins | Dreamrift wings and curled dragon tail |
| Wickety | Goggled rider on a broad bat with wing fingers | Scorched flight vest, fuel tank and coiled fire rope | Cinder bat mount and burning lasso |
| Hedgehoggin | Hunched beast with a dense fan of back quills | Olive pelt, scratched shoulder band and iron nose ring | Layered barbed quill carapace |
| Orbiton | Pure floating light core with concentric orbitals | Porcelain light shell with cyan harmonic rings | Five harmonic spirit satellites |
| Pixabelle | Petal hat, hooked blossom staff and moth familiar | Purple bellflower dress with lime leaves and soft boots | Briar staff and luminous moth |
| Muffleton | Closed veil helmet, upright edict and crescent quill | Indigo magistrate armor, pale scroll panels and wax seals | Floating edict tablet and silence quill |
| Stafford | Long curled tail, mist scarf and tapered longstaff | Lavender wraps, brass knee guards and tousled crest | Gold-banded mist staff |
| Primate Minister | Leaf crown, long tail and thick jade-ended staff | Bark-gold armor with living shoulder leaves | Canopy sovereign staff and branch crown |
| Kickswitch | Unarmed monk, wrapped fists and broad stone greaves | Green sleeveless tunic, yellow sash and small brass bells | Bell bracers and stone kick guards |
| Propella | Open pilot pod between two exposed lift fans | Cobalt armored skiff, orange fins and leather flight cap | Twin lift rotors and rotary flak cannon |
