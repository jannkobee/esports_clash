import {CountryFlag} from './CountryFlag';
import {CountrySelect} from './CountrySelect';
import {ManagerProfile} from './ManagerProfile';
import {TOURNAMENT_PHASES,TournamentPhaseFilters} from './TournamentEditionTable';
import {PlayerDossier} from './PlayerDossier';
import {AwardsHall} from './AwardsHall';
import {PersonalityMark,PersonalityMarks} from './PersonalityMarks';
import {PersonPortrait} from './PersonPortrait';
import {onWorldUpdate} from '../worldLive';
import {TournamentLogo} from './TournamentLogo';
import {LabelIcon} from './LabelIcon';
import {PlayerCareerRecord} from './PlayerCareerRecord';
import {WorldPlayerPortrait} from './WorldPlayerPortrait';
import {ExpandableFixtureReport} from './FixtureReport';
import {LaunchArchive} from './WorldMedia';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowRight, BookOpen, Brain, ChevronRight, Search, Sparkles, Trophy, Radio } from 'lucide-react';
import { request, isCloudPersistenceConfigured } from '../cloudPersistence';
import { useAccount } from '../AccountContext';
import { openAuthentication } from '../authNavigation';
import { PEDIA_KINDS, PEDIA_LABELS, pediaHref, readPediaRoute, pediaTime, pediaMoney, pediaStatus, pediaTier, type PediaKind, type PediaHub, type PediaFixture, type PediaTournament, type PediaTeam, type PediaPlayer, type PediaArticle, type PediaDirectory, type PediaRow } from '../hexapedia';
import { ClubCrest } from './ClubIdentityEditor';
import { toScale10 } from '../marketBatchEngine';
import './hexapedia.css';
import { ReferenceIcon, ReferenceMark } from './ReferenceIcon';
import { WorldActivity } from './WorldActivity';
import { CompetitionHub } from './CompetitionHub';
import {GameGuide} from './GameGuide';
import { PERSONALITIES, type PersonalityId } from '../playerPersonality';

interface Props { onWatch: (id: string) => void; laboratory?:ReactNode;catalogTools?:ReactNode }
const attributes: Record<string, string> = {lan:'Laning',tf:'Teamfighting',iq:'Game sense',ldr:'Leadership',clu:'Clutch',sta:'Stamina',flx:'Flexibility'};
const sectionIds: Record<string, [string,string][]> = {
  managers:[['overview','Manager profile'],['manager-history','Management record'],['manager-honors','Annual honors']],
  talent:[['overview','Profile'],['coverage','Coverage'],['appointments','Appointments']],
  tournaments: [['overview','Overview'],['participants','Participants'],['bracket','Bracket'],['schedule','Match schedule'],['prizes','Prize pool'],['rules','Rules']],
  teams: [['overview','Overview'],['roster','Roster'],['schedule','Fixtures & results'],['competitions','Competitions']],
  players: [['personal-information','Player information'],['career-numbers','Career numbers'],['team-history','Team history'],['awards-achievements','Awards & achievements'],['personal-bests','Personal bests'],['match-records','Match record book'],['trivia','Trivia'],['interviews','Interviews & introduction'],['gallery','Gallery'],['overview','Overview'],['attributes','Attributes'],['career','Career ledger'],['teams','Current clubs'],['schedule','Results']],
  avatars: [['overview','Overview'],['abilities','Abilities'],['base-stats','Base stats'],['statistics','Statistics'],['signatures','Signature players'],['schedule','Results']],
  items: [['overview','Overview'],['base-stats','Item stats'],['passive','Passive effect']],
  coaches: [['overview','Overview'],['attributes','Coaching attributes']],
  releases: [['overview','Overview'],['release-data','Release details']],
  organizers: [['overview','Overview'],['competitions','Tournaments']], sponsors: [['overview','Overview'],['competitions','Tournaments']],
};

function Section({id,title,children}: {id:string;title:string;children:ReactNode}) {
  return <section id={`pedia-${id}`} className="pedia-section"><h2><LabelIcon name={title} size={19}/>{title}</h2>{children}</section>;
}
function TeamLink({team}: {team:{id:number;name:string;national?:boolean;flag?:string;identity?:PediaTeam['identity']}}) { return <a className="pedia-entity-link" href={pediaHref(team.national?'nations':'teams',team.id)}><>{team.national?<CountryFlag code={team.flag} name={team.name}/>:<ReferenceMark kind="teams" identity={team.identity}/>}</>{team.name}</a>; }
function Empty({children}: {children:ReactNode}) { return <p className="pedia-empty">{children}</p>; }
function PlayerAttributes({stats}: {stats?:Record<string,number>}) {
  return <dl className="pedia-attributes">{Object.entries(attributes).map(([key,label])=>{const value=stats?.[key];return <div key={key}><dt><LabelIcon name={label} size={13}/>{label}</dt><dd>{typeof value==='number'?<><meter min={0} max={10} value={toScale10(value)} aria-label={label}/><strong>{toScale10(value)}/10</strong></>:<span className="pedia-muted">Not published</span>}</dd></div>;})}</dl>;
}

function PlayerPersonalities({primary,secondary}: {primary?:string|null;secondary?:string|null}) {
  const entries = [
    {id:primary, label:'Core personality', Icon:Brain},
    {id:secondary, label:'Secondary personality', Icon:Sparkles},
  ].filter((entry): entry is typeof entry & {id:PersonalityId} => !!entry.id && entry.id in PERSONALITIES);
  return <div className="pedia-personality-grid">{entries.map(({id,label,Icon})=><article key={label}><h3><Icon size={16}/>{label}</h3><PersonalityMark id={id}/><p>{PERSONALITIES[id].description}</p></article>)}</div>;
}
function RecordDescription({kind,row}: {kind:PediaKind;row:PediaRow}) {
  if(kind==='managers')return <>Club manager · <a href={pediaHref('managers',row.id)}>Management record & honors</a></>;
  if(kind==='talent')return <>{row.role}{row.style?' - '+row.style:''}</>;
  if(kind==='players')return <>{row.role}{row.nationality&&<> · <CountryFlag code={row.nationality.code} name={row.nationality.name}/></>}{row.club&&<> - <a href={pediaHref('teams',row.club.id)}>{row.club.name}</a></>}{row.overall===null||row.overall===undefined?'':` · ${toScale10(row.overall)}/10 overall`}</>;
  if(kind==='coaches')return <>{row.style} · {row.tier}</>;
  if(kind==='avatars')return <>{row.primaryRole}{row.title?' · '+row.title:''}</>;
  if(kind==='items')return <>{row.tier} · {row.cost?.toLocaleString()} Arena gold</>;
  if(kind==='releases')return <>{row.date?pediaTime(row.date):''}{row.active?' · Active':''}</>;
  return <>{kind==='nations'?'National association':kind==='organizers'?'Tournament organizer':'Tournament sponsor'}</>;
}
function Contents({sections}: {sections:[string,string][]}) {
  return <nav aria-label="Article contents">{sections.map(([id,title]) => <a key={id} href={`#pedia-${id}`} onClick={event=>{event.preventDefault();document.getElementById(`pedia-${id}`)?.scrollIntoView({block:'start'});}}>{title}</a>)}</nav>;
}

