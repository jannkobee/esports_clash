import {FPS_ABILITIES,FPS_ABILITY_LABELS} from '../fps/fpsSkillProfile';
import {useEffect,useState} from 'react';
import {request,type ApiSession} from '../cloudPersistence';
import {FPS_T_POSITIONS,FPS_CT_POSITIONS,FPS_POSITION_LABELS,FPS_GAMEPLANS,deriveFpsTendencies,computeTeamIdentityComparison,analyzeTeamDynamics,computeObservedTeamTendencies,describeIglLeadershipIdentity,FPS_OBSERVED_TEAM_CATEGORIES,FPS_OBSERVED_TEAM_CATEGORY_LABELS,FPS_OBSERVED_TEAM_MIN_MATCHES,FPS_OBSERVED_TEAM_MIN_OPPORTUNITIES,generatePlayerDNA,type FpsGameplan,type FpsScoutingProfile} from '../fps/fpsIdentity';
import {FpsIdentityMarks} from './FpsIdentityMarks';
// Manager-facing 1–10 levels use the one owner-mandated conversion (fpsScale10).
import {fpsScale10 as toScale10} from '../fps/fpsScale10';
import {FPS_DIAGNOSTIC_TENDENCY_KEYS} from '../fps/fpsTendencyFormulas';
import {deriveFpsConsistency,fpsConsistencyRated} from '../fps/fpsConsistency';
import {fpsScale10,fpsLevelMidpoint,fpsRatedText} from '../fps/fpsScale10';

/**
 * Tendencies for diagnostics come from the server (`derived_tendencies`, computed from stored DNA, which
 * development can change). Only when a profile lacks them is the natural identity estimated locally from
 * the ID-based DNA, and the view says so.
 */
function diagnosticTendencies(report:FpsScoutingProfile,id:string){
  // Server values are 1–10 levels; diagnostics read each level's midpoint, and the local estimate is
  // quantized the same way so both paths use one resolution.
  const natural=deriveFpsTendencies(report.personality,generatePlayerDNA(id));
  const server=report.derived_tendencies;
  if(server&&FPS_DIAGNOSTIC_TENDENCY_KEYS.every(key=>Number.isFinite(server[key]?.value)))return {tendencies:{...natural,...Object.fromEntries(Object.entries(server).map(([key,r])=>[key,fpsLevelMidpoint(r.value)]))},estimated:false};
  return {tendencies:{...natural,...Object.fromEntries(FPS_DIAGNOSTIC_TENDENCY_KEYS.map(key=>[key,fpsLevelMidpoint(fpsScale10(natural[key]))]))},estimated:true};
}
const consistencyText=(report:FpsScoutingProfile,id:string)=>report.consistency?fpsRatedText(report.consistency):`${fpsRatedText(fpsConsistencyRated(deriveFpsConsistency(report.personality,generatePlayerDNA(id))))} (estimated)`;

