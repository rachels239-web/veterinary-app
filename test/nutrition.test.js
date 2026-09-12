import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rer, mer, bodySurfaceArea } from '../src/calc/nutrition.js';
import { redCellTransfusion, plasmaTransfusion, transfusionRate } from '../src/calc/transfusion.js';

const close = (a, b, tol = 0.5) => assert.ok(Math.abs(a - b) < tol, `${a} !== ${b}`);

test('RER follows 70 x kg^0.75', () => {
  close(rer(20).kcalPerDay, 662);
  close(rer(4).kcalPerDay, 198);
});

test('the linear RER approximation agrees with the allometric form mid-range', () => {
  // 30 x 20 + 70 = 670 against 662 — close, which is why the approximation exists.
  const r = rer(20);
  assert.ok(Math.abs(r.linear - r.allometric) < 10);
  assert.equal(r.linearValid, true);
  assert.equal(rer(60).linearValid, false);
});

test('MER applies the life-stage factor', () => {
  close(mer(20, 'dog', 'hospitalised').kcalPerDay, 662);
  close(mer(20, 'dog', 'neutered').kcalPerDay, 662 * 1.6, 1);
  close(mer(4, 'cat', 'neutered').kcalPerDay, 198 * 1.2, 1);
});

test('MER gives a feeding volume when a diet density is supplied', () => {
  const m = mer(20, 'dog', 'hospitalised', { kcalPerMl: 1, mealsPerDay: 4 });
  close(m.mlPerDay, 662);
  close(m.mlPerMeal, 662 / 4);
});

test('body surface area uses the species constant', () => {
  close(bodySurfaceArea(20, 'dog').m2, 0.744, 0.002);
  close(bodySurfaceArea(4, 'cat').m2, 0.252, 0.002);
});

test('transfusion volume reaches the target PCV', () => {
  // (25 - 15) / 40 x 90 x 20 = 450 mL
  const t = redCellTransfusion({ weightKg: 20, species: 'dog', currentPcv: 15, targetPcv: 25, donorPcv: 40 });
  close(t.volumeMl, 450, 1e-6);
  // Cross-check: 10 PCV points x 2 mL/kg x 20 kg = 400 mL
  close(t.ruleOfThumbMl, 400, 1e-6);
});

test('packed cells need half the volume of whole blood by the rule of thumb', () => {
  const whole = redCellTransfusion({ weightKg: 20, species: 'dog', currentPcv: 15, targetPcv: 25, product: 'whole' });
  const packed = redCellTransfusion({ weightKg: 20, species: 'dog', currentPcv: 15, targetPcv: 25, product: 'prbc' });
  close(packed.ruleOfThumbMl, whole.ruleOfThumbMl / 2, 1e-6);
});

test('a target below the current PCV is an error', () => {
  const t = redCellTransfusion({ weightKg: 20, species: 'dog', currentPcv: 30, targetPcv: 25 });
  assert.ok(t.issues.some((i) => i.level === 'error'));
});

test('cats use a smaller circulating blood volume', () => {
  const cat = redCellTransfusion({ weightKg: 4, species: 'cat', currentPcv: 12, targetPcv: 20, donorPcv: 40 });
  assert.equal(cat.bloodVolumeMlPerKg, 60);
  close(cat.volumeMl, (8 / 40) * 60 * 4, 1e-6);
});

test('plasma dose warns outside 10-20 mL/kg', () => {
  assert.equal(plasmaTransfusion({ weightKg: 20, mlPerKg: 15 }).issues.length, 0);
  assert.ok(plasmaTransfusion({ weightKg: 20, mlPerKg: 30 }).issues.length > 0);
});

test('transfusion starts with a slow trial rate', () => {
  const rate = transfusionRate({ volumeMl: 450, weightKg: 20 });
  close(rate.trialRateMlHr, 5, 1e-6); // 0.25 mL/kg x 20 kg
  assert.ok(rate.mainRateMlHr > rate.trialRateMlHr);
  assert.ok(rate.issues.some((i) => /within 4 hours/.test(i.message)));
});
