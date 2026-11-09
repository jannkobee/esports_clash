"""Copy the installed pinned TokenRig model files to the mounted Colab Drive."""
import hashlib
import json
from pathlib import Path
import shutil
import tempfile

ROOT = Path('/content/teamfight-preparation')
CHECKOUT = ROOT / 'SkinTokens'
DRIVE = Path('/content/drive/MyDrive/Teamfight/TokenRigCache')


def sha256(path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(8 * 1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def main():
    import google.colab  # noqa: F401
    if not Path('/content/drive/MyDrive').is_dir():
        raise RuntimeError('Mount Google Drive in this Colab runtime before caching models.')
    pins = json.loads((ROOT / 'tools/model-pins.json').read_text())
    revision = pins['huggingface']['revision']
    destination_root = DRIVE / revision
    destination_root.mkdir(parents=True, exist_ok=True)

    for entry in pins['huggingface']['files']:
        source = CHECKOUT / entry['path']
        if not source.is_file() or source.stat().st_size != entry['bytes'] or sha256(source) != entry['sha256']:
            raise ValueError(f"Installed checkpoint does not match pinned identity: {entry['path']}")
        destination = destination_root / entry['path']
        if destination.is_file():
            if destination.stat().st_size != entry['bytes'] or sha256(destination) != entry['sha256']:
                raise ValueError(f"Existing Drive checkpoint cache failed verification: {entry['path']}")
            print('ALREADY_CACHED', entry['path'], flush=True)
            continue
        destination.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile(prefix='.teamfight-', dir=destination.parent, delete=False) as stream:
            temporary = Path(stream.name)
        try:
            shutil.copyfile(source, temporary)
            if temporary.stat().st_size != entry['bytes'] or sha256(temporary) != entry['sha256']:
                raise ValueError(f"Drive copy failed pinned hash verification: {entry['path']}")
            temporary.replace(destination)
        finally:
            temporary.unlink(missing_ok=True)
        print('CACHED', entry['path'], entry['bytes'], entry['sha256'], flush=True)

    qwen_source = CHECKOUT / 'models/Qwen3-0.6B'
    qwen_destination = destination_root / 'Qwen3-0.6B'
    qwen_destination.mkdir(parents=True, exist_ok=True)
    entries = {}
    for source in sorted(qwen_source.rglob('*')):
        if not source.is_file() or source.name == '.gitattributes' or '.cache' in source.parts:
            continue
        relative = source.relative_to(qwen_source).as_posix()
        destination = qwen_destination / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        if not destination.exists():
            shutil.copy2(source, destination)
        digest = sha256(destination)
        if digest != sha256(source):
            raise ValueError(f'Qwen config Drive cache copy mismatch: {relative}')
        entries[relative] = digest
    if not entries:
        raise RuntimeError('No Qwen config files found to cache.')
    manifest = {'repository': pins['qwen_config']['repository'],
                'revision': pins['qwen_config']['revision'], 'files': entries}
    manifest_path = qwen_destination / 'teamfight-cache.json'
    manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')
    print(json.dumps({'status': 'drive_cache_ready', 'root': str(destination_root),
                      'checkpoint_count': len(pins['huggingface']['files']),
                      'qwen_file_count': len(entries)}, indent=2), flush=True)


if __name__ == '__main__':
    main()