type Orders={t?:import('../fps/fpsIdentity').FpsTPosition;ct?:import('../fps/fpsIdentity').FpsCtPosition;instruction:'balanced'|'hold'|'initiative'|'support';training:string};
type System={revision:number;gameplan:FpsGameplan;instructions:Record<string,Orders>;coach:{name:string;profile:Record<string,number>};culture:FpsGameplan;active:boolean;starterIds:string[];recommendations:Record<string,import('../fps/fpsIdentity').FpsAssignments>};
const dimensions:{key:keyof FpsGameplan;label:string;low:string;high:string}[]=[
  {key:'tempo',label:'Tempo',low:'Measured',high:'Fast'},
  {key:'structure',label:'Structure',low:'Flexible',high:'Assigned'},
  {key:'aggression',label:'Contact risk',low:'Conservative',high:'Assertive'},
  {key:'preparation',label:'Preparation',low:'Improvised',high:'Prepared'},
  {key:'freedom',label:'Individual freedom',low:'Directed',high:'Autonomous'},
  {key:'economy',label:'Economy',low:'Spend now',high:'Preserve resources'},
];
const defaults:Orders={instruction:'balanced',training:'system'};
export function FpsTacticalSystemEditor({session,players,onSaved}:{session:ApiSession;players:{id:string;definition:{name:string;stats?:Record<string,number>}}[];onSaved?:()=>void}) {
  const [system,setSystem]=useState<System|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
  const [scouting,setScouting]=useState<FpsScoutingProfile[]>([]);
  const loadScouting=async(signal?:AbortSignal)=>{const response=await request<{data:FpsScoutingProfile[]}>('/online/fps-identities',session,{signal});setScouting(response.data);};
  const load=async(signal?:AbortSignal)=>{const response=await request<{data:System}>('/online/fps-system',session,{signal});setSystem(response.data);setError('');await loadScouting(signal);};
  useEffect(()=>{const controller=new AbortController();setSystem(null);setScouting([]);void load(controller.signal).catch(problem=>{if(!controller.signal.aborted)setError((problem as Error).message);});return()=>controller.abort();},[session.token]);
  if(!system)return <details><summary>Tactical system</summary><p role="status">{error||'Loading tactical system...'}</p></details>;
  const edit=(id:string,changes:Partial<Orders>)=>setSystem({...system,instructions:{...system.instructions,[id]:{...defaults,...system.instructions[id],...changes}}});
  const starterIds=system.starterIds??[],assigned=starterIds.filter(id=>system.instructions[id]?.t&&system.instructions[id]?.ct).length;
  return <section className="club-panel" id="team-roles"><h3>Coach and tactical system</h3>
    <p>Head coach: <strong>{system.coach.name}</strong>. {system.active?'These orders apply to newly allocated FPS matches.':'Saved orders will apply when identity matches are activated.'} Locked matches keep their original orders.</p>
    <p>Team culture develops through the roster and repeated matches. Changes in approach take time to learn.</p>
    <p>Players start without a team role. Choose their T and CT responsibilities using their strengths and your gameplan. {assigned}/5 starters have both roles selected.</p>
    <form onSubmit={async event=>{event.preventDefault();setBusy(true);setError('');setNotice('');try{
      const instructions=Object.fromEntries(Object.entries(system.instructions).filter(([id])=>players.some(p=>p.id===id)));
      const response=await request<{data:System}>('/online/fps-system',session,{method:'PUT',body:JSON.stringify({revision:system.revision,gameplan:system.gameplan,instructions})});
      setSystem(response.data);setNotice('Gameplan and individual orders saved.');onSaved?.();await loadScouting();
    }catch(problem){setError((problem as Error).message);}finally{setBusy(false);}}}>
      <label>Start from a philosophy<select aria-label="Gameplan philosophy" value="" disabled={busy} onChange={event=>{const preset=FPS_GAMEPLANS[event.target.value];if(preset)setSystem({...system,gameplan:{...preset.plan}});}}><option value="">Custom gameplan</option>{Object.entries(FPS_GAMEPLANS).map(([key,preset])=><option key={key} value={key}>{preset.name}</option>)}</select></label>
      <button type="button" className="cm-btn" disabled={busy||!system.recommendations} onClick={()=>{const instructions={...system.instructions};for(const [id,roles] of Object.entries(system.recommendations))instructions[id]={...defaults,...instructions[id],...roles};setSystem({...system,instructions});setNotice('Suggested roles added to your draft. Review or change them, then save.');}}>Suggest roles from strengths</button>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:16}}>{dimensions.map(({key,label,low,high})=><label key={key}>{label}: {low} / {high}<input style={{display:'block',width:'100%'}} type="range" min="0" max="1" step="0.05" value={system.gameplan[key]} disabled={busy} onChange={event=>setSystem({...system,gameplan:{...system.gameplan,[key]:Number(event.target.value)}})}/><small>Established culture: {Math.round(system.culture[key]*100)}%</small></label>)}</div>
      {scouting.length>0&&(()=>{
        const starterProfiles=starterIds.map(id=>{
          const p=players.find(pl=>pl.id===id),r=scouting.find(s=>s.player_id===id),o=system.instructions[id];
          if(!p||!r?.personality)return null;
          return {id,name:p.definition.name,orders:o,observed:r.observed,...diagnosticTendencies(r,id)};
        }).filter((x):x is NonNullable<typeof x>=>!!x);
        const igl=starterProfiles.find(s=>s.orders?.t==='T_IGL'||s.orders?.ct==='CT_IGL');
        const entry=starterProfiles.find(s=>s.orders?.t==='T_ENTRY');
        const support=starterProfiles.find(s=>s.orders?.t==='T_SUPPORT');
        const lurker=starterProfiles.find(s=>s.orders?.t==='T_LURKER');
        const rotators=starterProfiles.filter(s=>s.orders?.ct==='CT_ROTATOR'||s.orders?.ct==='CT_FLEX');
        const teamId=igl?computeTeamIdentityComparison(system.gameplan,system.coach.profile,igl.tendencies,starterProfiles.map(s=>s.observed)):null;
        const findings=analyzeTeamDynamics({plan:system.gameplan,coach:system.coach.profile,igl,entry,support,lurker,rotators,roster:starterProfiles});
        const estimated=starterProfiles.filter(s=>s.estimated).map(s=>s.name);
        // Server identity uses the stored DNA; client derivation is a fallback for unprepared profiles.
        const iglReport=igl?scouting.find(r=>r.player_id===igl.id):undefined;
        const leadership=iglReport?.igl_identity??(igl?describeIglLeadershipIdentity(igl.tendencies):undefined);
        // Scouting only returns observed behavior after its own sample threshold; the team view has a second threshold.
        const observedTeam=computeObservedTeamTendencies(starterProfiles.map(s=>s.observed));
        return <details><summary>Team identity, leadership &amp; coaching diagnostics ({findings.length} insights)</summary>
          {estimated.length>0&&<p role="note"><small>Estimated from natural identity (server values unavailable): {estimated.join(', ')}. Prepare profiles for development-aware diagnostics.</small></p>}
          <p><strong>Coach vision</strong> is your gameplan and coach. <strong>IGL leadership identity</strong>{leadership?<>: {leadership.label}. {leadership.summary}{leadership.potentialWeakness?<> <em>Watch: {leadership.potentialWeakness}</em></>:null}</>:': assign a T or CT IGL to compare leadership style.'} <strong>Observed team identity</strong> comes only from recorded match behavior.</p>
          {teamId&&<div className="cm-table-wrap"><table className="cm-table"><thead><tr><th>Dimension</th><th>Coach vision</th><th>IGL leadership</th><th>Observed team</th></tr></thead><tbody>{teamId.dimensions.map(d=><tr key={d.key}><th scope="row">{d.label}</th><td>{d.intended}</td><td>{d.leadership}</td><td>{d.observed!==null?d.observed:'Insufficient samples'}</td></tr>)}</tbody></table></div>}
          {observedTeam.sufficient?<div className="cm-table-wrap"><table className="cm-table"><caption>Observed team tendencies ({observedTeam.samples} verified player appearances)</caption><thead><tr><th>Category</th><th>Observed rate</th></tr></thead><tbody>{FPS_OBSERVED_TEAM_CATEGORIES.map(key=><tr key={key}><th scope="row">{FPS_OBSERVED_TEAM_CATEGORY_LABELS[key]}</th><td>{observedTeam[key]??'Insufficient samples'}</td></tr>)}</tbody></table></div>
            :<p><small>Observed team tendencies appear after {FPS_OBSERVED_TEAM_MIN_MATCHES} verified appearances with at least {FPS_OBSERVED_TEAM_MIN_OPPORTUNITIES} recorded opportunities per behavior.</small></p>}
          {findings.length>0?<><h4>Coaching diagnostics</h4><ul>{findings.map(f=><li key={f.id}><strong>[{f.severity.toUpperCase()}] {f.title}:</strong> {f.observation} <em>{f.action}</em></li>)}</ul></>:<p><small>No role-pair or leadership conflicts detected for the current assignments.</small></p>}
        </details>;
      })()}
      <div className="cm-table-wrap"><table className="cm-table"><thead><tr><th>Player identity</th><th>Role and instructions</th><th>Training</th><th>Contextual fit</th></tr></thead><tbody>{players.map(player=>{
        const report=scouting.find(r=>r.player_id===player.id),orders={...defaults,...system.instructions[player.id]};
        const strengths=FPS_ABILITIES.filter(key=>Number.isFinite(player.definition.stats?.[key])).sort((a,b)=>player.definition.stats![b]-player.definition.stats![a]).slice(0,3);
        return <tr key={player.id}><th scope="row" className="fps-system-player"><strong>{player.definition.name}</strong>{starterIds.includes(player.id)&&<small className="fps-system-player__tag">Starting five</small>}<FpsIdentityMarks profile={report} igl={orders.t==='T_IGL'||orders.ct==='CT_IGL'}/>{strengths.length>0&&<small>Strengths: {strengths.map(key=>`${FPS_ABILITY_LABELS[key]} ${toScale10(player.definition.stats![key])}/10`).join(' · ')}</small>}{report&&<small>Consistency: {consistencyText(report,player.id)}</small>}{report&&<small>{report.confidence} ({report.appearances??0} verified appearances)</small>}</th>
          <td>{(['t','ct'] as const).map(side=><label key={side}>{side.toUpperCase()} assignment<select disabled={busy} value={orders[side]??''} onChange={e=>edit(player.id,{[side]:e.target.value||undefined})}><option value="">Unassigned — manager selects</option>{(side==='t'?FPS_T_POSITIONS:FPS_CT_POSITIONS).map(position=><option key={position} value={position}>{FPS_POSITION_LABELS[position]}</option>)}</select></label>)}<label>Instruction<select disabled={busy} value={orders.instruction} onChange={e=>edit(player.id,{instruction:e.target.value as Orders['instruction']})}>{['balanced','hold','initiative','support'].map(value=><option key={value}>{value}</option>)}</select></label></td>
          <td><label>Training focus<select disabled={busy} value={orders.training} onChange={e=>edit(player.id,{training:e.target.value})}><option value="system">System familiarity</option>{FPS_ABILITIES.map(key=><option key={key} value={key}>{FPS_ABILITY_LABELS[key]}</option>)}</select><small>Half of each training step goes to an attribute focus.</small></label></td>
          <td>{report?<><p>Coach: {report.coach_fit??'unavailable'}<br/>Gameplan: {report.gameplan_fit??'unavailable'}<br/>Familiarity: {report.familiarity}<br/>Chemistry: {report.team_chemistry??'unestablished'}</p><details><summary>Scouting notes</summary><p>Risk tendency: {report.observations.risk}. Adaptability: {report.observations.adaptability}. Preparation: {report.observations.preparation}. Team orientation: {report.observations.team_orientation}.</p><p>Pressure response: {report.observations.pressure_response??'unestablished'}. Economy discipline: {report.observations.economy_discipline??'unestablished'}.</p><p>Role familiarity: {[...FPS_T_POSITIONS,...FPS_CT_POSITIONS].map(position=>{const value=report.role_familiarity?.[position]??0;return FPS_POSITION_LABELS[position]+': '+(value>.7?'familiar':value>.3?'learning':'new');}).join('; ')}.</p>{report.recent_observations?.map((note,i)=><p key={i}>{note}</p>)}</details></>:'Awaiting identity preparation'}</td></tr>;
      })}</tbody></table></div>
      <button className="cm-btn cm-btn-primary" disabled={busy}>{busy?'Saving...':'Save gameplan and orders'}</button>
      <button type="button" className="cm-btn" disabled={busy} onClick={()=>{setBusy(true);void request('/online/fps-identities/prepare',session,{method:'POST'}).then(()=>loadScouting()).catch(problem=>setError((problem as Error).message)).finally(()=>setBusy(false));}}>Prepare missing profiles</button>
      {error&&<p role="alert">{error} <button type="button" className="cm-btn" onClick={()=>void load().catch(problem=>setError((problem as Error).message))}>Reload saved plan</button></p>}{notice&&<p role="status">{notice}</p>}
    </form>
  </section>;
}
