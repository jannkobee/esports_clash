import {useEffect,useState} from 'react';
import {Flag,ShieldCheck} from 'lucide-react';
import {useAccount} from '../AccountContext';
import {request} from '../cloudPersistence';

export function ReportContentButton({postId,commentId}:{postId:number;commentId?:number}) {
  const {session}=useAccount();
  const [open,setOpen]=useState(false),[reason,setReason]=useState('spam'),[detail,setDetail]=useState(''),[busy,setBusy]=useState(false),[sent,setSent]=useState(false),[error,setError]=useState('');
  if(!session)return null;
  return <div className="news-content-report"><button className="cm-btn" disabled={sent} onClick={()=>setOpen(!open)}><Flag size={12}/>{sent?'Reported':'Report'}</button>{open&&!sent&&<form onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{await request(`/world/news/${postId}/report`,session,{method:'POST',body:JSON.stringify({comment_id:commentId,reason,detail})});setSent(true);setOpen(false);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}><label>Reason<select value={reason} onChange={e=>setReason(e.target.value)}><option value="spam">Spam</option><option value="harassment">Harassment</option><option value="misleading">Misleading information</option><option value="other">Other</option></select></label><label>Details (optional)<textarea maxLength={500} value={detail} onChange={e=>setDetail(e.target.value)}/></label><p className="club-help">A moderator reviews reports. Reporting does not automatically hide content.</p>{error&&<p role="alert">{error}</p>}<button className="cm-btn" disabled={busy}>{busy?'Sending…':'Send report'}</button></form>}</div>;
}

interface MediaReport {id:number;reason:string;detail:string|null;headline:string;body:string;comment_body:string|null;comment_id:number|null}
export function WorldModerationDesk() {
  const {session}=useAccount();const [admin,setAdmin]=useState(false),[open,setOpen]=useState(false),[rows,setRows]=useState<MediaReport[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  useEffect(()=>{setAdmin(false);if(!session)return;const controller=new AbortController();void request<{data:{admin:boolean}}>('/competitions/mine',session,{signal:controller.signal}).then(r=>setAdmin(r.data.admin)).catch(()=>{});return()=>controller.abort();},[session?.token]);
  const load=async()=>{setBusy(true);setError('');try{const r=await request<{data:MediaReport[]}>('/world/moderation',session);setRows(r.data);}catch(e){setError((e as Error).message);}finally{setBusy(false);}};
  if(!admin)return null;
  return <section className="world-moderation"><button className="cm-btn" onClick={()=>{setOpen(!open);if(!open)void load();}}><ShieldCheck size={14}/> Report review</button>{open&&<><h3><ShieldCheck size={14}/> Open content reports</h3>{error&&<p role="alert">{error}</p>}{!rows.length&&!busy&&<p>No open reports.</p>}{rows.map(r=><article className="world-post" key={r.id}><strong>{r.comment_id?'Reply to: ':''}{r.headline}</strong><p className="world-post-body">{r.comment_id?r.comment_body:r.body}</p><p>Reason: {r.reason}</p>{r.detail&&<p>{r.detail}</p>}{(['hide','dismiss'] as const).map(decision=><button className="cm-btn" disabled={busy} key={decision} onClick={async()=>{setBusy(true);setError('');try{await request(`/world/moderation/${r.id}`,session,{method:'POST',body:JSON.stringify({decision})});await load();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}>{decision==='hide'?'Hide content':'Dismiss report'}</button>)}</article>)}<button className="cm-btn" disabled={busy} onClick={()=>void load()}>Refresh reports</button></>}</section>;
}
