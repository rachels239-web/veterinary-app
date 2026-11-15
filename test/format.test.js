import { test } from 'node:test';
import assert from 'node:assert/strict';
import { roundVolume, roundMass, round, exact, fmt, duration, parseNumber } from '../src/core/format.js';

test('volumes round to 1 dp at or above 1 mL', () => {
  assert.equal(roundVolume(4.1666), 4.2);
  assert.equal(roundVolume(33.24), 33.2);
  assert.equal(roundVolume(100), 100);
});

test('volumes round to 2 dp between 0.1 and 1 mL', () => {
  assert.equal(roundVolume(0.456), 0.46);
  assert.equal(roundVolume(0.5), 0.5);
});

test('volumes below 0.1 mL keep 2 significant figures', () => {
  // 0.024 must not become 0.02 — that is a 17% error, and feline CRI rates live here.
  assert.equal(roundVolume(0.024), 0.024);
  assert.equal(roundVolume(0.0024), 0.0024);
  assert.equal(roundVolume(0.04), 0.04);
});

test('zero and non-finite values are handled', () => {
  assert.equal(roundVolume(0), 0);
  assert.ok(Number.isNaN(roundVolume(NaN)));
  assert.ok(Number.isNaN(roundVolume(Infinity)));
});

test('masses keep precision at feline doses', () => {
  assert.equal(roundMass(0.4), 0.4);
  assert.equal(roundMass(0.024), 0.024);
  assert.equal(roundMass(5.76), 5.76);
  assert.equal(roundMass(120), 120);
});

test('round handles float representation error', () => {
  assert.equal(round(1.005, 2), 1.01);
  assert.equal(round(0.1 + 0.2, 1), 0.3);
});

test('exact trims trailing zeros', () => {
  assert.equal(exact(2.5), '2.5');
  assert.equal(exact(2), '2');
  assert.equal(exact(4.16666), '4.1667');
});

test('fmt flags when rounding changed the value', () => {
  assert.equal(fmt(4.16666, 'mL/hr').showExact, true);
  assert.equal(fmt(4, 'mL/hr').showExact, false);
  assert.equal(fmt(4.16666, 'mL/hr').text, '4.2 mL/hr');
});

test('duration reads naturally', () => {
  assert.equal(duration(0.5), '30 min');
  assert.equal(duration(6), '6 hr');
  assert.equal(duration(14.285), '14 hr 17 min');
});

test('parseNumber tolerates part-typed input', () => {
  // These are states a user passes through while typing and must not be
  // treated as errors, or the decimal point can never be entered.
  assert.equal(parseNumber('4'), 4);
  assert.equal(parseNumber('4.'), 4);
  assert.equal(parseNumber('4.5'), 4.5);
  assert.equal(parseNumber('.5'), 0.5);
  assert.equal(parseNumber('0.'), 0);
});

test('parseNumber returns null for anything not yet a number', () => {
  assert.equal(parseNumber(''), null);
  assert.equal(parseNumber('   '), null);
  assert.equal(parseNumber('.'), null);
  assert.equal(parseNumber('-'), null);
  assert.equal(parseNumber('abc'), null);
  assert.equal(parseNumber(null), null);
  assert.equal(parseNumber(undefined), null);
  assert.equal(parseNumber(NaN), null);
  assert.equal(parseNumber(Infinity), null);
});

test('parseNumber accepts a comma decimal separator', () => {
  // A keyboard set to a European locale offers a comma, not a full stop.
  assert.equal(parseNumber('4,5'), 4.5);
  assert.equal(parseNumber('0,25'), 0.25);
});

test('parseNumber keeps whole and negative numbers intact', () => {
  assert.equal(parseNumber(' 20 '), 20);
  assert.equal(parseNumber('-3.5'), -3.5);
  assert.equal(parseNumber(12), 12);
});

test('a part-typed decimal parses to the value the field still shows', () => {
  // The field keeps the raw text only while it parses to the current value,
  // so this equality is what lets "4." survive long enough to become "4.5".
  assert.equal(parseNumber('4.'), parseNumber('4'));
});
