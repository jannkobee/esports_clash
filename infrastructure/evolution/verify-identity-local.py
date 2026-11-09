"""Known-fixture engineering proof. Never a held-out improvement experiment."""
import json
import subprocess
import sys
from pathlib import Path

sys.path.insert(0,'/runner')
from arena_marl import ArenaLearner
web=Path('/workspace/EsportsClash.Web');out=Path('/output')
outcome_mode='--outcomes' in sys.argv
foundation=json.loads((web/('src/data/arena-v6/arenaFoundation.json' if outcome_mode else 'src/data/arena-v5/arenaFoundation.json')).read_text())
reward_version='terminal-potential-outcomes-v2' if outcome_mode else 'terminal-potential-v1'
critic_inputs=7 if outcome_mode else 6
assert foundation['version']==3 and foundation['input']==224
def episode(label,**options):
    item={'seed':47,'draft':2,'swapped':False,'controller':'arena','maxSeconds':60,'wallSeconds':900,
          'policies':{'blue':foundation,'red':foundation},**options}
    request=out/(label+'.request.json');request.write_text(json.dumps(item))
    result=out/(label+'.json')
    subprocess.run(['node','/workspace/infrastructure/evolution/episode-host.mjs',str(request),str(result)],cwd=web,check=True,timeout=1000)
    return json.loads(result.read_text())

def verify_terminal():
    assert outcome_mode
    toy={'kind':'arena-actor','version':3,'input':224,'hidden':32,'w1':[[0.]*224 for _ in range(32)],
         'b1':[0.]*32,'w2':[0.]*32,'b2':0.}
    toy['w1'][0][24]=20.;toy['w1'][1][36]=20.;toy['w2'][0]=toy['w2'][1]=20.
    terminal=episode('terminal',training=True,maxSeconds=30,terminalFixture=True,policies={'blue':toy,'red':toy})
    assert terminal['episode']['status']=='terminal'
    assert any(r['terminal'] and r['elapsed']==0 and abs(r['components']['outcome'])==5 for r in terminal['rows'])
    winner=ArenaLearner(49,224,3,reward_version);winner.initialize_actor(toy)
    terminal_metrics=winner.update([terminal]);assert terminal_metrics['updated']
    with (out/'terminal-verification.json').open('x') as f:json.dump({'synthetic_engineering_fixture':True,
        'fresh_benefit_evidence':False,'metrics':terminal_metrics,'exact_same_tick_outcome':5},f,indent=2)
    print(json.dumps({'terminal_verified':True,'transitions':terminal_metrics['transitions']}),flush=True)

if '--terminal-only' in sys.argv:
    verify_terminal();sys.exit(0)

control=episode('control');repeat=episode('repeat')
assert control['episode']['states']==repeat['episode']['states']
assert control['episode']['learning']['decisions']>0
training=episode('training',training=True,maxSeconds=120,compactTrajectories=True,learningTeam='blue')
assert training['episode']['status'] in ('censored','terminal') and training['rows']
assert all(r['identity']['avatarId'] and r['identity']['cardId'] and len(r['state'])==critic_inputs for r in training['rows'])
assert all('mastery' in r['components'] and ('features_b64' in r or 'features_zlib_b64' in r) for r in training['rows'])
assert all(r['components']['mastery']==0 and 'masteryPotential' not in r for r in training['rows'])
learner=ArenaLearner(47,224,3,reward_version);learner.initialize_actor(foundation);metrics=learner.update([training])
assert metrics['updated'] and learner.export()!=foundation
learner.save(out/'checkpoint.pt',{'fixture':'known-47','purpose':'identity-engineering'})
restored=ArenaLearner(48,224,3,reward_version);restored.load(out/'checkpoint.pt',{'fixture':'known-47','purpose':'identity-engineering'})
assert restored.export()==learner.export()
trained=episode('trained',policies={'blue':learner.export(),'red':foundation})
evidence={'kind':'identity-engineering-only','seed':47,'fresh_benefit_evidence':False,
          'repeated_controls_match':True,'checkpoint_restored':True,'observation_size':224,'critic_size':critic_inputs,'avatar_specific_rewards':False,
          'training_status':training['episode']['status'],'training_seconds':training['episode']['second'],
          'metrics':metrics,'greedy_world_changed':control['episode']['states']!=trained['episode']['states'],
          'control_commands':control['episode']['learning'],'trained_commands':trained['episode']['learning']}
with (out/'verification.json').open('x') as f:json.dump(evidence,f,indent=2)
print(json.dumps(evidence),flush=True)
if outcome_mode:
    verify_terminal()
