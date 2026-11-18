import {FpsPlayerRole} from './FpsPlayerRole';
import {onWorldUpdate,visibleInterval} from '../worldLive';
import {ClubOfficeDesk} from './ClubOfficeDesk';
import {WorldPlayerPortrait} from './WorldPlayerPortrait';
import {NewsFeed} from './WorldMedia';
import { useEffect, useState } from 'react';
import { ArrowRight, UserRoundCog } from 'lucide-react';
import { fixturePhase, NextMatch, resultText, useNow, type BoardFixture } from './matches/FixtureBoard';
import { relativeTime } from './matches/time';
import { AttentionList, ClubGlance, HomeSection, attentionItems } from './home/HomeSections';
import { WeekCalendar } from './home/WeekCalendar';
import { FirstWeek } from './home/FirstWeek';
import { lineupReadiness } from './SquadRoster';
import { EmptyState, ErrorState, ListSkeleton } from './ui/States';
import type { FpsScoutingProfile } from '../fps/fpsIdentity';
import { useAccount } from '../AccountContext';
import { request } from '../cloudPersistence';
import { pediaHref, pediaMoney } from '../hexapedia';
import type { ClubIdentity } from './ClubIdentityEditor';
import { ReferenceMark } from './ReferenceIcon';
import { WorldActivity } from './WorldActivity';
import { WorldDesk } from './WorldDesk';
import { RouteErrorBoundary } from './RouteErrorBoundary';
// Manager-facing 1–10 levels use the one owner-mandated conversion (fpsScale10).
import {fpsScale10 as toScale10} from '../fps/fpsScale10';
import './club-office.css';

type Tool='calendar'|'lineup'|'identity'|'friendly';
interface HomeClub {club:{id:number;name:string;tag:string|null;tier:number;identity:ClubIdentity|null;lineup:{instance_id:string;avatar_id:string}[]};cards:{id:string;training_xp:number;definition:{fpsIdentity?:FpsScoutingProfile;presentation?:import('../supporter').PlayerPresentation|null;id:string;name:string;ovr:number;stats?:Record<string,number>;nationality?:{code:string;name:string}}}[]}
type Fixture = BoardFixture;
interface Money {available:number;academy_opened_at:string|null;youth_coach_wage:number}

