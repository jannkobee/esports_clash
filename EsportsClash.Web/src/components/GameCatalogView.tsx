import { useMemo, useState } from 'react';
import { CHAMPIONS } from '../mockData';
import { ALL_ITEMS, BOOTS } from '../itemsData';
import { bundledContent, contentChampion } from '../gameContent';
import { useGameContent, useGameContentConnection } from '../GameContentContext';
import { ContentImage } from './ContentImage';

export function GameCatalogView() {
  const snapshot = useGameContent();
  const connection = useGameContentConnection();
  const [kind, setKind] = useState<'item' | 'skill'>('item');
  const [search, setSearch] = useState('');
  const [avatar, setAvatar] = useState('');

  const rows = useMemo(() => {
    const original = bundledContent(
      CHAMPIONS.map((c) => contentChampion(c, snapshot)),
      [...ALL_ITEMS, BOOTS],
      []
    );
    const bindings = new Set(original.filter((r) => r.kind === 'skill').map((r) => r.id));
    return snapshot
      ? [
          ...snapshot.records.filter((r) => r.kind === 'item' || (r.data.slot === 'library' && !r.deleted)),
          ...original.filter((r) => r.kind === 'skill' && bindings.has(r.id))
        ]
      : original;
  }, [snapshot]);

  const visible = rows.filter(
    (row) =>
      !row.deleted &&
      row.kind === kind &&
      (!avatar || kind === 'item' || row.data.avatarName === avatar) &&
      `${row.data.name} ${row.data.desc ?? row.data.passiveDesc} ${row.data.avatarName ?? ''}`
        .toLowerCase()
        .includes(search.toLowerCase())
  );

  return (
    <section className="space-y-4" aria-label="Items and skills catalog">
      <div className="cm-panel">
        <div className="cm-panel-header">
          <span>Items &amp; Skills Database</span>
          <span className="cm-badge cm-badge-gold" aria-live="polite">
            {visible.length} entries
          </span>
        </div>
        <div className="cm-panel-body space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Catalog category">
              {(['item', 'skill'] as const).map((value) => (
                <button
                  type="button"
                  key={value}
                  onClick={() => setKind(value)}
                  aria-pressed={kind === value}
                  className={`cm-btn ${kind === value ? 'cm-btn-primary' : ''}`}
                >
                  {value === 'item' ? 'Items' : 'Skills & abilities'}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 text-xs text-[#313a48]">
              <span>
                {connection.status === 'connected'
                  ? 'Connected to backoffice'
                  : connection.status === 'stale'
                  ? 'Disconnected · last published catalog'
                  : 'Offline · bundled catalog'}
              </span>
              <button type="button" onClick={connection.refresh} className="cm-btn py-1 px-2.5 text-xs">
                Refresh catalog
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <label className="min-w-0 flex-1 text-xs font-bold text-[#313a48]">
              Search
              <input
                className="cm-input mt-1 w-full"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Name, avatar or description"
              />
            </label>
            {kind === 'skill' && (
              <label className="text-xs font-bold text-[#313a48]">
                Avatar
                <select
                  className="cm-select mt-1 block"
                  value={avatar}
                  onChange={(event) => setAvatar(event.target.value)}
                >
                  <option value="">All avatars</option>
                  {[...new Set(rows.filter((row) => !row.deleted && row.data.avatarName).map((row) => String(row.data.avatarName)))]
                    .sort()
                    .map((name) => (
                      <option key={name}>{name}</option>
                    ))}
                </select>
              </label>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((row) => {
          const d = row.data;
          return (
            <article key={row.id} className="cm-panel min-w-0">
              <div className="cm-panel-header">
                <span className="truncate">{String(d.name)}</span>
                <span className="cm-badge cm-badge-gold">
                  {kind === 'item' ? `${d.cost}g` : String(d.slot)}
                </span>
              </div>
              <div className="cm-panel-body space-y-2">
                <div className="flex items-center gap-3">
                  <ContentImage
                    image={d.image as string | undefined}
                    name={String(d.name)}
                    fallback={d.icon as string | undefined}
                  />
                  <div className="min-w-0 text-xs text-[#143570] font-bold">
                    {kind === 'item'
                      ? `${d.tier} · ${d.cost} gold`
                      : `${d.avatarName ?? 'Library'} · ${d.slot}`}
                  </div>
                </div>
                <p className="text-xs leading-relaxed text-[#313a48]">{String(d.desc ?? d.passiveDesc)}</p>
                {kind === 'item' ? (
                  <>
                    <p className="text-xs font-bold text-[#0b1f44]">{String(d.passiveName)}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(d.stats as Record<string, number>)
                        .filter(([, value]) => value !== 0)
                        .map(([key, value]) => (
                          <span key={key} className="cm-badge cm-badge-blue">
                            +{value} {key}
                          </span>
                        ))}
                    </div>
                  </>
                ) : (
                  d.slot !== 'passive' && (
                    <p className="text-xs font-mono font-bold text-[#0b1f44]">
                      {String(d.damage)} base damage · {String(d.cooldown)}s base cooldown
                    </p>
                  )
                )}
                {d.slot === 'library' && (
                  <p className="text-[11px] text-[#566173]">Library concept · no playable slot assigned</p>
                )}
              </div>
            </article>
          );
        })}
      </div>
      {visible.length === 0 && (
        <p className="bg-white border border-[#b4bcc8] p-6 text-xs text-[#566173] text-center">
          No matching entries. Try another search.
        </p>
      )}
    </section>
  );
}
