"""Bounded telemetry and reference-aware artifact retention for the private worker."""
import hashlib
import json
import os
import shutil
import sqlite3
import time
from pathlib import Path

DEFAULTS = {'storage_gib': 20, 'failed_days': 7, 'raw_days': 14, 'log_days': 30,
            'quarantine_hours': 24, 'automatic_cleanup': True, 'ram_mib': 2048,
            'minimum_available_mib': 2048, 'reserved_mib': 2048, 'workers': 1,
            'fit_cases': 32, 'calibration_cases': 24, 'evaluation_cases': 24,
            'max_minutes': 90, 'scout_seconds': 360, 'speed': 'headless',
            'batch_size': 64, 'replay_capacity': 512, 'evaluation_every': 1}


def file_hash(path):
    digest = hashlib.sha256()
    descriptor = os.open(path, os.O_RDONLY | getattr(os, 'O_NOFOLLOW', 0))
    with os.fdopen(descriptor, 'rb') as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b''): digest.update(chunk)
    return digest.hexdigest()


def storage_bytes(root):
    total = 0
    for path in root.rglob('*'):
        try:
            if not path.is_symlink() and path.is_file(): total += path.stat().st_size
        except FileNotFoundError: pass  # Atomic producer rename; the next scan sees its destination.
    return total


def normalize(values):
    policy = {**DEFAULTS, **values}
    limits = {'storage_gib': (1, 100), 'failed_days': (1, 365), 'raw_days': (1, 365),
        'log_days': (1, 365), 'quarantine_hours': (1, 168), 'ram_mib': (512, 3072),
        'minimum_available_mib': (512, 65536), 'reserved_mib': (512, 65536),
        'workers': (1, 1), 'fit_cases': (16, 512), 'calibration_cases': (16, 512),
        'evaluation_cases': (18, 512), 'max_minutes': (1, 180), 'scout_seconds': (180, 900),
        'batch_size': (1, 512), 'replay_capacity': (16, 2048), 'evaluation_every': (1, 1)}
    for key, (low, high) in limits.items():
        if type(policy[key]) is not int or not low <= policy[key] <= high:
            raise ValueError(f'{key} must be an integer in {low}..{high}')
    if sum(policy[k] for k in ('fit_cases', 'calibration_cases', 'evaluation_cases')) > 1000:
        raise ValueError('The combined plan must fit its reserved 1000-seed block')
    if policy['speed'] not in ('1', '2', '4', 'headless'):
        raise ValueError('Speed is 1, 2, 4 or headless; 8x is not qualified')
    if type(policy['automatic_cleanup']) is not bool:
        raise ValueError('automatic_cleanup must be boolean')
    return policy


def resource_sample():
    def read(path, fallback=''):
        try: return Path(path).read_text().strip()
        except OSError: return fallback
    stats = dict(line.split() for line in read('/sys/fs/cgroup/memory.stat').splitlines())
    memory = dict((line.split(':')[0], int(line.split()[1]) * 1024) for line in read('/proc/meminfo').splitlines() if line.startswith(('MemTotal:', 'MemAvailable:')))
    events = dict(line.split() for line in read('/sys/fs/cgroup/memory.events').splitlines())
    current = int(read('/sys/fs/cgroup/memory.current', '0'))
    limit = read('/sys/fs/cgroup/memory.max', 'max')
    return {'at': time.time(), 'vm_total_mib': memory.get('MemTotal', 0) / 1048576,
        'vm_available_mib': memory.get('MemAvailable', 0) / 1048576,
        'ml_anon_mib': int(stats.get('anon', 0)) / 1048576,
        'ml_working_set_mib': max(0, current - int(stats.get('inactive_file', 0))) / 1048576,
        'ml_file_cache_mib': int(stats.get('file', 0)) / 1048576,
        'cgroup_limit_mib': None if limit == 'max' else int(limit) / 1048576,
        'cgroup_peak_mib': int(read('/sys/fs/cgroup/memory.peak', '0')) / 1048576,
        'oom_kills': int(events.get('oom_kill', 0)), 'gpu_vram_mib': None,
        'gpu_note': 'CPU-only PyTorch image; GPU/Windows-host attribution unavailable',
        'memory_scope': 'Linux Docker VM and this worker cgroup; not Windows physical RAM'}


