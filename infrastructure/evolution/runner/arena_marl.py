"""Shared command scorer with a training-only centralized critic.

Legal command sets vary by actor and time. Short on-policy unrolls bootstrap the
critic; only actual engine terminations receive a win/loss terminal reward.
"""
import math
import base64
import zlib
import torch
from torch import nn
from torch.distributions import Categorical
from marl import Learner

CONFIG={'version':2,'algorithm':'shared-command-scorer-PPO','clip':.2,'epochs':4,'lr':.0003,
        'entropy':.01,'value':.5,'gae_lambda':.95,'reward':'terminal-potential-v1',
        'gamma_second':.999,'max_grad_norm':.5,'batch':64,'inputs':48,'hidden':32}


class ArenaLearner(Learner):
    def __init__(self,seed,inputs=48,version=None,reward_version='terminal-potential-v1'):
        if inputs not in (48,224):raise ValueError('Unsupported arena observation schema')
        self.version=version if version is not None else (2 if inputs==224 else 1)
        if (inputs,self.version) not in ((48,1),(224,2),(224,3)):raise ValueError('Unsupported arena schema/version pair')
        self.outcome_rewards=reward_version=='terminal-potential-outcomes-v2'
        if reward_version not in ('terminal-potential-v1','terminal-potential-outcomes-v2') or (self.outcome_rewards and self.version!=3):
            raise ValueError('Incompatible arena reward version')
        self.inputs=inputs;self.critic_inputs=7 if self.version==2 or self.outcome_rewards else 6
        self.config={**CONFIG,**({'version':3,'inputs':224,'reward':'terminal-potential-mastery-v2','critic_inputs':7} if self.version==2 else
                                {'version':4,'inputs':224,'reward':'terminal-potential-v1','critic_inputs':6} if self.version==3 else {})}
        if self.outcome_rewards:self.config.update(version=5,reward=reward_version,critic_inputs=7,gamma_second=.9998,gae_lambda=.98)
        torch.set_num_threads(1);torch.manual_seed(seed);torch.use_deterministic_algorithms(True)
        self.actor=nn.Sequential(nn.Linear(inputs,32),nn.Tanh(),nn.Linear(32,1))
        self.critic=nn.Sequential(nn.Linear(self.critic_inputs,16),nn.Tanh(),nn.Linear(16,1))
        self.optimizer=torch.optim.Adam(list(self.actor.parameters())+list(self.critic.parameters()),lr=CONFIG['lr'])
        self.updates=0

    def export(self):
        a,b=self.actor[0],self.actor[2]
        return {'kind':'arena-actor','version':self.version,'input':self.inputs,'hidden':32,'w1':a.weight.detach().tolist(),
                'b1':a.bias.detach().tolist(),'w2':b.weight.detach()[0].tolist(),'b2':b.bias.item()}

    def initialize_actor(self,p):
        if p.get('kind')!='arena-actor' or p.get('input')!=self.inputs or p.get('version')!=self.version:raise ValueError('Compatible arena actor required')
        with torch.no_grad():
            self.actor[0].weight.copy_(torch.tensor(p['w1']));self.actor[0].bias.copy_(torch.tensor(p['b1']))
            self.actor[2].weight.copy_(torch.tensor([p['w2']]));self.actor[2].bias.fill_(p['b2'])

    def save(self,path,metadata):
        temporary=path.with_suffix('.tmp')
        torch.save({'config':self.config,'actor':self.actor.state_dict(),'critic':self.critic.state_dict(),
                    'optimizer':self.optimizer.state_dict(),'rng':torch.get_rng_state(),
                    'updates':self.updates,'metadata':metadata},temporary);temporary.replace(path)

    def load(self,path,metadata):
        state=torch.load(path,weights_only=True,map_location='cpu')
        if state['config']!=self.config or state['metadata']!=metadata:raise ValueError('Checkpoint provenance mismatch')
        self.actor.load_state_dict(state['actor']);self.critic.load_state_dict(state['critic'])
        self.optimizer.load_state_dict(state['optimizer']);torch.set_rng_state(state['rng']);self.updates=state['updates']

    def candidates(self,row):
        if 'features_b64' in row or 'features_zlib_b64' in row:
            n=row['candidate_count']
            if type(n) is not int or not 1<=n<=256:raise ValueError('Invalid command count')
            if 'features_zlib_b64' in row:
                if 'features_b64' in row or row.get('feature_encoding')!='float32le-zlib-v1':raise ValueError('Invalid compressed feature encoding')
                decoder=zlib.decompressobj();expected=n*self.inputs*4
                data=bytearray(decoder.decompress(base64.b64decode(row['features_zlib_b64'],validate=True),expected+1))
                if not decoder.eof or decoder.unconsumed_tail or decoder.unused_data:raise ValueError('Invalid compressed command features')
            else:data=bytearray(base64.b64decode(row['features_b64'],validate=True))
            if len(data)!=n*self.inputs*4:raise ValueError('Invalid packed command features')
            return torch.frombuffer(data,dtype=torch.float32).reshape(n,self.inputs)
        candidates=row['candidates']
        if not 1<=len(candidates)<=256 or any(len(c)!=self.inputs for c in candidates):raise ValueError('Invalid command features')
        return torch.tensor(candidates)

    def distribution(self,rows):
        # Padding is masked. Candidate order is the exact order used by JS.
        candidates=[self.candidates(r) for r in rows];length=max(len(c) for c in candidates)
        features=torch.zeros(len(rows),length,self.inputs);mask=torch.zeros(len(rows),length,dtype=torch.bool)
        for i,c in enumerate(candidates):
            n=len(c);features[i,:n]=c;mask[i,:n]=True
        return Categorical(logits=self.actor(features).squeeze(-1).masked_fill(~mask,-1e9))

    def update(self,episodes,learning_team=None):
        rows=[]
        for episode in episodes:
            if episode['episode']['status'] not in ('terminal','censored'):raise ValueError('Interrupted unroll cannot train')
            grouped={}
            for r in episode['rows']:
                if learning_team and r['team']!=learning_team:continue
                grouped.setdefault(r['actor'],[]).append(r)
            for trajectory in grouped.values():
                previous=-1
                for r in trajectory:
                    if r['second']<=previous or not 0<=r['elapsed']<=1200 or (r['elapsed']==0 and r['terminal'] is not True):raise ValueError('Unordered arena trajectory')
                    previous=r['second'];candidates=self.candidates(r)
                    if not torch.isfinite(candidates).all():raise ValueError('Nonfinite arena features')
                    if type(r['action']) is not int or not 0<=r['action']<len(candidates):raise ValueError('Illegal command index')
                    if len(r['state'])!=self.critic_inputs or len(r['nextState'])!=self.critic_inputs:raise ValueError('Invalid critic state')
                    values=r['state']+r['nextState']+[r['reward'],r['logp'],r['discount']]
                    if not all(math.isfinite(v) for v in values):raise ValueError('Nonfinite arena transition')
                    if not 0<=r['discount']<=1 or abs(r['discount']-self.config['gamma_second']**r['elapsed'])>1e-7:
                        raise ValueError('Reward discount mismatch')
                    if self.outcome_rewards:self.validate_outcome_reward(r,episode['episode'])
                if episode['episode']['status']=='terminal' and not trajectory[-1]['terminal']:raise ValueError('Unclosed terminal trajectory')
                with torch.no_grad():
                    states=torch.tensor([r['state'] for r in trajectory]);following=torch.tensor([r['nextState'] for r in trajectory])
                    values=self.critic(states).squeeze(-1);next_values=self.critic(following).squeeze(-1)
                advantage=0.
                for i in reversed(range(len(trajectory))):
                    row=dict(trajectory[i]);discount=0. if row['terminal'] else row['discount']
                    delta=row['reward']+discount*next_values[i].item()-values[i].item()
                    advantage=delta+discount*self.config['gae_lambda']**row['elapsed']*advantage
                    row['advantage']=advantage;row['return']=advantage+values[i].item();rows.append(row)
        if len(rows)<2:return {'updated':False,'reason':'insufficient-transitions','transitions':len(rows)}
        # Check every command probability before changing any parameter.
        with torch.no_grad():
            for start in range(0,len(rows),CONFIG['batch']):
                batch=rows[start:start+CONFIG['batch']]
                actual=self.distribution(batch).log_prob(torch.tensor([r['action'] for r in batch]))
                if (actual-torch.tensor([r['logp'] for r in batch])).abs().max().item()>1e-4:
                    raise ValueError('Off-policy or JS/torch arena inference mismatch')
        advantages=torch.tensor([r['advantage'] for r in rows]);advantages=(advantages-advantages.mean())/(advantages.std(unbiased=False)+1e-8)
        for _ in range(CONFIG['epochs']):
            for indices in torch.randperm(len(rows)).split(CONFIG['batch']):
                batch=[rows[i] for i in indices.tolist()];distribution=self.distribution(batch)
                actions=torch.tensor([r['action'] for r in batch]);old=torch.tensor([r['logp'] for r in batch])
                ratio=(distribution.log_prob(actions)-old).exp();adv=advantages[indices]
                actor_loss=-torch.minimum(ratio*adv,ratio.clamp(1-CONFIG['clip'],1+CONFIG['clip'])*adv).mean()
                value_loss=(self.critic(torch.tensor([r['state'] for r in batch])).squeeze(-1)-torch.tensor([r['return'] for r in batch])).square().mean()
                entropy=distribution.entropy().mean();loss=actor_loss+CONFIG['value']*value_loss-CONFIG['entropy']*entropy
                if not torch.isfinite(loss):raise ValueError('Nonfinite arena optimization')
                self.optimizer.zero_grad();loss.backward()
                nn.utils.clip_grad_norm_(list(self.actor.parameters())+list(self.critic.parameters()),CONFIG['max_grad_norm']);self.optimizer.step()
        self.updates+=1
        identities={}
        reward_components={}
        for row in rows:
            for key,value in row.get('components',{}).items():reward_components[key]=reward_components.get(key,0.)+value
            identity=row.get('identity')
            if not identity:continue
            key=identity['cardId']+':'+identity['avatarId']
            entry=identities.setdefault(key,{**identity,'transitions':0,'mastery_shaping_sum':0.,'terminal_outcome_sum':0.})
            entry['transitions']+=1;entry['mastery_shaping_sum']+=row['components']['mastery'];entry['terminal_outcome_sum']+=row['components']['outcome']
        return {'updated':True,'transitions':len(rows),'actor_loss':actor_loss.item(),'value_loss':value_loss.item(),
                'entropy':entropy.item(),'updates':self.updates,'unrolls':len(episodes),'competitive_improvement_measured':False,
                'identity_experience':list(identities.values()),'reward_version':self.config['reward'],
                'reward_components':reward_components,'reward_gamma_second':self.config['gamma_second']}

    def validate_outcome_reward(self,row,episode):
        """Recompute the frozen TS reward from the actual critic outcomes.
        Training outcomes are not independent performance evidence.
        """
        if row.get('rewardVersion')!='terminal-potential-outcomes-v2':raise ValueError('Outcome reward version mismatch')
        keys=['structures','economy','trades','health','dragon','siege','mana'];weights=[.5,.15,.15,.1,.04,.04,.02]
        before=row['state'];after=row['nextState'];c=row['components'];discount=row['discount']
        if any(abs(v)>1 for v in before+after):raise ValueError('Unbounded outcome critic features')
        progress={k:w*(discount*(0. if row['terminal'] else after[i])-before[i]) for i,(k,w) in enumerate(zip(keys,weights))}
        outcome=0.
        if row['terminal']:
            winner=(episode.get('result') or {}).get('winner')
            if episode['status']!='terminal' or winner not in ('blue','red'):raise ValueError('Unverified terminal arena outcome')
            outcome=discount*(5. if row['team']==winner else -5.)
        expected={**progress,'shaping':sum(progress.values()),'outcome':outcome,'mastery':0.}
        if any(not isinstance(c.get(k),(int,float)) or not math.isfinite(c[k]) or abs(c[k]-v)>1e-7 for k,v in expected.items()):
            raise ValueError('Outcome reward component mismatch')
        if abs(row['reward']-outcome-expected['shaping'])>1e-7:raise ValueError('Outcome reward total mismatch')
