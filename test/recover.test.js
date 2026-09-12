import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recoverSheet, defibrillation } from '../src/calc/recover.js';
import { RECOVER_DRUGS } from '../src/data/recover2024.js';

const close = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) < tol, `${a} !== ${b}`);
const find = (sheet, name) => sheet.drugs.find((d) => d.name.startsWith(name));

test('adrenaline is low dose only — high dose was removed in 2024', () => {
  const adrenaline = RECOVER_DRUGS.find((d) => d.id === 'adrenaline');
  assert.equal(adrenaline.doseMgPerKg, 0.01);
  assert.ok(/REMOVED/.test(adrenaline.note));
  // Nothing in the sheet should carry the old 0.1 mg/kg high dose.
  assert.equal(RECOVER_DRUGS.some((d) => d.doseMgPerKg === 0.1 && d.id === 'adrenaline'), false);
});

test('atropine is a single dose only', () => {
  const atropine = RECOVER_DRUGS.find((d) => d.id === 'atropine');
  assert.equal(atropine.doseMgPerKg, 0.04);
  assert.match(atropine.interval, /SINGLE DOSE ONLY/);
  assert.match(atropine.note, /AGAINST repeat dosing/);
});

test('crash doses scale with weight', () => {
  const sheet = recoverSheet(20, 'dog');
  // Adrenaline 0.01 mg/kg x 20 kg = 0.2 mg, from 1 mg/mL = 0.2 mL
  close(find(sheet, 'Adrenaline').volumeMl, 0.2);
  // Atropine 0.04 x 20 = 0.8 mg, from 0.6 mg/mL = 1.333 mL
  close(find(sheet, 'Atropine').volumeMl, 0.8 / 0.6);
});

test('antiarrhythmics are split by species per the 2024 guidelines', () => {
  const dog = recoverSheet(20, 'dog');
  const cat = recoverSheet(4, 'cat');
  assert.ok(find(dog, 'Lidocaine'), 'lidocaine is the canine choice');
  assert.equal(find(dog, 'Amiodarone'), undefined);
  assert.ok(find(cat, 'Amiodarone'), 'amiodarone is the feline choice');
  assert.equal(find(cat, 'Lidocaine'), undefined);
});

test('esmolol carries its follow-on CRI', () => {
  const sheet = recoverSheet(20, 'dog');
  const esmolol = find(sheet, 'Esmolol');
  close(esmolol.volumeMl, 1); // 0.5 mg/kg x 20 = 10 mg, from 10 mg/mL
  // 50 µg/kg/min x 20 kg x 60 min / 1000 = 60 mg/hr
  close(esmolol.cri.mgPerHr, 60);
  close(esmolol.cri.volumeMlPerHr, 6);
});

test('a feline adrenaline dose is flagged as undrawable', () => {
  const sheet = recoverSheet(4, 'cat');
  const adrenaline = find(sheet, 'Adrenaline');
  close(adrenaline.volumeMl, 0.04);
  assert.ok(adrenaline.issues.some((i) => /too small to draw/.test(i.message)));
});

test('defibrillation energies scale and keep their ranges', () => {
  const d = defibrillation(20);
  assert.deepEqual(d.biphasic.external.perKg, [2, 4]);
  assert.deepEqual(d.biphasic.external.joules, [40, 80]);
  assert.deepEqual(d.monophasic.external.joules, [80, 120]);
  assert.deepEqual(d.biphasic.internal.joules, [4, 8]);
  assert.match(d.escalation, /Double the dose for the second shock/);
});

test('unverified doses are reported rather than hidden', () => {
  const sheet = recoverSheet(20, 'dog');
  assert.ok(sheet.unverifiedDrugs.length > 0);
  assert.ok(sheet.unverifiedDrugs.includes('Naloxone'));
});
