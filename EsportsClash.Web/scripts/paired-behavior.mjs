// Diagnose whether a legal macro selection reached its intended executor.
const intents = { fight: ['champion', 'hold'], wave: ['minion'], regroup: ['regroup'],
  farm: ['camp'], push: ['push', 'hold', 'structure', 'minion'] };

export function summarizePairedBehavior(first, alternate, second) {
  function summarize(trace) {
    const fresh = trace.filter(row => row.decision
      && Math.abs(row.decision.second - row.second) < 1e-6);
    const assignments = fresh.filter(row => row.decision.reason.startsWith('assigned:'));
    const executed = fresh.filter(row => intents[row.decision.selected]?.includes(row.intent));
    return { ticks: trace.length, residualDecisionTicks: fresh.length,
      assignedAction: assignments[0]?.decision.selected,
      assignmentReachedExecutor: assignments.some(row => intents[row.decision.selected]?.includes(row.intent)),
      matchingExecutorTicks: executed.length,
      fallbackTicks: fresh.length - executed.length,
      firstSecond: fresh.filter(row => row.second <= second + 1).map(row => ({
        second: row.second, selected: row.decision.selected, intent: row.intent,
        reason: row.decision.reason, x: row.x, y: row.y,
      })) };
  }
  const a = first ?? [], b = alternate ?? [];
  const aligned = a.flatMap(row => {
    const other = b.find(item => Math.abs(item.second - row.second) < 1e-6);
    return other ? [{ second: row.second, distance: Math.hypot(row.x - other.x, row.y - other.y),
      changedIntent: row.intent !== other.intent || row.targetId !== other.targetId,
      changedCombat: row.cd1 !== other.cd1 || row.cd2 !== other.cd2 || row.cdUlt !== other.cdUlt
        || row.damageDealt !== other.damageDealt }] : [];
  });
  return { incumbent: summarize(a), alternate: summarize(b),
    firstBehaviorDifference: aligned.find(row => row.distance > .01 || row.changedIntent || row.changedCombat)?.second ?? null,
    maxPositionDifferenceFirstCommitment: Math.max(0, ...aligned.filter(row => row.second <= second + .65).map(row => row.distance)),
    maxPositionDifference: Math.max(0, ...aligned.map(row => row.distance)),
    changedCombatTicks: aligned.filter(row => row.changedCombat).length };
}
