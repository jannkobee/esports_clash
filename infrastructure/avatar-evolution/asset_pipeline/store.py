"""Small durable coordinator database, on the existing avatar-data volume."""
import hashlib
import json
import os
import sqlite3
import tempfile
from pathlib import Path


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), allow_nan=False)


def digest(value):
    return hashlib.sha256(canonical(value).encode()).hexdigest()


def file_hash(path, algorithm='sha256'):
    result = hashlib.new(algorithm)
    with Path(path).open('rb') as source:
        for block in iter(lambda: source.read(1024 * 1024), b''):
            result.update(block)
    return result.hexdigest()


def atomic_json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix=path.name + '.', dir=path.parent)
    try:
        with os.fdopen(fd, 'w') as output:
            output.write(canonical(value))
            output.flush()
            os.fsync(output.fileno())
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


class Store:
    def __init__(self, root):
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True)
        self.db = sqlite3.connect(self.root / 'coordinator.sqlite', timeout=30)
        self.db.row_factory = sqlite3.Row
        self.db.execute('PRAGMA journal_mode=WAL')
        self.db.executescript('''
          CREATE TABLE IF NOT EXISTS jobs (
            id TEXT PRIMARY KEY, spec TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'queued',
            priority INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0,
            available_at REAL NOT NULL DEFAULT 0, lease_until REAL, lease_token TEXT,
            provider TEXT, result TEXT, error TEXT);
          CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY, at REAL NOT NULL, subject TEXT NOT NULL,
            kind TEXT NOT NULL, detail TEXT NOT NULL);
          CREATE TABLE IF NOT EXISTS artifacts (
            asset_id TEXT NOT NULL, version TEXT NOT NULL, sha256 TEXT NOT NULL,
            bytes INTEGER NOT NULL, drive_id TEXT, upload_session TEXT,
            PRIMARY KEY(asset_id, version));
          CREATE TABLE IF NOT EXISTS examples (
            id TEXT PRIMARY KEY, family TEXT NOT NULL, split TEXT NOT NULL,
            disposition TEXT NOT NULL, payload TEXT NOT NULL, label REAL,
            label_source TEXT, rights TEXT NOT NULL DEFAULT 'unknown');
          CREATE TABLE IF NOT EXISTS snapshots (
            id TEXT PRIMARY KEY, payload TEXT NOT NULL);
          CREATE TABLE IF NOT EXISTS models (
            id TEXT PRIMARY KEY, snapshot TEXT NOT NULL, payload TEXT NOT NULL,
            benchmark TEXT NOT NULL, created_at REAL NOT NULL);
          CREATE TABLE IF NOT EXISTS aliases (name TEXT PRIMARY KEY, model_id TEXT NOT NULL);
        ''')

    def event(self, subject, kind, detail):
        import time
        self.db.execute('INSERT INTO events(at,subject,kind,detail) VALUES(?,?,?,?)',
                        (time.time(), subject, kind, canonical(detail)))

    def close(self):
        self.db.close()
