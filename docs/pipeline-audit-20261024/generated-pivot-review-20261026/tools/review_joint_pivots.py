"""Colab-only pivot sensitivity diagnosis; immutable raw rig, no release admission."""
import hashlib,json,math,os,sys,time
from collections import Counter
from pathlib import Path
import bpy
from mathutils import Matrix,Quaternion,Vector
from review_generated_rig import load,surface
from mesh_validation import collision_summary,rest_keys
from asset_pipeline.edge_deformation import edge_deformation


def main():
    root=Path(sys.argv[1]).resolve()
    if not os.environ.get('COLAB_RELEASE_TAG') or not root.is_relative_to('/content/teamfight-preparation/reviews'):
        raise RuntimeError('Google Colab required')
    plan=json.loads((root/'plan.json').read_text())
    for name,sha in plan['files'].items():
        if hashlib.sha256((root/name).read_bytes()).hexdigest()!=sha:raise ValueError('Frozen input changed: '+name)
    baseline=json.loads((root/'baseline-report.json').read_text());mapping=baseline['bone_map']
    assert baseline['rig_sha256']==plan['files']['raw-rig.glb']
    targets={'UpperArmL':'ForearmL','UpperArmR':'ForearmR','ThighL':'CalfL','ThighR':'CalfR','CalfL':'FootL','CalfR':'FootR'}
    report={'id':plan['id'],'compute':'google','source_sha256':baseline['source_sha256'],
            'rig_sha256':baseline['rig_sha256'],'publication_eligible':False,'qualification_complete':False,
            'started_unix':time.time(),'joint_diagnostics':[],'variants':[]}
    output=root/'output';output.mkdir(exist_ok=False)
    try:
        for variant,offset in [('linear_baseline',0),('pivot_forward_1pct',-.01),('pivot_backward_1pct',.01)]:
            result={'name':variant,'poses':[]};report['variants'].append(result)
            for role,child in targets.items():
                rigs,meshes=load(root/'raw-rig.glb');rig=rigs[0];rig.animation_data_clear()
                for bone in rig.pose.bones:bone.matrix_basis=Matrix.Identity(4)
                original,faces,regions=surface(meshes);height=max(p.z for p in original)-min(p.z for p in original)
                data=rig.data.bones[mapping[role]];pivot=rig.matrix_world@data.head_local
                end=rig.matrix_world@rig.data.bones[mapping[child]].head_local
                direction=(end-pivot).normalized();desired=Vector((0,1 if role.startswith('Calf') else -1,0))
                world_axis=direction.cross(desired).normalized()
                if variant=='linear_baseline':
                    # Local topology and influences are evidence, not a remeshing decision.
                    nearby=[];edges=Counter();valences=Counter()
                    for face in faces:
                        for a,b in zip(face,face[1:]+face[:1]):edges[tuple(sorted((a,b)))]+=1
                    for a,b in edges:valences[a]+=1;valences[b]+=1
                    for obj in meshes:
                        for vertex in obj.data.vertices:
                            p=obj.matrix_world@vertex.co
                            if (p-pivot).length<=height*.065:
                                nearby.append({'position':list(p),'weights':{obj.vertex_groups[g.group].name:g.weight for g in vertex.groups if g.weight>1e-5}})
                    report['joint_diagnostics'].append({'joint':role,'pivot':list(pivot),'child_pivot':list(end),
                        'height':height,'nearby_vertices':nearby,'boundary_edges':sum(n==1 for n in edges.values()),
                        'nonmanifold_edges':sum(n>2 for n in edges.values()),'max_valence':max(valences.values())})
                if offset:
                    bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
                    edit=rig.data.edit_bones[mapping[role]];roll=edit.roll
                    edit.head+=rig.matrix_world.to_3x3().inverted()@Vector((0,offset*height,0));edit.roll=roll
                    bpy.ops.object.mode_set(mode='OBJECT')
                rest,current_faces,_=surface(meshes)
                displacement=max((a-b).length for a,b in zip(original,rest))
                if current_faces!=faces or displacement>1e-6:raise ValueError('Pivot edit changed bind surface')
                bone=rig.pose.bones[mapping[role]]
                axis=(bone.bone.matrix_local.to_3x3().inverted()@rig.matrix_world.to_3x3().inverted()@world_axis).normalized()
                for degrees in (45,90):
                    bone.rotation_mode='QUATERNION';bone.rotation_quaternion=Quaternion(axis,math.radians(degrees))
                    points,current_faces,_=surface(meshes)
                    row={'joint':role,'degrees':degrees,'pivot_offset_to_height':offset,'rest_max_displacement':displacement,
                         **collision_summary(points,faces,rest_keys(rest),regions),'edge_deformation':edge_deformation(rest,points,faces)}
                    if variant=='linear_baseline':
                        expected=next(p for p in baseline['poses'] if p['joint']==role and p['degrees']==degrees)
                        if row['self_intersections']!=expected['self_intersections']:raise ValueError('Baseline reproduction failed')
                    result['poses'].append(row)
                    (output/'progress.json').write_text(json.dumps({'variants':report['variants']}))
        report['status']='review_required'
        report['scope']='Independent pivot sensitivity only. No combined rig repair, export, motion or appearance qualification.'
    except Exception as error:
        report.update(status='failed',error=str(error));raise
    finally:
        report['completed_unix']=time.time();(output/'report.json').write_text(json.dumps(report,indent=2))


if __name__=='__main__':main()
