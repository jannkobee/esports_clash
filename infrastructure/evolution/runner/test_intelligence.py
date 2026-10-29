import base64
import hashlib
import hmac
import json
import os
import tempfile
import unittest
from pathlib import Path
from intelligence import validate_plan,canonical,write,sha,observation,Study,Pause,qualify,ACCEPTANCE

TOKEN='t'*40
RUN='00000000-0000-4000-8000-000000000001'
def plan():
    payload=canonical({'run_id':RUN,'domain':'marl','first':56001,'count':1000})
    return {'version':3,'policy_scope':'autonomous-intelligence','domain':'marl','seed_start':56001,
            'reservation':{'payload':base64.b64encode(payload).decode(),'signature':hmac.new(TOKEN.encode(),payload,hashlib.sha256).hexdigest()},
            'max_minutes':30,'total_minutes':60,'generations':2,'training_matches':4,'evaluation_seeds':32,
            'incumbent':None,'incumbent_id':None,'opponents':[],'automatic_promotion':False}

class IntelligenceTests(unittest.TestCase):
    def test_arena_plan_binds_teaching_and_does_not_change_historical_criteria(self):
        from intelligence import acceptance
        p=plan();p.update(version=4,domain='arena',initialization=None,teaching={'version':3,'playbook_sha256':'a'*64,'foundation_sha256':'b'*64})
        payload=canonical({'run_id':RUN,'domain':'arena','first':56001,'count':1000})
        p['reservation']={'payload':base64.b64encode(payload).decode(),'signature':hmac.new(TOKEN.encode(),payload,hashlib.sha256).hexdigest()}
        self.assertTrue(validate_plan(p,RUN,TOKEN));self.assertIsNone(acceptance(p)['maximumExtraTeamDeathCases'])
        self.assertEqual(acceptance(plan()),ACCEPTANCE)
        data=b'{"kind":"arena-actor","number":0.0}'
        p['initialization']={'id':sha(data),'policy_bytes':base64.b64encode(data).decode(),'source_hash':'a'*64,'run_id':RUN}
        self.assertTrue(validate_plan(p,RUN,TOKEN));p['initialization']['id']='bad'
        with self.assertRaises(ValueError):validate_plan(p,RUN,TOKEN)
        p['initialization']=None
        del p['teaching']['playbook_sha256']
        with self.assertRaises(ValueError):validate_plan(p,RUN,TOKEN)
    def test_reservation_binds_run_domain_and_entire_seed_block(self):
        p=plan();self.assertTrue(validate_plan(p,RUN,TOKEN))
        for field,value in [('seed_start',57001),('domain','source'),('evaluation_seeds',8),('automatic_promotion',True)]:
            with self.assertRaises(ValueError):validate_plan({**p,field:value},RUN,TOKEN)
        with self.assertRaises(ValueError):validate_plan(p,RUN,'wrong')
        with self.assertRaises(ValueError):validate_plan(p,RUN[:-1]+'2',TOKEN)

    def test_immutable_bytes_and_budget_reserved_before_any_child_launch(self):
        with tempfile.TemporaryDirectory() as root:
            folder=Path(root)/RUN;folder.mkdir();write(folder/'plan.json',plan(),True)
            write(folder/'state.json',{'status':'queued'})
            old=os.environ.get('EVOLUTION_WORKER_TOKEN');os.environ['EVOLUTION_WORKER_TOKEN']=TOKEN
            try:
                a=Study(folder);self.assertEqual(a.journal['seconds'],1800)
                b=Study(folder);self.assertEqual(b.budget,1800)
                c=Study(folder);self.assertEqual(c.budget,0)
                with self.assertRaises(Pause):c.check(1)
                with self.assertRaises(ValueError):write(folder/'plan.json',{'tampered':True},True)
            finally:
                if old is None:os.environ.pop('EVOLUTION_WORKER_TOKEN',None)
                else:os.environ['EVOLUTION_WORKER_TOKEN']=old

    def test_incomplete_episode_never_gets_a_win_and_repeat_divergence_is_detected(self):
        item={'seed':56001,'draft':2,'swapped':False,'opponentHash':'x'}
        full={'item':{},'episode':{'status':'terminal','states':[{'second':0},{'second':500,'finished':True}],'second':500,
              'result':{'winner':'blue','stats':[{'id':str(i),'team':'blue' if i<5 else 'red','deaths':1} for i in range(10)]}}}
        env={'item':item,'candidateHash':'x','sourceHash':'s','control':full,'repeat':full,'challenger':full}
        self.assertEqual(observation(env,'a')['winDelta'],0)
        self.assertTrue(observation(env,'a')['controlsMatch'])
        self.assertEqual(observation({**env,'challenger':{'episode':{'status':'incomplete'}}},'a')['status'],'incomplete')

    def test_qualification_recomputes_all_reserved_worlds_and_rejects_tampering(self):
        self.qualification_fixture(False)

    def test_arena_qualification_reports_deaths_without_reinstating_a_strategic_death_veto(self):
        self.qualification_fixture(True)

    def qualification_fixture(self,arena):
        with tempfile.TemporaryDirectory() as root:
            folder=Path(root)/RUN;folder.mkdir();(folder/'raw').mkdir()
            original=plan();original['domain']='marl'
            default={'kind':'macro-strategy','version':1,'farmStrategic':.42,'farmTactical':.36,'farmConversionTactical':.65,'pushStrategic':.18,'pushTempoStrategic':.62}
            candidate={'kind':'macro-program','version':1,'weights':[[0.]*20 for _ in range(5)],'bias':[0.]*5}
            from intelligence import acceptance,reference_policy
            if arena:
                original.update(version=4,domain='arena',initialization=None,teaching={'version':3,'playbook_sha256':'a'*64,'foundation_sha256':'b'*64})
                payload=canonical({'run_id':RUN,'domain':'arena','first':56001,'count':1000})
                original['reservation']={'payload':base64.b64encode(payload).decode(),'signature':hmac.new(TOKEN.encode(),payload,hashlib.sha256).hexdigest()}
                default={'kind':'arena-actor','version':1,'input':48,'hidden':32,'w1':[[0.]*48 for _ in range(32)],'b1':[0.]*32,'w2':[0.]*32,'b2':0.}
                candidate={**default,'w2':[.2]+[0.]*31}
            criteria=acceptance(original)
            execution={'planHash':sha(original),'sourceHash':'s'*64,'acceptance':criteria,'defaultPolicy':default}
            write(folder/'plan.json',original);write(folder/'execution.json',execution)
            write(folder/'checks.json',{'check_game':True,'build':True,'executionHash':sha(execution)})
            write(folder/'freeze.json',{'policy':candidate,'hash':sha(candidate),'executionHash':sha(execution)})
            reference=reference_policy(original,default)
            opponents={sha(default):default,sha(reference):reference}
            cases=[{'seed':56001+256+i,'draft':2+i%2,'swapped':side,'opponentHash':key} for i in range(32) for key in opponents for side in (False,True)]
            evaluation={'acceptance':criteria,'sourceHash':'s'*64,'candidateHash':sha(candidate),'incumbentHash':sha(default),
                        'seedReservationVerified':True,'evaluationCases':cases}
            write(folder/'evaluation-plan.json',evaluation)
            for item in cases:
                own='red' if item['swapped'] else 'blue';enemy='blue' if own=='red' else 'red'
                def match(policy,winner):
                    return {'item':{'seed':item['seed'],'draft':item['draft'],'swapped':item['swapped'],'policies':{own:policy,enemy:opponents[item['opponentHash']]},**({'controller':'arena'} if arena else {})},
                            'episode':{'status':'terminal','states':[{'second':0},{'second':500,'finished':True}],'second':500,
                                       'result':{'winner':winner,'stats':[{'id':str(i),'team':'blue' if i<5 else 'red',
                                           'deaths':1 if arena and policy==candidate else 0,'cs':0,'gold':0,'damage':0} for i in range(10)]}}}
                raw={'item':item,'candidateHash':sha(candidate),'sourceHash':'s'*64,'control':match(default,enemy),
                     'repeat':match(default,enemy),'challenger':match(candidate,own)}
                write(folder/'raw'/(sha(raw)+'.pair.json'),raw)
            old=os.environ.get('EVOLUTION_WORKER_TOKEN');os.environ['EVOLUTION_WORKER_TOKEN']=TOKEN
            try:
                result=qualify(folder);self.assertEqual(result['assessment']['status'],'promote')
                self.assertEqual(result['assessment']['independentSeeds'],32)
                if arena:self.assertEqual(result['assessment']['extraTeamDeathCases'],128)
                evaluation['evaluationCases']=cases[:-1];write(folder/'evaluation-plan.json',evaluation)
                with self.assertRaises(ValueError):qualify(folder)
                write(folder/'evaluation-plan.json',{**evaluation,'evaluationCases':cases})
                path=next((folder/'raw').glob('*.pair.json'));raw=json.loads(path.read_text());raw['sourceHash']='tampered';write(path,raw)
                with self.assertRaises(ValueError):qualify(folder)
            finally:
                if old is None:os.environ.pop('EVOLUTION_WORKER_TOKEN',None)
                else:os.environ['EVOLUTION_WORKER_TOKEN']=old

if __name__=='__main__':unittest.main()
