from pathlib import Path
import re
b=Path('EsportsClash.Web/src')
p=b/'components/FpsSimulationLab.tsx';s=p.read_text(encoding='utf-8').replace("const [experimental,setExperimental]=useState(true),[blueSystem,setBlueSystem]", "const [blueSystem,setBlueSystem]").replace('experimental?{identityExperiment}:{}','{identityExperiment}')
s=re.sub(r'<label className="fps-lab__identity-toggle">.*?</label>','',s)
s=s.replace('{experimental&&<div className="fps-lab__identity-panel">','<div className="fps-lab__identity-panel">').replace('</div>}<p className="fps-lab__playback-note">','</div><p className="fps-lab__playback-note">')
p.write_bytes(s.replace('\r\n','\n').encode('utf-8'))
for name in ['fps/fpsSkillProfile.ts','fps/fpsLiveSimulation.ts','fpsSkillProfile.test.mjs']:
 p=b/name;s=p.read_text(encoding='utf-8').replace('estimateLegacyFpsSkillProfile','fpsSkillProfileFromAttributes');p.write_bytes(s.replace('\r\n','\n').encode('utf-8'))
p=Path('EsportsClash.Api/app/Services/WorldPlayerProfiles.php');s=p.read_text(encoding='utf-8').replace("if (Schema::hasTable('fps_player_identities'))", "if (app(FpsIdentityEngine::class)->ready())");p.write_bytes(s.replace('\r\n','\n').encode('utf-8'))
p=Path('EsportsClash.Api/app/Http/Controllers/Api/V1/FpsIdentityController.php');s=p.read_text(encoding='utf-8').replace("Schema::hasTable('fps_player_identities')", "app(\\App\\Services\\FpsIdentityEngine::class)->ready()");p.write_bytes(s.replace('\r\n','\n').encode('utf-8'))
# Older runtime verification helpers now construct the same v4 model as the app.
p=Path('infrastructure/online/verify-fps-runtime.py');s=p.read_text(encoding='utf-8').replace('FPS_IDENTITY_PERSONALITIES,FPS_SPECIALTIES,generatePlayerDNA','FPS_IDENTITY_PERSONALITIES,FPS_T_POSITIONS,FPS_CT_POSITIONS,generatePlayerDNA').replace('FPS_IDENTITY_PERSONALITIES[i%24],specialty:FPS_SPECIALTIES[i%21],intensity:.7,', 'FPS_IDENTITY_PERSONALITIES[i%54],assignments:{t:FPS_T_POSITIONS[i%5],ct:FPS_CT_POSITIONS[i%5]},');p.write_bytes(s.replace('\r\n','\n').encode('utf-8'))
# Strip only the trailing whitespace introduced by this pass.
for name in ['Dockerfile','Dockerfile.identities']:
 p=Path('infrastructure/online')/name;p.write_bytes(p.read_bytes().rstrip()+b'\n')
