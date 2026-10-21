"""Coordinator entrypoints used by the existing authenticated avatar worker."""
import argparse
import fcntl
import json
import os
import sys
from pathlib import Path
from .compute import ColabComputeProvider, ComputeOrchestrator, LocalCPUComputeProvider, LocalGPUComputeProvider
from .learning import (MLDataCollector, MLInferenceEngine, ModelRegistry,
                       TrainingDatasetManager, TrainingOrchestrator, ExperimentTracker)
from .store import Store, atomic_json, file_hash
from .storage import GoogleDriveStorageProvider, DriveHTTP, OAuthToken
from .quality import AssetQualityEvaluator


def providers():
    script = Path(__file__).with_name('train_worker.py')
    local = LocalCPUComputeProvider({'quality_train': [sys.executable, str(script)]})
    available = [ColabComputeProvider(os.environ.get('ASSET_COLAB_SESSION'), script, 'asset-quality-stdlib-v1'), local]
    if os.environ.get('ASSET_LOCAL_GPU_PYTHON'):
        python = os.environ['ASSET_LOCAL_GPU_PYTHON']
        available.append(LocalGPUComputeProvider({'quality_train': [python, str(script)]},
                         [python, str(script.with_name('gpu_probe.py'))], 'asset-quality-stdlib-v1'))
    return available


def drive(store):
    token = os.environ.get('ASSET_DRIVE_TOKEN_FILE')
    if not token:
        raise RuntimeError('Drive OAuth is not configured')
    return GoogleDriveStorageProvider(store, DriveHTTP(OAuthToken(token)), os.environ.get('ASSET_DRIVE_PARENT_ID'))


def summary(store):
    def counts(table, key):
        return {row[0]: row[1] for row in store.db.execute('SELECT ' + key + ',COUNT(*) FROM ' + table + ' GROUP BY ' + key)}
    champion = ModelRegistry(store).active()
    return {'schema': 'asset-intelligence-v1', 'compute': {'jobs': counts('jobs', 'status'),
                'colab_configured': bool(os.environ.get('ASSET_COLAB_SESSION')),
                'gpu_model_dispatch': 'existing_workers_only'},
            'dataset': {'examples': counts('examples', 'disposition'), 'splits': counts('examples', 'split'),
                        'training_requires': {'train_families': 30, 'validation_families': 8, 'locked_test_families': 8}},
            'model': {'champion': champion['id'] if champion else None,
                      'benchmark': json.loads(champion['benchmark']) if champion else None},
            'drive': {'configured': bool(os.environ.get('ASSET_DRIVE_TOKEN_FILE')),
                      'registered_versions': store.db.execute('SELECT COUNT(*) FROM artifacts').fetchone()[0],
                      'pending_uploads': store.db.execute("SELECT COUNT(*) FROM artifacts a WHERE NOT EXISTS (SELECT 1 FROM events e WHERE e.subject=a.asset_id||':'||a.version AND e.kind='cloud_synced')").fetchone()[0]},
            'recent_events': [dict(row) for row in store.db.execute('SELECT at,subject,kind,detail FROM events ORDER BY id DESC LIMIT 12')],
            'limits': ['No curated visual critic or licensed MDM motions installed',
                       'SkinTokens candidate generation not yet admitted',
                       'Asset publication and generation admission keep existing owner controls']}


def collect(store, folder):
    identity = MLDataCollector(store).collect(folder)
    if identity:
        quality_path = Path(folder) / 'asset-quality.json'
        quality = json.loads(quality_path.read_text())
        quality['prediction'] = MLInferenceEngine(store).predict(quality)
        atomic_json(quality_path, quality)
    return identity