function TeamGameHistory({id,onWatch}:{id:number;onWatch:Props['onWatch']}){
  const [kind,setKind]=useState('all'),[page,setPage]=useState(1),[data,setData]=useState<{items:PediaFixture[];meta:{page:number;last_page:number;total:number}}|null>(null),[error,setError]=useState('');
  useEffect(()=>{const c=new AbortController();void request<{data:NonNullable<typeof data>}>(`/avatarpedia/teams/${id}/games?kind=${kind}&page=${page}`,null,{signal:c.signal}).then(r=>{setData(r.data);setError('');}).catch(e=>{if(!c.signal.aborted)setError(e.message);});return()=>c.abort();},[id,kind,page]);
  return <><nav className="cm-tabs">{[['all','All games'],['scrimmages','Scrimmages'],['tournaments','Tournament games']].map(([v,label])=><button key={v} className={`cm-tab ${kind===v?'active':''}`} onClick={()=>{setKind(v);setPage(1);setData(null);}}>{label}</button>)}</nav>{error&&<p role="alert">{error}</p>}{data?<><p className="pedia-muted">{data.meta.total} published fixtures. Verified reports retain the teams and players at kickoff.</p><MatchList fixtures={data.items} onWatch={onWatch}/><div className="flex gap-3"><button className="cm-btn" disabled={page<=1} onClick={()=>setPage(p=>p-1)}>Previous</button><span>{page} / {data.meta.last_page}</span><button className="cm-btn" disabled={page>=data.meta.last_page} onClick={()=>setPage(p=>p+1)}>Next</button></div></>:!error&&<p role="status">Opening the club match archive...</p>}</>;
}

function MatchList({fixtures,onWatch,countdown=false}: {fixtures:PediaFixture[];onWatch:Props['onWatch'];countdown?:boolean}) {
  const [now,setNow]=useState(Date.now);
  useEffect(()=>{if(!countdown)return;setNow(Date.now());const timer=window.setInterval(()=>setNow(Date.now()),15000);return()=>window.clearInterval(timer);},[countdown]);
  const remaining=(date:string)=>{const minutes=Math.ceil((Date.parse(date)-now)/60000);return minutes<=0?'Awaiting start':minutes>=1440?`In ${Math.floor(minutes/1440)}d ${Math.floor(minutes%1440/60)}h`:minutes>=60?`In ${Math.floor(minutes/60)}h ${minutes%60}m`:`In ${minutes}m`;};
  if(!fixtures.length)return <Empty>No fixtures have been recorded in this section yet.</Empty>;
  return <div className="pedia-match-list">{fixtures.map(match=><article key={match.id} className="pedia-match">
    <div className="pedia-match-meta"><span>{match.status==='running'?<><Radio size={12}/> Live</>:match.winner?'Completed':countdown&&['scheduled','allocated'].includes(match.status)?remaining(match.kickoff_at):pediaStatus(match.status)}</span><time dateTime={match.kickoff_at}>{pediaTime(match.kickoff_at)} Manila</time></div>
    <div className="pedia-match-teams"><TeamLink team={match.home}/><span>{match.score ? `${match.score.blue} : ${match.score.red}`:'vs'}</span><TeamLink team={match.away}/></div>
    <p className="pedia-muted">{match.tournament_id?<a className="tournament-entity" href={pediaHref('tournaments',match.tournament_id)}><TournamentLogo id={match.tournament_id} name={match.competition} size={18}/>{match.competition}</a>:match.competition}{match.score&&' · Arena kills'}</p>
    {match.winner&&match.watch_match_id&&<ExpandableFixtureReport id={match.id}/>}
    {match.winner&&<p className="pedia-winner">{match.winner} won</p>}
    {match.watch_match_id&&<button className="pedia-text-button" onClick={()=>onWatch(match.watch_match_id!)}>{match.winner?'Replay & match report':'Watch in the Arena'} <ArrowRight size={12}/></button>}
  </article>)}</div>;
}

function TournamentTable({events}: {events:PediaTournament[]}) {
  if(!events.length)return <Empty>No tournaments have been published here yet.</Empty>;
  return <div className="pedia-table-scroll"><table className="pedia-table"><thead><tr><th>Tournament</th><th>Tier</th><th>Dates · Manila</th><th>Prize pool</th><th>Teams</th><th>Status</th></tr></thead><tbody>{events.map(event=><tr key={event.id}>
    <th scope="row"><a className="tournament-entity" href={pediaHref('tournaments',event.id)}><TournamentLogo id={event.id} name={event.name} size={24}/>{event.name}</a></th><td><span className={"pedia-tier pedia-tier--"+(event.tier??0)}>{pediaTier(event.tier)}</span></td><td>{pediaTime(event.effective_starts_at??event.starts_at??event.semifinals_at)}<br/><span className="pedia-muted">Ends {pediaTime(event.effective_ends_at??event.ends_at??event.final_at)}</span></td><td>{pediaMoney(event.champion_prize+event.runner_up_prize)}</td><td>{event.entries}/{event.capacity??4}</td><td><span className={'edition-phase is-'+event.lifecycle}>{TOURNAMENT_PHASES.find(([key])=>key===event.lifecycle)?.[1]??pediaStatus(event.status)}</span><small className="edition-subtitle">{event.provenance==='launch_simulation'?'Launch exhibition':event.lifecycle==='review'?'Awaiting confirmed progress or finish':pediaStatus(event.status)}</small></td>
  </tr>)}</tbody></table></div>;
}

