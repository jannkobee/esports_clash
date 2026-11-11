export type LiveWeapon =
  | 'pistol' | 'smg' | 'rifle' | 'sniper'
  | 'usp_s' | 'glock' | 'deagle'
  | 'm4a1_s' | 'ak47'
  | 'mag7' | 'nova'
  | 'mp9' | 'mac10'
  | 'negev' | 'scout';

export type LiveEquippedWeapon = LiveWeapon | 'knife' | 'flash' | 'smoke';

export interface LiveWeaponStats {
  readonly name: string;
  readonly cost: number;
  readonly magazine: number;
  readonly reserve: number;
  readonly damage: number;
  readonly interval: number;
  readonly spread: number;
  readonly reload: number;
  readonly headshotMultiplier: number;
  readonly side?: 'ct' | 't' | 'both';
  readonly category?: 'pistol' | 'smg' | 'rifle' | 'sniper' | 'shotgun' | 'heavy';
  readonly pellets?: number;
}

/** Knife is permanent secondary equipment; it never replaces or duplicates the bought gun. */
export const LIVE_KNIFE = { name: 'Dock knife', reach: 1.35, windup: .16, interval: .8, damage: 45, backDamage: 90, draw: .3, runSpeed: 4.65 } as const;

export const liveDrawTime = (weapon: LiveEquippedWeapon): number => {
  if (weapon === 'knife') return LIVE_KNIFE.draw;
  if (weapon === 'flash' || weapon === 'smoke') return 0.45;
  if (weapon === 'sniper') return 0.85;
  if (weapon === 'scout') return 0.75;
  if (weapon === 'negev') return 1.1;
  if (weapon === 'mag7' || weapon === 'nova') return 0.75;
  if (weapon === 'rifle' || weapon === 'm4a1_s' || weapon === 'ak47') return 0.65;
  if (weapon === 'smg' || weapon === 'mp9' || weapon === 'mac10') return 0.50;
  return 0.45;
};

export const LIVE_WEAPONS: Record<LiveWeapon, LiveWeaponStats> = {
  // Classic / Parody mappings
  pistol: { name: 'P9', cost: 300, magazine: 12, reserve: 60, damage: 29, interval: .32, spread: .022, reload: 1.7, headshotMultiplier: 2.45, side: 'both', category: 'pistol' },
  smg: { name: 'Kestrel', cost: 1250, magazine: 25, reserve: 100, damage: 22, interval: .09, spread: .028, reload: 2, headshotMultiplier: 2.2, side: 'both', category: 'smg' },
  rifle: { name: 'AR-4', cost: 2700, magazine: 30, reserve: 90, damage: 32, interval: .14, spread: .014, reload: 2.3, headshotMultiplier: 3.4, side: 'both', category: 'rifle' },
  sniper: { name: 'SR-7', cost: 4750, magazine: 5, reserve: 25, damage: 115, interval: 1.35, spread: .004, reload: 3.1, headshotMultiplier: 3.0, side: 'both', category: 'sniper' },

  // CT / T exclusive starting pistols & Deagle hand-cannon
  usp_s: { name: 'USP-S', cost: 200, magazine: 12, reserve: 48, damage: 35, interval: .28, spread: .015, reload: 1.8, headshotMultiplier: 2.6, side: 'ct', category: 'pistol' },
  glock: { name: 'Glock-18', cost: 200, magazine: 20, reserve: 120, damage: 28, interval: .22, spread: .024, reload: 1.6, headshotMultiplier: 2.3, side: 't', category: 'pistol' },
  deagle: { name: 'Desert Eagle', cost: 700, magazine: 7, reserve: 35, damage: 53, interval: .38, spread: .018, reload: 2.2, headshotMultiplier: 3.9, side: 'both', category: 'pistol' },

  // Primary Rifles (M4A1-S Silenced & AK-47 1-tap)
  m4a1_s: { name: 'M4A1-S', cost: 2900, magazine: 20, reserve: 80, damage: 35, interval: .10, spread: .011, reload: 2.2, headshotMultiplier: 3.4, side: 'ct', category: 'rifle' },
  ak47: { name: 'AK-47', cost: 2700, magazine: 30, reserve: 90, damage: 36, interval: .10, spread: .014, reload: 2.4, headshotMultiplier: 3.8, side: 't', category: 'rifle' },

  // SMGs (MP9 rapid fire & MAC-10 run-and-gun)
  mp9: { name: 'MP9', cost: 1250, magazine: 30, reserve: 120, damage: 22, interval: .070, spread: .026, reload: 2.1, headshotMultiplier: 2.2, side: 'ct', category: 'smg' },
  mac10: { name: 'MAC-10', cost: 1050, magazine: 30, reserve: 100, damage: 24, interval: .075, spread: .028, reload: 2.1, headshotMultiplier: 2.2, side: 't', category: 'smg' },

  // Shotguns (MAG-7 CT magazine shotgun & Nova T pump shotgun)
  mag7: { name: 'MAG-7', cost: 1300, magazine: 5, reserve: 30, damage: 26, interval: .85, spread: .055, reload: 2.4, headshotMultiplier: 2.1, side: 'ct', category: 'shotgun', pellets: 8 },
  nova: { name: 'Nova', cost: 1050, magazine: 8, reserve: 32, damage: 24, interval: .90, spread: .050, reload: 2.8, headshotMultiplier: 2.1, side: 't', category: 'shotgun', pellets: 8 },

  // Heavy Machine Gun & Scout Sniper
  negev: { name: 'Negev', cost: 1700, magazine: 100, reserve: 200, damage: 30, interval: .075, spread: .020, reload: 4.2, headshotMultiplier: 2.5, side: 'both', category: 'heavy' },
  scout: { name: 'SSG 08', cost: 1700, magazine: 10, reserve: 40, damage: 75, interval: 1.10, spread: .006, reload: 2.8, headshotMultiplier: 3.8, side: 'both', category: 'sniper' },
};
