"""Resumable fresh-world collection -> fitting -> calibration -> actual live inference trial.

Every attempted world is retained. Missing/no-target/invalid cases are never replaced.
This is a local 30-second task study, not a full-match promotion experiment.
"""
import hashlib
import gzip
import json
import os
import signal
import subprocess
import sys
import time
import urllib.request
import tempfile
from pathlib import Path

from server import write_json
from training import CONFIG, fit, calibrate
from operations import Operations
from evidence_io import read_raw, validate_case_allocation
from regression import CONFIG as DIAGNOSTIC_CONFIG, diagnose

FOLDER = Path(sys.argv[1]).resolve()
PLAN = json.loads((FOLDER / 'plan.json').read_text())
WEB = Path('/workspace/EsportsClash.Web')
CHILDREN = []
START = time.time()
PROGRESS = {}
OPERATIONS = Operations(FOLDER.parent)
LAST_BUDGET_CHECK = 0
PROFILE = None
WEB_SERVICE = None


def stop_child(process):
    if process and process.poll() is None:
        process.terminate()
        try: process.wait(timeout=10)
        except subprocess.TimeoutExpired: process.kill(); process.wait(timeout=5)


def web_service(compiled):
    global WEB_SERVICE
    stop_child(WEB_SERVICE)
    args = ['python', '-m', 'http.server', '5173', '--bind', '127.0.0.1', '--directory', 'evolution-dist'] if compiled else [
        'node', 'node_modules/vite/bin/vite.js', '--host=127.0.0.1', '--port=5173', '--strictPort']
    with open(FOLDER / 'vite.log', 'ab') as log: WEB_SERVICE = subprocess.Popen(args, cwd=WEB, stdout=log, stderr=subprocess.STDOUT)
    CHILDREN.append(WEB_SERVICE)
    wait_url('http://127.0.0.1:5173', WEB_SERVICE)


def browser():
    global PROFILE
    if PROFILE: PROFILE.cleanup()
    PROFILE = tempfile.TemporaryDirectory(prefix='evolution-profile-')
    with open(FOLDER / 'browser.log', 'ab') as log:
        chrome = subprocess.Popen(['chromium','--headless','--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--disable-webgl',
            '--no-first-run','--no-default-browser-check','--remote-debugging-port=9223',
            '--remote-debugging-address=127.0.0.1',f'--user-data-dir={PROFILE.name}','about:blank'], stdout=log, stderr=subprocess.STDOUT)
    CHILDREN.append(chrome);wait_url('http://127.0.0.1:9223/json/list',chrome)
    return chrome


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def state(status, **extra):
    PROGRESS['resources'] = OPERATIONS.telemetry()
    write_json(FOLDER / 'state.json', {'status': status, 'progress': PROGRESS, **extra})


def check_budget():
    global LAST_BUDGET_CHECK
    if (FOLDER / 'cancel').exists():
        raise InterruptedError('Owner cancelled this run')
    if time.time() - START > PLAN['max_minutes'] * 60:
        raise TimeoutError('Training time budget reached; checkpoints retained')
    if time.time() - LAST_BUDGET_CHECK >= 10:
        LAST_BUDGET_CHECK = time.time()
        pressure = OPERATIONS.pressure()
        if pressure: raise ResourceWarning(pressure)


def node(*args):
    check_budget()
    result = subprocess.run(['node', '--experimental-strip-types', 'scripts/evolution-evidence.mjs', *map(str, args)],
                            cwd=WEB, capture_output=True, text=True, timeout=30, check=True)
    return json.loads(result.stdout)


def wait_url(url, process):
    for _ in range(120):
        check_budget()
        if process.poll() is not None:
            raise RuntimeError('Browser or Vite stopped during startup')
        try:
            with urllib.request.urlopen(url, timeout=2) as response:
                if response.status == 200:
                    return
        except Exception:
            time.sleep(0.5)
    raise RuntimeError('Browser or Vite failed to become ready')


