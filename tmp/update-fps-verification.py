from pathlib import Path
import re,json
b=Path('EsportsClash.Web/src')
p=b/'fpsReference.test.mjs';s=p.read_text(encoding='utf-8');s=re.sub(r"import \{FPS_PERSONALITIES,FPS_PERSONALITY_CATEGORIES\}.*\n|import \{PERSONALITY_IDS\}.*\n",'',s);s=re.sub(r"  assert.deepEqual\(fpsReferenceEntries\('legacyPersonalities'\).*\n",'',s);s=re.sub(r'  for\(const trait of Object.values\(FPS_PERSONALITIES\)\).*\n','',s);a=s.index("test('leadership");z=s.index("test('every FPS directory",a);s=s[:a]+s[z:];s=s.replace("  assert.ok(searchFpsReference('morale').some(x=>x.href==='#hexapedia/legacyPersonalities/captain'));", "  assert.equal(fpsReferenceEntries('personalities').length,54);assert.equal(fpsReferenceEntries('roles').length,10);assert.equal(fpsReferenceEntries('attributes').length,6);")
s=s.replace("searchFpsReference('sniper').some(x=>x.href.startsWith('#hexapedia/roles/'))","searchFpsReference('Anchor').some(x=>x.href.startsWith('#hexapedia/roles/'))");p.write_text(s,encoding='utf-8')
for p in [Path('infrastructure/automatic-learning/fixtures.mjs'),Path('EsportsClash.Web/scripts/benchmark-live-fps.mjs')]:
 s=p.read_text(encoding='utf-8');path='../../EsportsClash.Web/src/fps/fpsPlayerArchitecture.ts' if 'fixtures' in p.name else '../src/fps/fpsPlayerArchitecture.ts';s=f"import {{FPS_T_POSITIONS,FPS_CT_POSITIONS}} from '{path}';\n"+s
 s=re.sub(r'stats:\{lan:(\d+),iq:\d+,tf:\d+,clu:\d+,sta:\d+,flx:\d+,ldr:\d+\}',lambda m:'stats:{'+','.join(k+':'+m[1] for k in ['rifling','sniping','entry','utility','positioning','shotcalling'])+'}',s)
 s=s.replace('id:p.id,personality:','id:p.id,assignments:{t:FPS_T_POSITIONS[i%5],ct:FPS_CT_POSITIONS[i%5]},personality:');p.write_text(s,encoding='utf-8')
for name in ['Dockerfile','Dockerfile.identities']:
 p=Path('infrastructure/online')/name;s=p.read_text(encoding='utf-8');s+='\nCOPY EsportsClash.Api/resources/fps-player-architecture-v4.json /workspace/EsportsClash.Api/resources/fps-player-architecture-v4.json\n';p.write_text(s,encoding='utf-8')
p=b/'fpsOnlineWorker.test.mjs';s=p.read_text(encoding='utf-8');s="import {createFpsIdentityContext} from './fps/fpsIdentityMatch.ts';\n"+s;s=s.replace("fps: { format: 'MR15_TACTICAL_FPS', rules_version: 1, map_id:","fps: { format: 'MR15_TACTICAL_FPS', simulation_version:4,rules_version: 1, map_id:")
needle="  await writeFile(resolve(folder, 'allocation.json')";i=s.index(needle);s=s[:i]+"  const playerCards=slots.map((slot,i)=>({...selected[i],id:slot.instance_id}));plan.fps_identity=createFpsIdentityContext(playerCards.slice(0,5),playerCards.slice(5));\n"+s[i:];p.write_text(s,encoding='utf-8')
# Replace old backend assertions with v4 requirements while retaining privacy, ownership and idempotency checks.
p=Path('EsportsClash.Api/tests/Feature/FpsIdentityTest.php');s=p.read_text(encoding='utf-8').replace('assertSame(3,','assertSame(4,').replace("'simulationVersion'=>3","'simulationVersion'=>4")
s=s.replace("['role'=>'lurker','instruction'=>'hold','training'=>'sniper']","['t'=>'T_LURKER','ct'=>'CT_ROTATOR','instruction'=>'hold','training'=>'sniping']").replace(".'.role','lurker'",".'.t','T_LURKER'")
s=s.replace("$this->assertSame($before->personality_id,$after->personality_id);$this->assertSame($before->specialty_id,$after->specialty_id);","$this->assertSame($before->personality,$after->personality);")
s=s.replace("$identity->personality_id", "json_decode($identity->personality,true)['id']").replace("$row['fpsIdentity']['personality_id']","$row['fpsIdentity']['personality']['id']")
s=s.replace("collect(FpsIdentityProfiles::PERSONALITIES)->first(fn($id)=>$id!==json_decode($identity->personality,true)['id'])", "collect(app(\\App\\Services\\FpsPlayerArchitecture::class)->personalities())->pluck('id')->first(fn($id)=>$id!==json_decode($identity->personality,true)['id'])")
p.write_text(s,encoding='utf-8')
p=b/'components/FpsTacticalSystemEditor.tsx';s=p.read_text(encoding='utf-8').replace('FPS_T_POSITIONS,FPS_CT_POSITIONS','FPS_ABILITIES_PLACEHOLDER,FPS_T_POSITIONS,FPS_CT_POSITIONS');s=s.replace('FPS_ABILITIES_PLACEHOLDER,','');s="import {FPS_ABILITIES,FPS_ABILITY_LABELS} from '../fps/fpsSkillProfile';\n"+s
s=s.replace('{FPS_ROLES.map(role=><option key={role.id} value={role.id}>{role.name} familiarity</option>)}','{FPS_ABILITIES.map(key=><option key={key} value={key}>{FPS_ABILITY_LABELS[key]} practice</option>)}');p.write_text(s,encoding='utf-8')
# Actual weapon mechanics, rather than an assigned identity name, determine sniper handling.
p=b/'fps/fpsLiveSimulation.ts';s=p.read_text(encoding='utf-8').replace("p.role==='sniper'","LIVE_WEAPONS[p.weapon].category==='sniper'");p.write_text(s,encoding='utf-8')
# Remove retired badge display code and imports entirely.
for p in (b/'components').glob('*.tsx'):
 if p.name=='PersonalityMarks.tsx':continue
 s=p.read_text(encoding='utf-8');s=re.sub(r"import \{[^\n]*\} from './PersonalityMarks';\n",'',s);p.write_text(s,encoding='utf-8')
p=b/'components/PersonalityMarks.tsx';p.unlink()
# Normalize touched source line endings to the repository's LF convention.
for folder,pattern in [(b,'*.ts*'),(b,'*.test.mjs'),(Path('EsportsClash.Api/app'),'*.php')]:
 for p in folder.rglob(pattern):
  data=p.read_bytes();p.write_bytes(data.replace(b'\r\n',b'\n'))
