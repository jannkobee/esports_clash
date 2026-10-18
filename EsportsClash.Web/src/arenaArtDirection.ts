/** Presentation palette only. No gameplay state or random source is consulted. */
export const ARENA_LIGHTING = {
  sky: '#dce8d7', earth: '#35433e', ambient: 1.35,
  sun: '#fff0d3', sunIntensity: 2.35, sunDirection: [-.48, .82, .31],
  rim: '#a4c9dc', rimIntensity: .65,
} as const;

type CampFamily = 'azure' | 'frost' | 'ember' | 'shadow' | 'hollow' | 'siege' | 'dragon';
type CampArt = { family: CampFamily; accent: string; stone: string; ground: readonly [number, number, number] };
const camps: Record<CampFamily, CampArt> = {
  azure: { family: 'azure', accent: '#80c6ca', stone: '#697b79', ground: [.24, .31, .28] },
  frost: { family: 'frost', accent: '#a9d4df', stone: '#74828a', ground: [.27, .32, .32] },
  ember: { family: 'ember', accent: '#cc9665', stone: '#82705c', ground: [.35, .28, .19] },
  shadow: { family: 'shadow', accent: '#a99ac2', stone: '#6b687c', ground: [.27, .25, .29] },
  hollow: { family: 'hollow', accent: '#adb87b', stone: '#70795c', ground: [.29, .30, .19] },
  siege: { family: 'siege', accent: '#97b5a8', stone: '#78817a', ground: [.25, .29, .26] },
  dragon: { family: 'dragon', accent: '#d8a16b', stone: '#73675c', ground: [.30, .24, .19] },
};
export function arenaCampArt(id: string): CampArt {
  const family = id === 'dragon_boss' ? 'dragon' : id === 'j_siege_golem' ? 'siege' :
    id.includes('blue_buff') ? 'azure' : id.includes('golem') ? 'frost' :
    id.includes('wolves') ? 'shadow' : id.includes('behemoth') ? 'hollow' : 'ember';
  return camps[family];
}
