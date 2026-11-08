"""Colab multi-axis volume targets, preserving the original linear skin runtime.

Current-field DQ surfaces are targets only. The right-shoulder negative-twist
target is a residual from the straight-reach target, not a strength change.
The hip target uses the original protected upper-pelvis and midline boundaries.
"""
import sys
from pathlib import Path
import bpy
import numpy as np
import repair_combined_contour as trial
from repair_dq_shoulder import dq_field
from review_generated_rig import surface

def hip_volume(rest,posed,edges,center,height):
    obj=next(o for o in bpy.context.scene.objects if o.type=='MESH');mod=next(m for m in obj.modifiers if m.type=='ARMATURE');old=mod.use_deform_preserve_volume
    try:
        mod.use_deform_preserve_volume=True;bpy.context.view_layer.update();wanted=np.array(surface([obj])[0])-posed
    finally:mod.use_deform_preserve_volume=old;bpy.context.view_layer.update()
    rho=np.linalg.norm((rest-(center+height*np.array([0,-.05,-.01])))/(height*np.array([.075,.07,.12])),axis=1)
    upper=center[2]+height*.03;mask=(rho<1)&(rest[:,0]<-height*.005)&(rest[:,2]<upper)
    t=np.clip((1-rho)/.35,0,1);fade=t*t*t*(10+t*(-15+6*t))
    mid=np.clip((-height*.005-rest[:,0])/(height*.015),0,1);fade*=mid*mid*(3-2*mid)
    top=np.clip((upper-rest[:,2])/(height*.02),0,1);fade*=top*top*(3-2*top)*mask
    wanted*=fade[:,None]
    return wanted,mask,{'solve_vertices':int(mask.sum()),'max_target_delta':float(np.linalg.norm(wanted,axis=1).max()),'protected_upper_max_delta':float(np.linalg.norm(wanted[rest[:,2]>=upper],axis=1).max()),
      'scope':'Protected current-field compound-pose volume target; baseline hip morphs remain unchanged.'}

if __name__=='__main__':
    trial.POLICY={**trial.POLICY,'version':'combined-pose-volume-v4','right_twist_target':True,
       'shoulder_target':'Current-field preserve-volume plus separate right60/elbow60/twist-20 residual; combined cap unchanged',
       'hip_target':'Current-field preserve-volume at left90/knee90/twist+20; protected pelvis and midline fixed'}
    trial.shoulder_field=dq_field;trial.fair_patch=hip_volume;trial.main(Path(sys.argv[1]).resolve())
