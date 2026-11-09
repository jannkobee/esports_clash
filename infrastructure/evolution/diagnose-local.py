"""Run in a disposable runner image, repo mounted read-only at /input.

Only /output receives new evidence. No services, model registry or durable study
volumes are written. The image's node_modules remain in its disposable layer.
"""
import shutil
import subprocess
from pathlib import Path

repo = Path('/input')
web = Path('/workspace/EsportsClash.Web')
for name in ('src', 'scripts'):
    shutil.rmtree(web / name)
    shutil.copytree(repo / 'EsportsClash.Web' / name, web / name)
for name in ('evolution.html', 'evolution-compiled.html', 'vite.evolution.config.ts'):
    shutil.copy2(repo / 'EsportsClash.Web' / name, web / name)
shutil.copy2(repo / 'infrastructure/evolution/live-baseline.mjs', web / 'scripts/live-baseline.mjs')
subprocess.run(['node', 'node_modules/vite/bin/vite.js', 'build', '--config', 'vite.evolution.config.ts'], cwd=web, check=True)
subprocess.run(['node', 'scripts/live-baseline.mjs', '/output/ml-intelligence-live-baseline-20261023.json'], cwd=web, check=True, timeout=1900)
