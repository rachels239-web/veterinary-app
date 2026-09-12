// RECOVER 2024 crash doses, generated from the patient weight in the header bar.

import { RECOVER_DRUGS, DEFIBRILLATION, BLS_TARGETS, RECOVER_SOURCE } from '../data/recover2024.js';
import { stockById } from '../data/concentrations.js';
import { dilutionAdvice, gatherIssues } from '../core/safety.js';
import { exact } from '../core/format.js';

/** One drug row for this patient. */
function drugRow(drug, weightKg) {
  const stock = drug.stockId ? stockById(drug.stockId) : null;
  const mgPerMl = drug.mgPerMl ?? stock?.mgPerMl ?? null;

  // Units-based drugs (vasopressin) and volume-based drugs (calcium) differ.
  if (Number.isFinite(drug.doseUnitsPerKg)) {
    const units = drug.doseUnitsPerKg * weightKg;
    const volumeMl = units / drug.unitsPerMl;
    return {
      ...drug, mgPerMl: null, doseText: `${drug.doseUnitsPerKg} U/kg`,
      amount: units, amountUnit: 'U', volumeMl,
      concentrationLabel: `${drug.unitsPerMl} U/mL`,
      steps: [{
        label: `${drug.name} dose`,
        words: 'dose (U/kg) × body weight (kg) = units to give, ÷ concentration (U/mL) = volume (mL)',
        numbers: `${drug.doseUnitsPerKg} U/kg × ${exact(weightKg)} kg = ${exact(units)} U ÷ ${drug.unitsPerMl} U/mL = ${exact(volumeMl)} mL`,
      }],
      issues: gatherIssues(dilutionAdvice(volumeMl, drug.unitsPerMl)),
    };
  }

  if (Array.isArray(drug.doseMlPerKg)) {
    const [lo, hi] = drug.doseMlPerKg;
    return {
      ...drug, mgPerMl, doseText: `${lo}–${hi} mL/kg`,
      amount: null, amountUnit: null,
      volumeMl: lo * weightKg, volumeRangeMl: [lo * weightKg, hi * weightKg],
      concentrationLabel: stock?.label ?? '',
      steps: [{
        label: `${drug.name} volume`,
        words: 'dose (mL/kg) × body weight (kg) = volume to give (mL)',
        numbers: `${lo}–${hi} mL/kg × ${exact(weightKg)} kg = ${exact(lo * weightKg)}–${exact(hi * weightKg)} mL`,
      }],
      issues: [],
    };
  }

  const massMg = drug.doseMgPerKg * weightKg;
  const volumeMl = mgPerMl ? massMg / mgPerMl : NaN;
  const row = {
    ...drug, mgPerMl,
    doseText: `${drug.doseMgPerKg} mg/kg`,
    amount: massMg, amountUnit: 'mg', volumeMl,
    concentrationLabel: stock?.label ?? (mgPerMl ? `${mgPerMl} mg/mL` : ''),
    steps: [
      {
        label: `${drug.name} dose`,
        words: 'dose (mg/kg) × body weight (kg) = mass to give (mg)',
        numbers: `${drug.doseMgPerKg} mg/kg × ${exact(weightKg)} kg = ${exact(massMg)} mg`,
      },
      {
        label: 'Volume to draw',
        words: 'mass to give (mg) ÷ concentration (mg/mL) = volume (mL)',
        numbers: `${exact(massMg)} mg ÷ ${exact(mgPerMl)} mg/mL = ${exact(volumeMl)} mL`,
      },
    ],
    issues: gatherIssues(dilutionAdvice(volumeMl, mgPerMl)),
  };

  // Esmolol carries a follow-on CRI.
  if (Number.isFinite(drug.criMcgPerKgPerMin)) {
    const mgPerHr = (drug.criMcgPerKgPerMin * weightKg * 60) / 1000;
    row.cri = {
      mcgPerKgPerMin: drug.criMcgPerKgPerMin,
      mgPerHr,
      volumeMlPerHr: mgPerMl ? mgPerHr / mgPerMl : NaN,
    };
    row.steps.push({
      label: 'Follow-on CRI',
      words: 'CRI rate (µg/kg/min) × body weight (kg) × 60 ÷ 1000 = mg per hour',
      numbers: `${drug.criMcgPerKgPerMin} × ${exact(weightKg)} × 60 ÷ 1000 = ${exact(mgPerHr)} mg/hr`,
    });
  }

  return row;
}

/** Defibrillation energies for this patient. */
export function defibrillation(weightKg) {
  const build = (range) => ({
    perKg: range,
    joules: range.map((j) => j * weightKg),
  });
  return {
    biphasic: {
      external: build(DEFIBRILLATION.biphasic.external),
      internal: build(DEFIBRILLATION.biphasic.internal),
    },
    monophasic: {
      external: build(DEFIBRILLATION.monophasic.external),
      internal: build(DEFIBRILLATION.monophasic.internal),
    },
    escalation: DEFIBRILLATION.escalation,
    steps: [{
      label: 'Defibrillation energy',
      words: 'energy per kg (J/kg) × body weight (kg) = shock energy (J)',
      numbers: `biphasic external ${DEFIBRILLATION.biphasic.external.join('–')} J/kg × ${exact(weightKg)} kg = ` +
        `${DEFIBRILLATION.biphasic.external.map((j) => exact(j * weightKg)).join('–')} J`,
    }],
  };
}

/** The whole crash sheet for this patient. */
export function recoverSheet(weightKg, species) {
  const drugs = RECOVER_DRUGS
    .filter((d) => d.species.includes(species))
    .map((d) => drugRow(d, weightKg));

  return {
    source: RECOVER_SOURCE,
    weightKg,
    species,
    drugs,
    defibrillation: defibrillation(weightKg),
    bls: BLS_TARGETS,
    unverifiedDrugs: drugs.filter((d) => !d.verified).map((d) => d.name),
  };
}