def collect(split, execution, candidate=None):
    examples = []
    for item in [i for i in execution['cases'] if i['split'] == split]:
        check_budget()
        PROGRESS.update(stage=split, current_seed=item['seed'], completed=len(list(FOLDER.glob('case-*.json'))), planned=len(execution['cases']))
        state('running')
        raw = FOLDER / f"raw-{item['seed']}.json.gz"
        legacy_raw = FOLDER / f"raw-{item['seed']}.json"
        if legacy_raw.exists(): raw = legacy_raw
        task = FOLDER / f"task-{item['seed']}.json"
        result = FOLDER / f"case-{item['seed']}.json"
        if not task.exists():
            write_json(task, item)
        elif json.loads(task.read_text()) != item:
            raise RuntimeError('Stored task differs from frozen allocation')
        if not raw.exists() and not result.exists():
            args = ['node', 'scripts/paired-live-rollout.mjs', '--checkpoint', '--fixed-scout', '--renderless',
                    '--pair=farm-push', '--horizon=30', f"--scout-seconds={item['scoutSeconds']}", f"--after={item['afterSeconds']}",
                    f"--seed={item['seed']}", f"--draft={item['draft']}", f'--output={legacy_raw}']
            if not item['swapped']:
                args.append('--original')
            if PLAN['version'] >= 2: args.append('--compiled-page' if split == 'fit' else '--fast-page')
            if candidate:
                args.append(f'--reward-model={candidate}')
            with open(FOLDER / f"attempt-{item['seed']}.log", 'ab') as log:
                # Marker precedes execution: an interrupted attempt cannot be silently rerun.
                marker = FOLDER / f"attempt-{item['seed']}.started"
                if not marker.exists():
                    marker.touch()
                    try:
                        subprocess.run(args, cwd=WEB, stdout=log, stderr=subprocess.STDOUT, timeout=min(240, max(1, PLAN['max_minutes'] * 60 - (time.time() - START))))
                    except subprocess.TimeoutExpired:
                        pass
            if legacy_raw.exists() and raw.suffix == '.gz':
                with open(legacy_raw, 'rb') as source, gzip.GzipFile(filename=str(raw)+'.tmp', mode='wb', mtime=0) as target:
                    import shutil
                    shutil.copyfileobj(source, target)
                Path(str(raw)+'.tmp').replace(raw)
        if result.exists():
            example = json.loads(result.read_text())
            validate_case_allocation(execution, [example])
            if example.get('status') == 'valid' or example.get('rawHash'):
                read_raw(FOLDER, example)
            if example.get('status') == 'valid':
                verified = node('validate', raw, task, FOLDER / 'execution.json', *([candidate] if candidate else []))
                if verified != example:
                    raise RuntimeError('Cached case differs from independently revalidated raw evidence')
        else:
            try:
                if not raw.exists():
                    example = {**item, 'status': 'incomplete', 'reason': 'Runner ended without raw evidence'}
                else:
                    example = node('validate', raw, task, FOLDER / 'execution.json', *([candidate] if candidate else []))
            except subprocess.CalledProcessError as error:
                example = {**item, 'status': 'invalid-controls', 'reason': error.stderr[-2000:], 'rawHash': sha(raw)}
            write_json(result, example)
            if raw.suffix == '.gz' and legacy_raw.exists(): legacy_raw.unlink()
        examples.append(example)
        completed = [json.loads(p.read_text()) for p in FOLDER.glob('case-*.json')]
        PROGRESS['counts'] = dict(__import__('collections').Counter(e['status'] for e in completed))
        PROGRESS['informative_contrasts'] = sum(e['status'] == 'valid' and abs(e['alternative']['reward'] - e['control']['reward']) >= .02 for e in completed)
        PROGRESS['learned_action_changes'] = sum(e.get('changed', False) for e in completed)
        PROGRESS['simulated_seconds'] = sum(e.get('simulated_seconds', 0) for e in completed)
        elapsed = max(1, time.time() - START)
        PROGRESS.update(worlds_per_minute=len(list(FOLDER.glob('case-*.json'))) / elapsed * 60,
            mean_world_seconds=elapsed / max(1, len(list(FOLDER.glob('case-*.json')))),
            simulated_seconds_per_wall_second=PROGRESS['simulated_seconds'] / elapsed,
            estimated_remaining_collection_seconds=(len(execution['cases']) - len(completed)) * elapsed / max(1, len(completed)),
            speed=PLAN.get('operations', {}).get('speed', 'headless'), active_simulation_workers=1)
        speed = PLAN.get('operations', {}).get('speed', 'headless')
        if speed != 'headless' and raw.exists():
            data = json.loads(gzip.decompress(raw.read_bytes()) if raw.suffix == '.gz' else raw.read_bytes())
            simulated = data.get('scout', {}).get('event', {}).get('second', data.get('scout', {}).get('inspection', {}).get('second', 0)) + len(data.get('replays', [])) * PLAN['horizon_seconds']
            marker = FOLDER / f"attempt-{item['seed']}.started"
            while marker.exists() and time.time() - marker.stat().st_mtime < simulated / float(speed):
                check_budget()
                time.sleep(.25)
    return examples


