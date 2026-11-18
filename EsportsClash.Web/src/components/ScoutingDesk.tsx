import {useEffect, useState} from 'react';
import {Binoculars} from 'lucide-react';
import {useAccount} from '../AccountContext';
import {request} from '../cloudPersistence';
import {pediaHref, pediaMoney, pediaTime} from '../hexapedia';
import {CountryFlag} from './CountryFlag';
import {FPS_ATTRIBUTE_LABELS} from '../fps/fpsPersonality';

type Range = {low: number; high: number};
interface Prospect {index: number; name: string; age: number; nationality: {id: number; code: string; name: string} | null; wage: number; estimates: Record<string, Range>}
interface Assignment {id: number; need: string; need_label: string; region_id: number | null; status: 'searching' | 'ready' | 'signed' | 'passed' | 'expired'; scout_quality: number; ready_at: string; expires_at: string | null; signed_player_id: string | null; shortlist: Prospect[] | null}
interface Desk {needs: Record<string, string>; regions: {id: number; name: string}[]; cost: number; search_hours: number; scout_quality: number; assignments: Assignment[]}

const range = (r?: Range) => !r ? '—' : r.low === r.high ? String(r.low) : `${r.low}–${r.high}`;
const label = (key: string) => key === 'overall' ? 'Overall' : key === 'potential' ? 'Potential' : FPS_ATTRIBUTE_LABELS[key as keyof typeof FPS_ATTRIBUTE_LABELS] ?? key;

/**
 * Brief a scout with what the squad needs; after the search, review three prospects with estimated whole
 * 1–10 levels (a better scout gives narrower ranges) and sign one or pass.
 */
export function ScoutingDesk({onSigned}: {onSigned?: () => void}) {
  const {session} = useAccount();
  const [desk, setDesk] = useState<Desk | null>(null), [error, setError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false), [revision, setRevision] = useState(0);
  const [need, setNeed] = useState('rifler'), [region, setRegion] = useState('');
  useEffect(() => {
    if (!session) return;
    const c = new AbortController();
    void request<{data: Desk}>('/online/scouting', session, {signal: c.signal}).then(r => setDesk(r.data)).catch(e => { if (!c.signal.aborted) setError((e as Error).message); });
    return () => c.abort();
  }, [session, revision]);
  async function act(path: string, body: unknown, message: string) {
    if (!session) return;
    setBusy(true); setError(''); setNotice('');
    try { await request(path, session, {method: 'POST', body: JSON.stringify(body)}); setNotice(message); setRevision(v => v + 1); onSigned?.(); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  if (!desk) return <section className="club-panel">{error ? <p role="alert">{error}</p> : <p role="status">Opening the scouting desk…</p>}</section>;
  const active = desk.assignments.find(a => a.status === 'searching' || a.status === 'ready');
  const history = desk.assignments.filter(a => a !== active);
  return <section className="club-panel scouting-desk">
    <h3><Binoculars size={17} aria-hidden="true" /> Scouting</h3>
    <p className="club-help">Tell your scout what the squad needs. After about {desk.search_hours} hours you get three prospects with estimated levels; your scout's quality ({desk.scout_quality}/10) sets how precise the estimates are. Each assignment costs {pediaMoney(desk.cost)}.</p>
    {error && <p role="alert" className="club-notice">{error}</p>}{notice && <p role="status" className="club-notice">{notice}</p>}
    {!active && <form className="scouting-brief" onSubmit={e => { e.preventDefault(); void act('/online/scouting', {need, region_id: region ? Number(region) : null}, 'Your scout is on the road.'); }}>
      <label>Position need<select value={need} onChange={e => setNeed(e.target.value)} disabled={busy}>{Object.entries(desk.needs).map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></label>
      <label>Region<select value={region} onChange={e => setRegion(e.target.value)} disabled={busy}><option value="">Anywhere</option>{desk.regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
      <button className="cm-btn cm-btn-primary" disabled={busy}>Send the scout · {pediaMoney(desk.cost)}</button>
    </form>}
    {active?.status === 'searching' && <p role="status">Searching for {active.need_label.toLowerCase()} prospects. The shortlist is due {pediaTime(active.ready_at)} Manila.</p>}
    {active?.status === 'ready' && active.shortlist && <>
      <p>Shortlist for <b>{active.need_label}</b> · choose before {active.expires_at ? pediaTime(active.expires_at) : 'it expires'} Manila.</p>
      <div className="cm-table-wrap"><table className="cm-table"><thead><tr><th>Prospect</th><th>Age</th>{Object.keys(active.shortlist[0].estimates).map(k => <th key={k}>{label(k)}</th>)}<th>Wage / week</th><th><span className="sr-only">Action</span></th></tr></thead>
        <tbody>{active.shortlist.map(p => <tr key={p.index}><th scope="row" className="cm-row-head">{p.name}{p.nationality && <small className="block"><CountryFlag code={p.nationality.code} name={p.nationality.name} showName /></small>}</th><td>{p.age}</td>
          {Object.keys(active.shortlist![0].estimates).map(k => <td key={k}>{range(p.estimates[k])}</td>)}<td>{pediaMoney(p.wage)}</td>
          <td><button type="button" className="cm-btn cm-btn-primary cm-btn-sm" disabled={busy} onClick={() => void act(`/online/scouting/${active.id}/sign`, {index: p.index}, `${p.name} has signed for your club.`)}>Sign</button></td></tr>)}</tbody></table></div>
      <p className="club-help">Estimates are ranges of whole 1–10 levels. Signing adds the player to your reserves at the wage shown.</p>
      <button type="button" className="cm-btn" disabled={busy} onClick={() => void act(`/online/scouting/${active.id}/pass`, {}, 'You passed on this shortlist.')}>Pass on all three</button>
    </>}
    {history.length > 0 && <details><summary>Past assignments ({history.length})</summary><ul className="scouting-history">{history.map(a => <li key={a.id}>{a.need_label} · {a.status === 'signed' && a.signed_player_id ? <a href={pediaHref('players', a.signed_player_id)}>signed</a> : a.status}</li>)}</ul></details>}
  </section>;
}
