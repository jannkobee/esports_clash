"""Conservative humanoid rest-skeleton matching; no numeric bone conventions.
Coordinates are Blender world-space: Z up, character forward approximately -Y.
Unsupported or ambiguous anatomy is returned for human review, never guessed.
"""
import math

NATIVE = ('Root','Hips','Spine','Chest','Head','UpperArmL','ForearmL','HandL','UpperArmR','ForearmR','HandR','ThighL','CalfL','FootL','ThighR','CalfR','FootR')

def infer_humanoid(bones):
    evidence={'method':'humanoid-topology-rest-v1','accepted':False,'reasons':[]}
    def reject(reason):
        evidence['reasons'].append(reason)
        return {}, evidence
    if len(bones)<17 or len(bones)>256:return reject('Expected a bounded humanoid skeleton (17?256 bones).')
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
    root=roots[0]
    if len(children[root])!=1:return reject('Root must have one pelvis branch; extra roots need review.')
    hips=children[root][0]
    if len(children[hips])!=3:return reject('Pelvis must split into one torso and two leg chains.')
    torso=[n for n in children[hips] if pos(n)[2]>pos(hips)[2]+height*.04]
    legs=[n for n in children[hips] if pos(n)[2]<pos(hips)[2]-height*.025]
    if len(torso)!=1 or len(legs)!=2:return reject('Pelvis branches do not have distinct torso/leg positions.')
    spine=torso[0];chest=spine;seen={root,hips}
    while len(children[chest])==1:
        if chest in seen:return reject('Cyclic skeleton.')
        seen.add(chest);chest=children[chest][0]
    if chest==spine or len(children[chest])!=3:return reject('Expected a separate spine/chest with two arms and head.')
    head_paths=[];arm_paths=[]
    for start in children[chest]:
        chain=[start]
        while len(children[chain[-1]])==1 and len(chain)<16:
            nxt=children[chain[-1]][0]
            if nxt in chain:return reject('Cyclic chain.')
            chain.append(nxt)
        if pos(start)[2]>pos(chest)[2]+height*.015:
            head_paths.append(chain)
        else:arm_paths.append(chain)
    if len(head_paths)!=1 or len(arm_paths)!=2:return reject('Chest has no unambiguous head and arm branches.')
    # Optional neck precedes head; refuse long head/accessory chains.
    if len(head_paths[0])>2:return reject('Head/neck chain is ambiguous.')
    head=head_paths[0][-1]
    result={'Root':root,'Hips':hips,'Spine':spine,'Chest':chest,'Head':head}
    def side(n):return 'L' if pos(n)[0]>pos(hips)[0] else 'R'
    arm_sides=[]
    for chain in arm_paths:
        # Either shoulder->elbow->wrist or clavicle->shoulder->elbow->wrist.
        if len(chain) not in (3,4):return reject('Arm chain must resolve shoulder, elbow and wrist with optional clavicle.')
        upper,fore,hand=chain[-3:];s=side(upper);arm_sides.append(s)
        if abs(pos(upper)[0]-pos(hips)[0])<height*.05:return reject('Shoulder side is ambiguous.')
        if not all((pos(n)[0]-pos(hips)[0])*(1 if s=='L' else -1)>height*.03 for n in (upper,fore,hand)):return reject('Arm crosses the body in the reference pose.')
        for a,b in ((upper,fore),(fore,hand)):
            if not .06<math.dist(pos(a),pos(b))/height<.4:return reject('Arm segment proportions require review.')
        for native,n in zip(('UpperArm','Forearm','Hand'),(upper,fore,hand)):result[native+s]=n
    if set(arm_sides)!={'L','R'}:return reject('Arms are not on opposing sides.')
    leg_sides=[];toe_vectors=[]
    for thigh in legs:
        chain=[thigh]
        while len(children[chain[-1]])==1 and len(chain)<8:chain.append(children[chain[-1]][0])
        if len(chain)!=4:return reject('Leg must have a clear thigh, knee, ankle and toe chain for facing validation.')
        thigh,calf,foot,toe=chain;s=side(thigh);leg_sides.append(s)
        if abs(pos(thigh)[0]-pos(hips)[0])<height*.025:return reject('Leg side is ambiguous.')
        if not(pos(thigh)[2]>pos(calf)[2]+height*.08 and pos(calf)[2]>pos(foot)[2]+height*.08):return reject('Leg joint heights are incompatible with an upright humanoid.')
        for a,b in ((thigh,calf),(calf,foot)):
            length=math.dist(pos(a),pos(b))/height
            if not .10<length<.45:return reject('Leg segment proportions require review.')
        toe_vectors.append([pos(toe)[i]-pos(foot)[i] for i in range(2)])
        for native,n in zip(('Thigh','Calf','Foot'),(thigh,calf,foot)):result[native+s]=n
    if set(leg_sides)!={'L','R'}:return reject('Legs are not on opposing sides.')
    for vector in toe_vectors:
        length=math.hypot(*vector)
        if length<height*.015 or -vector[1]/length<.55:return reject('Toe direction cannot confirm forward -Y; review orientation and left/right.')
    if len(result)!=17 or len(set(result.values()))!=17:return reject('Mapping is incomplete or not one-to-one.')
    evidence['warnings']=[]
    for hand in (result['HandL'],result['HandR']):
        for child in children[hand]:
            if math.dist(pos(hand),pos(child))/height>.35:evidence['warnings'].append('Long hand attachment branch '+child+' requires equipment/influence review.')
    evidence.update(accepted=True,checks=['single root and pelvis','distinct torso/head/arm branches','opposite limb sides','leg proportions','toe-confirmed facing','17 unique joints'],bone_map=result)
    return result,evidence
