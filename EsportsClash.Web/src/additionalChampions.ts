import type { ChampionKit } from './types';

// Kits are adapted for the bridge arena from the official champion and hero themes.
export const ADDITIONAL_CHAMPIONS: ChampionKit[] = [
  {
    id: 'c_qiyana', name: 'Veyara', title: 'The Prism Regent', basis: 'Qiyana',
    primaryRole: 'Assassin', secondaryRole: 'Fighter', archetype: 'Elemental Assassin',
    hp: 990, ad: 83, armor: 35, mr: 31, aspd: 0.76, range: 1.7,
    passiveDesc: 'Facet Edge: the first hit on an enemy deals bonus damage.',
    skill1: { name: 'Prism Hurl', desc: 'Hurl an elemental blade that wounds and briefly roots.', cooldown: 5, damage: 170, damageType: 'Physical' },
    skill2: { name: 'Facet Dash', desc: 'Dash and gain a fresh element, striking the target.', cooldown: 8, damage: 95, damageType: 'Physical' },
    ultimate: { name: 'Crownfall Surge', desc: 'A sweeping shockwave erupts around clustered enemies.', cooldown: 65, damage: 470, damageType: 'Physical', isUlt: true },
    primaryColor: '#14b8a6', accentColor: '#fde047'
  },
  {
    id: 'c_locke', name: 'Cinderlock', title: 'The Cinder Warden', basis: 'Locke',
    primaryRole: 'Assassin', secondaryRole: 'Mage', archetype: 'Ash Exorcist',
    hp: 1020, ad: 70, armor: 34, mr: 36, aspd: 0.76, range: 2.3,
    passiveDesc: 'Burning Iron: attacks burn wounded enemies with magic.',
    skill1: { name: 'Cinder Spikes', desc: 'Launch a fan of searing ritual nails.', cooldown: 5, damage: 165, damageType: 'Magic' },
    skill2: { name: 'Ash Rush', desc: 'Ignite the soul to rush forward with ash and fire.', cooldown: 9, damage: 120, damageType: 'Magic' },
    ultimate: { name: 'Cinder Verdict', desc: 'Detonate a great ashen exorcism around the target.', cooldown: 60, damage: 445, damageType: 'Magic', isUlt: true },
    primaryColor: '#fb923c', accentColor: '#fef3c7'
  },
  {
    id: 'c_senna', name: 'Solenne', title: 'The Mist Lantern', basis: 'Senna',
    primaryRole: 'Support', secondaryRole: 'Marksman', archetype: 'Relic Cannon Support',
    hp: 940, ad: 78, armor: 31, mr: 35, aspd: 0.67, range: 5.4,
    passiveDesc: 'Waylight: mist souls strengthen the relic cannon.',
    skill1: { name: 'Dusk Lance', desc: 'A light beam damages a foe and heals nearby allies.', cooldown: 6, damage: 135, damageType: 'Physical' },
    skill2: { name: 'Mistbind', desc: 'Dark mist snares the target and nearby enemies.', cooldown: 10, damage: 110, damageType: 'Physical' },
    ultimate: { name: 'Daybreak Veil', desc: 'A wide beam damages enemies and shields allies.', cooldown: 70, damage: 370, damageType: 'Physical', isUlt: true },
    primaryColor: '#14b8a6', accentColor: '#f8fafc'
  },
  {
    id: 'c_largo', name: 'Croakwell', title: 'The Marsh Minstrel', basis: 'Largo',
    primaryRole: 'Support', secondaryRole: 'Tank', archetype: 'Rhythm Support',
    hp: 1240, ad: 57, armor: 44, mr: 42, aspd: 0.64, range: 1.6,
    passiveDesc: 'Lingering Chorus: Croakwell keeps his buffs going for longer.',
    skill1: { name: 'Ribbon Lash', desc: 'Pull and disrupt a foe with a long tongue.', cooldown: 7, damage: 105, damageType: 'Magic' },
    skill2: { name: 'Bogbeat', desc: 'Froglings stomp an area, interrupting enemies.', cooldown: 10, damage: 110, damageType: 'Magic' },
    ultimate: { name: 'Marsh Anthem', desc: 'A luminous song heals and empowers the entire team.', cooldown: 65, damage: 160, damageType: 'Magic', isUlt: true },
    primaryColor: '#84cc16', accentColor: '#facc15'
  },
  {
    id: 'c_shadowfiend', name: 'Soulscourge', title: 'The Gloom Harvester', basis: 'Shadow Fiend',
    primaryRole: 'Mage', secondaryRole: 'Assassin', archetype: 'Soul Nuker',
    hp: 920, ad: 84, armor: 30, mr: 32, aspd: 0.73, range: 5.0,
    passiveDesc: 'Soul Hoard: fallen foes feed his damage.',
    skill1: { name: 'Gloom Raze', desc: 'Raze the earth in front of him with dark fire.', cooldown: 5, damage: 175, damageType: 'Magic' },
    skill2: { name: 'Soul Draw', desc: 'Gather nearby souls for a surge of damage.', cooldown: 10, damage: 115, damageType: 'Magic' },
    ultimate: { name: 'Dirge Wave', desc: 'Release concentric soul waves that terrify nearby enemies.', cooldown: 75, damage: 490, damageType: 'Magic', isUlt: true },
    primaryColor: '#7f1d1d', accentColor: '#fb7185'
  },
  {
    id: 'c_earthshaker', name: 'Stonewake', title: 'The Faultline Warden', basis: 'Earthshaker',
    primaryRole: 'Tank', secondaryRole: 'Support', archetype: 'Seismic Initiator',
    hp: 1380, ad: 69, armor: 53, mr: 40, aspd: 0.60, range: 1.5,
    passiveDesc: 'Stone Pulse: every spell sends a tremor through nearby foes.',
    skill1: { name: 'Faultline', desc: 'Split the ground with a long stunning ridge.', cooldown: 9, damage: 145, damageType: 'Magic' },
    skill2: { name: 'Runic Maul', desc: 'Empower the next blow and stun a nearby enemy.', cooldown: 8, damage: 125, damageType: 'Physical' },
    ultimate: { name: 'Quake Chorus', desc: 'A giant quake echoes through every enemy in the cluster.', cooldown: 75, damage: 410, damageType: 'Magic', isUlt: true },
    primaryColor: '#a16207', accentColor: '#facc15'
  }
];
