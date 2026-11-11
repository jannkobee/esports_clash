import {FpsPlayerRole} from './FpsPlayerRole';
import {CountryFlag} from './CountryFlag';
import {canonicalRoute} from '../frontendRoutes';
import {onWorldUpdate} from '../worldLive';
import {ClubOfficeDesk} from './ClubOfficeDesk';
import {LabelIcon} from './LabelIcon';
import {WorldPlayerPortrait} from './WorldPlayerPortrait';
import {NewsFeed} from './WorldMedia';
import { useEffect, useState } from 'react';
import { CalendarDays, Coins, ClipboardList, Shield, Users, Trophy, UserRoundCog } from 'lucide-react';
import { useAccount } from '../AccountContext';
import { request } from '../cloudPersistence';
import { pediaHref, pediaMoney, pediaTime } from '../hexapedia';
import type { ClubIdentity } from './ClubIdentityEditor';
import { ReferenceMark } from './ReferenceIcon';
import { WorldActivity } from './WorldActivity';
import { toScale10 } from '../marketBatchEngine';
import './club-office.css';

type Tool='calendar'|'lineup'|'identity'|'friendly';
interface HomeClub {club:{id:number;name:string;tag:string|null;tier:number;identity:ClubIdentity|null;lineup:{instance_id:string;avatar_id:string}[]};cards:{id:string;training_xp:number;definition:{presentation?:import('../supporter').PlayerPresentation|null;id:string;name:string;ovr:number;stats?:Record<string,number>;role:string;preferredRole?:string;nationality?:{code:string;name:string}}}[]}
interface Fixture {id:number;competition:string;kickoff_at:string;orders_close_at:string;status:string;can_submit:boolean;match_id:string|null;clubs:{blue:{name:string};red:{name:string}}}
interface Money {available:number;academy_opened_at:string|null;youth_coach_wage:number}

