import {onWorldUpdate} from '../worldLive';
import { useEffect, useState } from 'react';
import { Activity, Gavel, UserPlus, Trophy, Radio, ArrowRightLeft } from 'lucide-react';
import { request, isCloudPersistenceConfigured } from '../cloudPersistence';
import { pediaHref, pediaMoney, pediaTime, type PediaTeam } from '../hexapedia';
import { ReferenceMark } from './ReferenceIcon';
import './world-activity.css';

interface WorldEvent {
  id:number;kind:string;message:string;occurred_at:string;actor:PediaTeam|null;
  payload:{player_id?:string;team_id?:number;seller_id?:number;buyer_id?:number;tournament_id?:number;match_id?:string;auction_id?:number;amount?:number;currency?:string};
}
interface Feed {events:WorldEvent[];last_review_at:string|null;available:boolean}
const eventIcons={auction:Gavel,bid:Gavel,transfer:ArrowRightLeft,recruitment:UserPlus,competition:Trophy,result:Radio,club:Activity};

export function WorldActivity({onWatch}: {onWatch?:(id:string)=>void}) {
  const [feed,setFeed]=useState<Feed|null>(null);
  const [error,setError]=useState('');
  const [filter,setFilter]=useState('all');
  useEffect(()=>{
    if(!isCloudPersistenceConfigured())return;
    const controller=new AbortController();
    const load=()=>void request<{data:Feed}>('/avatarpedia/world',null,{signal:controller.signal})
      .then(response=>{setFeed(response.data);setError('');})
      .catch(()=>{if(!controller.signal.aborted)setError('World updates are temporarily unavailable.');});
    load();const stopLive=onWorldUpdate(['activity','clubs','market','fixtures'],load);const timer=window.setInterval(load,60000);
    return()=>{controller.abort();window.clearInterval(timer);stopLive();};
  },[]);
  const events=feed?.events.filter(event=>filter==='all'||filter==='market'&&['auction','bid','transfer'].includes(event.kind)||filter==='clubs'&&['club','recruitment'].includes(event.kind)||filter==='competition'&&['competition','result'].includes(event.kind))??[];
  return <section className="world-activity cm-panel" aria-label="Hexatrick world activity">
    <header className="cm-panel-header"><span className="flex items-center gap-2"><Activity size={15}/> Hexatrick world</span><label className="world-filter">Show <select aria-label="Filter world activity" value={filter} onChange={event=>setFilter(event.target.value)}><option value="all">All activity</option><option value="market">Transfers & bids</option><option value="clubs">Clubs & recruitment</option><option value="competition">Competitions</option></select></label></header>
    {error&&<p className="world-note" role="status">{error}</p>}
    {!feed&&!error&&<p className="world-note" role="status">Loading world records…</p>}
    {feed&&<><p className="world-note">Clubs share one living transfer market. Follow appointments, player moves and competition entries as they happen.</p>
      {!events.length&&<p className="world-note">No recorded activity in this section yet. Signings, auctions, bids and verified results appear as they happen.</p>}
      <ol className="world-activity-list">{events.slice(0,20).map(event=>{const Icon=eventIcons[event.kind as keyof typeof eventIcons]??Activity;return <li key={event.id}><div className="world-event-mark">{event.actor?<ReferenceMark kind="teams" identity={event.actor.identity}/>:<Icon size={20}/>}</div><div><div className="world-event-heading"><Icon size={12}/>{event.actor?.tag?<a href={pediaHref('teams',event.actor.id)}>{event.actor.name}</a>:event.actor&&<span>{event.actor.name}</span>}<time dateTime={event.occurred_at}>{pediaTime(event.occurred_at)} Manila</time></div><p>{event.message}</p><div className="world-event-links">{event.payload.player_id&&<a href={pediaHref('players',event.payload.player_id)}>Player profile</a>}{event.payload.tournament_id&&<a href={pediaHref('tournaments',event.payload.tournament_id)}>Tournament</a>}{event.payload.amount!==undefined&&<span>{pediaMoney(event.payload.amount)}</span>}{event.payload.match_id&&onWatch&&<button onClick={()=>onWatch(event.payload.match_id!)}>Match report</button>}</div></div></li>;})}</ol>
    </>}
  </section>;
}
