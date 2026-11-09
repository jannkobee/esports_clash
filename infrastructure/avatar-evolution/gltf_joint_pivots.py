"""Colab-only pivot translations with compensated children and inverse bind matrices."""
import copy
import json
import os
import struct
import numpy as np


def local_matrix(node):
    if 'matrix' in node:return np.array(node['matrix'], dtype=float).reshape(4,4).T
    x,y,z,w = node.get('rotation', [0,0,0,1])
    rotation = np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],
        [2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],
        [2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])
    result = np.eye(4);result[:3,:3] = rotation @ np.diag(node.get('scale',[1,1,1]))
    result[:3,3] = node.get('translation',[0,0,0]);return result


def world_matrices(nodes):
    parents = {child:index for index,node in enumerate(nodes) for child in node.get('children',[])}
    values = {}
    def world(index):
        if index not in values:
            values[index] = world(parents[index]) @ local_matrix(nodes[index]) if index in parents else local_matrix(nodes[index])
        return values[index]
    for index in range(len(nodes)):world(index)
    return values, parents


def set_matrix(node, matrix):
    for key in ('rotation','translation','scale'):node.pop(key,None)
    node['matrix'] = matrix.T.reshape(-1).tolist()


def shift_pivots(source, destination, deltas_blender):
    if not os.environ.get('COLAB_RELEASE_TAG'):raise RuntimeError('Colab required for GLB bind editing')
    data = source.read_bytes();magic,version,length = struct.unpack_from('<4sII',data)
    if magic != b'glTF' or version != 2 or length != len(data):raise ValueError('Invalid GLB')
    chunks=[];offset=12
    while offset < len(data):
        size,kind = struct.unpack_from('<II',data,offset);offset+=8
        chunks.append((kind,data[offset:offset+size]));offset+=size
    if [kind for kind,_ in chunks] != [0x4e4f534a,0x004e4942]:raise ValueError('Self-contained JSON/BIN GLB required')
    document = json.loads(chunks[0][1]);binary = bytearray(chunks[1][1])
    if document.get('animations'):raise ValueError('Bind-only input required')
    original_nodes = copy.deepcopy(document['nodes']);world,parents = world_matrices(original_nodes)
    targets = {}
    for name,delta in deltas_blender.items():
        matches=[i for i,node in enumerate(original_nodes) if node.get('name') == name]
        if len(matches) != 1:raise ValueError('Joint name is not unique: '+name)
        index=matches[0];targets[index]=world[index].copy()
        # glTF Y-up to Blender Z-up is (x,y,z)->(x,-z,y).
        dx,dy,dz=delta;targets[index][:3,3] += [dx,dz,-dy]
    for index,new_world in targets.items():
        parent_world = targets.get(parents.get(index),world.get(parents.get(index),np.eye(4)))
        set_matrix(document['nodes'][index], np.linalg.inv(parent_world) @ new_world)
        for child in original_nodes[index].get('children',[]):
            set_matrix(document['nodes'][child],np.linalg.inv(new_world) @ targets.get(child,world[child]))
    changed_ranges=[];changed_ibm=[]
    for skin in document.get('skins',[]):
        accessor=document['accessors'][skin['inverseBindMatrices']];view=document['bufferViews'][accessor['bufferView']]
        if accessor['componentType'] != 5126 or accessor['type'] != 'MAT4' or 'sparse' in accessor or view.get('buffer',0) != 0:
            raise ValueError('Unsupported inverse bind accessor')
        stride=view.get('byteStride',64);base=view.get('byteOffset',0)+accessor.get('byteOffset',0)
        for joint_index,node_index in enumerate(skin['joints']):
            if node_index not in targets:continue
            position=base+joint_index*stride
            old=np.array(struct.unpack_from('<16f',binary,position)).reshape(4,4).T
            new=np.linalg.inv(targets[node_index]) @ world[node_index] @ old
            binary[position:position+64]=struct.pack('<16f',*new.T.reshape(-1))
            changed_ranges.append((position,position+64));changed_ibm.append(node_index)
    if set(changed_ibm) != set(targets):raise ValueError('All target joints must belong to a skin')
    after,_=world_matrices(document['nodes'])
    other_error=max(float(np.max(np.abs(after[i]-matrix))) for i,matrix in world.items() if i not in targets)
    axis_error=max(float(np.max(np.abs(after[i][:3,:3]-world[i][:3,:3]))) for i in targets)
    if other_error > 1e-12 or axis_error > 1e-12:raise ValueError('Unrelated world transform or target axis changed')
    if any(a != b and not any(low <= i < high for low,high in changed_ranges)
            for i,(a,b) in enumerate(zip(chunks[1][1],binary))):raise ValueError('Non-bind binary data changed')
    encoded=json.dumps(document,separators=(',',':')).encode();encoded+=b' '*((-len(encoded))%4)
    output=struct.pack('<4sII',b'glTF',2,12+8+len(encoded)+8+len(binary))
    output+=struct.pack('<II',len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(binary),0x004e4942)+binary
    destination.write_bytes(output)
    return {'unrelated_joint_max_matrix_error':other_error,'target_axis_max_matrix_error':axis_error,
        'binary_edits_only_target_inverse_binds':True,'mesh_weight_accessor_bytes_unchanged':True,
        'child_world_transforms_compensated':True,'inverse_bind_matrices_updated':len(changed_ibm)}
