import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fitRandomizedMacroCandidate } from '../src/randomizedMacroLearning.ts';

const source = JSON.parse(await readFile(resolve('../docs/ml-controlled-experiment.json'), 'utf8'));
const prior = JSON.parse(await readFile(resolve('../docs/ml-live-evaluation.json'), 'utf8'));
const incumbent = prior.train.endingPolicy;
const records = source.runs.flatMap(run => run.experimentRecords ?? []);
const fit = fitRandomizedMacroCandidate(incumbent, records);
const output = { method: 'Offline intent-to-treat contrast from evaluation-only 50/50 assignments; descriptive 95% bands ignore actor/match interference; candidate not auto-promoted',
  trainingRuns: source.runs.map(run => ({ label: run.label, assignments: run.decisions.experimentAssignments,
    outcomes: run.decisions.experimentWithOutcome, arms: run.decisions.experimentArms,
    gates: run.decisions.experimentGateCounts })),
  assigned: fit.assigned, validOutcomes: fit.validOutcomes, trainedGroups: fit.trainedGroups,
  groups: fit.groups, incumbent, candidate: fit.policy };
const path = resolve('../docs/ml-controlled-experiment-analysis.json');
await writeFile(path, JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify({ path, assigned: fit.assigned, validOutcomes: fit.validOutcomes,
  trainedGroups: fit.trainedGroups, groups: fit.groups }, null, 2));
