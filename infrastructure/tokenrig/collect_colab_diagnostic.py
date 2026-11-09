"""Transfer immutable Colab diagnostic receipts; performs no asset processing."""
import argparse
import base64
import hashlib
import json
from pathlib import Path
import uuid

MARKER = 'PREPARATION_DIAGNOSTIC='


def request_cell(attempt):
    if str(uuid.UUID(attempt)) != attempt:
        raise ValueError('Invalid diagnostic identifier')
    return f'''def _teamfight_collect_diagnostic():
 import base64,json,os,pathlib
 if not os.environ.get('COLAB_RELEASE_TAG'): raise RuntimeError('Google Colab required.')
 root=pathlib.Path('/content/teamfight-preparation/diagnostics')/{attempt!r}
 files={{}}
 for name in ('plan.json','state.json','output/report.json','analysis.log','supervisor.log',
              'tools/analyze_bind_twist.py','tools/mesh_validation.py','tools/asset_pipeline/__init__.py',
              'tools/asset_pipeline/edge_deformation.py','tools/supervise.py'):
  path=root/name
  if path.is_file():
   if path.stat().st_size>2*1024**2: raise RuntimeError('Diagnostic evidence exceeds transfer budget.')
   files[name]=base64.b64encode(path.read_bytes()).decode()
 print({MARKER!r}+json.dumps({{'id':{attempt!r},'files':files}}))
_teamfight_collect_diagnostic()
del _teamfight_collect_diagnostic
'''


def collect(rpc_file, output):
    lines = rpc_file.read_text(encoding='utf-8-sig').splitlines()
    payload = json.loads(next(line[len(MARKER):] for line in lines if line.startswith(MARKER)))
    attempt = str(uuid.UUID(payload['id']))
    files = {name: base64.b64decode(value, validate=True) for name, value in payload['files'].items()}
    allowed = {'plan.json', 'state.json', 'output/report.json', 'analysis.log', 'supervisor.log',
               'tools/analyze_bind_twist.py', 'tools/mesh_validation.py', 'tools/asset_pipeline/__init__.py',
               'tools/asset_pipeline/edge_deformation.py', 'tools/supervise.py'}
    if set(files) - allowed or any(len(content) > 2 * 1024**2 for content in files.values()):
        raise ValueError('Unexpected diagnostic artifact')
    plan, state = [json.loads(files[name]) for name in ('plan.json', 'state.json')]
    if plan['id'] != attempt or state['id'] != attempt or state['status'] not in ('completed', 'failed'):
        raise ValueError('A terminal exact-attempt receipt is required before collection')
    if plan['compute'] != 'google' or state['compute'] != 'google' or plan['publication_eligible'] is not False:
        raise ValueError('Diagnostic cloud execution contract mismatch')
    for name, expected in plan['tools'].items():
        if hashlib.sha256(files['tools/' + name]).hexdigest() != expected:
            raise ValueError('Frozen diagnostic source transfer integrity failed: ' + name)
    report = json.loads(files['output/report.json']) if 'output/report.json' in files else None
    if state['status'] == 'completed':
        proof = state['artifact']
        content = files['output/report.json']
        if len(content) != proof['bytes'] or hashlib.sha256(content).hexdigest() != proof['sha256']:
            raise ValueError('Diagnostic report transfer integrity failed')
        if report['source_sha256'] != plan['source_sha256'] or report['publication_eligible'] is not False:
            raise ValueError('Diagnostic report changed source identity or qualification')
    cases = {}
    for result in (report or {}).get('experiments', []):
        key = result['clip'] + '@' + str(result['phase'])
        cases.setdefault(key, {})[result['variant']] = result['self_intersections']
    count = len((report or {}).get('experiments', []))
    summary = (f'{count} controlled comparisons across {len(cases)} clip/time cases. '
               'Existing candidate remains unqualified.') if report else state.get('error', 'Diagnostic failed.')
    receipt = {'plan': plan, 'status': state['status'], 'execution': {key: state.get(key) for key in
                ('compute', 'runtime_id', 'environment_sha256', 'started_unix', 'completed_unix')},
               'artifact': state.get('artifact'), 'report': report, 'summary': summary, 'comparisons': cases}
    output.mkdir(parents=True, exist_ok=True)
    files['receipt.json'] = (json.dumps(receipt, indent=2) + '\n').encode()
    for name, content in files.items():
        destination = output / name
        destination.parent.mkdir(parents=True, exist_ok=True)
        if destination.exists() and destination.read_bytes() != content:
            raise ValueError('Existing diagnostic evidence is immutable: ' + name)
        destination.write_bytes(content)
    return {'id': attempt, 'status': state['status'], 'summary': summary,
            'artifact': state.get('artifact'), 'publication_eligible': False}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    modes = parser.add_subparsers(dest='mode', required=True)
    request = modes.add_parser('request')
    request.add_argument('--attempt-id', required=True)
    request.add_argument('--output-cell', type=Path, required=True)
    decode = modes.add_parser('collect')
    decode.add_argument('--rpc-file', type=Path, required=True)
    decode.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    if args.mode == 'request':
        args.output_cell.write_text(request_cell(args.attempt_id))
    else:
        print(json.dumps(collect(args.rpc_file, args.output)))
