"""Real, bounded outcome-contrast learning. Validation/reward authority stays in TS."""
import math


CONFIG = {'epochs': 400, 'learning_rate': 0.03, 'task_penalty': 2.0,
          'shared_penalty': 6.0, 'minimum_fit': 16, 'minimum_informative': 4,
          'minimum_calibration': 16, 'confidence': 0.9, 'margin': 0.02,
          'selection': 'fitting-only-leave-draft-out-ridge-v1'}


def independent_examples(examples, expected_split):
    seen = set()
    for example in examples:
        seed = example.get('seed')
        if type(seed) is not int or seed < 1 or seed in seen:
            raise ValueError('Duplicate or invalid training/calibration seed')
        if example.get('split', expected_split) != expected_split:
            raise ValueError('Training/calibration split contamination')
        seen.add(seed)
        if example.get('status') == 'valid':
            for key in ('control', 'alternative'):
                reward = example.get(key, {}).get('reward')
                if type(reward) not in (int, float) or not math.isfinite(reward) or abs(reward) > 1:
                    raise ValueError('Invalid outcome contrast')
            for action in ('farm', 'push'):
                values = example.get('taskContext', {}).get('actions', {}).get(action)
                if not isinstance(values, dict) or values.get('bias') != 1 or not all(
                    type(value) in (int, float) and math.isfinite(value) and 0 <= value <= 1 for value in values.values()):
                    raise ValueError('Invalid predecision feature snapshot')


def score(policy, action, context):
    return max(-1.0, min(1.0, sum(policy['weights'][action].get(key, 0) * value
                                for key, value in context['actions'][action].items())))


