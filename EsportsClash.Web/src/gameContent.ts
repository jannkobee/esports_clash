import type { ChampionKit, ChampionSkill, ItemDef } from './types';
import type { KaelenInvokedSpell } from './kaelenAbilities';

export interface ContentRecord {
  id: string;
  kind: 'item' | 'skill' | 'avatar';
  version: number;
  builtin: boolean;
  deleted: boolean;
  data: Record<string, unknown>;
}
export interface GameContentSnapshot { schema: 1; hash: string; records: ContentRecord[] }
const slots = ['skill1', 'skill2', 'ultimate'] as const;
const avatarStats = {hp:[1,20000],ad:[0,2000],armor:[0,1000],mr:[0,1000],aspd:[.1,5],range:[.1,30]} as const;
const avatarText = ['displayName','title','archetype','lore','primaryColor','accentColor'] as const;
const finite = (value: unknown, max: number) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max;
const imagePattern = /^[a-f0-9]{64}\.(png|jpg|webp)$/;
export function catalogImageUrl(image: unknown, base: string): string | undefined {
  return typeof image === 'string' && imagePattern.test(image) ? `${base.replace(/\/$/, '')}/game-content/images/${image}` : undefined;
}

/** Reject incomplete/untrusted catalogs as a unit rather than mixing partial combat data. */
export function validateGameContent(value: unknown): GameContentSnapshot | undefined {
  if (!value || typeof value !== 'object') return;
  const snapshot = value as GameContentSnapshot;
  if (snapshot.schema !== 1 || !/^[a-f0-9]{64}$/.test(snapshot.hash) || !Array.isArray(snapshot.records) || snapshot.records.length > 5000) return;
  const ids = new Set<string>();
  for (const row of snapshot.records) {
    if (!row || typeof row.id !== 'string' || !/^[a-zA-Z0-9_:\-]{1,100}$/.test(row.id) || ids.has(row.id)
      || !['item','skill','avatar'].includes(row.kind) || typeof row.deleted !== 'boolean' || typeof row.builtin !== 'boolean'
      || !Number.isSafeInteger(row.version) || row.version < 1 || !row.data || typeof row.data !== 'object') return;
    ids.add(row.id);
    const d = row.data;
    if (typeof d.name !== 'string' || d.name.length > 150 || (d.image !== undefined && (typeof d.image !== 'string' || !imagePattern.test(d.image)))) return;
    if (row.kind === 'avatar') {
      if(row.deleted || !row.builtin || !row.id.startsWith('c_') || typeof d.internalName!=='string' || typeof d.canonicalId!=='string'
        || typeof d.abilityRuleset!=='string' || !['Tank','Mage','Marksman','Support','Fighter','Assassin'].includes(String(d.primaryRole))
        || !avatarText.every(key=>typeof d[key]==='string' && String(d[key]).length<=6000)
        || !['primaryColor','accentColor'].every(key=>/^#[a-fA-F0-9]{6}$/.test(String(d[key])))
        || !Object.entries(avatarStats).every(([key,[min,max]])=>finite(d[key],max)&&Number(d[key])>=min))return;
    } else if (row.kind === 'item') {
      if (!finite(d.cost, 50000) || !Number.isInteger(d.cost) || !['Starting','Component','Legendary','Mythic'].includes(String(d.tier))
        || !d.stats || typeof d.stats !== 'object' || !Array.isArray(d.suitableRoles) || !d.suitableRoles.length
        || !d.suitableRoles.every(role => ['Tank','Mage','Marksman','Support','Fighter','Assassin'].includes(role))
        || typeof d.passiveName !== 'string' || typeof d.passiveDesc !== 'string') return;
      if (!Object.values(d.stats).every(v => finite(v, 10000))) return;
    } else {
      if (typeof d.desc !== 'string' || !['passive','skill1','skill2','ultimate','invoked','library'].includes(String(d.slot))) return;
      if (d.slot !== 'passive' && (!finite(d.damage,20000) || !finite(d.cooldown,600))) return;
    }
  }
  // A truncated response must never remove the roster's mechanical defaults.
  return structuredClone(snapshot);
}

export function contentChampion(champion: ChampionKit, snapshot?: GameContentSnapshot): ChampionKit {
  if (!snapshot) return champion;
  const result = structuredClone(champion);
  const avatar=snapshot.records.find(row=>row.kind==='avatar'&&row.id===champion.id&&!row.deleted);
  if(avatar && avatar.data.abilityRuleset===champion.abilityRuleset && avatar.data.internalName===(champion.legacyInternalName??champion.name)) {
    // Runtime dispatch names, stable IDs and mechanical handlers are never replaced by prose.
    for(const key of [...avatarText,...Object.keys(avatarStats)] as (keyof ChampionKit)[])
      Object.assign(result,{[key]:avatar.data[key]});
  }
  for (const row of snapshot.records) {
    if (row.kind !== 'skill' || row.data.avatarId !== champion.id) continue;
    if(champion.abilityRuleset&&row.data.abilityRuleset!==champion.abilityRuleset)continue;
    const slot = row.data.slot;
    if (slot === 'passive') {
      result.passiveImage = row.deleted ? undefined : row.data.image as string | undefined;
      if (!row.deleted) { result.passiveDesc = String(row.data.desc);result.passiveName=String(row.data.name); }
    } else if (slots.includes(slot as typeof slots[number])) {
      const key = slot as typeof slots[number];
      const source = champion[key], data = row.data;
      const cooldownBase=source.catalogCooldownBase??source.cooldown;
      result[key] = { ...source, name: String(data.name), desc: String(data.desc), image: data.image as string | undefined,
        damage: champion.abilityRuleset?source.damage:Number(data.damage), cooldown: Number(data.cooldown), disabled: row.deleted,
        catalogCooldownBase:cooldownBase,
        catalogCooldownOverride: Number(data.cooldown) !== cooldownBase ? Number(data.cooldown) : undefined };
    }
  }
  return result;
}

export function contentItems(items: readonly ItemDef[], boots: ItemDef, snapshot?: GameContentSnapshot): { items: ItemDef[]; boots?: ItemDef } {
  if (!snapshot) return { items: structuredClone([...items]), boots: structuredClone(boots) };
  const entries = snapshot.records.filter(row => row.kind === 'item' && !row.deleted)
    .map(row => ({ ...structuredClone(row.data), id: row.id }) as unknown as ItemDef);
  // Existing recommendation ties use authored catalog order, not database ID order.
  const order=new Map([...items,boots].map((item,index)=>[item.id,index]));
  entries.sort((a,b)=>(order.get(a.id)??Number.MAX_SAFE_INTEGER)-(order.get(b.id)??Number.MAX_SAFE_INTEGER)||a.id.localeCompare(b.id));
  return { items: entries.filter(item => item.id !== boots.id), boots: entries.find(item => item.id === boots.id) };
}

export function contentInvokedSpells(spells: readonly KaelenInvokedSpell[], snapshot?: GameContentSnapshot): KaelenInvokedSpell[] {
  return spells.map(spell => {
    const row = snapshot?.records.find(row => row.kind === 'skill' && row.data.slot === 'invoked' && row.data.spellId === spell.id);
    return row ? { ...structuredClone(spell), name: String(row.data.name), description: String(row.data.desc),
      damage: Number(row.data.damage), cooldown: Number(row.data.cooldown), image: row.data.image as string | undefined, disabled: row.deleted } : spell;
  });
}

export function bundledContent(champions: readonly ChampionKit[], items: readonly ItemDef[], spells: readonly KaelenInvokedSpell[]): ContentRecord[] {
  const wrap = (id: string, kind: ContentRecord['kind'], data: object): ContentRecord => ({ id, kind, data: data as Record<string,unknown>, version: 1, builtin: true, deleted: false });
  return [
    ...items.map(item => wrap(item.id,'item',item)),
    ...champions.flatMap(champion => [
      wrap(`${champion.id}:passive`,'skill',{ name: champion.passiveName??champion.passiveDesc.split(':')[0].slice(0,100), desc: champion.passiveDesc, avatarId: champion.id, avatarName: champion.displayName, abilityRuleset:champion.abilityRuleset, slot:'passive' }),
      ...slots.map(slot => wrap(`${champion.id}:${slot}`,'skill',{ ...champion[slot], avatarId:champion.id, avatarName:champion.displayName, abilityRuleset:champion.abilityRuleset, slot })),
    ]),
    ...spells.map(spell => wrap(`invoked:${spell.id}`,'skill',{ ...spell, desc:spell.description, avatarName:'Arsenaldo', slot:'invoked', spellId:spell.id })),
  ];
}
