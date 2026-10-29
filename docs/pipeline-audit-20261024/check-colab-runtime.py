"""Run inside Colab only. Prints readiness booleans, never credentials."""
import json, pathlib, subprocess
report = {'runtime': 'google-colab', 'native_installed': pathlib.Path('/content/esports-trellis2/.worker-token').is_file()}
try:
    report['gpu'] = subprocess.check_output(['nvidia-smi', '--query-gpu=name,memory.total', '--format=csv,noheader'], text=True).strip()
except Exception as exc:
    report['gpu_error'] = type(exc).__name__
try:
    from google.colab import userdata
    report['hf_secret_available'] = bool(userdata.get('HF_TOKEN'))
except Exception as exc:
    report['hf_secret_available'] = False
    report['secret_status'] = type(exc).__name__
print(json.dumps(report))
