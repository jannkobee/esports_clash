export type AbilityVisualStyle = Readonly<{
  version: number; theme: string; pulse: number; trail_taper: number;
  confirmed_impacts_only: boolean; max_extra_draws: number; warning_geometry_unchanged: boolean;
}>;

/** Constrained visual envelopes; no generated shader/source execution. */
export function abilityVisualEnvelope(input: unknown, phase: number): { opacity: number; taper: number } | undefined {
  const style=input as Partial<AbilityVisualStyle> | undefined;
  if(!style||style.version!==1||style.theme!=='ice-wind-fire'||style.confirmed_impacts_only!==true
    ||style.max_extra_draws!==0||style.warning_geometry_unchanged!==true
    ||!Number.isFinite(style.pulse)||!Number.isFinite(style.trail_taper)||!Number.isFinite(phase))return;
  const p=Math.max(0,Math.min(1,phase)),pulse=Math.max(0,Math.min(.18,style.pulse!));
  const taper=Math.max(.35,Math.min(.8,style.trail_taper!));
  return {opacity:1-pulse+pulse*Math.sin(Math.PI*p)**2,taper:1-(1-taper)*p*p};
}
