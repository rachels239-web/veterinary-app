import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkWeight, checkRange, dilutionAdvice, gatherIssues, MIN_DRAWABLE_ML } from '../src/core/safety.js';

test('implausible weights are errors', () => {
  assert.equal(checkWeight(0.2, 'cat').level, 'error');
  assert.equal(checkWeight(30, 'cat').level, 'error');
  assert.equal(checkWeight(0.2, 'dog').level, 'error');
  assert.equal(checkWeight(120, 'dog').level, 'error');
  assert.equal(checkWeight(0, 'dog').level, 'error');
  assert.equal(checkWeight(-5, 'dog').level, 'error');
});

test('unusual but possible weights are warnings', () => {
  assert.equal(checkWeight(0.8, 'cat').level, 'warn');
  assert.equal(checkWeight(80, 'dog').level, 'warn');
});

test('ordinary weights pass silently', () => {
  assert.equal(checkWeight(20, 'dog'), null);
  assert.equal(checkWeight(4, 'cat'), null);
});

test('range checks name the direction', () => {
  assert.equal(checkRange(2, [1.5, 3]), null);
  assert.equal(checkRange(1.2, [1.5, 3]).direction, 'below');
  assert.equal(checkRange(4, [1.5, 3]).direction, 'above');
  assert.equal(checkRange(1.5, [1.5, 3]), null, 'boundaries are in range');
  assert.equal(checkRange(3, [1.5, 3]), null, 'boundaries are in range');
});

test('dilution advice only fires below the drawable threshold', () => {
  assert.equal(dilutionAdvice(0.5, 10), null);
  assert.equal(dilutionAdvice(MIN_DRAWABLE_ML, 10), null);
  assert.ok(dilutionAdvice(0.04, 10));
  assert.equal(dilutionAdvice(0, 10), null);
});

test('dilution picks the smallest factor that makes the volume drawable', () => {
  assert.equal(dilutionAdvice(0.04, 10).factor, 10);
  assert.equal(dilutionAdvice(0.0004, 10).factor, 1000);
});

test('issues sort most severe first', () => {
  const sorted = gatherIssues(
    { level: 'info', message: 'i' },
    { level: 'error', message: 'e' },
    null,
    { level: 'warn', message: 'w' },
  );
  assert.deepEqual(sorted.map((i) => i.level), ['error', 'warn', 'info']);
});
