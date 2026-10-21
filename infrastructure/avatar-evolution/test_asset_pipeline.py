"""Offline failure-injection tests. Cloud transports are fakes, not live proof."""
import copy
import hashlib
import json
import platform
import subprocess
import sys
import tempfile
import unittest
from dataclasses import replace
from pathlib import Path
from unittest.mock import patch
from asset_pipeline.store import Store, atomic_json, canonical, digest
from asset_pipeline.compute import (Capacity, ColabComputeProvider, ComputeOrchestrator,
                                    JobSpec, LocalCPUComputeProvider)
from asset_pipeline.storage import GoogleDriveStorageProvider, TransferError, DRIVE, UPLOAD
from asset_pipeline.quality import AssetQualityEvaluator, AutoRiggingOrchestrator, FEATURES, evaluate_vfx
from asset_pipeline.learning import (MLDataCollector, TrainingDatasetManager, ModelRegistry,
    TrainingOrchestrator, MLInferenceEngine, split_for)
from asset_pipeline.train_worker import train, predict
from asset_pipeline.cli import tick, rank_rigs
from motion_intelligence import select_motion_profile, attack_adjustment, combat_events

PYTHON = '.'.join(platform.python_version_tuple()[:2])


def job(**kwargs):
    return JobSpec(**{'id': 'test', 'kind': 'quality_train', 'model_version': 'ridge-v1',
        'pipeline_version': 'test-v1', 'environment': 'asset-quality-stdlib-v1',
        'python': PYTHON, 'accelerators': ['cpu', 'cuda'], **kwargs})


def report():
    render = {'passed': True, 'gameplay': {'passed': True}, 'planted_foot_step_drift': .1,
              'blend_hand_step_jump': .1, 'renderer': {'mean_frame_ms': 2}}
    render['views'] = [{'name': name, 'silhouette': {'occupied_pixels': 1000, 'clipped': False}} for name in ['front','side','back']]
    render['gameplay']['views'] = [{'name': name, 'silhouette': {'occupied_pixels': 100, 'clipped': False}} for name in ['idle','attack','ability']]
    return {'status': 'ready', 'report': {'qualification_complete': True, 'reasons': [],
        'geometry': {'passed': True, 'gates': {'skeleton': {'passed': True}},
            'bind': {'self_intersections': 0}, 'frames': [{'clip': 'Attack', 'self_intersections': 0}],
            'unweighted_vertices': 0, 'invalid_weight_sums': 0},
        'gltf': {'errors': 0}, 'baseline': {'render': copy.deepcopy(render)},
        'candidates': [{'render': render, 'validation': {'passed': True}}]}}


class Provider:
    def __init__(self, name, capacity=None, error=False):
        self.name, self.calls, self.error = name, 0, error
        self.hardware = capacity or Capacity('cpu', PYTHON, 'asset-quality-stdlib-v1', 4096)

    def supports(self, spec):
        return True

    def capacity(self):
        return self.hardware

    def run(self, spec):
        self.calls += 1
        if self.error:
            raise RuntimeError('token-secret must never be logged')
        return {'ok': True}


