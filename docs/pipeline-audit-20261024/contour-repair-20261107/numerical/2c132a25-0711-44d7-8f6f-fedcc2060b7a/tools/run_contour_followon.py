"""Colab-only followon with immediate result ZIP retention, including failures."""
import sys,os,json,pathlib,time,subprocess,zipfile,hashlib,fcntl
assert os.environ.get('COLAB_RELEASE_TAG')
root=pathlib.Path(sys.argv[1]);deadline=time.monotonic()+600
while not (root/'repair-report.json').exists() and time.monotonic()<deadline:time.sleep(2)
codes={}
try:
    if json.loads((root/'repair-report.json').read_text())['status']!='requires_visual_review':raise RuntimeError('Repair stage failed')
    for name,env in [('export_contour_trial.py','preparation'),('verify_contour_reimport.py','preparation'),('validate_contour_trial.mjs','node'),('render_contour_trial.py','inspection')]:
        with (root/(name+'.log')).open('w') as log:
            cmd=['node',str(root/'tools'/name),str(root)] if env=='node' else ['/content/teamfight-'+env+'/venv/bin/python',str(root/'tools'/name),str(root)]
            with open('/content/teamfight-contour-export.lock','a+') as lock:
                if name=='export_contour_trial.py':fcntl.flock(lock,fcntl.LOCK_EX)
                p=subprocess.run(cmd,stdout=log,stderr=log,
                  env=dict(os.environ,PLAYWRIGHT_BROWSERS_PATH='/content/teamfight-inspection/browsers'))
        codes[name]=p.returncode
        # Static before/after render remains useful after an export failure.
finally:
    (root/'followon-state.json').write_text(json.dumps(codes))
    with zipfile.ZipFile('/content/deformation-result.zip','w',zipfile.ZIP_DEFLATED) as z:
        for p in root.rglob('*'):
            rel=p.relative_to(root).as_posix()
            if p.is_file() and (rel.startswith(('repair-screenshots/','site/repair/')) or ('/' not in rel and p.suffix in ('.json','.log','.npz','.glb'))):z.write(p,rel)
    print(json.dumps({'result':'/content/deformation-result.zip','sha256':hashlib.sha256(pathlib.Path('/content/deformation-result.zip').read_bytes()).hexdigest(),'stages':codes}),flush=True)
