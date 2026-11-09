import { useEffect, useRef, useState } from 'react';
import type { ChampionKit } from '../types';
import type { AvatarPreview } from '../threeAvatarPreview';
import { avatarDesign } from '../avatarDesigns';
import { avatarModelUrl,getArsenaldoModelVariant,saveArsenaldoModelVariant,legacyAvatarAssetsAvailable,type AvatarModelVariant } from '../avatarModelUrl';
import { ChampionArtwork } from './ChampionArtwork';
import './avatar-model-preview.css';

export function AvatarModelPreview({ champion,ability='ultimate' }: { champion: ChampionKit;ability?:'passive'|'skill1'|'skill2'|'ultimate' }) {
  if(!legacyAvatarAssetsAvailable)return <section className="avatar-model-preview" aria-label={`${champion.displayName} model studio`}><div className="avatar-model-preview__details"><strong>{champion.displayName}</strong><p>Previous 3D models and reference versions were deleted. A new base, rig and animation set must be qualified before live use.</p><p>Asset stage: not started</p></div></section>;
  return <LegacyAvatarModelPreview champion={champion} ability={ability}/>;
}

function LegacyAvatarModelPreview({ champion,ability='ultimate' }: { champion: ChampionKit;ability?:'passive'|'skill1'|'skill2'|'ultimate' }) {
  const host = useRef<HTMLDivElement>(null), renderer = useRef<AvatarPreview | null>(null);
  const latest = useRef(champion); latest.current = champion;
  const [status, setStatus] = useState<'loading' | 'ready' | 'fallback'>('loading');
  const [loadedVariant,setLoadedVariant]=useState<AvatarModelVariant|null>(null);
  const [resolvedAsset,setResolvedAsset]=useState<string|null>(null);
  const [angle, setAngle] = useState(35), [pose, setPose] = useState('idle'), [motion, setMotion] = useState(false);
  const [arsenaldoVariant,setArsenaldoVariant]=useState(getArsenaldoModelVariant);
  const variant=champion.id==='c_invoker'?arsenaldoVariant:'current';
  const latestVariant=useRef(variant);latestVariant.current=variant;
  const activePose=champion.id!=='c_raijin'&&pose.startsWith('ability-')?'idle':pose;
  const view = useRef({ angle, pose:activePose, motion }); view.current = { angle, pose:activePose, motion };
  const drag = useRef<{ id: number; x: number } | null>(null);
  const design = avatarDesign(champion.id);
  useEffect(() => {
    let canceled = false;
    void import('../threeAvatarPreview').then(({ AvatarPreview }) => {
      if (canceled || !host.current) return;
      try {
        const preview = new AvatarPreview(host.current, (available,modelVariant) => { if (!canceled){setStatus(available ? 'ready' : 'fallback');setLoadedVariant(modelVariant??null);setResolvedAsset(host.current?.dataset.modelUrl??null);} });
        renderer.current = preview; preview.setKit(latest.current,latestVariant.current);
        const current = view.current; preview.setView(current.angle * Math.PI / 180, current.pose, current.motion);
      } catch { if (!canceled) setStatus('fallback'); }
    }).catch(() => { if (!canceled) setStatus('fallback'); });
    return () => { canceled = true; renderer.current?.dispose(); renderer.current = null; };
  }, []);
  useEffect(() => { renderer.current?.setKit(champion,variant); }, [champion,variant]);
  useEffect(() => { renderer.current?.setView(angle * Math.PI / 180, activePose, motion); }, [angle, activePose, motion]);
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const stop = () => { if (reduced.matches) setMotion(false); };
    reduced.addEventListener('change', stop); return () => reduced.removeEventListener('change', stop);
  }, []);
  return <section className="avatar-model-preview" aria-label={`${champion.displayName} model studio`}>
    <div className="avatar-model-preview__stage">
      <span className="avatar-model-preview__eyebrow">Arena model · {champion.primaryRole}</span>
      <div ref={host} className="avatar-model-preview__canvas" role="img" aria-label={`3D model of ${champion.displayName}`}
        onPointerDown={event => { if (status !== 'ready') return; drag.current = { id: event.pointerId, x: event.clientX }; event.currentTarget.setPointerCapture(event.pointerId); }}
        onPointerMove={event => { const previous = drag.current; if (!previous || previous.id !== event.pointerId) return;
          setAngle(value => (value + (event.clientX - previous.x) * .7 + 360) % 360); previous.x = event.clientX; }}
        onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} />
      {status !== 'ready' && <div className="avatar-model-preview__fallback"><ChampionArtwork championId={champion.id} size={180} />
        <span>{status === 'loading' ? 'Loading model…' : 'Artwork view · 3D preview unavailable'}</span></div>}
      <p className="avatar-model-preview__caption">{design?.silhouette ?? champion.title}</p>
    </div>
    <div className="avatar-model-preview__details">
      <strong>{design?.signature ?? champion.displayName}</strong>
      <p>{design?.costume}</p>
      {champion.id==='c_invoker'&&<>
        <label>Model version <select aria-label="Arsenaldo model version" value={arsenaldoVariant} onChange={event=>{
          const next=event.target.value as AvatarModelVariant;setArsenaldoVariant(next);saveArsenaldoModelVariant(next);
        }}>
          <option value="submitted">Latest supplied model</option><option value="claude">Claude animation</option><option value="current">Current original</option>
        </select></label>
        <p>{arsenaldoVariant==='submitted'?(loadedVariant==='current'?'Supplied model is unavailable; showing the current original.':'Latest supplied appearance. This GLB has no skeleton or animation clips; elemental orbs and spell effects remain active.'):
          arsenaldoVariant==='claude'?(loadedVariant==='current'?'Claude animation is unavailable; showing the current original.':'Earlier model with its ten native animation clips.'):'Current model with the existing animation and contact adjustments.'} This selection also applies to Arsenaldo in your next 3D match.</p>
      </>}
      <label>Rotate model <input type="range" min="0" max="360" value={Math.round(angle)} disabled={status !== 'ready'}
        onChange={event => setAngle(Number(event.target.value))} /></label>
      <div className="avatar-model-preview__controls">
        <label>Pose <select aria-label="Avatar pose" value={activePose} onChange={event => setPose(event.target.value)} disabled={status !== 'ready'}>
          <option value="idle">Combat ready</option><option value="walk">Walk</option><option value="run">Run</option>
          <option value="attack">Attack</option><option value="cast">Cast</option><option value="hit">Hit reaction</option><option value="death">Death</option>
          <option value="turnleft">Turn left</option><option value="turnright">Turn right</option>
          {champion.id==='c_raijin'&&<>
            <option value="ability-passive">Overload charge</option><option value="ability-q">Static Remnant</option>
            <option value="ability-w">Electric Vortex</option><option value="ability-r">Ball Lightning form</option>
          </>}
        </select></label>
        <button type="button" aria-pressed={motion} onClick={() => setMotion(value => !value)} disabled={status !== 'ready'}>{motion ? 'Pause motion' : 'Animate'}</button>
        <button type="button" onClick={() => { setAngle(35); setPose('idle'); setMotion(false); }} disabled={status !== 'ready'}>Reset view</button>
        {champion.id==='c_raijin'&&<button type="button" disabled={status!=='ready'} onClick={()=>{
          setPose({passive:'ability-passive',skill1:'ability-q',skill2:'ability-w',ultimate:'ability-r'}[ability]);setMotion(true);
        }}>Preview {ability==='passive'?'Overload':champion[ability].name}</button>}
        <a href={resolvedAsset??avatarModelUrl(champion.id,variant)} download={`${champion.displayName}${variant==='claude'?'-Claude':variant==='submitted'?'-Supplied':''}.glb`}>Download GLB</a>
      </div>
    </div>
  </section>;
}
