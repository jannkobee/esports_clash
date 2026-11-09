"""Versioned diagnostics, separate from the frozen exploratory acceptance gate.

No metric here can authorize promotion. Reward intervals use independent world
seeds as clusters; repeated observations of a seed never increase sample size.
"""
import math
import statistics
from collections import Counter, defaultdict


CONFIG = {'version': 1, 'confidence': .95, 'reward_bounds': [-2, 2],
          'interval': 'seed-cluster-hoeffding', 'stagnation_changes': 0}


def wilson(successes, total):
    if total == 0:
        return None
    z = 1.959963984540054
    p = successes / total
    denominator = 1 + z*z/total
    center = (p + z*z/(2*total)) / denominator
    radius = z * math.sqrt(p*(1-p)/total + z*z/(4*total*total)) / denominator
    return {'estimate': p, 'lower': max(0, center-radius), 'upper': min(1, center+radius),
            'confidence': .95, 'method': 'wilson', 'denominator': total}


def reward_interval(cases):
    clusters = defaultdict(list)
    for case in cases:
        value = case.get('rewardDelta')
        if isinstance(value, (int, float)) and math.isfinite(value) and -2 <= value <= 2:
            clusters[case['seed']].append(value)
    values = [statistics.mean(group) for group in clusters.values()]
    if not values:
        return None
    mean = statistics.mean(values)
    radius = 4 * math.sqrt(math.log(2 / (1 - CONFIG['confidence'])) / (2 * len(values)))
    return {'estimate': mean, 'lower': max(-2, mean-radius), 'upper': min(2, mean+radius),
            'independent_seeds': len(values), 'confidence': CONFIG['confidence'],
            'method': CONFIG['interval'], 'assumption': 'Independent seeds; equal weight per seed; bounded team reward contrasts'}


def diagnose(examples, planned, training_history=None, fitted_loss=None, configuration=None):
    if configuration is not None and configuration != CONFIG:
        raise ValueError('Unsupported frozen diagnostic configuration')
    if not isinstance(planned, int) or planned < len(examples):
        raise ValueError('Invalid planned denominator')
    # Missing metrics must not look like zero regret or zero deaths.
    valid = [e for e in examples if e.get('status') == 'valid']
    measured, invalid_metrics = [], 0
    required = ('rewardDelta', 'deathDelta', 'teamDeathDelta', 'predictionError', 'zeroError')
    for case in valid:
        if (not isinstance(case.get('seed'), int) or isinstance(case.get('seed'), bool) or case['seed'] < 1
            or not isinstance(case.get('changed'), bool)
            or not all(type(case.get(k)) in (float, int) and math.isfinite(case[k]) for k in required)
            or not -2 <= case['rewardDelta'] <= 2
            or any(case[k] < 0 for k in ('predictionError', 'zeroError'))
            or any(not float(case[k]).is_integer() for k in ('deathDelta', 'teamDeathDelta'))):
            invalid_metrics += 1
        else:
            measured.append(case)
    def mean(key, group):
        return statistics.mean(e[key] for e in group) if group else None
    supported = [e for e in measured if e.get('supported') is True]
    covered = [e for e in supported if isinstance(e.get('covered'), bool)]
    changes = sum(e['changed'] for e in measured)
    interval = reward_interval(measured)
    prediction = mean('predictionError', supported)
    zero = mean('zeroError', supported)
    history = [e['objective'] for e in training_history or []
               if type(e.get('objective')) in (float, int) and math.isfinite(e['objective'])]
    optimization = len(history) >= 2 and history[-1] > history[0]
    generalization = prediction is not None and zero is not None and prediction > zero
    extra_deaths = sum(e['deathDelta'] > 0 or e['teamDeathDelta'] > 0 for e in measured)
    broader_worse = sum(e.get('changed') and e.get('rubric') in ('worse', 'survival-worsened', 'missing-metrics') for e in measured)
    gameplay = bool(measured) and (sum(e['rewardDelta'] for e in measured) < 0 or extra_deaths > 0 or broader_worse > 0)
    invalid_controls = sum(e.get('status') in ('invalid-controls', 'invalid-replay') for e in examples)
    reasons = []
    for condition, name in ((optimization, 'optimization-regression'), (generalization, 'generalization-regression'),
                            (gameplay, 'gameplay-regression'), (bool(measured) and changes == 0, 'behavioral-stagnation'),
                            (invalid_controls > 0, 'evaluator-instability'), (invalid_metrics > 0, 'invalid-metrics')):
        if condition:
            reasons.append(name)
    if len(measured) < planned:
        reasons.append('incomplete-evaluation')
    if interval is None or interval['lower'] <= 0:
        reasons.append('benefit-not-established')
    by_side = {}
    for side in (False, True):
        group = [e for e in measured if e.get('swapped') is side]
        by_side['swapped' if side else 'original'] = {'measured': len(group),
            'changed': sum(e['changed'] for e in group), 'reward_mean': mean('rewardDelta', group)}
    return {'configuration': dict(CONFIG), 'planned': planned, 'attempted': len(examples),
            'statuses': dict(Counter(e.get('status', 'unknown') for e in examples)),
            'valid': len(valid), 'measured': len(measured), 'invalid_metrics': invalid_metrics,
            'missing': planned-len(examples), 'changed': changes,
            'decision_change_rate': wilson(changes, len(measured)),
            'change_fraction_of_planned': changes/planned if planned else None,
            'reward_delta_interval': interval, 'by_side': by_side,
            'calibration_coverage': wilson(sum(e['covered'] for e in covered), len(covered)),
            'training_objective_start': history[0] if history else None,
            'training_objective_end': history[-1] if history else None, 'fitted_loss': fitted_loss,
            'prediction_mse': prediction, 'zero_contrast_mse': zero,
            'extra_death_cases': extra_deaths, 'broader_worse': broader_worse,
            'signals': reasons,
            'assessment': 'reject' if optimization or generalization or gameplay or invalid_metrics else 'inconclusive',
            'production_eligible': False, 'win_rate': None, 'full_match_evaluated': False,
            'scope': 'Thirty-second farm/push diagnostics; exploratory, never a promotion authorization. '
                     'Wilson intervals describe measured cases only; missing cases are not imputed. '
                     'Invalid controls can reflect executor or artifact failures and require investigation.'}
