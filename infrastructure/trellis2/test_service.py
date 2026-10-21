"""Admission and reference tests; never substitutes for actual GPU inference."""
import asyncio
import base64
import io
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import AsyncMock, patch
import uuid
from PIL import Image
from aiohttp.test_utils import TestClient, TestServer

os.environ['TRELLIS_WORKER_TOKEN'] = 'test-only-token-' * 4
import service


class AdmissionTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.root_patch = patch.object(service, 'ROOT', Path(self.directory.name))
        self.root_patch.start()
        for name in ['jobs', 'staging', 'input', 'output']:
            (service.ROOT / name).mkdir()
        application = service.app()
        application.cleanup_ctx.clear()
        self.client = TestClient(TestServer(application))
        await self.client.start_server()
        self.headers = {'Authorization': 'Bearer ' + service.TOKEN}

    async def asyncTearDown(self):
        await self.client.close()
        self.root_patch.stop()
        self.directory.cleanup()

    def png(self, color=(180, 50, 20, 255), transparent=True):
        image = Image.new('RGBA', (256, 512), color)
        if transparent:
            image.putpixel((0, 0), (0, 0, 0, 0))
        stream = io.BytesIO()
        image.save(stream, format='PNG')
        return stream.getvalue()

    async def upload(self, content, avatar='c_valkira'):
        return await self.client.post('/references/' + avatar, headers=self.headers,
            json={'png_base64': base64.b64encode(content).decode(), 'provider': 'owner-upload', 'prompt': 'test fixture'})

    async def test_authentication_and_unknown_avatar(self):
        self.assertEqual((await self.client.get('/operations')).status, 401)
        self.assertEqual((await self.upload(self.png(), 'unknown')).status, 422)
        self.assertEqual((await self.client.get('/references/c_valkira/' + 'x'*64, headers=self.headers)).status, 422)

    async def test_reference_versions_are_immutable_and_avatar_scoped(self):
        first = await self.upload(self.png())
        self.assertEqual(first.status, 200)
        a = await first.json()
        second = await self.upload(self.png((20, 80, 180, 255)))
        b = await second.json()
        self.assertNotEqual(a['sha256'], b['sha256'])
        self.assertEqual(service.references()['c_valkira']['sha256'], b['sha256'])
        old = await self.client.get('/references/c_valkira/' + a['sha256'], headers=self.headers)
        self.assertEqual(await old.read(), self.png())
        wrong = await self.client.get('/references/c_solana/' + a['sha256'], headers=self.headers)
        self.assertEqual(wrong.status, 422)

    async def test_bad_images_do_not_become_current_references(self):
        self.assertEqual((await self.upload(self.png(transparent=False))).status, 422)
        self.assertEqual((await self.upload(b'not a png')).status, 422)
        self.assertNotIn('c_valkira', service.references())

    async def test_queued_plan_keeps_original_reference_and_rejects_second_gpu_job(self):
        reference = await (await self.upload(self.png())).json()
        plan = {'version': 1, 'avatar_id': 'c_valkira', 'seed': 47,
            'reference_sha256': reference['sha256'], 'engine_sha256': service.sha(service.canonical(service.engine_manifest())),
            'workflow_sha256': service.sha(service.canonical(service.WORKFLOW)),
            'limits_sha256': service.sha(service.canonical(service.LIMITS)),
            'pins_sha256': service.sha((service.HERE / 'model-pins.json').read_bytes())}
        identifier = str(uuid.uuid4())
        response = await self.client.post('/jobs/' + identifier, json=plan, headers=self.headers)
        self.assertEqual(response.status, 202)
        await self.upload(self.png((20, 80, 180, 255)))
        self.assertEqual((await self.client.post('/jobs/' + identifier, json=plan, headers=self.headers)).status, 200)
        self.assertEqual((service.ROOT / 'input' / (identifier+'.png')).read_bytes(), self.png())
        response = await self.client.post('/jobs/' + str(uuid.uuid4()), json=plan, headers=self.headers)
        self.assertEqual(response.status, 409)

    async def test_changed_frozen_image_fails_before_models_are_loaded(self):
        reference = await (await self.upload(self.png())).json()
        plan = {'version': 1, 'avatar_id': 'c_valkira', 'seed': 47,
            'reference_sha256': reference['sha256'], 'engine_sha256': service.sha(service.canonical(service.engine_manifest())),
            'workflow_sha256': service.sha(service.canonical(service.WORKFLOW)),
            'limits_sha256': service.sha(service.canonical(service.LIMITS)),
            'pins_sha256': service.sha((service.HERE / 'model-pins.json').read_bytes())}
        identifier = str(uuid.uuid4())
        self.assertEqual((await self.client.post('/jobs/' + identifier, json=plan, headers=self.headers)).status, 202)
        (service.ROOT / 'input' / (identifier+'.png')).write_bytes(b'changed')
        await service.generate(service.ROOT / 'jobs' / identifier)
        state = service.read_state(service.ROOT / 'jobs' / identifier)
        self.assertEqual(state['status'], 'failed')
        self.assertIn('Frozen reference bytes changed', state['error'])

    async def test_builtin_reference_survives_an_image_upgrade(self):
        reference = service.references()['c_solana']
        plan = {'version': 1, 'avatar_id': 'c_solana', 'seed': 47,
            'reference_sha256': reference['sha256'], 'engine_sha256': service.sha(service.canonical(service.engine_manifest())),
            'workflow_sha256': service.sha(service.canonical(service.WORKFLOW)),
            'limits_sha256': service.sha(service.canonical(service.LIMITS)),
            'pins_sha256': service.sha((service.HERE / 'model-pins.json').read_bytes())}
        response = await self.client.post('/jobs/' + str(uuid.uuid4()), json=plan, headers=self.headers)
        self.assertEqual(response.status, 202)
        state = await response.json()
        self.assertEqual(state['reference_source'], reference)
        self.assertEqual(state['limits'], service.LIMITS)
        with patch.dict(service.BUILTIN_REFERENCES, {}, clear=True):
            old = await self.client.get('/references/c_solana/' + reference['sha256'], headers=self.headers)
            self.assertEqual(old.status, 200)
            self.assertEqual(service.sha(await old.read()), reference['sha256'])


if __name__ == '__main__':
    unittest.main()
