from pathlib import Path
import re
base=Path('EsportsClash.Web/src')
mapping={'lan':'rifling','tf':'entry','iq':'positioning','clu':'sniping','sta':'utility','flx':'utility','ldr':'shotcalling'}
for p in [*base.rglob('*.ts'),*base.rglob('*.tsx'),*base.glob('*.test.mjs')]:
 if p.name in ['fpsSkillProfile.ts','fpsPlayerArchitecture.ts']:continue
 s=p.read_text(encoding='utf-8')
 s=re.sub(r',\s*flx\s*:\s*[^,}\n]+(?=[,}])','',s)
 for a,b in mapping.items():s=re.sub(r'\b'+a+r'\b',b,s)
 s=s.replace('*(1-(effect?.executionBonus??0))','')
 p.write_text(s,encoding='utf-8')
p=base/'fps/fpsSkillProfile.ts';p.write_text(Path('tmp/fpsSkillProfile.new.ts').read_text(encoding='utf-8'),encoding='utf-8')
p=base/'fps/fpsDetailedExecution.ts';s=p.read_text(encoding='utf-8').replace('type FpsAbility,','type FpsExecutionChannel,').replace('key:FpsAbility','key:FpsExecutionChannel');p.write_text(s,encoding='utf-8')
p=base/'fps/fpsLiveSimulation.ts';s=p.read_text(encoding='utf-8').replace('type FpsAbility }','type FpsAbility, type FpsExecutionChannel }').replace('key:FpsAbility,legacy','key:FpsExecutionChannel,legacy').replace('fpsAbilityUnit(p.profile,key)','fpsAbilityUnit(p.profile,key,LIVE_WEAPONS[p.weapon].category===\'sniper\')').replace('skillProfile?:{version:1','skillProfile?:{version:2');p.write_text(s,encoding='utf-8')