def rank_rigs(store, avatar_root, source_hash, engine_hash, avatar_id):
    """Rank real cached rigs during outage recovery; selected rigs requalify."""
    candidates = []
    inference = MLInferenceEngine(store)
    for folder in sorted(Path(avatar_root).iterdir()):
        if not folder.is_dir() or folder.is_symlink():
            continue
        try:
            plan = json.loads((folder / 'preparation-plan.json').read_text())
            proof = json.loads((folder / 'unirig-result.json').read_text())
            path = folder / 'unirig-rigged.glb'
            if (plan['avatar_id'] != avatar_id or proof['status'] != 'rigged_unqualified'
                    or proof['plan']['source_sha256'] != source_hash
                    or proof['plan']['engine_sha256'] != engine_hash
                    or path.is_symlink() or path.stat().st_size != proof['artifact']['bytes']
                    or file_hash(path) != proof['artifact']['sha256']):
                continue
            quality = AssetQualityEvaluator().evaluate(json.loads((folder / 'state.json').read_text()))
            prediction = inference.predict(quality)
            score = prediction.get('score') if prediction.get('score') is not None else quality.get('technical_score')
            candidates.append({'id': folder.name, 'hard_pass': quality['hard_pass'],
                               'score': score, 'model_id': prediction.get('model_id')})
        except (OSError, KeyError, ValueError):
            continue
    candidates.sort(key=lambda item: (not item['hard_pass'], -(item['score'] or 0), item['id']))
    return {'candidates': candidates, 'scope': 'Compatible cached rig recovery; every selected rig is requalified'}


