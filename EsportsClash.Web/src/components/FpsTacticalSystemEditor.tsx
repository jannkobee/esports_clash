import {FPS_ABILITIES,FPS_ABILITY_LABELS} from '../fps/fpsSkillProfile';
import {useEffect,useState,type CSSProperties} from 'react';
import {ChevronsUp,Flame,Hand,HeartHandshake,LayoutGrid,PiggyBank,Scale,ShieldCheck,SlidersHorizontal,Sparkles,Undo2,type LucideIcon} from 'lucide-react';
import {TacticsBoard} from './game/TacticsBoard';
import {POSITIONS} from './game/positions';
import {WorldPlayerPortrait} from './WorldPlayerPortrait';
import {request,type ApiSession} from '../cloudPersistence';
import {FPS_T_POSITIONS,FPS_CT_POSITIONS,FPS_POSITION_LABELS,FPS_GAMEPLANS,deriveFpsTendencies,computeTeamIdentityComparison,analyzeTeamDynamics,computeObservedTeamTendencies,describeIglLeadershipIdentity,FPS_OBSERVED_TEAM_CATEGORIES,FPS_OBSERVED_TEAM_CATEGORY_LABELS,FPS_OBSERVED_TEAM_MIN_MATCHES,FPS_OBSERVED_TEAM_MIN_OPPORTUNITIES,generatePlayerDNA,type FpsGameplan,type FpsScoutingProfile} from '../fps/fpsIdentity';
import {FpsIdentityMarks} from './FpsIdentityMarks';
import {FPS_DIAGNOSTIC_TENDENCY_KEYS} from '../fps/fpsTendencyFormulas';
import {deriveFpsConsistency,fpsConsistencyRated} from '../fps/fpsConsistency';
import {fpsScale10,fpsLevelMidpoint,fpsRatedText} from '../fps/fpsScale10';
import './tactical-system.css';

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
const INSTRUCTIONS:[Orders['instruction'],string,LucideIcon][]=[['balanced','Balanced',Scale],['hold','Hold',Hand],['initiative','Take initiative',ChevronsUp],['support','Support',HeartHandshake]];
const PRESET_META:Record<string,{icon:LucideIcon;tagline:string}>={
  structured:{icon:LayoutGrid,tagline:'Set plays, prepared executes'},
  default:{icon:ShieldCheck,tagline:'Slow defaults, low risk'},
  pressure:{icon:Flame,tagline:'Fast and relentless'},
  reactive:{icon:Undo2,tagline:'Read first, then punish'},
  adaptive:{icon:Sparkles,tagline:'Freedom to improvise'},
  resources:{icon:PiggyBank,tagline:'Save, then buy big rounds'},
};
/** Server fit words to a chip tone: good, mixed or poor. */
const fitTone=(value?:string|null)=>{const v=(value??'').toLowerCase();return /friction|poor|weak|clash|low/.test(v)?'is-bad':/promis|good|strong|excellent|high|natural|ideal/.test(v)?'is-good':/mix|neutral|moderate|average/.test(v)?'is-mid':'is-none';};
/** A gameplan dial in words: which end it leans to, and how far. */
function leaning(value:number,low:string,high:string):string{
  if(value<=.15)return low;if(value<.4)return 'Leaning '+low.toLowerCase();if(value<=.6)return 'Balanced';if(value<.85)return 'Leaning '+high.toLowerCase();return high;
}
export function FpsTacticalSystemEditor({session,players,onSaved}:{session:ApiSession;players:{id:string;definition:{name:string;stats?:Record<string,number>}}[];onSaved?:()=>void}) {
  const [system,setSystem]=useState<System|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
  const [scouting,setScouting]=useState<FpsScoutingProfile[]>([]);
  const loadScouting=async(signal?:AbortSignal)=>{const response=await request<{data:FpsScoutingProfile[]}>('/online/fps-identities',session,{signal});setScouting(response.data);};
  const load=async(signal?:AbortSignal)=>{const response=await request<{data:System}>('/online/fps-system',session,{signal});setSystem(response.data);setError('');await loadScouting(signal);};
  useEffect(()=>{const controller=new AbortController();setSystem(null);setScouting([]);void load(controller.signal).catch(problem=>{if(!controller.signal.aborted)setError((problem as Error).message);});return()=>controller.abort();},[session.token]);
  if(!system)return <section className="tactics" id="team-roles" aria-busy={!error}><header className="tactics-head"><div><h3>Tactics</h3><p role={error?'alert':'status'}>{error||'Loading your gameplan and positions…'}</p></div></header>{error&&<button type="button" className="cm-btn" onClick={()=>{setError('');void load().catch(problem=>setError((problem as Error).message));}}>Try again</button>}</section>;
  const edit=(id:string,changes:Partial<Orders>)=>setSystem({...system,instructions:{...system.instructions,[id]:{...defaults,...system.instructions[id],...changes}}});
  const starterIds=system.starterIds??[],assigned=starterIds.filter(id=>system.instructions[id]?.t&&system.instructions[id]?.ct).length;
  // Starters first, in lineup order, so the five who need positions are at the top.
  const ordered=[...players].sort((a,b)=>{const ia=starterIds.indexOf(a.id),ib=starterIds.indexOf(b.id);return (ia<0?99:ia)-(ib<0?99:ib);});
  const starters=ordered.filter(p=>starterIds.includes(p.id));
  const boardPlayers=starters.map(p=>({id:p.id,name:p.definition.name,stats:p.definition.stats,appearance:(p.definition as {presentation?:{appearance?:import('../supporter').PlayerAppearance}|null}).presentation?.appearance}));
  const assignments=Object.fromEntries(starters.map(p=>[p.id,{t:system.instructions[p.id]?.t,ct:system.instructions[p.id]?.ct}]));
  /** Place a player on a position for one side; a taken position swaps the two players. */
  const placeOn=(side:'t'|'ct',position:import('./game/positions').Position,id:string|null)=>{
    const instructions={...system.instructions};
    const occupant=starters.find(p=>instructions[p.id]?.[side]===position)?.id;
    if(id===null){if(occupant)instructions[occupant]={...defaults,...instructions[occupant],[side]:undefined};}
    else{const previous=instructions[id]?.[side];instructions[id]={...defaults,...instructions[id],[side]:position};if(occupant&&occupant!==id)instructions[occupant]={...defaults,...instructions[occupant],[side]:previous};}
    setSystem({...system,instructions});setNotice('');
  };
  const suggest=()=>{const instructions={...system.instructions};for(const [id,roles] of Object.entries(system.recommendations))instructions[id]={...defaults,...instructions[id],...roles};setSystem({...system,instructions});setNotice('Positions filled from strengths. Change any you like, then save.');};
  const activePreset=Object.entries(FPS_GAMEPLANS).find(([,preset])=>dimensions.every(({key})=>Math.abs(preset.plan[key]-system.gameplan[key])<.001))?.[0];
  return <section className="tactics" id="team-roles">
    <header className="tactics-head">
      <div>
        <h3>Tactics</h3>
        <p>Coach <strong>{system.coach.name}</strong> · {system.active?'applies to new matches':'applies once identity matches activate'}</p>
      </div>
      <p className={'tactics-progress'+(assigned===5?' is-done':'')} aria-live="polite"><strong>{assigned} of 5</strong> starters fully placed</p>
    </header>
    <form onSubmit={async event=>{event.preventDefault();setBusy(true);setError('');setNotice('');try{
      const instructions=Object.fromEntries(Object.entries(system.instructions).filter(([id])=>players.some(p=>p.id===id)));
      const response=await request<{data:System}>('/online/fps-system',session,{method:'PUT',body:JSON.stringify({revision:system.revision,gameplan:system.gameplan,instructions})});
      setSystem(response.data);setNotice('Tactics saved.');onSaved?.();await loadScouting();
    }catch(problem){setError((problem as Error).message);}finally{setBusy(false);}}}>
      <div className="tactics-block tactics-block--board">
        <TacticsBoard players={boardPlayers} assignments={assignments} onAssign={placeOn} onSuggest={system.recommendations?suggest:undefined} busy={busy}/>
      </div>

      <div className="tactics-block">
        <div className="tactics-block__head"><div><h4>Gameplan</h4><p>Pick a philosophy, then fine-tune. Culture catches up over repeated matches.</p></div><span className={'tactics-plan-pill'+(activePreset?'':' is-custom')}><SlidersHorizontal size={13} aria-hidden="true"/>{activePreset?FPS_GAMEPLANS[activePreset].name:'Custom blend'}</span></div>
        <div className="tactics-presets" role="radiogroup" aria-label="Gameplan philosophy">{Object.entries(FPS_GAMEPLANS).map(([key,preset])=>{const meta=PRESET_META[key],Icon=meta?.icon??Sparkles;return <button key={key} type="button" role="radio" aria-checked={activePreset===key} disabled={busy} className={'tactics-preset-tile'+(activePreset===key?' is-active':'')} onClick={()=>setSystem({...system,gameplan:{...preset.plan}})}>
          <span className="tactics-preset-tile__icon"><Icon size={18} aria-hidden="true"/></span><strong>{preset.name}</strong><small>{meta?.tagline}</small>
          <span className="tactics-preset-tile__bars" aria-hidden="true">{dimensions.map(({key:k})=><i key={k} style={{height:`${Math.max(12,preset.plan[k]*100)}%`}}/>)}</span>
        </button>;})}
        </div>
        <div className="tactics-dials">{dimensions.map(({key,label,low,high})=>{const value=system.gameplan[key];return <div className="tactics-dial" key={key}>
          <div className="tactics-dial__top"><span className="tactics-dial__label">{label}</span><span className="tactics-dial__value">{leaning(value,low,high)}</span></div>
          <input type="range" min="0" max="1" step="0.05" value={value} disabled={busy} style={{'--range-fill':`${value*100}%`} as CSSProperties} aria-label={`${label}, from ${low} to ${high}`} aria-valuetext={leaning(value,low,high)} onChange={event=>setSystem({...system,gameplan:{...system.gameplan,[key]:Number(event.target.value)}})}/>
          <div className="tactics-dial__ends"><span>{low}</span><span>{high}</span></div>
          <small title="How far the team has absorbed this so far">Culture {Math.round(system.culture[key]*100)}%</small>
        </div>;})}</div>
      </div>

      <div className="tactics-block">
        <div className="tactics-block__head"><div><h4>Player orders</h4><p>Instruction for the match, and where each player's training goes.</p></div></div>
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
        return <details className="tactics-diagnostics"><summary>Coaching diagnostics <span className="tactics-count">{findings.length} {findings.length===1?'insight':'insights'}</span>{findings.slice(0,3).map(f=><span key={f.id} className={'tactics-dot is-'+f.severity} title={f.title}/>)}</summary>
          {estimated.length>0&&<p role="note"><small>Estimated from natural identity (server values unavailable): {estimated.join(', ')}. Prepare profiles for development-aware diagnostics.</small></p>}
          <p><strong>Coach vision</strong> is your gameplan and coach. <strong>IGL leadership identity</strong>{leadership?<>: {leadership.label}. {leadership.summary}{leadership.potentialWeakness?<> <em>Watch: {leadership.potentialWeakness}</em></>:null}</>:': assign a T or CT IGL to compare leadership style.'} <strong>Observed team identity</strong> comes only from recorded match behavior.</p>
          {teamId&&<div className="cm-table-wrap"><table className="cm-table"><thead><tr><th>Dimension</th><th>Coach vision</th><th>IGL leadership</th><th>Observed team</th></tr></thead><tbody>{teamId.dimensions.map(d=><tr key={d.key}><th scope="row" className="cm-row-head">{d.label}</th><td>{d.intended}</td><td>{d.leadership}</td><td>{d.observed!==null?d.observed:'Insufficient samples'}</td></tr>)}</tbody></table></div>}
          {observedTeam.sufficient?<div className="cm-table-wrap"><table className="cm-table"><caption>Observed team tendencies ({observedTeam.samples} verified player appearances)</caption><thead><tr><th>Category</th><th>Observed rate</th></tr></thead><tbody>{FPS_OBSERVED_TEAM_CATEGORIES.map(key=><tr key={key}><th scope="row" className="cm-row-head">{FPS_OBSERVED_TEAM_CATEGORY_LABELS[key]}</th><td>{observedTeam[key]??'Insufficient samples'}</td></tr>)}</tbody></table></div>
            :<p><small>Observed team tendencies appear after {FPS_OBSERVED_TEAM_MIN_MATCHES} verified appearances with at least {FPS_OBSERVED_TEAM_MIN_OPPORTUNITIES} recorded opportunities per behavior.</small></p>}
          {findings.length>0?<><h5>What the staff see</h5><ul className="tactics-findings">{findings.map(f=><li key={f.id} className={'is-'+f.severity}><span className="tactics-finding__severity">{f.severity}</span><div><strong>{f.title}.</strong> {f.observation} <em>{f.action}</em></div></li>)}</ul></>:<p><small>No role-pair or leadership conflicts detected for the current assignments.</small></p>}
        </details>;
      })()}
        <div className="tactics-orders">{ordered.map(player=>{
          const report=scouting.find(r=>r.player_id===player.id),orders={...defaults,...system.instructions[player.id]};
          const starter=starterIds.includes(player.id);
          const appearance=(player.definition as {presentation?:{appearance?:import('../supporter').PlayerAppearance}|null}).presentation?.appearance;
          return <article key={player.id} className={'tactics-order'+(starter?' is-starter':'')} aria-label={player.definition.name}>
            <div className="tactics-order__who">
              <WorldPlayerPortrait id={player.id} name={player.definition.name} appearance={appearance} size={36}/>
              <div><strong>{player.definition.name}</strong>
                <span className="tactics-order__chips">{starter?(['t','ct'] as const).map(side=>{const p=orders[side];if(!p)return <span key={side} className={'position-chip is-'+side+' is-empty'}>{side.toUpperCase()} —</span>;const meta=POSITIONS[p],Icon=meta.icon;return <span key={side} className={'position-chip is-'+side}><Icon size={11} aria-hidden="true"/>{meta.short}</span>;}):<span className="tactics-order__bench">Bench</span>}</span></div>
            </div>
            <div className="tactics-order__instruction" role="radiogroup" aria-label={`Instruction for ${player.definition.name}`}>{INSTRUCTIONS.map(([value,label,Icon])=><button key={value} type="button" role="radio" aria-checked={orders.instruction===value} disabled={busy} title={label} onClick={()=>edit(player.id,{instruction:value})}><Icon size={14} aria-hidden="true"/><span>{label}</span></button>)}</div>
            <label className="tactics-field tactics-order__training"><span className="sr-only">Training focus for {player.definition.name}</span><select className="cm-select" aria-label="Training focus" disabled={busy} value={orders.training} onChange={e=>edit(player.id,{training:e.target.value})}><option value="system">Train: System familiarity</option>{FPS_ABILITIES.map(key=><option key={key} value={key}>Train: {FPS_ABILITY_LABELS[key]}</option>)}</select></label>
            <div className="tactics-order__fit">{report?<>
              {([['Coach',report.coach_fit],['Plan',report.gameplan_fit],['Chem',report.team_chemistry]] as const).map(([label,value])=><span key={label} className={'fit-chip '+fitTone(value)} title={`${label}: ${value??'unestablished'}`}>{label}</span>)}
              <details><summary>Notes</summary><div className="tactics-order__notes"><p>Consistency {consistencyText(report,player.id)} · {report.confidence} ({report.appearances??0} verified appearances) · Familiarity {report.familiarity}.</p><p>Risk tendency: {report.observations.risk}. Adaptability: {report.observations.adaptability}. Preparation: {report.observations.preparation}. Team orientation: {report.observations.team_orientation}.</p><p>Pressure response: {report.observations.pressure_response??'unestablished'}. Economy discipline: {report.observations.economy_discipline??'unestablished'}.</p><p>Role familiarity: {[...FPS_T_POSITIONS,...FPS_CT_POSITIONS].map(position=>{const value=report.role_familiarity?.[position]??0;return FPS_POSITION_LABELS[position]+': '+(value>.7?'familiar':value>.3?'learning':'new');}).join('; ')}.</p>{report.recent_observations?.map((note,i)=><p key={i}>{note}</p>)}<FpsIdentityMarks profile={report} igl={orders.t==='T_IGL'||orders.ct==='CT_IGL'} compact/></div></details>
            </>:<span className="tactics-muted">Awaiting scouting</span>}</div>
          </article>;
        })}</div>
      </div>
      <div className="tactics-actions">
        <button className="cm-btn cm-btn-primary" disabled={busy}>{busy?'Saving…':'Save tactics'}</button>
        <button type="button" className="cm-btn cm-btn-ghost" disabled={busy} onClick={()=>{setBusy(true);void request('/online/fps-identities/prepare',session,{method:'POST'}).then(()=>loadScouting()).catch(problem=>setError((problem as Error).message)).finally(()=>setBusy(false));}}>Prepare missing profiles</button>
        {notice&&<p role="status" className="tactics-notice">{notice}</p>}
      </div>
      {error&&<p role="alert" className="club-notice tactics-error">{error} <button type="button" className="cm-btn cm-btn-sm" onClick={()=>void load().catch(problem=>setError((problem as Error).message))}>Reload saved plan</button></p>}
    </form>
  </section>;
}
