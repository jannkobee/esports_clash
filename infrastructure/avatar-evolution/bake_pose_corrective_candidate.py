"""Colab-only portable four-morph corrective pilot on an exact generated rig.

The primary GLB is a rest rig with four zero-default corrective targets. Separate
standard glTF diagnostic clips bake weight channels; no runtime bone edits/DQS.
All qualification/publication gates remain false.
"""
import json,math,os
from pathlib import Path
import sys,time
import bpy
import numpy as np
from mathutils import Matrix,Quaternion,Vector
from review_generated_rig import load,surface
from review_collision_weight_candidate import TARGETS,digest,reset_pose,measure,surface_roundtrip
from review_shoulder_socket_study import weight_records,weight_match
from review_tapered_weight_candidate import weights as weight_summary
from diagnose_skinning_modes import seam_groups,seam_spread
from mesh_validation import collision_summary,rest_keys
from asset_pipeline.edge_deformation import edge_deformation
from glb_morph_animation import corrective_weight,add_weight_channels,normalize_static_skinned_roots
from candidate_animation import clear_imported_animation,bind_imported_clip

ROLES=['UpperArmL','UpperArmR','ThighL','ThighR']
METHOD='contact-bound-portable-pose-correctives-v3'
CONSTRAINTS={'morph_targets':4,'maximum_posed_delta_to_height':.02,'maximum_rest_delta_to_height':.04,'maximum_inverse_skin_condition':10,
    'rest_surface_max_m':1e-6,'native_target_match_max_m':1e-6,'canonical_skeleton_matrix_max_error':1e-6,'seam_spread_max_m':1e-6,
    'canonical_skeleton_comparison':'exact-retained-native-control','skinned_mesh_layout':'static-identity-root-mesh-v1'}


def axis_for(rig,mapping,role):
    bone=rig.pose.bones[mapping[role]];start=rig.matrix_world@bone.bone.head_local
    end=rig.matrix_world@rig.data.bones[mapping[TARGETS[role]]].head_local
    return (bone.bone.matrix_local.to_3x3().inverted()@rig.matrix_world.to_3x3().inverted()@(end-start).normalized().cross(Vector((0,1 if role.startswith('Calf') else -1,0))).normalized()).normalized()


def set_pose(rig,obj,mapping,role,degrees,recipe=None):
    reset_pose(rig)
    if obj.data.shape_keys:
        for key in obj.data.shape_keys.key_blocks:key.value=0
    if role:
        bone=rig.pose.bones[mapping[role]];bone.rotation_mode='QUATERNION';bone.rotation_quaternion=Quaternion(axis_for(rig,mapping,role),math.radians(degrees))
        if recipe:
            for item in recipe['joints']:
                if item['joint']==role:obj.data.shape_keys.key_blocks[item['target']].value=corrective_weight(degrees,item['midpoint_weight'])
    bpy.context.scene.frame_set(0)


def skin_data(rig,obj):
    names=[b.name for b in rig.pose.bones];indices=np.zeros((len(obj.data.vertices),4),dtype=np.int64);weights=np.zeros_like(indices,dtype=float)
    lookup={name:i for i,name in enumerate(names)}
    for vertex in obj.data.vertices:
        values=[(lookup[obj.vertex_groups[g.group].name],float(g.weight)) for g in vertex.groups if g.weight>0 and obj.vertex_groups[g.group].name in lookup]
        if not values or len(values)>4:raise ValueError('Unsupported source influence count')
        for i,(bone,weight) in enumerate(values):indices[vertex.index,i]=bone;weights[vertex.index,i]=weight
    weights/=weights.sum(axis=1)[:,None]
    return names,indices,weights


def deformation_matrices(rig,names):
    inverse=rig.matrix_world.inverted()
    return np.array([[[float(c) for c in row] for row in rig.matrix_world@rig.pose.bones[name].matrix@rig.data.bones[name].matrix_local.inverted()@inverse] for name in names])


def skin_matrices(rig,names,indices,weights):
    return np.einsum('ni,nijk->njk',weights,deformation_matrices(rig,names)[indices])


def export_glb(rig,obj,path,animations=False):
    bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);obj.select_set(True);bpy.context.view_layer.objects.active=rig
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_skins=True,
        export_animations=animations,export_animation_mode='ACTIONS',export_force_sampling=True,
        export_morph=True,export_morph_normal=True,export_morph_tangent=False,export_extras=True)


