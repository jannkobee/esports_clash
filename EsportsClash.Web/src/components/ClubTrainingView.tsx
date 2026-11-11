import {CountryFlag} from './CountryFlag';
import {FpsPlayerRole} from './FpsPlayerRole';
import {FPS_ATTRIBUTE_LABELS} from '../fps/fpsPersonality';
import { useEffect, useState } from 'react';
import { GraduationCap, CalendarDays } from 'lucide-react';
import { useAccount } from '../AccountContext';
import { request } from '../cloudPersistence';
import { pediaHref } from '../hexapedia';
import { toScale10 } from '../marketBatchEngine';

interface Trainee {id:string;definition:{name:string;ovr:number;age:number;preferredRole?:string;role?:string;nationality?:{code?:string;name:string};stats:Record<string,number>};training_xp:number;training_progress:{earned_xp:number;skill_steps:number;next_step_at:number}|null}
const skills=Object.entries(FPS_ATTRIBUTE_LABELS);

export function ClubTrainingView(){
  const {session}=useAccount();const [players,setPlayers]=useState<Trainee[]|null>(null);const [error,setError]=useState('');
  useEffect(()=>{if(!session)return;const abort=new AbortController();const load=()=>void request<{data:{cards:Trainee[]}}>('/online',session,{signal:abort.signal}).then(r=>{setPlayers(r.data.cards);setError('');}).catch(e=>{if(!abort.signal.aborted)setError((e as Error).message);});load();const timer=window.setInterval(load,30000);return()=>{abort.abort();window.clearInterval(timer);};},[session]);
  return <section className="cm-panel"><h2 className="cm-panel-header"><GraduationCap size={15}/> Club player development</h2><div className="cm-panel-body space-y-3"><p>Players develop through verified scheduled Arena matches. The server posts match training at the start of the next Manila week. Transfers preserve the same player and their development.</p><p className="club-help"><CalendarDays size={13} className="inline"/> New players begin with modest skills. More advanced improvements take progressively more match experience.</p>{error&&<p role="alert">{error}</p>}{!players&&!error&&<p role="status">Loading your contracted players…</p>}<div className="cm-table-wrap"><table className="cm-table"><thead><tr><th>Player</th><th>Nationality</th><th>Role</th><th>Age</th><th>Overall</th>{skills.map(([key,label])=><th key={key}>{label}</th>)}<th>Match XP</th><th>Next improvement</th></tr></thead><tbody>{players?.map(p=><tr key={p.id}><th scope="row"><a href={pediaHref('players',p.id)}>{p.definition.name}</a></th><td>{p.definition.nationality?<CountryFlag code={p.definition.nationality.code} name={p.definition.nationality.name} showName/>:'Pending roster update'}</td><td><FpsPlayerRole stats={p.definition.stats}/></td><td>{p.definition.age}</td><td>{toScale10(p.definition.ovr)}/10</td>{skills.map(([key])=><td key={key}>{toScale10(p.definition.stats[key]??0)}/10</td>)}<td>{p.training_xp}</td><td>{p.training_progress?`${p.training_progress.earned_xp} / ${p.training_progress.next_step_at} earned XP`:'Pending roster update'}</td></tr>)}</tbody></table></div><p><a className="cm-btn" href="#match-centre?club=calendar">Prepare the next scheduled match</a> <a className="cm-btn" href="#transfer-exchange">Youth academy & transfers</a></p></div></section>;
}
