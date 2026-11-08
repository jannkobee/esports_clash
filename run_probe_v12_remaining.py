import subprocess

cmd = ['/content/teamfight-preparation/venv/bin/python', '/content/probe_v12_remaining.py']
res = subprocess.run(cmd, capture_output=True, text=True)
print("STDOUT:")
print(res.stdout)
if res.stderr:
    print("STDERR:")
    print(res.stderr)
