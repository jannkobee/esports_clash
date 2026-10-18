export type NameplateAnchor = { id: string; x: number; y: number; width: number; height: number; priority: number };
export type OverlayBox = { x: number; y: number; width: number; height: number };
export type NameplatePlacement = { x: number; y: number };
const overlaps = (a: OverlayBox, b: OverlayBox) =>
  a.x < b.x + b.width + 3 && a.x + a.width + 3 > b.x && a.y < b.y + b.height + 3 && a.y + a.height + 3 > b.y;

/** Stateless packing: the same camera/input produces the same labels after rewind. */
export function placeArenaNameplates(anchors: readonly NameplateAnchor[], width: number, height: number,
  reserved: readonly OverlayBox[] = []): Map<string, NameplatePlacement> {
  const placed = new Map<string, NameplatePlacement>(), occupied = [...reserved];
  const sorted = [...anchors].sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
  for (const anchor of sorted) {
    if (!Number.isFinite(anchor.x + anchor.y) || anchor.x < -anchor.width || anchor.x > width + anchor.width ||
      anchor.y < -36 || anchor.y > height + 24) continue;
    const w = Math.min(anchor.width, Math.max(1, width - 16)), h = anchor.height;
    const offsets = anchor.priority >= 2 ? [[0,0],[0,-16],[-26,-8],[26,-8],[0,-32],[-42,-24],[42,-24],[0,-48],[0,16]] : [[0,0],[0,-10]];
    let chosen: OverlayBox | undefined;
    for (const [dx,dy] of offsets) {
      const box = { x: Math.max(8, Math.min(width - w - 8, anchor.x - w / 2 + dx)),
        y: Math.max(8, Math.min(height - h - 8, anchor.y - h + dy)), width: w, height: h };
      if (!occupied.some(other => overlaps(box,other))) { chosen = box; break; }
    }
    // Preserve every champion's health even when a very small viewport is saturated.
    if (!chosen && anchor.priority >= 3) {
      chosen = {x: Math.max(8,Math.min(width-w-8,anchor.x-w/2)),
        y: Math.max(8,Math.min(height-h-8,anchor.y-h-48)),width:w,height:h};
      for(const box of reserved)if(overlaps(chosen,box)){
        if(box.y-h-4>=8)chosen.y=Math.min(chosen.y,box.y-h-4);
        else if(box.x-w-4>=8)chosen.x=Math.min(chosen.x,box.x-w-4);
      }
    }
    if (!chosen) continue;
    occupied.push(chosen);placed.set(anchor.id,{x:chosen.x+w/2,y:chosen.y+h});
  }
  return placed;
}