def tick(store, avatar_root):
    # A second process exits immediately. Model execution and transfer never run
    # twice because the API and timer happen to request a tick together.
    with (store.root / 'tick.lock').open('a') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return {'status': 'busy'}
        folders = []
        for folder in sorted(Path(avatar_root).iterdir()):
            if not folder.is_dir() or folder.is_symlink() or not (folder / 'preparation-plan.json').is_file():
                continue
            folders.append(folder)
            try:
                collect(store, folder)
            except (OSError, ValueError, KeyError):
                # Partial writes and old report formats never become positive labels.
                continue
        compute = ComputeOrchestrator(store, providers())
        TrainingOrchestrator(store, compute).schedule()
        compute.tick()
        for row in store.db.execute("SELECT id,result FROM jobs WHERE status='complete' AND id LIKE 'quality-%'").fetchall():
            if store.db.execute("SELECT 1 FROM events WHERE subject=? AND kind='model_evaluated'", (row['id'],)).fetchone():
                continue
            result = ModelRegistry(store).promote(json.loads(row['result']))
            with store.db:
                store.event(row['id'], 'model_evaluated', result)
        frozen = TrainingDatasetManager(store).snapshot()
        if frozen:
            ModelRegistry(store).rollback_if_regressed(frozen[1]['records'])
        # One transfer per tick: bounded network cost and resumable after restart.
        if os.environ.get('ASSET_DRIVE_TOKEN_FILE'):
            storage = drive(store)
            pending = None
            for folder in folders:
                for name in ['preparation-plan.json', 'candidate-01.glb', 'unirig-rigged.glb', 'baseline.glb',
                             'unirig-result.json', 'preparation.json', 'geometry-qualification.json']:
                    path = folder / name
                    if not path.is_file() or path.is_symlink():
                        continue
                    # Only sync terminal outputs, versioned by content checksum.
                    state = json.loads((folder / 'state.json').read_text())
                    if state.get('status') not in {'ready', 'needs_review', 'failed', 'awaiting_retarget'}:
                        continue
                    asset_id, version = folder.name + ':' + name, file_hash(path)
                    storage.register(asset_id, version, path)
                    done = store.db.execute("SELECT 1 FROM events WHERE subject=? AND kind='cloud_synced'", (asset_id + ':' + version,)).fetchone()
                    if not done and pending is None:
                        pending = (asset_id, version, path)
            if pending:
                try:
                    cloud_id = storage.upload(*pending)
                    with store.db:
                        store.event(pending[0] + ':' + pending[1], 'cloud_synced', {'drive_id': cloud_id})
                except (OSError, RuntimeError, ValueError):
                    with store.db:
                        store.event(pending[0], 'cloud_sync_pending', {'reason': 'Transfer incomplete; source retained'})
            else:
                # Frozen datasets and model/checkpoint evidence use the same
                # immutable Drive contract; they are never served directly.
                evidence = []
                for row in store.db.execute('SELECT id,payload FROM snapshots ORDER BY id'):
                    path = store.root / 'datasets' / (row['id'] + '.json')
                    if not path.exists():
                        atomic_json(path, json.loads(row['payload']))
                    evidence.append(('dataset:' + row['id'], row['id'], path))
                for path in sorted((store.root / 'models').glob('*.json')):
                    evidence.append(('model:' + path.stem, file_hash(path), path))
                for asset_id, version, path in evidence:
                    if store.db.execute("SELECT 1 FROM events WHERE subject=? AND kind='cloud_synced'", (asset_id + ':' + version,)).fetchone():
                        continue
                    try:
                        cloud_id = storage.upload(asset_id, version, path)
                        with store.db:
                            store.event(asset_id + ':' + version, 'cloud_synced', {'drive_id': cloud_id})
                    except (OSError, RuntimeError, ValueError):
                        with store.db:
                            store.event(asset_id, 'cloud_sync_pending', {'reason': 'Dataset/model backup pending'})
                    break
        # Mirror at most one model per tick. Failure never loses local evidence.
        if os.environ.get('ASSET_MLFLOW_TRACKING_URI'):
            for model in store.db.execute('SELECT id FROM models ORDER BY created_at').fetchall():
                if store.db.execute("SELECT 1 FROM events WHERE subject=? AND kind='mlflow_mirrored'", (model['id'],)).fetchone():
                    continue
                try:
                    version = ExperimentTracker(os.environ['ASSET_MLFLOW_TRACKING_URI']).mirror(store, model['id'])
                    with store.db:
                        store.event(model['id'], 'mlflow_mirrored', {'version': version})
                except Exception:
                    with store.db:
                        store.event(model['id'], 'mlflow_pending', {'reason': 'Optional registry unavailable'})
                break
            try:
                ExperimentTracker(os.environ['ASSET_MLFLOW_TRACKING_URI']).sync_aliases(store)
            except Exception:
                with store.db:
                    store.event('mlflow', 'alias_sync_pending', {'reason': 'Local registry remains authoritative'})
        status = summary(store)
        atomic_json(store.root / 'status.json', status)
        return status


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', default=os.environ.get('ASSET_PIPELINE_DATA', '/avatar-data/intelligence'))
    commands = parser.add_subparsers(dest='command', required=True)
    item = commands.add_parser('collect')
    item.add_argument('folder')
    item = commands.add_parser('tick')
    item.add_argument('avatar_root')
    commands.add_parser('status')
    item = commands.add_parser('label')
    item.add_argument('example_id')
    item.add_argument('--score', type=float, required=True)
    item.add_argument('--source', required=True)
    item.add_argument('--rights', required=True)
    item = commands.add_parser('recover')
    item.add_argument('asset_id')
    item.add_argument('version')
    item = commands.add_parser('rank-rigs')
    item.add_argument('avatar_root')
    item.add_argument('source_hash')
    item.add_argument('engine_hash')
    item.add_argument('avatar_id')
    args = parser.parse_args()
    store = Store(args.root)
    try:
        if args.command == 'collect':
            result = {'example_id': collect(store, args.folder)}
        elif args.command == 'tick':
            result = tick(store, args.avatar_root)
        elif args.command == 'label':
            MLDataCollector(store).label(args.example_id, args.score, args.source, args.rights)
            result = {'status': 'labeled'}
        elif args.command == 'recover':
            result = {'path': str(drive(store).recover(args.asset_id, args.version))}
        elif args.command == 'rank-rigs':
            result = rank_rigs(store, args.avatar_root, args.source_hash, args.engine_hash, args.avatar_id)
        else:
            result = summary(store)
        print(json.dumps(result, allow_nan=False))
    finally:
        store.close()


if __name__ == '__main__':
    main()
