import test from 'node:test';
import assert from 'node:assert/strict';
import { macroScenarioPosition, parseMacroScenarioFixture } from './macroScenarioFixture.ts';
import {LANE_Y} from './arenaLayout.ts';

test('disposable scenario positions are bounded, mirrored, and reproducible', () => {
  const fixture = parseMacroScenarioFixture('{"gap":260,"spread":30,"frontCount":1,"rearOffset":120}');
  assert.deepEqual(macroScenarioPosition('blue', 0, fixture), { x: 1170, y: LANE_Y-60 });
  assert.deepEqual(macroScenarioPosition('red', 1, fixture), { x: 1550, y: LANE_Y-30 });
  assert.equal(parseMacroScenarioFixture('{"gap":20,"spread":30,"frontCount":1,"rearOffset":120}'), undefined);
  assert.equal(parseMacroScenarioFixture('{"gap":260,"spread":30,"frontCount":1,"rearOffset":999}'), undefined);
});
