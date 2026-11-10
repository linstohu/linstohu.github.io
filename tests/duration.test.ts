import test from 'node:test';
import assert from 'node:assert/strict';
import { durationLabel } from '../src/lib/duration.ts';

test('audio time labels agree for whole, fractional and unavailable durations', () => {
  for (const [seconds, label] of [
    [0, '0:00'],
    [9.9, '0:09'],
    [60, '1:00'],
    [3661, '61:01'],
    [-1, '0:00'],
    [NaN, '0:00'],
    [Infinity, '0:00'],
  ] as const)
    assert.equal(durationLabel(seconds), label);
});
