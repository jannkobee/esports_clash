// Art direction uses stable avatar IDs, independently of role balance or card rating.
export type AvatarBody = 'knight' | 'scout' | 'robe' | 'brawler' | 'stone' | 'machine'
  | 'frog' | 'demon' | 'dragon' | 'wisp' | 'rider' | 'skiff' | 'hedgehog' | 'monkey';
export type AvatarDesign = {
  body: AvatarBody; width: number; height: number; skin: string; hair: string;
  silhouette: string; costume: string; signature: string;
};
const design = (body: AvatarBody, width: number, height: number, skin: string, hair: string,
  silhouette: string, costume: string, signature: string): AvatarDesign =>
  Object.freeze({ body, width, height, skin, hair, silhouette, costume, signature });

export const AVATAR_DESIGNS: Readonly<Record<string, AvatarDesign>> = Object.freeze({
  c_solana: design('knight', 15, 69, '#b9805d', '#8f4b2c', 'Solar shield and radiating crown', 'Ivory plate over amber cloth; sunburst shoulders', 'Dawn shield and long sunblade'),
  c_astra: design('scout', 10, 67, '#e3c7b4', '#e5edf4', 'Swept frost bow and split winter cape', 'Midnight quilted coat, ice-blue trim, silver braid', 'Crystal longbow and arrow quiver'),
  c_kyumi: design('robe', 10, 65, '#c99a7d', '#251d35', 'Nine fanned fox tails and pointed ears', 'Rose wrap jacket, pearl skirt panels, dark thigh boots', 'Foxfire pearl and nine white-tipped tails'),
  c_buck: design('brawler', 16, 64, '#a87555', '#38291f', 'Broad trench coat and double-barrel shotgun', 'Weathered leather, brass ammunition bandolier, beard', 'Seismic double-barrel shotgun'),
  c_valkira: design('knight', 14, 70, '#cc9a80', '#e8ded4', 'Asymmetric war plate and two cleavers', 'Crimson half-cape, exposed sword arm, silver hair crest', 'Paired crescent execution blades'),
  c_kage: design('scout', 11, 66, '#9b786b', '#18202c', 'Bladed forearms and angular shadow mask', 'Charcoal lamellar armor with crimson seams', 'Twin wrist blades and back shuriken'),
  c_kazemaru: design('scout', 11, 70, '#c38d69', '#1c2935', 'High tied hair, wind scarf and long katana', 'Indigo half-robe, rope belt and single shoulder guard', 'Storm katana and lacquered sheath'),
  c_kindra: design('scout', 10, 63, '#e4dbe7', '#dad7e6', 'Horned lamb mask and trailing spectral wolf', 'Ivory fur over violet wraps and cloven greaves', 'Crescent spirit bow with wolf companion ornament'),
  c_cora: design('scout', 10, 66, '#bf8a76', '#662f71', 'One sweeping fan of long feather blades', 'Plum feather mantle, fitted leather and silver talons', 'Razor-feather fan and feather knives'),
  c_renn: design('scout', 11, 70, '#b7855e', '#f1d58d', 'Two rising gold feather wings and dancer stance', 'Open gilded vest, asymmetric feather coat and light boots', 'Layered herald plumage'),
  c_sylla: design('brawler', 14, 68, '#b38e69', '#d1c6b1', 'Bear-pelt hood, antler staff and heavy beard', 'Moss wraps, bark plates and copper animal charms', 'Bear shaman staff and Ironclaw true form'),
  c_tequoia: design('robe', 11, 69, '#8f6044', '#29261b', 'Branch antlers, leaf skirt and living staff', 'Deep forest robes, bark corset and seedpod jewelry', 'Forked living-oak staff'),
  c_zal: design('robe', 11, 65, '#8d687e', '#e4d5cf', 'Tall ritual mask and crooked bone staff', 'Violet spirit wraps, magenta sash and bone charms', 'Venom mask and sanctuary staff'),
  c_xin: design('scout', 12, 69, '#bd724d', '#8b2f16', 'Flame crest and two curved fire swords', 'Burnt-orange martial robes and brass bracers', 'Twin ember sabers'),
  c_raijin: design('brawler', 17, 65, '#75c2cd', '#d8e9ed', 'Round storm spirit with floating lightning drums', 'Teal cloud coat, copper coils and luminous eyebrows', 'Storm halo and lightning satellites'),
  c_kaolin: design('stone', 17, 73, '#65a88a', '#274e43', 'Segmented jade golem and square stone spear', 'Carved jade armor with bright fault-line inlays', 'Mountain remnant spear'),
  c_inai: design('robe', 12, 72, '#ba9bd4', '#e4d8ec', 'Floating split robe, white beard and crescent blade', 'Violet astral panels around an open dark core', 'Double-ended void glaive'),
  c_qiyana: design('scout', 11, 67, '#a8754e', '#ece2c5', 'Oversized elemental ring blade and stepped crown', 'Turquoise silk panels and engraved gold guards', 'Three-gem elemental hoop'),
  c_locke: design('scout', 11, 68, '#a98570', '#dcd8d1', 'Wide ash hat, long coat and ember-edged saber', 'Charcoal exorcist coat, parchment seals and burnt lining', 'Ash saber and talisman streamers'),
  c_senna: design('scout', 11, 72, '#78513c', '#242832', 'Long pale locs and a shoulder-length relic cannon', 'White mantled coat over teal armor and heavy greaves', 'Oversized mist relic cannon'),
  c_largo: design('frog', 19, 59, '#8da94f', '#3f512b', 'Wide frog mouth, throat pouch and round drum', 'Marsh bandleader vest, reed collar and gold buttons', 'Bogbeat drum and ribbon tongue'),
  c_shadowfiend: design('demon', 20, 79, '#332330', '#391a26', 'Horned furnace torso, long claws and trailing smoke', 'Obsidian rib plates around a hot rose soul core', 'Soul furnace and raking talons'),
  c_earthshaker: design('brawler', 20, 76, '#9c754d', '#61422b', 'Heavy stone shoulders and enormous horizontal totem', 'Ochre fur, slate plates and gold seismic runes', 'Runic earthquake totem'),
  c_mirehook: design('brawler', 22, 69, '#a3aa80', '#3c493b', 'Stooped scavenger, hook arm and stitched apron', 'Mire-green bulk, patched leather and rusted chain', 'Barbed hook and hanging chain'),
  c_nullweaver: design('wisp', 15, 77, '#5c438c', '#231b3c', 'Faceless floating void shell with orbital fragments', 'Layered violet carapace around a dark singularity', 'Gravitic halo and floating shards'),
  c_voltgrip: design('machine', 20, 73, '#ac8636', '#3e4650', 'Round riveted chassis and oversized grappling fist', 'Aged brass shell, dark joints and cyan power cell', 'Rocket fist and exposed electric coil'),
  c_aetherbolt: design('scout', 10, 65, '#cda17d', '#c2a270', 'Short explorer jacket and one luminous gauntlet', 'Blue expedition coat, satchel and bronze buckles', 'Celestial casting gauntlet'),
  c_corsara: design('scout', 11, 69, '#bc886d', '#923b37', 'Broad privateer hat and two long pistols', 'Wine captain coat, cream blouse and brass epaulettes', 'Twin privateer flintlocks'),
  c_brewmaw: design('brawler', 23, 66, '#bb9369', '#4b3023', 'Round brewmaster with a massive strapped cask', 'Patched russet apron, rope harness and gold keg hoops', 'Oak vintage cask'),
  c_wraithhook: design('robe', 13, 75, '#75a69b', '#224b48', 'Hooded chain warden, hooked scythe and lantern', 'Tattered green mantle, dark ribs and pale spirit mask', 'Spectral hook and caged lantern'),
  c_invoker: design('robe', 12, 74, '#cfa88d', '#e7d6b4', 'Layered brass shoulders, split coat and an asymmetric mantle', 'Navy brocade, ivory coat panels and burgundy velvet with brass trim', 'Ice, wind and fire orbital arsenal'),
  c_hwei: design('robe', 10, 71, '#bca58e', '#202b40', 'Long ink hair, flowing sleeves and oversized brush', 'Petrol-blue art robes with three pigment vessels', 'Broad calligraphy brush and ink palette'),
  c_jayce: design('knight', 15, 72, '#c19a7a', '#4c3027', 'Square inventor shoulders and split hammer-cannon', 'Cobalt engineering plate, cream coat and copper joints', 'Mercury hammer with plasma barrel'),
  c_vi: design('brawler', 14, 68, '#bd947e', '#c74a77', 'Two giant industrial gauntlets and swept mohawk', 'Short magenta jacket, dark work trousers and brass plates', 'Paired hydraulic breaker fists'),
  c_jinx: design('scout', 9, 67, '#d0b8b0', '#357bb8', 'Two long blue braids and oversized rocket tube', 'Blue utility harness, red straps and mismatch boots', 'Mayhem launcher and ammunition belt'),
  c_puck: design('dragon', 13, 53, '#53b5a7', '#218c91', 'Small hovering faerie dragon with four petal wings', 'Mint scales, pearl belly and cyan wing veins', 'Dreamrift wings and curled dragon tail'),
  c_batrider: design('rider', 13, 74, '#af815e', '#4a2e21', 'Goggled rider on a broad bat with wing fingers', 'Scorched flight vest, fuel tank and coiled fire rope', 'Cinder bat mount and burning lasso'),
  c_bristleback: design('hedgehog', 20, 63, '#b49b69', '#5a6840', 'Hunched beast with a dense fan of back quills', 'Olive pelt, scratched shoulder band and iron nose ring', 'Layered barbed quill carapace'),
  c_io: design('wisp', 13, 62, '#e0f3f4', '#8dd8ec', 'Pure floating light core with concentric orbitals', 'Porcelain light shell with cyan harmonic rings', 'Five harmonic spirit satellites'),
  c_lulu: design('robe', 9, 60, '#b296ba', '#73579a', 'Petal hat, hooked blossom staff and moth familiar', 'Purple bellflower dress with lime leaves and soft boots', 'Briar staff and luminous moth'),
  c_silencer: design('knight', 12, 72, '#b6a2a1', '#3a345b', 'Closed veil helmet, upright edict and crescent quill', 'Indigo magistrate armor, pale scroll panels and wax seals', 'Floating edict tablet and silence quill'),
  c_wukong_lol: design('monkey', 12, 66, '#bd926a', '#8c6a45', 'Long curled tail, mist scarf and tapered longstaff', 'Lavender wraps, brass knee guards and tousled crest', 'Gold-banded mist staff'),
  c_monkeyking_dota: design('monkey', 14, 73, '#bc8c5a', '#5e3d25', 'Leaf crown, long tail and thick jade-ended staff', 'Bark-gold armor with living shoulder leaves', 'Canopy sovereign staff and branch crown'),
  c_stepstone: design('scout', 12, 68, '#ba8258', '#28242a', 'Unarmed monk, wrapped fists and broad stone greaves', 'Green sleeveless tunic, yellow sash and small brass bells', 'Bell bracers and stone kick guards'),
  c_skybreaker: design('skiff', 17, 75, '#c79d79', '#513e32', 'Open pilot pod between two exposed lift fans', 'Cobalt armored skiff, orange fins and leather flight cap', 'Twin lift rotors and rotary flak cannon'),
});

export function avatarDesign(id: string): AvatarDesign | undefined { return AVATAR_DESIGNS[id]; }
