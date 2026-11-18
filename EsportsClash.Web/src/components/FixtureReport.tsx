import {CountryFlag} from './CountryFlag';
import {useEffect,useState} from 'react';
import {useAccount} from '../AccountContext';
import {request} from '../cloudPersistence';
import {pediaHref,pediaTime} from '../hexapedia';
import {FPS_POSITION_LABELS} from '../fps/fpsIdentity';
import './world-media.css';

type Side='blue'|'red';
interface Round {round:number;winner:Side|null;side:'attackers'|'defenders'|null;reason:string|null;site:string|null;pistol:boolean;score:{blue:number|null;red:number|null};seconds:number|null}
interface PlayerLine {id:string;name:string;team:Side;avatar?:string|null;nationality:{code?:string;name:string}|null;rating?:number;stats?:{kills:number;deaths:number;assists:number;adr:number;headshot_rate:number;first_bloods:number;trade_kills:number;clutches_won:number;plants:number;defuses:number}}
interface ClubDebrief {side:Side;coach:string|null;gameplan:{key:string;label:string;low:string;high:string;level:number}[];fixture_plan:{gameplan?:Record<string,number>;instructions?:Record<string,string>}|null;
  players:{id:string;name:string;positions:{t:string|null;ct:string|null};instruction:string|null;training_focus:string|null;rounds_played:number;observed:{metric:string;label:string;attempts:number;opportunities:number}[]}[];notice:string}
interface VerifiedReport {execution?:{mode:string;notice?:string};format:'fps'|'legacy';competition:string;kickoff_at:string;started_at:string;completed_at:string;clubs:Record<string,string>;winner:Side;verified:boolean;
  duration_seconds:number|null;map:{id:string|null;name:string|null}|null;score:Record<Side,number>|null;half_score:Record<Side,number>|null;second_half_score:Record<Side,number>|null;overtime_score?:Record<Side,number>|null;
  rounds:Round[];blue_kills:number|null;red_kills:number|null;players:PlayerLine[];events:{second:number;text:string}[];club?:ClubDebrief}

