from pathlib import Path
import json,re
root=Path.cwd()
spec=Path(r'C:\Users\User\.codex\attachments\0322ca9f-a333-4b8f-bbfa-a66117a9cb0b\Pasted text.txt').read_text(encoding='utf-8-sig')
tables=[]
for section in [6,7,8]:
    part=spec.split(f'# {section}.',1)[1].split('\n# ',1)[0]
    tables.append([[c.strip() for c in line.strip().strip('|').split('|')] for line in part.splitlines() if re.match(r'\|\s*\d+\s*\|',line)])
catalog={'version':4,'temperaments':['VOLATILE','STEADY','ICE_COLD'],'playstyles':['PASSIVE','BALANCED','AGGRESSIVE'],'mindsets':['INDIVIDUALIST','TEAM_FIRST'],'decisionStyles':['INSTINCTIVE','METHODICAL','ADAPTIVE'],'tPositions':['T_IGL','T_ENTRY','T_SUPPORT','T_LURKER','T_FLEX'],'ctPositions':['CT_IGL','CT_ROTATOR','CT_ANCHOR_A','CT_ANCHOR_B','CT_FLEX'],'profiles':[]}
for i,row in enumerate(tables[0]):
    catalog['profiles'].append({'id':int(row[0]),'name':row[4],'t':dict(zip(catalog['tPositions'],tables[1][i][1:])),'ct':dict(zip(catalog['ctPositions'],[tables[2][i][1],tables[2][i][2],tables[2][i][3],tables[2][i][3],tables[2][i][4]]))})
assert len(catalog['profiles'])==18
path=root/'EsportsClash.Api/resources/fps-player-architecture-v4.json'
path.write_text(json.dumps(catalog,indent=2)+'\n',encoding='utf-8')
