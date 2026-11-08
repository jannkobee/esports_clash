import { useEffect, useRef } from 'react';
import type { BabylonMatchViewer } from '../match-viewer/BabylonMatchViewer';
import type { OnlineSnapshot } from '../onlineSpectator';
import { interpolateSpectatorFrame } from '../onlineSpectator';
import { ARENA_RENDER_HEIGHT } from '../arenaPresentationCamera';
import { ARENA_WIDTH, ARENA_HEIGHT, LANE_Y, NEXUS_TOWER_X } from '../arenaLayout';
import {validateVisualReleases,type VisualRelease} from '../avatarVisualRelease';

export function OnlineMatchViewer({ message,matchId,visuals,live=true }: { message: OnlineSnapshot | null;matchId?:string;visuals?:readonly VisualRelease[];live?:boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const frames = useRef<{ current: OnlineSnapshot | null; previous: OnlineSnapshot | null; received: number; interval:number }>({ current: null, previous: null, received: 0, interval:500 });
  useEffect(() => {
    const prior=frames.current,now=performance.now();
    const gap=message&&prior.current?message.snapshot.second-prior.current.snapshot.second:0;
    const consecutive=live&&message?.match_id===prior.current?.match_id&&gap>0&&gap<=2;
    const elapsed=Math.max(100,Math.min(2000,now-prior.received));
    const oldInterval=Number.isFinite(prior.interval)?prior.interval:elapsed;
    frames.current = { current: message, previous: consecutive?prior.current:null, received:now,
      interval:consecutive?oldInterval*.5+elapsed*.5:500/Math.max(1,message?.speed??1) };
  }, [message,live]);
  useEffect(() => {
    let renderer: BabylonMatchViewer | null = null, closed = false, raf = 0;
    void import('../match-viewer/BabylonMatchViewer').then(async ({ BabylonMatchViewer }) => {
      if (!closed && host.current) {
        try { renderer = await BabylonMatchViewer.create(host.current, ARENA_WIDTH, ARENA_RENDER_HEIGHT, NEXUS_TOWER_X.blue, NEXUS_TOWER_X.red, () => {},
          Promise.resolve(validateVisualReleases(visuals??[]))); if(closed){renderer.dispose();renderer=null;} }
        catch { /* Read-only Canvas fallback remains available. */ }
      }
    }).catch(()=>{/* Tactical fallback remains available on load failure. */});
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      const { current, previous, received, interval } = frames.current;
      if (!current) return;
      const frame = previous && !current.snapshot.finished
        ? interpolateSpectatorFrame(previous.snapshot.frame, current.snapshot.frame,
          (now - received) / Math.max(50, interval)) : current.snapshot.frame;
      const rendered = renderer?.renderArena(frame, ARENA_WIDTH / 2, LANE_Y, 1);
      const target = canvas.current, ctx = target?.getContext('2d');
      if (!target || !ctx) return;
      const width=Math.round(target.clientWidth*devicePixelRatio),height=Math.round(target.clientHeight*devicePixelRatio);
      if(target.width!==width)target.width=width;
      if(target.height!==height)target.height=height;
      ctx.clearRect(0, 0, target.width, target.height);
      if (rendered && renderer) {
        ctx.save();ctx.scale(devicePixelRatio,devicePixelRatio);ctx.font='12px system-ui';ctx.textAlign='center';
        for(const actor of frame.champions.filter(c=>c.isAlive)){
          const p=renderer.project(actor.x,actor.y,renderer.actorHeight(actor.id),target.clientWidth,target.clientHeight);
          ctx.fillStyle='#fff';ctx.fillText(actor.player.name,p.x,p.y-8);ctx.fillStyle='#222';ctx.fillRect(p.x-24,p.y,48,5);
          ctx.fillStyle=actor.team==='blue'?'#38bdf8':'#fb7185';ctx.fillRect(p.x-24,p.y,48*Math.max(0,Math.min(1,actor.hp/actor.maxHp)),5);
        }ctx.restore();return;
      }
      const scale = Math.min(target.width / ARENA_WIDTH, target.height / ARENA_HEIGHT);
      ctx.save(); ctx.translate((target.width - ARENA_WIDTH * scale) / 2, (target.height - ARENA_HEIGHT * scale) / 2); ctx.scale(scale, scale);
      ctx.fillStyle = '#14251e'; ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
      ctx.fillStyle = '#787767'; ctx.fillRect(0, LANE_Y-200, ARENA_WIDTH, 400);
      for (const actor of [...frame.structures, ...frame.champions]) {
        if (!actor.isAlive) continue;
        ctx.fillStyle = actor.team === 'blue' ? '#38bdf8' : '#fb7185';
        ctx.beginPath(); ctx.arc(actor.x, actor.y, 'player' in actor ? 15 : 25, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#e2e8f0'; ctx.font = '17px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('player' in actor ? actor.player.name : actor.name, actor.x, actor.y - 27);
      }
      ctx.restore();
    };
    raf = requestAnimationFrame(draw);
    return () => { closed = true; cancelAnimationFrame(raf); renderer?.dispose(); renderer = null; };
  }, [matchId]);
  return <div className="relative h-[380px] w-full overflow-hidden rounded-xl border border-slate-700 bg-slate-950 sm:h-[480px]">
    <div ref={host} className="absolute inset-0" />
    <canvas ref={canvas} className="pointer-events-none absolute inset-0 h-full w-full" aria-label="Read-only authoritative match viewer" />
    {!message && <p className="absolute inset-0 grid place-items-center text-sm text-slate-400">Waiting for the server’s first snapshot…</p>}
  </div>;
}
