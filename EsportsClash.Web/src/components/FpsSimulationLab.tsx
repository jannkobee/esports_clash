import {useEffect,useMemo,useRef,useState} from 'react';
import {Download,Play,RotateCcw} from 'lucide-react';
import {createEqualizedRoster} from '../equalizedMode';
import {useAccount} from '../AccountContext';
import {request,isCloudPersistenceConfigured} from '../cloudPersistence';
import {simulateFpsMatch} from '../fps/fpsSimulationEngine';
import {FPS_MAPS} from '../fps/maps';
import type {FpsMapId,FpsMatchReport,FpsIdentityExperiment} from '../fps/types';
import {FPS_IDENTITY_PERSONALITIES,FPS_SPECIALTIES,generatePlayerDNA,type FpsCoach,type FpsGameplan} from '../fps/fpsIdentity';
import {FpsMatchView} from './FpsMatchView';
import {FpsLiveBroadcast} from './FpsLiveBroadcast';
import {LIVE_DEMO_ATTRIBUTES} from '../fps/fpsLiveAttributes';
import type {PlayerCard,PlayerAttributes} from '../types';
import {FpsSkillEditor,useFpsLabProfiles} from './FpsSkillEditor';
import type {FpsSkillProfile} from '../fps/fpsSkillProfile';
import './fps-reference.css';

const tacticalSystems: Record<string, {coach:FpsCoach;plan:FpsGameplan}> = {
  structured:{coach:{tempo:.3,rigidity:.8,aggression:.3,preparation:.9,freedom:.25,economy:.7,communication:.7,leadership:.8,adaptability:.5,development:.7},plan:{tempo:.3,structure:.85,aggression:.3,preparation:.9,freedom:.2,economy:.7}},
  pressure:{coach:{tempo:.85,rigidity:.4,aggression:.85,preparation:.4,freedom:.7,economy:.4,communication:.7,leadership:.5,adaptability:.7,development:.6},plan:{tempo:.85,structure:.4,aggression:.85,preparation:.4,freedom:.7,economy:.4}},
};

