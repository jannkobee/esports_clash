"""Colab equivalence diagnostic, including actual exported morph/skin poses."""
import os,sys,time,json,hashlib
from pathlib import Path
import bpy,numpy as np
from review_generated_rig import load,surface
from evaluated_points import world_points
root=Path(sys.argv[1]).resolve()
if not os.environ.get('COLAB_RELEASE_TAG'):raise RuntimeError('Colab required')
asset=root/'contour-diagnostic.glb';rigs,meshes=load(asset);rows=[]
for frame in [0,30,126,210]:
    sample=frame*bpy.context.scene.render.fps/30;bpy.context.scene.frame_set(int(sample),subframe=sample-int(sample))
    start=time.monotonic();old=np.array(surface(meshes)[0]);old_time=time.monotonic()-start
    start=time.monotonic();new=world_points(meshes);new_time=time.monotonic()-start
    rows.append({'source_frame_30fps':frame,'identical':bool(np.array_equal(old,new)),'maximum_error':float(abs(old-new).max()),'full_surface_seconds':old_time,'points_only_seconds':new_time})
    if not np.array_equal(old,new):raise ValueError('Point evaluator differs')
r={'compute':'google','publication_eligible':False,'qualification_complete':False,'sha256':hashlib.sha256(asset.read_bytes()).hexdigest(),
   'helper_sha256':hashlib.sha256((Path(__file__).parent/'evaluated_points.py').read_bytes()).hexdigest(),'samples':rows,
   'scope':'Coordinate equivalence in four actual exported poses only; no new export or performance admission claimed.'}
(root/'point-evaluator-equivalence.json').write_text(json.dumps(r,indent=2));print(json.dumps(r))
