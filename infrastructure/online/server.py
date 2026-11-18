"""Private match launcher plus authenticated read-only WebSocket streaming."""
import asyncio
import gzip
import hmac
import json
import os
import re
import shutil
import subprocess
import threading
import time
from collections import deque
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse, parse_qs

from websockets.asyncio.server import serve

ROOT = Path('/online-data')
ROOT.mkdir(exist_ok=True)
TOKEN = os.environ['ONLINE_WORKER_TOKEN']
LOCK = threading.Lock()
PROCESSES = {}
FRAME_CACHE = {}
FRAME_CACHE_LOCK = threading.Lock()
# Matches simulated at once (one Node process each); defaults to the machine's cores.
MAX_MATCHES = max(1, int(os.environ.get('ONLINE_MAX_MATCHES', os.cpu_count() or 1)))
LIVE_MAPS = ('fontessa', 'spillway')
# Heap cap per match process: V8 otherwise keeps ~400 MB resident; ~250 MB with the cap, same result.
MATCH_HEAP_MB = max(96, int(os.environ.get('ONLINE_MATCH_HEAP_MB', '192')))
# Accepted allocations waiting for a free slot (started in order by the dispatcher thread).
PENDING = deque()
RUN_ID = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
MANIFEST = json.loads(Path('/online/manifest.json').read_text())
# Replay retention (official version-5 replays on this worker's disk; see replay_retention.py).
# 30 days keeps a month of matchdays watchable (about 5.4 MB per match); 0 keeps replays forever.
REPLAY_RETENTION_DAYS = float(os.environ.get('ONLINE_REPLAY_RETENTION_DAYS', '30'))
REPLAY_SWEEP_MINUTES = max(1.0, float(os.environ.get('ONLINE_REPLAY_SWEEP_MINUTES', '60')))
# Low-disk guard: below this much free space, the oldest aired replays go first (0 disables it).
REPLAY_MIN_FREE_GB = max(0.0, float(os.environ.get('ONLINE_REPLAY_MIN_FREE_GB', '2')))
REPLAY_STATS = {}


def latest_stream_snapshot(folder):
    """Read each atomic recording revision once, shared by authorized viewers.

    Retain the exact worker JSON rather than decoding/re-encoding its full event
    history for every viewer every 100 ms. No transport or replay schema change.
    """
    path = folder / 'snapshot.json'
    with FRAME_CACHE_LOCK:
        try:
            stat = path.stat()
        except FileNotFoundError:
            return None
        marker = (stat.st_mtime_ns, stat.st_size, stat.st_ino)
        cached = FRAME_CACHE.get(folder.name)
        if cached and cached[0] == marker:
            return cached[1:]
        raw = path.read_text()
        sequence = json.loads(raw)['sequence']
        if folder.name not in FRAME_CACHE and len(FRAME_CACHE) >= 16:
            del FRAME_CACHE[next(iter(FRAME_CACHE))]
        FRAME_CACHE[folder.name] = (marker, sequence, raw)
        return sequence, raw


def write_json(path, value):
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(value, ensure_ascii=False))
    temporary.replace(path)


def running_matches():
    return sum(1 for process in PROCESSES.values() if process.poll() is None)


def start_worker(match_id, folder, plan):
    """Start one match process (caller holds LOCK)."""
    for key in [key for key, process in PROCESSES.items() if process.poll() is not None]:
        del PROCESSES[key]
    if match_id in PENDING:
        PENDING.remove(match_id)
    bundle = Path('/online/engine/fps-engine.mjs')
    with open(folder / 'worker.log', 'ab') as log:
        heap = f'--max-old-space-size={MATCH_HEAP_MB}'
        worker = ((['node', heap, '/online/fps-match-worker.mjs', str(folder)] if bundle.exists()
                   else ['node', heap, '--experimental-strip-types', '/online/fps-match-worker.mjs', str(folder)])
            if plan.get('game_mode') == 'fps_mr15_v1'
            else ['node', '/online/browser-worker.mjs', str(folder)])
        PROCESSES[match_id] = subprocess.Popen(worker,
            cwd='/workspace/EsportsClash.Web', stdout=log, stderr=subprocess.STDOUT)


