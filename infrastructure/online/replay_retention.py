"""Retention for official version-5 replays kept on the match worker's local disk.

A replay is `/online-data/{match}/replay/` (gzipped chunks plus `header.json`). Only the replay is
removed; `allocation.json`, `state.json` (with the settled result) and `worker.log` stay, so Laravel can
still settle and report the match. A small `replay-expired.json` marker is left in its place, so the
worker can answer "expired" (410) instead of "not available yet".

A replay may be removed only when all of these hold:
- the folder is a match id (UUID), and the match is not running or queued on this worker;
- `allocation.json` pins simulation version 5, `state.json` says `completed`, and the replay header is
  the final one (`final: true`) with a broadcast length;
- the broadcast has finished airing: `max(completion, broadcast start + broadcastSeconds)` is past.
  Completion is `state.completed_at`, or the final header's write time for matches recorded before that
  field existed. The broadcast starts at the fixture kickoff, otherwise at the worker's start
  (the same rule as `OnlineMatch::broadcastStartsAt`).

Age is measured from the end of airing. Provisional headers, failed or interrupted matches, version-4
recordings (`frames/`) and anything that does not look like a match folder are never touched.
"""
import json
import math
import os
import re
import shutil
from datetime import datetime, timezone
from pathlib import Path

RUN_ID = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
MARKER = 'replay-expired.json'
# A replay is renamed to this before deletion, so a half-deleted replay is never served as a whole one.
TRASH = 'replay.expired-tmp'


def parse_time(value):
    """ISO 8601 (Laravel or JavaScript) to a UNIX timestamp, or None."""
    if not isinstance(value, str) or not value:
        return None
    text = value.strip().replace('Z', '+00:00')
    # Laravel may send microseconds or more digits than `fromisoformat` accepts on Python 3.10.
    text = re.sub(r'(\.\d{6})\d+', r'\1', text)
    try:
        moment = datetime.fromisoformat(text)
    except ValueError:
        return None
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=timezone.utc)
    return moment.timestamp()


def iso(timestamp):
    return datetime.fromtimestamp(timestamp, timezone.utc).isoformat().replace('+00:00', 'Z')


def directory_bytes(path):
    total = 0
    for current, _, files in os.walk(path):
        for name in files:
            try:
                total += os.lstat(os.path.join(current, name)).st_size
            except OSError:
                pass
    return total


def _read_json(path):
    try:
        return json.loads(path.read_text())
    except (OSError, ValueError):
        return None


def aired_until(folder):
    """When this match's version-5 broadcast finished airing (UNIX time), or None if it must be kept."""
    replay = folder / 'replay'
    if replay.is_symlink() or not replay.is_dir():
        return None
    state = _read_json(folder / 'state.json')
    allocation = _read_json(folder / 'allocation.json')
    header = _read_json(replay / 'header.json')
    if not isinstance(state, dict) or not isinstance(allocation, dict) or not isinstance(header, dict):
        return None
    plan = allocation.get('plan')
    if not isinstance(plan, dict) or not isinstance(plan.get('fps'), dict) or plan['fps'].get('simulation_version') != 5:
        return None
    if state.get('status') != 'completed' or header.get('final') is not True:
        return None
    broadcast = header.get('broadcastSeconds')
    if type(broadcast) not in (int, float) or not math.isfinite(broadcast) or broadcast <= 0:
        return None
    completed = parse_time(state.get('completed_at'))
    if completed is None:
        try:
            completed = (replay / 'header.json').stat().st_mtime  # the final header: written at completion
        except OSError:
            return None
    fixture = plan.get('fixture') if isinstance(plan.get('fixture'), dict) else {}
    start = parse_time(fixture.get('kickoff_at')) or parse_time(state.get('started_at'))
    if start is None:
        return None
    return max(completed, start + broadcast)


def scan(root):
    """Every match folder holding a version-5 replay: id, folder, bytes and end of airing (None = keep)."""
    found = []
    try:
        entries = list(os.scandir(root))
    except OSError:
        return found
    for entry in entries:
        if not RUN_ID.fullmatch(entry.name) or entry.is_symlink() or not entry.is_dir():
            continue
        folder = Path(entry.path)
        replay = folder / 'replay'
        if not replay.is_dir() or replay.is_symlink():
            continue
        found.append({'id': entry.name, 'folder': folder, 'bytes': directory_bytes(replay), 'aired_until': aired_until(folder)})
    return found


def remove_replay(record, now, reason, log=print):
    """Remove one replay (and only the replay), leaving the expiry marker. Returns the bytes freed."""
    folder = record['folder']
    replay, trash = folder / 'replay', folder / TRASH
    if trash.exists():
        shutil.rmtree(trash, ignore_errors=True)
    replay.rename(trash)
    marker = {'expired_at': iso(now), 'aired_until': iso(record['aired_until']), 'bytes': record['bytes'], 'reason': reason}
    temporary = folder / (MARKER + '.tmp')
    temporary.write_text(json.dumps(marker))
    temporary.replace(folder / MARKER)
    shutil.rmtree(trash, ignore_errors=True)
    log(json.dumps({'replay_removed': record['id'], 'reason': reason, 'bytes_freed': record['bytes'],
                    'aired_until': marker['aired_until']}))
    return record['bytes']


def sweep(root, now, retention_seconds, active=frozenset(), min_free_bytes=0, low_disk_grace_seconds=3600,
          free_bytes=lambda root: shutil.disk_usage(root).free, log=print):
    """Remove replays older than the retention, then (optionally) the oldest aired ones while disk is low.

    `active` holds match ids running or queued on this worker; they are never touched. `retention_seconds`
    of 0 or less keeps replays forever (the low-disk guard still applies). The low-disk guard removes only
    replays whose broadcast ended at least `low_disk_grace_seconds` ago, oldest first, never one on air.
    """
    root = Path(root)
    # Leftovers of an interrupted removal (the replay was already renamed away and marked).
    try:
        for entry in os.scandir(root):
            if RUN_ID.fullmatch(entry.name) and entry.is_dir() and not entry.is_symlink():
                trash = Path(entry.path) / TRASH
                if trash.is_dir() and not trash.is_symlink():
                    shutil.rmtree(trash, ignore_errors=True)
    except OSError:
        pass
    records = scan(root)
    removable = sorted((r for r in records if r['id'] not in active and r['aired_until'] is not None and r['aired_until'] <= now),
                       key=lambda r: r['aired_until'])
    removed, freed = set(), 0
    if retention_seconds > 0:
        for record in removable:
            if now - record['aired_until'] >= retention_seconds:
                try:
                    freed += remove_replay(record, now, 'retention', log)
                    removed.add(record['id'])
                except OSError as error:
                    log(json.dumps({'replay_remove_failed': record['id'], 'error': str(error)}))
    if min_free_bytes > 0:
        for record in removable:
            if record['id'] in removed or now - record['aired_until'] < low_disk_grace_seconds:
                continue
            try:
                if free_bytes(root) >= min_free_bytes:
                    break
                freed += remove_replay(record, now, 'low_disk', log)
                removed.add(record['id'])
            except OSError as error:
                log(json.dumps({'replay_remove_failed': record['id'], 'error': str(error)}))
    kept = [r for r in records if r['id'] not in removed]
    return {'replays_retained': len(kept), 'replay_bytes': sum(r['bytes'] for r in kept),
            'replays_removed': len(removed), 'bytes_freed': freed, 'swept_at': iso(now)}
