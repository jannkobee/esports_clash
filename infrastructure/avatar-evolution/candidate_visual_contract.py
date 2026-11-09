"""Control-plane integrity checks for paired candidate review artifacts; no geometry processing."""
import hashlib


def validate_diagnostic_sources(root, plan, exported):
    expected_review = plan.get('parent_visual_review_id') if plan.get('mode') == 'joint-details' else plan['id']
    if exported.get('id') != expected_review:
        raise ValueError('Diagnostic clip review identity mismatch')
    if sorted(asset['label'] for asset in exported['assets']) != ['current', 'parent']:
        raise ValueError('Both exact comparison candidates are required')
    for asset in exported['assets']:
        label = asset['label']
        expected_source = plan['candidates'][label]['artifact_sha256']
        source = root / 'site' / (label + '.glb')
        stress = root / 'site' / (label + '-stress.glb')
        if (not asset['baseline_reproduced'] or asset['source_sha256'] != expected_source
                or plan['files']['site/' + label + '.glb'] != expected_source
                or hashlib.sha256(source.read_bytes()).hexdigest() != expected_source
                or hashlib.sha256(stress.read_bytes()).hexdigest() != asset['stress_sha256']):
            raise ValueError('Diagnostic clip evidence mismatch: ' + label)
