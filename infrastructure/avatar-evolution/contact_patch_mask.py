"""Verified source-vertex correspondence and mesh-ring falloff for Colab repair studies."""
from collections import deque
import hashlib
import json


def smoothstep(value):
    value = max(0.0, min(1.0, value))
    return value * value * (3 - 2 * value)


def torso_weight_fraction(weights, torso_groups, upper_arm):
    torso = sum(weights.get(name, 0.0) for name in torso_groups)
    total = torso + weights.get(upper_arm, 0.0)
    return torso / total if total > 0 else 0.0


def verify_contact_record(record, mesh_name, vertex_index, rest_xyz, weights, tolerance=1e-7):
    signed = {key: value for key, value in record.items() if key != 'signature_sha256'}
    if hashlib.sha256(json.dumps(signed, sort_keys=True).encode()).hexdigest() != record['signature_sha256']:
        raise ValueError('Contact record signature mismatch')
    if record['mesh'] != mesh_name or record['mesh_vertex_index'] != vertex_index:
        raise ValueError('Contact mesh/index correspondence mismatch')
    if len(record['rest_world_xyz']) != 3 or len(rest_xyz) != 3 or max(abs(a - b) for a, b in zip(record['rest_world_xyz'], rest_xyz)) > tolerance:
        raise ValueError('Contact rest-position correspondence mismatch')
    if set(record['weights']) != set(weights) or any(abs(record['weights'][key] - value) > tolerance for key, value in weights.items()):
        raise ValueError('Contact weight correspondence mismatch')


def mesh_ring_falloff(adjacency, seam_groups, seeds, rings):
    if rings < 1:
        raise ValueError('Positive falloff ring count required')
    seam_map = {vertex: group for group in seam_groups for vertex in group}
    distances = {vertex: 0 for vertex in seeds}
    queue = deque(seeds)
    while queue:
        vertex = queue.popleft()
        distance = distances[vertex]
        for peer in seam_map.get(vertex, ()):
            if distance < distances.get(peer, rings + 1):
                distances[peer] = distance
                queue.appendleft(peer)
        if distance >= rings:
            continue
        for neighbor in adjacency[vertex]:
            if distance + 1 < distances.get(neighbor, rings + 1):
                distances[neighbor] = distance + 1
                queue.append(neighbor)
    return {vertex: smoothstep(1 - distance / rings) for vertex, distance in distances.items() if distance < rings}