def summarize(examples, planned):
    valid = [e for e in examples if e['status'] == 'valid']
    supported = [e for e in valid if e.get('supported')]
    average = lambda key: sum(e[key] for e in supported) / len(supported) if supported else None
    summary = {'planned': planned, 'attempted': len(examples), 'valid': len(valid),
               'changed': sum(e.get('changed', False) for e in valid),
               'improved': sum(e.get('rewardDelta', 0) >= 0.02 for e in valid),
               'worsened': sum(e.get('rewardDelta', 0) <= -0.02 for e in valid),
               'reward_delta': sum(e.get('rewardDelta', 0) for e in valid),
               'extra_death_cases': sum(e.get('deathDelta', 0) > 0 for e in valid),
               'extra_team_death_cases': sum(e.get('teamDeathDelta', 0) > 0 for e in valid),
               'broader_worse': sum(e.get('changed') and e.get('rubric') in ('worse', 'survival-worsened', 'missing-metrics') for e in valid),
               'supported': len(supported), 'coverage': average('covered'),
               'prediction_loss': average('predictionError'), 'zero_prediction_loss': average('zeroError')}
    passes = (len(valid) >= PLAN['minimum_evaluation_cases'] and summary['changed'] >= 4
              and summary['improved'] > summary['worsened'] and summary['reward_delta'] > 0
              and not summary['extra_death_cases'] and not summary['extra_team_death_cases'] and not summary['broader_worse']
              and len(supported) >= 18 and summary['coverage'] >= 0.9
              and summary['prediction_loss'] < summary['zero_prediction_loss'])
    return {**summary, 'passes_exploratory_gate': passes, 'production_eligible': False,
            'scope': 'Thirty-second safe farm/push contexts only; full-match benefit unestablished'}


