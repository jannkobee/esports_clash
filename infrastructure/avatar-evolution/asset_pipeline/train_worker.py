"""Portable deterministic supervised regressor. Python stdlib, no model download.

Input on stdin, output JSON. Deliberately contains no locked test examples.
Small ridge solutions are preferable to an unvalidated generative fine-tune.
"""
import json
import math
import sys


def solve(matrix, vector):
    rows = [list(row) + [value] for row, value in zip(matrix, vector)]
    for column in range(len(rows)):
        pivot = max(range(column, len(rows)), key=lambda i: abs(rows[i][column]))
        rows[column], rows[pivot] = rows[pivot], rows[column]
        if abs(rows[column][column]) < 1e-12:
            raise ValueError('Singular training matrix')
        divisor = rows[column][column]
        rows[column] = [value / divisor for value in rows[column]]
        for index in range(len(rows)):
            if index != column:
                scale = rows[index][column]
                rows[index] = [a - scale * b for a, b in zip(rows[index], rows[column])]
    return [row[-1] for row in rows]


def predict(model, example):
    values = [1] + [example['features'][key] for key in model['features']]
    return max(0, min(100, sum(a * b for a, b in zip(model['coefficients'], values))))


def train(payload):
    features = payload['features']
    train_rows, validation = payload['train'], payload['validation']
    if not train_rows or not validation:
        raise ValueError('Separate training and validation data required')
    models = []
    for ridge in [.01, .1, 1, 10]:
        count = len(features) + 1
        matrix = [[float(ridge if i == j else 0) for j in range(count)] for i in range(count)]
        matrix[0][0] = 1e-8
        vector = [0.] * count
        for row in train_rows:
            x = [1.] + [float(row['features'][key]) for key in features]
            y = float(row['label'])
            if not all(math.isfinite(value) for value in x + [y]):
                raise ValueError('Nonfinite training example')
            for i in range(count):
                vector[i] += x[i] * y
                for j in range(count):
                    matrix[i][j] += x[i] * x[j]
        model = {'schema': 'asset-quality-ridge-v1', 'features': features,
                 'coefficients': solve(matrix, vector), 'ridge': ridge}
        mse = sum((predict(model, row) - row['label']) ** 2 for row in validation) / len(validation)
        models.append((mse, ridge, model))
    error, _, model = min(models, key=lambda item: item[:2])
    return {'model': model, 'validation_rmse': math.sqrt(error), 'snapshot': payload['snapshot']}


if __name__ == '__main__':
    result = train(json.load(sys.stdin)['payload'])
    print(json.dumps(result, allow_nan=False))
