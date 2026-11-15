import {readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const options=process.argv.slice(2);
if(options.some(option=>option!=='--soak'))throw new Error('Usage: node scripts/test-fps-baseline.mjs [--soak]');
const root=fileURLToPath(new URL('../',import.meta.url));
const files=readdirSync(new URL('../src/',import.meta.url)).filter(name=>/^fps.*\.test\.mjs$/.test(name)).sort();
// Future FPS suites join automatically; deleted critical coverage fails loudly.
const required=['fpsSimulationBaseline','fpsLiveCombatDecisions','fpsLiveCallerDecisions','fpsLiveEconomyDecisions','fpsLiveUtilityDecisions',
  'fpsLiveLineupDecisions','fpsLiveGrenadeIndex','fpsLiveRouting','fpsLiveAutonomy','fpsBroadcastDirector','fpsLiveRenderPerformance',
  'fpsLivePlanting','fpsSmokeLineupIntegration','fpsIdentity','fpsSkillProfile','fpsProTacticsRegression'];
for(const name of required)if(!files.includes(`${name}.test.mjs`))throw new Error(`Missing baseline domain: ${name}`);
const env={...process.env,...(options.includes('--soak')?{FPS_BASELINE_STEPS:'18000',FPS_BASELINE_SEEDS:'17,42,1337'}:{})};
const run=args=>{
  const result=spawnSync(process.execPath,args,{cwd:root,env,stdio:'inherit'});
  if(result.error)throw result.error;
  if(result.status!==0)process.exit(result.status??1);
};
console.log(`Strict FPS baseline: ${files.length} discovered suites; ${options.includes('--soak')?'extended three-seed replay':'standard paired replay'}.`);
run(['scripts/sync-fps-player-architecture.mjs','--check']);
run(['scripts/validate-design.js']);
run(['--experimental-strip-types','--test',...files.map(name=>`src/${name}`)]);
run(['node_modules/typescript/bin/tsc','-b','--pretty','false']);