export function FpsSimulationLab() {
  const {session}=useAccount();
  const [savedPlan,setSavedPlan]=useState<FpsGameplan|null>(null);
  useEffect(()=>{if(!session||!isCloudPersistenceConfigured()){setSavedPlan(null);return;} let active=true;request<{data:{gameplan:FpsGameplan}}>('/online/fps-system',session).then(response=>{if(active)setSavedPlan(response.data.gameplan);}).catch(()=>{if(active)setSavedPlan(null);});return()=>{active=false;};},[session?.token]);
  const [map,setMap]=useState<FpsMapId>('breakwater'),[seed,setSeed]=useState(()=>String(1+crypto.getRandomValues(new Uint32Array(1))[0]%2147483646));
  const [experimental,setExperimental]=useState(true),[blueSystem,setBlueSystem]=useState('structured'),[redSystem,setRedSystem]=useState('pressure');
  const blueRoster=useMemo(()=>createEqualizedRoster('blue'),[]),redRoster=useMemo(()=>createEqualizedRoster('red'),[]);
  const roster=[...blueRoster,...redRoster];
  const [skillProfiles,setSkillProfiles]=useFpsLabProfiles(roster);
  const [detailedSkills,setDetailedSkills]=useState(true);
  const [attributeMode,setAttributeMode]=useState<'varied'|'equalized'>('varied');
  const [attributeEdits,setAttributeEdits]=useState<Record<string,PlayerAttributes>>({});
  const attributesFor=(card:PlayerCard,index:number):PlayerAttributes=>attributeMode==='equalized'
    ?{lan:100,tf:100,iq:100,clu:100,sta:100,flx:100,ldr:100}
    :attributeEdits[card.id]??LIVE_DEMO_ATTRIBUTES[(index+(index>=5?2:0))%5];
  const supportedSpecialties=FPS_SPECIALTIES;
  const [identities,setIdentities]=useState<Record<string,{personality:string;specialty:string}>>(()=>Object.fromEntries([...blueRoster,...redRoster].map((card,index)=>[card.id,{personality:FPS_IDENTITY_PERSONALITIES[index % FPS_IDENTITY_PERSONALITIES.length].id,specialty:''}])));
  const [report,setReport]=useState<FpsMatchReport|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [live,setLive]=useState<{seed:number;identity:FpsIdentityExperiment;blue:PlayerCard[];red:PlayerCard[];skillProfiles?:Record<string,FpsSkillProfile>}|null>(null);
  const timer=useRef<number|undefined>(undefined);
  useEffect(()=>()=>window.clearTimeout(timer.current),[]);
  const launch=(mode:'live'|'recorded'='recorded')=>{
    const value=mode==='live'?1:Number(seed);
    if(!Number.isInteger(value)||value<1||value>2147483647){setError('Use a whole-number seed from 1 to 2147483647.');return;}
    setBusy(true);setError('');
    timer.current=window.setTimeout(()=>{
      try{
        const blue=mode==='live'?blueRoster.map((card,index)=>({...card,stats:{...attributesFor(card,index)}})):blueRoster;
        const red=mode==='live'?redRoster.map((card,index)=>({...card,stats:{...attributesFor(card,index+5)}})):redRoster;
        const team=(system: string)=>({...((system==='saved'&&savedPlan)?{coach:tacticalSystems.structured.coach,plan:savedPlan}:(tacticalSystems[system]??tacticalSystems.structured)),chemistry:{trust:.5,communication:.5,understanding:.5,leadershipAcceptance:.5,roleCompetition:.5}});
        const players=Object.fromEntries([...blue,...red].map(card=>[card.id,{id:card.id,personality:FPS_IDENTITY_PERSONALITIES.find(item=>item.id===identities[card.id].personality)!,specialty:supportedSpecialties.find(item=>item.id===identities[card.id].specialty),intensity:.4+generatePlayerDNA(card.id).competitiveDrive/200,dna:generatePlayerDNA(card.id),roleSuitability:.5,familiarity:.5}]));
        const identityExperiment: FpsIdentityExperiment={players,teams:{blue:team(blueSystem),red:team(redSystem)}};
        if(mode==='live'){
          const profiles=detailedSkills?Object.fromEntries(roster.map(card=>{
            const p=skillProfiles[card.id];return [card.id,attributeMode==='equalized'?{...p,source:'lab-custom-v1' as const,values:Object.fromEntries(Object.keys(p.values).map(key=>[key,10])) as FpsSkillProfile['values']}:{...p,values:{...p.values}}];
          })):undefined;
          setLive({seed:value,identity:identityExperiment,blue,red,skillProfiles:profiles});
        }
        else setReport(simulateFpsMatch(blue,red,map,value,experimental?{identityExperiment}:{}));
      }
      catch(problem){setError(problem instanceof Error?problem.message:'The simulation could not start.');}
      finally{setBusy(false);}
    },30);
  };
  const download=()=>{
    if(!report)return;
    const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download=`fps-${report.mapId}-${report.seed}.json`;link.click();URL.revokeObjectURL(url);
  };
  if(live)return <FpsLiveBroadcast blue={live.blue} red={live.red} seed={live.seed} identity={live.identity} skillProfiles={live.skillProfiles} onExit={()=>setLive(null)}/>;
  return <section className="fps-lab" aria-label="FPS simulation viewer">
    {!report&&<section className="fps-lab__live-entry" aria-label="Live 3D exhibition">
      <p className="pedia-eyebrow">HEXATRICK · REAL-TIME 3D</p>
      <h1>Take your seat in the broadcast</h1>
      <p>Watch ten AI players contest Breakwater Yard at normal speed. Follow a player in first or third person, or let the automatic director choose the view.</p>
      <div className="fps-lab__mode"><button type="button" className="cm-btn cm-btn-primary" disabled={busy} onClick={()=>launch('live')}><Play size={16}/>Watch live 3D match</button><span>15-second buy phase · 115-second rounds · 40-second device timer</span></div>
      <p>Every live launch or restart uses a fresh seed with the systems and player identities selected below. The seed control below applies to recorded comparisons. This early exhibition has collision markers for players and does not change official results or careers. Its map is Breakwater Yard; the map selector below applies to recorded tactical matches.</p>
      <label className="fps-lab__attribute-mode">Live player attributes <select value={attributeMode} onChange={e=>setAttributeMode(e.target.value as 'varied'|'equalized')}><option value="varied">Varied demonstration profiles</option><option value="equalized">Equal attributes for identity comparison</option></select></label>
      <label className="fps-lab__attribute-mode">Ability model<select value={detailedSkills?'detailed':'legacy'} onChange={e=>setDetailedSkills(e.target.value==='detailed')}><option value="detailed">Detailed FPS profile · local trial</option><option value="legacy">Legacy seven attributes · comparison</option></select></label>
      {detailedSkills?<FpsSkillEditor roster={roster} profiles={skillProfiles} onChange={setSkillProfiles} equalized={attributeMode==='equalized'}/>:<details><summary>Legacy attributes and live decisions</summary><p>These are fictional exhibition profiles. This comparison uses the previous seven-attribute bridge.</p>
        <div className="fps-lab__attributes"><table><thead><tr><th>Player</th>{['Aim','Game sense','Teamwork','Clutch','Stamina','Flexibility','Leadership'].map(name=><th key={name}>{name} /20</th>)}</tr></thead><tbody>{roster.map((card,index)=><tr key={card.id}><th>{index<5?'Blue':'Red'} · {card.name}</th>{(['lan','iq','tf','clu','sta','flx','ldr'] as const).map(key=><td key={key}><input type="number" min="1" max="20" step="1" aria-label={`${card.name} ${key}`} disabled={attributeMode==='equalized'} value={Math.round((attributesFor(card,index)[key]??50)/5)} onChange={e=>{const value=Number(e.target.value);if(!Number.isFinite(value)||value<1||value>20)return;setAttributeEdits(previous=>({...previous,[card.id]:{...attributesFor(card,index),[key]:value*5}}));}}/></td>)}</tr>)}</tbody></table></div>
      </details>}
      <details><summary>What is included in this early build?</summary><p>Three lanes with Mid splits, counter-strafing, quiet walking, angle clearing and jiggle peeks, coordinated utility and entry timing, shared buy/eco decisions and weapon handoffs. Flashes and smokes have flight time and bounce against the map. The broadcast shows each team's buy and current attack phase. Long-Lane Guardian, Flash-Window Finisher and Instant Refragger have live shot effects; the other specialties still need spatial integration. Finished player models, weapon animations, audible sound effects and shared online broadcasting are still to come.</p></details>
    </section>}
    <header><p className="pedia-eyebrow">WATCH THE CURRENT MATCH SIMULATION</p><h2>Match setup and tactical recordings</h2><p>Choose a map and watch two fictional teams play a complete MR15 match. The same seed and inputs reproduce the same match.</p><p>These local matches do not change club funds, standings or player careers.</p></header>
    {!report?<><div className="fps-lab__controls"><label>Competitive map<select aria-label="Simulation map" value={map} disabled={busy} onChange={e=>setMap(e.target.value as FpsMapId)}>{Object.values(FPS_MAPS).map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Match seed<input aria-label="Simulation seed" inputMode="numeric" type="number" min={1} max={2147483647} value={seed} disabled={busy} onChange={e=>setSeed(e.target.value)}/></label><button type="button" className="cm-btn cm-btn-primary" disabled={busy} onClick={()=>launch('recorded')}><Play size={16}/>{busy?'Preparing match…':'Run & watch simulation'}</button><button type="button" className="cm-btn" disabled={busy} onClick={()=>setSeed(String(1+crypto.getRandomValues(new Uint32Array(1))[0]%2147483646))}><RotateCcw size={14}/>New seed</button></div>{error&&<p role="alert">{error}</p>}{busy&&<p role="status">Preparing the recorded rounds…</p>}<label><input type="checkbox" checked={experimental} onChange={e=>setExperimental(e.target.checked)}/> Use current identity rules</label>{experimental&&<div className="fps-lab__controls"><label>Blue system<select value={blueSystem} onChange={e=>setBlueSystem(e.target.value)}><option value="structured">Structured execution</option><option value="pressure">High-tempo pressure</option>{savedPlan&&<option value="saved">Your saved gameplan</option>}</select></label><label>Red system<select value={redSystem} onChange={e=>setRedSystem(e.target.value)}><option value="structured">Structured execution</option><option value="pressure">High-tempo pressure</option>{savedPlan&&<option value="saved">Your saved gameplan</option>}</select></label><p>Saved gameplans use the structured coach in this exhibition. These selections apply only to this exhibition. Team calls and contact decisions use identities; the available specialties apply only in their qualifying engagements.</p><details><summary>Set exhibition player identities</summary>{roster.map((card,index)=><div key={card.id}><strong>{index<5?'Blue':'Red'} ? {card.name}</strong> <label>Personality <select value={identities[card.id].personality} onChange={e=>setIdentities(previous=>({...previous,[card.id]:{...previous[card.id],personality:e.target.value}}))}>{FPS_IDENTITY_PERSONALITIES.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label> <label>Specialty <select value={identities[card.id].specialty} onChange={e=>setIdentities(previous=>({...previous,[card.id]:{...previous[card.id],specialty:e.target.value}}))}><option value="">None</option>{supportedSpecialties.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div>)}</details></div>}<p>Playback starts automatically. Use pause, the round selector, event scrubber or speeds up to 16× to inspect what happened.</p></>
    :<><div className="fps-lab__report-actions"><button className="cm-btn" onClick={()=>setReport(null)}>Set up another match</button><button className="cm-btn" onClick={download}><Download size={14}/>Download match report</button></div><FpsMatchView key={`${report.mapId}-${report.seed}`} report={report} blueTeamName="Blue Five" redTeamName="Red Five" onExit={()=>setReport(null)} autoPlay/></>}
    <nav className="fps-lab__report-actions" aria-label="Simulation help"><a className="cm-btn" href="#hexapedia/fps">FPS reference</a><a className="cm-btn" href="#hexapedia/roles">Player roles</a><a className="cm-btn" href="#hexapedia/personalities">Personality guide</a><a className="cm-btn" href="#settings">Back to settings</a></nav>
  </section>;
}