const clock=(s:number)=>`${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;

/** Round strip: who won each round and how, with pistol rounds and the halves marked. */
function RoundStrip({rounds,clubs}:{rounds:Round[];clubs:Record<string,string>}) {
  return <ol className="report-rounds" aria-label="Rounds">{rounds.map(r=><li key={r.round} className={`report-round is-${r.winner??'none'}${r.pistol?' is-pistol':''}${r.round===16||r.round===31?' is-half':''}`}
    title={`Round ${r.round}: ${r.winner?clubs[r.winner]:'—'}${r.reason?' · '+r.reason:''}${r.site?' (site '+r.site+')':''}${r.pistol?' · pistol round':''} · ${r.score.blue}–${r.score.red}`}>
    <span className="sr-only">Round {r.round}: {r.winner?clubs[r.winner]:'no winner'}{r.reason?', '+r.reason:''}.</span><b aria-hidden="true">{r.round}</b></li>)}</ol>;
}

function PlayerTable({players,clubs}:{players:PlayerLine[];clubs:Record<string,string>}) {
  const fps=players.some(p=>p.stats);
  return <div className="cm-table-wrap"><table className="cm-table report-players"><thead><tr><th>Player</th><th>Club</th>{fps?<><th title="Kills–deaths–assists">K–D–A</th><th title="Average damage per round">ADR</th><th title="Opening kills">Openers</th><th>Trades</th><th>Clutches</th><th title="Match rating, 1–10">Rating</th></>:<><th>Nationality</th><th>Avatar</th></>}</tr></thead>
    <tbody>{(['blue','red'] as const).map(side=>players.filter(p=>p.team===side).sort((a,b)=>(b.stats?.kills??0)-(a.stats?.kills??0)).map(p=><tr key={p.id}><th scope="row" className="cm-row-head"><a href={pediaHref('players',p.id)}>{p.name}</a>{p.nationality&&<small className="block"><CountryFlag code={p.nationality.code} name={p.nationality.name} showName/></small>}</th><td>{clubs[p.team]}</td>
      {fps?<><td>{p.stats?`${p.stats.kills}–${p.stats.deaths}–${p.stats.assists}`:'—'}</td><td>{p.stats?.adr??'—'}</td><td>{p.stats?.first_bloods??'—'}</td><td>{p.stats?.trade_kills??'—'}</td><td>{p.stats?.clutches_won??'—'}</td><td>{p.rating!=null?p.rating.toFixed(1):'—'}</td></>
        :<><td>{p.nationality?<CountryFlag code={p.nationality.code} name={p.nationality.name} showName/>:'Historical record'}</td><td>{p.avatar??'—'}</td></>}</tr>))}</tbody></table></div>;
}

/** Your side only: the plan that was pinned for this match and what your players were observed doing. */
function YourPlan({club}:{club:ClubDebrief}) {
  const instruction:Record<string,string>={balanced:'Balanced',hold:'Hold',initiative:'Take initiative',support:'Support'};
  return <section className="report-plan"><h4>Your plan in this match</h4>
    <p className="club-help">Only your club sees this. {club.notice}{club.fixture_plan?' A fixture-specific plan was used.':''}</p>
    {club.gameplan.length>0&&<dl className="report-gameplan">{club.gameplan.map(g=><div key={g.key}><dt>{g.label}</dt><dd><b>{g.level}</b><small>/10 · {g.level<=4?g.low:g.level>=7?g.high:'Balanced'}</small></dd></div>)}</dl>}
    <div className="cm-table-wrap"><table className="cm-table"><thead><tr><th>Player</th><th>Positions</th><th>Instruction</th><th>Observed in this match</th></tr></thead><tbody>{club.players.map(p=><tr key={p.id}>
      <th scope="row" className="cm-row-head">{p.name}</th>
      <td>{p.positions.t?FPS_POSITION_LABELS[p.positions.t as keyof typeof FPS_POSITION_LABELS]??p.positions.t:'—'}<small className="block">{p.positions.ct?FPS_POSITION_LABELS[p.positions.ct as keyof typeof FPS_POSITION_LABELS]??p.positions.ct:'—'}</small></td>
      <td>{p.instruction?instruction[p.instruction]??p.instruction:'—'}</td>
      <td>{p.observed.length?<ul className="report-observed">{p.observed.map(o=><li key={o.metric}>{o.label}: <b>{o.attempts} of {o.opportunities}</b></li>)}</ul>:<small>No recorded decisions</small>}</td>
    </tr>)}</tbody></table></div>
  </section>;
}

/**
 * The verified report of a settled fixture. Everyone sees the scoreline, rounds and player lines; the owning
 * club also sees its pinned plan and its players' observed decisions. Built from the stored result, so it
 * stays available after the replay expires.
 */
export function FixtureReport({id}:{id:number}) {
  const {session}=useAccount();
  const [data,setData]=useState<VerifiedReport|null>(null),[error,setError]=useState('');
  const [logOpen,setLogOpen]=useState(false),[eventPage,setEventPage]=useState(0);
  const eventCount=data?.events.length??0;
  const eventStart=eventPage*100,eventEnd=Math.min(eventCount,eventStart+100);
  useEffect(()=>{setData(null);setError('');setEventPage(0);setLogOpen(false);},[id]);
  useEffect(()=>{const c=new AbortController();
    const publicReport=()=>request<{data:VerifiedReport}>(`/world/reports/${id}`,null,{signal:c.signal});
    // Your own fixtures open the debrief with your plan; anything else (or a signed-out visitor) gets the public report.
    void (session?request<{data:VerifiedReport}>(`/online/fixtures/${id}/debrief`,session,{signal:c.signal}).catch(()=>publicReport()):publicReport())
      .then(r=>setData(r.data)).catch(e=>{if(!c.signal.aborted)setError(e.message);});return()=>c.abort();},[id,session]);
  const scoreLine=data?.score?`${data.score.blue}–${data.score.red}`:null;
  return <section className="world-report"><h3>Match report</h3>{error&&<p role="alert">{error}</p>}{data?<>
    {data.execution?.mode==='owner_requested_fast_forward'&&<p className="world-provenance">Owner-requested simulated completion. Original live frames are retained; later match frames are sampled. All event timestamps come from the same simulation.</p>}
    <p className="report-headline"><strong>{data.clubs[data.winner]}</strong> won{scoreLine?<> <b>{scoreLine}</b></>:null}{data.map?.name?<> on {data.map.name}</>:null} · {data.competition}{data.verified?'':' · result not verified'}</p>
    <dl className="club-facts">
      {data.half_score&&<div><dt>First half</dt><dd>{data.half_score.blue}–{data.half_score.red}</dd></div>}
      {data.second_half_score&&<div><dt>Second half</dt><dd>{data.second_half_score.blue}–{data.second_half_score.red}</dd></div>}
      {data.overtime_score&&<div><dt>Overtime</dt><dd>{data.overtime_score.blue}–{data.overtime_score.red}</dd></div>}
      {data.duration_seconds!=null&&<div><dt>Played time</dt><dd>{clock(data.duration_seconds)}</dd></div>}
      <div><dt>Scheduled</dt><dd>{pediaTime(data.kickoff_at)}</dd></div>
      {data.format==='legacy'&&<div><dt>Total kills</dt><dd>{data.blue_kills??'Not recorded'} : {data.red_kills??'Not recorded'}</dd></div>}
    </dl>
    {data.rounds.length>0&&<><h4>Rounds <small className="club-help">{data.clubs.blue} first · pistol rounds outlined</small></h4><RoundStrip rounds={data.rounds} clubs={data.clubs}/>
      <p className="club-help report-legend"><span className="report-round is-blue"/> {data.clubs.blue} <span className="report-round is-red"/> {data.clubs.red}</p></>}
    <h4>Players</h4>
    <PlayerTable players={data.players} clubs={data.clubs}/>
    {data.club&&<YourPlan club={data.club}/>}
    <details open={logOpen} onToggle={e=>setLogOpen(e.currentTarget.open)}><summary>Event log ({data.events.length})</summary><div className="club-commentary-pages"><button className="cm-btn" disabled={eventPage===0} onClick={()=>setEventPage(p=>p-1)}>Earlier events</button><span>{eventCount?eventStart+1:0}-{eventEnd} of {eventCount}</span><button className="cm-btn" disabled={eventEnd>=eventCount} onClick={()=>setEventPage(p=>p+1)}>Later events</button></div>{logOpen&&<ol className="world-events">{data.events.slice(eventStart,eventEnd).map((e,i)=><li key={i}><time>{clock(e.second)}</time> {e.text.replace(/^[\p{Extended_Pictographic}️ ]+/u,'')}</li>)}</ol>}</details>
    <p className="club-help">Statistics come from the match recording. Nothing missing is inferred from the score.</p>
  </>:!error&&<p role="status">Opening the match report…</p>}</section>;
}

export function ExpandableFixtureReport({id}:{id:number}){
  const [opened,setOpened]=useState(false);
  return <details onToggle={event=>setOpened(event.currentTarget.open)}><summary>Match report</summary>{opened&&<FixtureReport id={id}/>}</details>;
}