function TeamCards({teams,rosters=false}: {teams:PediaTeam[];rosters?:boolean}) {
  const [showRosters,setShowRosters]=useState(true);
  if(!teams.length)return <Empty>No clubs are listed yet.</Empty>;
  return <>{rosters&&<div className="pedia-roster-controls"><label><input type="checkbox" checked={showRosters} onChange={event=>setShowRosters(event.target.checked)}/> Show current rosters</label><span>Match orders remain private</span></div>}<div className="pedia-team-grid">{teams.map(team=><article className="pedia-team-card" key={team.id}>
    <header><ReferenceMark kind="teams" identity={team.identity}/><div><a href={pediaHref('teams',team.id)}>{team.name}</a><p>{team.tag} · Tier {team.tier}</p></div></header>
    {team.identity?.motto&&<p className="pedia-muted">{team.identity.motto}</p>}
    {rosters&&showRosters&&<ul className="pedia-roster-list">{team.roster?.length?team.roster.map((slot,index)=><li key={`${slot.player.id}:${index}`}><a href={pediaHref('players',slot.player.id)}><WorldPlayerPortrait id={String(slot.player.id)} name={slot.player.name} appearance={slot.player.presentation?.appearance} size={35}/>{slot.player.name}</a><span>{slot.player.role}</span></li>):<li>Roster not published</li>}</ul>}
  </article>)}</div></>;
}

function GlobalSearch() {
  const [query,setQuery]=useState('');
  const [rows,setRows]=useState<{kind:PediaKind;id:string|number;name:string}[]>([]);
  const [state,setState]=useState('');
  const [open,setOpen]=useState(false);
  const root=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(query.trim().length<2){setRows([]);setState('');return;}
    setRows([]);setState('Searching…');
    const controller=new AbortController();
    const timer=window.setTimeout(()=>{setState('Searching…');void request<{data:typeof rows}>(`/avatarpedia/search?q=${encodeURIComponent(query.trim())}`,null,{signal:controller.signal})
      .then(result=>{if(controller.signal.aborted)return;setRows(result.data);setState(result.data.length?'':'No matching articles.');})
      .catch(()=>{if(!controller.signal.aborted)setState('Search is unavailable. Try again shortly.');});},300);
    return()=>{window.clearTimeout(timer);controller.abort();};
  },[query]);
  return <div className="pedia-search" ref={root} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node))setOpen(false);}}>
    <label><Search size={16}/><span className="sr-only">Search Hexapedia</span><input type="search" maxLength={100} value={query} placeholder="Search tournaments, teams, players…" onFocus={()=>setOpen(true)} onChange={event=>{setQuery(event.target.value);setOpen(true);}} onKeyDown={event=>{if(event.key==='Escape')setOpen(false);}} aria-expanded={open&&query.trim().length>=2} aria-controls="pedia-search-results"/></label>
    {open&&query.trim().length>=2&&<div className="pedia-search-results" id="pedia-search-results" aria-label="Article search results"><p role="status">{state||`${rows.length} articles found`}</p>{rows.map(row=><a href={pediaHref(row.kind,row.id)} key={`${row.kind}:${row.id}`} onClick={()=>{setOpen(false);setQuery('');}}><span>{row.name}</span><small>{PEDIA_LABELS[row.kind]}</small></a>)}</div>}
  </div>;
}

function Hub({hub,onWatch}: {hub:PediaHub;onWatch:Props['onWatch']}) {
  const [matchesTab,setMatchesTab]=useState<'upcoming'|'completed'>('upcoming');
  const [tier,setTier]=useState('all');
  const [countdown,setCountdown]=useState(false);
  const upcoming=hub.fixtures.filter(match=>!match.winner).sort((a,b)=>Date.parse(a.kickoff_at)-Date.parse(b.kickoff_at));
  const completed=hub.fixtures.filter(match=>match.winner).sort((a,b)=>Date.parse(b.kickoff_at)-Date.parse(a.kickoff_at));
  const events=hub.events.filter(event=>tier==='all'||event.tier===Number(tier));
  return <div className="pedia-home">
    <div className="pedia-welcome"><div><p className="pedia-eyebrow">Explore the world</p><h1>Clubs, competition &amp; the Arena</h1><p>Explore the people, competitions, and game behind your next matchday. Connected records, straight from Hexatrick.</p></div><BookOpen size={64} strokeWidth={1}/></div>
    <nav className="pedia-portals" aria-label="Encyclopedia sections">{(['tournaments','teams','players','avatars','items'] as PediaKind[]).map(kind=><a href={pediaHref(kind)} key={kind}><ReferenceIcon kind={kind} size={23}/><strong>{hub.counts[kind]?.toLocaleString()??'—'}</strong><span>{PEDIA_LABELS[kind]}</span></a>)}</nav>
    <div className="pedia-home-grid">
      <section className="pedia-module"><header><h2><LabelIcon name="match"/>Match centre</h2><span>Manila · UTC+8</span></header><div className="pedia-segments"><button aria-pressed={matchesTab==='upcoming'} onClick={()=>setMatchesTab('upcoming')}>Upcoming & live</button><button aria-pressed={matchesTab==='completed'} onClick={()=>setMatchesTab('completed')}>Completed</button></div><label className="pedia-countdown"><input type="checkbox" checked={countdown} onChange={event=>setCountdown(event.target.checked)}/> Show countdowns</label><MatchList fixtures={(matchesTab==='upcoming'?upcoming:completed).slice(0,8)} onWatch={onWatch} countdown={countdown}/></section>
      <div className="pedia-home-right"><section className="pedia-module"><header><h2><LabelIcon name="tournaments"/>Tournaments</h2><a href={pediaHref('tournaments')}>All events <ChevronRight size={13}/></a></header><div className="pedia-filter"><label>Tier <select value={tier} onChange={event=>setTier(event.target.value)}><option value="all">All tiers</option>{[1,2,3,4,5].map(value=><option key={value} value={value}>Tier {value}</option>)}</select></label></div>{events.length?events.slice(0,6).map(event=><article className="pedia-event-summary" key={event.id}><TournamentLogo id={event.id} name={event.name} size={32}/><div><a className="tournament-entity" href={pediaHref('tournaments',event.id)}>{event.name}</a><p>{pediaTier(event.tier)} · {pediaStatus(event.status)}</p><p>{pediaTime(event.semifinals_at)} Manila</p></div></article>):<Empty>No published events match this tier.</Empty>}</section>
      <section className="pedia-module pedia-guide-link"><header><h2><LabelIcon name="guide"/>New to Hexatrick?</h2></header><div><p>Learn the club essentials, from your first lineup to the annual circuit.</p><a href="#hexapedia/guide"><BookOpen size={16}/> Open the game guide <ArrowRight size={14}/></a></div></section></div>
    </div>
    {hub.standings.map(league=><Section key={league.competition} id={`league-${league.competition}`} title={`${league.year} · ${league.competition}`}><div className="pedia-table-scroll"><table className="pedia-table"><thead><tr><th>Club</th><th>Wins</th><th>Losses</th></tr></thead><tbody>{league.clubs.map(club=><tr key={club.id}><th scope="row"><TeamLink team={club}/></th><td>{club.wins}</td><td>{club.losses}</td></tr>)}</tbody></table></div></Section>)}
    <WorldActivity onWatch={onWatch}/>
    <p className="pedia-source-note">Profiles use the current catalog. Match records come from verified scheduled results. Private orders, account details, and balances remain in your club workspace.</p>
  </div>;
}

