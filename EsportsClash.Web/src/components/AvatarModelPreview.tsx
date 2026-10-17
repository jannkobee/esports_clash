import { useEffect, useRef, useState } from 'react';
import type { ChampionKit } from '../types';
import type { AvatarPreview } from '../threeAvatarPreview';
import { avatarDesign } from '../avatarDesigns';
import { avatarModelUrl } from '../avatarModelUrl';
import { ChampionArtwork } from './ChampionArtwork';
import './avatar-model-preview.css';

export function AvatarModelPreview({ champion }: { champion: ChampionKit }) {
  const host = useRef<HTMLDivElement>(null), renderer = useRef<AvatarPreview | null>(null);
  const latest = useRef(champion); latest.current = champion;
  const [status, setStatus] = useState<'loading' | 'ready' | 'fallback'>('loading');
  const [angle, setAngle] = useState(35), [pose, setPose] = useState('idle'), [motion, setMotion] = useState(false);
  const view = useRef({ angle, pose, motion }); view.current = { angle, pose, motion };
  const drag = useRef<{ id: number; x: number } | null>(null);
  const design = avatarDesign(champion.id);
  useEffect(() => {
    let canceled = false;
    void import('../threeAvatarPreview').then(({ AvatarPreview }) => {
      if (canceled || !host.current) return;
      try {
        const preview = new AvatarPreview(host.current, available => { if (!canceled) setStatus(available ? 'ready' : 'fallback'); });
        renderer.current = preview; preview.setKit(latest.current);
        const current = view.current; preview.setView(current.angle * Math.PI / 180, current.pose, current.motion);
      } catch { if (!canceled) setStatus('fallback'); }
    }).catch(() => { if (!canceled) setStatus('fallback'); });
    return () => { canceled = true; renderer.current?.dispose(); renderer.current = null; };
  }, []);
  useEffect(() => { renderer.current?.setKit(champion); }, [champion]);
  useEffect(() => { renderer.current?.setView(angle * Math.PI / 180, pose, motion); }, [angle, pose, motion]);
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
      <label>Rotate model <input type="range" min="0" max="360" value={Math.round(angle)} disabled={status !== 'ready'}
        onChange={event => setAngle(Number(event.target.value))} /></label>
      <div className="avatar-model-preview__controls">
        <label>Pose <select value={pose} onChange={event => setPose(event.target.value)} disabled={status !== 'ready'}>
          <option value="idle">Combat ready</option><option value="walk">Walk</option><option value="run">Run</option><option value="strafe">Strafe</option>
          <option value="attack">Attack</option><option value="cast">Cast</option><option value="hit">Hit reaction</option><option value="death">Death</option>
          <option value="turnleft">Turn left</option><option value="turnright">Turn right</option>
        </select></label>
        <button type="button" aria-pressed={motion} onClick={() => setMotion(value => !value)} disabled={status !== 'ready'}>{motion ? 'Pause motion' : 'Animate'}</button>
        <button type="button" onClick={() => { setAngle(35); setPose('idle'); setMotion(false); }} disabled={status !== 'ready'}>Reset view</button>
        <a href={avatarModelUrl(champion.id)} download={`${champion.displayName}.glb`}>Download GLB</a>
      </div>
    </div>
  </section>;
}
