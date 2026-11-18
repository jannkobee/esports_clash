/**
 * Manager-facing 1–10 scale (owner decision, 2026-11-17): every derived 0–100 value is shown as a
 * whole number 1–10 with its own label, never as the raw value. Mirrored exactly by
 * FpsPlayerArchitecture::scale10 / rated (PHP). Whole levels also keep private DNA from being
 * reconstructed from scouting output.
 */
export const FPS_SKILL_SCALE_LABELS = ['Erratic', 'Wretched', 'Poor', 'Weak', 'Passable', 'Solid', 'Steady', 'Excellent', 'Formidable', 'Metronomic'] as const;
export const FPS_TENDENCY_SCALE_LABELS = ['Never', 'Almost never', 'Rarely', 'Seldom', 'Sometimes', 'Often', 'Usually', 'Strongly', 'Very strongly', 'Always'] as const;
export type FpsScaleKind = 'skill' | 'tendency';
export interface FpsRated { value: number; label: string }

/** 0–10 → 1, 10.x–20 → 2, … 90.x–100 → 10. */
export function fpsScale10(value0to100: number): number {
  return Math.max(1, Math.min(10, Math.ceil(value0to100 / 10)));
}
export function fpsRated(value0to100: number, kind: FpsScaleKind): FpsRated {
  const value = fpsScale10(value0to100);
  return { value, label: (kind === 'skill' ? FPS_SKILL_SCALE_LABELS : FPS_TENDENCY_SCALE_LABELS)[value - 1] };
}
export const fpsRatedText = (r: FpsRated) => `${r.value} · ${r.label}`;
/** Midpoint of a level on the 0–100 scale, for diagnostics that need a continuous value. */
export const fpsLevelMidpoint = (level: number) => level * 10 - 5;