function Directory({kind}: {kind:PediaKind}) {
  const [query,setQuery]=useState('');
  const [tier,setTier]=useState(''),[year,setYear]=useState(''),[status,setStatus]=useState(''),[phase,setPhase]=useState(''),[sort,setSort]=useState('lifecycle'),[role,setRole]=useState(''),[nationality,setNationality]=useState(''),[perPage,setPerPage]=useState(30);
  const [page,setPage]=useState(1);
  const [result,setResult]=useState<PediaDirectory|null>(null);
  const [error,setError]=useState('');
  const [directoryRevision,setDirectoryRevision]=useState(0);
  useEffect(()=>onWorldUpdate(['competitions','clubs','players','records','geography'],()=>setDirectoryRevision(v=>v+1)),[]);
  useEffect(()=>{setQuery('');setTier('');setYear('');setStatus('');setPhase('');setSort('lifecycle');setRole('');setNationality('');setPage(1);setResult(null);},[kind]);
  useEffect(()=>{
    const controller=new AbortController();
    const timer=window.setTimeout(()=>{setError('');void request<{data:PediaDirectory}>(`/avatarpedia/directory/${kind}?page=${page}&q=${encodeURIComponent(query.trim())}&per_page=${perPage}${tier?'&tier='+tier:''}${year?'&year='+year:''}${status?'&status='+status:''}${kind==='tournaments'?'&sort='+sort+(phase?'&phase='+phase:''):''}${role?'&role='+encodeURIComponent(role):''}${nationality?'&nationality='+nationality:''}`,null,{signal:controller.signal})
      .then(response=>{if(!controller.signal.aborted)setResult(response.data);}).catch(problem=>{if(!controller.signal.aborted)setError((problem as Error).message);});},query?250:0);
    return()=>{window.clearTimeout(timer);controller.abort();};
  },[kind,query,page,tier,year,status,phase,sort,role,nationality,perPage,directoryRevision]);
  const groups=kind==='tournaments'?(sort==='lifecycle'&&!phase?TOURNAMENT_PHASES.map(([key,label])=>({key,label,rows:result?.items.filter(row=>row.lifecycle===key)??[]})):[{key:'editions',label:phase?TOURNAMENT_PHASES.find(([key])=>key===phase)?.[1]??'Editions':'Competition editions',rows:result?.items??[]}]):[];
  return <div className="pedia-directory"><p className="pedia-eyebrow">Hexapedia directory</p><h1>{PEDIA_LABELS[kind]}</h1><div className="pedia-directory-toolbar"><label>Find {PEDIA_LABELS[kind].toLowerCase()}<input type="search" value={query} maxLength={100} onChange={event=>{setQuery(event.target.value);setPage(1);}} placeholder="Search by name"/></label><p>{result?`${result.meta.total.toLocaleString()} records`:'Loading records…'}</p></div>
    <div className="record-filters directory-filters">{(kind==='tournaments'||kind==='teams')&&<label>Tier<select value={tier} onChange={e=>{setTier(e.target.value);setPage(1);}}><option value="">Every tier</option>{[1,2,3,4,5].map(t=><option key={t} value={t}>Tier {t}</option>)}</select></label>}{kind==='tournaments'&&<><label>Year<input type="number" min={2020} max={2200} value={year} placeholder="All years" onChange={e=>{setYear(e.target.value);setPage(1);}}/></label><label>Sort by<select value={sort} onChange={e=>{setSort(e.target.value);setPage(1);}}>{[['lifecycle','Category, then date'],['starts_asc','Starting soonest'],['starts_desc','Latest start first'],['ends_desc','Latest end first'],['name','Name'],['prize','Highest prize pool']].map(([id,label])=><option value={id} key={id}>{label}</option>)}</select></label></>}{kind==='players'&&<><label>Role<select value={role} onChange={e=>{setRole(e.target.value);setPage(1);}}><option value="">Every role</option>{['Tank','Fighter','Assassin','Mage','Marksman','Support'].map(r=><option key={r}>{r}</option>)}</select></label><label>Nationality<CountrySelect label="Nationality" value={nationality} onChange={v=>{setNationality(v);setPage(1);}}/></label></>}<label>Rows per page<select value={perPage} onChange={e=>{setPerPage(Number(e.target.value));setPage(1);}}>{[20,30,50].map(n=><option key={n}>{n}</option>)}</select></label><button className="cm-btn" onClick={()=>{setQuery('');setTier('');setYear('');setStatus('');setPhase('');setSort('lifecycle');setRole('');setNationality('');setPage(1);}}>Clear filters</button><small>Filters search the complete registry.</small></div>
    {kind==='tournaments'&&<TournamentPhaseFilters value={phase} counts={result?.counts} onChange={v=>{setPhase(v);setPage(1);}}/>}
    {kind==='talent'&&<nav className="talent-role-chips" aria-label="Talent roles">{['','caster','analyst','streamer','host','referee','observer','manager'].map(role=><button key={role} className={query===role?'selected':''} onClick={()=>{setQuery(role);setPage(1);}}>{role?role[0].toUpperCase()+role.slice(1):'Everyone'}</button>)}</nav>}
    {error&&<p role="alert" className="pedia-empty">{error}</p>}
    {result&&!result.items.length&&<Empty>No matching records. Try another name or return to the main page.</Empty>}
    {kind==='tournaments'?groups.filter(g=>g.rows.length).map(g=><Section key={g.key} id={g.key} title={g.label}><TournamentTable events={g.rows as PediaTournament[]}/></Section>):kind==='teams'?<TeamCards teams={(result?.items??[]) as PediaTeam[]}/>:<div className="pedia-table-scroll"><table className="pedia-table"><thead><tr><th>Name</th><th>Information</th></tr></thead><tbody>{result?.items.map(row=><tr key={row.id}><th scope="row"><a href={pediaHref(kind,row.id)}>{kind==='players'?<WorldPlayerPortrait id={String(row.id)} name={row.name} appearance={row.presentation?.appearance} size={48}/>:kind==='talent'||kind==='coaches'||kind==='managers'?<PersonPortrait id={kind==='talent'?'talent-'+row.id:kind==='managers'?'manager-'+row.id:'coach-'+row.id} name={row.name} role={row.role??'staff'} size={48}/>:kind==='nations'?<CountryFlag code={row.flag} name={row.name}/>:<ReferenceMark kind={kind} id={row.id} name={row.name}/>}<span>{row.name}{row.personal_details&&<small className="directory-real-name">{row.personal_details.real_name}</small>}</span></a></th><td><RecordDescription kind={kind} row={row}/>{kind==='players'&&<PersonalityMarks primary={row.primaryPersonality} secondary={row.secondaryPersonality}/>} {row.personal_details&&<small className="directory-residence">{row.personal_details.residence.city}, {row.personal_details.residence.country} · {row.personal_details.languages.join(', ')}</small>}</td></tr>)}</tbody></table></div>}
    {result&&result.meta.last_page>1&&<div className="pedia-pagination"><button disabled={page<=1} onClick={()=>setPage(value=>value-1)}>Previous</button><span>Page {page} of {result.meta.last_page}</span><button disabled={page>=result.meta.last_page} onClick={()=>setPage(value=>value+1)}>Next</button></div>}
  </div>;
}

