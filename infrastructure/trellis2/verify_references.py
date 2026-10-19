"""Measure reference container/alpha properties; does not judge artistic quality."""
import hashlib
import json
from pathlib import Path
from PIL import Image

root = Path(__file__).parent
index = json.loads((root / 'reference-index.json').read_text())
records = []
for avatar_id, item in index.items():
    path = root / 'references' / item['file']
    with Image.open(path) as image:
        assert image.format == 'PNG' and image.mode == 'RGBA'
        assert image.width >= 256 and image.height >= 512
        alpha = image.getchannel('A')
        minimum, maximum = alpha.getextrema()
        assert minimum == 0 and maximum >= 205
        histogram = alpha.histogram()
        records.append({'avatar_id': avatar_id, 'file': item['file'], 'provider': item['provider'],
            'bytes': path.stat().st_size, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
            'width': image.width, 'height': image.height, 'alpha_extrema': [minimum, maximum],
            'fully_transparent_fraction': histogram[0] / (image.width * image.height),
            'alpha_over_204_fraction': sum(histogram[205:]) / (image.width * image.height),
            'alpha_bounds': alpha.getbbox(), 'identity_and_art_quality_qualified': False})
print(json.dumps({'kind': 'reference-image-technical-properties', 'records': records}, indent=2))
