"""Bounded deterministic skin correction, exported as ordinary glTF weights.

Pose clipping, volume loss and artistic shape still require downstream geometry
and renderer evaluation; a normalized skin alone is not a deformation success.
"""
from equipment_skin import repair_skin_weights, validate_skin_weights, rigid_equipment


def defects(validation):
    keys = ('unweighted_vertices', 'vertices_exceeding_four_influences', 'unnormalized_vertices',
            'non_finite_weights', 'negative_weights')
    return {key: validation['stats'].get(key, 0) for key in keys}


class DeformationCorrectionEngine:
    def correct(self, obj, rig, mapped_bones, equipment_repairs=()):
        before = validate_skin_weights(obj, rig, mapped_bones)
        if before['valid'] and not equipment_repairs:
            return {'engine': 'conditional-skin-correction-v2', 'attempts': 0,
                    'accepted': True, 'before': before, 'after': before,
                    'repairs': [], 'status': 'valid_input_preserved_pose_review_required',
                    'limits': 'Valid weights preserved exactly; anatomical quality requires pose review'}
        # Keep a rest-weight snapshot so a failed deterministic correction cannot
        # replace a cleaner input. No rest coordinates/materials are changed.
        snapshot = [{obj.vertex_groups[group.group].name: group.weight for group in vertex.groups}
                    for vertex in obj.data.vertices]
        if before['valid']:
            # Explicit rigid attachments do not justify smoothing the body skin.
            repairs = rigid_equipment(obj, set(rig.data.bones.keys()), equipment_repairs, rig)
            outcome = {'repairs': repairs, 'validation': validate_skin_weights(obj, rig, mapped_bones)}
        else:
            outcome = repair_skin_weights(obj, rig, mapped_bones, equipment_repairs)
        after = outcome['validation']
        regressed = any(value > defects(before)[key] for key, value in defects(after).items())
        if regressed:
            indices = [vertex.index for vertex in obj.data.vertices]
            for group in obj.vertex_groups:
                group.remove(indices)
            for index, weights in enumerate(snapshot):
                for name, weight in weights.items():
                    group = obj.vertex_groups.get(name) or obj.vertex_groups.new(name=name)
                    group.add([index], weight, 'REPLACE')
            after = validate_skin_weights(obj, rig, mapped_bones)
        return {'engine': 'conditional-skin-correction-v2', 'attempts': 1,
                'accepted': not regressed, 'before': before, 'after': after,
                'repairs': outcome['repairs'] if not regressed else [],
                'status': 'weights_validated_pose_review_required' if after['valid'] else 'needs_improvement',
                'limits': 'Weight validity only; pose deformation, clothing and clipping checked downstream'}