function InfoBox({article}: {article:PediaArticle}) {
  const {kind,record:r}=article;
  const facts:[string,ReactNode][]=[];
  if(kind==='tournaments')facts.push(['Organizer',<a href={pediaHref('organizers',r.organizer_id)}>{r.organizer}</a>],['Sponsor',r.sponsor_id?<a href={pediaHref('sponsors',r.sponsor_id)}>{r.sponsor||'Not published'}</a>:'Not published'],['Tier',pediaTier(r.tier)],['Format',(r.capacity??4)+' teams - '+(r.provenance==='launch_simulation'?'Groups and playoffs':r.regulations?.stages?.map(s=>pediaStatus(s.format)).join(' / ')||'Single elimination')],['Match format','One Arena game'],['Prize pool',pediaMoney((r.champion_prize??0)+(r.runner_up_prize??0))],['Starts',r.starts_at||r.semifinals_at?pediaTime(r.starts_at??r.semifinals_at):'—'],['Ends',r.ends_at||r.final_at?pediaTime(r.ends_at??r.final_at):'—'],['Status',r.status?pediaStatus(r.status):'—']);
  if(kind==='managers')facts.push(['Role','Club manager'],['Ranked games',r.manager_record?.games??0],['Wins',r.manager_record?.wins??0],['Current clubs',r.manager_clubs?.length??0]);
  if(kind==='talent')facts.push(['Role',r.role],['Specialty',r.style],['Nationality',r.profile?.nationality?<CountryFlag code={r.profile.nationality} showName/>:'Not published']);
  if(kind==='teams')facts.push(['Manager',r.manager?<a href={pediaHref('managers',r.manager.id)}>{r.manager.name}</a>:'Not published'],['Club tag',r.tag],['Tier',r.tier],['Home',r.identity?<>{r.identity.city&&<>{r.identity.city} · </>}<CountryFlag code={r.identity.country} showName/></>:'Not published'],['Record',r.record?`${r.record.wins} wins · ${r.record.losses} losses`:'—']);
  if(kind==='players')facts.push(['Real name',r.personal_details?.real_name??'Not published'],['Born',r.personal_details?.birth_date??'Not published'],['Home',r.personal_details?[r.personal_details.residence.city,r.personal_details.residence.country].join(', '):'Not published'],['Alias',r.name],['Nationality',r.nationality?<CountryFlag code={r.nationality.code} name={r.nationality.name} showName/>:'Historical record'],['Status',r.status??'Active'],['Role',r.role],['Age',r.age??'Not published'],['Overall',r.overall?`${toScale10(r.overall)}/10`:'—'],['Profile type','Unique world player'],['Current clubs',r.teams?.length??0]);
  if(kind==='nations')facts.push(['Type','National association'],['Team',<CountryFlag code={r.flag} name={r.name} showName/>]);
  if(kind==='coaches')facts.push(['Style',r.style],['Tier',r.tier],['Rating',r.rating10===undefined?'Not published':`${r.rating10}/10`]);
  if(kind==='avatars')facts.push(['Role',r.primaryRole],['Secondary role',r.secondaryRole??'—'],['Archetype',r.archetype??'—'],['Title',r.title??'—']);
  if(kind==='items')facts.push(['Tier',r.tier],['Cost',`${r.cost?.toLocaleString()} Arena gold`],['Suitable roles',r.suitableRoles?.join(', ')],['Version',r.version]);
  if(kind==='releases')facts.push(['Status',r.active?'Active':'Historical'],['Installed / updated',r.date?pediaTime(r.date):'—'],['Ability rules',r.ability_ruleset??'—']);
  if(kind==='organizers'||kind==='sponsors')facts.push(['Type',r.type],['Published events',r.tournaments?.length??0]);
  return <aside className="pedia-infobox" aria-label="Article information"><h2>{r.name}</h2><div className="pedia-identity">{kind==='nations'?<CountryFlag code={r.flag} name={r.name}/>:kind==='managers'?<PersonPortrait id={'manager-'+r.id} name={r.name} role="manager" size={150}/>:kind==='talent'?<PersonPortrait id={'talent-'+r.id} name={r.name} role={r.role} size={150}/>:kind==='players'?<WorldPlayerPortrait id={String(r.id)} name={r.name} appearance={r.presentation?.appearance} size={170}/>:kind==='coaches'?<PersonPortrait id={'coach-'+r.id} name={r.name} size={150}/>:kind==='teams'&&r.identity?<ClubCrest crest={r.identity.crest} colors={r.identity.colors} logo={r.identity.assets?.logo}/>:<ReferenceMark kind={kind} id={r.id} name={r.name}/>}</div><h3>{kind==='players'?'Player information':kind==='avatars'?'Avatar information':kind==='tournaments'?'Tournament information':'At a glance'}</h3><dl>{facts.map(([label,value])=><div key={label}><dt><LabelIcon name={label} size={12}/>{label}</dt><dd>{value}</dd></div>)}</dl><p>Times shown in Manila · UTC+8</p></aside>;
}

function Stats({article}: {article:PediaArticle}) {
  const stats=article.record.statistics;
  return <Section id="statistics" title="Verified match statistics">{stats?<><dl className="pedia-stat-grid">{([['Appearances',stats.appearances],['Wins',stats.wins],['Losses',stats.losses],['Minutes',stats.minutes]] as const).map(([label,value])=><div key={label}><dt><LabelIcon name={label} size={12}/>{label}</dt><dd>{value}</dd></div>)}</dl><p className="pedia-muted">One appearance per participating side in a completed scheduled match. Each world player has one identity and one current club. Individual KDA is not inferred from team scores.</p></>:<Empty>No verified participation has been recorded.</Empty>}</Section>;
}

