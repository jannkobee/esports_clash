import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fitRandomizedMacroCandidate } from '../src/randomizedMacroLearning.ts';

const inputs = ['../docs/ml-post-fix-probe-74.json', '../docs/ml-post-fix-probe-75.json',
  '../docs/ml-post-fix-probe-77-78-both.json'];
const sources = await Promise.all(inputs.map(path => readFile(resolve(path), 'utf8').then(JSON.parse)));
const prior = JSON.parse(await readFile(resolve('../docs/ml-live-evaluation.json'), 'utf8'));
const incumbent = prior.train.endingPolicy;
const records = sources.flatMap(source => source.runs.flatMap(run => run.experimentRecords));
const fit = fitRandomizedMacroCandidate(incumbent, records);
const output = { method: 'Offline fit from two post-commitment-fix natural live browser matches; descriptive local progress is not proof of causal match benefit; candidate is not auto-promoted',
  runs: sources.flatMap(source => source.runs.map(run => ({ label: run.label,
    outcome: run.outcome, decisions: run.decisions }))),
  assigned: fit.assigned, validOutcomes: fit.validOutcomes,
  trainedGroups: fit.trainedGroups, groups: fit.groups, incumbent, candidate: fit.policy };
const path = resolve('../docs/ml-post-fix-analysis.json');
await writeFile(path, JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify({ path, assigned: fit.assigned, validOutcomes: fit.validOutcomes,
  trainedGroups: fit.trainedGroups, groups: fit.groups }, null, 2));
