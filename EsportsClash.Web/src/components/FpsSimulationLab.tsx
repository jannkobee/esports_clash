import {useEffect,useMemo,useRef,useState} from 'react';
import {Download,Play,RotateCcw} from 'lucide-react';
import {createEqualizedRoster} from '../equalizedMode';
import {useAccount} from '../AccountContext';
import {request,isCloudPersistenceConfigured} from '../cloudPersistence';
import {simulateFpsMatch} from '../fps/fpsSimulationEngine';
import {FPS_MAPS} from '../fps/fpsMaps';
import {listLiveMaps} from '../fps/fpsLiveMapRegistry';
import type {LiveMapId} from '../fps/fpsLiveMapTypes';
import type {FpsMapId,FpsMatchReport,FpsIdentityExperiment} from '../fps/fpsTypes';
import {FPS_IDENTITY_PERSONALITIES,FPS_T_POSITIONS,FPS_CT_POSITIONS,FPS_POSITION_LABELS,defaultFpsAssignments,FPS_PERSONALITY_DIMENSIONS,personalityLabel,validateFpsPersonality,generatePlayerDNA,deriveFpsTendencies,describeIglLeadershipIdentity,FPS_TENDENCY_CATALOG,type FpsAssignments,type FpsCoach,type FpsGameplan} from '../fps/fpsIdentity';
import {FpsMatchView} from './FpsMatchView';
import {FpsLiveBroadcast} from './FpsLiveBroadcast';
import type {PlayerCard} from '../types';
import {FpsSkillEditor,useFpsLabProfiles} from './FpsSkillEditor';
import type {FpsSkillProfile} from '../fps/fpsSkillProfile';
import {readFpsLearning,resetFpsLearning} from '../fps/fpsLiveLearningStorage';
import {readFpsMechanicsLearning,resetFpsMechanicsLearning} from '../fps/fpsLiveMechanicsLearningStorage';
import {readFpsUtilityBrain,resetFpsUtilityBrain} from '../fps/fpsUtilityBrainStorage';
import {readFpsMovementLearning,resetFpsMovementLearning} from '../fps/fpsLiveMovementLearningStorage';
import {hydrateFpsLearningStorage} from '../fps/fpsLearningCache';
import {fetchApprovedLearning,fetchTeamLearning} from '../fps/fpsApprovedLearning';
import './fps-reference.css';

const tacticalSystems: Record<string, {coach:FpsCoach;plan:FpsGameplan}> = {
  structured:{coach:{tempo:.3,rigidity:.8,aggression:.3,preparation:.9,freedom:.25,economy:.7,communication:.7,leadership:.8,adaptability:.5,development:.7},plan:{tempo:.3,structure:.85,aggression:.3,preparation:.9,freedom:.2,economy:.7}},
  pressure:{coach:{tempo:.85,rigidity:.4,aggression:.85,preparation:.4,freedom:.7,economy:.4,communication:.7,leadership:.5,adaptability:.7,development:.6},plan:{tempo:.85,structure:.4,aggression:.85,preparation:.4,freedom:.7,economy:.4}},
};

/** Experimental lab-only editor. Overrides live in this component's exhibition state and are never sent to club persistence. */
function LabTendencyEditor({derived,isIgl,overrides,onChange}:{derived:Record<string,number>;isIgl:boolean;overrides?:Record<string,number>;onChange:(next:Record<string,number>|undefined)=>void}) {
  const categories=[...(isIgl?FPS_TENDENCY_CATALOG.iglCategories.map(c=>({...c,group:'IGL'})):[]),...FPS_TENDENCY_CATALOG.individualCategories.map(c=>({...c,group:'Individual'}))];
  const [categoryId,setCategoryId]=useState(categories[0]?.id??'');
  const category=categories.find(c=>c.id===categoryId)??categories[0];
  const count=Object.keys(overrides??{}).length;
  return <details className="fps-lab__tendency-editor"><summary>Experimental tendency overrides (0–100){count?` · ${count} changed`:''}</summary>
    <p><small>Experimental lab testing only. Applies to this exhibition's 3D live and 2D recorded runs and is never saved to your club.</small></p>
    <label>Category<select value={category?.id} onChange={e=>setCategoryId(e.target.value)}>{categories.map(c=><option key={c.group+c.id} value={c.id}>{c.group} · {c.label}</option>)}</select></label>
    {category?.tendencies.map(t=><label key={t.key} title={`High: ${t.high}
Low: ${t.low}`}>{t.label}: {derived[t.key]}{overrides?.[t.key]!==undefined?' (override)':''}<input type="range" min={0} max={100} value={derived[t.key]} onChange={e=>onChange({...(overrides??{}),[t.key]:Number(e.target.value)})}/></label>)}
    {count>0&&<button type="button" className="cm-btn" onClick={()=>onChange(undefined)}>Reset overrides</button>}
  </details>;
}

