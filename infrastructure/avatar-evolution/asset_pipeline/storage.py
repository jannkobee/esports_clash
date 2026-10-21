"""Drive v3 immutable artifacts, restartable transfers and local-first cache.

Token files are supplied by the operator outside the repository. Only app-owned
files with drive.file scope are used; the coordinator DB remains authoritative.
"""
import json
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from .store import atomic_json, canonical, file_hash

DRIVE = 'https://www.googleapis.com/drive/v3/files'
UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files'
SCOPE = 'https://www.googleapis.com/auth/drive.file'
CHUNK = 4 * 1024 * 1024  # multiple of Drive's 256 KiB chunk unit


class TransferError(RuntimeError):
    pass


class OAuthToken:
    def __init__(self, path):
        self.path = Path(path)

    def get(self, force=False):
        token = json.loads(self.path.read_text())
        if SCOPE not in token.get('scopes', []):
            raise TransferError('drive.file OAuth scope required')
        if force or token.get('expires_at', 0) < time.time() + 60:
            data = urllib.parse.urlencode({
                'client_id': token['client_id'], 'client_secret': token['client_secret'],
                'refresh_token': token['refresh_token'], 'grant_type': 'refresh_token'}).encode()
            request = urllib.request.Request('https://oauth2.googleapis.com/token', data=data)
            try:
                with urllib.request.urlopen(request, timeout=30) as response:
                    fresh = json.load(response)
            except (OSError, ValueError):
                raise TransferError('OAuth refresh failed') from None
            token.update(access_token=fresh['access_token'], expires_at=time.time() + fresh['expires_in'])
            atomic_json(self.path, token)  # mkstemp preserves 0600 permissions
        return token['access_token']


class DriveHTTP:
    def __init__(self, token, sleep=time.sleep):
        self.token, self.sleep = token, sleep

    def request(self, method, url, data=None, headers=None):
        # Session URIs are persisted; don't let a corrupted record redirect OAuth.
        parsed = urllib.parse.urlparse(url)
        if parsed.scheme != 'https' or parsed.hostname != 'www.googleapis.com':
            raise TransferError('Unexpected Drive endpoint')
        for attempt in range(4):
            request = urllib.request.Request(url, data=data, method=method,
                headers={'Authorization': 'Bearer ' + self.token.get(), **(headers or {})})
            try:
                # urllib follows redirects; Drive endpoints used here never need
                # them. Refuse redirects to keep bearer credentials on origin.
                class NoRedirect(urllib.request.HTTPRedirectHandler):
                    def redirect_request(self, *args, **kwargs):
                        return None
                with urllib.request.build_opener(NoRedirect).open(request, timeout=45) as response:
                    return response.status, dict(response.headers.items()), response.read()
            except urllib.error.HTTPError as error:
                if error.code in (308, 404, 410, 416):
                    return error.code, dict(error.headers.items()), error.read()
                if error.code == 401 and attempt < 3:
                    self.token.get(force=True)
                    continue
                if error.code not in (429, 500, 502, 503, 504) or attempt == 3:
                    raise TransferError('Drive request failed (HTTP %s)' % error.code) from None
            except OSError:
                if attempt == 3:
                    raise TransferError('Drive connection interrupted') from None
            self.sleep(2 ** attempt)
        raise TransferError('Drive retry budget exhausted')


