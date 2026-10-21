"""Lease-based bounded scheduler and official Colab CLI adapter.

Only registered, repository-owned handlers may run. GPU model engines retain
their existing admission paths until individually integrated and qualified.
"""
import json
import platform
import shutil
import subprocess
import time
import uuid
from dataclasses import asdict, dataclass, field
from pathlib import Path
from .store import canonical, digest


@dataclass(frozen=True)
class JobSpec:
    id: str
    kind: str
    model_version: str
    pipeline_version: str
    environment: str
    python: str
    accelerators: list
    priority: int = 0
    dependencies: list = field(default_factory=list)
    min_vram_mib: int = 0
    cuda: str | None = None
    estimated_ram_mib: int = 512
    max_runtime_s: int = 300
    max_attempts: int = 3
    retry_delay_s: int = 30
    inputs: list = field(default_factory=list)
    outputs: list = field(default_factory=list)
    checkpoint: dict | None = None
    payload: dict = field(default_factory=dict)

    def validate(self):
        if not all(isinstance(v, str) and v for v in
                   [self.id, self.kind, self.model_version, self.pipeline_version, self.environment, self.python]):
            raise ValueError('Job identity and versioned environment are required')
        if not self.accelerators or not set(self.accelerators) <= {'cpu', 'cuda'}:
            raise ValueError('Unsupported accelerator contract')
        if not (1 <= self.max_runtime_s <= 7200 and 1 <= self.max_attempts <= 5
                and 1 <= self.retry_delay_s <= 3600 and self.min_vram_mib >= 0
                and self.estimated_ram_mib > 0):
            raise ValueError('Invalid resource/retry budget')
        if self.min_vram_mib and 'cpu' in self.accelerators:
            raise ValueError('GPU memory requirements cannot silently fall back to CPU')
        if self.id in self.dependencies:
            raise ValueError('Job cannot depend on itself')
        if self.checkpoint and (self.checkpoint.get('environment') != self.environment
                                or self.checkpoint.get('model_version') != self.model_version):
            raise ValueError('Incompatible checkpoint')
        canonical(asdict(self))


@dataclass(frozen=True)
class Capacity:
    accelerator: str
    python: str
    environment: str
    available_ram_mib: int
    free_vram_mib: int = 0
    cuda: str | None = None
    device: str = 'CPU'

    def compatible(self, job):
        return (self.accelerator in job.accelerators and self.python in job.python.split('|')
                and self.environment == job.environment and self.available_ram_mib >= job.estimated_ram_mib
                and self.free_vram_mib >= job.min_vram_mib
                and (job.cuda is None or self.cuda == job.cuda))


