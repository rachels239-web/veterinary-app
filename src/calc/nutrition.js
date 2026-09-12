// Energy requirements and body surface area.

import { exact } from '../core/format.js';
import { gatherIssues } from '../core/safety.js';

/** Resting energy requirement, kcal/day. */
export function rer(weightKg, { method = 'allometric' } = {}) {
  const allometric = 70 * weightKg ** 0.75;
  const linear = 30 * weightKg + 70;
  const linearValid = weightKg >= 2 && weightKg <= 45;
  const value = method === 'linear' ? linear : allometric;
  return {
    kcalPerDay: value,
    allometric,
    linear,
    linearValid,
    issues: gatherIssues(
      method === 'linear' && !linearValid
        ? { level: 'warn', message: `The linear RER formula is only reliable between 2 and 45 kg — use the allometric form for a ${weightKg} kg patient.` }
        : null,
    ),
    steps: [
      {
        label: 'Resting energy requirement',
        words: method === 'linear'
          ? '(30 × body weight in kg) + 70 = kcal per day'
          : '70 × body weight (kg) raised to the power 0.75 = kcal per day',
        numbers: method === 'linear'
          ? `(30 × ${exact(weightKg)}) + 70 = ${exact(value)} kcal/day`
          : `70 × ${exact(weightKg)}^0.75 = ${exact(value)} kcal/day`,
      },
    ],
  };
}

/**
 * Life-stage factors applied to RER to give maintenance energy requirement.
 * Hospitalised patients are fed at RER (factor 1.0) — illness factors above 1
 * have fallen out of favour because they promote overfeeding.
 */
export const MER_FACTORS = {
  dog: [
    { id: 'hospitalised', label: 'Hospitalised / critical care', factor: 1.0, note: 'Current practice feeds at RER; start lower and build up over 2–3 days.' },
    { id: 'neutered', label: 'Neutered adult', factor: 1.6 },
    { id: 'intact', label: 'Intact adult', factor: 1.8 },
    { id: 'weight-loss', label: 'Weight loss', factor: 1.0 },
    { id: 'growth-young', label: 'Growth, under 4 months', factor: 3.0 },
    { id: 'growth-older', label: 'Growth, over 4 months', factor: 2.0 },
    { id: 'gestation', label: 'Gestation (last third)', factor: 3.0 },
    { id: 'lactation', label: 'Lactation', factor: 4.0, note: 'Varies widely with litter size — 4–8 × RER.' },
  ],
  cat: [
    { id: 'hospitalised', label: 'Hospitalised / critical care', factor: 1.0, note: 'Current practice feeds at RER.' },
    { id: 'neutered', label: 'Neutered adult', factor: 1.2 },
    { id: 'intact', label: 'Intact adult', factor: 1.4 },
    { id: 'weight-loss', label: 'Weight loss', factor: 0.8 },
    { id: 'growth', label: 'Growth', factor: 2.5 },
    { id: 'gestation', label: 'Gestation', factor: 2.0 },
    { id: 'lactation', label: 'Lactation', factor: 3.0 },
  ],
};

/** Maintenance energy requirement, with optional diet to give a daily volume. */
export function mer(weightKg, species, factorId = 'hospitalised', { kcalPerMl, mealsPerDay = 2 } = {}) {
  const base = rer(weightKg);
  const entry = MER_FACTORS[species].find((f) => f.id === factorId) ?? MER_FACTORS[species][0];
  const kcalPerDay = base.kcalPerDay * entry.factor;
  const mlPerDay = Number.isFinite(kcalPerMl) && kcalPerMl > 0 ? kcalPerDay / kcalPerMl : null;
  return {
    rer: base,
    factor: entry,
    kcalPerDay,
    mlPerDay,
    mlPerMeal: mlPerDay !== null ? mlPerDay / mealsPerDay : null,
    mealsPerDay,
    steps: [
      ...base.steps,
      {
        label: 'Daily energy requirement',
        words: 'resting energy requirement (kcal/day) × life-stage factor = kcal per day',
        numbers: `${exact(base.kcalPerDay)} × ${entry.factor} = ${exact(kcalPerDay)} kcal/day`,
      },
      ...(mlPerDay !== null
        ? [{
            label: 'Volume of diet',
            words: 'kcal per day ÷ diet energy density (kcal/mL) = mL per day',
            numbers: `${exact(kcalPerDay)} ÷ ${exact(kcalPerMl)} = ${exact(mlPerDay)} mL/day (${exact(mlPerDay / mealsPerDay)} mL per meal over ${mealsPerDay} meals)`,
          }]
        : []),
    ],
  };
}

/** Body surface area in m², for chemotherapy dosing. */
export function bodySurfaceArea(weightKg, species) {
  const k = species === 'cat' ? 10.0 : 10.1;
  const m2 = (k * (weightKg * 1000) ** (2 / 3)) / 10000;
  return {
    m2,
    k,
    steps: [
      {
        label: 'Body surface area',
        words: `(${k} × body weight in grams raised to the power 2/3) ÷ 10 000 = square metres`,
        numbers: `(${k} × ${exact(weightKg * 1000)}^(2/3)) ÷ 10000 = ${exact(m2)} m²`,
      },
    ],
  };
}
