"""Provenance-aware collection, frozen splits and measured model promotion."""
import json
import math
import random
import time
from pathlib import Path
from .quality import AssetQualityEvaluator, FEATURES
from .store import canonical, digest, atomic_json
from .train_worker import predict


def split_for(family):
    bucket = int(digest(family)[:8], 16) % 100
    return 'train' if bucket < 70 else 'validation' if bucket < 85 else 'test'


class MLDataCollector:
    def __init__(self, store):
        self.store = store

    def collect(self, folder):
        folder = Path(folder)
        plan = json.loads((folder / 'preparation-plan.json').read_text())
        if plan.get('diagnostic_fixture'):
            return None
        state = json.loads((folder / 'state.json').read_text())
        if state.get('status') not in {'ready', 'needs_review', 'failed', 'awaiting_retarget'}:
            return None
        quality = AssetQualityEvaluator().evaluate(state)
        # All revisions/engines/seeds of a source stay in one split. source family
        # may be supplied by the curator for near-duplicate source generations.
        family = plan.get('source_family') or plan['source_sha256']
        payload = {'run_id': folder.name, 'avatar_id': plan['avatar_id'], 'family': family,
                   'archetype': plan.get('character_profile') or (state.get('preparation') or {}).get('character_profile', 'unknown'),
                   'plan': plan, 'quality': quality, 'features': quality['features'],
                   'report': state.get('report'), 'preparation': state.get('preparation'),
                   'status': state['status'], 'error_type': state.get('stage') if state.get('error') else None}
        identity = digest(payload)
        disposition = 'uncertain' if quality['hard_pass'] else 'rejected'
        # A technical pass is NEVER a verified positive training label.
        with self.store.db:
            self.store.db.execute('INSERT OR IGNORE INTO examples(id,family,split,disposition,payload) VALUES(?,?,?,?,?)',
                                  (identity, family, split_for(family), disposition, canonical(payload)))
        atomic_json(folder / 'asset-quality.json', {'example_id': identity, **quality})
        return identity

    def label(self, identity, rating, source, rights):
        if (not isinstance(rating, (int, float)) or not math.isfinite(rating) or not 0 <= rating <= 100
                or source not in {'curated_reference', 'verified_correction', 'human_review'}
                or rights != 'commercial_training_permitted'):
            raise ValueError('Verified rating, label provenance and training rights required')
        row = self.store.db.execute('SELECT payload FROM examples WHERE id=?', (identity,)).fetchone()
        if not row:
            raise ValueError('Unknown example')
        if json.loads(row['payload'])['quality']['missing_measurements']:
            raise ValueError('Cannot train on incomplete measurements')
        with self.store.db:
            self.store.db.execute("UPDATE examples SET label=?,label_source=?,rights=?,disposition='verified' WHERE id=?",
                                  (rating, source, rights, identity))
            self.store.event(identity, 'verified_label', {'source': source, 'rating': rating, 'rights': rights})


class TrainingDatasetManager:
    def __init__(self, store):
        self.store = store

    def snapshot(self, minimum_train=30, minimum_eval=8):
        rows = self.store.db.execute("SELECT * FROM examples WHERE disposition='verified' AND rights='commercial_training_permitted' ORDER BY id").fetchall()
        # One example per source family prevents retries dominating the dataset.
        # Prefer latest explicit rating deterministically by example ID.
        families = {}
        for row in rows:
            payload = json.loads(row['payload'])
            families[row['family']] = {'id': row['id'], 'family': row['family'], 'split': row['split'],
                'features': payload['features'], 'label': row['label'], 'archetype': payload['archetype'],
                'label_source': row['label_source'], 'rights': row['rights']}
        records = sorted(families.values(), key=lambda row: row['id'])
        counts = {split: sum(row['split'] == split for row in records) for split in ('train', 'validation', 'test')}
        if counts['train'] < minimum_train or min(counts['validation'], counts['test']) < minimum_eval:
            return None
        snapshot = {'features': FEATURES, 'records': records, 'counts': counts, 'schema': 'asset-dataset-v1'}
        identity = digest(snapshot)
        with self.store.db:
            self.store.db.execute('INSERT OR IGNORE INTO snapshots(id,payload) VALUES(?,?)', (identity, canonical(snapshot)))
        return identity, snapshot


def confidence_lower(differences):
    """Deterministic paired bootstrap, one independent observation per family."""
    rng = random.Random(731)
    if len(differences) < 8:
        return float('-inf')
    means = sorted(sum(rng.choices(differences, k=len(differences))) / len(differences) for _ in range(1000))
    return means[24]  # lower 95% interval endpoint


