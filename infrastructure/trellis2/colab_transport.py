"""Serialize access to one Colab kernel and bound the entire CLI process group."""
import argparse
import fcntl
import hashlib
import os
from pathlib import Path
import signal
import subprocess
import sys
import time


class ColabTransportError(RuntimeError):
    pass


def execute(cli, session, code, timeout=30, lock_timeout=5):
    lock_path = Path('/tmp') / ('teamfight-colab-' + hashlib.sha256(session.encode()).hexdigest() + '.lock')
    with lock_path.open('a+') as lock:
        deadline = time.monotonic() + lock_timeout
        while True:
            try:
                fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
                break
            except BlockingIOError:
                if time.monotonic() >= deadline:
                    raise ColabTransportError('The Colab control connection is busy. Retry the same cloud operation.')
                time.sleep(.1)
        process = None
        try:
            process = subprocess.Popen([cli, 'exec', '-s', session, '--timeout', str(timeout)],
                stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                text=True, start_new_session=True)
            # CLI 0.7.5's initial kernel probe has no --timeout of its own. Bound
            # connection setup as well as execution and clean up helper threads.
            stdout, stderr = process.communicate(code, timeout=timeout + 10)
            if process.returncode:
                raise ColabTransportError('Google Colab control disconnected or rejected the operation. Reconnect the existing session.')
            return stdout
        except (OSError, subprocess.TimeoutExpired) as error:
            raise ColabTransportError('Google Colab did not respond within its bounded control deadline.') from error
        finally:
            if process:
                try:
                    os.killpg(process.pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
                process.wait()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--session', required=True)
    parser.add_argument('--cli', default='colab')
    parser.add_argument('--timeout', type=int, default=30)
    args = parser.parse_args()
    try:
        print(execute(args.cli, args.session, sys.stdin.read(), args.timeout), end='')
    except ColabTransportError as error:
        print(str(error), file=sys.stderr)
        raise SystemExit(1)