class LocalCPUComputeProvider:
    name = 'local_cpu'

    def __init__(self, handlers, environment='asset-quality-stdlib-v1'):
        self.handlers = handlers
        self.environment = environment

    def capacity(self):
        available = 0
        try:
            for line in Path('/proc/meminfo').read_text().splitlines():
                if line.startswith('MemAvailable:'):
                    available = int(line.split()[1]) // 1024
            # Respect a container's memory allowance as well as host availability.
            maximum = Path('/sys/fs/cgroup/memory.max').read_text().strip()
            if maximum != 'max':
                remaining = int(maximum) - int(Path('/sys/fs/cgroup/memory.current').read_text())
                available = min(available, max(0, remaining // 1048576))
        except OSError:
            pass
        return Capacity('cpu', '.'.join(platform.python_version_tuple()[:2]), self.environment, available)

    def supports(self, job):
        return job.kind in self.handlers

    def run(self, job):
        # Handlers run in a subprocess, so a lease always bounds execution.
        command = self.handlers[job.kind]
        result = subprocess.run(command, input=canonical(asdict(job)), text=True, capture_output=True,
                                timeout=job.max_runtime_s, check=True)
        return json.loads(result.stdout)


class LocalGPUComputeProvider(LocalCPUComputeProvider):
    name = 'local_gpu'

    def __init__(self, handlers, probe, environment):
        super().__init__(handlers, environment)
        self.probe = probe

    def capacity(self):
        # Probe must run inside the pinned engine environment, not use the CUDA
        # maximum shown by nvidia-smi as a substitute for installed torch CUDA.
        return Capacity(**json.loads(subprocess.run(self.probe, capture_output=True, text=True,
                                                   timeout=15, check=True).stdout))


class ColabComputeProvider:
    name = 'colab'

    def __init__(self, session, script, environment, cli='colab'):
        self.session, self.script, self.environment, self.cli = session, Path(script), environment, cli

    def command(self, *arguments, timeout=30, input=None):
        return subprocess.run([self.cli, *arguments], input=input, text=True, capture_output=True,
                              timeout=timeout, check=True).stdout

    def capacity(self):
        if not self.session or not shutil.which(self.cli):
            raise RuntimeError('Colab CLI/session is not configured')
        # Marker avoids depending on human-readable CLI status formatting.
        code = """import json, platform, os
try:
 import torch
 gpu = torch.cuda.is_available()
except ImportError:
 gpu = False
ram = int(next(l.split()[1] for l in open('/proc/meminfo') if l.startswith('MemAvailable:'))) // 1024
print('ASSET_CAPACITY=' + json.dumps(dict(accelerator='cuda' if gpu else 'cpu',
 python='.'.join(platform.python_version_tuple()[:2]), environment=os.environ.get('ASSET_ENVIRONMENT','unverified'),
 available_ram_mib=ram, free_vram_mib=torch.cuda.mem_get_info()[0]//1048576 if gpu else 0,
 cuda=torch.version.cuda if gpu else None, device=torch.cuda.get_device_name(0) if gpu else 'CPU')))
"""
        output = self.command('exec', '-s', self.session, input=code)
        value = next(line.split('ASSET_CAPACITY=', 1)[1] for line in output.splitlines() if line.startswith('ASSET_CAPACITY='))
        return Capacity(**json.loads(value))

    def supports(self, job):
        return job.kind == 'quality_train' and job.environment == self.environment

    def run(self, job):
        # Single self-contained, versioned worker. No daemon, tunnel, or server.
        # Payload contains a frozen dataset, never OAuth tokens or application secrets.
        # Colab kernels persist across calls and may also run the generation
        # bridge. Keep worker definitions in their own namespace and restore stdin.
        code = ('def _run_asset_quality_worker():\n'
                ' import sys, io, json\n'
                ' previous_stdin = sys.stdin\n'
                ' try:\n'
                '  sys.stdin = io.StringIO(' + repr(canonical(asdict(job))) + ')\n'
                '  scope = {"__name__": "__main__", "__file__": "asset_quality_train_worker.py"}\n'
                '  exec(compile(' + repr(self.script.read_text()) + ', "asset_quality_train_worker.py", "exec"), scope)\n'
                '  print("ASSET_RESULT=" + json.dumps(scope["result"]))\n'
                ' finally:\n'
                '  sys.stdin = previous_stdin\n'
                '_run_asset_quality_worker()\n'
                'del _run_asset_quality_worker\n')
        output = self.command('exec', '-s', self.session, '--timeout', str(job.max_runtime_s), input=code, timeout=job.max_runtime_s)
        return json.loads(next(line.split('ASSET_RESULT=', 1)[1] for line in output.splitlines()
                               if line.startswith('ASSET_RESULT=')))


class ComputeOrchestrator:
    def __init__(self, store, providers, clock=time.time):
        self.store, self.clock = store, clock
        order = {'colab': 0, 'local_gpu': 1, 'local_cpu': 2}
        self.providers = sorted(providers, key=lambda p: order[p.name])

    def submit(self, job):
        job.validate()
        spec = canonical(asdict(job))
        with self.store.db:
            old = self.store.db.execute('SELECT spec FROM jobs WHERE id=?', (job.id,)).fetchone()
            if old and old['spec'] != spec:
                raise ValueError('Immutable job identity reused with different inputs')
            self.store.db.execute('INSERT OR IGNORE INTO jobs(id,spec,priority) VALUES(?,?,?)',
                                  (job.id, spec, job.priority))

    def tick(self):
        waiting = None
        # A GPU-only head job must not starve compatible CPU work behind it.
        for _ in range(32):
            result = self._tick_one()
            if result is None:
                return waiting
            if result['status'] != 'waiting_resources':
                return result
            waiting = result
        return waiting

    def _tick_one(self):
        now, db = self.clock(), self.store.db
        # BEGIN IMMEDIATE makes claims exclusive across coordinators. A stale
        # lease receives a NEW token; a late old executor cannot commit results.
        db.execute('BEGIN IMMEDIATE')
        try:
            db.execute("UPDATE jobs SET status='queued',lease_token=NULL,lease_until=NULL WHERE status='running' AND lease_until<?", (now,))
            rows = db.execute("SELECT * FROM jobs WHERE status IN ('queued','waiting_resources') AND available_at<=? ORDER BY priority DESC,id", (now,)).fetchall()
            selected = None
            for row in rows:
                job = JobSpec(**json.loads(row['spec']))
                if row['attempts'] >= job.max_attempts:
                    db.execute("UPDATE jobs SET status='failed',error='Retry budget exhausted' WHERE id=?", (job.id,))
                    continue
                if any(not (dep := db.execute('SELECT status FROM jobs WHERE id=?', (key,)).fetchone())
                       or dep['status'] != 'complete' for key in job.dependencies):
                    continue
                selected = (row, job)
                break
            if selected:
                row, job = selected
                token = uuid.uuid4().hex
                db.execute("UPDATE jobs SET status='running',lease_token=?,lease_until=? WHERE id=?",
                           (token, now + job.max_runtime_s + 120, job.id))
            db.commit()
        except Exception:
            db.rollback()
            raise
        if not selected:
            return None
        failures, provider, last_failed = [], None, None
        for candidate in self.providers:
            try:
                if row['attempts'] and row['error'] and row['provider'] == candidate.name:
                    failures.append({'provider': candidate.name, 'reason': 'Previous execution failed; try fallback'})
                    if candidate.supports(job) and candidate.capacity().compatible(job):
                        last_failed = candidate
                    continue
                if candidate.supports(job) and candidate.capacity().compatible(job):
                    provider = candidate
                    break
                failures.append({'provider': candidate.name, 'reason': 'Unsupported job or incompatible capacity/environment'})
            except (OSError, RuntimeError, ValueError, StopIteration, subprocess.SubprocessError):
                failures.append({'provider': candidate.name, 'reason': 'Provider unavailable or probe failed'})
        provider = provider or last_failed
        with db:
            self.store.event(job.id, 'admission', failures)
            if provider is None:
                db.execute("UPDATE jobs SET status='waiting_resources',available_at=?,lease_token=NULL,lease_until=NULL WHERE id=? AND lease_token=?",
                           (now + job.retry_delay_s, job.id, token))
                return {'id': job.id, 'status': 'waiting_resources'}
            claimed = db.execute('UPDATE jobs SET attempts=attempts+1,provider=? WHERE id=? AND lease_token=?',
                                 (provider.name, job.id, token)).rowcount
            if not claimed:
                return {'id': job.id, 'status': 'lease_lost'}
        try:
            result = provider.run(job)
            with db:
                updated = db.execute("UPDATE jobs SET status='complete',result=?,lease_token=NULL,lease_until=NULL WHERE id=? AND lease_token=?",
                                     (canonical(result), job.id, token)).rowcount
                if updated:
                    self.store.event(job.id, 'complete', {'provider': provider.name, 'result_hash': digest(result)})
            return {'id': job.id, 'status': 'complete' if updated else 'lease_lost'}
        except Exception as error:
            # Never store subprocess stderr: it may contain service credentials.
            message = type(error).__name__
            status = 'failed' if row['attempts'] + 1 >= job.max_attempts else 'queued'
            with db:
                db.execute('UPDATE jobs SET status=?,error=?,available_at=?,lease_token=NULL,lease_until=NULL WHERE id=? AND lease_token=?',
                           (status, message, self.clock() + min(3600, job.retry_delay_s * 2 ** row['attempts']), job.id, token))
                self.store.event(job.id, 'execution_failed', {'provider': provider.name, 'type': message})
            return {'id': job.id, 'status': status}
