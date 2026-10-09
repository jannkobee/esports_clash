import type { ChampionKit } from './types';

// Kits are adapted for the bridge arena from the official champion and hero themes.
export const ADDITIONAL_CHAMPIONS: ChampionKit[] = [
  {
    id: 'c_qiyana', name: 'Qiyana', title: 'Empress of the Elements', basis: 'Qiyana',
    primaryRole: 'Assassin', secondaryRole: 'Fighter', archetype: 'Elemental Assassin',
    hp: 990, ad: 83, armor: 35, mr: 31, aspd: 0.76, range: 1.7,
    passiveDesc: 'Royal Privilege: the first hit on an enemy deals bonus damage.',
    skill1: { name: 'Elemental Wrath', desc: 'Hurl an elemental blade that wounds and briefly roots.', cooldown: 5, damage: 170, damageType: 'Physical' },
    skill2: { name: 'Terrashape', desc: 'Dash and gain a fresh element, striking the target.', cooldown: 8, damage: 95, damageType: 'Physical' },
    ultimate: { name: 'Supreme Display of Talent', desc: 'A sweeping shockwave erupts around clustered enemies.', cooldown: 65, damage: 470, damageType: 'Physical', isUlt: true },
    primaryColor: '#14b8a6', accentColor: '#fde047'
  },
  {
    id: 'c_locke', name: 'Locke', title: 'The Ashen Exorcist', basis: 'Locke',
    primaryRole: 'Assassin', secondaryRole: 'Mage', archetype: 'Ash Exorcist',
    hp: 1020, ad: 70, armor: 34, mr: 36, aspd: 0.76, range: 2.3,
    passiveDesc: 'Silver Stake: attacks burn wounded enemies with magic.',
    skill1: { name: 'Ritual Nails', desc: 'Launch a fan of searing ritual nails.', cooldown: 5, damage: 165, damageType: 'Magic' },
    skill2: { name: 'Soul Ignition', desc: 'Ignite the soul to rush forward with ash and fire.', cooldown: 9, damage: 120, damageType: 'Magic' },
    ultimate: { name: 'Purgatory', desc: 'Detonate a great ashen exorcism around the target.', cooldown: 60, damage: 445, damageType: 'Magic', isUlt: true },
    primaryColor: '#fb923c', accentColor: '#fef3c7'
  },
  {
    id: 'c_senna', name: 'Senna', title: 'The Redeemer', basis: 'Senna',
    primaryRole: 'Support', secondaryRole: 'Marksman', archetype: 'Relic Cannon Support',
    hp: 940, ad: 78, armor: 31, mr: 35, aspd: 0.67, range: 5.4,
    passiveDesc: 'Absolution: mist souls strengthen the relic cannon.',
    skill1: { name: 'Piercing Darkness', desc: 'A light beam damages a foe and heals nearby allies.', cooldown: 6, damage: 135, damageType: 'Physical' },
    skill2: { name: 'Last Embrace', desc: 'Dark mist snares the target and nearby enemies.', cooldown: 10, damage: 110, damageType: 'Physical' },
    ultimate: { name: 'Dawning Shadow', desc: 'A wide beam damages enemies and shields allies.', cooldown: 70, damage: 370, damageType: 'Physical', isUlt: true },
    primaryColor: '#14b8a6', accentColor: '#f8fafc'
  },
  {
    id: 'c_largo', name: 'Largo', title: 'The Frog Bard', basis: 'Largo',
    primaryRole: 'Support', secondaryRole: 'Tank', archetype: 'Rhythm Support',
    hp: 1240, ad: 57, armor: 44, mr: 42, aspd: 0.64, range: 1.6,
    passiveDesc: 'Encore: Largo keeps his buffs going for longer.',
    skill1: { name: 'Catchy Lick', desc: 'Pull and disrupt a foe with a long tongue.', cooldown: 7, damage: 105, damageType: 'Magic' },
    skill2: { name: 'Frogstomp', desc: 'Froglings stomp an area, interrupting enemies.', cooldown: 10, damage: 110, damageType: 'Magic' },
    ultimate: { name: 'Amphibian Rhapsody', desc: 'A luminous song heals and empowers the entire team.', cooldown: 65, damage: 160, damageType: 'Magic', isUlt: true },
    primaryColor: '#84cc16', accentColor: '#facc15'
  },
  {
    id: 'c_shadowfiend', name: 'Shadow Fiend', title: 'Collector of Souls', basis: 'Shadow Fiend',
    primaryRole: 'Mage', secondaryRole: 'Assassin', archetype: 'Soul Nuker',
    hp: 920, ad: 84, armor: 30, mr: 32, aspd: 0.73, range: 5.0,
    passiveDesc: 'Necromastery: fallen foes feed his damage.',
    skill1: { name: 'Shadowraze', desc: 'Raze the earth in front of him with dark fire.', cooldown: 5, damage: 175, damageType: 'Magic' },
    skill2: { name: 'Feast of Souls', desc: 'Gather nearby souls for a surge of damage.', cooldown: 10, damage: 115, damageType: 'Magic' },
    ultimate: { name: 'Requiem of Souls', desc: 'Release concentric soul waves that terrify nearby enemies.', cooldown: 75, damage: 490, damageType: 'Magic', isUlt: true },
    primaryColor: '#7f1d1d', accentColor: '#fb7185'
  },
  {
    id: 'c_earthshaker', name: 'Earthshaker', title: 'The Seismic Initiator', basis: 'Earthshaker',
    primaryRole: 'Tank', secondaryRole: 'Support', archetype: 'Seismic Initiator',
    hp: 1380, ad: 69, armor: 53, mr: 40, aspd: 0.60, range: 1.5,
    passiveDesc: 'Aftershock: every spell sends a tremor through nearby foes.',
    skill1: { name: 'Fissure', desc: 'Split the ground with a long stunning ridge.', cooldown: 9, damage: 145, damageType: 'Magic' },
    skill2: { name: 'Enchant Totem', desc: 'Empower the next blow and stun a nearby enemy.', cooldown: 8, damage: 125, damageType: 'Physical' },
    ultimate: { name: 'Echo Slam', desc: 'A giant quake echoes through every enemy in the cluster.', cooldown: 75, damage: 410, damageType: 'Magic', isUlt: true },
    primaryColor: '#a16207', accentColor: '#facc15'
  }
];
