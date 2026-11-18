import {visibleInterval} from '../worldLive';
import {CountryFlag} from './CountryFlag';
import {FpsPlayerRole} from './FpsPlayerRole';
import {FPS_ATTRIBUTE_LABELS} from '../fps/fpsPersonality';
import {useEffect, useState} from 'react';
import {GraduationCap, Save} from 'lucide-react';
import {useAccount} from '../AccountContext';
import {request} from '../cloudPersistence';
import {pediaHref} from '../hexapedia';
import {fpsRated} from '../fps/fpsScale10';

interface Trainee {id:string;definition:{name:string;ovr:number;age:number;nationality?:{code?:string;name:string};stats:Record<string,number>};training_xp:number}
type Orders = {t?:string;ct?:string;instruction:string;training?:string};
interface System {revision:number;gameplan:Record<string,number>;instructions:Record<string,Orders>;starterIds?:string[]}
const skills = Object.entries(FPS_ATTRIBUTE_LABELS) as [keyof typeof FPS_ATTRIBUTE_LABELS, string][];

/**
 * The club's training plan. Each player trains one focus: system familiarity (the gameplan is learned faster,
 * attributes grow evenly) or one attribute (half of each training step goes into it). A focus shapes a player;
 * it never makes them grow faster overall. Levels are whole 1–10 values; progress toward the next level is not shown.
 */
export function ClubTrainingView(){
  const {session} = useAccount();
  const [players, setPlayers] = useState<Trainee[] | null>(null), [system, setSystem] = useState<System | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({}), [error, setError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!session) return;
    const abort = new AbortController();
    const load = () => void Promise.all([
      request<{data:{cards:Trainee[]}}>('/online', session, {signal: abort.signal}),
      request<{data:System}>('/online/fps-system', session, {signal: abort.signal}),
    ]).then(([online, fps]) => { setPlayers(online.data.cards); setSystem(fps.data); setError(''); })
      .catch(e => { if (!abort.signal.aborted) setError((e as Error).message); });
    load();
    const stop = visibleInterval(load, 60000);
    return () => { abort.abort(); stop(); };
  }, [session]);
  const focusOf = (id: string) => draft[id] ?? system?.instructions[id]?.training ?? 'system';
  const dirty = Object.keys(draft).some(id => draft[id] !== (system?.instructions[id]?.training ?? 'system'));
  async function save() {
    if (!session || !system) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const instructions: Record<string, Orders> = {...system.instructions};
      for (const [id, training] of Object.entries(draft)) instructions[id] = {...instructions[id], instruction: instructions[id]?.instruction ?? 'balanced', training};
      const r = await request<{data:System}>('/online/fps-system', session, {method: 'PUT', body: JSON.stringify({revision: system.revision, gameplan: system.gameplan, instructions})});
      setSystem(s => s ? {...s, ...r.data} : r.data); setDraft({});
      setNotice('Training plan saved. It applies from the next allocated match.');
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  const starters = new Set(system?.starterIds ?? []);
  return <section className="cm-panel"><h2 className="cm-panel-header"><GraduationCap size={15}/> Training plan</h2><div className="cm-panel-body space-y-3">
    <p>Players improve from verified matches; training posts at the start of each Manila week. Starters earn match XP. Reserves earn practice XP when the club plays a scrimmage (your performance coach sets how much).</p>
    <p className="club-help">Choose one focus per player. <b>System familiarity</b> spreads growth evenly and helps the players learn your gameplan. An <b>attribute focus</b> puts half of every step into that attribute. Total growth is the same either way. New levels are announced in your inbox.</p>
    {error && <p role="alert">{error}</p>}{notice && <p role="status" className="club-notice">{notice}</p>}
    {!players && !error && <p role="status">Loading your contracted players…</p>}
    {players && <div className="cm-table-wrap"><table className="cm-table"><thead><tr><th>Player</th><th>Role</th><th>Age</th><th>Overall</th>{skills.map(([key, label]) => <th key={key}>{label}</th>)}<th>Training focus</th></tr></thead>
      <tbody>{players.map(p => {
        const overall = fpsRated(p.definition.ovr, 'skill');
        return <tr key={p.id}><th scope="row" className="cm-row-head"><a href={pediaHref('players', p.id)}>{p.definition.name}</a>{p.definition.nationality && <small className="block"><CountryFlag code={p.definition.nationality.code} name={p.definition.nationality.name} showName/></small>}<small className="block">{starters.has(p.id) ? 'Starting five' : 'Reserve'}</small></th>
          <td><FpsPlayerRole stats={p.definition.stats}/></td><td>{p.definition.age}</td><td title={overall.label}>{overall.value}/10</td>
          {skills.map(([key]) => { const r = fpsRated(p.definition.stats[key] ?? 0, 'skill'); return <td key={key} title={r.label} className={focusOf(p.id) === key ? 'training-focus-cell' : undefined}>{r.value}</td>; })}
          <td><select aria-label={`Training focus for ${p.definition.name}`} disabled={busy || !system} value={focusOf(p.id)} onChange={e => setDraft(d => ({...d, [p.id]: e.target.value}))}>
            <option value="system">System familiarity</option>{skills.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select></td></tr>;
      })}</tbody></table></div>}
    <p className="squad-save"><span role="status">{dirty ? 'You have unsaved training changes.' : 'Training plan saved.'}</span>
      <button type="button" className="cm-btn" disabled={busy || !dirty} onClick={() => setDraft({})}>Undo changes</button>
      <button type="button" className="cm-btn cm-btn-primary" disabled={busy || !dirty} onClick={() => void save()}><Save size={13} aria-hidden="true"/>{busy ? 'Saving…' : 'Save training plan'}</button></p>
  </div></section>;
}
