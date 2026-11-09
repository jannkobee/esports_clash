"""Disposable container only; source read-only /input, new evidence at /output."""
import shutil
import subprocess
import sys
from pathlib import Path
repo=Path('/input')
web=Path('/workspace/EsportsClash.Web')
for name in ('src','scripts'):
    shutil.rmtree(web/name)
    shutil.copytree(repo/'EsportsClash.Web'/name,web/name)
for name in ('evolution.html','evolution-compiled.html','vite.evolution.config.ts'):
    shutil.copy2(repo/'EsportsClash.Web'/name,web/name)
# Preserve relative imports and execute trusted source from the read-only mount.
subprocess.run(['node','node_modules/vite/bin/vite.js','build','--config','vite.evolution.config.ts'],cwd=web,check=True)
if '--influence' in sys.argv:
    args=[str(repo/'infrastructure/evolution/verify-strategy-influence.mjs'),
          '/output/ml-intelligence-final-baseline-20261023.json', '/output/ml-intelligence-strategy-influence-20261023.json']
else:
    args=[str(repo/'infrastructure/evolution/verify-strategy-baseline.mjs'), '/output/ml-intelligence-final-baseline-20261023.json']
subprocess.run(['node','--experimental-strip-types',*args],cwd=web,check=True,timeout=3000)
