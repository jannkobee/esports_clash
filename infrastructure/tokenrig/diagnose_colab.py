"""Native Colab import/engine diagnostic; performs no avatar inference."""
import hashlib
import json
import os
from pathlib import Path
import sys

ROOT = Path('/content/teamfight-preparation')
TOOLS = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / 'SkinTokens'))
os.chdir(ROOT / 'SkinTokens')
os.environ.update(OMP_NUM_THREADS='2', OPENBLAS_NUM_THREADS='2', WANDB_MODE='disabled',
                  GRADIO_ANALYTICS_ENABLED='False', HF_HUB_OFFLINE='1')
import torch
import bpy
import demo

if not os.environ.get('COLAB_RELEASE_TAG') or not torch.cuda.is_available() or torch.cuda.get_device_capability()[0] != 7:
    raise RuntimeError('The pinned T4 Google Colab profile is required.')
from cloud_service import engine, canonical, sha

report = {'status': 'passed', 'engine_sha256': sha(canonical(engine())),
          'diagnostic_sha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
          'torch': torch.__version__, 'cuda': torch.version.cuda, 'blender': bpy.app.version_string,
          'model_choices': len(demo.MODEL_CKPTS), 'publication_eligible': False,
          'scope': 'Native imports and pinned runtime only. No model construction, rig inference or deformation qualification.'}
(ROOT / 'runtime.json').write_text(json.dumps(report, indent=2))
print(json.dumps(report))
