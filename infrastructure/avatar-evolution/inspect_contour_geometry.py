"""Independent Colab collision/stretch review of the retained sculpt surfaces."""
import hashlib,json,os,sys
from pathlib import Path
import numpy as np
import bpy
from mathutils import Vector
from review_generated_rig import load,surface
from mesh_validation import collision_summary,rest_keys
from asset_pipeline.edge_deformation import edge_deformation
root=Path(sys.argv[1]).resolve()
if not os.environ.get('COLAB_RELEASE_TAG'):raise RuntimeError('Colab required')
r=json.loads((root/'visual-report.json').read_text());artifact=root/'hip-sculpt.npz'
if hashlib.sha256(artifact.read_bytes()).hexdigest()!=r['sculpt_artifact']['sha256']:raise ValueError('Sculpt bytes changed')
rigs,meshes=load(root/'raw.glb');rest,faces,regions=surface(meshes);data=np.load(artifact);keys=rest_keys(rest)
if np.linalg.norm(np.array(rest)-data['rest_positions'],axis=1).max()>1e-8:raise ValueError('Source correspondence changed')
out={'id':r['id'],'compute':'google','publication_eligible':False,'qualification_complete':False,
 'inspector_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
 'visual_report_sha256':hashlib.sha256((root/'visual-report.json').read_bytes()).hexdigest(),'poses':[],
 'scope':'Independent contact counts and gross stretch checks; no numerical metric establishes a visual pass.'}
for deg in [22.5,45,67.5,90]:
 for mode in ['baseline','sculpt']:
  positions=[Vector(p) for p in data[f'{mode}-ThighL-{deg}']]
  row={'degrees':deg,'mode':mode,'collisions':collision_summary(positions,faces,keys,regions),'edges':edge_deformation(rest,positions,faces)}
  out['poses'].append(row);print(deg,mode,row['collisions']['self_intersections'],row['edges']['severely_stretched_edges'],flush=True)
  (root/'geometry-review.json').write_text(json.dumps(out,indent=2))
