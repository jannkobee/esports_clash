"""Package original generated illustrations; never modify image pixels or live releases."""
import hashlib
import html
import json
import struct
from pathlib import Path

root = Path(__file__).resolve().parents[2]
evidence = root / 'docs/arena-2d/avatar-drawings-v1'
output = root / 'EsportsClash.Web/public/art/avatar-drawings-v1'
manifest_path = evidence / 'manifest.json'
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
cards = []
for avatar in manifest['avatars']:
    slug = avatar['canonicalId']
    receipt_path = evidence / (slug + '.json')
    image_path = output / (slug + '.png')
    if not receipt_path.exists() or not image_path.exists():
        continue
    receipt = json.loads(receipt_path.read_text(encoding='utf-8'))
    data = image_path.read_bytes()
    assert data[:8] == b'\x89PNG\r\n\x1a\n', image_path
    width, height, depth, color_type = struct.unpack('>IIBB', data[16:26])
    avatar.update(prompt=receipt['prompt'],
                  promptSha256=hashlib.sha256(receipt['prompt'].encode()).hexdigest(),
                  status='drawn-static-review', file=str(image_path.relative_to(root)).replace('\\', '/'),
                  source=receipt['source'], sha256=hashlib.sha256(data).hexdigest(),
                  width=width, height=height, pngAlphaChannel=color_type in (4, 6))
    name = html.escape(avatar['name'])
    cards.append(f'<article data-name="{name.lower()}"><a href="{slug}.png" target="_blank"><img src="{slug}.png" alt="Full-body illustration of {name}" loading="lazy"></a><h2>{name}</h2><p>{html.escape(avatar["avatarId"])}</p><a class="download" href="{slug}.png" download>Download PNG</a></article>')
manifest_path.write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
page = '''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Avatar drawings</title>
<style>*{box-sizing:border-box}body{margin:0;padding:clamp(18px,4vw,60px);background:#101918;color:#eee7d9;font:16px system-ui}header{max-width:780px;margin-bottom:32px}h1{font-size:clamp(28px,4vw,48px);margin:0 0 12px}header p{color:#b7c2bb;line-height:1.6}input{padding:12px 16px;width:min(100%,420px);background:#1d2c28;color:inherit;border:1px solid #476255;border-radius:8px}main{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:20px}article{background:#1d2925;border:1px solid #3a4b42;border-radius:12px;overflow:hidden;padding-bottom:20px}img{display:block;width:100%;height:350px;object-fit:contain;background:radial-gradient(ellipse,#556056,#25332c)}h2{font-size:18px;margin:16px 18px 6px}article p{margin:0 18px 14px;font-size:12px;color:#9caea1}a{color:#e4c98d}.download{margin:0 18px;font-size:14px}article[hidden]{display:none}</style>
<header><h1>Avatar drawings</h1><p>COUNT of 45 original character illustrations. These are static design drawings; animation and in-game sprite preparation come separately.</p><label for="search">Find an avatar</label><br><br><input id="search" type="search" placeholder="Search by name…"></header><main>CARDS</main>
<script>document.querySelector('#search').addEventListener('input',e=>{const q=e.target.value.trim().toLowerCase();document.querySelectorAll('article').forEach(c=>c.hidden=!c.dataset.name.includes(q))})</script></html>'''
(output / 'index.html').write_text(page.replace('COUNT', str(len(cards))).replace('CARDS', ''.join(cards)), encoding='utf-8')
print(f'Packaged {len(cards)}/45 illustrations with source/prompt/file hashes.')