export function ClubHome({onPlay,onMarket,onWatch}: {onPlay:(tool:Tool)=>void;onMarket:()=>void;onWatch:(id:string)=>void}) {
  const {session}=useAccount();
  const [club,setClub]=useState<HomeClub|null>(null);
  const [fixtures,setFixtures]=useState<Fixture[]>([]);
  const [money,setMoney]=useState<Money|null>(null);
  const [competition,setCompetition]=useState<{rating:{score:number;games:number}|null;circuit_points:number;titles:unknown[]}|null>(null);
  const [error,setError]=useState('');
  const [retry,setRetry]=useState(0);
  useEffect(()=>{
    if(!session)return;
    const controller=new AbortController();
    const load=()=>void Promise.all([
      request<{data:HomeClub}>('/online',session,{signal:controller.signal}),
      request<{data:Fixture[]}>('/online/fixtures',session,{signal:controller.signal}),
      request<{data:Money}>('/online/market?include_auctions=0',session,{signal:controller.signal}),
      request<{data:NonNullable<typeof competition>}>('/competitions/mine',session,{signal:controller.signal}),
    ]).then(([profile,schedule,balance,record])=>{setCompetition(record.data);setClub(profile.data);setFixtures(schedule.data);setMoney(balance.data);setError('');})
      .catch(problem=>{if(!controller.signal.aborted)setError((problem as Error).message);});
    load();const stopLive=onWorldUpdate(['fixtures','clubs','players','market','competitions'],load);const timer=window.setInterval(load,60000);
    return()=>{controller.abort();window.clearInterval(timer);stopLive();};
  },[session,retry]);
  if(!club)return <section className="cm-panel"><h2 className="cm-panel-header"><Shield size={15}/> My club</h2><div className="cm-panel-body">{error?<><p role="alert">{error}</p><button className="cm-btn mt-2" onClick={()=>setRetry(value=>value+1)}>Try again</button></>:<p role="status">Opening your club office…</p>}</div></section>;
  const next=fixtures.filter(fixture=>!['Completed','Failed'].includes(fixture.status)).sort((a,b)=>Date.parse(a.kickoff_at)-Date.parse(b.kickoff_at))[0];
  const recent=fixtures.filter(fixture=>fixture.status==='Completed').sort((a,b)=>Date.parse(b.kickoff_at)-Date.parse(a.kickoff_at)).slice(0,3);
  return <div className="club-office space-y-3">
    <div className="reference-panorama"><div><p className="cm-eyebrow">HEXATRICK / CLUB REGISTRY</p><h2><LabelIcon name="club registry" size={22}/>Your club. Its next chapter.</h2><p>Players, competition records and the decisions behind every matchday.</p></div><svg viewBox="0 0 700 160" aria-hidden="true"><g fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M50 155 210 10h330l120 145M150 155 270 40h230l90 115M265 155l80-75h110l50 75"/><path d="m460 15 22 13v26l-22 13-22-13V28Zm115 60 22 13v26l-22 13-22-13V88ZM320 5l22 13v26l-22 13-22-13V18Z"/><path d="M0 130h700M0 150h700M610 0v160M390 0v160" opacity=".5"/></g></svg></div>
    <nav className="office-portals" aria-label="World directory">{[['Your players','squad'],['Match history','history'],['Tournaments','hexapedia/tournaments'],['The Wire','wire'],['Hexacast broadcasts','hexacast'],['Transfer Exchange','market']].map(([label,route])=><a key={route} href={'#'+canonicalRoute(route)}><LabelIcon name={label} size={24}/><strong>{label}</strong></a>)}</nav>
    {error&&<p role="status" className="club-notice">Updates paused: {error}</p>}
    <div className="club-office-title"><ReferenceMark kind="teams" identity={club.club.identity}/><div><h2>{club.club.tag?<a href={pediaHref('teams',club.club.id)}>{club.club.name}</a>:club.club.name}</h2><p>{club.club.tag??'Set your club tag'} · Tier {club.club.tier}{club.club.identity?.city?' · '+club.club.identity.city:''}</p></div><button className="cm-btn" onClick={()=>onPlay('identity')}><UserRoundCog size={13}/> Club identity</button></div>
    <ClubOfficeDesk onWatch={onWatch}/>
    <div className="club-office-grid">
      <section className="cm-panel"><h2 className="cm-panel-header"><CalendarDays size={14}/> Club calendar</h2><div className="cm-panel-body space-y-3">{next?<><p className="club-help">{next.competition} · {next.status}</p><h3 className="font-bold">{next.clubs.blue.name} vs {next.clubs.red.name}</h3><dl className="club-facts"><div><dt>Kickoff · Manila</dt><dd>{pediaTime(next.kickoff_at)}</dd></div><div><dt>Orders close · Manila</dt><dd>{pediaTime(next.orders_close_at)}</dd></div></dl>{next.match_id&&next.status==='Live'?<button className="cm-btn cm-btn-primary" onClick={()=>onWatch(next.match_id!)}>Watch the Arena</button>:<button className="cm-btn cm-btn-primary" onClick={()=>onPlay('calendar')}><ClipboardList size={13}/>{next.can_submit?'Prepare match orders':'Open fixture calendar'}</button>}</>:<><p>Your club has no upcoming fixture.</p><p className="club-help">Enter an eligible tournament or schedule a scrimmage with another manager.</p><div className="flex flex-wrap gap-2"><a className="cm-btn" href={pediaHref('tournaments')}><Trophy size={13}/> Find a tournament</a><button className="cm-btn" onClick={()=>onPlay('friendly')}>Schedule a scrimmage</button></div></>}</div></section>
      <section className="cm-panel"><h2 className="cm-panel-header"><Shield size={14}/> Team summary</h2><dl className="office-summary"><div><dt><Coins size={13}/> Available money</dt><dd>{money?pediaMoney(money.available):'—'}</dd></div><div><dt><Users size={13}/> Contracted players</dt><dd>{club.cards.length}</dd></div><div><dt><LabelIcon name="training"/>Training XP recorded</dt><dd>{club.cards.reduce((total,card)=>total+(card.training_xp??0),0)}</dd></div><div><dt><LabelIcon name="academy"/>Youth academy</dt><dd>{money?.academy_opened_at?'Open':'Not opened'}</dd></div>{money?.academy_opened_at&&<div><dt><LabelIcon name="coach"/>Youth coach / week</dt><dd>{pediaMoney(money.youth_coach_wage)}</dd></div>}</dl><div className="cm-panel-body"><button className="cm-btn" onClick={onMarket}><Coins size={13}/> Transfer Exchange</button> <a className="cm-btn" href="#finances"><LabelIcon name="reports"/>Financial reports</a></div></section>
    </div>
    <section className="cm-panel"><h2 className="cm-panel-header"><Users size={14}/> Saved starting five <button className="cm-btn" onClick={()=>onPlay('lineup')}>Manage lineup</button></h2><div className="cm-table-wrap"><table className="cm-table"><thead><tr><th><LabelIcon name="slot"/>Slot</th><th><LabelIcon name="player"/>Player</th><th><LabelIcon name="role"/>Role</th><th><LabelIcon name="nationality"/>Nationality</th><th><LabelIcon name="overall"/>Overall</th><th><LabelIcon name="training"/>Training XP</th></tr></thead><tbody>{club.club.lineup.map((slot,index)=>{const player=club.cards.find(card=>card.id===slot.instance_id);return <tr key={slot.instance_id}><td>{index+1}</td><th scope="row">{player?<a href={pediaHref('players',player.id)}><WorldPlayerPortrait id={player.id} name={player.definition.name} appearance={player.definition.presentation?.appearance} size={32}/>{player.definition.name}</a>:'Unavailable'}</th><td><FpsPlayerRole stats={player?.definition.stats}/></td><td>{player?.definition.nationality?<CountryFlag code={player.definition.nationality.code} name={player.definition.nationality.name} showName/>:'Pending roster update'}</td><td>{player?`${toScale10(player.definition.ovr)}/10`:'—'}</td><td>{player?.training_xp??0}</td></tr>;})}</tbody></table></div></section>
    {!!recent.length&&<section className="cm-panel"><h2 className="cm-panel-header"><Trophy size={14}/> Recent match reports</h2><ul className="office-recent">{recent.map(fixture=><li key={fixture.id}><span>{fixture.clubs.blue.name} vs {fixture.clubs.red.name}</span><time>{pediaTime(fixture.kickoff_at)} Manila</time>{fixture.match_id&&<button className="cm-btn" onClick={()=>onWatch(fixture.match_id!)}>Open report</button>}</li>)}</ul></section>}
    {competition&&<section className="cm-panel"><h2 className="cm-panel-header"><Trophy size={14}/> Championship record</h2><div className="competition-summary"><span>HGR: <strong>{competition.rating?competition.rating.score.toFixed(1):'Unrated'}</strong></span><span>HCC points: <strong>{competition.circuit_points}</strong></span><span>Titles: <strong>{competition.titles.length}</strong></span><a className="cm-btn" href="#competitions?tab=circuit">Competitions & invitations</a></div></section>}
    <NewsFeed compact onWatch={onWatch}/>
    <WorldActivity onWatch={onWatch}/>
  </div>;
}
