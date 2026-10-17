import type { AIDecisionRecord } from './aiDecisionTelemetry.ts';

/** Offline-only summary for human score review; it never tunes live weights. */
export function summarizeDecisionCalibration(records: readonly AIDecisionRecord[]) {
  const selected: Record<string, number> = {}, offered: Record<string, number> = {};
  const progressTotals: Record<string, number> = {}, progressSamples: Record<string, number> = {};
  let counterfactualCompared = 0, counterfactualChanged = 0;
  for (const record of records) {
    if (record.selected) selected[record.selected] = (selected[record.selected] ?? 0) + 1;
    if (record.zeroPolicySelected !== undefined) {
      counterfactualCompared++;
      if (record.zeroPolicySelected !== record.selected) counterfactualChanged++;
    }
    if (record.selected && record.outcome) {
      progressTotals[record.selected] = (progressTotals[record.selected] ?? 0) + record.outcome.progress;
      progressSamples[record.selected] = (progressSamples[record.selected] ?? 0) + 1;
    }
    for (const candidate of record.candidates) if (candidate.available)
      offered[candidate.key] = (offered[candidate.key] ?? 0) + 1;
  }
  const meanLocalProgress = Object.fromEntries(Object.entries(progressTotals)
    .map(([action, total]) => [action, total / progressSamples[action]]));
  return { sampleSize: records.length, selected, offered, counterfactualCompared, counterfactualChanged,
    localOutcomeSamples: progressSamples, meanLocalProgress,
    note: 'Descriptive same-state and short-horizon proxies only; neither establishes causal action quality.' };
}
