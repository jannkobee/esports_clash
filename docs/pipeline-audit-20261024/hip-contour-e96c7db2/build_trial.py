"""Byte-only source assembly and immutable input packaging."""
import hashlib,json,uuid,zipfile
from pathlib import Path
root=Path(__file__).parent
s=(root.parent/'hip-shape-work/hip_shape_trial.py').read_text()
start=s.index('POLICY=');end=s.index('\ndef sha',start)
s=s[:start]+'from hip_contour_field import POLICY,blend,fair_patch\n'+s[end:]
s=s.replace('localized-hip-sculpt-pilot-v1','localized-hip-contour-pilot-v5')
start=s.index('        handle=center+');end=s.index('        inv_world=',start)
s=s[:start]+s[end:]
start=s.index("        apply_pose(rig,mapping,'ThighL',90");end=s.index('        rest_keys=',start)
s=s[:start]+'''        edges=np.array([e.vertices[:] for e in obj.data.edges]);deltas={};target_proofs=[];active=None;condition=0.
        for angle in [45,90]:
            apply_pose(rig,mapping,'ThighL',angle,'world_target');m=matrices();posed=np.einsum('nxy,ny->nx',m,hom)
            wanted,mask,metrics=fair_patch(points,posed,edges,center,height)
            active=mask if active is None else active|mask
            if metrics['max_target_delta']>height*POLICY['max_posed_delta_height']:raise ValueError('Contour target exceeds posed cap')
            cond=float(np.linalg.cond(m[active,:,:3]).max());condition=max(condition,cond)
            if cond>POLICY['max_inverse_condition']:raise ValueError('Inverse skin is ill-conditioned')
            delta=np.zeros_like(points);delta[active]=np.linalg.solve(m[active,:,:3],wanted[active,:,None])[:,:,0]
            if np.linalg.norm(delta,axis=1).max()>height*POLICY['max_rest_delta_height']:raise ValueError('Rest corrective exceeds cap')
            deltas[angle]=delta;target_proofs.append({'degrees':angle,**metrics})
        from mesh_validation import collision_summary,rest_keys
        from mathutils import Vector
        _,faces,regions=surface(meshes);keys=rest_keys([Vector(p) for p in points]);attempts=[];chosen=None
        for scale in POLICY['collision_backtracking_scales']:
            checks=[]
            for angle in POLICY['collision_check_degrees']:
                apply_pose(rig,mapping,'ThighL',angle,'world_target');m=matrices();base=np.einsum('nxy,ny->nx',m,hom)
                f=blend(angle);proposed=base+scale*np.einsum('nxy,ny->nx',m[:,:,:3],f[0]*deltas[45]+f[1]*deltas[90])
                contacts=collision_summary([Vector(p) for p in proposed],faces,keys,regions)['self_intersections']
                checks.append({'degrees':angle,'self_intersections':contacts})
                print('collision_backtrack',scale,angle,contacts,flush=True)
                if contacts:break
            attempts.append({'scale':scale,'checks':checks})
            if len(checks)==8 and all(c['self_intersections']==0 for c in checks):chosen=scale;break
        if chosen is None:raise ValueError('No collision-free corrective within the frozen backtracking steps')
        deltas={angle:chosen*d for angle,d in deltas.items()};delta=deltas[90]
        r['collision_line_search']={'selected_scale':chosen,'attempts':attempts,'scope':'Zero contacts at eight sampled poses, not proof of continuous-motion collision freedom.'}
''' +s[end:]
s=s.replace("'handle_world':handle.tolist()","'policy':POLICY,'target_proofs':target_proofs")
s=s.replace("float(np.linalg.norm(delta,axis=1).max()),'outside_patch_delta'","max(float(np.linalg.norm(d,axis=1).max()) for d in deltas.values()),'outside_patch_delta'")
s=s.replace("            altered=baseline+activation(degrees)*np.einsum('nxy,ny->nx',m[:,:,:3],delta)","            factors=blend(degrees);current_delta=factors[0]*deltas[45]+factors[1]*deltas[90]\n            altered=baseline+np.einsum('nxy,ny->nx',m[:,:,:3],current_delta)")
s=s.replace("'activation':activation(degrees)","'activation':list(factors)")
s=s.replace('rest_delta=delta,falloff=falloff','rest_delta_45=deltas[45],rest_delta_90=deltas[90],active=active')
s=s.replace("if seam_spread(delta)>1e-7:","if max(seam_spread(d) for d in deltas.values())>1e-7:")
(root/'hip_contour_trial.py').write_text(s)
with zipfile.ZipFile(root.parent/'hip-shape-work/d832094d-eddb-4b70-8b62-d47553d35d64/input.zip') as z:files={n:z.read(n) for n in z.namelist() if not n.endswith('/')}
p=json.loads(files.pop('plan.json'));rid=str(uuid.uuid4())
# Read the literal policy via AST, without importing any geometry code locally.
import ast
tree=ast.parse((root/'hip_contour_field.py').read_text());policy=ast.literal_eval(next(n.value for n in tree.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='POLICY' for t in n.targets)))
p.update(id=rid,method='localized-hip-contour-pilot-v5',policy=policy,revision_of='d286b072-2e6b-4803-9ea9-b70f074c1111')
for key in ['reproduces_geometry_review_id','prior_render_unretrieved_id']:p.pop(key,None)
for name in ['hip_contour_trial.py','hip_contour_field.py']:files['tools/'+name]=(root/name).read_bytes()
p['files']={name:hashlib.sha256(data).hexdigest() for name,data in files.items()};files['plan.json']=json.dumps(p,indent=2).encode()
out=root/rid;out.mkdir()
with zipfile.ZipFile(out/'input.zip','w',zipfile.ZIP_DEFLATED) as z:
 for name,data in files.items():z.writestr(name,data)
(root/'current-id.txt').write_text(rid);print(rid)
