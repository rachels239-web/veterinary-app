import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveComponents, loadingDose, syringeCri, bagCri, deliveredDoseTable,
} from '../src/calc/cri.js';

const close = (a, b, tol = 0.05) => assert.ok(Math.abs(a - b) < tol, `${a} !== ${b}`);
const byName = (mixes, name) => mixes.find((m) => m.name === name);

test('MLK resolves to the house protocol rates for a dog', () => {
  const c = resolveComponents('mlk', 'dog');
  assert.deepEqual(c.map((x) => x.drugId), ['methadone', 'lidocaine', 'ketamine']);
  assert.equal(byName(c, 'Methadone').rateMgKgHr, 0.1);
  assert.equal(byName(c, 'Lidocaine').rateMgKgHr, 3);
  assert.equal(byName(c, 'Ketamine').rateMgKgHr, 0.6);
  // Lidocaine deliberately has no loading dose in this protocol.
  assert.equal(byName(c, 'Lidocaine').loadMgKg, null);
});

test('an explicit null loading dose is not overwritten by the species default', () => {
  const lido = resolveComponents('mlk', 'dog').find((c) => c.drugId === 'lidocaine');
  assert.equal(lido.loadMgKg, null);
  assert.equal(lido.optionalLoadMgKg, 1.5);
});

test('loading doses use the stock concentration', () => {
  const [methadone] = resolveComponents(['methadone'], 'dog');
  const load = loadingDose(methadone, 20);
  // 0.2 mg/kg x 20 kg = 4 mg, from 10 mg/mL = 0.4 mL
  assert.equal(load.massMg, 4);
  assert.equal(load.volumeMl, 0.4);
});

test('a component with no loading dose returns null', () => {
  const [lido] = resolveComponents(['lidocaine'], 'dog');
  assert.equal(loadingDose(lido, 20), null);
});

test('MLK in a 1 L bag for a 20 kg dog at 100 mL/hr', () => {
  // The worked example: the bag runs 10 hr, so each drug needs 10 hours' worth.
  const components = resolveComponents('mlk', 'dog');
  const bag = bagCri({ components, weightKg: 20, bagMl: 1000, fluidRateMlHr: 100 });

  assert.equal(bag.bagLastsHr, 10);
  close(byName(bag.mixes, 'Methadone').totalMg, 20, 1e-9);
  close(byName(bag.mixes, 'Methadone').stockVolumeMl, 2, 1e-9);
  close(byName(bag.mixes, 'Lidocaine').totalMg, 600, 1e-9);
  close(byName(bag.mixes, 'Lidocaine').stockVolumeMl, 30, 1e-9);
  close(byName(bag.mixes, 'Ketamine').totalMg, 120, 1e-9);
  close(byName(bag.mixes, 'Ketamine').stockVolumeMl, 1.2, 1e-9);
  close(bag.addedVolumeMl, 33.2, 1e-9);
});

test('withdrawing an equal volume keeps the dose exact', () => {
  const components = resolveComponents('mlk', 'dog');
  const withdrawn = bagCri({ components, weightKg: 20, bagMl: 1000, fluidRateMlHr: 100, withdrawEqualVolume: true });
  assert.equal(withdrawn.finalVolumeMl, 1000);
  assert.equal(withdrawn.deliveryFactor, 1);
  assert.equal(withdrawn.dilutionErrorPct, 0);
});

test('not withdrawing over-fills the bag and under-doses, and says so', () => {
  const components = resolveComponents('mlk', 'dog');
  const overfilled = bagCri({ components, weightKg: 20, bagMl: 1000, fluidRateMlHr: 100, withdrawEqualVolume: false });
  close(overfilled.finalVolumeMl, 1033.2, 1e-9);
  // 1000/1033.2 = 0.9679, so about 3.2% under the intended dose.
  close(overfilled.deliveryFactor, 0.9679, 1e-4);
  close(overfilled.dilutionErrorPct, 3.21, 0.01);
  assert.ok(overfilled.issues.some((i) => /below the intended dose/.test(i.message)));
});

test('delivered dose falls in proportion to the fluid rate', () => {
  const components = resolveComponents('mlk', 'dog');
  const [surgical, postop] = deliveredDoseTable({
    components, weightKg: 20, designRateMlHr: 100,
    evaluateRates: [
      { label: 'surgical', rateMlHr: 100 },
      { label: 'post-op', rateMlHr: 40 },
    ],
  });

  assert.equal(surgical.factor, 1);
  assert.equal(surgical.anyOutOfRange, false);

  // At 40% of the design rate every drug drops to 40% of its intended dose.
  assert.equal(postop.factor, 0.4);
  close(postop.rows.find((r) => r.name === 'Methadone').deliveredMgKgHr, 0.04, 1e-9);
  close(postop.rows.find((r) => r.name === 'Lidocaine').deliveredMgKgHr, 1.2, 1e-9);
  close(postop.rows.find((r) => r.name === 'Ketamine').deliveredMgKgHr, 0.24, 1e-9);

  // Methadone and lidocaine fall out of range; ketamine survives the drop.
  assert.equal(postop.rows.find((r) => r.name === 'Methadone').inRange, false);
  assert.equal(postop.rows.find((r) => r.name === 'Lidocaine').inRange, false);
  assert.equal(postop.rows.find((r) => r.name === 'Ketamine').inRange, true);
  assert.equal(postop.anyOutOfRange, true);
});