class GoogleDriveStorageProvider:
    def __init__(self, store, http, parent_id=None):
        self.store, self.http, self.parent_id = store, http, parent_id
        self.cache = store.root / 'cache'
        self.cache.mkdir(exist_ok=True)

    def register(self, asset_id, version, path):
        checksum, size = file_hash(path), Path(path).stat().st_size
        if size <= 0:
            raise ValueError('Empty artifact')
        with self.store.db:
            row = self.store.db.execute('SELECT * FROM artifacts WHERE asset_id=? AND version=?',
                                       (asset_id, version)).fetchone()
            if row and (row['sha256'] != checksum or row['bytes'] != size):
                raise ValueError('Immutable artifact version already exists')
            self.store.db.execute('INSERT OR IGNORE INTO artifacts(asset_id,version,sha256,bytes) VALUES(?,?,?,?)',
                                  (asset_id, version, checksum, size))
        return checksum

    def row(self, asset_id, version):
        row = self.store.db.execute('SELECT * FROM artifacts WHERE asset_id=? AND version=?',
                                    (asset_id, version)).fetchone()
        if not row:
            raise ValueError('Unknown artifact version')
        return dict(row)

    def update(self, asset_id, version, **values):
        if not values.keys() <= {'drive_id', 'upload_session'}:
            raise ValueError('Invalid metadata update')
        with self.store.db:
            self.store.db.execute('UPDATE artifacts SET ' + ','.join(k + '=?' for k in values)
                                  + ' WHERE asset_id=? AND version=?', [*values.values(), asset_id, version])

    def metadata(self, drive_id):
        if not re.fullmatch(r'[A-Za-z0-9_-]+', drive_id):
            raise ValueError('Invalid Drive file ID')
        status, _, body = self.http.request('GET', DRIVE + '/' + drive_id + '?fields=id,size,md5Checksum,appProperties')
        return json.loads(body) if status == 200 else None

    def upload(self, asset_id, version, path):
        checksum = self.register(asset_id, version, path)
        row = self.row(asset_id, version)
        if not row['drive_id']:
            status, _, body = self.http.request('GET', DRIVE + '/generateIds?count=1&space=drive&type=files')
            if status != 200:
                raise TransferError('Unable to reserve Drive file ID')
            self.update(asset_id, version, drive_id=json.loads(body)['ids'][0])
            row = self.row(asset_id, version)
        md5 = file_hash(path, 'md5')
        existing = self.metadata(row['drive_id'])
        if existing:
            self.verify(existing, row, md5)
            self.update(asset_id, version, upload_session=None)
            return row['drive_id']
        session, offset = row['upload_session'], 0
        if session:
            status, headers, body = self.http.request('PUT', session, b'', {'Content-Range': 'bytes */' + str(row['bytes'])})
            if status in (200, 201):
                self.verify(json.loads(body), row, md5)
                self.update(asset_id, version, upload_session=None)
                return row['drive_id']
            if status == 308:
                offset = self.offset(headers)
            elif status in (404, 410):
                session = None
            else:
                raise TransferError('Unexpected upload resume response')
        if not session:
            metadata = {'id': row['drive_id'], 'name': asset_id + '-' + version,
                        'appProperties': {'sha256': checksum, 'asset_id': asset_id, 'version': version}}
            if self.parent_id:
                metadata['parents'] = [self.parent_id]
            status, headers, _ = self.http.request('POST', UPLOAD + '?uploadType=resumable&fields=id,size,md5Checksum,appProperties',
                canonical(metadata).encode(), {'Content-Type': 'application/json',
                'X-Upload-Content-Type': 'application/octet-stream', 'X-Upload-Content-Length': str(row['bytes'])})
            session = headers.get('Location') or headers.get('location')
            if status not in (200, 201) or not session:
                raise TransferError('Unable to start resumable upload')
            self.update(asset_id, version, upload_session=session)
        with Path(path).open('rb') as source:
            while offset < row['bytes']:
                source.seek(offset)
                data = source.read(CHUNK)
                status, headers, body = self.http.request('PUT', session, data, {
                    'Content-Type': 'application/octet-stream',
                    'Content-Range': f'bytes {offset}-{offset + len(data) - 1}/{row["bytes"]}'})
                if status in (200, 201):
                    self.verify(json.loads(body), row, md5)
                    self.update(asset_id, version, upload_session=None)
                    return row['drive_id']
                next_offset = self.offset(headers) if status == 308 else 0
                if not offset < next_offset <= row['bytes']:
                    raise TransferError('Upload made no verified progress; resume on next tick')
                offset = next_offset
        raise TransferError('Upload lacks completion confirmation')

    @staticmethod
    def offset(headers):
        value = headers.get('Range', headers.get('range', ''))
        match = re.fullmatch(r'bytes=0-(\d+)', value)
        return int(match[1]) + 1 if match else 0

    @staticmethod
    def verify(metadata, row, md5):
        if (metadata.get('id') != row['drive_id'] or int(metadata.get('size', -1)) != row['bytes']
                or metadata.get('md5Checksum') != md5
                or metadata.get('appProperties', {}).get('sha256') != row['sha256']):
            raise TransferError('Cloud artifact checksum/identity mismatch')

    def recover(self, asset_id, version):
        row = self.row(asset_id, version)
        target = self.cache / row['sha256']
        if target.is_file() and file_hash(target) == row['sha256']:
            return target
        if not row['drive_id']:
            raise TransferError('Artifact has no durable cloud copy')
        partial = target.with_suffix('.partial')
        if partial.exists() and partial.stat().st_size > row['bytes']:
            partial.unlink()
        offset = partial.stat().st_size if partial.exists() else 0
        with partial.open('ab') as output:
            while offset < row['bytes']:
                end = min(row['bytes'], offset + CHUNK) - 1
                status, headers, body = self.http.request('GET', DRIVE + '/' + row['drive_id'] + '?alt=media',
                                                        headers={'Range': f'bytes={offset}-{end}'})
                content_range = headers.get('Content-Range', headers.get('content-range'))
                if status == 200 and offset == 0 and len(body) == row['bytes']:
                    pass
                elif (status != 206 or content_range != f'bytes {offset}-{end}/{row["bytes"]}'
                      or len(body) != end - offset + 1):
                    raise TransferError('Invalid partial download response')
                output.write(body)
                output.flush()
                os.fsync(output.fileno())
                offset += len(body)
        if file_hash(partial) != row['sha256']:
            partial.unlink()  # do not retain poisoned resume data
            raise TransferError('Recovered artifact checksum mismatch')
        os.replace(partial, target)
        return target
