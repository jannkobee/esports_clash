import formulas from './fps-tendency-formulas-v4.json' with { type: 'json' };
import { fpsBehaviorPreferences, type FpsPersonality } from './fpsPlayerArchitecture.ts';

/**
 * Table form of the natural tendency weights in `deriveFpsTendencies` (fpsPlayerTendencies.ts), shared
 * with the server (EsportsClash.Api/resources/fps-tendency-formulas-v4.json, mirrored by
 * scripts/sync-fps-player-architecture.mjs). Each term is [weight, input, inverted]: the input value
 * (0..100), or 100 minus it when inverted; a nested list is a weighted group summed first. Terms are summed in source order, so the server reproduces
 * the client's floating-point results exactly. The table is regenerated from the TypeScript source
 * (FPS_WRITE_TENDENCY_FIXTURE=1 on fpsPlayerTendencies.test.mjs) and checked against it there.
 *
 * `diagnosticKeys` lists the tendencies the Tactical System Editor's team diagnostics read; the server
 * sends only these derived values (never DNA) so the editor need not rederive from ID-based DNA.
 */
export type FpsTendencyTerm = readonly [number, string | readonly FpsTendencyTerm[], 0 | 1];
export interface FpsTendencyFormulaTable {
  version: 1;
  jitterSpan: number;
  formulas: Record<string, readonly FpsTendencyTerm[]>;
  diagnosticKeys: readonly string[];
}
export const FPS_TENDENCY_FORMULAS = formulas as unknown as FpsTendencyFormulaTable;
export const FPS_DIAGNOSTIC_TENDENCY_KEYS: readonly string[] = FPS_TENDENCY_FORMULAS.diagnosticKeys;

/** Weighted base value before jitter, from the shared table (used to prove the table matches the source). */
export function fpsTendencyBaseFromTable(key: string, personality: FpsPersonality, dna: Record<string, number>): number {
  const terms = FPS_TENDENCY_FORMULAS.formulas[key];
  if (!terms) return 50;
  const p = fpsBehaviorPreferences(personality);
  const inputs: Record<string, number> = {
    init: p.initiative * 100, coord: p.coordination * 100, delib: p.deliberation * 100, reass: p.reassessment * 100,
    press: p.pressureSensitivity * 100, inst: (1 - p.deliberation) * 100, indiv: (1 - p.coordination) * 100,
  };
  const evaluate = (terms: readonly FpsTendencyTerm[]): number => {
    let sum = 0;
    for (const [weight, input, inverted] of terms) {
      const value = typeof input !== 'string' ? evaluate(input) : input.startsWith('d.') ? (dna[input.slice(2)] ?? 50) : inputs[input];
      sum += weight * (inverted ? 100 - value : value);
    }
    return sum;
  };
  const sum = evaluate(terms);
  return sum;
}
