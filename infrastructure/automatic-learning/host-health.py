#!/usr/bin/env python3
"""Loopback health endpoint for the dedicated headless-training Lightsail host."""
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
import json, shutil, subprocess, time
from datetime import datetime, timezone

DATA = Path('/opt/fps-learning/EsportsClash.Api/storage/app/automatic-learning')

def healthy():
    mem = {}
    for line in Path('/proc/meminfo').read_text().splitlines():
        key, value = line.split(':', 1)
        mem[key] = int(value.strip().split()[0])
    _, _, free = shutil.disk_usage(DATA)
    if mem['MemAvailable'] / mem['MemTotal'] < .20 or free / shutil.disk_usage(DATA).total < .15:
        return False
    status = subprocess.run(['docker', 'ps', '--filter', 'label=com.docker.compose.service=automatic-learning', '--format', '{{.Status}}'], capture_output=True, text=True, timeout=4)
    if status.returncode or not status.stdout.strip().startswith('Up '):
        return False
    try:
        heartbeat = json.loads((DATA / 'heartbeat.json').read_text())
        return time.time() - datetime.fromisoformat(heartbeat['at'].replace('Z', '+00:00')).timestamp() < 120
    except (OSError, ValueError, KeyError):
        return False

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        ok = self.path == '/health' and healthy()
        self.send_response(200 if ok else 503)
        self.end_headers()
        self.wfile.write(b'ok\n' if ok else b'unhealthy\n')
    def log_message(self, *_):
        pass

HTTPServer(('127.0.0.1', 8095), Handler).serve_forever()
