"""Colab shoulder-only dual-quaternion target baked back into standard morphs.

Historical preserve-volume targets on another lineage had broad shoulder roots;
this isolated test uses current seven-influence field and the failing 60/90-degree
straight-elbow reaches. No runtime DQ mode or hip target change is introduced.
"""
import sys,json
from pathlib import Path
import bpy
import numpy as np
import repair_combined_contour as trial
from review_generated_rig import surface

def dq_field(rest,posed,edges,center,height):
    obj=next(o for o in bpy.context.scene.objects if o.type=='MESH');modifier=next(m for m in obj.modifiers if m.type=='ARMATURE')
    old=modifier.use_deform_preserve_volume
    try:
        modifier.use_deform_preserve_volume=True;bpy.context.view_layer.update();wanted=np.array(surface([obj])[0])-posed
    finally:modifier.use_deform_preserve_volume=old;bpy.context.view_layer.update()
    rho=np.linalg.norm((rest-(center+height*np.array([0,0,-.025])))/(height*np.array([.085,.065,.10])),axis=1)
    mask=(rho<1)&(abs(rest[:,0])>height*.045);t=np.clip((1-rho)/.35,0,1);fade=t*t*t*(10+t*(-15+6*t))
    mid=np.clip((abs(rest[:,0])-height*.045)/(height*.015),0,1);fade*=mid*mid*(3-2*mid)*mask
    wanted*=fade[:,None];scale=min(1,height*.02/max(float(np.linalg.norm(wanted,axis=1).max()),1e-30));wanted*=scale
    return wanted,mask,{'solve_vertices':int(mask.sum()),'max_target_delta':float(np.linalg.norm(wanted,axis=1).max()),'global_cap_scale':scale,
       'scope':'Localized current-field preserve-volume shoulder target, not a native GLB DQ skin or an anatomy pass.'}

if __name__=='__main__':
    trial.POLICY={**trial.POLICY,'version':'combined-dq-shoulder-v3','hip':'unchanged baseline; zero extra twist target',
       'shoulder_target':'Current skin dual-quaternion surface minus linear skin, fixed seam-consistent rest mask'}
    original=trial.fair_patch
    def unchanged_hip(r,p,e,c,h):
        _,mask,metrics=original(r,p,e,c,h);return np.zeros_like(r),mask,{**metrics,'max_target_delta':0,'scope':'Unchanged hip control'}
    trial.fair_patch=unchanged_hip;trial.shoulder_field=dq_field;trial.main(Path(sys.argv[1]).resolve())
