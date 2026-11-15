import {Brain} from 'lucide-react';
import {FPS_BASE_BEHAVIORAL_PROFILES,fpsBaseProfileId,naturalFpsIdentity,observedFpsIdentity,personalityLabel,FPS_POSITION_LABELS,type FpsScoutingProfile} from '../fps/fpsIdentity';
export function FpsIdentityMarks({profile}:{profile?:FpsScoutingProfile}) {
 if(!profile?.personality)return null;
 const p=profile.personality,observed=observedFpsIdentity(profile.observed);
 return <div className="personality-marks"><span className="personality-mark" title={FPS_BASE_BEHAVIORAL_PROFILES[fpsBaseProfileId(p)-1].tendency}><Brain size={14}/>{[p.temperament,p.playstyle,p.mindset,p.decisionStyle].map(personalityLabel).join(' / ')}</span>
   <span className="personality-mark">{profile.assignments?.t?`${FPS_POSITION_LABELS[profile.assignments.t]} · ${naturalFpsIdentity(p,profile.assignments.t)}`:'T: Unassigned'}</span>
   <span className="personality-mark">{profile.assignments?.ct?`${FPS_POSITION_LABELS[profile.assignments.ct]} · ${naturalFpsIdentity(p,profile.assignments.ct)}`:'CT: Unassigned'}</span>
   {observed&&<span className="personality-mark">Observed: {observed}</span>}</div>;
}