function ArticleBody({article,onWatch,register,joining}: {article:PediaArticle;onWatch:Props['onWatch'];register:()=>void;joining:boolean}) {
  const {kind,record:r}=article;
  if(kind==='managers')return <ManagerProfile record={r}/>;
  if(kind==='talent')return <><Section id="overview" title="Talent profile"><div className="talent-profile"><PersonPortrait id={'talent-'+r.id} name={r.name} role={r.role} size={140}/><div><span className="pedia-tier">{r.role}</span><p>{r.bio}</p>{r.profile?.club_id&&<a href={pediaHref('teams',r.profile.club_id)}>Club record</a>}<p className="pedia-muted">{r.profile?.specialty}{r.profile?.nationality&&<> · <CountryFlag code={r.profile.nationality} showName/></>}</p></div></div></Section><Section id="coverage" title="Recent coverage">{r.posts?.length?r.posts.map(p=><article className="talent-post" key={p.id}><time>{pediaTime(p.published_at)} Manila</time><a href={'#wire?post='+p.id}>{p.headline}</a><p>{p.body}</p></article>):<p>No published coverage yet.</p>}</Section><Section id="appointments" title="Match appointments">{r.appointments?.length?<table className="pedia-table"><thead><tr><th>Competition</th><th>Role</th><th>Kickoff - Manila</th></tr></thead><tbody>{r.appointments.map(a=><tr key={a.id}><td>{a.tournament_id?<a href={pediaHref('tournaments',a.tournament_id)}>{a.competition}</a>:a.competition}</td><td>{a.role}</td><td>{pediaTime(a.kickoff_at)}</td></tr>)}</tbody></table>:<p>Appointments appear when match crews are confirmed.</p>}</Section></>;
  if(kind==='nations')return <Section id="overview" title="National team record"><CompetitionHub key={'nation:'+r.id} initialNation={Number(r.id)} onWatch={onWatch}/></Section>;
  if(kind==='tournaments'&&r.provenance==='launch_simulation')return <Section id="overview" title="Launch exhibition"><LaunchArchive onWatch={onWatch}/></Section>;
  if(kind==='tournaments'&&r.definition_id)return <Section id="overview" title="Competition record"><CompetitionHub key={'edition:'+r.id} initialEdition={Number(r.id)} onWatch={onWatch}/></Section>;
  return <>
    <Section id="overview" title="Overview">
      {kind==='tournaments'&&r.provenance==='launch_simulation'?<><p className="world-provenance">Labeled simulated launch history. Future rounds are scheduled Arena exhibitions. This event is excluded from official titles, rankings and rewards.</p><LaunchArchive onWatch={onWatch}/></>:kind==='tournaments'?<><p><strong>{r.name}</strong> is a Tier {r.tier} Hexatrick competition organized by <a href={pediaHref('organizers',r.organizer_id)}>{r.organizer}</a>, with support from <a href={pediaHref('sponsors',r.sponsor_id)}>{r.sponsor}</a>. The tournament uses real scheduled Arena fixtures and verified match results.</p>{r.status==='registration'&&<div className="pedia-entry"><p>Registration closes {pediaTime(r.registration_closes_at!)} Manila · {r.entries}/{r.capacity??4} places filled.</p><button disabled={joining} onClick={register}>{joining?'Registering…':'Enter this tournament'}</button></div>}{r.champion&&<p className="pedia-winner">Champion: <TeamLink team={r.champion}/></p>}</>:
      kind==='teams'?<><p><strong>{r.name}</strong> is a Tier {r.tier} registered club in Hexatrick.</p>{r.identity?.motto&&<blockquote>{r.identity.motto}</blockquote>}{r.identity?.bio&&<p className="whitespace-pre-wrap">{r.identity.bio}</p>}</>:
      kind==='players'?<><p><strong>{r.name}</strong> is a {r.role} player in the Hexatrick world. This record follows their unique identity and current contract.</p><p className="pedia-muted">Transfers move this player's existing contract and training record; they never create another copy.</p></>:
      kind==='coaches'?<><p><strong>{r.name}</strong> is a {r.style} coaching profile in the current Hexatrick catalog.</p>{r.quote&&<blockquote>{r.quote}</blockquote>}</>:
      kind==='avatars'?<><p><strong>{r.name}</strong>{r.title?`, ${r.title}`:''} is a {r.primaryRole} Avatar{r.archetype?` with the ${r.archetype} archetype`:''}.</p>{r.lore&&<p className="whitespace-pre-wrap">{r.lore}</p>}</>:
      kind==='items'?<p><strong>{r.name}</strong> is a {r.tier} Arena item costing {r.cost?.toLocaleString()} Arena gold. Its cost belongs to the match economy, separately from a club's PHP money.</p>:
      kind==='releases'?<p>This is an installed Arena catalog release. Its identity and rule version are recorded below. Historical match allocations retain the versions they were played with.</p>:
      <p><strong>{r.name}</strong> is a {r.type?.toLowerCase()} in the Hexatrick circuit. The published tournaments associated with this record are listed below.</p>}
    </Section>
    {kind==='tournaments'&&r.provenance!=='launch_simulation'&&<>
      <Section id="participants" title="Participating teams"><TeamCards teams={r.teams??[]} rosters/></Section>
      <Section id="bracket" title="Knockout bracket"><div className="pedia-bracket">{[1,2,3].map(slot=>{const match=r.fixtures?.find(fixture=>fixture.bracket_slot===slot);return <article key={slot}><h3>{slot===3?'Grand final':`Semifinal ${slot}`}</h3>{match?<><p><TeamLink team={match.home}/></p><p><TeamLink team={match.away}/></p><p className="pedia-winner">{match.winner?`${match.winner} advances`:pediaStatus(match.status)}</p></>:<p className="pedia-muted">Teams to be confirmed</p>}<time>{pediaTime(slot===1?r.semifinals_at!:slot===2?r.second_semifinal_at!:r.final_at!)}</time></article>;})}</div><p className="pedia-muted">Each fixture is one Arena game. Bracket positions appear when the server publishes the draw.</p></Section>
      <Section id="schedule" title="Match schedule & results"><MatchList fixtures={r.fixtures??[]} onWatch={onWatch}/></Section>
      <Section id="prizes" title="Prize pool"><p>{pediaMoney((r.champion_prize??0)+(r.runner_up_prize??0))} in published in-game rewards.</p><div className="pedia-table-scroll"><table className="pedia-table"><thead><tr><th>Place</th><th>Reward · PHP</th><th>Participant</th></tr></thead><tbody><tr><th scope="row">Champion</th><td>{pediaMoney(r.champion_prize??0)}</td><td>{r.champion?<TeamLink team={r.champion}/>:'To be decided'}</td></tr><tr><th scope="row">Runner-up</th><td>{pediaMoney(r.runner_up_prize??0)}</td><td>{(()=>{const final=r.fixtures?.find(match=>match.bracket_slot===3&&match.winner_id);return final?<TeamLink team={final.home.id===final.winner_id?final.away:final.home}/>:'To be decided';})()}</td></tr></tbody></table></div></Section>
      <Section id="rules" title="Tournament rules"><p>{r.rules}</p>{!r.definition_id&&<p>Tier {r.tier} clubs with a published club identity may register. The champion advances one tier when eligible. Interrupted or conflicting fixtures require organizer review.</p>}</Section>
    </>}
    {kind==='teams'&&<><Section id="roster" title="Current roster">{r.roster?.length?<div className="pedia-table-scroll"><table className="pedia-table"><thead><tr><th>Player</th><th>Role</th><th>Overall</th><th>Training XP</th></tr></thead><tbody>{r.roster.map((slot,index)=><tr key={`${slot.player.id}:${index}`}><th scope="row"><a href={pediaHref('players',slot.player.id)}><WorldPlayerPortrait id={String(slot.player.id)} name={slot.player.name} appearance={slot.player.presentation?.appearance} size={35}/>{slot.player.name}</a></th><td>{slot.player.role}</td><td>{slot.player.overall?`${toScale10(slot.player.overall)}/10`:'—'}</td><td>{slot.training_xp}</td></tr>)}</tbody></table></div>:<Empty>No current-catalog roster is published.</Empty>}<p className="pedia-muted">All contracted players are shown. Private match orders and locked starting selections are not published here.</p></Section><Section id="schedule" title="Fixtures & results"><TeamGameHistory id={Number(r.id)} onWatch={onWatch}/></Section><Section id="competitions" title="Tournament participation"><TournamentTable events={r.tournaments??[]}/></Section></>}
    {kind==='players'&&<><PlayerDossier article={article} onWatch={onWatch}/>{r.presentation?.bio&&<Section id="biography" title="Player biography"><p className="whitespace-pre-wrap">{r.presentation.bio}</p><small className="pedia-muted">Player biography provided by their club.</small></Section>}<Section id="career" title="Career record"><PlayerCareerRecord career={r.career}/></Section><Section id="attributes" title="Player skills & personality"><PlayerAttributes stats={r.stats}/><PlayerPersonalities primary={r.primaryPersonality} secondary={r.secondaryPersonality}/></Section><Stats article={article}/><Section id="teams" title="Current clubs"><TeamCards teams={r.teams??[]}/></Section><Section id="signatures" title="Signature Avatars"><div className="pedia-link-list">{r.signature_avatars?.map(avatar=><a key={avatar.id} href={pediaHref('avatars',avatar.id)}>{avatar.name}<span>{avatar.primaryRole}</span></a>)}</div>{!r.signature_avatars?.length&&<Empty>No signature Avatars are published.</Empty>}</Section><Section id="schedule" title="Recent verified results"><MatchList fixtures={r.fixtures??[]} onWatch={onWatch}/></Section></>}
    {kind==='avatars'&&<><Section id="abilities" title="Abilities">{r.skills?.map(skill=><article className="pedia-ability" key={skill.id}><div><span>{pediaStatus(skill.slot)}</span><h3>{skill.name}</h3>{skill.disabled&&<p className="pedia-muted">Disabled in the current content catalog</p>}</div><p>{skill.desc}</p><div className="pedia-inline-facts">{skill.cooldown!==undefined&&<span>Base cooldown {skill.cooldown}s</span>}{skill.damage!==undefined&&<span>Catalog base damage {skill.damage}</span>}</div></article>)}</Section><Section id="base-stats" title="Base statistics"><dl className="pedia-stat-grid">{Object.entries({hp:'Health',ad:'Attack damage',armor:'Armor',mr:'Magic resistance',aspd:'Attack speed',range:'Attack range'}).map(([key,label])=><div key={key}><dt>{label}</dt><dd>{String(r[key as keyof typeof r]??'—')}</dd></div>)}</dl></Section><Stats article={article}/><Section id="signatures" title="Signature players"><div className="pedia-link-list">{r.signature_players?.map(player=><a href={pediaHref('players',player.id)} key={player.id}>{player.name}<span>{player.role}</span></a>)}</div>{!r.signature_players?.length&&<Empty>No signature players are published.</Empty>}</Section><Section id="schedule" title="Recent verified appearances"><MatchList fixtures={r.fixtures??[]} onWatch={onWatch}/></Section></>}
    {kind==='coaches'&&<Section id="attributes" title="Published coaching attributes">{r.coachAttributes?<dl className="pedia-stat-grid">{Object.entries(r.coachAttributes).map(([key,value])=><div key={key}><dt>{key.replace(/([A-Z])/g,' $1')}</dt><dd>{value}/10</dd></div>)}</dl>:<Empty>No individual coaching attributes are published in this catalog.</Empty>}<dl className="pedia-provenance">{([['Chemistry bonus',r.chemistryBonus],['Playbook bonus',r.playbookBonus],['Extra bans',r.extraBans]] as const).filter(([,value])=>value!==undefined).map(([label,value])=><div key={label}><dt><LabelIcon name={label} size={12}/>{label}</dt><dd>{value}</dd></div>)}</dl></Section>}
    {kind==='items'&&<><Section id="base-stats" title="Item statistics"><dl className="pedia-stat-grid">{Object.entries(r.stats??{}).map(([key,value])=><div key={key}><dt>{key.replace(/([A-Z])/g,' $1')}</dt><dd>{value}</dd></div>)}</dl></Section><Section id="passive" title={r.passiveName??'Passive effect'}><p>{r.passiveDesc}</p><p className="pedia-muted">Suitable roles: {r.suitableRoles?.join(', ')||'Not published'}.</p></Section></>}
    {kind==='releases'&&<Section id="release-data" title="Release provenance"><dl className="pedia-provenance"><dt>Catalog ID</dt><dd>{r.id}</dd><dt>Rules version</dt><dd>{r.rules??'Not recorded'}</dd><dt>Ability ruleset</dt><dd>{r.ability_ruleset??'Not recorded'}</dd></dl><p className="pedia-muted">This record describes an installed release. No editorial patch notes have been published for it.</p></Section>}
    {(kind==='organizers'||kind==='sponsors')&&<Section id="competitions" title="Published tournaments"><TournamentTable events={r.tournaments??[]}/></Section>}
  </>;
}

