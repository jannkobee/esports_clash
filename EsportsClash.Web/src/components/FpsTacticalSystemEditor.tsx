import {useEffect,useState} from 'react';
import {request,type ApiSession} from '../cloudPersistence';
import {FPS_ROLES} from '../fps/fpsRoleFit';
import {FPS_SPECIALTIES,FPS_GAMEPLANS,type FpsGameplan,type FpsScoutingProfile,type FpsPrimaryRole} from '../fps/fpsIdentity';
import {FpsIdentityMarks} from './FpsIdentityMarks';

type Orders={role:FpsPrimaryRole|null;instruction:'balanced'|'hold'|'initiative'|'support';training:string};
type System={revision:number;gameplan:FpsGameplan;instructions:Record<string,Orders>;coach:{name:string;profile:Record<string,number>};culture:FpsGameplan;active:boolean};
const dimensions:{key:keyof FpsGameplan;label:string;low:string;high:string}[]=[
  {key:'tempo',label:'Tempo',low:'Measured',high:'Fast'},
  {key:'structure',label:'Structure',low:'Flexible',high:'Assigned'},
  {key:'aggression',label:'Contact risk',low:'Conservative',high:'Assertive'},
  {key:'preparation',label:'Preparation',low:'Improvised',high:'Prepared'},
  {key:'freedom',label:'Individual freedom',low:'Directed',high:'Autonomous'},
  {key:'economy',label:'Economy',low:'Spend now',high:'Preserve resources'},
];
const defaults:Orders={role:null,instruction:'balanced',training:'system'};
export function FpsTacticalSystemEditor({session,players}:{session:ApiSession;players:{id:string;definition:{name:string}}[]}) {
  const [system,setSystem]=useState<System|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
  const [scouting,setScouting]=useState<FpsScoutingProfile[]>([]);
  const loadScouting=async(signal?:AbortSignal)=>{const response=await request<{data:FpsScoutingProfile[]}>('/online/fps-identities',session,{signal});setScouting(response.data);};
  const load=async(signal?:AbortSignal)=>{const response=await request<{data:System}>('/online/fps-system',session,{signal});setSystem(response.data);setError('');await loadScouting(signal);};
  useEffect(()=>{const controller=new AbortController();setSystem(null);setScouting([]);void load(controller.signal).catch(problem=>{if(!controller.signal.aborted)setError((problem as Error).message);});return()=>controller.abort();},[session.token]);
  if(!system)return <details><summary>Tactical system</summary><p role="status">{error||'Loading tactical system...'}</p></details>;
  const edit=(id:string,changes:Partial<Orders>)=>setSystem({...system,instructions:{...system.instructions,[id]:{...defaults,...system.instructions[id],...changes}}});
  return <section className="club-panel"><h3>Coach and tactical system</h3>
    <p>Head coach: <strong>{system.coach.name}</strong>. {system.active?'These orders apply to newly allocated FPS matches.':'Saved orders will apply when identity matches are activated.'} Locked matches keep their original orders.</p>
    <p>Team culture develops through the roster and repeated matches. Changes in approach take time to learn.</p>
    <form onSubmit={async event=>{event.preventDefault();setBusy(true);setError('');setNotice('');try{
      const instructions=Object.fromEntries(Object.entries(system.instructions).filter(([id])=>players.some(p=>p.id===id)));
      const response=await request<{data:System}>('/online/fps-system',session,{method:'PUT',body:JSON.stringify({revision:system.revision,gameplan:system.gameplan,instructions})});
      setSystem(response.data);setNotice('Gameplan and individual orders saved.');await loadScouting();
    }catch(problem){setError((problem as Error).message);}finally{setBusy(false);}}}>
      <label>Start from a philosophy<select aria-label="Gameplan philosophy" value="" disabled={busy} onChange={event=>{const preset=FPS_GAMEPLANS[event.target.value];if(preset)setSystem({...system,gameplan:{...preset.plan}});}}><option value="">Custom gameplan</option>{Object.entries(FPS_GAMEPLANS).map(([key,preset])=><option key={key} value={key}>{preset.name}</option>)}</select></label>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:16}}>{dimensions.map(({key,label,low,high})=><label key={key}>{label}: {low} / {high}<input style={{display:'block',width:'100%'}} type="range" min="0" max="1" step="0.05" value={system.gameplan[key]} disabled={busy} onChange={event=>setSystem({...system,gameplan:{...system.gameplan,[key]:Number(event.target.value)}})}/><small>Established culture: {Math.round(system.culture[key]*100)}%</small></label>)}</div>
      <div className="cm-table-wrap"><table className="cm-table"><thead><tr><th>Player identity</th><th>Role and instructions</th><th>Training</th><th>Contextual fit</th></tr></thead><tbody>{players.map(player=>{
        const report=scouting.find(r=>r.player_id===player.id),orders={...defaults,...system.instructions[player.id]};
        return <tr key={player.id}><th scope="row">{player.definition.name}<FpsIdentityMarks profile={report}/>{report&&<small>{report.confidence} ({report.appearances??0} verified appearances)</small>}</th>
          <td><label>Assignment<select disabled={busy} value={orders.role??''} onChange={e=>edit(player.id,{role:(e.target.value||null) as Orders['role']})}><option value="">Coach selects</option>{FPS_ROLES.map(role=><option key={role.id} value={role.id}>{role.name}</option>)}</select></label><label>Instruction<select disabled={busy} value={orders.instruction} onChange={e=>edit(player.id,{instruction:e.target.value as Orders['instruction']})}>{['balanced','hold','initiative','support'].map(value=><option key={value}>{value}</option>)}</select></label></td>
          <td><label>Development focus<select disabled={busy} value={orders.training} onChange={e=>edit(player.id,{training:e.target.value})}><option value="system">System familiarity</option><option value="specialty">Specialty practice</option>{FPS_ROLES.map(role=><option key={role.id} value={role.id}>{role.name} familiarity</option>)}</select></label></td>
          <td>{report?<><p>Coach: {report.coach_fit??'unavailable'}<br/>Gameplan: {report.gameplan_fit??'unavailable'}<br/>Familiarity: {report.familiarity}<br/>Chemistry: {report.team_chemistry??'unestablished'}</p><details><summary>Scouting notes</summary><p>Risk tendency: {report.observations.risk}. Adaptability: {report.observations.adaptability}. Preparation: {report.observations.preparation}. Team orientation: {report.observations.team_orientation}.</p><p>Pressure response: {report.observations.pressure_response??'unestablished'}. Economy discipline: {report.observations.economy_discipline??'unestablished'}.</p><p>Role familiarity: {FPS_ROLES.map(role=>{const value=report.role_familiarity?.[role.id as FpsPrimaryRole]??0;return role.name+': '+(value>.7?'familiar':value>.3?'learning':'new');}).join('; ')}.</p>{report.legacy_primary&&<p>Personality interpretation preserves the original {report.legacy_primary} badge in the historical record.</p>}{report.recent_observations?.map((note,i)=><p key={i}>{note}</p>)}</details></>:'Awaiting identity preparation'}</td></tr>;
      })}</tbody></table></div>
      <p>Specialty coverage: {[...new Set(scouting.map(r=>FPS_SPECIALTIES.find(s=>s.id===r.specialty_id)?.name).filter(Boolean))].join(', ')||'No prepared profiles'}.</p>
      <button className="cm-btn cm-btn-primary" disabled={busy}>{busy?'Saving...':'Save gameplan and orders'}</button>
      <button type="button" className="cm-btn" disabled={busy} onClick={()=>{setBusy(true);void request('/online/fps-identities/prepare',session,{method:'POST'}).then(()=>loadScouting()).catch(problem=>setError((problem as Error).message)).finally(()=>setBusy(false));}}>Prepare missing profiles</button>
      {error&&<p role="alert">{error} <button type="button" className="cm-btn" onClick={()=>void load().catch(problem=>setError((problem as Error).message))}>Reload saved plan</button></p>}{notice&&<p role="status">{notice}</p>}
    </form>
  </section>;
}
