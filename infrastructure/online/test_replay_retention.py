"""Safety rules of the replay retention sweep: python -m unittest infrastructure/online/test_replay_retention.py"""
import json
import os
import sys
import tempfile
import unittest
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from replay_retention import MARKER, TRASH, iso, sweep  # noqa: E402

DAY = 86400
NOW = 1_800_000_000.0
RETENTION = 30 * DAY


def make_match(root, *, version=5, status='completed', final=True, kickoff=None, started=None, completed=None,
               broadcast=2400.0, chunks=3):
    match_id = str(uuid.uuid4())
    folder = root / match_id
    (folder / 'replay').mkdir(parents=True)
    plan = {'match_id': match_id, 'fps': {'simulation_version': version}}
    if kickoff is not None:
        plan['fixture'] = {'kickoff_at': iso(kickoff)}
    (folder / 'allocation.json').write_text(json.dumps({'plan': plan}))
    state = {'status': status, 'sequence': 1}
    if started is not None:
        state['started_at'] = iso(started)
    if completed is not None:
        state['completed_at'] = iso(completed)
    if status == 'completed':
        state['result'] = {'winner': 'blue'}
    (folder / 'state.json').write_text(json.dumps(state))
    (folder / 'replay' / 'header.json').write_text(json.dumps({'final': final, 'broadcastSeconds': broadcast, 'frames': 10}))
    for index in range(chunks):
        (folder / 'replay' / f'{index:05d}.json.gz').write_bytes(b'x' * 1000)
    return match_id, folder


class ReplayRetentionTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.logs = []

    def tearDown(self):
        self.tmp.cleanup()

    def run_sweep(self, **kwargs):
        options = {'active': frozenset(), 'min_free_bytes': 0, 'free_bytes': lambda root: 10 ** 12, 'log': self.logs.append}
        options.update(kwargs)
        return sweep(self.root, NOW, RETENTION, **options)

    def test_old_finished_replay_is_removed_and_results_are_kept(self):
        match_id, folder = make_match(self.root, kickoff=NOW - 40 * DAY, started=NOW - 40 * DAY - 3600, completed=NOW - 40 * DAY - 1800)
        stats = self.run_sweep()
        self.assertFalse((folder / 'replay').exists())
        self.assertFalse((folder / TRASH).exists())
        self.assertTrue((folder / 'state.json').exists())
        self.assertTrue((folder / 'allocation.json').exists())
        self.assertEqual(json.loads((folder / 'state.json').read_text())['result'], {'winner': 'blue'})
        marker = json.loads((folder / MARKER).read_text())
        self.assertEqual(marker['reason'], 'retention')
        self.assertGreater(marker['bytes'], 3000)
        self.assertEqual(stats['replays_removed'], 1)
        self.assertEqual(stats['bytes_freed'], marker['bytes'])
        self.assertEqual(stats['replays_retained'], 0)
        self.assertTrue(any(match_id in line for line in self.logs))

    def test_age_counts_from_end_of_airing_not_completion(self):
        # Simulated 40 days ago, but the kickoff was only 10 days ago: aired 10 days ago, inside retention.
        _, folder = make_match(self.root, kickoff=NOW - 10 * DAY, started=NOW - 40 * DAY, completed=NOW - 40 * DAY)
        self.run_sweep()
        self.assertTrue((folder / 'replay' / 'header.json').exists())

    def test_recent_in_progress_and_unfinished_matches_are_kept(self):
        kept = [
            make_match(self.root, kickoff=NOW - 5 * DAY, completed=NOW - 5 * DAY)[1],                      # recent
            make_match(self.root, status='running', kickoff=NOW - 40 * DAY, started=NOW - 40 * DAY)[1],   # still simulating
            make_match(self.root, final=False, kickoff=NOW - 40 * DAY, completed=NOW - 40 * DAY)[1],      # provisional header
            make_match(self.root, status='failed', kickoff=NOW - 40 * DAY, completed=NOW - 40 * DAY)[1],  # failed
            make_match(self.root, status='allocated', kickoff=NOW - 40 * DAY)[1],                          # never started
            make_match(self.root, version=4, kickoff=NOW - 40 * DAY, completed=NOW - 40 * DAY)[1],         # recorded engine
            make_match(self.root, kickoff=NOW - 60, completed=NOW - 40 * DAY)[1],                          # on air now
            make_match(self.root, kickoff=NOW + 3600, completed=NOW - 40 * DAY)[1],                        # before kickoff
        ]
        stats = self.run_sweep()
        for folder in kept:
            self.assertTrue((folder / 'replay' / 'header.json').exists(), folder)
            self.assertFalse((folder / MARKER).exists())
        self.assertEqual(stats['replays_removed'], 0)
        self.assertEqual(stats['replays_retained'], len(kept))

    def test_running_or_queued_match_is_never_touched(self):
        match_id, folder = make_match(self.root, kickoff=NOW - 40 * DAY, completed=NOW - 40 * DAY)
        self.run_sweep(active=frozenset([match_id]))
        self.assertTrue((folder / 'replay' / 'header.json').exists())

    def test_folders_that_are_not_matches_are_ignored(self):
        _, source = make_match(self.root, kickoff=NOW - 40 * DAY, completed=NOW - 40 * DAY)
        other = self.root / 'launch-history'
        source.rename(other)
        self.run_sweep()
        self.assertTrue((other / 'replay' / 'header.json').exists())

    def test_missing_completion_marker_uses_the_final_header_time(self):
        _, folder = make_match(self.root, started=NOW - 40 * DAY)
        header = folder / 'replay' / 'header.json'
        os.utime(header, (NOW - 40 * DAY, NOW - 40 * DAY))
        self.run_sweep()
        self.assertFalse((folder / 'replay').exists())
        _, fresh = make_match(self.root, started=NOW - 40 * DAY)
        os.utime(fresh / 'replay' / 'header.json', (NOW - DAY, NOW - DAY))
        self.run_sweep()
        self.assertTrue((fresh / 'replay').exists())

    def test_retention_zero_keeps_replays_forever(self):
        _, folder = make_match(self.root, kickoff=NOW - 400 * DAY, completed=NOW - 400 * DAY)
        sweep(self.root, NOW, 0, free_bytes=lambda root: 10 ** 12, log=self.logs.append)
        self.assertTrue((folder / 'replay').exists())

    def test_low_disk_removes_oldest_aired_first_never_on_air(self):
        _, oldest = make_match(self.root, kickoff=NOW - 9 * DAY, completed=NOW - 9 * DAY)
        _, newer = make_match(self.root, kickoff=NOW - 2 * DAY, completed=NOW - 2 * DAY)
        _, just_ended = make_match(self.root, kickoff=NOW - 2400 - 600, completed=NOW - DAY)  # ended 10 minutes ago
        _, airing = make_match(self.root, kickoff=NOW - 600, completed=NOW - DAY)
        free = {'bytes': 0}
        def free_bytes(root):
            return free['bytes']
        def log(line):
            self.logs.append(line)
            free['bytes'] += 10 ** 9  # each removal frees "a lot"
        self.run_sweep(min_free_bytes=10 ** 9, free_bytes=free_bytes, log=log)
        self.assertFalse((oldest / 'replay').exists())
        self.assertEqual(json.loads((oldest / MARKER).read_text())['reason'], 'low_disk')
        self.assertTrue((newer / 'replay').exists())       # enough space after the oldest
        self.assertTrue((just_ended / 'replay').exists())  # inside the low-disk grace
        self.assertTrue((airing / 'replay').exists())

    def test_interrupted_removal_is_finished_on_the_next_sweep(self):
        _, folder = make_match(self.root, kickoff=NOW - 40 * DAY, completed=NOW - 40 * DAY)
        (folder / 'replay').rename(folder / TRASH)
        self.run_sweep()
        self.assertFalse((folder / TRASH).exists())
        self.assertTrue((folder / 'state.json').exists())


if __name__ == '__main__':
    unittest.main()
