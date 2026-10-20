"""Conservative humanoid rest-skeleton matching; no numeric bone conventions.
Coordinates are Blender world-space: Z up, character forward approximately -Y.
Unsupported or ambiguous anatomy is returned for human review, never guessed.
"""
import math

NATIVE = ('Root','Hips','Spine','Chest','Head','UpperArmL','ForearmL','HandL','UpperArmR','ForearmR','HandR','ThighL','CalfL','FootL','ThighR','CalfR','FootR')

def infer_humanoid(bones):
    evidence={'method':'humanoid-topology-rest-v2','accepted':False,'reasons':[],'warnings':[]}
    def reject(reason):
        evidence['reasons'].append(reason)
        return {}, evidence
    if len(bones)<17 or len(bones)>256:return reject('Expected a bounded humanoid skeleton (17-256 bones).')
    names={b['name']:b for b in bones}
    if len(names)!=len(bones):return reject('Duplicate bone names.')
    children={name:[] for name in names}
    for b in bones:
        p=b.get('parent')
        if p in names:children[p].append(b['name'])
        if len(b['position'])!=3 or not all(math.isfinite(v) for v in b['position']):return reject('Non-finite joint coordinates.')
    roots=[n for n,b in names.items() if b.get('parent') not in names]
    if len(roots)!=1:return reject('Expected one skeleton root.')
    def pos(n):return names[n]['position']
    height=max(pos(n)[2] for n in names)-min(pos(n)[2] for n in names)
    if height<1e-6:return reject('Degenerate skeleton height.')
    def subtree_size(n):
        total=1
        stack=[n]
        seen={n}
        while stack:
            curr=stack.pop()
            for c in children[curr]:
                if c not in seen:
                    seen.add(c);total+=1;stack.append(c)
        return total

    root=roots[0]
    if not children[root]:return reject('Root has no child branches.')
    if len(children[root])==1:
        hips=children[root][0]
    else:
        pelvis_candidates=[
            c for c in children[root]
            if len([n for n in children[c] if pos(n)[2]>pos(c)[2]+height*.025])>=1
            and len([n for n in children[c] if pos(n)[2]<pos(c)[2]-height*.015])>=2
        ]
        if len(pelvis_candidates)!=1:
            return reject('Root must have one unambiguous pelvis branch; extra roots need review.')
        hips=pelvis_candidates[0]
        extra_roots=[c for c in children[root] if c!=hips]
        evidence['warnings'].append('Extra root helper/garment branches consolidated: '+', '.join(extra_roots))

    torso=[n for n in children[hips] if pos(n)[2]>pos(hips)[2]+height*.025 and subtree_size(n)>=5]
    if not torso:
        torso=[n for n in children[hips] if pos(n)[2]>pos(hips)[2]+height*.025]
    legs=[n for n in children[hips] if pos(n)[2]<pos(hips)[2]-height*.015 and subtree_size(n)>=3]
    if not legs:
        legs=[n for n in children[hips] if pos(n)[2]<pos(hips)[2]-height*.015]
    if len(torso)!=1 or len(legs)!=2:return reject('Pelvis branches do not have distinct torso/leg positions.')
    spine=torso[0];chest=spine;seen={root,hips}
    while True:
        if chest in seen:return reject('Cyclic skeleton.')
        seen.add(chest)
        if len(children[chest])==1:
            chest=children[chest][0]
            continue
        major=[c for c in children[chest] if subtree_size(c)>=2 and pos(c)[2]>pos(chest)[2]+height*.01]
        if len(major)==1 and subtree_size(major[0])>=6 and len([c for c in children[chest] if c!=major[0] and subtree_size(c)>=3])==0:
            chest=major[0]
            continue
        break
    if chest==spine or len(children[chest])<3:return reject('Expected a separate spine/chest with two arms and head.')
    head_paths=[];arm_paths=[]
    for start in children[chest]:
        chain=[start]
        while len(children[chain[-1]])==1 and len(chain)<16:
            nxt=children[chain[-1]][0]
            if nxt in chain:return reject('Cyclic chain.')
            chain.append(nxt)
        if pos(start)[2]>pos(chest)[2]+height*.015 and abs(pos(start)[0]-pos(hips)[0])<height*.12:
            head_paths.append(chain)
        elif subtree_size(start)>=3:
            arm_paths.append(chain)
    if len(head_paths)!=1 or len(arm_paths)!=2:return reject('Chest has no unambiguous head and arm branches.')
    # Resolve neck/head even if hair, ponytail, or crown branches split off the head joint.
    head_chain=head_paths[0]
    if len(head_chain)<=2:
        head=head_chain[-1]
    else:
        # If single-child chain continues into a downward ponytail/hair, stop at the highest Z joint in first 2 bones.
        head=head_chain[1] if pos(head_chain[1])[2]>=pos(head_chain[0])[2] else head_chain[0]
    result={'Root':root,'Hips':hips,'Spine':spine,'Chest':chest,'Head':head}
    def side(n):return 'L' if pos(n)[0]>pos(hips)[0] else 'R'
    arm_sides=[]
    for chain in arm_paths:
        if len(chain)>4:
            # Trim finger tail when hand has a single finger chain
            chain=chain[:4] if abs(pos(chain[0])[0]-pos(hips)[0])<abs(pos(chain[1])[0]-pos(hips)[0])*.75 else chain[:3]
        if len(chain) not in (3,4):return reject('Arm chain must resolve shoulder, elbow and wrist with optional clavicle.')
        upper,fore,hand=chain[-3:];s=side(upper);arm_sides.append(s)
        if abs(pos(upper)[0]-pos(hips)[0])<height*.04:return reject('Shoulder side is ambiguous.')
        if not all((pos(n)[0]-pos(hips)[0])*(1 if s=='L' else -1)>height*.02 for n in (upper,fore,hand)):return reject('Arm crosses the body in the reference pose.')
        for a,b in ((upper,fore),(fore,hand)):
            if not .05<math.dist(pos(a),pos(b))/height<.45:return reject('Arm segment proportions require review.')
        for native,n in zip(('UpperArm','Forearm','Hand'),(upper,fore,hand)):result[native+s]=n
    if set(arm_sides)!={'L','R'}:return reject('Arms are not on opposing sides.')
    leg_sides=[];toe_vectors=[]
    for thigh_start in legs:
        chain=[thigh_start]
        while len(children[chain[-1]])==1 and len(chain)<8:chain.append(children[chain[-1]][0])
        if len(chain)<3:return reject('Leg must have a clear thigh, knee, and ankle chain.')
        thigh,calf,foot=chain[0],chain[1],chain[2]
        toe=chain[3] if len(chain)>=4 else (children[foot][0] if children[foot] else None)
        if not toe:return reject('Leg must have a clear thigh, knee, ankle and toe chain for facing validation.')
        s=side(thigh);leg_sides.append(s)
        if abs(pos(thigh)[0]-pos(hips)[0])<height*.02:return reject('Leg side is ambiguous.')
        if not(pos(thigh)[2]>pos(calf)[2]+height*.06 and pos(calf)[2]>pos(foot)[2]+height*.06):return reject('Leg joint heights are incompatible with an upright humanoid.')
        for a,b in ((thigh,calf),(calf,foot)):
            length=math.dist(pos(a),pos(b))/height
            if not .08<length<.48:return reject('Leg segment proportions require review.')
        toe_vectors.append([pos(toe)[i]-pos(foot)[i] for i in range(2)])
        for native,n in zip(('Thigh','Calf','Foot'),(thigh,calf,foot)):result[native+s]=n
    if set(leg_sides)!={'L','R'}:return reject('Legs are not on opposing sides.')
    forward_scores=[]
    for vector in toe_vectors:
        length=math.hypot(*vector)
        if length<height*.012:return reject('Toe direction cannot confirm forward -Y; review orientation and left/right.')
        forward_scores.append(-vector[1]/length)
    if min(forward_scores)<.20 or sum(forward_scores)/len(forward_scores)<.40:
        return reject('Toe direction cannot confirm forward -Y; review orientation and left/right.')
    if len(result)!=17 or len(set(result.values()))!=17:return reject('Mapping is incomplete or not one-to-one.')
    for hand in (result['HandL'],result['HandR']):
        for child in children[hand]:
            if math.dist(pos(hand),pos(child))/height>.35:evidence['warnings'].append('Long hand attachment branch '+child+' requires equipment/influence review.')
    evidence.update(accepted=True,checks=['single root and pelvis','distinct torso/head/arm branches','opposite limb sides','leg proportions','toe-confirmed facing','17 unique joints'],bone_map=result)
    return result,evidence
