"""Internal, authenticated job launcher. No Docker socket or generated shell commands."""
import hmac
import json
import os
import re
import signal
import subprocess
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from operations import Operations, normalize

ROOT = Path(os.environ.get('EVOLUTION_DATA', '/data'))
ROOT.mkdir(parents=True, exist_ok=True)
TOKEN = os.environ.get('EVOLUTION_WORKER_TOKEN', '')
LOCK = threading.Lock()
PROCESSES = {}
RUN_ID = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')


def write_json(path, value):
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(value, allow_nan=False, indent=2))
    temporary.replace(path)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        # Never log Authorization headers, bodies or local credentials.
        print(fmt % args, flush=True)

    def reply(self, code, value):
        body = json.dumps(value, allow_nan=False).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def handle_run(self, method):
        if not TOKEN or not hmac.compare_digest(self.headers.get('Authorization', ''), 'Bearer ' + TOKEN):
            return self.reply(401, {'error': 'Worker authentication required'})
        if self.path.startswith('/operations'):
            with LOCK:
                manager = Operations(ROOT)
                try:
                    if self.path == '/operations' and method == 'GET':
                        return self.reply(200, manager.report())
                    if method != 'POST': return self.reply(405, {'error': 'POST required'})
                    length = int(self.headers.get('Content-Length', 0))
                    if not 0 < length <= 8192: return self.reply(413, {'error': 'Invalid operations body'})
                    body = json.loads(self.rfile.read(length))
                    if self.path == '/operations/configure':
                        return self.reply(200, manager.configure(body))
                    if self.path == '/operations/reconcile':
                        manager.reconcile()
                        if manager.policy()['automatic_cleanup']: manager.cleanup(execute=True)
                        return self.reply(200, manager.report())
                    if self.path == '/operations/cleanup':
                        return self.reply(200, manager.cleanup(execute=body.get('execute') is True))
                    return self.reply(404, {'error': 'Unknown operations action'})
                except (ValueError, TypeError, OSError) as error:
                    return self.reply(422, {'error': str(error)})
                finally:
                    manager.db.close()
        parts = self.path.split('/')
        if len(parts) != 3 or parts[1] != 'runs' or not RUN_ID.fullmatch(parts[2]):
            return self.reply(404, {'error': 'Unknown run'})
        run_id = parts[2]
        folder = ROOT / run_id
        with LOCK:
            if method == 'POST':
                length = int(self.headers.get('Content-Length', 0))
                if length < 1 or length > 8192:
                    return self.reply(413, {'error': 'Invalid plan size'})
                try:
                    plan = json.loads(self.rfile.read(length))
                    assert isinstance(plan, dict)
                    expected = {'version', 'seed_start', 'fit_cases', 'calibration_cases', 'evaluation_cases',
                                'horizon_seconds', 'after_seconds', 'max_minutes', 'policy_scope',
                                'minimum_evaluation_cases', 'automatic_promotion'}
                    modern = plan.get('version') == 2
                    assert set(plan) == expected | ({'operations'} if modern else set())
                    assert plan['version'] in (1, 2) and plan['policy_scope'] == 'offline-live-macro'
                    assert plan['automatic_promotion'] is False and plan['horizon_seconds'] == 30 and plan['after_seconds'] == 120
                    if modern:
                        settings = normalize(plan['operations'])
                        assert all(plan[key] == settings[key] for key in ('fit_cases', 'calibration_cases', 'evaluation_cases', 'max_minutes'))
                    else:
                        assert plan['fit_cases'] == 32 and plan['calibration_cases'] == 24 and plan['evaluation_cases'] == 24
                    assert type(plan['seed_start']) is int and 20001 <= plan['seed_start'] <= 2147482000
                    assert type(plan['max_minutes']) is int and 1 <= plan['max_minutes'] <= 180
                    assert plan['minimum_evaluation_cases'] == 18
                except (ValueError, TypeError, AssertionError):
                    return self.reply(422, {'error': 'Unsupported immutable training plan'})
                if folder.exists() and (folder / 'plan.json').exists():
                    if json.loads((folder / 'plan.json').read_text()) != plan:
                        return self.reply(409, {'error': 'Plan cannot change after creation'})
                else:
                    if (folder / 'state.json').exists() and json.loads((folder / 'state.json').read_text())['status'] == 'cancelled':
                        return self.reply(200, {'status': 'cancelled', 'progress': {}})
                    folder.mkdir(exist_ok=True)
                    write_json(folder / 'plan.json', plan)
                    write_json(folder / 'state.json', {'status': 'queued', 'progress': {}})
                state = json.loads((folder / 'state.json').read_text())
                if state['status'] in ('completed', 'failed', 'cancelled'):
                    return self.reply(200, state)
                if any(p.poll() is None for key, p in PROCESSES.items() if key != run_id):
                    return self.reply(409, {'error': 'Only one resource-bounded run may execute'})
                if run_id not in PROCESSES or PROCESSES[run_id].poll() is not None:
                    previous = PROCESSES.get(run_id)
                    if previous and previous.returncode not in (None, 0):
                        state.update(status='failed', error='Worker exited unexpectedly; no automatic OOM retry or seed replacement')
                        write_json(folder / 'state.json', state)
                        return self.reply(200, state)
                    manager = Operations(ROOT)
                    if modern and state['status'] == 'queued': manager.configure(plan['operations'])
                    pressure = manager.pressure()
                    manager.db.close()
                    if pressure:
                        state.update(status='paused_resource', error=pressure)
                        write_json(folder / 'state.json', state)
                        return self.reply(200, state)
                    starts_file = folder / 'starts.json'
                    starts = json.loads(starts_file.read_text())['count'] if starts_file.exists() else 0
                    if starts >= 3:
                        state.update(status='failed', error='Three recovery launches exhausted; inspect memory/crash evidence before a new study')
                        write_json(folder / 'state.json', state)
                        return self.reply(200, state)
                    write_json(starts_file, {'count': starts + 1})
                    log = open(folder / 'worker.log', 'ab', buffering=0)
                    try:
                        PROCESSES[run_id] = subprocess.Popen(['python', '/runner/pipeline.py', str(folder)],
                            stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
                    finally:
                        log.close()
                return self.reply(202, state)
            if not (folder / 'state.json').exists():
                if method == 'DELETE':
                    folder.mkdir(exist_ok=True)
                    write_json(folder / 'state.json', {'status': 'cancelled', 'progress': {}})
                else:
                    return self.reply(404, {'error': 'Unknown run'})
            if method == 'DELETE':
                (folder / 'cancel').touch()
                process = PROCESSES.get(run_id)
                if process and process.poll() is None:
                    os.killpg(process.pid, signal.SIGTERM)
                    try:
                        process.wait(timeout=10)
                    except subprocess.TimeoutExpired:
                        os.killpg(process.pid, signal.SIGKILL)
                        process.wait(timeout=5)
                state = json.loads((folder / 'state.json').read_text())
                if state['status'] not in ('completed', 'failed'):
                    state['status'] = 'cancelled'
                    write_json(folder / 'state.json', state)
            return self.reply(200, json.loads((folder / 'state.json').read_text()))

    def do_GET(self):
        if self.path == '/health':
            return self.reply(200, {'status': 'ok'})
        if self.path == '/runs':
            if not TOKEN or not hmac.compare_digest(self.headers.get('Authorization', ''), 'Bearer ' + TOKEN):
                return self.reply(401, {'error': 'Worker authentication required'})
            with LOCK:
                records = []
                for folder in ROOT.iterdir():
                    if RUN_ID.fullmatch(folder.name) and (folder / 'plan.json').exists() and (folder / 'state.json').exists():
                        execution = json.loads((folder / 'execution.json').read_text()) if (folder / 'execution.json').exists() else {}
                        records.append({'id': folder.name, 'plan': json.loads((folder / 'plan.json').read_text()),
                            'state': json.loads((folder / 'state.json').read_text()), 'started_unix': execution.get('started_unix')})
                return self.reply(200, {'runs': records})
        self.handle_run('GET')

    def do_POST(self):
        self.handle_run('POST')

    def do_DELETE(self):
        self.handle_run('DELETE')


if __name__ == '__main__':
    if len(TOKEN) < 32:
        raise RuntimeError('Set a private worker token of at least 32 characters')
    ThreadingHTTPServer(('0.0.0.0', 8090), Handler).serve_forever()
