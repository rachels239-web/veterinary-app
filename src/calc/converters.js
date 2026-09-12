// Unit converters.

import { percentToMgPerMl, mgPerMlToPercent, lbToKg, kgToLb, mgToMcg, mcgToMg, convertCriRate, CRI_UNIT_NAMES } from '../core/units.js';
import { exact } from '../core/format.js';

export const CONVERTERS = [
  {
    id: 'weight',
    label: 'Body weight',
    from: 'kg', to: 'lb',
    forward: kgToLb, back: lbToKg,
    explain: (v) => `${exact(v)} kg ÷ 0.45359237 = ${exact(kgToLb(v))} lb`,
  },
  {
    id: 'percent-solution',
    label: 'Percentage solution to concentration',
    from: '%', to: 'mg/mL',
    forward: percentToMgPerMl, back: mgPerMlToPercent,
    explain: (v) => `${exact(v)}% = ${exact(v)} g per 100 mL = ${exact(percentToMgPerMl(v))} mg/mL`,
    aside: 'A percentage solution is grams of drug per 100 mL, so every 1% is 10 mg/mL.',
  },
  {
    id: 'mass',
    label: 'Drug mass',
    from: 'mg', to: 'µg',
    forward: mgToMcg, back: mcgToMg,
    explain: (v) => `${exact(v)} mg × 1000 = ${exact(mgToMcg(v))} µg`,
  },
];

/** Convert a CRI rate into every supported unit at once. */
export function criRateAllUnits(value, fromUnit) {
  return CRI_UNIT_NAMES.map((unit) => ({
    unit,
    value: convertCriRate(value, fromUnit, unit),
    isSource: unit === fromUnit,
  }));
}

/** Work out what a given mL/hr delivers in mg/kg/hr, and vice versa. */
export function pumpRateToDose({ mlPerHr, mgPerMl, weightKg }) {
  const mgPerHr = mlPerHr * mgPerMl;
  const mgPerKgPerHr = mgPerHr / weightKg;
  return {
    mgPerHr,
    mgPerKgPerHr,
    steps: [
      {
        label: 'Dose delivered',
        words: 'pump rate (mL/hr) × concentration (mg/mL) ÷ body weight (kg) = dose (mg/kg/hr)',
        numbers: `${exact(mlPerHr)} × ${exact(mgPerMl)} ÷ ${exact(weightKg)} = ${exact(mgPerKgPerHr)} mg/kg/hr`,
      },
    ],
  };
}

export function doseToPumpRate({ mgPerKgPerHr, mgPerMl, weightKg }) {
  const mlPerHr = (mgPerKgPerHr * weightKg) / mgPerMl;
  return {
    mlPerHr,
    steps: [
      {
        label: 'Pump rate required',
        words: 'dose (mg/kg/hr) × body weight (kg) ÷ concentration (mg/mL) = pump rate (mL/hr)',
        numbers: `${exact(mgPerKgPerHr)} × ${exact(weightKg)} ÷ ${exact(mgPerMl)} = ${exact(mlPerHr)} mL/hr`,
      },
    ],
  };
}