test('syringe pump mix is independent of any fluid rate', () => {
  const components = resolveComponents('mk', 'cat');
  const mix = syringeCri({ components, weightKg: 4, syringeMl: 60, durationHr: 12 });

  assert.equal(mix.pumpRateMlHr, 5);
  assert.equal(mix.runsForHr, 12);
  // Methadone 0.1 mg/kg/hr x 4 kg x 12 hr = 4.8 mg, from 10 mg/mL = 0.48 mL
  close(byName(mix.mixes, 'Methadone').totalMg, 4.8, 1e-9);
  close(byName(mix.mixes, 'Methadone').stockVolumeMl, 0.48, 1e-9);
  // Ketamine 0.6 x 4 x 12 = 28.8 mg, from 100 mg/mL = 0.288 mL
  close(byName(mix.mixes, 'Ketamine').totalMg, 28.8, 1e-9);
  close(byName(mix.mixes, 'Ketamine').stockVolumeMl, 0.288, 1e-9);
  close(mix.diluentMl, 60 - 0.48 - 0.288, 1e-9);
});

test('driving the syringe by pump rate gives the same mix as by duration', () => {
  const components = resolveComponents('mk', 'cat');
  const byDuration = syringeCri({ components, weightKg: 4, syringeMl: 60, durationHr: 12 });
  const byRate = syringeCri({ components, weightKg: 4, syringeMl: 60, pumpRateMlHr: 5 });
  close(byRate.runsForHr, byDuration.runsForHr, 1e-9);
  close(byName(byRate.mixes, 'Ketamine').stockVolumeMl, byName(byDuration.mixes, 'Ketamine').stockVolumeMl, 1e-9);
});

test('a mix that will not fit the syringe is an error, not a silent overflow', () => {
  const components = resolveComponents(['lidocaine'], 'dog');
  // 3 mg/kg/hr x 40 kg x 24 hr = 2880 mg = 144 mL of 2% — far more than a 60 mL syringe.
  const mix = syringeCri({ components, weightKg: 40, syringeMl: 60, durationHr: 24 });
  assert.ok(mix.drugVolumeMl > 60);
  assert.ok(mix.issues.some((i) => i.level === 'error' && /will not fit/.test(i.message)));
});

test('lidocaine CRI in a cat is blocked', () => {
  const components = resolveComponents(['lidocaine'], 'cat');
  assert.equal(components[0].contraindicated, true);
  const mix = syringeCri({ components, weightKg: 4, syringeMl: 30, durationHr: 6 });
  assert.ok(mix.issues.some((i) => i.level === 'error' && /more sensitive/.test(i.message)));
});

test('lidocaine CRI in a dog is not blocked', () => {
  const components = resolveComponents(['lidocaine'], 'dog');
  assert.equal(components[0].contraindicated, false);
  const mix = syringeCri({ components, weightKg: 20, syringeMl: 60, durationHr: 2 });
  assert.equal(mix.issues.filter((i) => i.level === 'error').length, 0);
});

test('undrawable volumes trigger dilution advice', () => {
  const [ketamine] = resolveComponents(['ketamine'], 'cat');
  const load = loadingDose(ketamine, 4);
  // 0.5 mg/kg x 4 kg = 2 mg, from 100 mg/mL = 0.02 mL — not drawable.
  assert.equal(load.volumeMl, 0.02);
  const advice = load.issues.find((i) => /too small to draw/.test(i.message));
  assert.ok(advice);
  assert.equal(advice.factor, 10);
  assert.equal(advice.dilutedMgPerMl, 10);
  assert.equal(advice.dilutedVolumeMl, 0.2);
});

test('a large addition to a bag warns about withdrawing first', () => {
  const components = resolveComponents(['lidocaine'], 'dog');
  // 3 mg/kg/hr x 30 kg over a 500 mL bag at 30 mL/hr (16.7 hr) = 1500 mg = 75 mL.
  const bag = bagCri({ components, weightKg: 30, bagMl: 500, fluidRateMlHr: 30 });
  assert.ok(bag.addedVolumeMl > 50);
  assert.ok(bag.issues.some((i) => /large addition/.test(i.message)));
});
