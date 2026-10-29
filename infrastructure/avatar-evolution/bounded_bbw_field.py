"""One frozen, influence-defined BBW adoption trial on the existing skeleton."""
import numpy as np

POLICY = {
    'method': 'influence-bounded-bbw-v1',
    'support_roles': ['UpperArmL', 'UpperArmR', 'ThighL', 'ThighR'],
    'transition_start_mass': .05,
    'transition_full_mass': .5,
    'preserve_hand_row_threshold': 1e-8,
    'donor_support': 'Selected limb bone, its immediate child and all ancestors; retain original support.',
    'scope': 'Existing influence support is an anatomical heuristic, not an artist-labelled segmentation.',
}


SOFT_POLICY = {**POLICY, 'method': 'influence-bounded-bbw-v2',
               'donor_support': 'Continuously mix four fixed limb/child/ancestor donor fields by original limb mass; no argmax or original-support threshold in donor selection.'}


def bounded_field(old, full, names, parents, mapping, smooth_support=False):
    lookup = {name: i for i, name in enumerate(names)}
    roles = POLICY['support_roles']
    columns = [lookup[mapping[role]] for role in roles]
    mass = old[:, columns]
    owner = mass.argmax(axis=1)
    strength = mass.max(axis=1)
    x = np.clip((strength-.05)/.45, 0, 1)
    alpha = x*x*(3-2*x)
    hand_names = set()
    for hand in (mapping['HandL'], mapping['HandR']):
        for name in names:
            cursor = name
            while cursor is not None:
                if cursor == hand:
                    hand_names.add(name)
                    break
                cursor = parents[cursor]
    hand_columns = [lookup[n] for n in hand_names]
    protected_hand = old[:, hand_columns].sum(axis=1) > 1e-8
    alpha[protected_hand] = 0
    allowed = old > 1e-8
    soft_target = np.zeros_like(old)
    soft_retained_mass = np.zeros(len(old))
    fractions = mass/np.maximum(mass.sum(axis=1, keepdims=True), 1e-12)
    children = {'UpperArmL': 'ForearmL', 'UpperArmR': 'ForearmR', 'ThighL': 'CalfL', 'ThighR': 'CalfR'}
    for index, role in enumerate(roles):
        support = {mapping[role], mapping[children[role]]}
        cursor = parents[mapping[role]]
        while cursor is not None:
            support.add(cursor)
            cursor = parents[cursor]
        selected = owner == index
        for name in support:
            allowed[selected, lookup[name]] = True
        if smooth_support:
            cols = [lookup[name] for name in support]
            donor = np.zeros_like(old)
            donor[:, cols] = full[:, cols]
            donor_mass = donor.sum(axis=1, keepdims=True)
            soft_retained_mass += fractions[:, index]*donor_mass[:, 0]
            donor /= np.maximum(donor_mass, 1e-12)
            soft_target += donor*fractions[:, index, None]
    target = soft_target if smooth_support else np.where(allowed, full, 0.)
    total = target.sum(axis=1)
    if np.any((alpha > 0) & (total <= 1e-12)):
        raise ValueError('No donor mass within anatomical support')
    target /= np.maximum(total[:, None], 1e-12)
    result = old.copy()
    ids = alpha > 0
    result[ids] = old[ids]*(1-alpha[ids, None])+target[ids]*alpha[ids, None]
    result[ids] /= result[ids].sum(axis=1, keepdims=True)
    torso_columns = [lookup[mapping[r]] for r in ('Spine', 'Chest')]
    protected_torso = (old[:, torso_columns].sum(axis=1) >= .5) & (strength <= .05)
    stats = {'policy': SOFT_POLICY if smooth_support else POLICY, 'modified_vertices': int(np.count_nonzero(ids)),
             'transition_vertices': int(np.count_nonzero((alpha > 0) & (alpha < 1))),
             'protected_hand_vertices': int(np.count_nonzero(protected_hand)),
             'protected_torso_vertices': int(np.count_nonzero(protected_torso)),
             'protected_hand_max_weight_delta': float(np.abs(result[protected_hand]-old[protected_hand]).max(initial=0)),
             'protected_torso_max_weight_delta': float(np.abs(result[protected_torso]-old[protected_torso]).max(initial=0)),
             'max_normalization_error': float(np.abs(result.sum(axis=1)-1).max()),
             'minimum_weight': float(result.min()),
             'max_removed_donor_mass': float((1-(soft_retained_mass if smooth_support else total)[ids]).max(initial=0)),
             'raw_support_heuristic': True}
    if stats['protected_hand_max_weight_delta'] or stats['protected_torso_max_weight_delta']:
        raise ValueError('Protected original weights changed')
    if not np.isfinite(result).all() or result.min() < 0 or stats['max_normalization_error'] > 1e-8:
        raise ValueError('Invalid bounded weight field')
    return result, alpha, protected_hand, protected_torso, stats
