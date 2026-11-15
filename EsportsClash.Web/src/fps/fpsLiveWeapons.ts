export type LiveWeapon =
  | 'pistol' | 'smg' | 'rifle' | 'sniper'
  | 'usp_s' | 'glock' | 'deagle' | 'p250' | 'fiveseven' | 'tec9' | 'cz75'
  | 'm4a1_s' | 'ak47'
  | 'mag7' | 'nova'
  | 'mp9' | 'mac10'
  | 'negev' | 'scout' | 'budget_ct' | 'budget_t';

export type LiveEquippedWeapon = LiveWeapon | 'knife' | 'flash' | 'smoke' | 'incendiary' | 'he' | 'bomb';

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
  readonly armorScale?:number;readonly rangeLoss?:number;readonly killReward?:number;
}

/** Knife is permanent secondary equipment; it never replaces or duplicates the bought gun. */
export const LIVE_KNIFE = { name: 'Dock knife', reach: 1.35, windup: .16, interval: .8, damage: 45, backDamage: 90, draw: .3, runSpeed: 4.65 } as const;

export const liveDrawTime = (weapon: LiveEquippedWeapon): number => {
  if (weapon === 'bomb') return .8;
  if (weapon === 'knife') return LIVE_KNIFE.draw;
  if (weapon === 'flash' || weapon === 'smoke' || weapon === 'incendiary' || weapon === 'he') return 0.68;
  if (weapon === 'sniper') return 0.85;
  if (weapon === 'scout') return 0.75;
  if (weapon === 'negev') return 1.1;
  if (weapon === 'mag7' || weapon === 'nova') return 0.75;
  if (weapon === 'rifle' || weapon === 'm4a1_s' || weapon === 'ak47'||weapon==='budget_ct'||weapon==='budget_t') return 0.65;
  if (weapon === 'smg' || weapon === 'mp9' || weapon === 'mac10') return 0.50;
  return 0.45;
};

/** Original exhibition armory. Legacy IDs stay stable for stored/local compatibility. */
export const LIVE_WEAPONS:Record<LiveWeapon,LiveWeaponStats>={
 pistol:{name:'Peregrine P9',cost:300,magazine:12,reserve:48,damage:25,interval:.28,spread:.019,reload:1.8,headshotMultiplier:3,side:'both',category:'pistol',rangeLoss:.32,killReward:250},
 usp_s:{name:'Warden .45',cost:200,magazine:12,reserve:48,damage:25,interval:.23,spread:.013,reload:1.85,headshotMultiplier:3.1,side:'ct',category:'pistol',rangeLoss:.28,killReward:250},
 glock:{name:'Ember 9',cost:200,magazine:20,reserve:80,damage:23,interval:.20,spread:.019,reload:1.7,headshotMultiplier:3,side:'t',category:'pistol',rangeLoss:.34,killReward:250},
 p250:{name:'Sidewinder 250',cost:300,magazine:13,reserve:52,damage:28,interval:.21,spread:.015,reload:1.75,headshotMultiplier:3.05,side:'both',category:'pistol',rangeLoss:.30,armorScale:.80,killReward:250},
 fiveseven:{name:'Vanguard 5.7',cost:500,magazine:20,reserve:80,damage:29,interval:.18,spread:.014,reload:1.9,headshotMultiplier:3.1,side:'ct',category:'pistol',rangeLoss:.26,armorScale:.86,killReward:250},
 tec9:{name:'Riot-9',cost:500,magazine:18,reserve:72,damage:30,interval:.17,spread:.018,reload:1.85,headshotMultiplier:3.05,side:'t',category:'pistol',rangeLoss:.28,armorScale:.85,killReward:250},
 cz75:{name:'Hornet Auto',cost:500,magazine:12,reserve:24,damage:24,interval:.105,spread:.023,reload:2.25,headshotMultiplier:2.85,side:'both',category:'pistol',rangeLoss:.38,armorScale:.76,killReward:200},
 deagle:{name:'Kestrel .50',cost:700,magazine:7,reserve:35,damage:44,interval:.38,spread:.013,reload:2.2,headshotMultiplier:3.2,side:'both',category:'pistol',rangeLoss:.18,armorScale:.90,killReward:250},
 rifle:{name:'Ardent AR-4',cost:2750,magazine:30,reserve:90,damage:27,interval:.105,spread:.013,reload:2.45,headshotMultiplier:3.4,category:'rifle',rangeLoss:.15,killReward:250},
 m4a1_s:{name:'Sentinel S4',cost:3150,magazine:25,reserve:75,damage:27,interval:.095,spread:.0115,reload:2.45,headshotMultiplier:3.3,side:'ct',category:'rifle',armorScale:.78,rangeLoss:.14,killReward:250},
 ak47:{name:'Outrider R7',cost:2850,magazine:30,reserve:90,damage:29,interval:.105,spread:.0135,reload:2.55,headshotMultiplier:4.5,side:'t',category:'rifle',armorScale:.78,rangeLoss:.17,killReward:250},
 budget_ct:{name:'Halberd B3',cost:2050,magazine:25,reserve:75,damage:24,interval:.105,spread:.014,reload:2.65,headshotMultiplier:3.3,side:'ct',category:'rifle',rangeLoss:.20,killReward:300},
 budget_t:{name:'Talon R3',cost:1800,magazine:30,reserve:90,damage:26,interval:.11,spread:.016,reload:2.6,headshotMultiplier:3.6,side:'t',category:'rifle',rangeLoss:.22,killReward:300},
 smg:{name:'Swift-25',cost:1200,magazine:25,reserve:100,damage:20,interval:.085,spread:.024,reload:2.15,headshotMultiplier:2.5,category:'smg',rangeLoss:.42,killReward:600},
 mp9:{name:'Vector C9',cost:1300,magazine:30,reserve:120,damage:20,interval:.075,spread:.023,reload:2.2,headshotMultiplier:2.6,side:'ct',category:'smg',rangeLoss:.40,killReward:600},
 mac10:{name:'Rook M10',cost:1100,magazine:30,reserve:90,damage:21,interval:.08,spread:.025,reload:2.15,headshotMultiplier:2.5,side:'t',category:'smg',rangeLoss:.43,killReward:600},
 mag7:{name:'Bastion-5',cost:1400,magazine:5,reserve:25,damage:19,interval:.90,spread:.055,reload:2.7,headshotMultiplier:1.8,side:'ct',category:'shotgun',pellets:8,rangeLoss:.5,killReward:700},
 nova:{name:'Wayfarer-8',cost:1150,magazine:8,reserve:32,damage:18,interval:.95,spread:.05,reload:3,headshotMultiplier:1.9,side:'t',category:'shotgun',pellets:8,rangeLoss:.5,killReward:700},
 sniper:{name:'Longwatch A9',cost:5200,magazine:5,reserve:20,damage:105,interval:1.45,spread:.0028,reload:3.4,headshotMultiplier:2,category:'sniper',armorScale:1,rangeLoss:.04,killReward:100},
 scout:{name:'Trailfinder S8',cost:1900,magazine:10,reserve:40,damage:62,interval:1.18,spread:.004,reload:2.9,headshotMultiplier:2.5,category:'sniper',rangeLoss:.12,killReward:250},
 negev:{name:'Bulwark N100',cost:2200,magazine:100,reserve:200,damage:23,interval:.08,spread:.024,reload:4.5,headshotMultiplier:3,category:'heavy',rangeLoss:.25,killReward:300},
};
export const LIVE_WEAPON_TIERS:Record<LiveWeapon,number>={sniper:5,scout:3,rifle:4,m4a1_s:4,ak47:4,budget_ct:3,budget_t:3,negev:3,smg:2,mp9:2,mac10:2,mag7:2,nova:2,deagle:1.9,fiveseven:1.7,tec9:1.7,cz75:1.6,p250:1.4,pistol:1,usp_s:1,glock:1};

