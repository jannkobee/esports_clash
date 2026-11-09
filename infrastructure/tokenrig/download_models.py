"""Fetch pinned inference checkpoints, reusing a verified Colab Drive cache."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import tempfile

from huggingface_hub import hf_hub_download, snapshot_download


def sha256(path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(8 * 1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def valid(path, entry):
    return path.is_file() and path.stat().st_size == entry['bytes'] and sha256(path) == entry['sha256']


def copy_verified(source, destination, entry):
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_name(destination.name + '.teamfight-tmp')
    try:
        shutil.copyfile(source, temporary)
        if not valid(temporary, entry):
            raise ValueError(f"Checkpoint copy failed verification: {entry['path']}")
        os.replace(temporary, destination)
    finally:
        temporary.unlink(missing_ok=True)


def drive_cache(revision):
    """Return a persistent cache only when the owner-mounted Colab Drive exists."""
    explicit = os.environ.get('TEAMFIGHT_TOKENRIG_DRIVE_CACHE')
    if explicit:
        root = Path(explicit)
        if not root.is_dir():
            raise RuntimeError('TEAMFIGHT_TOKENRIG_DRIVE_CACHE is set, but that mounted cache directory is unavailable.')
        return root / revision
    mount = Path('/content/drive')
    my_drive = mount / 'MyDrive'
    if my_drive.is_dir():
        return my_drive / 'Teamfight' / 'TokenRigCache' / revision
    return None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('checkout', type=Path)
    args = parser.parse_args()
    pins = json.loads(Path(__file__).with_name('model-pins.json').read_text())
    revision = pins['huggingface']['revision']
    persistent = drive_cache(revision)

    for entry in pins['huggingface']['files']:
        relative = Path(entry['path'])
        local = args.checkout / relative
        cached = persistent / relative if persistent else None

        if cached and cached.is_file():
            if not valid(cached, entry):
                raise ValueError(f"Drive cache checkpoint failed pinned hash verification: {entry['path']}")
            if not valid(local, entry):
                copy_verified(cached, local, entry)
            print('RESTORED_FROM_DRIVE', entry['path'], flush=True)
        elif valid(local, entry):
            print('REUSED_LOCAL', entry['path'], flush=True)
        else:
            if local.exists():
                raise ValueError(f"Existing local checkpoint failed pinned hash verification: {entry['path']}")
            downloaded = Path(hf_hub_download(
                repo_id=pins['huggingface']['repository'], revision=revision,
                filename=entry['path'], local_dir=args.checkout,
            ))
            if not valid(downloaded, entry):
                raise ValueError(f"Pinned checkpoint verification failed: {entry['path']}")
            local = downloaded
            print('DOWNLOADED_AND_VERIFIED', entry['path'], flush=True)

        if persistent and not (cached and cached.is_file()):
            copy_verified(local, cached, entry)
            print('SAVED_TO_DRIVE', entry['path'], flush=True)

    qwen_local = args.checkout / 'models/Qwen3-0.6B'
    qwen_cache = persistent / 'Qwen3-0.6B' if persistent else None
    qwen_manifest = qwen_cache / 'teamfight-cache.json' if qwen_cache else None
    restored_qwen = False
    if qwen_cache and qwen_manifest and qwen_manifest.is_file():
        manifest = json.loads(qwen_manifest.read_text())
        if manifest.get('revision') != pins['qwen_config']['revision']:
            raise ValueError('Drive Qwen config cache has an unexpected pinned revision.')
        entries = manifest.get('files', {})
        if not entries:
            raise ValueError('Drive Qwen config cache manifest is empty.')
        for relative, expected in entries.items():
            source = qwen_cache / relative
            if not source.is_file() or sha256(source) != expected:
                raise ValueError(f'Qwen config Drive cache failed verification: {relative}')
        for relative in entries:
            source = qwen_cache / relative
            destination = qwen_local / relative
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, destination)
        restored_qwen = True
        print('QWEN_CONFIG_RESTORED_FROM_DRIVE', flush=True)
    if not restored_qwen:
        snapshot_download(
            repo_id=pins['qwen_config']['repository'], revision=pins['qwen_config']['revision'],
            local_dir=qwen_local, allow_patterns=['*.json', '*.txt'],
        )
        if qwen_cache:
            qwen_cache.mkdir(parents=True, exist_ok=True)
            entries = {}
            for source in qwen_local.rglob('*'):
                if source.is_file() and source.name != '.gitattributes' and '.cache' not in source.parts:
                    relative = source.relative_to(qwen_local).as_posix()
                    destination = qwen_cache / relative
                    destination.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(source, destination)
                    entries[relative] = sha256(destination)
            manifest = {'repository': pins['qwen_config']['repository'],
                        'revision': pins['qwen_config']['revision'], 'files': entries}
            qwen_manifest.write_text(json.dumps(manifest, indent=2) + '\n')
            print('QWEN_CONFIG_SAVED_TO_DRIVE', flush=True)


if __name__ == '__main__':
    main()
