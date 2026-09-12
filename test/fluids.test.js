import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  maintenanceAllometric, maintenanceLinear, maintenanceSimple, maintenanceComparison,
  resuscitationBolus, dehydrationDeficit, ongoingLosses, fluidPlan,
  anaesthesiaRate, subcutaneousFluids, potassiumSupplementation,
} from '../src/calc/fluids.js';

const close = (a, b, tol = 0.05) => assert.ok(Math.abs(a - b) < tol, `${a} !== ${b}`);

test('allometric maintenance matches AAHA constants', () => {
  // 132 x 20^0.75 = 132 x 9.4574 = 1248.4
  close(maintenanceAllometric(20, 'dog').mlPerDay, 1248.4, 0.1);
  // 80 x 4^0.75 = 80 x 2.8284 = 226.3
  close(maintenanceAllometric(4, 'cat').mlPerDay, 226.3, 0.1);
});

test('allometric hourly rate is the daily figure over 24', () => {
  const m = maintenanceAllometric(20, 'dog');
  close(m.mlPerHr, m.mlPerDay / 24, 1e-9);
  close(m.mlPerKgPerHr, m.mlPerHr / 20, 1e-9);
});

test('linear formula warns outside 2-70 kg', () => {
  assert.equal(maintenanceLinear(20).mlPerDay, 670);
  assert.equal(maintenanceLinear(20).valid, true);
  assert.equal(maintenanceLinear(1).valid, false);
  assert.equal(maintenanceLinear(80).valid, false);
  assert.ok(maintenanceLinear(80).issues.length > 0);
});

test('simple maintenance applies paediatric multipliers', () => {
  assert.equal(maintenanceSimple(20, 'dog').mlPerDay, 1200);
  assert.equal(maintenanceSimple(20, 'dog', { paediatric: true }).mlPerDay, 3600);
  assert.equal(maintenanceSimple(4, 'cat').mlPerDay, 160);
  assert.equal(maintenanceSimple(4, 'cat', { paediatric: true }).mlPerDay, 400);
});

test('the three maintenance formulas disagree and the app says so', () => {
  // This divergence is a property of the published formulas, not a bug. If this
  // test ever starts passing trivially, the constants have been changed.
  const cmp = maintenanceComparison(20, 'dog');
  assert.ok(cmp.spreadFactor > 1.8, `expected a wide spread, got ${cmp.spreadFactor}`);
  assert.ok(cmp.issues.some((i) => /different conventions/.test(i.message)));
});

test('resuscitation boluses use the 2024 AAHA volumes', () => {
  const dog = resuscitationBolus(20, 'dog');
  assert.deepEqual(dog.rangeMlPerKg, [15, 20]);
  assert.equal(dog.volumeMl, 300);
  assert.deepEqual(dog.volumeRangeMl, [300, 400]);
  // 300 mL over 15 min is 1200 mL/hr.
  assert.equal(dog.pumpRateMlHr, 1200);

  const cat = resuscitationBolus(4, 'cat');
  assert.deepEqual(cat.rangeMlPerKg, [5, 10]);
  assert.equal(cat.volumeMl, 20);
});

test('dehydration deficit is percent x weight x 10', () => {
  const d = dehydrationDeficit(20, 7, 6);
  assert.equal(d.deficitMl, 1400);
  close(d.mlPerHr, 233.33);
});

test('replacing faster than guideline raises a note', () => {
  assert.ok(dehydrationDeficit(20, 7, 6).issues.some((i) => /12–24 hr/.test(i.message)));
  assert.equal(dehydrationDeficit(20, 7, 24).issues.length, 0);
});

test('zero dehydration gives no deficit', () => {
  const d = dehydrationDeficit(20, 0, 6);
  assert.equal(d.deficitMl, 0);
  assert.equal(d.mlPerHr, 0);
});

test('ongoing loss bands scale with weight', () => {
  assert.equal(ongoingLosses(20, 'normal').mlPerDay, 0);
  assert.equal(ongoingLosses(20, 'mild').mlPerDay, 100);
  assert.equal(ongoingLosses(20, 'moderate').mlPerDay, 300);
  assert.equal(ongoingLosses(20, 'severe').mlPerDay, 600);
});

test('fluid plan sums its three parts', () => {
  const p = fluidPlan({
    weightKg: 20, species: 'dog',
    percentDehydration: 7, replaceOverHr: 6, ongoingBandId: 'moderate',
  });
  close(p.totalMlPerHr, p.maintenance.mlPerHr + p.deficit.mlPerHr + p.losses.mlPerHr, 1e-9);
  close(p.totalMlPerHr, 297.8, 0.1);
  // Once the deficit is replaced, only maintenance and losses remain.
  close(p.afterDeficitMlPerHr, p.maintenance.mlPerHr + p.losses.mlPerHr, 1e-9);
  close(p.afterDeficitMlPerHr, 64.5, 0.1);
});

test('fluid plan warns about volume overload', () => {
  const p = fluidPlan({ weightKg: 20, species: 'dog', percentDehydration: 10, replaceOverHr: 4 });
  assert.ok(p.mlPerKgPerHr > 10);
  assert.ok(p.issues.some((i) => /volume overload/.test(i.message)));
});

test('anaesthesia and subcutaneous rates', () => {
  assert.equal(anaesthesiaRate(20, 'dog').mlPerHr, 100);
  assert.equal(anaesthesiaRate(4, 'cat').mlPerHr, 12);
  const sc = subcutaneousFluids(10);
  assert.equal(sc.volumeMl, 200);
  assert.ok(sc.sites >= 1);
});

test('potassium is capped at 0.5 mEq/kg/hr and never bolused', () => {
  const k = potassiumSupplementation({ weightKg: 20, fluidRateMlHr: 60, targetMeqPerKgPerHr: 2 });
  assert.equal(k.appliedMeqPerKgPerHr, 0.5);
  assert.ok(k.issues.some((i) => /exceeds the maximum safe infusion rate/.test(i.message)));
  assert.ok(k.issues.some((i) => i.level === 'error' && /NEVER be given as a bolus/.test(i.message)));
});

test('potassium concentration follows the fluid rate', () => {
  const k = potassiumSupplementation({ weightKg: 20, fluidRateMlHr: 60, targetMeqPerKgPerHr: 0.2 });
  // 0.2 x 20 = 4 mEq/hr; at 60 mL/hr that is 66.7 mEq/L.
  close(k.meqPerHr, 4, 1e-9);
  close(k.meqPerLitre, 66.67);
  // Doubling the fluid rate halves the concentration needed.
  const faster = potassiumSupplementation({ weightKg: 20, fluidRateMlHr: 120, targetMeqPerKgPerHr: 0.2 });
  close(faster.meqPerLitre, k.meqPerLitre / 2, 1e-9);
});
