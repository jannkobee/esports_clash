import {WireAccounts,WireAccountMark,type WireAccount} from './WireAccounts';
import {RoleLabel} from './RoleLabel';
import {WorldDesk} from './WorldDesk';
import {relativeGameTime} from '../dateTime';
import {PersonPortrait} from './PersonPortrait';
import {onWorldUpdate} from '../worldLive';
import {useEffect,useRef,useState} from 'react';
import {Newspaper,Radio,Video,ChartNoAxesCombined,UserRound,MessageCircle,RefreshCw,ChevronDown,ArrowUpRight,MoreHorizontal,Trash2,Trophy,History,Link2,ArrowLeft,BadgeCheck,Quote,Globe2} from 'lucide-react';
import {request} from '../cloudPersistence';
import {useAccount} from '../AccountContext';
import {openAuthentication} from '../authNavigation';
import {pediaHref,pediaTime} from '../hexapedia';
import {ReportContentButton,WorldModerationDesk} from './NewsModeration';
import './news-feed.css';
import './wire-x.css';

interface NewsPost {wire_account_id?:number|null;account_kind?:string;account_source_id?:string;handle?:string;source_post_id?:number|null;arena_update_id?:number|null;id:number;headline:string;body:string;personality:string|null;personality_id?:number;manager:string|null;role:string|null;kind:string;published_at:string;comments:number;match_id:string|null;match_status?:string|null;tournament_id:number|null;launch_game_id:number|null;author_id:number|null;facts:Record<string,unknown>}
interface Personality {id:number;name:string;role:string;bio:string}
interface Comment {id:number;name:string;user_id:number;body:string;created_at:string}
const filters=[['','Latest'],['result','Results'],['tournament','Tournaments'],['spotlight','Players'],['world_activity','World activity'],['arena_update','Patch updates'],['reaction','Reactions'],['community','Managers'],['launch_archive','Launch archive']];
const topic=(p:NewsPost)=>p.facts.provenance==='statistical_exhibition'?'Exhibition simulation':p.kind==='launch_archive'?'Launch archive':p.kind==='community'?'Club voices':p.kind==='spotlight'?'People':p.kind==='tournament'?'Competition desk':'Match report';
function DeskMark({role}:{role:string|null}){const Icon=role==='caster'?Radio:role==='analyst'?ChartNoAxesCombined:role==='streamer'?Video:UserRound;return <span className={'wire-desk-mark wire-desk-mark--'+(role??'manager')}><Icon size={20}/></span>;}

const handleOf=(name:string)=>'@'+name.toLowerCase().replace(/[^a-z0-9]/g,'');

