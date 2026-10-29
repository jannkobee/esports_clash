"""Colab-only remap of two contact-aware hip targets to native rig vertices."""
import hashlib,json,os,sys,time
from pathlib import Path
import numpy as np
import bpy
from mathutils import Vector
from mathutils.kdtree import KDTree
from review_generated_rig import load,surface
from review_collision_weight_candidate import reset_pose
from review_shoulder_socket_study import weight_records
from mesh_validation import rest_keys,collision_summary
from asset_pipeline.edge_deformation import edge_deformation

def main(root):
 if not os.environ.get('COLAB_RELEASE_TAG') or not root.is_relative_to('/content/teamfight-preparation/reviews'):raise RuntimeError('Colab required')
 plan=json.loads((root/'plan.json').read_text());out=root/'output';out.mkdir(exist_ok=False)
 report={'id':plan['id'],'method':plan['method'],'compute':'google','qualification_complete':False,'publication_eligible':False,'source_sha256':plan['source_sha256'],'rig_sha256':plan['parent_candidate_sha256'],'parent_candidate_id':plan['parent_candidate_id'],'hip_probe_id':plan['hip_probe_id'],'hybrid_probe_id':plan['hybrid_probe_id'],'status':'running'}
 try:
  for name,h in plan['files'].items():
   if hashlib.sha256((root/name).read_bytes()).hexdigest()!=h:raise ValueError('Frozen input mismatch: '+name)
  hip=json.loads((root/'hip-report.json').read_text());hybrid=json.loads((root/'hybrid-report.json').read_text())
  with np.load(root/'hip-target.npz',allow_pickle=False) as archive:target={k:archive[k] for k in archive.files}
  if hip['posed_target_artifact']['sha256']!=plan['files']['hip-target.npz'] or hybrid['target_surface_artifact']['sha256']!=plan['files']['hybrid-targets.npz'] or sorted(target)!=['ThighL_90','ThighR_90']:raise ValueError('Frozen target lineage mismatch')
  rigs,meshes=load(root/'corrected.glb');reset_pose(rigs[0]);corrected_rest,_,_=surface(meshes);corrected_weights=weight_records(meshes)
  if any(len(corrected_rest)!=target[k].shape[0] for k in target):raise ValueError('Corrected target topology mismatch')
  rigs,meshes=load(root/'native.glb');reset_pose(rigs[0]);native_rest,faces,regions=surface(meshes);native_weights=weight_records(meshes);tree=KDTree(len(corrected_weights))
  for i,(position,_) in enumerate(corrected_weights):tree.insert(position,i)
  tree.balance();indices=[];worst_pos=0.;worst_weight=0.;max_ambiguity=0.
  for pos,weights in native_weights:
   matches=[]
   for _,idx,distance in tree.find_range(pos,1e-6):
    other=corrected_weights[idx][1]
    if weights.keys()!=other.keys():continue
    error=max([abs(weights[k]-other[k]) for k in weights] or [0.])
    if error<=2e-6:matches.append((distance,error,idx))
   if not matches:raise ValueError('Native vertex lacks matching corrected rest/weight signature')
   matches.sort();best=matches[0];worst_pos=max(worst_pos,best[0]);worst_weight=max(worst_weight,best[1]);indices.append(best[2])
   for k in target:
    chosen=target[k][best[2]];ambiguity=max([float(np.linalg.norm(target[k][idx]-chosen)) for _,_,idx in matches] or [0.]);max_ambiguity=max(max_ambiguity,ambiguity)
    if ambiguity>1e-6:raise ValueError('Seam-equivalent target positions differ')
  old=np.load(root/'hybrid-targets.npz',allow_pickle=False);values={k:old[k] for k in old.files};height=max(p.z for p in native_rest)-min(p.z for p in native_rest);metrics=[]
  for joint in ('ThighL','ThighR'):
   key=joint+'_90';mapped=np.asarray(target[key][indices]);original=old[key]
   if mapped.shape!=original.shape:raise ValueError('Native target topology differs')
   max_change=float(np.linalg.norm(mapped-original,axis=1).max())
   if max_change>height*.001+1e-6:raise ValueError('Hip target exceeds original hybrid correction bound')
   points=[Vector(q) for q in mapped];summary=collision_summary(points,faces,rest_keys(native_rest),regions);stretch=edge_deformation(native_rest,points,faces);trial=next(t for t in hip['hip_trials'] if t['joint']==joint)
   if summary['self_intersections']!=trial['after_intersections'] or stretch['severely_stretched_edges']:raise ValueError('Remapped hip target differs from measured output')
   metrics.append({'joint':joint,'max_change_from_hybrid_m':max_change,'intersections':summary['self_intersections'],'edge_deformation':stretch});values[key]=mapped
  report['mapping']={'native_vertices':len(native_rest),'corrected_vertices':len(corrected_rest),'unmatched_native':0,'max_rest_position_error_m':worst_pos,'max_weight_error':worst_weight,'max_seam_target_ambiguity_m':max_ambiguity,'hip_targets':metrics}
  output=out/'corrective-targets.npz';np.savez_compressed(output,**values);report['target_surface_artifact']={'sha256':hashlib.sha256(output.read_bytes()).hexdigest(),'bytes':output.stat().st_size,'keys':sorted(values),'source_sha256':plan['parent_candidate_sha256'],'vertex_count':len(native_rest),'space':'Blender world; frozen native glTF import with merge_vertices=True'}
  report.update(status='diagnostic_complete',scope='Rest/weight-verified two-hip target remap, other hybrid targets unchanged; not a GLB or visual qualification.')
 except Exception as e:report.update(status='failed',error=f'{type(e).__name__}: {e}');raise
 finally:report['completed_unix']=time.time();(out/'report.json').write_text(json.dumps(report,indent=2))
if __name__=='__main__':main(Path(sys.argv[1]).resolve())
