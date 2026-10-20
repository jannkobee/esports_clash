import json
import tempfile
import threading
import hashlib
import subprocess
import sys
import unittest
import urllib.error
import urllib.request
from pathlib import Path
from unittest.mock import patch, Mock

import server
from training import fit, calibrate, score


class RunnerTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.root_patch = patch.object(server, 'ROOT', Path(self.temporary.name))
        self.token_patch = patch.object(server, 'TOKEN', 'test-only-token-' + 'x' * 32)
        self.root_patch.start()
        self.token_patch.start()
        self.http = server.ThreadingHTTPServer(('127.0.0.1', 0), server.Handler)
        self.thread = threading.Thread(target=self.http.serve_forever, daemon=True)
        self.thread.start()
        self.url = f'http://127.0.0.1:{self.http.server_port}/runs/00000000-0000-0000-0000-000000000001'
        self.plan = {'version': 1, 'seed_start': 20001, 'fit_cases': 32, 'calibration_cases': 24,
                     'evaluation_cases': 24, 'horizon_seconds': 30, 'after_seconds': 120,
                     'max_minutes': 90, 'policy_scope': 'offline-live-macro',
                     'minimum_evaluation_cases': 18, 'automatic_promotion': False}

    def tearDown(self):
        self.http.shutdown()
        self.http.server_close()
        self.root_patch.stop()
        self.token_patch.stop()
        self.temporary.cleanup()

    def request(self, method='GET', body=None, token=True, url=None):
        headers = {'Authorization': 'Bearer ' + server.TOKEN} if token else {}
        data = json.dumps(body).encode() if body is not None else None
        request = urllib.request.Request(url or self.url, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(request, timeout=3) as response:
                return response.status, json.loads(response.read())
        except urllib.error.HTTPError as error:
            return error.code, json.loads(error.read())

    def test_internal_auth_and_path_validation(self):
        self.assertEqual(self.request(token=False)[0], 401)
        self.assertEqual(self.request(url=self.url + '/../other')[0], 404)
        self.assertEqual(self.request('POST', {**self.plan, 'automatic_promotion': True})[0], 422)
        self.assertEqual(self.request('POST', {**self.plan, 'fit_cases': 100000})[0], 422)

    def test_completed_run_is_idempotent_and_plan_is_immutable(self):
        folder = server.ROOT / self.url.rsplit('/', 1)[1]
        folder.mkdir()
        server.write_json(folder / 'plan.json', self.plan)
        server.write_json(folder / 'state.json', {'status': 'completed'})
        with patch.object(server.subprocess, 'Popen') as spawn:
            self.assertEqual(self.request('POST', self.plan)[1]['status'], 'completed')
            self.assertEqual(self.request('POST', self.plan)[1]['status'], 'completed')
            self.assertEqual(self.request('POST', {**self.plan, 'seed_start': 21001})[0], 409)
            spawn.assert_not_called()

    def test_cancellation_precedes_start_and_survives_another_start_request(self):
        self.assertEqual(self.request('DELETE')[1]['status'], 'cancelled')
        with patch.object(server.subprocess, 'Popen') as spawn:
            self.assertEqual(self.request('POST', self.plan)[1]['status'], 'cancelled')
            spawn.assert_not_called()

    def test_runner_sources_compile_before_any_job_is_admitted(self):
        server.validate_runner_sources()

    def test_invalid_pipeline_fails_preflight_without_launching_or_consuming_attempt(self):
        broken = Path(self.temporary.name) / 'broken-pipeline.py'
        broken.write_text('run(\nif failed:\n    pass\n')
        with patch.object(server, 'RUNNER_SOURCES', (broken,)), patch.object(server.subprocess, 'Popen') as spawn:
            code, state = self.request('POST', self.plan)
            self.assertEqual(code, 200)
            self.assertEqual(state['status'], 'failed')
            self.assertIn('preflight failed', state['error'])
            self.assertIn('SyntaxError', state['traceback'])
            folder = server.ROOT / self.url.rsplit('/', 1)[1]
            self.assertFalse((folder / 'starts.json').exists())
            spawn.assert_not_called()

    def test_unexpected_worker_exit_reports_traceback_without_retry(self):
        run_id = self.url.rsplit('/', 1)[1]
        folder = server.ROOT / run_id
        folder.mkdir()
        server.write_json(folder / 'plan.json', self.plan)
        server.write_json(folder / 'state.json', {'status': 'running', 'progress': {}})
        (folder / 'worker.log').write_text('  File "/runner/pipeline.py", line 241\nSyntaxError: invalid syntax\n')
        process = Mock(returncode=1)
        process.poll.return_value = 1
        with patch.dict(server.PROCESSES, {run_id: process}, clear=True), patch.object(server.subprocess, 'Popen') as spawn:
            code, state = self.request('POST', self.plan)
            self.assertEqual(code, 200)
            self.assertIn('SyntaxError: invalid syntax', state['error'])
            self.assertIn('line 241', state['traceback'])
            self.assertEqual(state['status'], 'failed')
            spawn.assert_not_called()

    def test_worker_exit_without_log_does_not_claim_an_oom(self):
        state = server.worker_failure(Path(self.temporary.name), -9)
        self.assertIn('code -9', state['error'])
        self.assertEqual(state['traceback'], '')


class TrainingTests(unittest.TestCase):
    def test_compatible_fitting_memory_excludes_prior_and_current_heldout_and_checkpoint_reloads(self):
        def example(seed, split):
            return {'seed':seed,'split':split,'draft':seed%2,'cardId':f'test-{seed%2}','status':'valid',
                'incumbent':'farm','alternate':'push','control':{'reward':0},'alternative':{'reward':.2},
                'taskContext':{'actions':{'farm':{'bias':1,'task:travel':0},'push':{'bias':1,'task:travel':1}}}}
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);previous=root/'previous';current=root/'current';previous.mkdir();current.mkdir()
            old_fit=[example(i,'fit') for i in range(1,17)]
            import gzip
            for i, e in enumerate(old_fit):
                raw = b'unit fixture only ' + str(e['seed']).encode()
                e['rawHash'] = hashlib.sha256(raw).hexdigest()
                if i % 2 == 0:
                    # Compressed .json.gz file storing the decompressed hash in rawHash
                    (previous / f"raw-{e['seed']}.json.gz").write_bytes(gzip.compress(raw))
                else:
                    # Uncompressed .json file
                    (previous / f"raw-{e['seed']}.json").write_bytes(raw)
            for e in old_fit+[example(i,'heldout') for i in range(33,49)]: (previous/f"case-{e['seed']}.json").write_text(json.dumps(e))
            (previous/'proper.json').write_text(json.dumps({'data_hash':hashlib.sha256(json.dumps(old_fit,sort_keys=True).encode()).hexdigest()}))
            (previous/'result.json').write_text('{}');(previous/'execution.json').write_text(json.dumps({'source_hash':'unit-compatible'}))
            fresh=[example(i,'fit') for i in range(101,117)]
            for e in fresh:(current/f"case-{e['seed']}.json").write_text(json.dumps(e))
            (current/'execution.json').write_text(json.dumps({'source_hash':'unit-compatible','cases':fresh+[example(i,'heldout') for i in range(201,219)]}))
            (current/'plan.json').write_text(json.dumps({'operations':{'batch_size':4}}))
            subprocess.run([sys.executable,str(Path(__file__).with_name('train_stage.py')),str(current)],check=True,timeout=30)
            fitted=json.loads((current/'proper.json').read_text())
            self.assertEqual(fitted['retained_knowledge']['prior_fitting_examples'],16)
            self.assertFalse(set(fitted['trainingSeeds']) & set(range(33,49)))
            self.assertFalse(set(fitted['trainingSeeds']) & set(range(201,219)))
            import torch
            checkpoint=torch.load(current/'checkpoint.pt',weights_only=True)
            restored={'weights':{'farm':{},'push':{}}}
            for (action,key),weight in zip(checkpoint['keys'],checkpoint['weights'].tolist()):restored['weights'][action][key]=weight
            self.assertAlmostEqual(score(restored,'push',fresh[0]['taskContext']),score(fitted['policy'],'push',fresh[0]['taskContext']))

    def test_real_optimizer_fits_a_known_contrast_and_saves_checkpoint(self):
        # Synthetic unit fixtures only; never written into collected match evidence.
        examples = []
        for i in range(32):
            travel = i / 31
            examples.append({'seed': i + 1, 'draft': i % 2, 'cardId': f'test-{i % 2}', 'status': 'valid',
                             'incumbent': 'farm', 'alternate': 'push', 'control': {'reward': 0},
                             'alternative': {'reward': travel * 0.4},
                             'taskContext': {'actions': {'farm': {'bias': 1, 'task:travel': 0},
                                                         'push': {'bias': 1, 'task:travel': travel}}}})
        with tempfile.TemporaryDirectory() as directory:
            fitted = fit(examples, Path(directory))
            self.assertTrue(fitted['sufficient'])
            self.assertTrue((Path(directory) / 'checkpoint.pt').is_file())
            zero_loss = sum(e['alternative']['reward'] ** 2 for e in examples) / len(examples)
            self.assertLess(fitted['fittedLoss'], zero_loss)
            self.assertTrue(all(abs(w) <= 1 for action in fitted['policy']['weights'].values() for w in action.values()))
            fitted['supportedPushKinds'] = ['advance']
            with self.assertRaises(AssertionError):
                calibrate(fitted, examples)
            held_separate = [{**e, 'seed': e['seed'] + 100} for e in examples[:24]]
            before = json.dumps(fitted['policy'], sort_keys=True)
            calibrated = calibrate(fitted, held_separate)
            self.assertTrue(calibrated['sufficient'])
            self.assertEqual(before, json.dumps(fitted['policy'], sort_keys=True))
            self.assertEqual(calibrated['policy']['calibration']['quantileRank'], 23)

    def test_corrupted_raw_evidence_is_strictly_rejected(self):
        def example(seed, split):
            return {'seed':seed,'split':split,'draft':seed%2,'cardId':f'test-{seed%2}','status':'valid',
                'incumbent':'farm','alternate':'push','control':{'reward':0},'alternative':{'reward':.2},
                'taskContext':{'actions':{'farm':{'bias':1,'task:travel':0},'push':{'bias':1,'task:travel':1}}}}
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); previous = root / 'previous'; current = root / 'current'
            previous.mkdir(); current.mkdir()
            old_fit = [example(1, 'fit')]
            old_fit[0]['rawHash'] = 'expected_hash_that_does_not_match'
            (previous / 'raw-1.json.gz').write_bytes(b'tampered compressed content')
            (previous / 'case-1.json').write_text(json.dumps(old_fit[0]))
            (previous / 'proper.json').write_text(json.dumps({'data_hash': hashlib.sha256(json.dumps(old_fit, sort_keys=True).encode()).hexdigest()}))
            (previous / 'result.json').write_text('{}')
            (previous / 'execution.json').write_text(json.dumps({'source_hash': 'unit-compatible'}))
            fresh = [example(101, 'fit')]
            (current / 'case-101.json').write_text(json.dumps(fresh[0]))
            (current / 'execution.json').write_text(json.dumps({'source_hash': 'unit-compatible', 'cases': fresh}))
            (current / 'plan.json').write_text(json.dumps({'operations': {'batch_size': 4}}))
            res = subprocess.run([sys.executable, str(Path(__file__).with_name('train_stage.py')), str(current)], capture_output=True, text=True)
            self.assertNotEqual(res.returncode, 0)
            self.assertIn('Historical raw fitting evidence changed', res.stderr)

    def test_tiny_training_data_cannot_produce_a_qualified_model(self):
        with tempfile.TemporaryDirectory() as directory:
            fitted = fit([], Path(directory))
            self.assertFalse(fitted['sufficient'])
            self.assertNotIn('policy', fitted)


if __name__ == '__main__':
    unittest.main()