class ModelRegistry:
    def __init__(self, store):
        self.store = store

    def active(self, alias='champion'):
        row = self.store.db.execute('SELECT m.* FROM models m JOIN aliases a ON a.model_id=m.id WHERE a.name=?', (alias,)).fetchone()
        return {**dict(row), 'model': json.loads(row['payload'])} if row else None

    def promote(self, result, max_prediction_ms=5, min_improvement=.5):
        snapshot_id = result['snapshot']
        record = self.store.db.execute('SELECT payload FROM snapshots WHERE id=?', (snapshot_id,)).fetchone()
        if not record:
            raise ValueError('Unregistered locked dataset')
        snapshot = json.loads(record['payload'])
        model = result['model']
        if (model.get('schema') != 'asset-quality-ridge-v1' or model.get('features') != FEATURES
                or len(model.get('coefficients', [])) != len(FEATURES) + 1
                or not all(isinstance(v, (int, float)) and math.isfinite(v) for v in model['coefficients'])):
            raise ValueError('Incompatible quality model')
        test = [row for row in snapshot['records'] if row['split'] == 'test']
        if len(test) < 8:
            raise ValueError('Insufficient independent locked test cases')
        champion = self.active()
        # A fixed mean of TRAINING labels is the first production baseline.
        train_labels = [row['label'] for row in snapshot['records'] if row['split'] == 'train']
        fallback = sum(train_labels) / len(train_labels)
        differences, errors, grouped = [], [], {}
        started = time.perf_counter()
        for row in test:
            predicted = predict(model, row)
            old = predict(champion['model'], row) if champion else fallback
            difference = abs(old - row['label']) - abs(predicted - row['label'])
            differences.append(difference)
            errors.append((predicted - row['label']) ** 2)
            grouped.setdefault(row['archetype'], []).append(difference)
        latency = (time.perf_counter() - started) * 1000 / len(test)
        mean_gain = sum(differences) / len(differences)
        lower = confidence_lower(differences)
        benchmark = {'test_rmse': math.sqrt(sum(errors) / len(errors)), 'mean_absolute_error_improvement': mean_gain,
                     'paired_gain_lower_95': lower, 'prediction_ms': latency, 'test_families': len(test),
                     'archetype_gains': {key: sum(values) / len(values) for key, values in grouped.items()},
                     'baseline_id': champion['id'] if champion else 'training-label-mean'}
        accepted = (mean_gain >= min_improvement and lower > 0 and latency <= max_prediction_ms
                    and all(value >= -1 for value in benchmark['archetype_gains'].values()))
        identity = digest({'model': model, 'snapshot': snapshot_id})
        # Atomic comparison + swap. Never replace a concurrently changed champion.
        db = self.store.db
        db.execute('BEGIN IMMEDIATE')
        try:
            current = self.active()
            if (current['id'] if current else None) != (champion['id'] if champion else None):
                raise RuntimeError('Champion changed during evaluation; reevaluate')
            db.execute('INSERT OR IGNORE INTO models(id,snapshot,payload,benchmark,created_at) VALUES(?,?,?,?,?)',
                       (identity, snapshot_id, canonical(model), canonical(benchmark), time.time()))
            if current and current['id'] == identity:
                accepted = False
            if accepted:
                if current:
                    db.execute("INSERT OR REPLACE INTO aliases(name,model_id) VALUES('previous',?)", (current['id'],))
                db.execute("INSERT OR REPLACE INTO aliases(name,model_id) VALUES('champion',?)", (identity,))
            self.store.event(identity, 'promoted' if accepted else 'candidate_rejected', benchmark)
            db.commit()
        except Exception:
            db.rollback()
            raise
        atomic_json(self.store.root / 'models' / (identity + '.json'), {'model': model, 'benchmark': benchmark, 'snapshot': snapshot_id})
        return {'id': identity, 'promoted': accepted, 'benchmark': benchmark}

    def rollback_if_regressed(self, records):
        champion, previous = self.active(), self.active('previous')
        if not champion or not previous:
            return False
        # Post-promotion monitoring must use fresh verified families, not train/test reuse.
        used = set()
        for model in (champion, previous):
            snapshot = json.loads(self.store.db.execute('SELECT payload FROM snapshots WHERE id=?', (model['snapshot'],)).fetchone()['payload'])
            used.update(row['family'] for row in snapshot['records'])
        grouped = {}
        for row in records:
            if (row['family'] not in used and row.get('label_source') in {'curated_reference', 'verified_correction', 'human_review'}
                    and row.get('rights') == 'commercial_training_permitted'):
                grouped[row['family']] = row
        losses = [abs(predict(champion['model'], row) - row['label']) - abs(predict(previous['model'], row) - row['label'])
                  for row in grouped.values()]
        if confidence_lower(losses) <= 1:
            return False
        with self.store.db:
            updated = self.store.db.execute("UPDATE aliases SET model_id=? WHERE name='champion' AND model_id=?",
                                           (previous['id'], champion['id'])).rowcount
            if updated:
                self.store.event(champion['id'], 'automatic_rollback', {'restored': previous['id'], 'families': len(losses)})
        return bool(updated)


