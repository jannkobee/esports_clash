"""Compile the human play brief into synthetic instructional examples, then fit
an initial actor. This teacher is never called by live policy inference.
These examples establish starting competence, not measured gameplay improvement.
"""
import json
import sys
from pathlib import Path
import torch
from torch import nn

torch.set_num_threads(2);torch.manual_seed(73148);torch.use_deterministic_algorithms(True)
model=nn.Sequential(nn.Linear(48,32),nn.Tanh(),nn.Linear(32,1))
count=24000
x=torch.rand(count,48)
x[:,9:11]=x[:,9:11]*2-1;x[:,33]=x[:,33]*2-1;x[:,40]=x[:,40]*2-1
x[:,13:19]=(x[:,13:19]>.7).float();x[:,22:32]=0
kind=torch.arange(count)%10;x[torch.arange(count),22+kind]=1
x[:,35:37]=(x[:,35:37]>.8).float();x[:,42]=(x[:,42]>.8).float();x[:,47]=1
# Instructional scoring supplies examples only. No bound here becomes an action mask.
health=x[:,0];mana=x[:,1];enemy=x[:,13];structure=x[:,16];minion=x[:,15]
score=torch.full((count,),-.4)
score=torch.where(kind==1,.45+.65*x[:,40]+.22*structure+.15*minion-.15*x[:,11]
                  -1.0*x[:,19]*(1-health)+x[:,18]*(1-health)*1.2,score)
score=torch.where(kind==2,1.45+.25*(1-x[:,12])+.2*minion+.15*structure,score)
score=torch.where((kind>=3)&(kind<=5),.05+1.1*enemy+.5*x[:,20]+.2*x[:,44]-.3*x[:,43]+.2*(1-x[:,12])+.6*x[:,14]+.8*x[:,14]*(1-x[:,12]),score)
score=torch.where(kind==6,-.7+2.7*(1-health)+.5*(1-mana)-.7*x[:,18],score)
score=torch.where((kind==0)&(x[:,42]>.5),1.8+1.2*(1-health)-.7*x[:,20],score)
score=torch.where(kind==7,-.2+.3*x[:,20],score)
score=torch.where(kind==8,-.05+.1*mana,score)
score=torch.where(kind==9,.1,score)
score-=.7*x[:,19]*(1-health)
optimizer=torch.optim.Adam(model.parameters(),lr=.003)
for epoch in range(45):
    for indices in torch.randperm(count-2048).split(512):
        loss=(model(x[indices]).squeeze(-1)-score[indices]).square().mean()
        optimizer.zero_grad();loss.backward();optimizer.step()
with torch.no_grad():mse=(model(x[-2048:]).squeeze(-1)-score[-2048:]).square().mean().item()
first,last=model[0],model[2]
policy={'kind':'arena-actor','version':1,'input':48,'hidden':32,'w1':first.weight.detach().tolist(),
        'b1':first.bias.detach().tolist(),'w2':last.weight.detach()[0].tolist(),'b2':last.bias.item()}
root=Path(sys.argv[1]);root.mkdir(parents=True,exist_ok=True)
with (root/'arenaFoundation.json').open('x') as file:json.dump(policy,file,separators=(',',':'))
evidence={'kind':'instructional-initialization','seed':73148,'synthetic_examples':count-2048,'heldout_examples':2048,
          'imitation_mse':mse,'gameplay_improvement_measured':False,'live_teacher_used':False,'revision':2,'parent':'instructional-foundation-v1',
          'brief':['Win as a team by destroying the opposing Nexus.','Observe only information available to your team.',
                   'Move, attack, cast, recall and place wards through the legal command interface.',
                   'Use nearby farming and structures to make progress; use spells when they offer value.',
                   'Notice health, mana and tower danger; experience may teach exceptions to the starting advice.',
                   'Complete a useful recall channel unless changing circumstances warrant cancelling it.',
                   'Winning matches matters more than accumulating damage or gold without finishing.']}
with (root/'arenaFoundationTeaching.json').open('x') as file:json.dump(evidence,file,indent=2)
print(json.dumps({'imitation_mse':mse,'examples':count,'competitive_improvement':False}))
