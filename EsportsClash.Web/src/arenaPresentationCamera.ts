import {ARENA_HEIGHT} from './arenaLayout.ts';
export const ARENA_RENDER_HEIGHT = ARENA_HEIGHT;

export type ArenaCameraViewport = {
  x: number;
  y: number;
  halfW: number;
  halfH: number;
};

export function clampArenaCamera(
  x: number,
  y: number,
  zoom: number,
  worldWidth: number,
  worldHeight: number,
): ArenaCameraViewport {
  const safeZoom = Math.max(0.0001, zoom);
  const halfW = (worldWidth / 2) / safeZoom;
  const halfH = (worldHeight / 2) / safeZoom;
  return {
    x: Math.max(halfW, Math.min(worldWidth - halfW, x)),
    y: Math.max(halfH, Math.min(worldHeight - halfH, y)),
    halfW,
    halfH,
  };
}

export function arenaWorldToNdc(
  worldX: number,
  worldY: number,
  viewport: ArenaCameraViewport,
): { x: number; y: number } {
  return {
    x: (worldX - viewport.x) / viewport.halfW,
    y: (viewport.y - worldY) / viewport.halfH,
  };
}
