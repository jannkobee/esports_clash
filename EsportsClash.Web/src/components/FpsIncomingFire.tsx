import type {CSSProperties} from 'react';
import type {LiveSnapshot,LivePlayer} from '../fps/fpsLiveSimulation';

export function FpsIncomingFire({frame,player}:{frame:LiveSnapshot;player:LivePlayer}){
  const cues=(frame.fireCues??[]).filter(cue=>cue.playerId===player.id&&frame.time-cue.at<.95);
  if(!cues.length)return null;
  const hit=cues.some(cue=>cue.kind==='hit');
  const intensity=Math.min(1.5,cues.reduce((sum,cue)=>{
    const freshness=Math.max(0,1-(frame.time-cue.at)/.95);
    return sum+cue.strength*freshness*(cue.kind==='hit'?1.25:.75);
  },0));
  const pinned=cues.length>=3||intensity>=1.05;
  const label=hit?(pinned?'PINNED — TAKING FIRE':'TAKING FIRE'):(pinned?'HEAVY FIRE NEARBY':'BULLETS NEARBY');
  const style={'--incoming-intensity':intensity.toFixed(2)} as CSSProperties;
  return <div className={`fps-incoming ${hit?'fps-incoming--hit':''} ${pinned?'fps-incoming--pinned':''}`} style={style} aria-label={hit?'Taking damage':'Incoming gunfire'}>
    {cues.map(cue=>{
      const age=Math.max(0,frame.time-cue.at);
      const freshness=Math.max(0,1-age/.95);
      const relative=Math.atan2(Math.sin(cue.bearing-player.yaw),Math.cos(cue.bearing-player.yaw));
      const opacity=freshness*(.45+cue.strength*.55);
      const scale=(.92+cue.strength*.16)-(age*.08);
      return <svg key={cue.id} viewBox="0 0 300 300" className={`fps-incoming__arc fps-incoming__arc--${cue.kind}`} style={{transform:`rotate(${relative*180/Math.PI}deg) scale(${scale.toFixed(3)})`,opacity}} aria-hidden="true">
        <path d="M105 42 Q150 24 195 42"/><path d="m141 32 9-12 9 12"/>
      </svg>;
    })}
    <span className="fps-incoming__label">{label}</span>
  </div>;
}
