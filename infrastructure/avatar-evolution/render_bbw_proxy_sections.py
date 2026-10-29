"""Colab-only evidence figure: source/proxy slices through shoulders and hips."""
import hashlib,json,os,sys
from pathlib import Path
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.collections import LineCollection
from review_generated_rig import load,surface

r=Path(sys.argv[1]).resolve()
if not os.environ.get('COLAB_RELEASE_TAG') or not r.is_relative_to('/content/teamfight-preparation/reviews'):
    raise RuntimeError('Google Colab required')
report=json.loads((r/'report.json').read_text());domain=r/'proxy-domain.npz'
if report['status']!='proxy_ready_for_constraint_review' or hashlib.sha256(domain.read_bytes()).hexdigest()!=report['proxy_artifact']['sha256']:
    raise ValueError('Verified proxy required')
for name in ('source.glb','raw.glb'):
    if hashlib.sha256((r/name).read_bytes()).hexdigest()!=report['plan']['files'][name]:raise ValueError('Source mismatch')
_,m=load(r/'source.glb');v,f,_=surface(m);v=np.array(v);f=np.array(f)
p=np.load(domain);pv,pf=p['vertices'],p['boundary_faces'];rigs,_=load(r/'raw.glb');rig=rigs[0]
baseline=json.loads((r/'baseline-report.json').read_text());height=report['proxy']['body_height']
def segments(points,faces,x):
    result=[]
    for tri in points[faces]:
        if tri[:,0].min()>x or tri[:,0].max()<x:continue
        hits=[]
        for a,b in ((0,1),(1,2),(2,0)):
            d=tri[b,0]-tri[a,0]
            if abs(d)<1e-12:continue
            t=(x-tri[a,0])/d
            if 0<=t<=1:hits.append((tri[a]+t*(tri[b]-tri[a]))[1:])
        if len(hits)>=2:result.append(hits[:2])
    return result
fig,axes=plt.subplots(2,2,figsize=(10,9))
for ax,role in zip(axes.flat,['UpperArmL','UpperArmR','ThighL','ThighR']):
    center=np.array(rig.matrix_world@rig.data.bones[baseline['bone_map'][role]].head_local)
    ax.add_collection(LineCollection(segments(v,f,center[0]),colors='#166534',linewidths=1.2,label='original surface'))
    ax.add_collection(LineCollection(segments(pv,pf,center[0]),colors='#ea580c',linewidths=.8,label='computational envelope'))
    ax.set_xlim(center[1]-.13*height,center[1]+.13*height);ax.set_ylim(center[2]-.13*height,center[2]+.13*height)
    ax.set_aspect('equal');ax.set_title(role+' sagittal section');ax.set_xlabel('world Y');ax.set_ylabel('world Z');ax.legend(fontsize=8);ax.grid(alpha=.2)
fig.suptitle('Source surface and computational volume — unchanged visible body');fig.tight_layout()
out=r/'proxy-sections.png';fig.savefig(out,dpi=150);plt.close(fig)
(r/'proxy-sections.json').write_text(json.dumps({'parent_id':report['id'],'compute':'google','publication_eligible':False,'proxy_sha256':report['proxy_artifact']['sha256'],'figure_sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'script_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'scope':'Four sagittal sections; not a full topology, rig or deformation qualification'},indent=2))
