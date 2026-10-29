import { useMemo, useState } from 'react';
import { CHAMPIONS } from '../mockData';
import { ALL_ITEMS, BOOTS } from '../itemsData';
import { KAELEN_INVOKED_SPELLS } from '../kaelenAbilities';
import { bundledContent, contentChampion } from '../gameContent';
import { useGameContent, useGameContentConnection } from '../GameContentContext';
import { ContentImage } from './ContentImage';

export function GameCatalogView() {
  const snapshot = useGameContent();
  const connection=useGameContentConnection();
  const [kind, setKind] = useState<'item'|'skill'>('item');
  const [search, setSearch] = useState('');
  const [avatar, setAvatar] = useState('');
  const rows = useMemo(() => {
    const original=bundledContent(CHAMPIONS.map(c=>contentChampion(c,snapshot)),[...ALL_ITEMS,BOOTS],[]);
    const bindings=new Set(original.filter(r=>r.kind==='skill').map(r=>r.id));
    return snapshot?[...snapshot.records.filter(r=>r.kind==='item'||r.data.slot==='library'&&!r.deleted),...original.filter(r=>r.kind==='skill'&&bindings.has(r.id))]:original;
  },[snapshot]);
  const visible = rows.filter(row => !row.deleted && row.kind === kind
    && (!avatar || kind === 'item' || row.data.avatarName === avatar)
    && `${row.data.name} ${row.data.desc ?? row.data.passiveDesc} ${row.data.avatarName ?? ''}`.toLowerCase().includes(search.toLowerCase()));
  return <section className="space-y-5" aria-label="Items and skills catalog">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-black text-white">Items & skills</h1><p className="mt-1 text-sm text-slate-400">Browse item bonuses and avatar abilities.</p></div><div className="text-right text-xs text-slate-400"><p>{connection.status==='connected'?'Connected to backoffice':connection.status==='stale'?'Disconnected · last published catalog':'Offline · bundled catalog'}</p><button onClick={connection.refresh} className="mt-2 rounded-lg border border-cyan-700 px-3 py-2 text-cyan-200">Refresh catalog</button></div></div>
    <div className="flex flex-wrap gap-2" role="group" aria-label="Catalog category">{(['item','skill'] as const).map(value => <button key={value} onClick={() => setKind(value)} aria-pressed={kind===value} className={`rounded-xl border px-5 py-2 font-bold ${kind===value?'border-cyan-400 bg-cyan-950 text-cyan-100':'border-slate-700 text-slate-400'}`}>{value==='item'?'Items':'Skills & abilities'}</button>)}</div>
    <div className="flex flex-wrap gap-3"><label className="min-w-0 flex-1 text-xs text-slate-400">Search<input className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Name, avatar or description" /></label>{kind==='skill'&&<label className="text-xs text-slate-400">Avatar<select className="mt-1 block rounded-xl border border-slate-700 bg-slate-950 p-3 text-white" value={avatar} onChange={event=>setAvatar(event.target.value)}><option value="">All avatars</option>{[...new Set(rows.filter(row=>!row.deleted&&row.data.avatarName).map(row=>String(row.data.avatarName)))].sort().map(name=><option key={name}>{name}</option>)}</select></label>}</div>
    <p className="text-xs text-slate-500" aria-live="polite">{visible.length} entries</p>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{visible.map(row=>{
      const d=row.data;
      return <article key={row.id} className="min-w-0 rounded-2xl border border-slate-700 bg-slate-900 p-4"><div className="mb-3 flex items-center gap-3"><ContentImage image={d.image as string|undefined} name={String(d.name)} fallback={d.icon as string|undefined}/><div className="min-w-0"><h2 className="break-words font-black text-white">{String(d.name)}</h2><p className="text-xs text-cyan-300">{kind==='item'?`${d.tier} · ${d.cost} gold`:`${d.avatarName??'Library'} · ${d.slot}`}</p></div></div>
        <p className="text-sm leading-relaxed text-slate-300">{String(d.desc??d.passiveDesc)}</p>
        {kind==='item'?<><p className="mt-3 text-xs font-bold text-amber-300">{String(d.passiveName)}</p><div className="mt-2 flex flex-wrap gap-2">{Object.entries(d.stats as Record<string,number>).filter(([,value])=>value!==0).map(([key,value])=><span key={key} className="rounded bg-slate-950 px-2 py-1 text-xs text-cyan-200">+{value} {key}</span>)}</div></>:d.slot!=='passive'&&<p className="mt-3 text-xs text-amber-300">{String(d.damage)} base damage · {String(d.cooldown)}s base cooldown</p>}
        {d.slot==='library'&&<p className="mt-2 text-xs text-slate-500">Library concept · no playable slot assigned</p>}
      </article>;
    })}</div>{visible.length===0&&<p className="rounded-xl border border-slate-700 p-6 text-slate-400">No matching entries. Try another search.</p>}
  </section>;
}
