import { useEffect, useRef } from 'react';
import type { ThreeArenaTerrain } from '../threeArenaTerrain';
import type { OnlineSnapshot } from '../onlineSpectator';
import { interpolateSpectatorFrame } from '../onlineSpectator';
import { ARENA_RENDER_HEIGHT } from '../arenaPresentationCamera';
import { NEXUS_TOWER_X } from '../arenaLayout';

export function OnlineMatchViewer({ message }: { message: OnlineSnapshot | null }) {
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const frames = useRef<{ current: OnlineSnapshot | null; previous: OnlineSnapshot | null; received: number }>({ current: null, previous: null, received: 0 });
  useEffect(() => {
    frames.current = { current: message, previous: frames.current.current, received: performance.now() };
  }, [message]);
  useEffect(() => {
    let renderer: ThreeArenaTerrain | null = null, closed = false, raf = 0;
    void import('../threeArenaTerrain').then(({ ThreeArenaTerrain }) => {
      if (!closed && host.current) {
        try { renderer = new ThreeArenaTerrain(host.current, 2600, ARENA_RENDER_HEIGHT, NEXUS_TOWER_X.blue, NEXUS_TOWER_X.red, () => {}); }
        catch { /* Read-only Canvas fallback remains available. */ }
      }
    });
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      const { current, previous, received } = frames.current;
      if (!current) return;
      const frame = previous && !current.snapshot.finished
        ? interpolateSpectatorFrame(previous.snapshot.frame, current.snapshot.frame,
          (now - received) / Math.max(50, 500 / Math.max(1, current.speed))) : current.snapshot.frame;
      const rendered = renderer?.renderArena(frame, 1300, 380, 1);
      const target = canvas.current, ctx = target?.getContext('2d');
      if (!target || !ctx) return;
      target.width = target.clientWidth * devicePixelRatio;
      target.height = target.clientHeight * devicePixelRatio;
      ctx.clearRect(0, 0, target.width, target.height);
      if (rendered) return;
      const scale = Math.min(target.width / 2600, target.height / 760);
      ctx.save(); ctx.translate((target.width - 2600 * scale) / 2, (target.height - 760 * scale) / 2); ctx.scale(scale, scale);
      ctx.fillStyle = '#14251e'; ctx.fillRect(0, 0, 2600, 760);
      ctx.fillStyle = '#787767'; ctx.fillRect(0, 315, 2600, 130);
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
  }, []);
  return <div className="relative h-[380px] w-full overflow-hidden rounded-xl border border-slate-700 bg-slate-950 sm:h-[480px]">
    <div ref={host} className="absolute inset-0" />
    <canvas ref={canvas} className="pointer-events-none absolute inset-0 h-full w-full" aria-label="Read-only authoritative match viewer" />
    {!message && <p className="absolute inset-0 grid place-items-center text-sm text-slate-400">Waiting for the server’s first snapshot…</p>}
  </div>;
}
