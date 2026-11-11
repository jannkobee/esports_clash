"""Isolated runtime diagnostic; never creates an API fixture or settles careers."""
import hashlib
import json
import os
import time
import urllib.request
import uuid
import subprocess
from pathlib import Path

catalog = json.loads(Path('/online/catalog.json').read_text())
simulation_version = int(os.environ.get('FPS_DIAGNOSTIC_VERSION', '2'))
manifest = json.loads(Path('/online/manifest.json').read_text())
match_id = str(uuid.uuid4())
slots = [{'instance_id': str(uuid.uuid4()), 'card_id': card['id']} for card in catalog['cards'][:10]]
plan = {
    'schema': 1, 'match_id': match_id, 'mode': 'normal', 'game_mode': 'fps_mr15_v1', 'seed': 410337,
    'fps': {'format': 'MR15_TACTICAL_FPS', 'rules_version': 1, 'simulation_version': simulation_version, 'map_id': 'breakwater'},
    'versions': {k: manifest[k] for k in ('catalog_version', 'rules_version', 'policy_version', 'observation_version')},
    'blue': slots[:5], 'red': slots[5:], 'player_profile_schema': 0,
    'player_identities': {slot['instance_id']: f'RuntimeCheck{i+1}' for i, slot in enumerate(slots)},
}
if simulation_version == 3:
    source = """
import {FPS_IDENTITY_PERSONALITIES,FPS_SPECIALTIES,generatePlayerDNA} from './src/fps/index.ts';
let input='';for await(const chunk of process.stdin)input+=chunk;
const ids=JSON.parse(input),plan={tempo:.5,structure:.5,aggression:.5,preparation:.5,freedom:.5,economy:.5};
const coach={tempo:.5,rigidity:.5,aggression:.5,preparation:.5,freedom:.5,economy:.5,communication:.5,leadership:.5,adaptability:.5,development:.5};
const chemistry={trust:.5,communication:.5,understanding:.5,leadershipAcceptance:.5,roleCompetition:.5};
const players=Object.fromEntries(ids.map((id,i)=>[id,{id,personality:FPS_IDENTITY_PERSONALITIES[i%24],specialty:FPS_SPECIALTIES[i%21],intensity:.7,dna:generatePlayerDNA(id),roleSuitability:.5,familiarity:.2}]));
console.log(JSON.stringify({players,teams:{blue:{coach,plan,chemistry},red:{coach,plan,chemistry}}}));
"""
    generated = subprocess.run(['node','--experimental-strip-types','--input-type=module','-e',source], input=json.dumps([s['instance_id'] for s in slots]), text=True, capture_output=True, check=True, cwd='/workspace/EsportsClash.Web')
    plan['fps_identity'] = json.loads(generated.stdout)
allocation = {'plan': plan, 'plan_hash': hashlib.sha256(json.dumps(plan, sort_keys=True).encode()).hexdigest()}
headers = {'Authorization': 'Bearer '+os.environ['ONLINE_WORKER_TOKEN'], 'Content-Type': 'application/json'}
url = 'http://127.0.0.1:8092/matches/'+match_id
request = urllib.request.Request(url, data=json.dumps(allocation).encode(), headers=headers, method='POST')
with urllib.request.urlopen(request, timeout=10) as response:
    assert response.status in (200, 202)
for _ in range(30):
    with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=5) as response:
        state = json.load(response)
    if state['status'] in ('completed', 'failed'):
        break
    time.sleep(.5)
assert state['status'] == 'completed', state.get('error', state['status'])
report = state['result']['report']
assert report['simulationVersion'] == simulation_version and len(report['playerStats']) == 10
assert 'identityExperiment' not in report and 'identityDevelopment' not in report
assert report['finalScore'][report['winnerTeam']] >= 16
for player in report['playerStats'].values():
    kills = [e for e in report['events'] if e['type'] in ('kill', 'trade_kill') and e.get('actorId') == player['playerId']]
    assert player['kills'] == len(kills)
print(json.dumps({'diagnostic_only': True, 'match_id': match_id, 'simulation_version': simulation_version,
                  'rounds': report['totalRounds'], 'score': report['finalScore'], 'event_derived_kills': True,
                  'official_fixture_created': False, 'career_settlement': False}))
