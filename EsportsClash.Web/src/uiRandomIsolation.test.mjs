import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

test('React state updaters cannot consume gameplay RNG on deferred or repeated execution', () => {
  const file = ts.createSourceFile('AramMatchView.tsx',
    readFileSync(new URL('./components/AramMatchView.tsx', import.meta.url), 'utf8'),
    ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const violations = [];
  function scanUpdater(node) {
    if (ts.isCallExpression(node) && (node.expression.getText(file) === 'random'
      || node.expression.getText(file).startsWith('randomRef.current'))) {
      violations.push(file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1);
    }
    ts.forEachChild(node, scanUpdater);
  }
  function visit(node) {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)
      && /^set[A-Z]/.test(node.expression.text)) {
      for (const argument of node.arguments)
        if (ts.isArrowFunction(argument) || ts.isFunctionExpression(argument)) scanUpdater(argument.body);
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  assert.deepEqual(violations, [], `RNG calls inside React updaters at lines ${violations.join(', ')}`);
});
