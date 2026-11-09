"""Read-only Colab check for cumulative rest/weight drift across candidate stages."""
import hashlib,json,os
from pathlib import Path
import sys
from review_generated_rig import load,surface
from review_collision_weight_candidate import reset_pose,surface_roundtrip
from review_shoulder_socket_study import weight_records,weight_match

if __name__=='__main__':
    if not os.environ.get('COLAB_RELEASE_TAG'):raise RuntimeError('Colab required for candidate bind comparison')
    parent_path,current_path,parent_sha,current_sha,output=sys.argv[1:]
    for file,expected in [(parent_path,parent_sha),(current_path,current_sha)]:
        if hashlib.sha256(Path(file).read_bytes()).hexdigest()!=expected:raise ValueError('Source hash mismatch')
    rigs,meshes=load(Path(parent_path));reset_pose(rigs[0]);before,faces,_=surface(meshes);weights=weight_records(meshes)
    rigs,meshes=load(Path(current_path));reset_pose(rigs[0]);after,current_faces,_=surface(meshes)
    result={'compute':'google','parent_sha256':parent_sha,'candidate_sha256':current_sha,
        'rest_surface_comparison':surface_roundtrip(before,after),'weights':weight_match(weights,weight_records(meshes)),
        'parent_triangles':len(faces),'candidate_triangles':len(current_faces),'qualification_complete':False,'publication_eligible':False}
    result['preservation_verified']=len(faces)==len(current_faces) and result['weights']['verified'] and result['rest_surface_comparison']['max_nearest_distance_m']<=1e-6
    Path(output).write_text(json.dumps(result,indent=2));print(json.dumps(result))
    if not result['preservation_verified']:raise RuntimeError('Cumulative bind/weight preservation failed')
