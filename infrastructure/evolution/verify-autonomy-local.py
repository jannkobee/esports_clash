"""Disposable, network-isolated verification. /input readonly, /output new empty folder."""
import json
import os
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
from marl import Learner
learner=Learner(47)
with (out/'actor.json').open('x') as file:json.dump(learner.export(),file)
subprocess.run(['node','--experimental-strip-types',str(repo/'infrastructure/evolution/verify-autonomy.mjs'),str(out)],cwd=web,check=True,timeout=6000)
episode=json.loads((out/'self-play.json').read_text());metrics=learner.update([episode])
learner.save(out/'checkpoint.pt',{'fixture':'known-seed47','source':'current-copy'})
restored=Learner(99);restored.load(out/'checkpoint.pt',{'fixture':'known-seed47','source':'current-copy'})
assert restored.export()==learner.export()
with (out/'ppo-update.json').open('x') as file:json.dump({'metrics':metrics,'checkpointRestored':True,'freshBenefitEvidence':False},file,indent=2)
print(json.dumps(metrics),flush=True)