/** A reply thread under a post, in the familiar social layout: who you reply to, a composer, then replies joined by a thread line. */
function Replies({post,replyingTo,onCountChange}:{post:number;replyingTo:string;onCountChange:(delta:number)=>void}){
  const {session}=useAccount();const [rows,setRows]=useState<Comment[]>([]),[text,setText]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[more,setMore]=useState(false),[loaded,setLoaded]=useState(false);
  const load=async(before?:number,signal?:AbortSignal)=>{try{const r=await request<{data:Comment[]}>( '/world/news/'+post+'/comments'+(before?'?before='+before:''),session,{signal});setRows(old=>before?[...old,...r.data.filter(c=>!old.some(x=>x.id===c.id))]:r.data);setMore(r.data.length===50);setLoaded(true);}catch(e){if(!signal?.aborted)setError((e as Error).message);}};
  useEffect(()=>{const c=new AbortController();void load(undefined,c.signal);return()=>c.abort();},[post,session?.token]);
  return <section className="wire-thread" aria-label="Replies">
    {session?<form className="wire-reply-composer" onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{await request('/world/news/'+post+'/comments',session,{method:'POST',body:JSON.stringify({body:text})});setText('');onCountChange(1);await load();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}>
      <PersonPortrait id={'manager-'+session.user.id} name={session.user.name} role="manager" size={36}/>
      <div><p className="wire-replying">Replying to <b>{replyingTo}</b></p>
        <label className="sr-only" htmlFor={'reply-'+post}>Your reply</label>
        <textarea id={'reply-'+post} required rows={text?3:1} maxLength={1500} value={text} onChange={e=>setText(e.target.value)} placeholder="Post your reply"/>
        <footer><CharRing used={text.length} max={1500}/><button className="wire-pill" disabled={busy||!text.trim()}>{busy?'Replying…':'Reply'}</button></footer></div>
    </form>:<button className="wire-pill wire-pill--ghost" onClick={()=>openAuthentication('sign-in','wire')}>Sign in to reply</button>}
    {error&&<p role="alert" className="wire-error">{error}</p>}
    {rows.map(c=><article key={c.id} className="wire-reply">
      <div className="wire-post__avatar"><PersonPortrait id={'manager-'+c.user_id} name={c.name} role="manager" size={36}/></div>
      <div className="wire-post__main">
        <header className="wire-post__head"><strong>{c.name}</strong><span className="wire-handle">{handleOf(c.name)+c.user_id}</span><span aria-hidden="true">·</span><time dateTime={c.created_at} title={pediaTime(c.created_at)+' Manila'}>{relativeGameTime(c.created_at)}</time></header>
        <p className="wire-replying">Replying to <b>{replyingTo}</b></p>
        <p className="wire-post__text">{c.body}</p>
        <div className="wire-actions wire-actions--small"><ReportContentButton postId={post} commentId={c.id}/>{c.user_id===session?.user.id&&<button className="wire-action is-danger" disabled={busy} onClick={async()=>{setBusy(true);try{await request('/world/comments/'+c.id,session,{method:'DELETE'});setRows(old=>old.filter(x=>x.id!==c.id));onCountChange(-1);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}><Trash2 size={14}/><span>Delete</span></button>}</div>
      </div>
    </article>)}
    {loaded&&!rows.length&&<p className="wire-thread__empty">No replies yet. Be the first.</p>}
    {more&&<button className="wire-show-more" onClick={()=>void load(rows.at(-1)?.id)}>Show older replies</button>}
  </section>;
}

/** Characters used, as a filling ring that turns amber near the limit and red at it. */
function CharRing({used,max}:{used:number;max:number}){
  const ratio=Math.min(1,used/max),left=max-used,c=2*Math.PI*9,tone=left<=0?'is-over':left<=max*.1?'is-near':'';
  return <span className={'wire-ring '+tone} aria-label={`${used} of ${max} characters`} title={`${left} characters left`}><svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true"><circle cx="11" cy="11" r="9" className="wire-ring__track"/><circle cx="11" cy="11" r="9" className="wire-ring__fill" style={{strokeDasharray:`${c*ratio} ${c}`}}/></svg>{left<=max*.1&&<small>{left}</small>}</span>;
}

function handle(p:NewsPost){return p.handle?'@'+p.handle:'@'+(p.personality??p.manager??'competition').toLowerCase().replace(/[^a-z0-9]/g,'')+(p.personality?'':p.author_id??'');}

export function NewsFeed({compact=false,matchId,onWatch}:{compact?:boolean;matchId?:string;onWatch:(id:string)=>void}){
  const {session}=useAccount();const [posts,setPosts]=useState<NewsPost[]>([]),[desks,setDesks]=useState<Personality[]>([]),[error,setError]=useState(''),[filter,setFilter]=useState(''),[next,setNext]=useState<number|null>(null),[opened,setOpened]=useState<number|null>(null),[text,setText]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[expanded,setExpanded]=useState<number[]>([]),[copied,setCopied]=useState<number|null>(null);
  const [postId,setPostId]=useState(()=>new URLSearchParams(window.location.hash.split('?')[1]??'').get('post'));
  const [accountId,setAccountId]=useState(()=>new URLSearchParams(window.location.hash.split('?')[1]??'').get('account'));
  const [ownedAccounts,setOwnedAccounts]=useState<WireAccount[]>([]),[postingAccount,setPostingAccount]=useState('');
  useEffect(()=>{setOwnedAccounts([]);setPostingAccount('');if(!session)return;const c=new AbortController();void request<{data:WireAccount[]}>('/world/owned-accounts',session,{signal:c.signal}).then(r=>{if(!c.signal.aborted)setOwnedAccounts(r.data);}).catch(()=>{});return()=>c.abort();},[session?.token]);
  const generation=useRef(0);
  const load=async(before?:number,signal?:AbortSignal)=>{const current=generation.current;setLoading(true);try{const qs=new URLSearchParams();if(filter)qs.set('kind',filter);if(matchId)qs.set('match',matchId);if(postId)qs.set('post',postId);if(accountId&&!postId)qs.set('account',accountId);if(before)qs.set('before',String(before));const r=await request<{data:NewsPost[];next_before:number|null;personalities:Personality[]}>('/world/news?'+qs,null,{signal});if(current!==generation.current||signal?.aborted)return;setPosts(old=>before?[...old,...r.data.filter(p=>!old.some(x=>x.id===p.id))]:r.data);setNext(r.next_before);setDesks(r.personalities);setError('');}catch(e){if(current===generation.current&&!signal?.aborted)setError((e as Error).message);}finally{if(current===generation.current&&!signal?.aborted)setLoading(false);}};
  useEffect(()=>{const c=new AbortController();generation.current++;setPosts([]);setOpened(postId?Number(postId):null);void load(undefined,c.signal);if(!compact&&!matchId)return()=>c.abort();const timer=window.setInterval(()=>void load(undefined,c.signal),30000);return()=>{c.abort();clearInterval(timer);};},[filter,matchId,compact,postId,accountId]);
  useEffect(()=>{const sync=()=>{const params=new URLSearchParams(window.location.hash.split('?')[1]??'');setPostId(params.get('post'));setAccountId(params.get('account'));setFilter('');};window.addEventListener('hashchange',sync);return()=>window.removeEventListener('hashchange',sync);},[]);
  useEffect(()=>onWorldUpdate(['news','comments'],()=>{generation.current++;void load();}),[filter,matchId,compact,postId,accountId]);
  const full=!compact&&!matchId;
  const share=async(id:number)=>{try{await navigator.clipboard.writeText(window.location.href.split('#')[0]+'#wire?post='+id);setCopied(id);}catch{setError('Your browser could not copy the link. Open the post timestamp to view its shareable address.');}};
  const avatarOf=(p:NewsPost,size:number)=>p.wire_account_id?<WireAccountMark account={{id:p.wire_account_id,name:p.personality??'Account',handle:p.handle??'',kind:p.account_kind??'',source_id:p.account_source_id??'',role:p.role??'',profile:{}}} size={size}/>:<PersonPortrait id={p.personality_id?'talent-'+p.personality_id:'manager-'+p.author_id} name={p.personality??p.manager??'Club manager'} role={p.role??'manager'} size={size}/>;
  const nameOf=(p:NewsPost)=>p.wire_account_id?<a href={'#wire?account='+p.wire_account_id}>{p.personality}</a>:p.personality&&p.personality_id?<a href={pediaHref('talent',p.personality_id)}>{p.personality}</a>:<span>{p.manager??'Competition desk'}</span>;
  return <section className={'wire'+(full?' wire--full':' wire--compact')}><header className="wire-masthead"><div className="wire-title"><Newspaper size={22}/><div><h2>{matchId?'Match conversation':'The Wire'}</h2><p>Voices from the Hexatrick world</p></div></div>{compact?<a href="#wire">Open feed<ArrowUpRight size={14}/></a>:<button className="wire-text-button" disabled={loading} onClick={()=>void load()}><RefreshCw size={15}/>{loading?'Refreshing':'Refresh'}</button>}</header>
    <div className="wire-layout"><div className="wire-main">{full&&<><nav className="wire-topics" aria-label="Feed topics">{filters.map(([value,label])=><button key={value} aria-pressed={filter===value&&!postId} className={filter===value&&!postId?'active':''} onClick={()=>{setFilter(value);setPostId(null);setAccountId(null);window.history.replaceState(null,'','#wire');}}>{label}</button>)}</nav><WireAccounts selected={accountId}/>{postId?<a className="wire-back" href="#wire" onClick={()=>setPostId(null)}><ArrowLeft size={14}/>Back to the feed</a>:<section className="wire-composer">
        {session?<PersonPortrait id={'manager-'+session.user.id} name={session.user.name} role="manager" size={42}/>:<DeskMark role={null}/>}
        <form onSubmit={async e=>{e.preventDefault();if(!session){openAuthentication('sign-in','wire');return;}setBusy(true);setError('');try{await request('/world/news',session,{method:'POST',body:JSON.stringify({body:text,...(postingAccount?{account_id:Number(postingAccount)}:{})})});setText('');if(!filter)await load();else setFilter('');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}>
          {!!ownedAccounts.length&&<label className="wire-composer__as"><span className="sr-only">Post as</span><select value={postingAccount} onChange={e=>setPostingAccount(e.target.value)}><option value="">Posting as my manager account</option>{ownedAccounts.map(a=><option key={a.id} value={a.id}>Posting as {a.name}</option>)}</select></label>}
          <label className="sr-only" htmlFor="wire-post">Post a club update</label>
          <textarea id="wire-post" rows={text?3:1} required maxLength={2000} placeholder="What is happening at your club?" value={text} onChange={e=>setText(e.target.value)}/>
          <footer><span className="wire-composer__hint"><Globe2 size={13} aria-hidden="true"/>Everyone in the circuit can reply</span><CharRing used={text.length} max={2000}/><button className="wire-pill" disabled={busy||!text.trim()}>{busy?'Posting…':session?'Post':'Sign in to post'}</button></footer>
        </form>
      </section>}</>}{error&&<p className="wire-error" role="alert">{error}</p>}
      {!posts.length&&<div className="wire-empty"><Newspaper size={26}/><h3>{loading?'Loading the feed...':postId?'Post unavailable':'No posts here yet'}</h3><p>{postId?'It may have been removed or hidden.':'Club voices and recorded competition updates will appear here.'}</p></div>}
      {(compact?posts.slice(0,4):posts).map(p=><article className={'wire-post'+(opened===p.id?' is-open':'')} id={'wire-post-'+p.id} key={p.id}>
        <div className="wire-post__avatar">{avatarOf(p,42)}</div>
        <div className="wire-post__main">
          <header className="wire-post__head"><strong>{nameOf(p)}</strong>{p.personality&&<span className="wire-verified" title="Circuit media personality"><BadgeCheck size={15} aria-hidden="true"/></span>}<span className="wire-handle">{handle(p)}</span><span aria-hidden="true">·</span><a className="wire-time" title={pediaTime(p.published_at)+' Manila'} href={'#wire?post='+p.id}><time dateTime={p.published_at}>{relativeGameTime(p.published_at)}</time></a>
            {session&&<details className="wire-story-options"><summary aria-label="Post options"><MoreHorizontal size={18}/></summary><div><ReportContentButton postId={p.id}/>{p.author_id===session.user.id&&<button className="wire-text-button" disabled={busy} onClick={async()=>{setBusy(true);try{await request('/world/news/'+p.id,session,{method:'DELETE'});setPosts(old=>old.filter(x=>x.id!==p.id));}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}><Trash2 size={13}/> Remove post</button>}</div></details>}</header>
          {p.personality&&<small className="wire-author-kind"><RoleLabel role={p.role}/></small>}
          {(p.kind==='launch_archive'||p.facts.provenance==='statistical_exhibition')&&<span className="wire-provenance">{topic(p)}</span>}
          {p.kind==='arena_update'&&<span className="wire-provenance">Release note · {p.facts.release_status==='released'?'Released':'Announced'}</span>}
          {p.kind!=='community'&&p.kind!=='reaction'&&<p className="wire-post__lead">{p.headline.replace(/(?: \?| ·) live$/,' - Broadcast opened')}</p>}
          <p className="wire-post__text">{p.body.length>420&&!expanded.includes(p.id)?p.body.slice(0,420)+'…':p.body}</p>
          {p.body.length>420&&<button className="wire-text-button wire-expand" onClick={()=>setExpanded(v=>v.includes(p.id)?v.filter(id=>id!==p.id):[...v,p.id])}>{expanded.includes(p.id)?'Show less':'Show more'}</button>}
          {p.kind==='reaction'&&<a className="wire-quote" href={'#wire?post='+p.source_post_id}><span className="wire-quote__head"><Quote size={13} aria-hidden="true"/>Quoting a post</span>{typeof p.facts.source_quote==='string'?<span className="wire-quote__text">{typeof p.facts.source_quote_display==='string'?p.facts.source_quote_display:p.facts.source_quote}</span>:<span className="wire-quote__text">A recorded update</span>}</a>}
          <div className="wire-chips">{typeof p.facts.team_id==='number'&&<a href={pediaHref('teams',p.facts.team_id)}><UserRound size={12}/>Club</a>}{typeof p.facts.auction_id==='number'&&<a href={'#transfer-exchange?auction='+p.facts.auction_id}><ArrowUpRight size={12}/>Transfer</a>}{typeof p.facts.manager_id==='number'&&<a href={pediaHref('managers',p.facts.manager_id)}><UserRound size={12}/>Manager</a>}{typeof p.facts.award_year==='number'&&<a href={'#hexapedia/awards?year='+p.facts.award_year}><Trophy size={12}/>Laurels</a>}{p.tournament_id&&<a href={pediaHref('tournaments',p.tournament_id)}><Trophy size={12}/>Tournament</a>}{typeof p.facts.player_id==='string'&&<a href={pediaHref('players',p.facts.player_id)}><UserRound size={12}/>Player</a>}{p.match_id&&<button type="button" className={p.match_status==='running'?'is-live':''} onClick={()=>onWatch(p.match_id!)}><Radio size={12}/>{p.match_status==='interrupted'?'Interrupted recording':p.match_status==='running'?'Watch live':'Match recording'}</button>}{p.launch_game_id&&<a href="#launch-championship"><History size={12}/>Archive report</a>}</div>
          <div className="wire-actions" role="group" aria-label="Post actions">
            <button type="button" className="wire-action is-reply" aria-expanded={opened===p.id} onClick={()=>setOpened(opened===p.id?null:p.id)} title="Reply"><MessageCircle size={17}/><span>{p.comments||''}</span><span className="sr-only">{p.comments===1?'reply':'replies'}</span></button>
            <button type="button" className={'wire-action is-share'+(copied===p.id?' is-done':'')} onClick={()=>void share(p.id)} title="Copy link"><Link2 size={17}/><span>{copied===p.id?'Copied':''}</span><span className="sr-only">Copy link</span></button>
            <a className="wire-action is-open" href={'#wire?post='+p.id} title="Open thread"><ArrowUpRight size={17}/><span className="sr-only">Open thread</span></a>
          </div>
          {opened===p.id&&<Replies post={p.id} replyingTo={handle(p)} onCountChange={delta=>setPosts(old=>old.map(item=>item.id===p.id?{...item,comments:Math.max(0,item.comments+delta)}:item))}/>}
        </div>
      </article>)}
      {!compact&&next&&<button className="wire-load-more" disabled={loading} onClick={()=>void load(next)}>{loading?'Loading...':'Earlier posts'}<ChevronDown size={15}/></button>}
    </div>{full&&<aside className="wire-sidebar"><WorldDesk compact/><section><h3><Radio size={16}/> Around the circuit</h3><p>Original media personalities covering the living world.</p>{desks.slice(0,5).map(d=><article className="wire-personality" key={d.id}><PersonPortrait id={'talent-'+d.id} name={d.name} role={d.role} size={46}/><div><strong><a href={pediaHref('talent',d.id)}>{d.name}</a></strong><small><RoleLabel role={d.role}/></small><p>{d.bio.replace(/^Fictional /,'')}</p></div></article>)}</section><section><h3><Trophy size={16}/> Explore</h3><a href="#hexapedia/tournaments">Tournaments<ArrowUpRight size={13}/></a><a href="#hexacast">Live on Hexacast<ArrowUpRight size={13}/></a><a href="#hexapedia/players">Player records<ArrowUpRight size={13}/></a><a href="#hexapedia/guide">Game guide<ArrowUpRight size={13}/></a></section><WorldModerationDesk/><p className="wire-editorial-note">Launch simulations are labeled separately. Managers speak for themselves.</p></aside>}</div>
  </section>;
}