def author_diagnostics(rig,obj,mapping,recipe):
    scene=bpy.context.scene;scene.render.fps=30;scene.frame_start=0;scene.frame_end=60
    for action in list(bpy.data.actions):bpy.data.actions.remove(action)
    axes={role:axis_for(rig,mapping,role) for role in TARGETS};samples={}
    for role in TARGETS:
        action=bpy.data.actions.new('Stress_'+role);rig.animation_data_create();rig.animation_data.action=action
        for frame,degrees in [(0,0),(15,45),(30,90),(45,45),(60,0)]:
            for bone in rig.pose.bones:
                bone.rotation_mode='QUATERNION';bone.rotation_quaternion=Quaternion(axes[role],math.radians(degrees)) if bone.name==mapping[role] else Quaternion()
                bone.keyframe_insert('rotation_quaternion',frame=frame,group=bone.name)
        action.use_fake_user=True;rows=[]
        for frame in range(61):
            scene.frame_set(frame)
            angle=math.degrees(rig.pose.bones[mapping[role]].rotation_quaternion.normalized().angle)
            rows.append([corrective_weight(angle,item['midpoint_weight']) if item['joint']==role else 0. for item in recipe['joints']])
        samples[action.name]={'times':[frame/30 for frame in range(61)],'weights':rows}
    rig.animation_data.action=None
    for bone in rig.pose.bones:bone.matrix_basis=Matrix.Identity(4)
    for key in obj.data.shape_keys.key_blocks:key.value=0
    scene.frame_set(0)
    return samples


