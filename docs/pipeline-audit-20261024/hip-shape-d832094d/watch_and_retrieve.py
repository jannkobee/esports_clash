"""Router-side byte transport; computation stays on the Colab VM."""
import json,pathlib,subprocess,time
state=pathlib.Path('/tmp/hip-current-state.json');last=None
for attempt in range(120):
 result=subprocess.run(['colab','download','-s','asset-quality-rpc','/content/hip-current-state.json',str(state)],capture_output=True,text=True,timeout=45)
 if result.returncode==0:
  data=json.loads(state.read_text())
  if data.get('stage')!=last:print(json.dumps(data),flush=True);last=data.get('stage')
  if last=='failed':raise SystemExit(1)
  if last=='complete':
   subprocess.run(['colab','download','-s','asset-quality-rpc',data['result'],'/tmp/hip-current-result.zip'],check=True,timeout=120)
   print('RESULT_SAVED_IN_ROUTER',flush=True);break
 time.sleep(10)
else:raise SystemExit('Colab result not available within bounded wait')
