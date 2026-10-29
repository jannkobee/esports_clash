"""CPU shared-actor MAPPO: legal action masks, centralized value, variable-time GAE.

Only on-policy complete live trajectories enter PPO. No privileged critic input is
exported with the actor. Hyperparameters/reward version are frozen by the judge.
"""
import math
import torch
from torch import nn
from torch.distributions import Categorical

CONFIG = {'version': 1, 'algorithm': 'shared-actor-central-value-PPO', 'clip': .2,
          'epochs': 4, 'lr': .0003, 'entropy': .01, 'value': .5, 'gae_lambda': .95,
          'reward': 'terminal-potential-v1', 'gamma_second': .999, 'max_grad_norm': .5}


class Learner:
    def __init__(self, seed):
        torch.set_num_threads(1)
        torch.manual_seed(seed)
        torch.use_deterministic_algorithms(True)
        self.actor = nn.Sequential(nn.Linear(20, 16), nn.Tanh(), nn.Linear(16, 5))
        self.critic = nn.Sequential(nn.Linear(6, 16), nn.Tanh(), nn.Linear(16, 1))
        self.optimizer = torch.optim.Adam(list(self.actor.parameters()) + list(self.critic.parameters()), lr=CONFIG['lr'])
        self.updates = 0

    def export(self):
        a, b = self.actor[0], self.actor[2]
        return {'kind': 'macro-actor', 'version': 1, 'input': 20, 'hidden': 16,
                'w1': a.weight.detach().tolist(), 'b1': a.bias.detach().tolist(),
                'w2': b.weight.detach().tolist(), 'b2': b.bias.detach().tolist()}

    def initialize_actor(self, policy):
        if policy.get('kind')!='macro-actor':return
        with torch.no_grad():
            for layer,weight,bias in ((self.actor[0],'w1','b1'),(self.actor[2],'w2','b2')):
                layer.weight.copy_(torch.tensor(policy[weight],dtype=torch.float32))
                layer.bias.copy_(torch.tensor(policy[bias],dtype=torch.float32))

    def save(self, path, metadata):
        temporary = path.with_suffix('.tmp')
        torch.save({'config': CONFIG, 'actor': self.actor.state_dict(), 'critic': self.critic.state_dict(),
                    'optimizer': self.optimizer.state_dict(), 'rng': torch.get_rng_state(),
                    'updates': self.updates, 'metadata': metadata}, temporary)
        temporary.replace(path)

    def load(self, path, metadata):
        state = torch.load(path, weights_only=True, map_location='cpu')
        if state['config'] != CONFIG or state['metadata'] != metadata:
            raise ValueError('Checkpoint source/config/allocation mismatch')
        self.actor.load_state_dict(state['actor']); self.critic.load_state_dict(state['critic'])
        self.optimizer.load_state_dict(state['optimizer']); torch.set_rng_state(state['rng'])
        self.updates = state['updates']

    def update(self, episodes, learning_team=None):
        rows = []
        for episode in episodes:
            if episode['episode']['status'] != 'terminal':
                raise ValueError('Censored episode cannot train terminal returns')
            grouped = {}
            for row in episode['rows']:
                if learning_team and row['team'] != learning_team: continue
                grouped.setdefault(row['actor'], []).append(row)
            for trajectory in grouped.values():
                if not trajectory[-1]['terminal']: raise ValueError('Unclosed actor trajectory')
                previous = -1
                for row in trajectory:
                    if row['second'] <= previous or row['elapsed'] <= 0: raise ValueError('Unordered actor trajectory')
                    previous = row['second']
                    if len(row['observation']) != 20 or len(row['state']) != 6 or len(row['nextState']) != 6:
                        raise ValueError('Invalid observation/state dimensions')
                    if len(row['mask']) != 5 or not row['mask'][row['action']]: raise ValueError('Illegal action')
                    values = row['observation'] + row['state'] + row['nextState'] + [row['reward'], row['logp'], row['discount']]
                    if not all(math.isfinite(x) for x in values): raise ValueError('Nonfinite transition')
                with torch.no_grad():
                    states = torch.tensor([r['state'] for r in trajectory], dtype=torch.float32)
                    following = torch.tensor([r['nextState'] for r in trajectory], dtype=torch.float32)
                    values = self.critic(states).squeeze(-1); next_values = self.critic(following).squeeze(-1)
                advantage = 0.
                for i in reversed(range(len(trajectory))):
                    row = dict(trajectory[i]); discount = row['discount'] if not row['terminal'] else 0.
                    delta = row['reward'] + discount * next_values[i].item() - values[i].item()
                    advantage = delta + discount * CONFIG['gae_lambda'] ** row['elapsed'] * advantage
                    row['advantage'] = advantage; row['return'] = advantage + values[i].item(); rows.append(row)
        if len(rows) < 2: return {'updated': False, 'reason': 'insufficient-safe-decisions', 'transitions': len(rows)}
        observation = torch.tensor([r['observation'] for r in rows], dtype=torch.float32)
        state = torch.tensor([r['state'] for r in rows], dtype=torch.float32)
        mask = torch.tensor([r['mask'] for r in rows], dtype=torch.bool)
        action = torch.tensor([r['action'] for r in rows]); old_logp = torch.tensor([r['logp'] for r in rows])
        advantage = torch.tensor([r['advantage'] for r in rows]); returns = torch.tensor([r['return'] for r in rows])
        with torch.no_grad():
            actual = Categorical(logits=self.actor(observation).masked_fill(~mask, -1e9)).log_prob(action)
            if (actual-old_logp).abs().max().item() > 1e-4: raise ValueError('Off-policy or JS/torch inference mismatch')
        advantage = (advantage-advantage.mean())/(advantage.std(unbiased=False)+1e-8)
        for _ in range(CONFIG['epochs']):
            distribution = Categorical(logits=self.actor(observation).masked_fill(~mask, -1e9))
            ratio = (distribution.log_prob(action)-old_logp).exp()
            actor_loss = -torch.minimum(ratio*advantage, ratio.clamp(1-CONFIG['clip'],1+CONFIG['clip'])*advantage).mean()
            value_loss = (self.critic(state).squeeze(-1)-returns).square().mean()
            loss = actor_loss + CONFIG['value']*value_loss - CONFIG['entropy']*distribution.entropy().mean()
            if not torch.isfinite(loss): raise ValueError('Nonfinite optimization loss')
            self.optimizer.zero_grad(); loss.backward()
            nn.utils.clip_grad_norm_(list(self.actor.parameters())+list(self.critic.parameters()),CONFIG['max_grad_norm'])
            self.optimizer.step()
        self.updates += 1
        return {'updated': True, 'transitions': len(rows), 'actor_loss': actor_loss.item(),
                'value_loss': value_loss.item(), 'entropy': distribution.entropy().mean().item(), 'updates': self.updates}
