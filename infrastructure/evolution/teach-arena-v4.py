"""Fit identity-conditioned teaching examples. Never imported by live inference.

The fixed numeric preferences are a transparent compilation of the authored
curriculum, not a claim that a small network reads natural-language paragraphs.
Run: python teach-arena-v4.py OUTPUT_FOLDER PLAYBOOK_V4 PARENT_FOUNDATION
"""
import hashlib
import json
import sys
from pathlib import Path
import torch
from torch import nn

torch.set_num_threads(2)
torch.manual_seed(73150)
torch.use_deterministic_algorithms(True)
book_bytes=Path(sys.argv[2]).read_bytes();book=json.loads(book_bytes)
parent_bytes=Path(sys.argv[3]).read_bytes();parent=json.loads(parent_bytes)
base=nn.Sequential(nn.Linear(48,32),nn.Tanh(),nn.Linear(32,1))
with torch.no_grad():
    base[0].weight.copy_(torch.tensor(parent['w1']));base[0].bias.copy_(torch.tensor(parent['b1']))
    base[2].weight.copy_(torch.tensor([parent['w2']]));base[2].bias.fill_(parent['b2'])
model=nn.Sequential(nn.Linear(224,32),nn.Tanh(),nn.Linear(32,1))
with torch.no_grad():
    model[0].weight.zero_();model[0].weight[:,:48].copy_(base[0].weight)
    model[0].bias.copy_(base[0].bias);model[2].load_state_dict(base[2].state_dict())
count=40096;heldout=4096
x=torch.zeros(count,224);x[:,:48]=torch.rand(count,48)
x[:,9:11]=x[:,9:11]*2-1;x[:,33]=x[:,33]*2-1;x[:,40]=x[:,40]*2-1
x[:,13:19]=(x[:,13:19]>.7).float();x[:,22:32]=0
kinds=torch.arange(count)%10;x[torch.arange(count),22+kinds]=1
x[:,35:37]=(x[:,35:37]>.8).float();x[:,42]=(x[:,42]>.8).float();x[:,47]=1
avatars=torch.arange(count)%45;targets=torch.randint(0,45,(count,))
x[torch.arange(count),48+avatars]=1;x[torch.arange(count),93+targets]=1
x[:,138:149]=torch.rand(count,11);x[:,138:142]=x[:,138:142]*2-1
for start in [149,179]:x[torch.arange(count),start+torch.randint(0,30,(count,))]=1
x[:,209:224]=torch.rand(count,15)
roles=['Tank','Fighter','Assassin','Mage','Marksman','Support']
for i,a in enumerate(book['avatars']):
    mask=avatars==i;x[mask,7]=(roles.index(a['role'])+1)/6
    for j,slot in enumerate(['skill1','skill2','ultimate']):
        selected=mask&(kinds==j+3);tags=a['abilities'][j]['tags']
        for k,key in enumerate(['control','protect','mobility','channel']):x[selected,217+k]=float(tags[key])
    x[mask&(kinds<3),217:221]=0
with torch.no_grad():score=base(x[:,:48]).squeeze(-1)
# These effects have explicit state-dependent tradeoffs; no slot is always best.
for i,a in enumerate(book['avatars']):
    own=avatars==i;preferences=a['example_preferences']
    for j in range(3):
        selected=own&(kinds==j+3);p=preferences[j]
        value=p*(.3+x[:,211])+.6*x[:,217]*x[:,212]+.65*x[:,218]*(1-x[:,12])
        value-=.5*x[:,220]*x[:,20]*(1-x[:,21]) # interruptible channel risk
        value-=.35*x[:,213]*x[:,217] # already-controlled target: timing matters
        value-=.35*x[:,43]*(1-x[:,1]) # scarce mana
        score+=selected.float()*value
    # Useful range/ally movement varies across archetypes, never a legal mask.
    if a['role'] in ('Tank','Support'):
        score+=own.float()*(kinds==1).float()*.3*x[:,14]*x[:,212]*(1-x[:,12])
    if a['role'] in ('Mage','Marksman'):
        score+=own.float()*(kinds==2).float()*.2*(1-x[:,19])
# Small card/context interactions teach that a card is an observation, not stats.
score+=.08*x[:,147]*x[:,217]+.06*x[:,142]*x[:,36]-.08*x[:,145]*x[:,19]
optimizer=torch.optim.Adam(model.parameters(),lr=.001)
for epoch in range(55):
    for indices in torch.randperm(count-heldout).split(512):
        loss=(model(x[indices]).squeeze(-1)-score[indices]).square().mean()
        optimizer.zero_grad();loss.backward();optimizer.step()
with torch.no_grad():mse=(model(x[-heldout:]).squeeze(-1)-score[-heldout:]).square().mean().item()
a,b=model[0],model[2]
policy={'kind':'arena-actor','version':2,'input':224,'hidden':32,'w1':a.weight.detach().tolist(),
        'b1':a.bias.detach().tolist(),'w2':b.weight.detach()[0].tolist(),'b2':b.bias.item()}
root=Path(sys.argv[1]);root.mkdir(parents=True,exist_ok=True)
evidence={'kind':'instructional-initialization','revision':4,'seed':73150,'synthetic_examples':count-heldout,
          'heldout_examples':heldout,'imitation_mse':mse,'gameplay_improvement_measured':False,'live_teacher_used':False,
          'playbook_version':4,'playbook_sha256':hashlib.sha256(book_bytes).hexdigest(),
          'parent_foundation_sha256':hashlib.sha256(parent_bytes).hexdigest(),'roles':6,'avatars':45,
          'identity_schema':'arena-identity-224-v2','reward':book['rewards']['version'],
          'video_examples':0,'limitations':['Synthetic examples are authored teaching, not observed expert matches.',
          'Natural-language directions are displayed; numeric preferences and traits generate the fitted examples.',
          'Independent complete-match improvement and per-pair mastery remain unproven.']}
for name,value in [('arenaFoundation.json',policy),('arenaFoundationTeaching.json',evidence)]:
    with (root/name).open('x',encoding='utf-8') as f:json.dump(value,f,separators=(',',':') if name=='arenaFoundation.json' else None,indent=None if name=='arenaFoundation.json' else 2)
print(json.dumps(evidence))