def sweep_replays():
    """Remove expired replays at startup, then every REPLAY_SWEEP_MINUTES (sooner checks when disk is low)."""
    from replay_retention import scan, sweep
    last_sweep = 0.0
    while True:
        now = time.time()
        try:
            low = REPLAY_MIN_FREE_GB > 0 and shutil.disk_usage(ROOT).free < REPLAY_MIN_FREE_GB * 1024 ** 3
            if low or now - last_sweep >= REPLAY_SWEEP_MINUTES * 60:
                with LOCK:
                    active = frozenset([key for key, process in PROCESSES.items() if process.poll() is None] + list(PENDING))
                REPLAY_STATS.update(sweep(ROOT, now, REPLAY_RETENTION_DAYS * 86400, active,
                                          int(REPLAY_MIN_FREE_GB * 1024 ** 3)))
                last_sweep = now
            else:
                # Between sweeps, refresh the disk figures /health reports (one pass over the replay folders).
                records = scan(ROOT)
                REPLAY_STATS.update(replays_retained=len(records), replay_bytes=sum(r['bytes'] for r in records))
        except Exception as error:  # never take the worker down over housekeeping
            print(json.dumps({'replay_sweep_failed': str(error)}), flush=True)
            last_sweep = now
        time.sleep(300)


def dispatch_pending():
    """Start queued allocations as slots free, oldest first."""
    while True:
        time.sleep(1)
        with LOCK:
            while PENDING and running_matches() < MAX_MATCHES:
                match_id = PENDING[0]
                folder = ROOT / match_id
                try:
                    state = json.loads((folder / 'state.json').read_text())
                    plan = json.loads((folder / 'allocation.json').read_text())['plan']
                except (OSError, ValueError, KeyError):
                    PENDING.popleft()
                    continue
                if state['status'] in ('completed', 'failed', 'interrupted'):
                    PENDING.popleft()
                    continue
                start_worker(match_id, folder, plan)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        print(fmt % args, flush=True)

    def reply(self, code, body):
        data = json.dumps(body).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def handle_match(self, method):
        if not hmac.compare_digest(self.headers.get('Authorization', ''), 'Bearer ' + TOKEN):
            return self.reply(401, {'error': 'Private worker authentication required'})
        path = urlparse(self.path)
        parts = path.path.split('/')
        if len(parts) not in (3, 4, 5) or parts[1] != 'matches' or not RUN_ID.fullmatch(parts[2]):
            return self.reply(404, {'error': 'Unknown match'})
        folder = ROOT / parts[2]
        with LOCK:
            if method == 'POST':
                from history_handler import pause_for_live
                pause_for_live()
                length = int(self.headers.get('Content-Length', 0))
                if not 0 < length <= 2 * 1024 * 1024:
                    return self.reply(413, {'error': 'Allocation exceeds size limit'})
                try:
                    allocation = json.loads(self.rfile.read(length))
                    plan = allocation['plan']
                    assert plan['match_id'] == parts[2] and plan['mode'] == 'normal' and plan['schema'] == 1
                    assert type(plan['seed']) is int and 0 < plan['seed'] <= 2147483647
                    assert plan['versions'] == {key: MANIFEST[key] for key in ('catalog_version', 'rules_version', 'policy_version', 'observation_version')}
                    assert all(len(plan[side]) == 5 for side in ('blue', 'red'))
                    game_mode = plan.get('game_mode')
                    assert game_mode in (None, 'fps_mr15_v1')
                    if game_mode == 'fps_mr15_v1':
                        assert plan['fps']['format'] == 'MR15_TACTICAL_FPS'
                        assert plan['fps']['rules_version'] == 1
                        assert plan['fps'].get('simulation_version') in (4, 5)
                        assert plan['fps']['map_id'] in (LIVE_MAPS if plan['fps']['simulation_version'] == 5
                            else ('breakwater', 'foundry', 'old-quarter', 'red-mesa', 'northpoint'))
                    assert plan.get('player_profile_schema', 0) in (0, 1)
                    if plan.get('player_profile_schema') == 1:
                        profiles = plan.get('player_profiles', {})
                        ids = [slot['instance_id'] for side in ('blue', 'red') for slot in plan[side]]
                        assert len(set(ids)) == 10 and set(profiles) == set(ids)
                        attributes = {'rifling', 'sniping', 'entry', 'utility', 'positioning', 'shotcalling'}
                        for profile in profiles.values():
                            assert set(profile['stats']) == attributes or set(profile['stats']) == {'lan', 'tf', 'iq', 'ldr', 'clu', 'sta', 'flx'}
                            assert all(type(value) in (int, float) and 1 <= value <= 99 for value in profile['stats'].values())
                            assert type(profile['ovr']) is int and 1 <= profile['ovr'] <= 99
                            assert 1 <= len(profile['name']) <= 100 and profile['nationality']['code']
                    assert re.fullmatch('[a-f0-9]{64}', allocation['plan_hash'])
                except (ValueError, KeyError, TypeError, AssertionError):
                    return self.reply(422, {'error': 'Allocation or pinned versions invalid'})
                if (folder / 'allocation.json').exists():
                    if json.loads((folder / 'allocation.json').read_text()) != allocation:
                        return self.reply(422, {'error': 'An allocated match cannot change'})
                else:
                    folder.mkdir(exist_ok=True)
                    write_json(folder / 'allocation.json', allocation)
                    write_json(folder / 'state.json', {'status': 'allocated', 'sequence': 0})
                state = json.loads((folder / 'state.json').read_text())
                if state['status'] in ('completed', 'failed', 'interrupted'):
                    return self.reply(200, state)
                if parts[2] in PROCESSES and PROCESSES[parts[2]].poll() is None:
                    return self.reply(202, state)
                # Full: keep the allocation queued here and start it when a slot frees (no retry storm).
                if running_matches() >= MAX_MATCHES:
                    if parts[2] not in PENDING:
                        PENDING.append(parts[2])
                    return self.reply(202, {**state, 'status': 'queued', 'queue_position': list(PENDING).index(parts[2]) + 1})
                start_worker(parts[2], folder, plan)
                return self.reply(202, state)
            if not (folder / 'state.json').exists():
                return self.reply(404, {'error': 'Match has not started'})
            if len(parts) == 5 and parts[3] == 'replay3d':
                # Live 3D replay files, served to the API (which decides what a viewer may see yet).
                name = 'header.json' if parts[4] == 'header' else (parts[4].zfill(5) + '.json.gz' if parts[4].isdigit() and len(parts[4]) <= 5 else None)
                target = folder / 'replay' / name if name else None
                if not target or not target.exists():
                    if (folder / 'replay-expired.json').exists():
                        # Removed by the retention sweep: the result and report are kept, the replay is not.
                        return self.reply(410, {'error': 'Replay expired', 'expired': True})
                    return self.reply(404, {'error': 'Replay part not available'})
                data = target.read_bytes()
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                if name.endswith('.gz'):
                    self.send_header('Content-Encoding', 'gzip')
                self.send_header('Content-Length', str(len(data)))
                self.end_headers()
                self.wfile.write(data)
                return
            if len(parts) == 4 and parts[3] == 'replay':
                try:
                    query = parse_qs(path.query)
                    after = max(0, min(7200, int(query.get('after', ['0'])[0])))
                    limit = max(1, min(8, int(query.get('limit', ['1'])[0])))
                except ValueError:
                    return self.reply(422, {'error': 'Invalid replay cursor'})
                names = sorted((folder / 'frames').glob('*.json.gz')) if (folder / 'frames').exists() else []
                selected = [file for file in names if int(file.name.split('.')[0]) > after][:limit]
                frames = [json.loads(gzip.decompress(file.read_bytes())) for file in selected]
                return self.reply(200, {'frames': frames})
            return self.reply(200, json.loads((folder / 'state.json').read_text()))

    def do_GET(self):
        if self.path.startswith('/history/'):
            from history_handler import handle
            return handle(self,'GET',TOKEN,ROOT,PROCESSES,LOCK)
        if self.path == '/health':
            return self.reply(200, {'status': 'ok', 'content_catalog_schema': 1, 'player_profile_schema': 1, 'launch_history_schema': 1, 'rules_version': MANIFEST['rules_version'],
                'fps_simulation_versions': [4, 5], 'max_matches': MAX_MATCHES, 'running': running_matches(), 'queued': len(PENDING),
                'replays': {**REPLAY_STATS, 'retention_days': REPLAY_RETENTION_DAYS, 'min_free_gb': REPLAY_MIN_FREE_GB,
                    'disk_free_bytes': shutil.disk_usage(ROOT).free}})
        self.handle_match('GET')

    def do_POST(self):
        if self.path.startswith('/history/'):
            from history_handler import handle
            return handle(self,'POST',TOKEN,ROOT,PROCESSES,LOCK)
        self.handle_match('POST')


