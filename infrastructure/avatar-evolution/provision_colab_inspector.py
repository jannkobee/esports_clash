"""Install an isolated browser harness in Colab for the existing Babylon inspector."""
import json
import os
from pathlib import Path
import subprocess
import sys
import time

ROOT=Path('/content/teamfight-inspection')


def main():
    if not os.environ.get('COLAB_RELEASE_TAG'):
        raise RuntimeError('Inspector qualification processing requires Google Colab.')
    ROOT.mkdir(parents=True,exist_ok=True)
    receipt={'status':'installing','compute':'google','started_unix':time.time(),
             'scope':'Browser tools only; no avatar qualification or publication.'}
    path=ROOT/'installation.json'
    path.write_text(json.dumps(receipt,indent=2))
    try:
        python=ROOT/'venv/bin/python'
        if not python.is_file():
            subprocess.run([sys.executable,'-m','uv','venv','--python','3.12',str(ROOT/'venv')],check=True,timeout=120)
        subprocess.run([sys.executable,'-m','uv','pip','install','--python',str(python),'playwright==1.55.0'],check=True,timeout=300)
        environment={**os.environ,'PLAYWRIGHT_BROWSERS_PATH':str(ROOT/'browsers')}
        subprocess.run([str(python),'-m','playwright','install','--with-deps','chromium'],env=environment,check=True,timeout=600)
        receipt.update(status='installed',completed_unix=time.time(),playwright='1.55.0')
        path.write_text(json.dumps(receipt,indent=2))
    except Exception as error:
        receipt.update(status='failed',error=str(error),completed_unix=time.time())
        path.write_text(json.dumps(receipt,indent=2))
        raise


if __name__=='__main__':
    main()
