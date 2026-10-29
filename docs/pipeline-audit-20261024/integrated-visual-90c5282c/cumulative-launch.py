import json,os,pathlib,subprocess
assert os.environ.get('COLAB_RELEASE_TAG')
root=pathlib.Path('/content/teamfight-preparation');source=root/'reviews/90c5282c-c89b-4d56-8614-82d7c0c11406/site'
p=subprocess.run(['/content/teamfight-preparation/venv/bin/python',str(root/'compare_candidate_bind.py'),str(source/'parent.glb'),str(source/'current.glb'),
 '38cd49d0375ed24af3071bb899cb498b3996c4b18024c161cbd5e6e891c8c68f','494cbb1574d50b9a82985738c0f6ef03a3d7d438a5ef9b038a28a40aeaf805c7',str(root/'integrated-cumulative-bind.json')],
 capture_output=True,text=True,env={**os.environ,'PYTHONPATH':str(root/'reviews/3b135ec1-f4c3-4674-9f57-bb0127032995/tools')})
print(p.stdout);print(p.stderr);print('exit',p.returncode)
