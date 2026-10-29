import hashlib,json,os,pathlib,shutil,subprocess,zipfile
assert os.environ.get('COLAB_RELEASE_TAG');rid='3e82afe8-a0e5-4414-8f42-6595632fa066';root=pathlib.Path('/content/teamfight-preparation');incoming=root/('incoming-'+rid+'.zip');r=root/'reviews'/rid
assert hashlib.sha256(incoming.read_bytes()).hexdigest()=='8825c2449f686c5b676fdfc70947cec008eba373e83ee5c51e8e27e49e933f63';r.mkdir(parents=True,exist_ok=False);shutil.copy2(incoming,r/'input.zip')
with zipfile.ZipFile(incoming) as z:
 assert all(not pathlib.PurePosixPath(n).is_absolute() and '..' not in pathlib.PurePosixPath(n).parts for n in z.namelist());z.extractall(r)
plan=json.loads((r/'plan.json').read_text())
for n,h in plan['files'].items():assert hashlib.sha256((r/n).read_bytes()).hexdigest()==h,n
with (r/'supervisor.log').open('ab') as log:p=subprocess.Popen(['/content/teamfight-preparation/venv/bin/python','-u',str(r/'supervisor.py')],stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
print(json.dumps({'id':rid,'pid':p.pid,'status':'queued'}))