/** Purchase exclusivity; recovered enemy equipment remains usable. Legacy IDs stay replay-compatible. */
export const LIVE_SIDE_LOADOUTS = {
  ct: { sidearm:'usp_s', ecoPistols:['deagle','fiveseven','p250','cz75'], rifle:'m4a1_s', budget:'budget_ct', smg:'mp9', shotgun:'mag7' },
  t: { sidearm:'glock', ecoPistols:['deagle','tec9','p250','cz75'], rifle:'ak47', budget:'budget_t', smg:'mac10', shotgun:'nova' },
} as const;
export function canBuyLiveWeapon(weapon:LiveWeapon,attacking:boolean):boolean {
  if(weapon==='pistol'||weapon==='rifle'||weapon==='smg')return false;
  const side=LIVE_WEAPONS[weapon].side;
  return side===undefined||side==='both'||side===(attacking?'t':'ct');
}

/** A bounded per-weapon spray pattern in radians for the local exhibition. */
export function liveWeaponRecoilKick(weapon: LiveWeapon, shot: number): { yaw: number; pitch: number } {
  const family=LIVE_WEAPONS[weapon].category,index=Math.max(0,Math.floor(shot)-1);
  if(family==='pistol'||family==='sniper'||family==='shotgun')return {yaw:(index%2?1:-1)*.0015,pitch:weapon==='deagle'?.032:weapon==='cz75'?.019:weapon==='fiveseven'||weapon==='tec9'||weapon==='p250'?.015:family==='sniper'?.035:family==='shotgun'?.027:.013};
  // Successive deltas of a continuous rising-then-lateral spray; no alternating idle yaw scan.
  const pitch=[.018,.038,.059,.081,.103,.124,.141,.155,.166,.175,.182,.188,.193,.197,.2,.203,.206,.208,.21,.212];
  const yaw=[0,-.001,-.003,-.006,-.004,.002,.011,.021,.031,.038,.039,.031,.019,.005,-.008,-.016,-.017,-.01,.002,.014];
  const at=Math.min(index,pitch.length-1),previous=at-1;
  const scale=weapon==='m4a1_s'?.76:family==='smg'?.62:family==='heavy'?.85:1;
  return {pitch:(index>=pitch.length?.0015:pitch[at]-(previous<0?0:pitch[previous]))*scale,
    yaw:(index>=yaw.length?Math.sin(index*.36)*.003:yaw[at]-(previous<0?0:yaw[previous]))*scale};
}

export function advanceLiveRecoil(recoil: number, control: number, dt: number,age=Infinity): number {
  const compensation=(.012+Math.max(0,Math.min(1,control))*.15)*Math.max(0,dt);
  const residual=Math.max(0,Math.abs(recoil)-compensation);
  // Fixed weapon settling after trigger release; individual skill controls active compensation.
  const settle=age>.18?Math.exp(-10*Math.max(0,dt)):1;
  return Math.sign(recoil)*residual*settle;
}