def main(root):
    if not os.environ.get('COLAB_RELEASE_TAG') or not root.is_relative_to('/content/teamfight-preparation/reviews'):raise RuntimeError('Google Colab required for corrective baking')
    plan=json.loads((root/'plan.json').read_text())
    if plan['method']!=METHOD or plan['constraints']!=CONSTRAINTS:raise ValueError('Unknown corrective method/constraints')
    for name,expected in plan['files'].items():
        if digest(root/name)!=expected:raise ValueError('Frozen corrective input mismatch: '+name)
    target_report=json.loads((root/'target-report.json').read_text());target_state=json.loads((root/'target-state.json').read_text());target_plan=json.loads((root/'target-plan.json').read_text())
    if (target_state['status']!='completed' or target_state['compute']!='google' or target_report['compute']!='google'
            or target_state['environment_sha256']!=target_plan.get('environment_sha256','73928306c86dae9ce21c8fe672abffcebdbb4ee2a654fa3a194a6f466ee8d105')
            or target_report['qualification_complete'] is not False or target_report['publication_eligible'] is not False
            or target_state['report_sha256']!=digest(root/'target-report.json')
            or target_report['id']!=plan['target_probe_id'] or target_report['method'] not in ('contact-bound-hybrid-corrective-probe-v1','half-strength-shoulder-target-v1','corrective-arap-remapped-target-v1','corrective-centroid-remapped-target-v1','corrective-hip-contact-remapped-target-v1')
            or target_report['method']!=target_plan['method']
            or target_report['rig_sha256']!=plan['parent_candidate_sha256'] or target_report['parent_candidate_id']!=plan['parent_candidate_id']
            or target_report['target_surface_artifact']['sha256']!=digest(root/'corrective-targets.npz')
            or target_plan['files']['tools/review_generated_rig.py']!=plan['files']['tools/review_generated_rig.py']):
        raise ValueError('Corrective target lineage/import convention mismatch')
    targets=np.load(root/'corrective-targets.npz',allow_pickle=False)
    if set(targets.files)!={role+'_'+str(deg) for role in ROLES for deg in (45,90)}:raise ValueError('Target surface coverage mismatch')
    baseline=json.loads((root/'baseline-report.json').read_text());mapping=baseline['bone_map']
    parent=json.loads((root/'candidate-report.json').read_text());reference=json.loads((root/'reference-report.json').read_text())
    control_proof=json.loads((root/'control-proof.json').read_text())
    if (control_proof['source_candidate_sha256']!=plan['parent_candidate_sha256'] or control_proof['candidate_id']!=plan['parent_candidate_id']
            or control_proof['preparation_id']!=plan['rig_attempt_id'] or control_proof['control_sha256']!=digest(root/'native-control.glb')):
        raise ValueError('Native skeletal control lineage mismatch')
    parent_poses=parent.get('reloaded_poses',parent.get('poses'));comparison={'reloaded_poses':parent_poses}
    output=root/'output';output.mkdir(exist_ok=False)
    report={'id':plan['id'],'method':METHOD,'compute':'google','source_sha256':baseline['source_sha256'],'rig_sha256':baseline['rig_sha256'],
        'parent_candidate_id':plan['parent_candidate_id'],'reference_candidate_id':plan['reference_candidate_id'],
        'target_probe_id':plan['target_probe_id'],'publication_eligible':False,'qualification_complete':False,'started_unix':time.time(),'baseline_reproduction':[]}
    def progress(stage):
        report['stage']=stage;temporary=output/'progress.tmp.json';temporary.write_text(json.dumps(report,indent=2));temporary.replace(output/'progress.json')
    try:
        for label,file,poses in [('parent','candidate.glb',parent_poses),('reference','reference.glb',reference['poses'])]:
            rigs,meshes=load(root/file);reset_pose(rigs[0]);result={};measure(rigs[0],meshes,mapping,comparison,result)
            expected={(p['joint'],p['degrees']):p['self_intersections'] for p in poses}
            valid=all(p['self_intersections']==expected[(p['joint'],p['degrees'])] for p in result['poses'])
            report['baseline_reproduction'].append({'label':label,'reproduced':valid,'poses':result['poses']})
            progress('baseline_'+label)
            if not valid:raise ValueError('Corrective source baseline did not reproduce')
        rigs,meshes=load(root/'native-control.glb');control_rig=rigs[0];control_names=[b.name for b in control_rig.pose.bones]
        control_matrices={};control_pose_proof=[];parent_counts={(p['joint'],p['degrees']):p['self_intersections'] for p in parent_poses}
        clear_imported_animation(control_rig,meshes);bpy.context.scene.frame_set(0);control_rest,control_faces,control_regions=surface(meshes);control_keys=rest_keys(control_rest)
        for role in TARGETS:
            action,bindings=bind_imported_clip(control_rig,meshes,'Stress_'+role);first,last=action.frame_range
            for phase,degrees in [(.25,45),(.5,90)]:
                frame=first+(last-first)*phase;bpy.context.scene.frame_set(math.floor(first)-1);bpy.context.scene.frame_set(math.floor(frame),subframe=frame-math.floor(frame))
                points,_,_=surface(meshes);count=collision_summary(points,control_faces,control_keys,control_regions)['self_intersections']
                if count!=parent_counts[(role,degrees)]:raise ValueError('Native skeletal control does not reproduce source bends')
                control_matrices[(role,degrees)]=deformation_matrices(control_rig,control_names)
                control_pose_proof.append({'joint':role,'degrees':degrees,'intersections':count,'phase':phase})
        report['native_skeletal_control']={'proof':control_proof,'poses':control_pose_proof,'baseline_reproduced':True};progress('native_control_verified')
        rigs,meshes=load(root/'candidate.glb')
        if len(rigs)!=1 or len(meshes)!=1:raise ValueError('Pilot requires one rig and one source mesh')
        rig,obj=rigs[0],meshes[0];set_pose(rig,obj,mapping,None,0)
        if obj.data.shape_keys:raise ValueError('Pilot source must not have existing morphs')
        rest,faces,regions=surface(meshes);rest_array=np.array([list(p) for p in rest]);height=float(np.ptp(rest_array[:,2]));keys=rest_keys(rest)
        original_weights=weight_records(meshes);names,indices,weights=skin_data(rig,obj)
        if names!=control_names:raise ValueError('Native control/source bone order differs')
        if len(rest)!=target_report['target_surface_artifact']['vertex_count']:raise ValueError('Target vertex import count changed')
        if any(targets[key].shape!=rest_array.shape or not np.isfinite(targets[key]).all() for key in targets.files):raise ValueError('Invalid target surface coordinates')
        obj.shape_key_add(name='Basis',from_mix=False);recipe={'method':METHOD,'curve':'linear-through-fitted-45-degree-midpoint','joints':[]};report['corrective_fits']=[]
        for role in ROLES:
            progress('fitting_'+role)
            set_pose(rig,obj,mapping,role,90);linear,_,_=surface(meshes);linear_array=np.array([list(p) for p in linear]);matrices=skin_matrices(rig,names,indices,weights)
            predicted=np.einsum('nij,nj->ni',matrices,np.column_stack([rest_array,np.ones(len(rest))]))[:,:3]
            prediction_error=float(np.linalg.norm(predicted-linear_array,axis=1).max())
            if prediction_error>1e-6:raise ValueError('Inverse-skin model does not reproduce native LBS')
            desired=targets[role+'_90'];delta=desired-linear_array
            condition=float(np.linalg.cond(matrices[:,:3,:3]).max())
            if condition>10:raise ValueError('Ill-conditioned inverse-skin corrective')
            rest_delta=np.linalg.solve(matrices[:,:3,:3],delta[...,None])[...,0];posed_max=float(np.linalg.norm(delta,axis=1).max());rest_max=float(np.linalg.norm(rest_delta,axis=1).max())
            if posed_max>height*.02 or rest_max>height*.04:raise ValueError('Corrective displacement exceeds frozen pilot caps')
            local_delta=np.einsum('ij,nj->ni',np.array(obj.matrix_world.to_3x3().inverted()),rest_delta)
            key=obj.shape_key_add(name='Corrective_'+role+'_90',from_mix=False)
            for vertex,d in zip(key.data,local_delta):vertex.co+=Vector(d)
            key.value=1;actual,_,_=surface(meshes);match=float(np.linalg.norm(np.array([list(p) for p in actual])-desired,axis=1).max())
            if match>1e-6:raise ValueError('Native morph did not reproduce target surface')
            set_pose(rig,obj,mapping,role,45);linear45,_,_=surface(meshes);linear45=np.array([list(p) for p in linear45]);matrix45=skin_matrices(rig,names,indices,weights)
            response=np.einsum('nij,nj->ni',matrix45[:,:3,:3],rest_delta);goal=targets[role+'_45']-linear45
            midpoint=float(np.clip(np.sum(response*goal)/max(float(np.sum(response*response)),1e-15),0,1))
            recipe['joints'].append({'joint':role,'bone':mapping[role],'target':key.name,'axis_local':list(axis_for(rig,mapping,role)),'midpoint_weight':midpoint})
            report['corrective_fits'].append({'joint':role,'linear_prediction_error_m':prediction_error,'target_match_max_m':match,'matrix_condition_max':condition,
                'max_posed_delta_m':posed_max,'max_rest_delta_m':rest_max,'body_height_m':height,'midpoint_weight':midpoint})
        expected_skeleton={}
        for role in TARGETS:
            for degrees in (45,90):
                set_pose(rig,obj,mapping,role,degrees);bpy.context.view_layer.update();expected_skeleton[(role,degrees)]=deformation_matrices(rig,names)
        set_pose(rig,obj,mapping,None,0);zero_rest,_,_=surface(meshes);report['zero_weight_rest_preservation']=surface_roundtrip(rest,zero_rest)
        if report['zero_weight_rest_preservation']['max_nearest_distance_m']>1e-6:raise ValueError('Zero corrective weights changed rest surface')
        report['corrective_recipe']=recipe;obj['pose_corrective_recipe']=json.dumps(recipe)
        progress('primary_glb_export')
        candidate=output/'pose-corrective-candidate.glb';export_glb(rig,obj,candidate)
        report['primary_layout_normalization']=normalize_static_skinned_roots(candidate)
        report['artifact']={'sha256':digest(candidate),'bytes':candidate.stat().st_size}
        samples=author_diagnostics(rig,obj,mapping,recipe);stress=output/'pose-corrective-stress.glb';export_glb(rig,obj,stress,True)
        report['stress_layout_normalization']=normalize_static_skinned_roots(stress)
        report['morph_channel_bake']=add_weight_channels(stress,recipe,report['artifact']['sha256'],samples)
        report['corrective_stress_artifact']={'sha256':digest(stress),'bytes':stress.stat().st_size,'source_candidate_sha256':report['artifact']['sha256']}
        progress('primary_glb_reimport')
        rigs,meshes=load(candidate)
        if len(meshes)!=1 or not meshes[0].data.shape_keys or len(meshes[0].data.shape_keys.key_blocks)!=5:raise ValueError('Primary corrective target count changed')
        report['primary_morph_defaults']={k.name:float(k.value) for k in meshes[0].data.shape_keys.key_blocks if k.name!='Basis'}
        if any(abs(value)>1e-8 for value in report['primary_morph_defaults'].values()):raise ValueError('Primary rig must have zero-default correctives')
        clear_imported_animation(rigs[0],meshes);bpy.context.scene.frame_set(0);reloaded_rest,reloaded_faces,_=surface(meshes)
        report['rest_surface_roundtrip']=surface_roundtrip(rest,reloaded_rest);report['weight_correspondence']=weight_match(original_weights,weight_records(meshes));report['candidate_weights']=weight_summary(meshes,rigs[0])
        if (len(reloaded_faces)!=len(faces) or report['rest_surface_roundtrip']['max_nearest_distance_m']>1e-6 or not report['weight_correspondence']['verified']):raise ValueError('Corrective primary GLB failed rest/weight preservation')
        if any(not w['finite_nonnegative'] or w['unweighted_vertices'] or w['max_influences']>4 or w['max_normalization_error']>1e-5 for w in report['candidate_weights']):raise ValueError('Corrective skin weights failed structural limits')
        progress('diagnostic_clip_reimport')
        rigs,meshes=load(stress);rig=rigs[0];clear_imported_animation(rig,meshes);bpy.context.scene.frame_set(0)
        clip_rest,clip_faces,clip_regions=surface(meshes);clip_keys=rest_keys(clip_rest);cohorts=seam_groups(clip_rest)
        report['poses']=[];report['clip_bindings']=[];parent_counts={(p['joint'],p['degrees']):p['self_intersections'] for p in parent_poses}
        for role in TARGETS:
            action,bindings=bind_imported_clip(rig,meshes,'Stress_'+role,True);first,last=action.frame_range;report['clip_bindings'].append({'joint':role,'bindings':bindings})
            for phase,degrees in [(.25,45),(.5,90)]:
                frame=first+(last-first)*phase;bpy.context.scene.frame_set(math.floor(first)-1);bpy.context.scene.frame_set(math.floor(frame),subframe=frame-math.floor(frame))
                points,posed_faces,_=surface(meshes)
                if posed_faces!=clip_faces:raise ValueError('Corrective clip changed topology')
                actual_skeleton=deformation_matrices(rig,names)
                skeleton_error=float(np.abs(actual_skeleton-control_matrices[(role,degrees)]).max())
                ideal_error=float(np.abs(actual_skeleton-expected_skeleton[(role,degrees)]).max())
                if skeleton_error>1e-6:raise ValueError('Exported corrective clip changed the canonical skeletal bend')
                morph_values={k.name:float(k.value) for obj in meshes for k in obj.data.shape_keys.key_blocks if k.name!='Basis'}
                expected_weights={item['target']:corrective_weight(degrees,item['midpoint_weight']) if item['joint']==role else 0. for item in recipe['joints']}
                if any(abs(morph_values.get(name,-1)-value)>1e-5 for name,value in expected_weights.items()):raise ValueError('Imported morph channels are not evaluating with the bone clip')
                row={'joint':role,'degrees':degrees,'phase':phase,**collision_summary(points,clip_faces,clip_keys,clip_regions),
                    'edge_deformation':edge_deformation(clip_rest,points,clip_faces),'morph_weights':morph_values,
                    'max_coincident_rest_vertex_spread_m':seam_spread(points,cohorts),'parent_intersections':parent_counts[(role,degrees)],
                    'canonical_skeleton_max_matrix_error':skeleton_error,'ideal_source_skeleton_max_matrix_error':ideal_error}
                row['delta_vs_parent']=row['self_intersections']-row['parent_intersections'];report['poses'].append(row)
                progress('verified_'+role+'_'+str(degrees))
                if row['max_coincident_rest_vertex_spread_m']>1e-6:raise ValueError('Portable corrective opens source seams')
        report['regressions']=[{'joint':p['joint'],'degrees':p['degrees'],'delta':p['delta_vs_parent']} for p in report['poses'] if p['delta_vs_parent']>0 or p['edge_deformation']['severely_stretched_edges']>0]
        report['status']='review_required';report['scope']='Four zero-default corrective morphs on the actual generated rig. Separate standard glTF diagnostic clips bake the weight channels. Controlled exported poses only; full game-motion, transition, appearance and visual qualification remain pending.'
    except Exception as error:
        report.update(status='failed',error=f'{type(error).__name__}: {error}');raise
    finally:
        report['completed_unix']=time.time();(output/'report.json').write_text(json.dumps(report,indent=2))


if __name__=='__main__':main(Path(sys.argv[1]).resolve())
