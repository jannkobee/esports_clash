// Record only checks that have already executed; this does not run qualification.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {intelligenceSourceHash} from './intelligence-source-hash.mjs';
const root=new URL('../../',import.meta.url);
const read=async path=>{const bytes=await readFile(new URL(path,root));return bytes[0]===255&&bytes[1]===254?bytes.subarray(2).toString('utf16le'):bytes.toString('utf8');};
const parse=async path=>JSON.parse(await read(path));
const sourceHash=intelligenceSourceHash();
const teamfightPath='docs/avatar-rework/v3-ferry-fix-teamfight-20261023.json';
const baselinePath='docs/avatar-rework/v3-ferry-fix-baseline-20261023.json';
const teamfight=await parse(teamfightPath),baseline=await parse(baselinePath);
assert.equal(teamfight.sourceHash,sourceHash);assert.equal(baseline.sourceHash,sourceHash);
assert.equal(baseline.exact,true);assert.equal(teamfight.runs.length,3);
for(const run of teamfight.runs){assert.equal(run.fingerprint,teamfight.runs[0].fingerprint);assert.deepEqual(run.world,teamfight.runs[0].world);}
const check=await read('v3-ferry-fix-check.log');
assert.match(check,/# tests 560/);assert.match(check,/# tests 3/);assert.doesNotMatch(check,/^not ok /m);
for(const path of ['v3-ferry-fix-build.log','v3-ferry-fix-worker.log'])assert.match(await read(path),/built in/);
const gateText=await read('v3-ferry-fix-readiness.log');
const gate=JSON.parse(gateText.slice(gateText.indexOf('{')));assert.equal(gate.ready,false);
assert.equal(gate.missingHandlers.length,40);assert.equal(gate.unqualified.length,45);
const paths=[teamfightPath,baselinePath,'docs/avatar-rework/progress.json',
 'docs/avatar-rework/v3-ferry-fix-styled-20261023.json','docs/avatar-rework/source-receipt.json',
 'v3-ferry-fix-check.log','v3-ferry-fix-build.log','v3-ferry-fix-worker.log','v3-ferry-fix-readiness.log'];
const artifacts=await Promise.all(paths.map(async path=>({path,sha256:createHash('sha256').update(await readFile(new URL(path,root))).digest('hex')})));
const report={date:'2026-10-23',sourceHash,ruleset:'original-v3-preview-1',scope:'First five prototype foundation; not complete redesign',
 checks:{game:{passed:true,tests:560,additionalSimulationTests:3,designValidation:true,typecheck:true},productionBuild:true,privateWorkerBuild:true,
 liveTeamfight:{path:teamfightPath,seconds:40,ticks:1200,actors:10,prototypeKits:5,groupings:[1,4],renderedComparison:true,exact:true,counters:teamfight.runs[0].world.counters},
 normalBaseline:{path:baselinePath,exactFingerprint:true,finished:true,second:baseline.result.second,winner:baseline.result.winner},
 releaseReadiness:{ready:false,expectedExitCode:1,prototypeHandlers:5,missingHandlers:40,unqualifiedAvatars:45,formalIdentityManifestSupplied:false}},
 inspectedPreview:'docs/avatar-rework/v3-styled-preview-20261023.png',
 visualFindings:['Explicit five-prototype and legacy-art labels visible','Both Mirelle selectors expose ten pages','Center-lane labels overlap; readability unqualified','Private paused fixture HUD is not synchronized to manual stepping; actual tick metadata is recorded'],
 remaining:['Forty V3 kits have no handlers','Five prototypes still need full mechanic/AI/counterplay qualification','Mirelle radial and group UI, detailed decoy animation and live Garruk bridge interaction','Saved V3 replay restoration and complete manual input journal','New production assets, rigs and animation timing','Every-hero counteraction and cross-kit/boss matrices','Full natural V3 matches and 500+/1000-match balance studies','Online rollout and compatible ML training/evaluation'],artifacts};
await writeFile(new URL('docs/avatar-rework/verification-20261023.json',root),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({sourceHash,tests:560,liveParity:true,baselineExact:true,releaseReady:false}));