export function ClubHome({onPlay,onMarket,onWatch}: {onPlay:(tool:Tool)=>void;onMarket:()=>void;onWatch:(id:string)=>void}) {
  const {session}=useAccount();
  const [club,setClub]=useState<HomeClub|null>(null);
  const [fixtures,setFixtures]=useState<Fixture[]>([]);
  const [money,setMoney]=useState<Money|null>(null);
  const [competition,setCompetition]=useState<{rating:{score:number;games:number}|null;circuit_points:number;titles:unknown[];entries?:{status:string}[]}|null>(null);
  const [error,setError]=useState('');
  const [retry,setRetry]=useState(0);
  const now=useNow();
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
    load();const stopLive=onWorldUpdate(['fixtures','clubs','players','market','competitions'],load);const stopTimer=visibleInterval(load,60000);
    return()=>{controller.abort();stopTimer();stopLive();};
  },[session,retry]);
  if(!club)return error?<ErrorState title="Your club could not be loaded" message={error} onRetry={()=>setRetry(value=>value+1)}/>:<ListSkeleton rows={5} label="Opening your club office"/>;
  const upcoming=[...fixtures].filter(f=>fixturePhase(f)!=='result').sort((x,y)=>Date.parse(x.kickoff_at)-Date.parse(y.kickoff_at));
  const next=upcoming.find(f=>fixturePhase(f)==='live')??upcoming[0];
  const recent=fixtures.filter(f=>fixturePhase(f)==='result').sort((x,y)=>Date.parse(y.kickoff_at)-Date.parse(x.kickoff_at)).slice(0,4);
  const attention=attentionItems({fixtures,cards:club.cards,lineup:club.club.lineup,cash:money?.available??null,now,onWatch,onFixtures:()=>onPlay('calendar')});
  const identity=club.club.identity;
  return <div className="home">
    <header className="home-club">
      <ReferenceMark kind="teams" identity={identity}/>
      <div className="home-club__text">
        <h2>{club.club.tag?<a href={pediaHref('teams',club.club.id)}>{club.club.name}</a>:club.club.name}</h2>
        <p>{[club.club.tag??'No club tag yet','Tier '+club.club.tier,identity?.city].filter(Boolean).join(' · ')}</p>
      </div>
      <button className="cm-btn cm-btn-ghost" onClick={()=>onPlay('identity')}><UserRoundCog size={13} aria-hidden="true"/> Edit club identity</button>
    </header>
    {error&&<p role="status" className="club-notice">Updates paused: {error}</p>}
    {(()=>{const r=lineupReadiness(club.cards,club.club.lineup);return <FirstWeek onIdentity={()=>onPlay('identity')} state={{hasTag:!!club.club.tag,lineupReady:r.ready,t:r.t,ct:r.ct,hasFixture:fixtures.length>0,
      entered:(competition?.entries??[]).some(e=>e.status==='accepted'),playedOfficial:fixtures.some(f=>!!f.outcome&&!['Scrimmage','Club Friendly'].includes(f.competition))}}/>;})()}

    <div className="home-top">
      <HomeSection id="home-attention" title="Needs your attention">
        <AttentionList items={attention} allClear={next?'Your next game kicks off '+relativeTime(next.kickoff_at,now)+'. Your default lineup will play.':'No games are scheduled. Enter a competition or arrange a scrimmage.'}/>
      </HomeSection>
      <HomeSection id="home-next" title={next&&fixturePhase(next)==='live'?'Live now':'Next match'} action={<button type="button" className="home-link" onClick={()=>onPlay('calendar')}>All fixtures <ArrowRight size={12} aria-hidden="true"/></button>}>
        {next?<NextMatch showLabel={false} f={next} clubId={club.club.id} now={now} onOrders={()=>onPlay('calendar')} onWatch={f=>{if(f.match_id)onWatch(f.match_id);}}/>
          :<EmptyState title="No upcoming games" action={<><a className="cm-btn cm-btn-primary" href="#competitions">Enter a competition</a><button className="cm-btn" onClick={()=>onPlay('friendly')}>Arrange a scrimmage</button></>}>Fixtures start automatically, even when you are offline.</EmptyState>}
      </HomeSection>
    </div>

    <HomeSection id="home-week" title="This week">
      <WeekCalendar now={now} onChange={()=>setRetry(value=>value+1)}/>
    </HomeSection>

    <HomeSection id="home-glance" title="Club at a glance">
      <ClubGlance stats={[
        {label:'Cash available',value:money?pediaMoney(money.available):'—',href:'#finances',note:money?.academy_opened_at?'Youth coach '+pediaMoney(money.youth_coach_wage)+' / week':'Youth academy not opened'},
        {label:'Contracted players',value:club.cards.length,href:'#squad',note:'5 starters · '+Math.max(0,club.cards.length-5)+' reserves'},
        {label:'Global rating (HGR)',value:competition?.rating?competition.rating.score.toFixed(1):'Unrated',href:'#competitions?tab=rankings',note:competition?.rating?competition.rating.games+' rated games':'Play ranked games to get rated'},
        {label:'Circuit points',value:competition?.circuit_points??'—',href:'#competitions?tab=circuit',note:(competition?.titles.length??0)+' titles won'},
      ]}/>
    </HomeSection>

    <ClubOfficeDesk onWatch={onWatch}/>

    <div className="home-two">
      <HomeSection id="home-five" title="Starting five" action={<a className="home-link" href="#squad">Manage squad <ArrowRight size={12} aria-hidden="true"/></a>}>
        <ol className="home-five">{club.club.lineup.map((slot,index)=>{const player=club.cards.find(card=>card.id===slot.instance_id);return <li key={slot.instance_id}>
          <span className="home-five__n">{index+1}</span>
          {player?<><WorldPlayerPortrait id={player.id} name={player.definition.name} appearance={player.definition.presentation?.appearance} size={30}/>
            <span className="home-five__who"><a href={pediaHref('players',player.id)}>{player.definition.name}</a><small><FpsPlayerRole stats={player.definition.stats}/></small></span>
            <b>{toScale10(player.definition.ovr)}<small>/10</small></b></>:<span className="home-five__who home-quiet">Unavailable</span>}
        </li>;})}</ol>
      </HomeSection>
      <HomeSection id="home-results" title="Recent results" action={<a className="home-link" href="#match-history">All results <ArrowRight size={12} aria-hidden="true"/></a>}>
        {recent.length?<ul className="home-results">{recent.map(f=><li key={f.id}>
          <div><strong>{resultText(f)?<span className={`fx-outcome is-${f.outcome}`}>{resultText(f)}</span>:f.status==='Interrupted'?'Interrupted':'Final'} vs {f.clubs[f.side==='red'?'blue':'red'].name}</strong><small>{[f.competition,f.map?.name,relativeTime(f.kickoff_at,now)].filter(Boolean).join(' · ')}</small></div>
          {f.match_id&&<button className="cm-btn cm-btn-sm" onClick={()=>onWatch(f.match_id!)}>Report</button>}
        </li>)}</ul>:<p className="home-quiet">No results in the last 30 days.</p>}
      </HomeSection>
    </div>

    <HomeSection id="home-world" title="Around the circuit" quiet>
      <div className="home-world">
        <NewsFeed compact onWatch={onWatch}/>
        <WorldActivity onWatch={onWatch}/>
        <RouteErrorBoundary><WorldDesk compact/></RouteErrorBoundary>
      </div>
    </HomeSection>
  </div>;
}