class MLInferenceEngine:
    def __init__(self, store):
        self.registry = ModelRegistry(store)

    def predict(self, quality):
        model = self.registry.active()
        if not model or quality['missing_measurements']:
            return {'status': 'awaiting_verified_training_data', 'score': None}
        return {'status': 'predicted', 'model_id': model['id'],
                'score': predict(model['model'], {'features': quality['features']}),
                'use': 'candidate_ranking_only', 'hard_pass': quality['hard_pass']}


class TrainingOrchestrator:
    def __init__(self, store, compute):
        self.store, self.compute = store, compute

    def schedule(self, minimum_new=20):
        from .compute import JobSpec
        frozen = TrainingDatasetManager(self.store).snapshot()
        if not frozen:
            return None
        identity, snapshot = frozen
        champion = ModelRegistry(self.store).active()
        if champion:
            prior = json.loads(self.store.db.execute('SELECT payload FROM snapshots WHERE id=?', (champion['snapshot'],)).fetchone()['payload'])
            old = {row['id'] for row in prior['records']}
            if len([row for row in snapshot['records'] if row['id'] not in old]) < minimum_new:
                return None
        # No locked test rows ever leave the coordinator for training.
        payload = {'snapshot': identity, 'features': FEATURES,
                   'train': [row for row in snapshot['records'] if row['split'] == 'train'],
                   'validation': [row for row in snapshot['records'] if row['split'] == 'validation']}
        job = JobSpec(id='quality-' + identity, kind='quality_train', model_version='ridge-v1',
                      pipeline_version='asset-intelligence-v1', environment='asset-quality-stdlib-v1',
                      python='3.11|3.12|3.13', accelerators=['cpu', 'cuda'],
                      inputs=[{'snapshot': identity}], outputs=[{'kind': 'quality_model'}], payload=payload)
        self.compute.submit(job)
        return job.id


class ExperimentTracker:
    """Optional MLflow mirror; local promotion evidence remains durable offline."""
    def __init__(self, tracking_uri):
        from mlflow import MlflowClient
        self.client = MlflowClient(tracking_uri=tracking_uri)

    def mirror(self, store, identity):
        record = store.db.execute('SELECT * FROM models WHERE id=?', (identity,)).fetchone()
        name = 'avatar-quality'
        for version in self.client.search_model_versions(f"name='{name}'"):
            if version.tags.get('asset_model_id') == identity:
                return version.version
        experiment = self.client.get_experiment_by_name('avatar-quality')
        experiment_id = experiment.experiment_id if experiment else self.client.create_experiment('avatar-quality')
        run = self.client.create_run(experiment_id, tags={'asset_model_id': identity, 'dataset_snapshot': record['snapshot']})
        for name, value in json.loads(record['benchmark']).items():
            if isinstance(value, (int, float)) and math.isfinite(value):
                self.client.log_metric(run.info.run_id, name, value)
        path = store.root / 'models' / (identity + '.json')
        self.client.log_artifact(run.info.run_id, str(path), 'model')
        self.client.set_terminated(run.info.run_id)
        # MLflow registered-model creation is idempotent by querying first.
        if not self.client.search_registered_models(filter_string="name='avatar-quality'"):
            self.client.create_registered_model(name)
        version = self.client.create_model_version(name, f'runs:/{run.info.run_id}/model', run_id=run.info.run_id)
        self.client.set_model_version_tag(name, version.version, 'asset_model_id', identity)
        champion = ModelRegistry(store).active()
        if champion and champion['id'] == identity:
            self.client.set_registered_model_alias(name, 'champion', version.version)
        return version.version

    def sync_aliases(self, store):
        for alias in ['champion', 'previous']:
            model = ModelRegistry(store).active(alias)
            if not model:
                continue
            event = store.db.execute("SELECT detail FROM events WHERE subject=? AND kind='mlflow_mirrored' ORDER BY id DESC LIMIT 1", (model['id'],)).fetchone()
            if event:
                version = json.loads(event['detail'])['version']
                self.client.set_registered_model_alias('avatar-quality', alias, str(version))
