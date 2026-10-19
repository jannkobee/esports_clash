"""Installation/import evidence only. Does not construct a model or rig an avatar."""
import json
import sys
from pathlib import Path
import warnings
warnings.filterwarnings('ignore',category=FutureWarning)
sys.path.insert(0,'/opt/UniRig')
import torch
import flash_attn
import spconv.pytorch
import torch_scatter
import torch_cluster
import bpy
from src.model.parse import get_model
from src.data.extract import extract_builtin
from service import engine, ROOT

report={'status':'passed','engine_sha256':engine(),'torch':torch.__version__,'cuda_runtime':torch.version.cuda,
    'flash_attention':flash_attn.__version__,'blender':bpy.app.version_string,
    'scope':'Native imports only; no model construction, CUDA inference, avatar generation or output qualification.'}
ROOT.mkdir(exist_ok=True,parents=True)
(ROOT/'runtime.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report))
