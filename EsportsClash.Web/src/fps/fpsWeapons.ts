import type { FpsWeaponDef, FpsWeaponId } from './fpsTypes.ts';

export const FPS_WEAPONS: Record<FpsWeaponId, FpsWeaponDef> = {
  sidearm_standard: {
    id: 'sidearm_standard',
    name: 'P-9 Semi-Auto',
    category: 'sidearm',
    cost: 0,
    killReward: 300,
    baseDamage: 28,
    headshotMultiplier: 3.5,
    armorPenetration: 0.50,
    accuracy: 0.70,
    fireRate: 3,
    range: 'medium'
  },
  sidearm_heavy: {
    id: 'sidearm_heavy',
    name: 'Hawk .50 Magnum',
    category: 'sidearm',
    cost: 700,
    killReward: 300,
    baseDamage: 53,
    headshotMultiplier: 3.9,
    armorPenetration: 0.85,
    accuracy: 0.75,
    fireRate: 2,
    range: 'long'
  },
  smg_tactical: {
    id: 'smg_tactical',
    name: 'Vektor-9 Submachine Gun',
    category: 'smg',
    cost: 1250,
    killReward: 600,
    baseDamage: 26,
    headshotMultiplier: 3.0,
    armorPenetration: 0.58,
    accuracy: 0.65,
    fireRate: 6,
    range: 'close'
  },
  rifle_assault: {
    id: 'rifle_assault',
    name: 'AR-47 Vigilance Rifle',
    category: 'rifle',
    cost: 2700,
    killReward: 300,
    baseDamage: 36,
    headshotMultiplier: 4.0,
    armorPenetration: 0.77,
    accuracy: 0.82,
    fireRate: 4,
    range: 'medium'
  },
  rifle_sniper: {
    id: 'rifle_sniper',
    name: 'Apex .338 Bolt-Action',
    category: 'sniper',
    cost: 4750,
    killReward: 100,
    baseDamage: 115,
    headshotMultiplier: 3.8,
    armorPenetration: 0.98,
    accuracy: 0.95,
    fireRate: 1,
    range: 'long'
  },
  gear_kevlar: {
    id: 'gear_kevlar',
    name: 'Kevlar Vest',
    category: 'gear',
    cost: 650,
    killReward: 0,
    baseDamage: 0,
    headshotMultiplier: 1,
    armorPenetration: 0,
    accuracy: 0,
    fireRate: 0,
    range: 'close'
  },
  gear_helmet: {
    id: 'gear_helmet',
    name: 'Reinforced Helmet',
    category: 'gear',
    cost: 350,
    killReward: 0,
    baseDamage: 0,
    headshotMultiplier: 1,
    armorPenetration: 0,
    accuracy: 0,
    fireRate: 0,
    range: 'close'
  },
  gear_defuse_kit: {
    id: 'gear_defuse_kit',
    name: 'Rapid Defuse Kit',
    category: 'gear',
    cost: 400,
    killReward: 0,
    baseDamage: 0,
    headshotMultiplier: 1,
    armorPenetration: 0,
    accuracy: 0,
    fireRate: 0,
    range: 'close'
  },
  utility_smoke: {
    id: 'utility_smoke',
    name: 'Tactical Smoke Canister',
    category: 'utility',
    cost: 300,
    killReward: 0,
    baseDamage: 0,
    headshotMultiplier: 1,
    armorPenetration: 0,
    accuracy: 0,
    fireRate: 0,
    range: 'medium'
  },
  utility_flash: {
    id: 'utility_flash',
    name: 'Stun Flashbang',
    category: 'utility',
    cost: 200,
    killReward: 0,
    baseDamage: 0,
    headshotMultiplier: 1,
    armorPenetration: 0,
    accuracy: 0,
    fireRate: 0,
    range: 'medium'
  },
  utility_he: {
    id: 'utility_he',
    name: 'High Explosive Frag',
    category: 'utility',
    cost: 300,
    killReward: 300,
    baseDamage: 55,
    headshotMultiplier: 1.0,
    armorPenetration: 0.60,
    accuracy: 0.85,
    fireRate: 1,
    range: 'medium'
  },
  utility_molotov: {
    id: 'utility_molotov',
    name: 'Incendiary Barrier',
    category: 'utility',
    cost: 400,
    killReward: 300,
    baseDamage: 40,
    headshotMultiplier: 1.0,
    armorPenetration: 0.80,
    accuracy: 0.90,
    fireRate: 1,
    range: 'medium'
  }
};

export function getWeaponDef(weaponId: FpsWeaponId): FpsWeaponDef {
  const def = FPS_WEAPONS[weaponId];
  if (!def) {
    throw new Error(`Unknown weapon ID: ${weaponId}`);
  }
  return def;
}