def main():
    global START, PROFILE
    manifest = node('manifest')
    execution_path = FOLDER / 'execution.json'
    if execution_path.exists():
        execution = json.loads(execution_path.read_text())
        if execution['source_hash'] != manifest['source_hash']:
            raise RuntimeError('Source changed since this run was locked; start a fresh run')
        START = execution['started_unix']
    else:
        cases = []
        for split, count in [('fit', PLAN['fit_cases']), ('calibration', PLAN['calibration_cases']), ('heldout', PLAN['evaluation_cases'])]:
            for i in range(count):
                cases.append({'seed': PLAN['seed_start'] + len(cases), 'split': split,
                              'draft': 2 + i % 8, 'swapped': bool((i // 8) % 2),
                              'afterSeconds': min(120 + 30 * (i // 8 % 3), PLAN.get('operations', {}).get('scout_seconds', 360) - 30) if PLAN['version'] >= 2 else 120,
                              'scoutSeconds': PLAN.get('operations', {}).get('scout_seconds', 360)})
        execution = {**manifest, 'cases': cases, 'started_unix': START, 'training': CONFIG,
                     'acceptance': {'minimum_valid': 18, 'minimum_changes': 4, 'coverage': 0.9,
                                    'extra_death_cases': 0, 'extra_team_death_cases': 0, 'broader_worse': 0,
                                    'positive_reward': True, 'more_gains_than_losses': True, 'beat_zero_prediction': True},
                     'production_promotion': False}
        execution['diagnostic_configuration'] = DIAGNOSTIC_CONFIG
        write_json(execution_path, execution)
    validate_case_allocation(execution, [])
    state('running')
    PROGRESS.update(current_batch_size=PLAN.get('operations', {}).get('batch_size', 64),
        collector='compiled fitting / trusted Vite evaluation' if PLAN['version'] >= 2 else 'trusted Vite')
    web_service(PLAN['version'] >= 2)
    chrome = browser()
    fitting = collect('fit', execution)
    proper_path = FOLDER / 'proper.json'
    if proper_path.exists():
        proper = json.loads(proper_path.read_text())
        assert proper['data_hash'] == hashlib.sha256(json.dumps(fitting, sort_keys=True).encode()).hexdigest()
    else:
        PROGRESS['stage'] = 'training'
        PROGRESS['active_simulation_workers'] = 0
        state('running')
        stop_child(chrome); stop_child(WEB_SERVICE)
        train_proc = subprocess.run(['python', '/runner/train_stage.py', str(FOLDER)],
            capture_output=True, text=True,
            timeout=min(180, max(1, PLAN['max_minutes'] * 60 - (time.time() - START))))
        if train_proc.returncode != 0:
            err_msg = train_proc.stderr.strip() if train_proc.stderr else f"train_stage exited with code {train_proc.returncode}"
            (FOLDER / 'train_stage.log').write_text(f"STDOUT:\n{train_proc.stdout}\n\nSTDERR:\n{train_proc.stderr}")
            raise RuntimeError(err_msg)
        proper = json.loads(proper_path.read_text())
    PROGRESS['checkpoint_hash'] = sha(FOLDER / 'checkpoint.pt') if (FOLDER / 'checkpoint.pt').exists() else None
    evaluation = {'passes_exploratory_gate': False, 'reason': 'Insufficient independent fitting contexts', 'production_eligible': False}
    candidate_path = FOLDER / 'candidate.json'
    if proper['sufficient']:
        stop_child(chrome)
        web_service(False)
        chrome = browser()
        weights_path = FOLDER / 'weights.json'
        if not weights_path.exists():
            write_json(weights_path, proper['policy'])
        node('policy', weights_path)
        proper_hash = sha(proper_path)
        calibration = collect('calibration', execution)
        if candidate_path.exists():
            candidate = json.loads(candidate_path.read_text())
            assert candidate['proper_hash'] == proper_hash
            assert candidate['calibration_hash'] == hashlib.sha256(json.dumps(calibration, sort_keys=True).encode()).hexdigest()
        else:
            calibrated = calibrate(proper, calibration)
            candidate = {'fit': calibrated, 'source_hash': execution['source_hash'], 'proper_hash': proper_hash,
                         'calibration_hash': hashlib.sha256(json.dumps(calibration, sort_keys=True).encode()).hexdigest(), 'promoted': False}
            write_json(candidate_path, candidate)
        evaluation['reason'] = 'Insufficient independent calibration contexts'
        if candidate['fit']['sufficient']:
            confidence_path = FOLDER / 'confidence.json'
            if not confidence_path.exists():
                write_json(confidence_path, candidate['fit']['policy'])
            node('policy', confidence_path)
            frozen = sha(candidate_path)
            PROGRESS['candidate_hash'] = frozen
            witness = FOLDER / 'freeze.json'
            if witness.exists():
                assert json.loads(witness.read_text())['candidate_hash'] == frozen
            else:
                assert not any((FOLDER / f"raw-{i['seed']}.json").exists() or (FOLDER / f"raw-{i['seed']}.json.gz").exists() for i in execution['cases'] if i['split'] == 'heldout')
                write_json(witness, {'candidate_hash': frozen, 'proper_hash': proper_hash, 'source_hash': execution['source_hash']})
            heldout = collect('heldout', execution, candidate_path)
            assert sha(candidate_path) == frozen and sha(proper_path) == proper_hash
            evaluation = summarize(heldout, PLAN['evaluation_cases'])
            evaluation['diagnostics'] = diagnose(heldout, PLAN['evaluation_cases'], proper.get('history'),
                proper.get('fittedLoss'), execution.get('diagnostic_configuration'))
    assert node('manifest')['source_hash'] == execution['source_hash']
    PROGRESS.update(stage='complete', completed=len(list(FOLDER.glob('case-*.json'))))
    result = {'source_hash': execution['source_hash'], 'evaluation': evaluation, 'promoted': False,
              'fitting': {key: proper[key] for key in ('sufficient', 'trainingEpisodes', 'informativeEpisodes')},
              'training_selection': proper.get('selection'), 'retained_knowledge': proper.get('retained_knowledge'),
              'training_history': proper.get('history'), 'checkpoint_hash': PROGRESS['checkpoint_hash'],
              'performance': {key: PROGRESS.get(key) for key in ('worlds_per_minute', 'simulated_seconds_per_wall_second', 'mean_world_seconds', 'counts')},
              'wall_seconds': time.time() - START,
              'artifact_path': FOLDER.name, 'candidate_hash': sha(candidate_path) if candidate_path.exists() else None}
    write_json(FOLDER / 'result.json', result)
    PROGRESS['active_simulation_workers'] = 0
    # Close log producers before recording their durable hashes. The status file
    # is registered separately after its final completed-state write.
    stop_child(chrome)
    stop_child(WEB_SERVICE)
    for path in FOLDER.iterdir():
        if path.is_file() and path.suffix != '.started' and path.name != 'state.json':
            OPERATIONS.register(path.relative_to(FOLDER.parent).as_posix(),
                'log' if path.suffix == '.log' else 'checkpoint' if path.suffix == '.pt' else 'model' if path.name in ('candidate.json', 'proper.json') else 'study-evidence',
                FOLDER.name, [] if path.suffix == '.log' else ['study:' + FOLDER.name])
    state('completed', result=result)
    OPERATIONS.register(FOLDER.name + '/state.json', 'study-evidence', FOLDER.name, ['study:' + FOLDER.name])


def shutdown(signum, frame):
    raise InterruptedError('Run stopped; checkpoints retained')


signal.signal(signal.SIGTERM, shutdown)
try:
    main()
except InterruptedError as error:
    state('cancelled', error=str(error))
except ResourceWarning as error:
    state('paused_resource', error=str(error))
except Exception as error:
    import traceback
    traceback.print_exc()
    tb = traceback.format_exc()
    PROGRESS['traceback'] = tb
    state('failed', error=str(error), traceback=tb)
    sys.exit(1)
finally:
    for process in reversed(CHILDREN):
        if process.poll() is None:
            process.terminate()
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                process.kill()
    if PROFILE: PROFILE.cleanup()
    OPERATIONS.db.close()
