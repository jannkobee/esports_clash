"""Replay the retained failed serialization case under the new reward source.
Known failure-reproduction world: excluded from fresh qualification evidence.
"""
import hashlib
import json
import subprocess
import sys
from pathlib import Path
sys.path.insert(0,'/runner')
from arena_marl import ArenaLearner
out=Path('/output');request=out/'reproduced.request.json';result=out/'reproduced.json'
item=json.loads(request.read_text());assert item['seed']==63004 and item['maxSeconds']==1200
subprocess.run(['node','/workspace/infrastructure/evolution/episode-host.mjs',str(request),str(result)],
               cwd='/workspace/EsportsClash.Web',check=True,timeout=1000)
raw=json.loads(result.read_text());assert raw['episode']['status'] in ('terminal','censored') and raw['rows']
assert all(r.get('feature_encoding')=='float32le-zlib-v1' and 'features_zlib_b64' in r for r in raw['rows'])
learner=ArenaLearner(63004,224,3,'terminal-potential-outcomes-v2');learner.initialize_actor(item['policies'][item['learningTeam']])
metrics=learner.update([raw]);assert metrics['updated']
metadata={'purpose':'known-failure-reproduction','request_sha256':hashlib.sha256(request.read_bytes()).hexdigest()}
learner.save(out/'restored-full-match.pt',metadata)
restored=ArenaLearner(63005,224,3,'terminal-potential-outcomes-v2');restored.load(out/'restored-full-match.pt',metadata)
assert learner.export()==restored.export()
evidence={'kind':'known-failed-case-reproduction','seed':63004,'fresh_benefit_evidence':False,
 'request_sha256':metadata['request_sha256'],'status':raw['episode']['status'],'seconds':raw['episode']['second'],
 'json_bytes':result.stat().st_size,'compressed_rows':len(raw['rows']),'metrics':metrics,'checkpoint_restored':True,
 'raw_sha256':hashlib.sha256(result.read_bytes()).hexdigest()}
with (out/'long-verification.json').open('x') as f:json.dump(evidence,f,indent=2)
print(json.dumps(evidence),flush=True)