class Base(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.store = Store(self.root / 'intelligence')

    def tearDown(self):
        self.store.close()
        self.temp.cleanup()


class ComputeTests(Base):
    def test_cloud_preferred_then_incompatible_gpu_cpu_fallback(self):
        cpu, gpu, cloud = Provider('local_cpu'), Provider('local_gpu'), Provider('colab')
        engine = ComputeOrchestrator(self.store, [cpu, gpu, cloud])
        engine.submit(job())
        self.assertEqual(engine.tick()['status'], 'complete')
        self.assertEqual((cloud.calls, gpu.calls, cpu.calls), (1, 0, 0))
        cloud.hardware = replace(cloud.hardware, environment='wrong')
        gpu.hardware = replace(gpu.hardware, free_vram_mib=10, accelerator='cuda')
        engine.submit(job(id='next', accelerators=['cpu']))
        engine.tick()
        self.assertEqual(cpu.calls, 1)

    def test_incompatible_job_retained_without_consuming_attempts(self):
        provider = Provider('local_gpu', Capacity('cuda', PYTHON, 'wrong', 4096, 100))
        engine = ComputeOrchestrator(self.store, [provider], clock=lambda: 1000)
        engine.submit(job(accelerators=['cuda'], min_vram_mib=12000, cuda='12.4'))
        self.assertEqual(engine.tick()['status'], 'waiting_resources')
        self.assertIsNone(engine.tick())
        row = self.store.db.execute('SELECT * FROM jobs').fetchone()
        self.assertEqual(row['attempts'], 0)
        self.assertEqual(provider.calls, 0)

    def test_execution_failure_falls_back_and_redacts_logs(self):
        clock = [1000]
        cloud, cpu = Provider('colab', error=True), Provider('local_cpu')
        engine = ComputeOrchestrator(self.store, [cloud, cpu], clock=lambda: clock[0])
        engine.submit(job())
        self.assertEqual(engine.tick()['status'], 'queued')
        self.assertIsNone(engine.tick())
        clock[0] += 31
        self.assertEqual(engine.tick()['status'], 'complete')
        self.assertEqual((cloud.calls, cpu.calls), (1, 1))
        events = str([tuple(row) for row in self.store.db.execute('SELECT * FROM events')])
        self.assertNotIn('token-secret', events)

    def test_dependency_and_idempotency(self):
        provider = Provider('local_cpu')
        engine = ComputeOrchestrator(self.store, [provider])
        engine.submit(job(id='child', dependencies=['parent'], priority=10))
        self.assertIsNone(engine.tick())
        engine.submit(job(id='parent'))
        engine.submit(job(id='parent'))
        with self.assertRaises(ValueError):
            engine.submit(job(id='parent', model_version='changed'))
        self.assertEqual(engine.tick()['id'], 'parent')
        self.assertEqual(engine.tick()['id'], 'child')
        self.assertIsNone(engine.tick())

    def test_expired_lease_recovers_without_repeating_completed_dependencies(self):
        engine = ComputeOrchestrator(self.store, [Provider('local_cpu')], clock=lambda: 1000)
        engine.submit(job(id='mesh'))
        engine.tick()
        engine.submit(job(id='rig', dependencies=['mesh']))
        with self.store.db:
            self.store.db.execute("UPDATE jobs SET status='running',lease_token='lost',lease_until=999 WHERE id='rig'")
        self.assertEqual(engine.tick()['id'], 'rig')
        self.assertEqual(self.store.db.execute("SELECT attempts FROM jobs WHERE id='mesh'").fetchone()[0], 1)

    def test_recovery_budget_exhaustion(self):
        now = [1000]
        provider = Provider('local_cpu', error=True)
        engine = ComputeOrchestrator(self.store, [provider], clock=lambda: now[0])
        engine.submit(job(max_attempts=1))
        self.assertEqual(engine.tick()['status'], 'failed')
        now[0] += 100
        self.assertIsNone(engine.tick())

    def test_duplicate_executor_cannot_claim_live_lease(self):
        second = Store(self.store.root)
        engine2 = ComputeOrchestrator(second, [Provider('local_cpu')])
        provider = Provider('local_cpu')
        original = provider.run
        def run(spec):
            self.assertIsNone(engine2.tick())
            return original(spec)
        provider.run = run
        engine = ComputeOrchestrator(self.store, [provider])
        engine.submit(job())
        self.assertEqual(engine.tick()['status'], 'complete')
        second.close()

    def test_checkpoint_compatibility_and_gpu_contract(self):
        with self.assertRaises(ValueError):
            job(checkpoint={'environment': 'other', 'model_version': 'ridge-v1'}).validate()
        with self.assertRaises(ValueError):
            job(min_vram_mib=1000).validate()

    def test_gpu_wait_does_not_starve_cpu_work(self):
        engine = ComputeOrchestrator(self.store, [Provider('local_cpu')], clock=lambda: 1000)
        engine.submit(job(id='gpu', accelerators=['cuda'], min_vram_mib=24000, priority=20))
        engine.submit(job(id='cpu'))
        self.assertEqual(engine.tick()['id'], 'cpu')
        self.assertEqual(self.store.db.execute("SELECT attempts FROM jobs WHERE id='gpu'").fetchone()[0], 0)

    def test_single_provider_retries_are_bounded(self):
        now = [1000]
        engine = ComputeOrchestrator(self.store, [Provider('local_cpu', error=True)], clock=lambda: now[0])
        engine.submit(job(max_attempts=2))
        self.assertEqual(engine.tick()['status'], 'queued')
        now[0] += 31
        self.assertEqual(engine.tick()['status'], 'failed')

    def test_expired_claim_during_probe_does_not_launch_a_second_executor(self):
        now = [1000]
        second = Store(self.store.root)
        replacement = Provider('local_cpu')
        engine2 = ComputeOrchestrator(second, [replacement], clock=lambda: now[0])
        stale = Provider('local_cpu')
        def slow_capacity():
            now[0] += 500
            self.assertEqual(engine2.tick()['status'], 'complete')
            return stale.hardware
        stale.capacity = slow_capacity
        engine = ComputeOrchestrator(self.store, [stale], clock=lambda: now[0])
        engine.submit(job())
        self.assertEqual(engine.tick()['status'], 'lease_lost')
        self.assertEqual(stale.calls, 0)
        self.assertEqual(replacement.calls, 1)
        second.close()

    def test_official_cli_exec_adapter_with_mocked_remote(self):
        script = Path(__file__).parent / 'asset_pipeline/train_worker.py'
        provider = ColabComputeProvider('owned-session', script, 'asset-quality-stdlib-v1')
        capacity = Capacity('cpu', PYTHON, 'asset-quality-stdlib-v1', 4096)
        with patch('asset_pipeline.compute.shutil.which', return_value='/bin/colab'), patch.object(provider, 'command', return_value='ASSET_CAPACITY=' + canonical(capacity.__dict__)) as command:
            self.assertTrue(provider.capacity().compatible(job()))
            self.assertEqual(command.call_args.args, ('exec', '-s', 'owned-session'))
        # Exercise the transmitted program as a real interpreter, not just a stub.
        def execute(*args, input=None, **kwargs):
            return subprocess.run([sys.executable, '-c', input], text=True, capture_output=True, check=True).stdout
        with patch.object(provider, 'command', side_effect=execute):
            result = provider.run(job(payload=training_payload()))
            self.assertEqual(result['snapshot'], 'fixture')


def training_payload():
    records = []
    for i in range(40):
        value = i / 40
        records.append({'features': {key: value if key == FEATURES[0] else 0 for key in FEATURES},
                        'label': 90 - 60 * value})
    return {'features': FEATURES, 'snapshot': 'fixture', 'train': records[:30], 'validation': records[30:]}


class QualityTests(Base):
    def test_authored_integration_fixtures_are_excluded_from_training_collection(self):
        folder=self.root / 'diagnostic'
        atomic_json(folder / 'preparation-plan.json', {'diagnostic_fixture':True})
        self.assertIsNone(MLDataCollector(self.store).collect(folder))
        self.assertEqual(self.store.db.execute('SELECT COUNT(*) FROM examples').fetchone()[0],0)

    def test_technical_pass_is_not_artistic_ground_truth(self):
        folder = self.root / 'run'
        atomic_json(folder / 'state.json', report())
        atomic_json(folder / 'preparation-plan.json', {'source_sha256': 'a' * 64, 'avatar_id': 'test'})
        identity = MLDataCollector(self.store).collect(folder)
        row = self.store.db.execute('SELECT * FROM examples WHERE id=?', (identity,)).fetchone()
        self.assertEqual(row['disposition'], 'uncertain')
        self.assertIsNone(row['label'])
        self.assertEqual(MLDataCollector(self.store).collect(folder), identity)
        with self.assertRaises(ValueError):
            MLDataCollector(self.store).label(identity, 80, 'pseudo_label', 'commercial_training_permitted')
        MLDataCollector(self.store).label(identity, 80, 'human_review', 'commercial_training_permitted')
        self.assertEqual(self.store.db.execute('SELECT disposition FROM examples').fetchone()[0], 'verified')

    def test_foot_sliding_and_missing_metrics_fail_closed(self):
        state = report()
        state['report']['candidates'][0]['render']['planted_foot_step_drift'] = 30
        result = AssetQualityEvaluator().evaluate(state)
        self.assertIn('foot_drift', result['failure_classes'])
        del state['report']['candidates'][0]['render']['blend_hand_step_jump']
        result = AssetQualityEvaluator().evaluate(state)
        self.assertFalse(result['hard_pass'])
        self.assertIsNone(result['technical_score'])
        self.assertIn('hand_jump', result['missing_measurements'])

    def test_invalid_skin_and_nonfinite_measurements(self):
        from equipment_skin import validate_skin_weights
        result = validate_skin_weights([{'UpperArmL': float('nan')}, {'HandL': -.5, 'HandR': 1.5}], mapped_bones=['UpperArmL','HandL','HandR'])
        self.assertFalse(result['valid'])
        state = report()
        state['report']['geometry']['unweighted_vertices'] = float('nan')
        self.assertFalse(AssetQualityEvaluator().evaluate(state)['hard_pass'])

    def test_rig_competition_keeps_all_scores_and_rejects_incompatible(self):
        bad = report()
        bad['report']['geometry']['passed'] = False
        result = AutoRiggingOrchestrator().select([
            {'id': 'a', 'backend': 'unirig', 'seed': 1, 'model_version': 'v1', 'supported_profiles': ['humanoid'], 'state': bad},
            {'id': 'b', 'backend': 'unirig', 'seed': 2, 'model_version': 'v1', 'supported_profiles': ['humanoid'], 'state': report()},
            {'id': 'c', 'backend': 'skintokens', 'seed': 3, 'model_version': 'unverified', 'supported_profiles': ['quadruped'], 'state': report()},
        ], 'humanoid')
        self.assertEqual(result['selected'], 'b')
        self.assertEqual(len(result['comparisons']), 3)
        self.assertFalse(result['comparisons'][2]['compatible'])

    def test_vfx_requires_event_alignment_and_class(self):
        result = evaluate_vfx([{'type': 'hit', 'class': 'Mage', 'gameplay_time': 1, 'visual_time': 1.2}], 'Fighter')
        self.assertEqual(result['issues'], ['class_mismatch', 'event_desynchronization'])
        self.assertFalse(evaluate_vfx([], 'Mage')['passed'])

    def test_deformation_correction_restores_weights_after_regression(self):
        from types import SimpleNamespace
        from asset_pipeline.deformation import DeformationCorrectionEngine
        vertex = SimpleNamespace(index=0, groups=[SimpleNamespace(group=0, weight=1.)])
        class Group:
            name = 'HandR'
            def remove(self, indices):
                vertex.groups = []
            def add(self, indices, weight, mode):
                vertex.groups = [SimpleNamespace(group=0, weight=weight)]
        class Groups(list):
            def get(self, name):
                return self[0]
        obj = SimpleNamespace(data=SimpleNamespace(vertices=[vertex]), vertex_groups=Groups([Group()]))
        before = {'valid': True, 'stats': {'unweighted_vertices': 0}}
        after = {'valid': False, 'stats': {'unweighted_vertices': 1}}
        def bad_repair(*args):
            vertex.groups[0].weight = .1
            return {'validation': after, 'repairs': ['bad-change']}
        with patch('asset_pipeline.deformation.validate_skin_weights', return_value=before), patch('asset_pipeline.deformation.repair_skin_weights', side_effect=bad_repair):
            result = DeformationCorrectionEngine().correct(obj, None, ['HandR'])
        self.assertFalse(result['accepted'])
        self.assertEqual(result['repairs'], [])
        self.assertEqual(vertex.groups[0].weight, 1.)

    def test_clipped_and_missing_multi_angle_views_are_detected(self):
        state = report()
        state['report']['candidates'][0]['render']['views'][0]['silhouette']['clipped'] = True
        quality = AssetQualityEvaluator().evaluate(state)
        self.assertGreater(quality['features']['silhouette_clipping'], 0)
        state['report']['candidates'][0]['render']['views'] = []
        quality = AssetQualityEvaluator().evaluate(state)
        self.assertIn('multi_view_silhouettes', quality['missing_measurements'])
        self.assertFalse(quality['hard_pass'])

    def test_character_weapon_and_measured_limb_profiles(self):
        sword = select_motion_profile([{'slot': 'primary', 'weapon_type': 'sword'}, {'slot': 'secondary', 'weapon_type': 'shield'}])
        staff = select_motion_profile([{'slot': 'primary', 'weapon_type': 'staff'}])
        dagger = select_motion_profile([{'slot': 'primary', 'weapon_type': 'dagger'}])
        self.assertEqual(len({p['template'] for p in [sword, staff, dagger]}), 3)
        long = select_motion_profile([{'slot': 'primary', 'weapon_type': 'staff'}], {'arm_to_height': .5})
        self.assertLess(long['amplitude_gain'], staff['amplitude_gain'])
        for phase in [0, 1]:
            self.assertEqual(attack_adjustment(staff, phase, 'Chest')[1], (0., 0., 0.))
        self.assertEqual([e['phase'] for e in combat_events()], sorted(e['phase'] for e in combat_events()))

    def test_live_studio_equipment_types_select_the_intended_motion(self):
        equipment = [{'slot': 'primary', 'weapon_type': 'one_handed_sword'}, {'slot': 'secondary', 'weapon_type': 'shield'}]
        self.assertEqual(select_motion_profile(equipment)['template'], 'sword_and_shield')
        self.assertEqual(select_motion_profile([{'slot': 'primary', 'weapon_type': 'dual_daggers'}])['template'], 'short_blade')
        self.assertEqual(select_motion_profile([{'slot': 'primary', 'weapon_type': 'two_handed'}])['template'], 'heavy_overhead')
        self.assertEqual(select_motion_profile(equipment)['source_weapon_type'], 'one_handed_sword')


class LearningTests(Base):
    def seed(self, label_curve=lambda x: 90 - 60 * x, feature=FEATURES[0]):
        for i in range(240):
            family = 'source-' + str(i)
            value = (i % 41) / 40
            features = {key: value if key == feature else 0 for key in FEATURES}
            payload = {'features': features, 'archetype': 'humanoid', 'quality': {'missing_measurements': []}}
            self.store.db.execute('INSERT INTO examples VALUES(?,?,?,?,?,?,?,?)',
                (digest(family), family, split_for(family), 'verified', canonical(payload), label_curve(value), 'human_review', 'commercial_training_permitted'))
        self.store.db.commit()

    def train_result(self):
        identity, snapshot = TrainingDatasetManager(self.store).snapshot()
        result = train({'snapshot': identity, 'features': FEATURES,
            'train': [r for r in snapshot['records'] if r['split'] == 'train'],
            'validation': [r for r in snapshot['records'] if r['split'] == 'validation']})
        return result

    def test_no_training_without_verified_examples(self):
        self.assertIsNone(TrainingDatasetManager(self.store).snapshot())
        self.assertEqual(MLInferenceEngine(self.store).predict(AssetQualityEvaluator().evaluate(report()))['status'], 'awaiting_verified_training_data')

    def test_group_splits_are_disjoint_and_snapshot_immutable(self):
        self.seed()
        identity, snapshot = TrainingDatasetManager(self.store).snapshot()
        grouped = {}
        for row in snapshot['records']:
            self.assertNotIn(row['family'], grouped)
            grouped[row['family']] = row['split']
        self.assertEqual(TrainingDatasetManager(self.store).snapshot()[0], identity)
        self.store.db.execute('UPDATE examples SET label=1')
        self.store.db.commit()
        self.assertNotEqual(TrainingDatasetManager(self.store).snapshot()[0], identity)
        frozen = json.loads(self.store.db.execute('SELECT payload FROM snapshots WHERE id=?', (identity,)).fetchone()[0])
        self.assertEqual(frozen, snapshot)

    def test_real_training_rejects_inferior_and_promotes_measured_improvement(self):
        self.seed()
        result = self.train_result()
        registry = ModelRegistry(self.store)
        bad = copy.deepcopy(result)
        bad['model']['coefficients'] = [0] * (len(FEATURES) + 1)
        self.assertFalse(registry.promote(bad)['promoted'])
        promotion = registry.promote(result)
        self.assertTrue(promotion['promoted'])
        self.assertLess(promotion['benchmark']['test_rmse'], .1)
        self.assertEqual(registry.active()['id'], promotion['id'])
        self.assertFalse(registry.promote(result)['promoted'])

    def test_no_test_labels_in_training_jobs_and_no_unchanged_retraining(self):
        self.seed()
        engine = ComputeOrchestrator(self.store, [])
        orchestrator = TrainingOrchestrator(self.store, engine)
        identity = orchestrator.schedule()
        self.assertEqual(orchestrator.schedule(), identity)
        self.assertEqual(self.store.db.execute('SELECT COUNT(*) FROM jobs').fetchone()[0], 1)
        spec = json.loads(self.store.db.execute('SELECT spec FROM jobs').fetchone()[0])
        self.assertNotIn('test', spec['payload'])
        self.assertTrue(all(row['split'] != 'test' for key in ['train', 'validation'] for row in spec['payload'][key]))

    def test_real_local_subprocess_and_coordinator_resume(self):
        self.seed()
        engine = ComputeOrchestrator(self.store, [LocalCPUComputeProvider({'quality_train': [sys.executable, str(Path(__file__).parent / 'asset_pipeline/train_worker.py')]})])
        identity = TrainingOrchestrator(self.store, engine).schedule()
        self.assertEqual(engine.tick()['status'], 'complete')
        result = json.loads(self.store.db.execute('SELECT result FROM jobs WHERE id=?', (identity,)).fetchone()[0])
        self.assertTrue(ModelRegistry(self.store).promote(result)['promoted'])
        self.assertIsNone(engine.tick())

    def test_automatic_rollback_uses_fresh_verified_families(self):
        self.seed()
        registry = ModelRegistry(self.store)
        old = self.train_result()
        old['model']['coefficients'][0] -= 2
        promoted = registry.promote(old)
        self.assertTrue(promoted['promoted'])
        new = self.train_result()
        self.assertTrue(registry.promote(new)['promoted'])
        fresh = []
        for i in range(20):
            row = {'family': 'fresh-' + str(i), 'features': {key: .3 for key in FEATURES},
                   'label_source': 'human_review', 'rights': 'commercial_training_permitted'}
            row['label'] = predict(old['model'], row)
            fresh.append(row)
        self.assertTrue(registry.rollback_if_regressed(fresh))
        self.assertEqual(registry.active()['id'], promoted['id'])
        self.assertFalse(registry.rollback_if_regressed(fresh[:2]))

    def test_learned_ranking_changes_actual_cached_rig_selection(self):
        self.seed(feature='render_regression')
        self.assertTrue(ModelRegistry(self.store).promote(self.train_result())['promoted'])
        for name, frame_cost in [('a-slow', 3.6), ('z-fast', 2.2)]:
            folder = self.root / name
            rig = b'glTF' + name.encode()
            atomic_json(folder / 'preparation-plan.json', {'avatar_id': 'hero'})
            atomic_json(folder / 'unirig-result.json', {'status': 'rigged_unqualified',
                'plan': {'source_sha256': 'source', 'engine_sha256': 'engine'},
                'artifact': {'bytes': len(rig), 'sha256': hashlib.sha256(rig).hexdigest()}})
            (folder / 'unirig-rigged.glb').write_bytes(rig)
            state = report()
            state['report']['candidates'][0]['render']['renderer']['mean_frame_ms'] = frame_cost
            atomic_json(folder / 'state.json', state)
        ranked = rank_rigs(self.store, self.root, 'source', 'engine', 'hero')['candidates']
        self.assertEqual(ranked[0]['id'], 'z-fast')
        self.assertIsNotNone(ranked[0]['model_id'])
        self.assertEqual(rank_rigs(self.store, self.root, 'source', 'engine', 'other')['candidates'], [])


class FakeDrive:
    def __init__(self, content):
        self.content = content
        self.metadata = None
        self.received = b''
        self.calls = []
        self.break_after_chunk = False

    def request(self, method, url, data=None, headers=None):
        self.calls.append((method, url, headers))
        if '/generateIds?' in url:
            return 200, {}, b'{"ids":["stable-id"]}'
        if method == 'POST' and url.startswith(UPLOAD):
            self.metadata = json.loads(data)
            return 200, {'Location': 'https://www.googleapis.com/upload/session'}, b''
        if method == 'PUT':
            if headers['Content-Range'].startswith('bytes */'):
                return 308, {'Range': 'bytes=0-' + str(len(self.received) - 1)}, b''
            if self.break_after_chunk:
                self.break_after_chunk = False
                raise TransferError('simulated network outage')
            self.received += data
            result = {**self.metadata, 'size': str(len(self.received)), 'md5Checksum': hashlib.md5(self.content).hexdigest()}
            self.metadata = result
            return 200, {}, json.dumps(result).encode()
        if '?alt=media' in url:
            offset, end = map(int, headers['Range'][6:].split('-'))
            return 206, {'Content-Range': f'bytes {offset}-{end}/{len(self.content)}'}, self.content[offset:end + 1]
        if '/stable-id?' in url:
            if self.metadata and len(self.received) == len(self.content):
                return 200, {}, json.dumps(self.metadata).encode()
            return 404, {}, b'{}'
        raise AssertionError((method, url))


class StorageTests(Base):
    def setUp(self):
        super().setUp()
        self.content = b'glTF-data-with-textures'
        self.source = self.root / 'source.glb'
        self.source.write_bytes(self.content)
        self.http = FakeDrive(self.content)
        self.storage = GoogleDriveStorageProvider(self.store, self.http)

    def test_upload_is_idempotent_and_versions_immutable(self):
        self.assertEqual(self.storage.upload('character', 'v1', self.source), 'stable-id')
        first = len(self.http.calls)
        self.storage.upload('character', 'v1', self.source)
        self.assertEqual(len(self.http.calls), first + 1)
        self.source.write_bytes(b'changed')
        with self.assertRaises(ValueError):
            self.storage.register('character', 'v1', self.source)

    def test_upload_session_survives_process_restart(self):
        self.http.break_after_chunk = True
        with self.assertRaises(TransferError):
            self.storage.upload('character', 'v1', self.source)
        self.assertIsNotNone(self.storage.row('character', 'v1')['upload_session'])
        self.http.received = self.content[:8]  # remote accepted a prefix before coordinator died
        reopened = Store(self.store.root)
        storage = GoogleDriveStorageProvider(reopened, self.http)
        self.assertEqual(storage.upload('character', 'v1', self.source), 'stable-id')
        self.assertEqual(self.http.received, self.content)
        self.assertIsNone(storage.row('character', 'v1')['upload_session'])
        reopened.close()

    def test_recover_missing_asset_resumes_and_preserves_bytes(self):
        self.storage.upload('character', 'v1', self.source)
        self.source.unlink()
        row = self.storage.row('character', 'v1')
        (self.storage.cache / (row['sha256'] + '.partial')).write_bytes(self.content[:8])
        path = self.storage.recover('character', 'v1')
        self.assertEqual(path.read_bytes(), self.content)
        self.assertEqual(self.http.calls[-1][2]['Range'], f'bytes=8-{len(self.content)-1}')
        calls = len(self.http.calls)
        self.assertEqual(self.storage.recover('character', 'v1'), path)
        self.assertEqual(len(self.http.calls), calls)

    def test_corrupt_recovery_never_replaces_valid_asset(self):
        self.storage.upload('character', 'v1', self.source)
        self.http.content = b'X' * len(self.content)
        with self.assertRaises(TransferError):
            self.storage.recover('character', 'v1')
        self.assertEqual(self.source.read_bytes(), self.content)
        self.assertFalse(any(self.storage.cache.iterdir()))

    def test_cloud_checksum_mismatch_rejected(self):
        self.storage.upload('character', 'v1', self.source)
        self.http.metadata['md5Checksum'] = 'bad'
        with self.assertRaises(TransferError):
            self.storage.upload('character', 'v1', self.source)


if __name__ == '__main__':
    unittest.main()
