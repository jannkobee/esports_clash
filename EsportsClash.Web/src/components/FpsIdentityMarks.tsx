import {Brain,Focus} from 'lucide-react';
import {FPS_IDENTITY_PERSONALITIES,FPS_SPECIALTIES,type FpsScoutingProfile} from '../fps/fpsIdentity';

export function FpsIdentityMarks({profile}:{profile?:FpsScoutingProfile}) {
  if(!profile)return null;
  const personality=FPS_IDENTITY_PERSONALITIES.find(item=>item.id===profile.personality_id),specialty=FPS_SPECIALTIES.find(item=>item.id===profile.specialty_id);
  const provenance=profile.legacy_primary?(profile.mapping==='approximate_legacy_v1'?' Approximate conversion of ':' Historical badge retained: ')+profile.legacy_primary+'.':'';
  return <div className="personality-marks">
    {personality&&<span className="personality-mark" title={`${personality.description} ${personality.drawback}${provenance}`}><Brain size={14}/>{personality.name}</span>}
    {specialty&&<span className="personality-mark" title={specialty.description+' Applies only when its opportunity exists.'}><Focus size={14}/>{specialty.name}</span>}
  </div>;
}
