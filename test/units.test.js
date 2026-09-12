import { test } from 'node:test';
import assert from 'node:assert/strict';
import { convertCriRate, percentToMgPerMl, lbToKg, mgToMcg, volumeForMass } from '../src/core/units.js';

test('0.6 mg/kg/hr is 10 mcg/kg/min', () => {
  // The classic decimal trap: these are the same ketamine rate.
  assert.equal(convertCriRate(0.6, 'mg/kg/hr', 'mcg/kg/min'), 10);
  assert.equal(convertCriRate(10, 'mcg/kg/min', 'mg/kg/hr'), 0.6);
});

test('3 mg/kg/hr lidocaine is 50 mcg/kg/min', () => {
  assert.equal(convertCriRate(3, 'mg/kg/hr', 'mcg/kg/min'), 50);
});

test('CRI conversions round-trip', () => {
  for (const unit of ['mg/kg/hr', 'mcg/kg/hr', 'mcg/kg/min', 'mg/kg/min']) {
    const there = convertCriRate(0.6, 'mg/kg/hr', unit);
    const back = convertCriRate(there, unit, 'mg/kg/hr');
    assert.ok(Math.abs(back - 0.6) < 1e-12, `${unit} failed to round-trip`);
  }
});

test('percentage solutions convert to mg/mL', () => {
  assert.equal(percentToMgPerMl(2), 20);   // lidocaine 2%
  assert.equal(percentToMgPerMl(10), 100); // calcium gluconate 10%
  assert.equal(percentToMgPerMl(0.9), 9);
});

test('weight and mass conversions', () => {
  assert.ok(Math.abs(lbToKg(10) - 4.5359237) < 1e-9);
  assert.equal(mgToMcg(0.05), 50); // fentanyl 50 µg/mL
});

test('volumeForMass rejects a zero concentration', () => {
  assert.equal(volumeForMass(10, 100), 0.1);
  assert.ok(Number.isNaN(volumeForMass(10, 0)));
});
