"""Local control/storage only: retain Colab diagnostic receipts during execution.

No mesh, rig or animation processing occurs here. Never starts or retries cloud jobs.
"""
import argparse
import base64
import hashlib
import json
from pathlib import Path, PurePosixPath
import subprocess
import time
import uuid

MAX_BYTES=32*1024*1024


def collection_code(review_id,include_artifact=False):
    review_id=str(uuid.UUID(review_id))
    artifact=",'output/knee-pivot-candidate.glb'" if include_artifact else ''
    return f'''import base64,hashlib,json,pathlib
r=pathlib.Path('/content/teamfight-preparation/reviews')/{review_id!r}
if not (r/'plan.json').exists():raise RuntimeError('Recorded cloud review is absent; no replacement was started')
names=['plan.json','state.json','supervise.py','output/report.json','output/candidate-report.json','output/progress.json'{artifact}]
plan=json.loads((r/'plan.json').read_text())
names += [n for n in plan['files'] if n.startswith('tools/') and n.endswith('.py')]
files={{}}
total=0
for name in names:
 p=r/name
 if p.exists():
  total+=p.stat().st_size
  if total>{MAX_BYTES}:raise RuntimeError('Review evidence exceeds transfer budget')
  b=p.read_bytes();files[name]={{'sha256':hashlib.sha256(b).hexdigest(),'data':base64.b64encode(b).decode()}}
print('REVIEW_SNAPSHOT_Z='+base64.b64encode(__import__('zlib').compress(json.dumps({{'id':{review_id!r},'files':files}}).encode(),6)).decode())
'''


def artifact_chunk_code(review_id,offset,size=128*1024):
    review_id=str(uuid.UUID(review_id))
    return f'''import base64,hashlib,json,pathlib
r=pathlib.Path('/content/teamfight-preparation/reviews')/{review_id!r}
state=json.loads((r/'state.json').read_text());assert state['status']=='completed'
report=json.loads((r/'output/candidate-report.json').read_text());proof=report['artifact']
p=r/'output/knee-pivot-candidate.glb';b=p.read_bytes();assert len(b)==proof['bytes'] and hashlib.sha256(b).hexdigest()==proof['sha256']
offset={int(offset)};part=b[offset:offset+{int(size)}]
print('REVIEW_CHUNK='+json.dumps({{'id':{review_id!r},'sha256':proof['sha256'],'bytes':len(b),'offset':offset,'data':base64.b64encode(part).decode()}}))
'''


def retain(payload, review_id, output):
    if payload.get('id')!=review_id:raise ValueError('Review identity mismatch')
    decoded={};total=0
    for name,entry in payload['files'].items():
        path=PurePosixPath(name)
        if path.is_absolute() or '..' in path.parts or '\\' in name:raise ValueError('Invalid evidence path')
        if name not in ('plan.json','state.json','supervise.py','output/report.json','output/candidate-report.json','output/progress.json','output/knee-pivot-candidate.glb') and not (name.startswith('tools/') and name.endswith('.py')):
            raise ValueError('Unexpected evidence file')
        data=base64.b64decode(entry['data'],validate=True);total+=len(data)
        if total>MAX_BYTES or hashlib.sha256(data).hexdigest()!=entry['sha256']:raise ValueError('Evidence integrity failed')
        decoded[name]=data
    plan=json.loads(decoded['plan.json'])
    if plan['id']!=review_id or plan.get('compute')!='google' or plan.get('publication_eligible') is not False:
        raise ValueError('Invalid cloud review plan')
    for name,data in decoded.items():
        if name.startswith('tools/') and plan['files'].get(name)!=hashlib.sha256(data).hexdigest():raise ValueError('Frozen diagnostic script changed')
    state=json.loads(decoded.get('state.json',b'{"status":"unknown"}'))
    if state.get('id',review_id)!=review_id:raise ValueError('State identity mismatch')
    if state.get('status')=='completed':
        report=decoded.get('output/report.json') or decoded.get('output/candidate-report.json')
        if not report or hashlib.sha256(report).hexdigest()!=state.get('report_sha256'):raise ValueError('Completed report proof missing')
        manifest=json.loads(report)
        if manifest.get('artifact'):
            artifact=decoded.get('output/knee-pivot-candidate.glb')
            if artifact and (len(artifact)!=manifest['artifact']['bytes'] or hashlib.sha256(artifact).hexdigest()!=manifest['artifact']['sha256']):
                raise ValueError('Completed diagnostic GLB proof mismatch')
    output=Path(output)/review_id
    if (output/'latest.json').exists():
        previous=json.loads((output/'latest.json').read_text())
        if previous['files']['plan.json']['sha256']!=hashlib.sha256(decoded['plan.json']).hexdigest():
            raise ValueError('Frozen review plan changed between snapshots')
    objects=output/'objects';objects.mkdir(parents=True,exist_ok=True)
    manifest={}
    for name,data in decoded.items():
        sha=hashlib.sha256(data).hexdigest();dest=objects/sha
        if dest.exists():
            if dest.read_bytes()!=data:raise ValueError('Retained evidence corruption')
        else:
            with dest.open('xb') as stream:stream.write(data)
        manifest[name]={'sha256':sha,'bytes':len(data)}
    receipt={'id':review_id,'compute':'google','status':state['status'],'publication_eligible':False,'files':manifest}
    data=json.dumps(receipt,sort_keys=True,indent=2).encode();sha=hashlib.sha256(data).hexdigest()
    receipts=output/'receipts';receipts.mkdir(exist_ok=True);dest=receipts/(sha+'.json')
    if not dest.exists():dest.write_bytes(data)
    temporary=output/'latest.tmp.json';temporary.write_bytes(data);temporary.replace(output/'latest.json')
    return receipt


