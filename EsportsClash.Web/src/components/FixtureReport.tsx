import {CountryFlag} from './CountryFlag';
import {useEffect,useState} from 'react';
import {request} from '../cloudPersistence';
import {pediaHref,pediaTime} from '../hexapedia';
import './world-media.css';

interface VerifiedReport {execution?:{mode:string;notice?:string};competition:string;kickoff_at:string;started_at:string;completed_at:string;clubs:Record<string,string>;winner:string;duration_seconds:number;blue_kills:number|null;red_kills:number|null;players:{id:string;name:string;team:string;avatar:string;nationality:{code?:string;name:string}|null}[];events:{second:number;text:string}[]}
export function FixtureReport({id}:{id:number}) {
  const [data,setData]=useState<VerifiedReport|null>(null),[error,setError]=useState('');
  const [logOpen,setLogOpen]=useState(false),[eventPage,setEventPage]=useState(0);
  const eventCount=data?.events.length??0;
  const eventStart=eventPage*100,eventEnd=Math.min(eventCount,eventStart+100);
  useEffect(()=>{setData(null);setEventPage(0);setLogOpen(false);},[id]);
  useEffect(()=>{const c=new AbortController();void request<{data:VerifiedReport}>(`/world/reports/${id}`,null,{signal:c.signal}).then(r=>setData(r.data)).catch(e=>{if(!c.signal.aborted)setError(e.message);});return()=>c.abort();},[id]);
  return <section className="world-report"><h3>Verified match report</h3>{error&&<p role="alert">{error}</p>}{data?<>{data.execution?.mode==='owner_requested_fast_forward'&&<p className="world-provenance">Owner-requested simulated completion. Original live frames are retained; later match frames are sampled. All event timestamps come from the same simulation.</p>}<p>{data.clubs[data.winner]} won {data.competition}. {Math.floor(data.duration_seconds/60)}:{String(Math.floor(data.duration_seconds%60)).padStart(2,'0')} match time.</p><dl className="club-facts"><div><dt>Scheduled</dt><dd>{pediaTime(data.kickoff_at)}</dd></div><div><dt>Server started</dt><dd>{pediaTime(data.started_at)}</dd></div><div><dt>Finalized</dt><dd>{pediaTime(data.completed_at)}</dd></div><div><dt>Total kills</dt><dd>{data.blue_kills??'Not recorded'} : {data.red_kills??'Not recorded'}</dd></div></dl><div className="cm-table-wrap"><table className="cm-table"><thead><tr><th>Player at kickoff</th><th>Club</th><th>Nationality</th><th>Avatar</th></tr></thead><tbody>{data.players.map(p=><tr key={p.id}><td><a href={pediaHref('players',p.id)}>{p.name}</a></td><td>{data.clubs[p.team]}</td><td>{p.nationality?<CountryFlag code={p.nationality.code} name={p.nationality.name} showName/>:'Historical record'}</td><td>{p.avatar}</td></tr>)}</tbody></table></div><details open={logOpen} onToggle={e=>setLogOpen(e.currentTarget.open)}><summary>Precise event report ({data.events.length})</summary><div className="club-commentary-pages"><button className="cm-btn" disabled={eventPage===0} onClick={()=>setEventPage(p=>p-1)}>Earlier events</button><span>{eventCount?eventStart+1:0}-{eventEnd} of {eventCount}</span><button className="cm-btn" disabled={eventEnd>=eventCount} onClick={()=>setEventPage(p=>p+1)}>Later events</button></div>{logOpen&&<ol className="world-events">{data.events.slice(eventStart,eventEnd).map((e,i)=><li key={i}><time>{Math.floor(e.second/60)}:{String(Math.floor(e.second%60)).padStart(2,'0')}</time> {e.text.replace(/^[\p{Extended_Pictographic}\uFE0F ]+/u,'')}</li>)}</ol>}</details><p className="club-help">The match recording contains individual combat statistics. Unrecorded statistics are never inferred from the team score.</p></>:!error&&<p role="status">Opening verified report…</p>}</section>;
}

export function ExpandableFixtureReport({id}:{id:number}){
  const [opened,setOpened]=useState(false);
  return <details onToggle={event=>setOpened(event.currentTarget.open)}><summary>Detailed game report</summary>{opened&&<FixtureReport id={id}/>}</details>;
}
