import type {LiveSnapshot,LivePlayer} from '../fps/fpsLiveSimulation';

export function FpsIncomingFire({frame,player}:{frame:LiveSnapshot;player:LivePlayer}){
  const cues=(frame.fireCues??[]).filter(cue=>cue.playerId===player.id&&frame.time-cue.at<.9);
  if(!cues.length)return null;
  const hit=cues.some(cue=>cue.kind==='hit');
  return <div className={`fps-incoming ${hit?'fps-incoming--hit':''}`} aria-label={hit?'Taking damage':'Incoming gunfire'}>
    {cues.map(cue=>{
      const relative=Math.atan2(Math.sin(cue.bearing-player.yaw),Math.cos(cue.bearing-player.yaw));
      const opacity=Math.max(0,1-(frame.time-cue.at)/.9)*(.5+cue.strength*.5);
      return <svg key={cue.id} viewBox="0 0 300 300" className={`fps-incoming__arc fps-incoming__arc--${cue.kind}`} style={{transform:`rotate(${relative*180/Math.PI}deg)`,opacity}} aria-hidden="true">
        <path d="M105 42 Q150 24 195 42"/><path d="m141 32 9-12 9 12"/>
      </svg>;
    })}
    <span className="fps-incoming__label">{hit?'TAKING FIRE':'BULLETS NEARBY'}</span>
  </div>;
}