export function FpsSimulationLab() {
  const {session}=useAccount();
  const [savedPlan,setSavedPlan]=useState<FpsGameplan|null>(null);
  useEffect(()=>{if(!session||!isCloudPersistenceConfigured()){setSavedPlan(null);return;} let active=true;request<{data:{gameplan:FpsGameplan}}>('/online/fps-system',session).then(response=>{if(active)setSavedPlan(response.data.gameplan);}).catch(()=>{if(active)setSavedPlan(null);});return()=>{active=false;};},[session?.token]);
  const [map,setMap]=useState<FpsMapId>('breakwater'),[liveMapId,setLiveMapId]=useState<LiveMapId>('fontessa'),[seed,setSeed]=useState(()=>String(1+crypto.getRandomValues(new Uint32Array(1))[0]%2147483646));
  const [blueSystem,setBlueSystem]=useState('structured'),[redSystem,setRedSystem]=useState('pressure');
  const blueRoster=useMemo(()=>createEqualizedRoster('blue'),[]),redRoster=useMemo(()=>createEqualizedRoster('red'),[]);
  const roster=[...blueRoster,...redRoster];
  const [skillProfiles,setSkillProfiles]=useFpsLabProfiles(roster);
  const [profileMode,setProfileMode]=useState<'varied'|'equalized'>('varied');
  // Learning is on by default: bots keep improving routes, combat, movement and utility in this browser.
  const [learningEnabled,setLearningEnabled]=useState(true);
  const [utilityBrain,setUtilityBrain]=useState(()=>readFpsUtilityBrain());
  const [learnedModel,setLearnedModel]=useState(()=>readFpsLearning());
  const [learnedMechanicsModel,setLearnedMechanicsModel]=useState(()=>readFpsMechanicsLearning());
  const [learnedMovementModel,setLearnedMovementModel]=useState(()=>readFpsMovementLearning());
  const [identities,setIdentities]=useState<Record<string,{personality:string;assignments:FpsAssignments;tendencyOverrides?:Record<string,number>}>>(()=>Object.fromEntries([...blueRoster,...redRoster].map((card,index)=>[card.id,{personality:FPS_IDENTITY_PERSONALITIES[index % FPS_IDENTITY_PERSONALITIES.length].id,assignments:defaultFpsAssignments((index<5?blueRoster:redRoster).map(p=>p.id))[card.id]}])));
  const [report,setReport]=useState<FpsMatchReport|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [live,setLive]=useState<{mapId:LiveMapId;seed:number;identity:FpsIdentityExperiment;blue:PlayerCard[];red:PlayerCard[];skillProfiles?:Record<string,FpsSkillProfile>;learningEnabled:boolean;approvedModel?:Awaited<ReturnType<typeof fetchApprovedLearning>>;teamModels?:{blue:Awaited<ReturnType<typeof fetchTeamLearning>>;red:Awaited<ReturnType<typeof fetchTeamLearning>>}}|null>(null);
  const timer=useRef<number|undefined>(undefined);
  // The IndexedDB cache loads asynchronously; refresh the reports once it has.
  useEffect(()=>{let active=true;void hydrateFpsLearningStorage().then(()=>{if(!active)return;setUtilityBrain(readFpsUtilityBrain());setLearnedModel(readFpsLearning());setLearnedMechanicsModel(readFpsMechanicsLearning());setLearnedMovementModel(readFpsMovementLearning());});return()=>{active=false;};},[]);
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
        const players=Object.fromEntries([...blue,...red].map(card=>[card.id,{id:card.id,assignments:{...identities[card.id].assignments},personality:FPS_IDENTITY_PERSONALITIES.find(item=>item.id===identities[card.id].personality)!,dna:generatePlayerDNA(card.id),roleSuitability:.5,familiarity:.5,...(identities[card.id].tendencyOverrides?{tendencyOverrides:{...identities[card.id].tendencyOverrides}}:{})}]));
        const identityExperiment: FpsIdentityExperiment={players,teams:{blue:team(blueSystem),red:team(redSystem)}};
        if(mode==='live'){
          const profiles=Object.fromEntries(roster.map(card=>{
            const p=skillProfiles[card.id];return [card.id,profileMode==='equalized'?{...p,source:'lab-custom-v2' as const,values:Object.fromEntries(Object.keys(p.values).map(key=>[key,10])) as FpsSkillProfile['values']}:{...p,values:{...p.values}}];
          }));
          const approvedModel=learningEnabled?undefined:await fetchApprovedLearning();
          // Frozen exhibitions field the two co-evolving worker lineages (each falls back to the approved bundle).
          const teamModels=learningEnabled?undefined:{blue:await fetchTeamLearning('worker:main',approvedModel),red:await fetchTeamLearning('worker:rival',approvedModel)};
          setLive({mapId:liveMapId,seed:value,identity:identityExperiment,blue,red,skillProfiles:profiles,learningEnabled,approvedModel,teamModels});
        }
        else setReport(simulateFpsMatch(blue,red,map,value,{identityExperiment}));
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
  if(live)return <FpsLiveBroadcast mapId={live.mapId} blue={live.blue} red={live.red} seed={live.seed} identity={live.identity} skillProfiles={live.skillProfiles} learningEnabled={live.learningEnabled} approvedModel={live.approvedModel} teamModels={live.teamModels} onExit={()=>{setUtilityBrain(readFpsUtilityBrain());setLearnedModel(readFpsLearning());setLearnedMechanicsModel(readFpsMechanicsLearning());setLearnedMovementModel(readFpsMovementLearning());setLive(null);}}/>;
  return <section className="fps-lab" aria-label="FPS simulation viewer">
    {!report&&<section className="fps-lab__live-entry" aria-label="Live 3D exhibition">
      <p className="pedia-eyebrow">HEXATRICK · REAL-TIME 3D</p>
      <h1>Take your seat in the broadcast</h1>
      <p>Watch ten AI players contest Fontessa or Spillway in real time at normal speed. Follow a player in first or third person, inspect the full-map overview, or let the automatic director choose the view.</p>
      <div className="fps-lab__mode"><label>Battlefield<select aria-label="3D exhibition map" value={liveMapId} disabled={busy} onChange={e=>setLiveMapId(e.target.value as LiveMapId)}>{listLiveMaps().map(item=><option key={item.id} value={item.id}>{item.broadcast.displayName} — {item.broadcast.subtitle}</option>)}</select></label><button type="button" className="cm-btn cm-btn-primary" disabled={busy} onClick={()=>launch('live')}><Play size={16}/>Watch live 3D match</button><span>15-second buy phase · 115-second rounds · 40-second device timer</span></div>
      <p>Each launch uses a fresh seed with the systems and player identities selected below. This local exhibition uses fictional test profiles and does not change official results, club cards, or careers.</p>
      <details className="fps-lab__learning"><summary>Local bot learning reports</summary>
        <label><input type="checkbox" checked={learningEnabled} onChange={event=>setLearningEnabled(event.target.checked)}/> Bots learn as they play (cached in this browser as a local experiment; server team lineages are never changed from here). Untick to use the approved frozen models.</label>
        <section aria-label="Movement route learning report"><h3>Movement routes</h3>
          <p>Bots compare legal approaches using route progress, health changes and round results. These route reports and weights use their own local checkpoint.</p>
          <p role="status">{learnedModel?.rounds??0} completed rounds · {learnedModel?.updates??0} route updates</p>
          <button type="button" className="cm-btn" disabled={!learnedModel} onClick={()=>{resetFpsLearning();setLearnedModel(undefined);}}>Start new route experiment (keep current)</button>
        </section>
        <section aria-label="Combat mechanics learning report"><h3>Combat mechanics</h3>
          <p>Rifle users learn when to choose a two-shot burst or sustained spray from range, movement and magazine state. Reports and weights are stored separately from route learning; damage, accuracy and weapon limits stay fixed.</p>
          <p role="status">{learnedMechanicsModel?.rounds??0} completed rounds · {learnedMechanicsModel?.updates??0} cadence updates</p>
          <button type="button" className="cm-btn" disabled={!learnedMechanicsModel} onClick={()=>{resetFpsMechanicsLearning();setLearnedMechanicsModel(undefined);}}>Start new combat experiment (keep current)</button>
        </section>
        <section aria-label="Utility brain report"><h3>Utility brain (smoke lineups)</h3>
          <p>Bots calculate each smoke from distance, height and the buildings in the way, then remember where it really landed. Corrections from the same spot become discovered lineups. Throws can miss; nothing is pre-solved.</p>
          <p role="status">{Object.keys(utilityBrain.entries).length} remembered throws · {utilityBrain.throws} throws scored · {utilityBrain.throws?Math.round(utilityBrain.successes/utilityBrain.throws*100):0}% landed on target</p>
          <button type="button" className="cm-btn" disabled={!utilityBrain.throws} onClick={()=>{resetFpsUtilityBrain();setUtilityBrain(readFpsUtilityBrain());}}>Start new utility experiment from the seed (keep current)</button>
        </section>
        <section aria-label="Movement choice learning report"><h3>Movement choices</h3>
          <p>The learner compares existing strafing and peek styles using damage, incoming damage, kills and round results. Player attributes still govern execution quality; movement learning does not increase their ratings or change physical limits.</p>
          <p role="status">{learnedMovementModel?.rounds??0} completed rounds · {learnedMovementModel?.updates??0} movement updates</p>
          <button type="button" className="cm-btn" disabled={!learnedMovementModel} onClick={()=>{resetFpsMovementLearning();setLearnedMovementModel(undefined);}}>Start new movement experiment (keep current)</button>
        </section>
      </details>
      <div className="fps-lab__profile-panel">
        <div className="fps-lab__profile-heading"><div><h2>Live ability profiles</h2><p>Choose varied profiles or equalize abilities to compare team identity.</p></div><label>Profile set<select value={profileMode} onChange={e=>setProfileMode(e.target.value as 'varied'|'equalized')}><option value="varied">Varied demonstration profiles</option><option value="equalized">Equal abilities · identity comparison</option></select></label></div>
        <FpsSkillEditor roster={roster} profiles={skillProfiles} onChange={setSkillProfiles} equalized={profileMode==='equalized'}/>
      </div>
      <details><summary>What is active in the current 3D engine?</summary><p><strong>Battlefields:</strong> Fontessa and 3-level asymmetric Spillway with crouch-vault drops and box boosts. <strong>Tactical AI:</strong> Dynamic Influence Maps, Team Blackboards, GOAP executes/retakes, Behavior Trees, lawful 3D perception with reaction/aim curves, sniper wall/smoke clearance checks, and reactive death-callout trading (<code>1 behind car/truck/tree — trade him!</code>). <strong>Arsenal &amp; Broadcast:</strong> Full 4-slot loadouts with automatic mid-fight pistol swaps, 18s raycast-blocking smokes, C4 defuse sound cues, release-only grenade trails, fixed 1.25s Auto Wide Director framing, PiP bomb cam, and prewarmed 1P/3P/Free cameras.</p></details>
    </section>}
    <header className="fps-lab__recorded-header"><p className="pedia-eyebrow">WATCH THE CURRENT MATCH SIMULATION</p><h2>Recorded tactical match</h2><p>Choose a map and seed to replay the same match. Local recordings do not change club funds, standings or careers.</p></header>
    {!report?<><div className="fps-lab__controls"><label>Competitive map<select aria-label="Simulation map" value={map} disabled={busy} onChange={e=>setMap(e.target.value as FpsMapId)}>{Object.values(FPS_MAPS).map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Match seed<input aria-label="Simulation seed" inputMode="numeric" type="number" min={1} max={2147483647} value={seed} disabled={busy} onChange={e=>setSeed(e.target.value)}/></label><button type="button" className="cm-btn cm-btn-primary" disabled={busy} onClick={()=>launch('recorded')}><Play size={16}/>{busy?'Preparing match…':'Run match'}</button><button type="button" className="cm-btn" disabled={busy} onClick={()=>setSeed(String(1+crypto.getRandomValues(new Uint32Array(1))[0]%2147483646))}><RotateCcw size={14}/>New seed</button></div>{error&&<p role="alert">{error}</p>}{busy&&<p role="status">Preparing the recorded rounds…</p>}<div className="fps-lab__identity-panel"><div className="fps-lab__system-selects"><label>Blue system<select value={blueSystem} onChange={e=>setBlueSystem(e.target.value)}><option value="structured">Structured execution</option><option value="pressure">High-tempo pressure</option>{savedPlan&&<option value="saved">Your saved gameplan</option>}</select></label><label>Red system<select value={redSystem} onChange={e=>setRedSystem(e.target.value)}><option value="structured">Structured execution</option><option value="pressure">High-tempo pressure</option>{savedPlan&&<option value="saved">Your saved gameplan</option>}</select></label></div><p>Personality shapes decisions. Six attributes resolve execution; both side assignments are locked at launch.</p><details className="fps-lab__identity-details"><summary>Set exhibition player identities &amp; experimental tendencies</summary><div className="fps-lab__identity-roster">{roster.map((card,index)=>{const personality=FPS_IDENTITY_PERSONALITIES.find(p=>p.id===identities[card.id].personality)!;const derived=deriveFpsTendencies(personality,generatePlayerDNA(card.id),identities[card.id].tendencyOverrides);const isIgl=identities[card.id].assignments.t==='T_IGL'||identities[card.id].assignments.ct==='CT_IGL';const iglDesc=isIgl?describeIglLeadershipIdentity(derived):null;return <div key={card.id}><strong>{index<5?'Blue':'Red'} · {card.name}</strong>{iglDesc&&<small>IGL: {iglDesc.label}</small>}{Object.entries(FPS_PERSONALITY_DIMENSIONS).map(([dimension,values])=><label key={dimension}>{dimension==='decisionStyle'?'Decision Style':personalityLabel(dimension)}<select value={personality[dimension as keyof typeof FPS_PERSONALITY_DIMENSIONS]} onChange={e=>setIdentities(previous=>({...previous,[card.id]:{...previous[card.id],personality:validateFpsPersonality({...FPS_IDENTITY_PERSONALITIES.find(p=>p.id===previous[card.id].personality)!,[dimension]:e.target.value}).id}}))}>{values.map(value=><option key={value} value={value}>{personalityLabel(value)}</option>)}</select></label>)}{(['t','ct'] as const).map(side=><label key={side}>{side.toUpperCase()} position<select value={identities[card.id].assignments[side]} onChange={e=>setIdentities(previous=>{const next=e.target.value as FpsAssignments[typeof side],old=previous[card.id].assignments[side],partner=roster.slice(index<5?0:5,index<5?5:10).find(p=>previous[p.id].assignments[side]===next)!;return {...previous,[card.id]:{...previous[card.id],assignments:{...previous[card.id].assignments,[side]:next}},[partner.id]:{...previous[partner.id],assignments:{...previous[partner.id].assignments,[side]:old}}};})}>{(side==='t'?FPS_T_POSITIONS:FPS_CT_POSITIONS).map(position=><option key={position} value={position}>{FPS_POSITION_LABELS[position]}</option>)}</select></label>)}{isIgl&&<label>IGL tendency preset<select value="" onChange={e=>{const preset=FPS_TENDENCY_CATALOG.iglPresets.find(p=>p.id===e.target.value);if(preset)setIdentities(prev=>({...prev,[card.id]:{...prev[card.id],tendencyOverrides:{...(prev[card.id].tendencyOverrides??{}),...preset.values}}}));}}><option value="">Derived from personality</option>{FPS_TENDENCY_CATALOG.iglPresets.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}<LabTendencyEditor derived={derived} isIgl={isIgl} overrides={identities[card.id].tendencyOverrides} onChange={next=>setIdentities(prev=>({...prev,[card.id]:{...prev[card.id],tendencyOverrides:next}}))}/></div>;})}</div></details></div><p className="fps-lab__playback-note">Playback starts automatically. Pause, select a round, scrub events, or change speed up to 16×.</p></>
    :<><div className="fps-lab__report-actions"><button className="cm-btn" onClick={()=>setReport(null)}>Set up another match</button><button className="cm-btn" onClick={download}><Download size={14}/>Download match report</button></div><FpsMatchView key={`${report.mapId}-${report.seed}`} report={report} blueTeamName="Blue Five" redTeamName="Red Five" onExit={()=>setReport(null)} autoPlay/></>}
    <nav className="fps-lab__report-actions" aria-label="Simulation help"><a className="cm-btn" href="#club-home">Club office</a><a className="cm-btn" href="#hexapedia/liveSimulation">Live 3D &amp; AI guide</a><a className="cm-btn" href="#hexapedia/maps">Maps &amp; Weapons</a><a className="cm-btn" href="#hexapedia/fps">FPS reference</a><a className="cm-btn" href="#settings">Back to settings</a></nav>
  </section>;
}
