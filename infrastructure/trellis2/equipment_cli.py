"""Explicit one-off equipment generation through the existing bounded worker.

Run inside the verified TRELLIS container. Does not change a body's current
reference, workflow, checkpoints, GPU admission or live avatar. Output remains
unqualified until fitted and checked with its character.
"""
import argparse
import base64
import json
import os
from pathlib import Path
import sys
import urllib.request

sys.path.insert(0,'/opt/trellis')
import service

def request(path,payload=None):
    req=urllib.request.Request('http://127.0.0.1:8096'+path,
        data=None if payload is None else json.dumps(payload).encode(),
        headers={'Authorization':'Bearer '+os.environ['TRELLIS_WORKER_TOKEN'],'Content-Type':'application/json'})
    with urllib.request.urlopen(req,timeout=30) as response:return json.load(response)

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--avatar',required=True)
    parser.add_argument('--slot',required=True,choices=['primary','secondary'])
    parser.add_argument('--reference',required=True,type=Path)
    parser.add_argument('--sha256',required=True)
    parser.add_argument('--id',required=True)
    parser.add_argument('--seed',type=int,default=25011)
    args=parser.parse_args()
    service.identifier(args.id)
    if args.avatar not in service.CATALOG:raise ValueError('Unknown avatar')
    service.verify_reference(args.reference)
    content=args.reference.read_bytes()
    if service.sha(content)!=args.sha256:raise ValueError('Uploaded reference identity mismatch')
    uploaded=request('/equipment-references/'+args.avatar+'/'+args.slot,
        {'source_sha256':args.sha256,'png_base64':base64.b64encode(content).decode()})
    if uploaded['sha256']!=args.sha256:raise ValueError('Worker acknowledged a different equipment reference')
    operations=request('/operations')
    plan={'version':1,'avatar_id':args.avatar,'seed':args.seed,'reference_sha256':args.sha256,
          **{key:operations[key] for key in ['workflow_sha256','pins_sha256','limits_sha256','engine_sha256']}}
    plan.update(purpose='modular-equipment',equipment_slot=args.slot)
    state=request('/equipment-jobs/'+args.id,plan)
    print(json.dumps({'id':args.id,'slot':args.slot,'status':state['status'],'reference_sha256':args.sha256,'publication_eligible':False}))

if __name__=='__main__':main()
