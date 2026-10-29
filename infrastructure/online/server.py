"""Private match launcher plus authenticated read-only WebSocket streaming."""
import asyncio
import gzip
import hmac
import json
import os
import re
import subprocess
import threading
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
RUN_ID = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
MANIFEST = json.loads(Path('/online/manifest.json').read_text())


def write_json(path, value):
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(value, ensure_ascii=False))
    temporary.replace(path)


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
        if len(parts) not in (3, 4) or parts[1] != 'matches' or not RUN_ID.fullmatch(parts[2]):
            return self.reply(404, {'error': 'Unknown match'})
        folder = ROOT / parts[2]
        with LOCK:
            if method == 'POST':
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
                if state['status'] in ('completed', 'failed'):
                    return self.reply(200, state)
                if any(process.poll() is None for key, process in PROCESSES.items() if key != parts[2]):
                    return self.reply(409, {'error': 'Worker busy; allocation remains queued'})
                if parts[2] not in PROCESSES or PROCESSES[parts[2]].poll() is not None:
                    with open(folder / 'worker.log', 'ab') as log:
                        PROCESSES[parts[2]] = subprocess.Popen(['node', '/online/browser-worker.mjs', str(folder)],
                            cwd='/workspace/EsportsClash.Web', stdout=log, stderr=subprocess.STDOUT)
                return self.reply(202, state)
            if not (folder / 'state.json').exists():
                return self.reply(404, {'error': 'Match has not started'})
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
        if self.path == '/health':
            return self.reply(200, {'status': 'ok', 'content_catalog_schema': 1, 'rules_version': MANIFEST['rules_version']})
        self.handle_match('GET')

    def do_POST(self):
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
            if (folder / 'snapshot.json').exists():
                message = json.loads((folder / 'snapshot.json').read_text())
                if message['sequence'] != last_sequence:
                    await socket.send(json.dumps(message))
                    last_sequence = message['sequence']
            if (folder / 'state.json').exists():
                state = json.loads((folder / 'state.json').read_text())
                if state['status'] in ('completed', 'failed'):
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
    try:
        async with serve(stream, '0.0.0.0', 8091, max_size=8192, max_queue=4, write_limit=65536,
                         origins=['http://localhost:8088', 'http://127.0.0.1:8088', 'http://web', None]):
            await asyncio.Future()
    finally:
        vite.terminate()
        http.shutdown()


if __name__ == '__main__':
    asyncio.run(main())
