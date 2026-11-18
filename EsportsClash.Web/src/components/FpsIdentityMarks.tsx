import {Brain} from 'lucide-react';
import {FPS_BASE_BEHAVIORAL_PROFILES,fpsBaseProfileId,naturalFpsIdentity,observedFpsIdentity,personalityLabel,FPS_POSITION_LABELS,type FpsScoutingProfile} from '../fps/fpsIdentity';
/** Scouting tendencies arrive as a 1–10 level with its label (fpsScale10); raw values stay on the server. */
function tendencyNote(label:string,value:number,level:string):string {
 return `${label} ${value} · ${level}`;
}
export function FpsIdentityMarks({profile,igl,compact=false}:{profile?:FpsScoutingProfile;igl?:boolean;compact?:boolean}) {
 if(!profile?.personality)return null;
 const p=profile.personality,observed=observedFpsIdentity(profile.observed);
 const isIgl=igl??(profile.assignments?.t==='T_IGL'||profile.assignments?.ct==='CT_IGL');
 const notes=(profile.top_tendencies??[]).filter(t=>t.value<=4||t.value>=7).map(t=>tendencyNote(t.label,t.value,t.level));
 if(compact){
  // List views: one personality line, positions only when assigned, and at most two tendencies in plain text.
  const roles=[['T',profile.assignments?.t],['CT',profile.assignments?.ct]].filter(([,position])=>!!position) as [string,NonNullable<typeof profile.assignments>['t']][];
  return <div className="personality-marks personality-marks--compact"><span className="personality-mark" title={FPS_BASE_BEHAVIORAL_PROFILES[fpsBaseProfileId(p)-1].tendency}><Brain size={13}/>{[p.temperament,p.playstyle,p.mindset,p.decisionStyle].map(personalityLabel).join(' · ')}</span>
   {roles.map(([side,position])=><span className="personality-mark" key={side}>{FPS_POSITION_LABELS[position!]}</span>)}
   {notes.length>0&&<small className="personality-tendency" title={notes.join(' · ')}>Tends to: {notes.slice(0,2).join(' · ')}{notes.length>2?` · +${notes.length-2} more`:''}</small>}</div>;
 }
 return <div className="personality-marks"><span className="personality-mark" title={FPS_BASE_BEHAVIORAL_PROFILES[fpsBaseProfileId(p)-1].tendency}><Brain size={14}/>{[p.temperament,p.playstyle,p.mindset,p.decisionStyle].map(personalityLabel).join(' / ')}</span>
   <span className="personality-mark">{profile.assignments?.t?`${FPS_POSITION_LABELS[profile.assignments.t]} · ${naturalFpsIdentity(p,profile.assignments.t)}`:'T: Unassigned'}</span>
   <span className="personality-mark">{profile.assignments?.ct?`${FPS_POSITION_LABELS[profile.assignments.ct]} · ${naturalFpsIdentity(p,profile.assignments.ct)}`:'CT: Unassigned'}</span>
   {isIgl&&profile.igl_identity&&<span className="personality-mark" title={[profile.igl_identity.summary,profile.igl_identity.potentialWeakness].filter(Boolean).join(' Watch: ')}>IGL style: {profile.igl_identity.label}</span>}
   {notes.length>0&&<span className="personality-mark" title="Natural tendencies from personality and stable DNA; expression changes with system, chemistry and pressure">Tends to: {notes.join(' · ')}</span>}
   {observed&&<span className="personality-mark">Observed: {observed}</span>}</div>;
}
