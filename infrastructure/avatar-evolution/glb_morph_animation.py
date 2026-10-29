"""Colab-only standard glTF weight channels for diagnostic corrective clips.

Format: https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#animations
The four position/normal targets stay within glTF's recommended eight morphed
attributes. No custom Babylon shader or runtime bone modification is required.
"""
import copy,json,math,os,struct


def read_glb(path):
    data=path.read_bytes();magic,version,size=struct.unpack_from('<4sII',data)
    if magic!=b'glTF' or version!=2 or size!=len(data):raise ValueError('Invalid GLB')
    length,kind=struct.unpack_from('<II',data,12)
    if kind!=0x4e4f534a:raise ValueError('JSON chunk missing')
    document=json.loads(data[20:20+length]);offset=20+length
    length,kind=struct.unpack_from('<II',data,offset)
    if kind!=0x004e4942:raise ValueError('Self-contained BIN required')
    return document,bytearray(data[offset+8:offset+8+length])


def write_glb(path,document,binary):
    document['buffers'][0]['byteLength']=len(binary)
    text=json.dumps(document,separators=(',',':')).encode();text+=b' '*((-len(text))%4)
    binary+=b'\0'*((-len(binary))%4)
    path.write_bytes(struct.pack('<4sII',b'glTF',2,28+len(text)+len(binary))+
        struct.pack('<II',len(text),0x4e4f534a)+text+struct.pack('<II',len(binary),0x004e4942)+binary)


def corrective_weight(degrees,midpoint):
    angle=max(0.,min(90.,degrees))
    return midpoint*angle/45 if angle<=45 else midpoint+(1-midpoint)*(angle-45)/45


def normalize_static_skinned_roots(path):
    """Only promote meshes under static identity wrappers; never reparent joints."""
    if not os.environ.get('COLAB_RELEASE_TAG'):raise RuntimeError('Colab required for GLB layout normalization')
    document,binary=read_glb(path);nodes=document['nodes'];parents={child:i for i,n in enumerate(nodes) for child in n.get('children',[])}
    joints={i for skin in document.get('skins',[]) for i in skin['joints']};old_animations=copy.deepcopy(document.get('animations',[]));moved=[]
    def identity(node):
        return (all(abs(a-b)<=1e-12 for a,b in zip(node.get('matrix',[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]),[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]))
            and node.get('translation',[0,0,0])==[0,0,0] and node.get('rotation',[0,0,0,1])==[0,0,0,1] and node.get('scale',[1,1,1])==[1,1,1])
    for i,node in enumerate(nodes):
        if 'skin' not in node or i not in parents:continue
        if i in joints or not identity(node):raise ValueError('Skinned mesh normalization requires a non-joint identity node')
        ancestors=[];current=parents[i]
        while True:
            ancestors.append(current)
            if not identity(nodes[current]):raise ValueError('Nonidentity skinned wrapper requires a separate bind study')
            if current not in parents:break
            current=parents[current]
        if any(c['target']['node'] in [i,*ancestors] and c['target']['path'] in ('translation','rotation','scale') for a in old_animations for c in a['channels']):
            raise ValueError('Animated wrappers cannot be normalized by this static pilot')
        nodes[parents[i]]['children'].remove(i)
        for scene in document['scenes']:
            if ancestors[-1] in scene.get('nodes',[]) and i not in scene['nodes']:scene['nodes'].append(i)
        moved.append({'mesh_node':i,'old_parent':parents[i]})
    after={child:i for i,n in enumerate(nodes) for child in n.get('children',[])}
    if any(parents.get(i)!=after.get(i) for i in joints) or old_animations!=document.get('animations',[]):raise ValueError('Normalization changed joint hierarchy or animation tracks')
    write_glb(path,document,binary)
    return {'promoted_mesh_nodes':moved,'joint_hierarchy_unchanged':True,'animation_tracks_unchanged':True,'static_identity_wrappers_verified':True}


def add_weight_channels(path,recipe,source_sha256,sampled_weights):
    if not os.environ.get('COLAB_RELEASE_TAG'):raise RuntimeError('Colab required for morph animation baking')
    document,binary=read_glb(path);names=[item['target'] for item in recipe['joints']]
    nodes=[]
    for index,node in enumerate(document['nodes']):
        if 'mesh' not in node:continue
        mesh=document['meshes'][node['mesh']]
        if mesh.get('extras',{}).get('targetNames')==names:nodes.append(index)
    if len(nodes)!=1:raise ValueError('Exactly one matching four-target mesh node required')
    node_index=nodes[0];document['nodes'][node_index]['weights']=[0.]*len(names)
    document['meshes'][document['nodes'][node_index]['mesh']].pop('weights',None)
    proof=[]
    def append_scalar(values,with_bounds=False):
        binary.extend(b'\0'*((-len(binary))%4));offset=len(binary)
        data=struct.pack('<'+'f'*len(values),*values);binary.extend(data)
        view_index=len(document['bufferViews']);document['bufferViews'].append({'buffer':0,'byteOffset':offset,'byteLength':len(data)})
        accessor={'bufferView':view_index,'componentType':5126,'count':len(values),'type':'SCALAR'}
        if with_bounds:accessor.update(min=[min(values)],max=[max(values)])
        index=len(document['accessors']);document['accessors'].append(accessor);return index
    expected={'Stress_'+role for role in ['UpperArmL','UpperArmR','ForearmL','ForearmR','ThighL','ThighR','CalfL','CalfR']}
    if {a['name'] for a in document.get('animations',[])}!=expected:raise ValueError('All eight diagnostic clips required')
    for animation in document['animations']:
        if any(c['target']['path']=='weights' for c in animation['channels']):raise ValueError('Unexpected preexisting morph channels')
        limits=[]
        for sampler in animation['samplers']:
            accessor=document['accessors'][sampler['input']];view=document['bufferViews'][accessor['bufferView']]
            if accessor['type']!='SCALAR' or accessor['componentType']!=5126:raise ValueError('Float scalar times required')
            start=view.get('byteOffset',0)+accessor.get('byteOffset',0);stride=view.get('byteStride',4)
            limits.extend([struct.unpack_from('<f',binary,start)[0],struct.unpack_from('<f',binary,start+(accessor['count']-1)*stride)[0]])
        samples=sampled_weights[animation['name']];times=samples['times'];rows=samples['weights']
        if len(times)<2 or any(b<=a for a,b in zip(times,times[1:])) or len(rows)!=len(times) or any(len(row)!=len(names) for row in rows):
            raise ValueError('Invalid sampled corrective weight coverage')
        if abs(times[0]-min(limits))>1e-6 or abs(times[-1]-max(limits))>1e-6:raise ValueError('Bone and corrective timelines differ')
        weights=[float(value) for row in rows for value in row]
        if any(not math.isfinite(w) or not 0<=w<=1 for w in weights):raise ValueError('Invalid corrective weights')
        input_index=append_scalar(times,True);accessor_index=append_scalar(weights)
        sampler_index=len(animation['samplers']);animation['samplers'].append({'input':input_index,'output':accessor_index,'interpolation':'LINEAR'})
        animation['channels'].append({'sampler':sampler_index,'target':{'node':node_index,'path':'weights'}})
        proof.append({'clip':animation['name'],'frames':len(times),'morph_targets':len(names),'weight_values':len(weights)})
    document.setdefault('asset',{}).setdefault('extras',{})['correctiveBake']={'source_candidate_sha256':source_sha256,'recipe':recipe}
    write_glb(path,document,binary)
    return {'morph_channels':proof,'target_names':names,'source_candidate_sha256':source_sha256}
