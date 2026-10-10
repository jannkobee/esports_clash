import type { AvatarRole, ItemDef } from './types';

// A recipe consumes one component and credits its full purchase price toward completion.
const RECIPES: Record<string, string[]> = {
  item_infinity_edge: ['item_bf_sword'],
  item_kraken_slayer: ['item_noonquiver', 'item_recurve_bow'],
  item_ldr: ['item_last_whisper'],
  item_bork: ['item_recurve_bow'],
  item_mortal_reminder: ['item_last_whisper'],
  item_phantom_dancer: ['item_recurve_bow'],
  item_runaans: ['item_recurve_bow'],
  item_terminus: ['item_last_whisper', 'item_recurve_bow'],
  item_collector: ['item_serrated_dirk'],
  item_deathcap: ['item_blasting_wand'],
  item_ludens: ['item_lost_chapter'],
  item_zhonyas: ['item_chain_vest', 'item_blasting_wand'],
  item_void_staff: ['item_blasting_wand'],
  item_sunfire: ['item_bami_cinder'],
  item_warmogs: ['item_bami_cinder'],
  item_thornmail: ['item_chain_vest'],
  item_steraks: ['item_caulfield'],
  item_spirit_visage: ['item_bami_cinder'],
  item_echoes_of_helia: ['item_lost_chapter'],
  item_shurelyas: ['item_guardians_horn', 'item_chain_vest'],
  item_knights_vow: ['item_chain_vest'],
  item_locket: ['item_chain_vest'],
  item_ardent_censer: ['item_blasting_wand'],
  item_redemption: ['item_guardians_orb'],
  item_black_cleaver: ['item_caulfield'],
  item_shojin: ['item_caulfield'],
  item_navori: ['item_caulfield'],
  item_cosmic_drive: ['item_lost_chapter', 'item_blasting_wand'],
  item_ghostblade: ['item_serrated_dirk'],
  item_duskblade: ['item_serrated_dirk', 'item_caulfield'],
  item_serpents_fang: ['item_serrated_dirk'],
  item_shadowflame: ['item_blasting_wand'],
  item_horizon_focus: ['item_blasting_wand'],
};

export interface ItemPurchasePlan {
  item: ItemDef;
  removed: ItemDef[];
  goldCost: number;
  reason: 'complete' | 'buy' | 'replace';
}

function effectiveRole(role: AvatarRole, championName: string): AvatarRole {
  const champions: Record<string, AvatarRole> = {
    Astra: 'Marksman', Cora: 'Marksman', Kindra: 'Marksman', 'Kindra & Grim': 'Marksman', Solenne: 'Marksman',
    Kyumi: 'Mage', Raijin: 'Mage', Tequoia: 'Mage', 'Soulscourge': 'Mage',
    Solana: 'Tank', Kaolin: 'Tank', Stonewake: 'Tank',
    Zal: 'Support', Renn: 'Support', Croakwell: 'Support',
    Kage: 'Assassin', Inai: 'Assassin', Veyara: 'Assassin', Cinderlock: 'Assassin', Cinderbloom: 'Assassin',
    Buck: 'Fighter', Valkira: 'Fighter', Kazemaru: 'Fighter', Sylla: 'Fighter', Xin: 'Fighter',
  };
  return champions[championName] ?? role;
}

