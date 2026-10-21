"""Authenticated equipment upload/admission tests, with no inference."""
import base64,io,json,tempfile,unittest,uuid
from pathlib import Path
from unittest.mock import patch
from PIL import Image
from aiohttp.test_utils import TestClient,TestServer
import service
import control

class EquipmentAdmissionTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.temp=tempfile.TemporaryDirectory();self.patch=patch.object(service,'ROOT',Path(self.temp.name));self.patch.start()
        for name in ['jobs','staging','input','output']:(service.ROOT/name).mkdir()
        app=service.app();app.cleanup_ctx.clear()
        app.router.add_post('/equipment-references/{avatar_id}/{slot}',control.upload_equipment_reference)
        app.router.add_post('/equipment-jobs/{id}',control.submit_equipment)
        self.client=TestClient(TestServer(app));await self.client.start_server()
        self.headers={'Authorization':'Bearer '+service.TOKEN}
        image=Image.new('RGBA',(256,512),(200,150,20,255));image.putpixel((0,0),(0,0,0,0))
        stream=io.BytesIO();image.save(stream,format='PNG');self.content=stream.getvalue();self.digest=service.sha(self.content)
    async def asyncTearDown(self):
        await self.client.close();self.patch.stop();self.temp.cleanup()
    async def upload(self,slot='primary',**overrides):
        return await self.client.post('/equipment-references/c_solana/'+slot,headers=self.headers,
            json={'png_base64':base64.b64encode(self.content).decode(),'source_sha256':self.digest,**overrides})
    def plan(self,slot='primary'):
        return {'version':1,'avatar_id':'c_solana','seed':25011,'reference_sha256':self.digest,'purpose':'modular-equipment','equipment_slot':slot,
            'engine_sha256':service.sha(service.canonical(service.engine_manifest())),'workflow_sha256':service.sha(service.canonical(service.WORKFLOW)),
            'pins_sha256':service.sha((service.HERE/'model-pins.json').read_bytes()),'limits_sha256':service.sha(service.canonical(service.LIMITS))}
    async def test_upload_requires_auth_and_hash_and_never_changes_body_reference(self):
        body=service.ROOT/'references/c_solana/current.json';body.parent.mkdir(parents=True);body.write_text('{"sha256":"body"}')
        self.assertEqual((await self.client.post('/equipment-references/c_solana/primary',json={})).status,401)
        self.assertEqual((await self.upload(source_sha256='0'*64)).status,422)
        self.assertEqual((await self.upload()).status,200)
        self.assertEqual(body.read_text(),'{"sha256":"body"}')
        self.assertEqual((service.ROOT/'equipment-references/c_solana/primary'/(self.digest+'.png')).read_bytes(),self.content)
    async def test_equipment_admission_is_slot_scoped_immutable_and_single_gpu(self):
        self.assertEqual((await self.upload()).status,200)
        id=str(uuid.uuid4());plan=self.plan()
        self.assertEqual((await self.client.post('/equipment-jobs/'+id,json=self.plan('secondary'),headers=self.headers)).status,422)
        response=await self.client.post('/equipment-jobs/'+id,json=plan,headers=self.headers)
        self.assertEqual(response.status,202);self.assertEqual((await response.json())['reference_source']['provider'],'authenticated-equipment-upload')
        self.assertEqual((service.ROOT/'input'/(id+'.png')).read_bytes(),self.content)
        self.assertEqual((await self.client.post('/equipment-jobs/'+id,json=plan,headers=self.headers)).status,200)
        self.assertEqual((await self.client.post('/equipment-jobs/'+id,json={**plan,'seed':2},headers=self.headers)).status,409)
        self.assertEqual((await self.client.post('/equipment-jobs/'+str(uuid.uuid4()),json=plan,headers=self.headers)).status,409)
    async def test_tampering_and_workflow_changes_are_rejected(self):
        await self.upload();plan=self.plan()
        response=await self.client.post('/equipment-jobs/'+str(uuid.uuid4()),json={**plan,'engine_sha256':'0'*64},headers=self.headers)
        self.assertEqual(response.status,422)
        (service.ROOT/'equipment-references/c_solana/primary'/(self.digest+'.png')).write_bytes(b'changed')
        self.assertEqual((await self.client.post('/equipment-jobs/'+str(uuid.uuid4()),json=plan,headers=self.headers)).status,422)

if __name__=='__main__':unittest.main()
