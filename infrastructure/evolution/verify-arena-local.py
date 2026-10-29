"""Isolated actual-engine verification; known fixtures never establish benefit."""
import json
import shutil
import subprocess
import sys
from pathlib import Path
repo=Path('/input');web=Path('/workspace/EsportsClash.Web');out=Path('/output')
for name in ('src','scripts'):
    shutil.rmtree(web/name);shutil.copytree(repo/'EsportsClash.Web'/name,web/name)
for name in ('evolution.html','evolution-compiled.html','vite.evolution.config.ts'):
    shutil.copy2(repo/'EsportsClash.Web'/name,web/name)
subprocess.run(['node','node_modules/vite/bin/vite.js','build','--config','vite.evolution.config.ts'],cwd=web,check=True)
sys.path.insert(0,str(repo/'infrastructure/evolution/runner'))
from arena_marl import ArenaLearner
foundation=json.loads((web/'src/data/arena-v3/arenaFoundation.json').read_text())
def episode(label,**options):
    item={'seed':47,'draft':2,'swapped':False,'controller':'arena','maxSeconds':120,'wallSeconds':900,**options}
    request=out/(label+'.request.json');request.write_text(json.dumps(item))
    subprocess.run(['node',str(repo/'infrastructure/evolution/episode-host.mjs'),str(request),str(out/(label+'.json'))],cwd=web,check=True,timeout=1000)
    return json.loads((out/(label+'.json')).read_text())
def verify_terminal():
    toy={'kind':'arena-actor','version':1,'input':48,'hidden':32,'w1':[[0.]*48 for _ in range(32)],'b1':[0.]*32,'w2':[0.]*32,'b2':0.}
    toy['w1'][0][24]=20.;toy['w1'][1][36]=20.;toy['w2'][0]=toy['w2'][1]=20.
    terminal=episode('terminal-edge',policies={'blue':toy,'red':toy},training=True,terminalFixture=True,maxSeconds=30)
    assert terminal['episode']['status']=='terminal' and terminal['episode']['result']['winner']=='blue'
    assert any(r['terminal'] and r['elapsed']==0 for r in terminal['rows'])
    assert all(r['terminal'] and r['executed'] for r in terminal['rows'])
    edge_learner=ArenaLearner(48);edge_learner.initialize_actor(toy)
    edge_metrics=edge_learner.update([terminal]);assert edge_metrics['updated']
    with (out/'terminal-edge-proof.json').open('x') as file:json.dump({'terminal':True,'sameTickRows':sum(r['elapsed']==0 for r in terminal['rows']),
        'metrics':edge_metrics,'synthetic_engineering_fixture':True,'fresh_benefit_evidence':False},file,indent=2)
    print(json.dumps(edge_metrics),flush=True)

if '--terminal-only' in sys.argv:
    verify_terminal();sys.exit(0)

control=episode('control',policies={'blue':foundation,'red':foundation})
repeat=episode('repeat',policies={'blue':foundation,'red':foundation})
assert control['episode']['states']==repeat['episode']['states'],'Repeated greedy worlds diverged'
assert control['episode']['learning']['decisions']>0
training=episode('self-play',policies={'blue':foundation,'red':foundation},training=True,maxSeconds=1200,compactTrajectories=True,learningTeam='blue')
assert training['rows'] and all('features_b64' in r for r in training['rows'])
learner=ArenaLearner(47);learner.initialize_actor(foundation);metrics=learner.update([training])
assert metrics['updated'] and learner.export()!=foundation
learner.save(out/'checkpoint.pt',{'fixture':'known-47','purpose':'engineering-only'})
restored=ArenaLearner(99);restored.load(out/'checkpoint.pt',{'fixture':'known-47','purpose':'engineering-only'})
assert learner.export()==restored.export()
trained=episode('trained-inference',policies={'blue':restored.export(),'red':foundation})
influence=trained['episode']['states']!=control['episode']['states']
full=episode('full-control',maxSeconds=1200,policies={'blue':foundation,'red':foundation})
assert full['episode']['status'] in ('terminal','censored'),'Full control interrupted'
evidence={'known_fixture':True,'fresh_benefit_evidence':False,'repeated_controls_match':True,
          'full_match_terminal':full['episode']['status']=='terminal','full_match_status':full['episode']['status'],
          'full_match_second':full['episode']['second'],
          'checkpoint_restored':True,'metrics':metrics,'trained_greedy_world_changed':influence,
          'control_commands':control['episode']['learning'],'trained_commands':trained['episode']['learning']}
with (out/'verification.json').open('x') as file:json.dump(evidence,file,indent=2)
print(json.dumps(evidence),flush=True)

verify_terminal()