export function Hexapedia({onWatch,laboratory,catalogTools}:Props) {
  const {session}=useAccount();
  const [route,setRoute]=useState(readPediaRoute);
  const [hub,setHub]=useState<PediaHub|null>(null);
  const [article,setArticle]=useState<PediaArticle|null>(null);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [joining,setJoining]=useState(false);
  const [refresh,setRefresh]=useState(0);
  const [retry,setRetry]=useState(0);
  useEffect(()=>{const change=()=>{setRoute(readPediaRoute());setNotice('');};window.addEventListener('hashchange',change);return()=>window.removeEventListener('hashchange',change);},[]);
  useEffect(()=>{
    if(!isCloudPersistenceConfigured())return;
    const controller=new AbortController();setError('');setArticle(null);
    if(route.error||route.page||route.kind&&!route.id)return()=>controller.abort();
    const path=route.kind&&route.id?`/avatarpedia/articles/${route.kind}/${encodeURIComponent(route.id)}`:'/avatarpedia';
    const load=()=>void request<{data:PediaHub|PediaArticle}>(path,null,{signal:controller.signal})
      .then(result=>{if(controller.signal.aborted)return;setError('');if(route.id)setArticle(result.data as PediaArticle);else setHub(result.data as PediaHub);})
      .catch(problem=>{if(!controller.signal.aborted)setError((problem as Error).message);});
    load();const stopLive=onWorldUpdate(['fixtures','clubs','players','competitions','records','awards'],load);const timer=window.setInterval(load,60000);
    return()=>{controller.abort();window.clearInterval(timer);stopLive();};
  },[route.kind,route.id,route.page,route.error,refresh,retry]);
  useEffect(()=>{if(article&&route.id===String(article.record.id))document.title=`${article.record.name} · Hexapedia`;else document.title=(route.page?({guide:'Game guide',laboratory:'Avatar laboratory',catalog:'Catalog tools',awards:'Hexatrick Laurels'})[route.page]:route.kind?PEDIA_LABELS[route.kind]:'Hexapedia')+' | Hexatrick';},[article,route.kind,route.id,route.page]);
  async function register(){
    if(!route.id)return;
    if(!session){openAuthentication('sign-in',`hexapedia/tournaments/${route.id}`);return;}
    setJoining(true);setNotice('');
    try{await request(`/avatarpedia/events/${route.id}/register`,session,{method:'POST'});setNotice('Your club is registered for this tournament.');setRefresh(value=>value+1);}
    catch(problem){setNotice((problem as Error).message);}
    finally{setJoining(false);}
  }
  const embedded=route.kind==='nations'||route.kind==='tournaments'&&!!(article?.record.definition_id||article?.record.provenance==='launch_simulation');
  const sections:[string,string][]=route.kind?[...(embedded?[['overview','Overview']] as [string,string][]:sectionIds[route.kind]??[]),['sources','Record sources']]:[];
  return <div className="avatarpedia">
    <header className="pedia-masthead"><a href={pediaHref()} className="pedia-brand"><BookOpen size={26} strokeWidth={1.4}/><span>Hexapedia</span></a><GlobalSearch/></header>
    <nav className="pedia-navigation pedia-navigation--unified" aria-label="Hexapedia navigation"><a href={pediaHref()} aria-current={!route.kind&&!route.page?'page':undefined}><BookOpen size={14}/> Main page</a>{PEDIA_KINDS.map(kind=><a href={pediaHref(kind)} key={kind} aria-current={route.kind===kind?'page':undefined}><ReferenceIcon kind={kind} size={14}/>{PEDIA_LABELS[kind]}</a>)}{[['awards','Laurels'],['guide','Game guide'],['laboratory','Avatar laboratory'],['catalog','Catalog tools']].map(([page,label])=><a key={page} className="pedia-resource-tab" href={'#hexapedia/'+page} aria-current={route.page===page?'page':undefined}><LabelIcon name={label}/>{label}</a>)}</nav>
    {route.error?<div className="pedia-empty" role="alert"><h1>Record not found</h1><p>{route.error}</p><a href={pediaHref()}>Return to Hexapedia</a></div>:route.page==='awards'?<AwardsHall/>:route.page==='guide'?<GameGuide/>:route.page?<section className="pedia-tool-page"><header><h1><LabelIcon name={route.page==='laboratory'?'avatar':'catalog'}/>{route.page==='laboratory'?'Avatar laboratory':'Catalog tools'}</h1><p>Explore published game content and the existing preparation tools.</p></header>{(route.page==='laboratory'?laboratory:catalogTools)??<p><a href="#sign-in" onClick={e=>{e.preventDefault();openAuthentication('sign-in','hexapedia/'+route.page);}}>Sign in</a> to open these club tools.</p>}</section>:!isCloudPersistenceConfigured()?<Empty>The reference server is unavailable. Please open the connected application.</Empty>:error?<div className="pedia-empty" role="alert"><p>We could not load this Hexapedia record.</p><p>{error}</p><button className="cm-btn mt-3" onClick={()=>setRetry(value=>value+1)}>Try again</button> <a href={pediaHref()}>Main page</a></div>:route.kind&&route.id?article?<>
      <div className="pedia-article-heading"><p><a href={pediaHref()}>Hexapedia</a><ChevronRight size={12}/><a href={pediaHref(route.kind)}>{PEDIA_LABELS[route.kind]}</a></p><h1>{article.record.name}</h1><span>Overview · current record</span></div>
      <div className="pedia-article-tabs"><Contents sections={sections}/></div>
      {notice&&<p className="pedia-notice" role="status">{notice}</p>}
      <details className="pedia-mobile-contents"><summary>On this page</summary><Contents sections={sections}/></details>
      <div className="pedia-article-grid"><aside className="pedia-toc"><h2>Contents</h2><Contents sections={sections}/></aside><article className="pedia-article-body"><ArticleBody article={article} onWatch={onWatch} register={()=>void register()} joining={joining}/><Section id="sources" title="Record sources"><p>Competition and club information comes from the club registry and tournament records. Player definitions use the active catalog; Avatar abilities and items use published game content. Statistics include completed scheduled matches only.</p><dl className="pedia-provenance"><dt>Current player catalog</dt><dd>{article.source.catalog_id?<a href={pediaHref('releases',article.source.catalog_id)}>{article.source.catalog_id.slice(0,16)}</a>:'Unavailable'}</dd><dt>Game content revision</dt><dd>{article.source.content_hash.slice(0,16)}</dd><dt>Retrieved</dt><dd>{pediaTime(article.source.generated_at)} Manila</dd></dl></Section></article><InfoBox article={article}/></div>
    </>:<p role="status" className="pedia-empty">Loading article…</p>:route.kind?<Directory key={route.kind} kind={route.kind}/>:hub?<Hub hub={hub} onWatch={onWatch}/>:<p role="status" className="pedia-empty">Loading Hexapedia…</p>}
  </div>;
}