function score(item: ItemDef, role: AvatarRole, championName: string = ''): number {
  const s = item.stats;
  const attack = (s.ad ?? 0) * (role === 'Marksman' || role === 'Assassin' || role === 'Fighter' ? 1.3 : 0.32);
  const magic = (s.ap ?? 0) * (role === 'Mage' || role === 'Support' ? 1.35 : 0.22);
  const health = (s.hp ?? 0) * (role === 'Tank' || role === 'Fighter' || role === 'Support' ? 0.20 : 0.10);
  const defense = ((s.armor ?? 0) + (s.mr ?? 0)) * (role === 'Tank' || role === 'Support' ? 1.35 : 0.55);
  const speed = (s.aspd ?? 0) * (role === 'Marksman' || role === 'Fighter' ? 170 : 65);
  const crit = (s.crit ?? 0) * (role === 'Marksman' || role === 'Assassin' ? 2.1 : 0.4);
  const haste = (s.haste ?? 0) * (role === 'Mage' || role === 'Support' ? 1.65 : 0.9);
  const armorPen = (s.armorPen ?? 0) * (role === 'Marksman' || role === 'Assassin' ? 1.4 : 0.35);
  const lethality = (s.lethality ?? 0) * (role === 'Assassin' || role === 'Marksman' || role === 'Fighter' ? 1.6 : 0.4);
  const magicPen = (s.magicPen ?? 0) * (role === 'Mage' || role === 'Assassin' ? 1.5 : 0.3);
  const lifesteal = (s.lifesteal ?? 0) * (role === 'Marksman' || role === 'Fighter' ? 1.6 : 0.3);
  const moveSpeed = (s.moveSpeed ?? 0) * (role === 'Marksman' || role === 'Assassin' ? 2.0 : 0.6);
  const passive = item.tier === 'Starting' ? 10 : item.tier === 'Component' ? 3 : 35;
  const mana = championName === 'Raijin' ? (s.mana ?? 0) * 0.5 + (s.manaRegen ?? 0) * 30 : 0;
  return attack + magic + health + defense + speed + crit + haste + armorPen + lethality + magicPen + lifesteal + moveSpeed + passive + mana;
}

export function getItemPurchasePlan(role: AvatarRole, inventory: ItemDef[], gold: number, championName: string, catalog: ItemDef[]): ItemPurchasePlan | null {
  const resolvedRole = effectiveRole(role, championName);
  const owned = new Set(inventory.map(item => item.id));
  const fullItems = catalog.filter(item => item.tier === 'Legendary' || item.tier === 'Mythic')
    .filter(item => item.suitableRoles.includes(resolvedRole) && !owned.has(item.id));
  const plans: (ItemPurchasePlan & { gain: number })[] = [];

  for (const item of fullItems) {
    const recipe = RECIPES[item.id] ?? [];
    const removed = inventory.filter(ownedItem => recipe.includes(ownedItem.id) && ownedItem.tier === 'Component');
    let cost = item.cost - removed.reduce((sum, component) => sum + component.cost, 0);
    let reason: ItemPurchasePlan['reason'] = removed.length ? 'complete' : 'buy';
    if (inventory.length - removed.length >= 6) {
      const replaceable = inventory.filter(ownedItem => !removed.includes(ownedItem))
        .sort((a, b) => score(a, resolvedRole, championName) - score(b, resolvedRole, championName))[0];
      if (!replaceable || score(item, resolvedRole, championName) < score(replaceable, resolvedRole, championName) * 1.22) continue;
      removed.push(replaceable);
      cost -= Math.floor(replaceable.cost * (replaceable.tier === 'Starting' ? 0.4 : 0.6));
      reason = 'replace';
    }
    if (cost > gold) continue;
    const gain = score(item, resolvedRole, championName) - removed.reduce((sum, old) => sum + score(old, resolvedRole, championName), 0);
    if (gain <= 0) continue;
    plans.push({ item, removed, goldCost: Math.max(0, cost), reason, gain });
  }
  plans.sort((a, b) => Number(b.reason === 'complete') - Number(a.reason === 'complete')
    || b.gain - a.gain || a.goldCost - b.goldCost);
  if (plans[0]) return plans[0];

  // When a completed item is close, save the gold instead of filling slots with unrelated parts.
  if (inventory.some(item => item.tier === 'Component') || inventory.length >= 5 || gold >= 2100) return null;
  const component = catalog.filter(item => item.tier === 'Component' && item.suitableRoles.includes(resolvedRole)
    && !owned.has(item.id) && item.cost <= gold)
    .sort((a, b) => score(b, resolvedRole, championName) - score(a, resolvedRole, championName))[0];
  return component ? { item: component, removed: [], goldCost: component.cost, reason: 'buy' } : null;
}
