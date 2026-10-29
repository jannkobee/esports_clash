import base64,hashlib,json,tempfile,unittest
from pathlib import Path
from retain_review import retain

class RetentionTest(unittest.TestCase):
    uid='00000000-0000-4000-8000-000000000001'
    def payload(self,status='running'):
        files={'plan.json':json.dumps({'id':self.uid,'compute':'google','publication_eligible':False,'files':{}}).encode(),
               'state.json':json.dumps({'id':self.uid,'status':status}).encode()}
        return {'id':self.uid,'files':{n:{'data':base64.b64encode(b).decode(),'sha256':hashlib.sha256(b).hexdigest()} for n,b in files.items()}}
    def test_idempotent_snapshots_preserve_previous_receipts(self):
        with tempfile.TemporaryDirectory() as root:
            first=retain(self.payload(),self.uid,root);retain(self.payload(),self.uid,root)
            self.assertEqual(len(list((Path(root)/self.uid/'receipts').iterdir())),1)
            retain(self.payload('failed'),self.uid,root)
            self.assertEqual(len(list((Path(root)/self.uid/'receipts').iterdir())),2)
            self.assertEqual(first['status'],'running')
    def test_corruption_and_traversal_are_rejected_before_writes(self):
        with tempfile.TemporaryDirectory() as root:
            p=self.payload();p['files']['plan.json']['sha256']='0'*64
            with self.assertRaises(ValueError):retain(p,self.uid,root)
            p=self.payload();p['files']['../escape']=p['files']['state.json']
            with self.assertRaises(ValueError):retain(p,self.uid,root)
            self.assertEqual(list(Path(root).iterdir()),[])
    def test_completion_requires_exact_report(self):
        with tempfile.TemporaryDirectory() as root:
            with self.assertRaises(ValueError):retain(self.payload('completed'),self.uid,root)
    def test_plan_cannot_change_between_snapshots(self):
        with tempfile.TemporaryDirectory() as root:
            retain(self.payload(),self.uid,root)
            p=self.payload();plan=json.loads(base64.b64decode(p['files']['plan.json']['data']));plan['files']['tools/changed.py']='0'*64
            b=json.dumps(plan).encode();p['files']['plan.json']={'data':base64.b64encode(b).decode(),'sha256':hashlib.sha256(b).hexdigest()}
            with self.assertRaises(ValueError):retain(p,self.uid,root)
            self.assertEqual(len(list((Path(root)/self.uid/'receipts').iterdir())),1)

if __name__=='__main__':unittest.main()
