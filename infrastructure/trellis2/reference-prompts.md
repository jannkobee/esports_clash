# Initial multi-avatar reference images

Generated with the built-in image-generation tool. Assets are copied into this repository; no project link depends on the tool's external save directory. Each is a newly generated concept, not a qualified 3D model or an automatic live release. Prompt details below preserve catalog identity. Human visual review remains necessary, especially nine-tail count/visibility, armor clearance, full-body framing and equipment occlusion.

Common prompt constraints: original stylized MOBA character; full body and all equipment with generous margins; relaxed A stance, near-frontal/three-quarter view; coherent anatomy and attached equipment; transparent RGBA background; no text, floor, detached particles or effects; single-image TRELLIS reconstruction input. Do not copy a recognizable existing game character.

- **Dawnna** (`references/dawnna-v1.png`): original female solar tank knight, warm brown skin #b9805d, auburn hair #8f4b2c, ivory plate over amber cloth, sunburst shoulders, radiating solar crown, dawn shield and long sunblade, polished materials and readable silhouette.
- **Aiselle** (`references/aiselle-v1.png`): original female frost archer, pale skin #e3c7b4, silver-white hair #e5edf4, midnight quilted winter coat, ice-blue trim, silver braid, split winter cape, swept crystal longbow separated from torso, attached arrow quiver. Follow-up background-extraction prompt: preserve the character/body/bow unchanged, remove all gray smoky backdrop, lighting halo, floor shadow and atmosphere, retain crisp edges and transparent padding.
- **Vixelle** (`references/vixelle-v1.png`): original female fox mage, warm skin #c99a7d, purple-black hair #251d35, pointed ears, nine distinct fanned white-tipped tails, rose wrap jacket, pearl skirt panels, dark thigh boots, foxfire pearl held in hand. Generated tail anatomy/count still needs inspection and qualification; this is a candidate image.
- **Arsenaldo** (`references/arsenaldo-v1.png`): earlier neutral full-body blond elemental mage reference based on the older in-game appearance. Navy, ivory, burgundy and brass, no floating spell orbs. It does not supersede the owner's supplied live GLB.

All remaining avatars receive catalog-derived prompts in the Laravel studio. Their images are honestly marked missing until generated/uploaded. These initial built-in-tool calls do not configure an unattended backend image provider.

Additional original concepts generated with the same built-in tool and common full-body/transparent constraints:

- **Gritlock** (`references/gritlock-v1.png`): broad bearded male gunner, weathered leather trench coat, brass ammunition bandolier and a seismic double-barrel shotgun.
- **Vanta** (`references/vanta-v1.png`): lean masked male assassin, charcoal lamellar armor/crimson seams, twin attached forearm blades and back-mounted shuriken.
- **Primate Minister** (`references/primate-minister-v1.png`): recognizable simian fighter with brown fur, long tail, branch/leaf crown, bark-gold armor and a thick jade-ended staff.

Exact prompts for these three are retained in `reference-prompts-generated.json` and the versioned reference index. They are candidate references, not qualified animated assets.