def fit(examples, folder, batch_size=64):
    independent_examples(examples, 'fit')
    import torch
    data = [e for e in examples if e['status'] == 'valid' and e['incumbent'] == 'farm' and e['alternate'] == 'push']
    informative = sum(abs(e['alternative']['reward'] - e['control']['reward']) >= 0.02 for e in data)
    sufficient = (len(data) >= CONFIG['minimum_fit'] and informative >= CONFIG['minimum_informative']
                  and len({e['draft'] for e in data}) >= 2 and len({e['cardId'] for e in data}) >= 2)
    if not sufficient:
        return {'sufficient': False, 'trainingEpisodes': len(data), 'informativeEpisodes': informative, 'configuration': CONFIG}
    torch.set_num_threads(1)
    torch.manual_seed(0)
    torch.use_deterministic_algorithms(True)
    all_keys = [(action, key) for action in ('farm', 'push')
                for key in sorted({key for e in data for key in e['taskContext']['actions'][action]})]
    y = torch.tensor([max(-1, min(1, e['alternative']['reward'] - e['control']['reward'])) for e in data], dtype=torch.float64)
    groups = sorted({e['draft'] for e in data})
    # Select representation and shrinkage exclusively inside proper fitting worlds.
    # Confidence/calibration/evaluation data never enter this selection.
    trials = []
    for family in ('all', 'attributes'):
        keys = [item for item in all_keys if family == 'all' or not item[1].startswith('card:')]
        design = torch.tensor([[e['taskContext']['actions'][action].get(key, 0) * (1 if action == 'push' else -1)
                                for action, key in keys] for e in data], dtype=torch.float64)
        for shrinkage in (1.0, 2.0, 4.0, 8.0, 16.0):
            penalty = torch.tensor([shrinkage * (CONFIG['task_penalty'] if key.startswith('task:') else CONFIG['shared_penalty']) for _, key in keys], dtype=torch.float64)
            losses = []
            for group in groups:
                train = torch.tensor([e['draft'] != group for e in data])
                test = ~train
                if train.sum() < 8: continue
                weights = torch.linalg.solve(design[train].T @ design[train] + torch.diag(penalty), design[train].T @ y[train])
                losses.extend(((design[test] @ weights - y[test]) ** 2).tolist())
            trials.append({'family': family, 'shrinkage': shrinkage, 'mse': sum(losses) / len(losses) if losses else float('inf')})
    selected = min(trials, key=lambda item: item['mse'])
    keys = [item for item in all_keys if selected['family'] == 'all' or not item[1].startswith('card:')]
    x = torch.tensor([[e['taskContext']['actions'][action].get(key, 0) * (1 if action == 'push' else -1)
                       for action, key in keys] for e in data], dtype=torch.float64)
    penalties = torch.tensor([selected['shrinkage'] * (CONFIG['task_penalty'] if key.startswith('task:') else CONFIG['shared_penalty'])
                              for _, key in keys], dtype=torch.float64)
    weights = torch.nn.Parameter(torch.zeros(len(keys), dtype=torch.float64))
    optimizer = torch.optim.Adam([weights], lr=CONFIG['learning_rate'])
    history = []
    for epoch in range(CONFIG['epochs']):
        optimizer.zero_grad()
        objective = 0.0
        for offset in range(0, len(data), batch_size):
            pred = x[offset:offset+batch_size] @ weights
            diff = pred - y[offset:offset+batch_size]
            abs_diff = torch.abs(diff)
            huber = torch.where(abs_diff <= 0.30, 0.5 * diff.square(), 0.30 * (abs_diff - 0.15))
            loss = huber.sum() / len(data)
            loss.backward()
            objective += loss.item()
        regularization = (penalties * weights.square()).sum() / len(data)
        regularization.backward()
        objective += regularization.item()
        optimizer.step()
        with torch.no_grad():
            weights.clamp_(-1, 1)
        if epoch % 25 == 0 or epoch == CONFIG['epochs'] - 1:
            history.append({'epoch': epoch + 1, 'objective': objective})
    values = weights.detach().tolist()
    policy = {'kind': 'task-context', 'version': 2, 'objective': 'team-v1', 'weights': {'farm': {}, 'push': {}}}
    for (action, key), value in zip(keys, values):
        if not math.isfinite(value):
            raise ValueError('Nonfinite learned weight')
        policy['weights'][action][key] = value
    torch.save({'weights': weights.detach(), 'optimizer': optimizer.state_dict(), 'keys': keys,
                'configuration': CONFIG, 'training_seeds': [e['seed'] for e in data]}, folder / 'checkpoint.pt')
    return {'sufficient': True, 'policy': policy, 'trainingEpisodes': len(data), 'informativeEpisodes': informative,
            'selection': {'method': CONFIG['selection'], 'selected': selected, 'trials': trials,
                          'zero_contrast_mse': float(y.square().mean()), 'only_fitting_seeds': [e['seed'] for e in data]},
            'trainingSeeds': [e['seed'] for e in data], 'configuration': CONFIG, 'history': history,
            'fittedLoss': sum((score(policy, 'push', e['taskContext']) - score(policy, 'farm', e['taskContext'])
                               - max(-1, min(1, e['alternative']['reward'] - e['control']['reward']))) ** 2 for e in data) / len(data)}


def calibrate(fitted, examples):
    independent_examples(examples, 'calibration')
    policy = fitted['policy']
    data = [e for e in examples if e['status'] == 'valid' and e['incumbent'] == 'farm' and e['alternate'] == 'push']
    if len(data) < CONFIG['minimum_calibration'] or len({e['draft'] for e in data}) < 2 or len({e['cardId'] for e in data}) < 2:
        return {'sufficient': False, 'calibrationEpisodes': len(data)}
    assert not set(fitted['trainingSeeds']) & {e['seed'] for e in data}
    errors = sorted(score(policy, 'push', e['taskContext']) - score(policy, 'farm', e['taskContext'])
                    - (e['alternative']['reward'] - e['control']['reward']) for e in data)
    rank = math.ceil((len(errors) + 1) * CONFIG['confidence'])
    # Supported kinds must have actually occurred in fitting, not merely exist as zero-valued schema fields.
    kinds = fitted['supportedPushKinds']
    candidate = {'kind': 'task-confidence', 'version': 1, 'policy': policy,
                 'fittingSeeds': fitted['trainingSeeds'], 'calibrationSeeds': [e['seed'] for e in data],
                 'supportedPushKinds': kinds, 'calibration': {'method': 'split-one-sided-v1', 'level': 0.9,
                 'sampleSize': len(errors), 'quantileRank': rank, 'overpredictionErrors': errors,
                 'errorBuffer': max(0, errors[rank - 1])}}
    return {'sufficient': True, 'policy': candidate, 'calibrationEpisodes': len(data)}