class Operations:
    def __init__(self, root):
        self.root = Path(root).resolve()
        self.meta = self.root / '.management'
        self.meta.mkdir(exist_ok=True)
        self.db = sqlite3.connect(self.meta / 'registry.sqlite3', timeout=30, isolation_level=None)
        self.db.row_factory = sqlite3.Row
        self.db.executescript('''PRAGMA journal_mode=WAL;
          CREATE TABLE IF NOT EXISTS artifacts(id TEXT PRIMARY KEY,path TEXT UNIQUE,kind TEXT,run_id TEXT,
            sha TEXT,bytes INTEGER,modified REAL,state TEXT DEFAULT 'present',quarantined REAL);
          CREATE TABLE IF NOT EXISTS refs(artifact_id TEXT,owner TEXT,PRIMARY KEY(artifact_id,owner));
          CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY,at REAL,action TEXT,artifact_id TEXT,detail TEXT);
          CREATE TABLE IF NOT EXISTS config(id INTEGER PRIMARY KEY,value TEXT);
          CREATE TABLE IF NOT EXISTS telemetry(at REAL PRIMARY KEY,value TEXT);''')

    def policy(self):
        row = self.db.execute('SELECT value FROM config WHERE id=1').fetchone()
        return normalize(json.loads(row['value']) if row else {})

    def configure(self, values):
        policy = normalize(values)
        self.db.execute('INSERT OR REPLACE INTO config VALUES(1,?)', (json.dumps(policy),))
        return policy

    def safe(self, relative, exists=True):
        path = self.root / relative
        if Path(relative).is_absolute() or '..' in Path(relative).parts or path == self.root:
            raise ValueError('Artifact path must stay inside managed storage')
        for part in (path, *path.parents):
            if part == self.root: break
            if part.is_symlink(): raise ValueError('Artifact symlinks are forbidden')
        resolved = path.resolve(strict=exists)
        if self.root not in resolved.parents: raise ValueError('Artifact escaped managed storage')
        return path

    def register(self, relative, kind, run_id, owners=()):
        import uuid
        if str(uuid.UUID(run_id)) != run_id or Path(relative).parts[0] != run_id:
            raise ValueError('Artifact must belong to its canonical run UUID')
        path = self.safe(relative)
        if not path.is_file(): raise ValueError('Only regular files can be registered')
        digest = file_hash(path)
        identity = hashlib.sha256(relative.encode()).hexdigest()
        self.db.execute('INSERT INTO artifacts(id,path,kind,run_id,sha,bytes,modified) VALUES(?,?,?,?,?,?,?) '
            'ON CONFLICT(path) DO UPDATE SET sha=excluded.sha,bytes=excluded.bytes,modified=excluded.modified',
            (identity, relative, kind, run_id, digest, path.stat().st_size, path.stat().st_mtime))
        for owner in owners: self.pin(identity, owner)
        return identity

    def pin(self, identity, owner):
        self.db.execute('BEGIN IMMEDIATE')
        try:
            self._pin(identity, owner)
            self.db.execute('COMMIT')
        except Exception:
            self.db.execute('ROLLBACK')
            raise

    def _pin(self, identity, owner):
        row = self.db.execute('SELECT * FROM artifacts WHERE id=?', (identity,)).fetchone()
        if not row or row['state'] == 'deleted': raise ValueError('Cannot reference a missing artifact')
        if row['state'] == 'quarantined':
            original = self.safe(row['path'], exists=False)
            original.parent.mkdir(parents=True, exist_ok=True)
            self.safe('.management/quarantine/' + identity).replace(original)
            self.db.execute("UPDATE artifacts SET state='present',quarantined=NULL WHERE id=?", (identity,))
        self.db.execute('INSERT OR IGNORE INTO refs VALUES(?,?)', (identity, owner))

    def reconcile(self):
        # Legacy evidence is imported pinned, never inferred to be disposable by filename.
        # Newly registered artifacts have explicit producer-supplied roles/references.
        known = {r['path'] for r in self.db.execute('SELECT path FROM artifacts')}
        for folder in self.root.iterdir():
            if not folder.is_dir() or not (folder / 'plan.json').exists(): continue
            state = folder / 'state.json'
            if state.exists() and json.loads(state.read_text()).get('status') not in ('completed', 'failed', 'cancelled'): continue
            for path in folder.rglob('*'):
                if path.is_symlink() or not path.is_file(): continue
                relative = path.relative_to(self.root).as_posix()
                if relative not in known:
                    try: self.register(relative, 'checkpoint' if path.name == 'checkpoint.pt' else 'legacy-evidence', folder.name, ['study:' + folder.name])
                    except FileNotFoundError: pass

    def telemetry(self):
        sample = resource_sample()
        try:
            sample['cpu_usec'] = int(dict(line.split() for line in Path('/sys/fs/cgroup/cpu.stat').read_text().splitlines())['usage_usec'])
        except (OSError, KeyError): sample['cpu_usec'] = None
        previous = self.db.execute('SELECT value FROM telemetry ORDER BY at DESC LIMIT 1').fetchone()
        sample['cpu_percent'] = None
        if previous:
            previous = json.loads(previous['value'])
            if previous.get('cpu_usec') is not None and sample['cpu_usec'] is not None and sample['at'] > previous['at']:
                sample['cpu_percent'] = max(0, (sample['cpu_usec'] - previous['cpu_usec']) / 1e6 / (sample['at'] - previous['at']) * 100)
        self.db.execute('INSERT OR REPLACE INTO telemetry VALUES(?,?)', (sample['at'], json.dumps(sample)))
        self.db.execute('DELETE FROM telemetry WHERE at NOT IN (SELECT at FROM telemetry ORDER BY at DESC LIMIT 1440)')
        return sample

    def pressure(self):
        policy, sample = self.policy(), resource_sample()
        if sample['ml_anon_mib'] >= policy['ram_mib']:
            return 'ML anonymous RAM limit reached'
        if sample['vm_available_mib'] < max(policy['minimum_available_mib'], policy['reserved_mib']):
            return 'Docker VM available RAM below reserve'
        used = storage_bytes(self.root)
        if used >= policy['storage_gib'] * 1024**3: return 'Managed storage budget reached; protected evidence retained'
        if shutil.disk_usage(self.root).free < 512 * 1024**2: return 'Less than 512 MiB free on managed volume'
        return None

    def cleanup(self, execute=False, now=None):
        now = time.time() if now is None else now
        policy, actions = self.policy(), []
        self.db.execute('BEGIN IMMEDIATE')
        try:
            for row in self.db.execute("SELECT * FROM artifacts WHERE state!='deleted'").fetchall():
                if self.db.execute('SELECT 1 FROM refs WHERE artifact_id=?', (row['id'],)).fetchone(): continue
                state = self.root / row['run_id'] / 'state.json'
                if state.exists() and json.loads(state.read_text()).get('status') not in ('completed', 'failed', 'cancelled'): continue
                days = {'processed-trajectory': policy['raw_days'], 'failed-model': policy['failed_days'],
                        'log': policy['log_days'], 'temporary': 0}.get(row['kind'])
                if days is None or now - row['modified'] < days * 86400: continue
                path = self.safe(row['path']) if row['state'] == 'present' else self.safe('.management/quarantine/' + row['id'])
                if file_hash(path) != row['sha']: continue
                delete = row['state'] == 'quarantined' and now - row['quarantined'] >= policy['quarantine_hours'] * 3600
                action = 'delete' if delete else 'quarantine' if row['state'] == 'present' else 'waiting'
                actions.append({'id': row['id'], 'path': row['path'], 'bytes': row['bytes'], 'action': action})
                if not execute or action == 'waiting': continue
                if delete:
                    path.unlink()
                    self.db.execute("UPDATE artifacts SET state='deleted' WHERE id=?", (row['id'],))
                else:
                    target = self.meta / 'quarantine' / row['id']
                    target.parent.mkdir(exist_ok=True)
                    path.replace(target)
                    self.db.execute("UPDATE artifacts SET state='quarantined',quarantined=? WHERE id=?", (now, row['id']))
                self.db.execute('INSERT INTO audit(at,action,artifact_id,detail) VALUES(?,?,?,?)', (now, action, row['id'], row['path']))
            self.db.execute('COMMIT')
        except Exception:
            self.db.execute('ROLLBACK')
            raise
        return {'dry_run': not execute, 'candidates': actions, 'recoverable_bytes': sum(a['bytes'] for a in actions if a['action'] != 'waiting')}

    def report(self):
        rows = self.db.execute("SELECT a.*,GROUP_CONCAT(r.owner) owners FROM artifacts a LEFT JOIN refs r ON r.artifact_id=a.id WHERE a.state!='deleted' GROUP BY a.id").fetchall()
        samples = [json.loads(r['value']) for r in self.db.execute('SELECT value FROM telemetry ORDER BY at DESC LIMIT 120')]
        actual = storage_bytes(self.root)
        return {'policy': self.policy(), 'resources': self.telemetry(), 'history': samples,
            'actual_storage_bytes': actual, 'registered_bytes': sum(r['bytes'] for r in rows),
            'protected_count': sum(bool(r['owners']) for r in rows),
            'retained_checkpoints': sum(r['kind'] == 'checkpoint' for r in rows),
            'protected_models': [dict(r) for r in rows if r['owners'] and r['kind'] in ('model', 'checkpoint', 'failed-model')],
            'pause_reason': self.pressure(), 'preview': self.cleanup(),
            'limitations': ['One simulator is qualified; higher concurrency is rejected.', 'Legacy evidence stays pinned.',
                'No production model is deployed. Registry references protect future deployment/match/rollback pins.',
                'CPU-only training; no measured GPU VRAM attribution.']}
