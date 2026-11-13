import {useEffect,useMemo,useRef,useState} from 'react';
import {Download,Play,RotateCcw} from 'lucide-react';
import {createEqualizedRoster} from '../equalizedMode';
import {useAccount} from '../AccountContext';
import {request,isCloudPersistenceConfigured} from '../cloudPersistence';
import {simulateFpsMatch} from '../fps/fpsSimulationEngine';
import {FPS_MAPS} from '../fps/fpsMaps';
import type {FpsMapId,FpsMatchReport,FpsIdentityExperiment} from '../fps/fpsTypes';
import {FPS_IDENTITY_PERSONALITIES,FPS_SPECIALTIES,generatePlayerDNA,type FpsCoach,type FpsGameplan} from '../fps/fpsIdentity';
import {FpsMatchView} from './FpsMatchView';
import {FpsLiveBroadcast} from './FpsLiveBroadcast';
import type {PlayerCard} from '../types';
import {FpsSkillEditor,useFpsLabProfiles} from './FpsSkillEditor';
import type {FpsSkillProfile} from '../fps/fpsSkillProfile';
import {readFpsLearning,resetFpsLearning} from '../fps/fpsLiveLearningStorage';
import {readFpsMechanicsLearning,resetFpsMechanicsLearning} from '../fps/fpsLiveMechanicsLearningStorage';
import {fetchApprovedLearning} from '../fps/fpsApprovedLearning';
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
  const [profileMode,setProfileMode]=useState<'varied'|'equalized'>('varied');
  const [learningEnabled,setLearningEnabled]=useState(false);
  const [learnedModel,setLearnedModel]=useState(()=>readFpsLearning());
  const [learnedMechanicsModel,setLearnedMechanicsModel]=useState(()=>readFpsMechanicsLearning());
  const supportedSpecialties=FPS_SPECIALTIES;
  const [identities,setIdentities]=useState<Record<string,{personality:string;specialty:string}>>(()=>Object.fromEntries([...blueRoster,...redRoster].map((card,index)=>[card.id,{personality:FPS_IDENTITY_PERSONALITIES[index % FPS_IDENTITY_PERSONALITIES.length].id,specialty:''}])));
  const [report,setReport]=useState<FpsMatchReport|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [live,setLive]=useState<{seed:number;identity:FpsIdentityExperiment;blue:PlayerCard[];red:PlayerCard[];skillProfiles?:Record<string,FpsSkillProfile>;learningEnabled:boolean;approvedModel?:Awaited<ReturnType<typeof fetchApprovedLearning>>}|null>(null);
  const timer=useRef<number|undefined>(undefined);
  useEffect(()=>()=>window.clearTimeout(timer.current),[]);
  const launch=(mode:'live'|'recorded'='recorded')=>{
    const value=mode==='live'?1:Number(seed);
    if(!Number.isInteger(value)||value<1||value>2147483647){setError('Use a whole-number seed from 1 to 2147483647.');return;}
    setBusy(true);setError('');
    timer.current=window.setTimeout(async ()=>{
      try{
        const blue=blueRoster;
        const red=redRoster;
        const team=(system: string)=>({...((system==='saved'&&savedPlan)?{coach:tacticalSystems.structured.coach,plan:savedPlan}:(tacticalSystems[system]??tacticalSystems.structured)),chemistry:{trust:.5,communication:.5,understanding:.5,leadershipAcceptance:.5,roleCompetition:.5}});
        const players=Object.fromEntries([...blue,...red].map(card=>[card.id,{id:card.id,personality:FPS_IDENTITY_PERSONALITIES.find(item=>item.id===identities[card.id].personality)!,specialty:supportedSpecialties.find(item=>item.id===identities[card.id].specialty),intensity:.4+generatePlayerDNA(card.id).competitiveDrive/200,dna:generatePlayerDNA(card.id),roleSuitability:.5,familiarity:.5}]));
        const identityExperiment: FpsIdentityExperiment={players,teams:{blue:team(blueSystem),red:team(redSystem)}};
        if(mode==='live'){
          const profiles=Object.fromEntries(roster.map(card=>{
            const p=skillProfiles[card.id];return [card.id,profileMode==='equalized'?{...p,source:'lab-custom-v1' as const,values:Object.fromEntries(Object.keys(p.values).map(key=>[key,10])) as FpsSkillProfile['values']}:{...p,values:{...p.values}}];
          }));
          setLive({seed:value,identity:identityExperiment,blue,red,skillProfiles:profiles,learningEnabled,approvedModel:learningEnabled?undefined:await fetchApprovedLearning()});
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
  if(live)return <FpsLiveBroadcast blue={live.blue} red={live.red} seed={live.seed} identity={live.identity} skillProfiles={live.skillProfiles} learningEnabled={live.learningEnabled} approvedModel={live.approvedModel} onExit={()=>{setLearnedModel(readFpsLearning());setLearnedMechanicsModel(readFpsMechanicsLearning());setLive(null);}}/>;
  return <section className="fps-lab" aria-label="FPS simulation viewer">
    {!report&&<section className="fps-lab__live-entry" aria-label="Live 3D exhibition">
      <p className="pedia-eyebrow">HEXATRICK · REAL-TIME 3D</p>
      <h1>Take your seat in the broadcast</h1>
      <p>Watch ten AI players contest Breakwater Yard at normal speed. Follow a player in first or third person, or let the automatic director choose the view.</p>
      <div className="fps-lab__mode"><button type="button" className="cm-btn cm-btn-primary" disabled={busy} onClick={()=>launch('live')}><Play size={16}/>Watch live 3D match</button><span>15-second buy phase · 115-second rounds · 40-second device timer</span></div>
      <p>Each launch uses a fresh seed with the systems and player identities selected below. This local exhibition uses fictional test profiles and does not change official results, club cards, or careers.</p>
      <details className="fps-lab__learning"><summary>Local bot learning reports</summary>
        <label><input type="checkbox" checked={learningEnabled} onChange={event=>setLearningEnabled(event.target.checked)}/> Experiment with browser-local learning (default uses approved frozen models)</label>
        <section aria-label="Movement route learning report"><h3>Movement routes</h3>
          <p>Bots compare legal approaches using route progress, health changes and round results. These route reports and weights use their own local checkpoint.</p>
          <p role="status">{learnedModel?.rounds??0} completed rounds · {learnedModel?.updates??0} route updates</p>
          <button type="button" className="cm-btn" disabled={!learnedModel} onClick={()=>{resetFpsLearning();setLearnedModel(undefined);}}>Reset route learning</button>
        </section>
        <section aria-label="Combat mechanics learning report"><h3>Combat mechanics</h3>
          <p>Rifle users learn when to choose a two-shot burst or sustained spray from range, movement and magazine state. Reports and weights are stored separately from route learning; damage, accuracy and weapon limits stay fixed.</p>
          <p role="status">{learnedMechanicsModel?.rounds??0} completed rounds · {learnedMechanicsModel?.updates??0} cadence updates</p>
          <button type="button" className="cm-btn" disabled={!learnedMechanicsModel} onClick={()=>{resetFpsMechanicsLearning();setLearnedMechanicsModel(undefined);}}>Reset combat learning</button>
        </section>
      </details>
      <div className="fps-lab__profile-panel">
        <div className="fps-lab__profile-heading"><div><h2>Live ability profiles</h2><p>Choose varied profiles or equalize abilities to compare team identity.</p></div><label>Profile set<select value={profileMode} onChange={e=>setProfileMode(e.target.value as 'varied'|'equalized')}><option value="varied">Varied demonstration profiles</option><option value="equalized">Equal abilities · identity comparison</option></select></label></div>
        <FpsSkillEditor roster={roster} profiles={skillProfiles} onChange={setSkillProfiles} equalized={profileMode==='equalized'}/>
      </div>
      <details><summary>What is included in this early build?</summary><p>Three lanes with Mid splits, counter-strafing, quiet walking, angle clearing and jiggle peeks, coordinated utility and entry timing, shared buy/eco decisions and weapon handoffs. Flashes and smokes have flight time and bounce against the map. The broadcast shows each team's buy and current attack phase. Long-Lane Guardian, Flash-Window Finisher and Instant Refragger have live shot effects; the other specialties still need spatial integration. The local exhibition includes generated directional gunfire and footstep audio, knee-bent crouches and timed grenade throws. These remain proxy characters and locally synthesized sounds; shared online broadcasting is still to come.</p></details>
    </section>}
    <header className="fps-lab__recorded-header"><p className="pedia-eyebrow">WATCH THE CURRENT MATCH SIMULATION</p><h2>Recorded tactical match</h2><p>Choose a map and seed to replay the same match. Local recordings do not change club funds, standings or careers.</p></header>
    {!report?<><div className="fps-lab__controls"><label>Competitive map<select aria-label="Simulation map" value={map} disabled={busy} onChange={e=>setMap(e.target.value as FpsMapId)}>{Object.values(FPS_MAPS).map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Match seed<input aria-label="Simulation seed" inputMode="numeric" type="number" min={1} max={2147483647} value={seed} disabled={busy} onChange={e=>setSeed(e.target.value)}/></label><button type="button" className="cm-btn cm-btn-primary" disabled={busy} onClick={()=>launch('recorded')}><Play size={16}/>{busy?'Preparing match…':'Run match'}</button><button type="button" className="cm-btn" disabled={busy} onClick={()=>setSeed(String(1+crypto.getRandomValues(new Uint32Array(1))[0]%2147483646))}><RotateCcw size={14}/>New seed</button></div>{error&&<p role="alert">{error}</p>}{busy&&<p role="status">Preparing the recorded rounds…</p>}<label className="fps-lab__identity-toggle"><input type="checkbox" checked={experimental} onChange={e=>setExperimental(e.target.checked)}/> Use current identity rules</label>{experimental&&<div className="fps-lab__identity-panel"><div className="fps-lab__system-selects"><label>Blue system<select value={blueSystem} onChange={e=>setBlueSystem(e.target.value)}><option value="structured">Structured execution</option><option value="pressure">High-tempo pressure</option>{savedPlan&&<option value="saved">Your saved gameplan</option>}</select></label><label>Red system<select value={redSystem} onChange={e=>setRedSystem(e.target.value)}><option value="structured">Structured execution</option><option value="pressure">High-tempo pressure</option>{savedPlan&&<option value="saved">Your saved gameplan</option>}</select></label></div><p>Team calls and contact decisions use identities. Specialties apply in qualifying engagements.</p><details className="fps-lab__identity-details"><summary>Set exhibition player identities</summary><div className="fps-lab__identity-roster">{roster.map((card,index)=><div key={card.id}><strong>{index<5?'Blue':'Red'} · {card.name}</strong><label>Personality<select value={identities[card.id].personality} onChange={e=>setIdentities(previous=>({...previous,[card.id]:{...previous[card.id],personality:e.target.value}}))}>{FPS_IDENTITY_PERSONALITIES.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Specialty<select value={identities[card.id].specialty} onChange={e=>setIdentities(previous=>({...previous,[card.id]:{...previous[card.id],specialty:e.target.value}}))}><option value="">None</option>{supportedSpecialties.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div>)}</div></details></div>}<p className="fps-lab__playback-note">Playback starts automatically. Pause, select a round, scrub events, or change speed up to 16×.</p></>
    :<><div className="fps-lab__report-actions"><button className="cm-btn" onClick={()=>setReport(null)}>Set up another match</button><button className="cm-btn" onClick={download}><Download size={14}/>Download match report</button></div><FpsMatchView key={`${report.mapId}-${report.seed}`} report={report} blueTeamName="Blue Five" redTeamName="Red Five" onExit={()=>setReport(null)} autoPlay/></>}
    <nav className="fps-lab__report-actions" aria-label="Simulation help"><a className="cm-btn" href="#hexapedia/fps">FPS reference</a><a className="cm-btn" href="#hexapedia/roles">Player roles</a><a className="cm-btn" href="#hexapedia/personalities">Personality guide</a><a className="cm-btn" href="#settings">Back to settings</a></nav>
  </section>;
}