async def stream(socket):
    try:
        first = json.loads(await asyncio.wait_for(socket.recv(), timeout=5))
        if set(first) != {'grant'} or not isinstance(first['grant'], str) or not re.fullmatch('[a-f0-9]{64}', first['grant']):
            raise ValueError('Invalid stream grant')
        request = urllib.request.Request('http://api:8000/api/internal/online/authorize-stream',
            data=json.dumps(first).encode(), headers={'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json', 'Accept': 'application/json'})
        def authorize():
            with urllib.request.urlopen(request, timeout=5) as reply:
                return json.load(reply)
        grant = await asyncio.to_thread(authorize)
        folder = ROOT / grant['match_id']
        last_sequence = -1
        while True:
            revision = await asyncio.to_thread(latest_stream_snapshot, folder)
            if revision:
                sequence, raw = revision
                if sequence != last_sequence:
                    await socket.send(raw)
                    last_sequence = sequence
            if (folder / 'state.json').exists():
                state = json.loads((folder / 'state.json').read_text())
                if state['status'] in ('completed', 'failed', 'interrupted'):
                    await socket.send(json.dumps({'type': 'match-ended', 'schema': 1, **state}))
                    return
            try:
                await asyncio.wait_for(socket.recv(), timeout=0.1)
                await socket.close(1008, 'Read-only match stream')
                return
            except asyncio.TimeoutError:
                pass
    except Exception:
        await socket.close(1008, 'Stream authorization or connection ended')


async def main():
    if len(TOKEN) < 32:
        raise RuntimeError('Private match worker token is required')
    vite = subprocess.Popen(['node', 'node_modules/vite/bin/vite.js', '--host=127.0.0.1', '--port=5174', '--strictPort'], cwd='/workspace/EsportsClash.Web')
    http = ThreadingHTTPServer(('0.0.0.0', 8092), Handler)
    threading.Thread(target=http.serve_forever, daemon=True).start()
    threading.Thread(target=dispatch_pending, daemon=True).start()
    threading.Thread(target=sweep_replays, daemon=True).start()
    try:
        async with serve(stream, '0.0.0.0', 8091, max_size=8192, max_queue=4, write_limit=65536,
                         origins=['http://localhost:8088', 'http://127.0.0.1:8088', 'http://web', None]):
            await asyncio.Future()
    finally:
        vite.terminate()
        http.shutdown()


if __name__ == '__main__':
    asyncio.run(main())
