import json
import tempfile
import unittest
from pathlib import Path
import torch
from torch.distributions import Categorical
from marl import Learner

class MarlTests(unittest.TestCase):
    def episode(self,learner):
        rows=[]
        for i in range(10):
            observation=[(i-5)/10]*20;state=[i/10]*6;mask=[True,False,False,True,False]
            with torch.no_grad():
                distribution=Categorical(logits=learner.actor(torch.tensor(observation)).masked_fill(~torch.tensor(mask),-1e9))
                action=distribution.sample();logp=distribution.log_prob(action).item()
            rows.append({'actor':str(i),'team':'blue' if i<5 else 'red','second':10.,'elapsed':10.,'terminal':True,
                         'observation':observation,'state':state,'nextState':[0.]*6,'mask':mask,'action':action.item(),
                         'logp':logp,'reward':1. if i<5 else -1.,'discount':.999**10})
        return {'episode':{'status':'terminal'},'rows':rows}

    def test_shared_actor_central_critic_update_and_exact_checkpoint_resume(self):
        learner=Learner(47);initial=json.dumps(learner.export());episode=self.episode(learner)
        metrics=learner.update([episode]);self.assertTrue(metrics['updated']);self.assertEqual(metrics['transitions'],10)
        self.assertNotEqual(initial,json.dumps(learner.export()))
        with tempfile.TemporaryDirectory() as root:
            path=Path(root)/'checkpoint.pt';learner.save(path,{'source':'test'})
            next_episode=self.episode(learner);learner.update([next_episode]);expected=learner.export()
            restored=Learner(999);restored.load(path,{'source':'test'})
            reproduced=self.episode(restored);self.assertEqual(reproduced,next_episode)
            restored.update([reproduced]);self.assertEqual(expected,restored.export())
            with self.assertRaises(ValueError):restored.load(path,{'source':'different'})

    def test_incomplete_and_offpolicy_trajectories_fail_closed(self):
        learner=Learner(48);episode=self.episode(learner)
        episode['episode']['status']='censored'
        with self.assertRaises(ValueError):learner.update([episode])
        episode['episode']['status']='terminal';episode['rows'][0]['logp']-=1
        with self.assertRaises(ValueError):learner.update([episode])

if __name__=='__main__':unittest.main()