def retain_artifact(review_id,output,sha256,data):
    base=Path(output)/review_id;objects=base/'objects';objects.mkdir(parents=True,exist_ok=True)
    if hashlib.sha256(data).hexdigest()!=sha256:raise ValueError('Chunked diagnostic artifact hash mismatch')
    artifact=objects/sha256
    if artifact.exists() and artifact.read_bytes()!=data:raise ValueError('Retained artifact corruption')
    if not artifact.exists():
        with artifact.open('xb') as stream:stream.write(data)
    latest=json.loads((base/'latest.json').read_text())
    latest['files']['output/knee-pivot-candidate.glb']={'sha256':sha256,'bytes':len(data)}
    latest['status']='completed';encoded=json.dumps(latest,sort_keys=True,indent=2).encode();digest=hashlib.sha256(encoded).hexdigest()
    receipts=base/'receipts';receipts.mkdir(exist_ok=True);dest=receipts/(digest+'.json')
    if not dest.exists():dest.write_bytes(encoded)
    temporary=base/'latest.tmp.json';temporary.write_bytes(encoded);temporary.replace(base/'latest.json')
    return latest


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--review-id',required=True);p.add_argument('--output',type=Path,required=True)
    p.add_argument('--container',default='teamfight-evolution-trellis-router-1')
    p.add_argument('--session',default='asset-quality-rpc');p.add_argument('--watch-seconds',type=int,default=0)
    args=p.parse_args();review_id=str(uuid.UUID(args.review_id));deadline=time.monotonic()+min(max(args.watch_seconds,0),1800)
    while True:
        try:
            result=subprocess.run(['docker','exec','-i',args.container,'python','/app/colab_transport.py','--session',args.session,'--timeout','30'],
                input=collection_code(review_id),text=True,capture_output=True,timeout=55)
            if result.returncode:raise ConnectionError('Colab snapshot unavailable')
            line=next(s for s in result.stdout.splitlines() if s.startswith('REVIEW_SNAPSHOT_Z='))
            payload=json.loads(__import__('zlib').decompress(base64.b64decode(line.removeprefix('REVIEW_SNAPSHOT_Z='),validate=True)))
            receipt=retain(payload,review_id,args.output)
        except (ConnectionError,subprocess.TimeoutExpired,StopIteration,json.JSONDecodeError) as error:
            if time.monotonic()>=deadline:raise RuntimeError('Colab did not reconnect before snapshot retention expired; no local fallback or job retry occurred.') from error
            time.sleep(min(10,max(0,deadline-time.monotonic())))
            continue
        if receipt['status']=='completed' and 'output/knee-pivot-candidate.glb' not in receipt['files']:
            base=Path(args.output)/review_id;latest=json.loads((base/'latest.json').read_text())
            report=base/'objects'/latest['files']['output/candidate-report.json']['sha256'];proof=json.loads(report.read_text())['artifact']
            temporary=base/'artifact.tmp';hasher=hashlib.sha256();offset=0
            with temporary.open('wb') as stream:
                while offset<proof['bytes']:
                    code=artifact_chunk_code(review_id,offset)
                    chunk_result=subprocess.run(['docker','exec','-i',args.container,'python','/app/colab_transport.py','--session',args.session,'--timeout','30'],input=code,text=True,capture_output=True,timeout=55)
                    if chunk_result.returncode:raise RuntimeError('Colab disconnected during artifact retention; prior evidence remains stored.')
                    line=next(s for s in chunk_result.stdout.splitlines() if s.startswith('REVIEW_CHUNK='));chunk=json.loads(line.removeprefix('REVIEW_CHUNK='))
                    part=base64.b64decode(chunk['data'],validate=True)
                    if chunk['id']!=review_id or chunk['sha256']!=proof['sha256'] or chunk['bytes']!=proof['bytes'] or chunk['offset']!=offset or not part:
                        raise ValueError('Chunked artifact identity mismatch')
                    stream.write(part);hasher.update(part);offset+=len(part)
            if hasher.hexdigest()!=proof['sha256'] or offset!=proof['bytes']:raise ValueError('Chunked artifact hash mismatch')
            receipt=retain_artifact(review_id,args.output,proof['sha256'],temporary.read_bytes());temporary.unlink()
        print(json.dumps({'id':review_id,'status':receipt['status'],'files':len(receipt['files'])}),flush=True)
        if receipt['status'] in ('completed','failed','cancelled') or time.monotonic()>=deadline:return
        time.sleep(min(10,max(0,deadline-time.monotonic())))


if __name__=='__main__':main()
