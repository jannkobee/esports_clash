import json
import base64
import struct
import zlib
import tempfile
import unittest
from pathlib import Path
import torch
from arena_marl import ArenaLearner

class ArenaTests(unittest.TestCase):
    def episode(self,learner):
        rows=[]
        for i in range(12):
            row={'actor':str(i%3),'team':'blue','second':float(i//3),'elapsed':.5,'terminal':False,
                 'candidates':[[((i+j+k)%7-3)/4 for k in range(learner.inputs)] for j in range(2+i%4)],
                 'state':[.2]*learner.critic_inputs,'nextState':[.3]*learner.critic_inputs,'reward':.1,'discount':learner.config['gamma_second']**.5}
            if learner.outcome_rewards:self.outcome_row(row)
            with torch.no_grad():
                d=learner.distribution([row]);a=d.sample();row.update(action=a.item(),logp=d.log_prob(a).item())
            rows.append(row)
        return {'episode':{'status':'censored'},'rows':rows}
    def outcome_row(self,row):
        weights=[.5,.15,.15,.1,.04,.04,.02];keys=['structures','economy','trades','health','dragon','siege','mana']
        progress={key:weights[i]*(row['discount']*(0. if row['terminal'] else row['nextState'][i])-row['state'][i]) for i,key in enumerate(keys)}
        outcome=(5. if row['team']=='blue' else -5.)*row['discount'] if row['terminal'] else 0.
        row.update(rewardVersion='terminal-potential-outcomes-v2',components={**progress,'outcome':outcome,'shaping':sum(progress.values()),'mastery':0.},
                   reward=outcome+sum(progress.values()))
    def test_variable_legal_sets_bootstrap_and_reproduce_checkpoint(self):
        learner=ArenaLearner(47);initial=learner.export();episode=self.episode(learner)
        self.assertTrue(learner.update([episode])['updated']);self.assertNotEqual(initial,learner.export())
        with tempfile.TemporaryDirectory() as root:
            path=Path(root)/'checkpoint.pt';learner.save(path,{'source':'arena'})
            next_episode=self.episode(learner);learner.update([next_episode]);expected=learner.export()
            restored=ArenaLearner(99);restored.load(path,{'source':'arena'})
            self.assertEqual(self.episode(restored),next_episode);restored.update([next_episode]);self.assertEqual(expected,restored.export())
    def test_corrupt_and_offpolicy_rows_rejected_before_update(self):
        learner=ArenaLearner(48);episode=self.episode(learner);initial=learner.export()
        episode['rows'][0]['logp']+=.1
        with self.assertRaisesRegex(ValueError,'Off-policy'):learner.update([episode])
        self.assertEqual(initial,learner.export());episode=self.episode(learner);episode['rows'][0]['candidates'][0][0]=float('nan')
        with self.assertRaisesRegex(ValueError,'Nonfinite'):learner.update([episode])
    def test_compact_features_preserve_the_same_onpolicy_distribution(self):
        learner=ArenaLearner(49);episode=self.episode(learner)
        for row in episode['rows']:
            before=learner.distribution([row]).probs.detach().tolist();candidates=row.pop('candidates')
            values=sum(candidates,[]);row['candidate_count']=len(candidates)
            row['features_b64']=base64.b64encode(struct.pack('<'+'f'*len(values),*values)).decode()
            self.assertEqual(before,learner.distribution([row]).probs.detach().tolist())
        self.assertTrue(learner.update([episode])['updated'])
    def test_same_tick_terminal_transitions_keep_the_outcome_without_fabricating_elapsed_time(self):
        learner=ArenaLearner(50);episode=self.episode(learner);episode['episode']['status']='terminal'
        for row in episode['rows'][-3:]:row.update(terminal=True,elapsed=0.,discount=1.,reward=1.)
        self.assertTrue(learner.update([episode])['updated'])

    def test_identity_actor_update_packed_parity_and_reward_experience(self):
        learner=ArenaLearner(51,224);episode=self.episode(learner);initial=learner.export()
        self.assertEqual(initial['version'],2)
        for row in episode['rows']:
            row['identity']={'avatarId':'c_solana','cardId':'card-test','cardName':'Fictional alias'}
            row['components']={'mastery':.001,'outcome':0}
            before=learner.distribution([row]).probs.detach().tolist();candidates=row.pop('candidates')
            values=sum(candidates,[]);row['candidate_count']=len(candidates)
            row['features_b64']=base64.b64encode(struct.pack('<'+'f'*len(values),*values)).decode()
            self.assertEqual(before,learner.distribution([row]).probs.detach().tolist())
        metrics=learner.update([episode]);self.assertTrue(metrics['updated']);self.assertNotEqual(initial,learner.export())
        self.assertEqual(metrics['identity_experience'][0]['transitions'],12)
        self.assertEqual(metrics['identity_experience'][0]['terminal_outcome_sum'],0)
        with tempfile.TemporaryDirectory() as root:
            path=Path(root)/'identity.pt';learner.save(path,{'source':'identity'})
            restored=ArenaLearner(52,224);restored.load(path,{'source':'identity'});self.assertEqual(learner.export(),restored.export())
            with self.assertRaisesRegex(ValueError,'provenance'):ArenaLearner(53).load(path,{'source':'identity'})
        with self.assertRaisesRegex(ValueError,'Compatible'):ArenaLearner(54).initialize_actor(initial)

    def test_transferable_factual_actor_uses_common_reward_and_six_critic_inputs(self):
        learner=ArenaLearner(60,224,3);initial=learner.export();episode=self.episode(learner)
        self.assertEqual(initial['version'],3);self.assertEqual(learner.critic_inputs,6)
        for row in episode['rows']:
            row['identity']={'avatarId':'new-kit-no-guide','cardId':'card','cardName':'Fictional'}
            row['components']={'mastery':0.,'outcome':0.}
        metrics=learner.update([episode]);self.assertTrue(metrics['updated']);self.assertEqual(metrics['reward_version'],'terminal-potential-v1')
        self.assertEqual(metrics['identity_experience'][0]['mastery_shaping_sum'],0.)
        with self.assertRaisesRegex(ValueError,'Compatible'):ArenaLearner(61,224,2).initialize_actor(initial)
        with tempfile.TemporaryDirectory() as root:
            path=Path(root)/'facts.pt';learner.save(path,{'source':'facts'})
            restored=ArenaLearner(62,224,3);restored.load(path,{'source':'facts'});self.assertEqual(learner.export(),restored.export())

    def test_outcome_reward_update_verifies_components_and_uses_longer_discount(self):
        learner=ArenaLearner(70,224,3,'terminal-potential-outcomes-v2');episode=self.episode(learner)
        self.assertEqual(learner.critic_inputs,7);self.assertEqual(learner.config['gamma_second'],.9998)
        initial=learner.export();metrics=learner.update([episode]);self.assertTrue(metrics['updated']);self.assertNotEqual(initial,learner.export())
        self.assertEqual(metrics['reward_version'],'terminal-potential-outcomes-v2');self.assertIn('structures',metrics['reward_components'])
        for key in ['reward','discount','components','rewardVersion']:
            episode=self.episode(learner);before=learner.export();r=episode['rows'][0]
            if key=='components':r[key]['structures']+=.01
            elif key=='rewardVersion':r[key]='terminal-potential-v1'
            else:r[key]+=.01
            with self.assertRaisesRegex(ValueError,'[Rr]eward'):learner.update([episode])
            self.assertEqual(before,learner.export())
        episode=self.episode(learner);episode['episode'].update(status='terminal',result={'winner':'blue'})
        for row in episode['rows'][-3:]:
            row.update(terminal=True,elapsed=0.,discount=1.);self.outcome_row(row)
        self.assertTrue(learner.update([episode])['updated'])
        with tempfile.TemporaryDirectory() as root:
            path=Path(root)/'outcomes.pt';learner.save(path,{'source':'outcomes'})
            restored=ArenaLearner(71,224,3,'terminal-potential-outcomes-v2');restored.load(path,{'source':'outcomes'})
            self.assertEqual(restored.export(),learner.export())
            with self.assertRaisesRegex(ValueError,'provenance'):ArenaLearner(72,224,3).load(path,{'source':'outcomes'})

    def test_lossless_compressed_features_match_onpolicy_probabilities_and_reject_expansion_errors(self):
        learner=ArenaLearner(80,224,3,'terminal-potential-outcomes-v2');episode=self.episode(learner)
        for row in episode['rows']:
            before=learner.distribution([row]).probs.detach().tolist();candidates=row.pop('candidates');values=sum(candidates,[])
            row.update(candidate_count=len(candidates),feature_encoding='float32le-zlib-v1',
                       features_zlib_b64=base64.b64encode(zlib.compress(struct.pack('<'+'f'*len(values),*values))).decode())
            self.assertEqual(before,learner.distribution([row]).probs.detach().tolist())
        self.assertTrue(learner.update([episode])['updated'])
        row=episode['rows'][0];row['candidate_count']=1
        with self.assertRaisesRegex(ValueError,'compressed'):learner.candidates(row)
        row.update(candidate_count=2,features_zlib_b64=base64.b64encode(zlib.compress(b'0'*1000000)).decode())
        with self.assertRaisesRegex(ValueError,'compressed'):learner.candidates(row)

if __name__=='__main__':unittest.main()
