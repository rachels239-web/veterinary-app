// Fluid therapy calculations, following the 2024 AAHA guidelines.

import {
  MAINTENANCE_ALLOMETRIC, MAINTENANCE_LINEAR, MAINTENANCE_SIMPLE,
  RESUSCITATION_BOLUS, REHYDRATION_HOURS, ANAESTHESIA_RATE, SUBCUTANEOUS,
  ONGOING_LOSS_BANDS, NORMAL_LOSSES, POTASSIUM,
} from '../data/aaha.js';
import { exact } from '../core/format.js';
import { gatherIssues } from '../core/safety.js';

/** Allometric maintenance — the primary method. */
export function maintenanceAllometric(weightKg, species) {
  const k = MAINTENANCE_ALLOMETRIC[species];
  const mlPerDay = k * weightKg ** MAINTENANCE_ALLOMETRIC.exponent;
  return {
    method: 'allometric',
    mlPerDay,
    mlPerHr: mlPerDay / 24,
    mlPerKgPerHr: mlPerDay / 24 / weightKg,
    steps: [
      {
        label: 'Daily maintenance requirement',
        words: `constant for a ${species} × body weight (kg) raised to the power 0.75 = mL per 24 hr`,
        numbers: `${k} × ${exact(weightKg)}^0.75 = ${exact(mlPerDay)} mL/day`,
      },
      {
        label: 'Hourly rate',
        words: 'mL per 24 hr ÷ 24 = mL per hour',
        numbers: `${exact(mlPerDay)} ÷ 24 = ${exact(mlPerDay / 24)} mL/hr`,
      },
    ],
  };
}

/**
 * Linear formula. AAHA gives it as valid between 2 and 70 kg, but be aware it
 * derives from resting energy requirement and returns markedly lower figures
 * than the allometric formulas — roughly half, for a mid-sized dog. The two are
 * different conventions, not approximations of each other, so the app shows
 * them side by side rather than treating either as a check on the other.
 */
export function maintenanceLinear(weightKg) {
  const { multiplier, offset, validRangeKg } = MAINTENANCE_LINEAR;
  const mlPerDay = multiplier * weightKg + offset;
  const [lo, hi] = validRangeKg;
  const valid = weightKg >= lo && weightKg <= hi;
  return {
    method: 'linear',
    mlPerDay,
    mlPerHr: mlPerDay / 24,
    valid,
    issues: gatherIssues(
      valid ? null : {
        level: 'warn',
        message: `The linear formula is only valid between ${lo} and ${hi} kg — use the allometric result for a ${weightKg} kg patient.`,
      },
    ),
    steps: [
      {
        label: 'Daily maintenance (linear)',
        words: '(30 × body weight in kg) + 70 = mL per 24 hr',
        numbers: `(30 × ${exact(weightKg)}) + 70 = ${exact(mlPerDay)} mL/day`,
      },
    ],
  };
}

/** Simple per-kilo daily rate, with paediatric multiplier if requested. */
export function maintenanceSimple(weightKg, species, { paediatric = false } = {}) {
  const base = MAINTENANCE_SIMPLE[species];
  const multiplier = paediatric ? MAINTENANCE_SIMPLE.paediatricMultiplier[species] : 1;
  const perKgPerDay = base * multiplier;
  const mlPerDay = perKgPerDay * weightKg;
  return {
    method: 'simple',
    perKgPerDay,
    mlPerDay,
    mlPerHr: mlPerDay / 24,
    paediatric,
    steps: [
      {
        label: paediatric ? 'Daily maintenance (paediatric)' : 'Daily maintenance (simple)',
        words: paediatric
          ? `adult rate for a ${species} (mL/kg/day) × paediatric multiplier × body weight (kg) = mL per 24 hr`
          : `rate for a ${species} (mL/kg/day) × body weight (kg) = mL per 24 hr`,
        numbers: paediatric
          ? `${base} × ${multiplier} × ${exact(weightKg)} = ${exact(mlPerDay)} mL/day`
          : `${base} × ${exact(weightKg)} = ${exact(mlPerDay)} mL/day`,
      },
    ],
  };
}

/**
 * All three maintenance methods together, with their mL/kg/day equivalents.
 *
 * These genuinely disagree: for a 20 kg dog the allometric formula gives about
 * 1250 mL/day and the linear formula about 670 mL/day. Showing them together is
 * deliberate — the divergence is a property of the published formulas, and
 * hiding it behind a single number would be the dangerous choice.
 */
export function maintenanceComparison(weightKg, species, { paediatric = false } = {}) {
  const allometric = maintenanceAllometric(weightKg, species);
  const linear = maintenanceLinear(weightKg);
  const simple = maintenanceSimple(weightKg, species, { paediatric });

  const methods = [
    { id: 'allometric', label: `Allometric (${MAINTENANCE_ALLOMETRIC[species]} × kg^0.75)`, ...allometric },
    { id: 'linear', label: 'Linear (30 × kg + 70)', ...linear },
    { id: 'simple', label: `Simple (${simple.perKgPerDay} mL/kg/day)`, ...simple },
  ].map((m) => ({
    ...m,
    mlPerKgPerDay: m.mlPerDay / weightKg,
    mlPerKgPerHr: m.mlPerDay / 24 / weightKg,
  }));

  const values = methods.map((m) => m.mlPerDay);
  const spreadFactor = Math.max(...values) / Math.min(...values);

  return {
    methods,
    spreadFactor,
    issues: gatherIssues(
      linear.issues,
      spreadFactor > 1.3
        ? {
            level: 'info',
            message:
              `The three published maintenance formulas differ by a factor of ${spreadFactor.toFixed(2)} for this patient ` +
              `(${Math.round(Math.min(...values))}–${Math.round(Math.max(...values))} mL/day). They are different conventions rather than ` +
              `approximations of one another — pick the one your practice uses and stay consistent.`,
          }
        : null,
    ),
  };
}

/** Resuscitation bolus for hypovolaemia. */
export function resuscitationBolus(weightKg, species, { mlPerKg } = {}) {
  const band = RESUSCITATION_BOLUS[species];
  const [lo, hi] = band;
  const chosen = Number.isFinite(mlPerKg) ? mlPerKg : lo;
  const volumeLow = lo * weightKg;
  const volumeHigh = hi * weightKg;
  const volume = chosen * weightKg;
  const minutes = RESUSCITATION_BOLUS.overMinutes;
  // Pump rate to deliver the bolus over the stated window.
  const pumpRateMlHr = volume * (60 / minutes);
  return {
    rangeMlPerKg: band,
    chosenMlPerKg: chosen,
    volumeMl: volume,
    volumeRangeMl: [volumeLow, volumeHigh],
    overMinutes: minutes,
    pumpRateMlHr,
    note: RESUSCITATION_BOLUS.note,
    steps: [
      {
        label: 'Bolus volume',
        words: `bolus dose for a ${species} (mL/kg) × body weight (kg) = bolus volume (mL)`,
        numbers: `${exact(chosen)} mL/kg × ${exact(weightKg)} kg = ${exact(volume)} mL`,
      },
      {
        label: `Rate to deliver it over ${minutes} min`,
        words: 'bolus volume (mL) × (60 ÷ minutes) = pump rate (mL/hr)',
        numbers: `${exact(volume)} mL × (60 ÷ ${minutes}) = ${exact(pumpRateMlHr)} mL/hr`,
      },
    ],
  };
}

/** Dehydration deficit and the rate needed to replace it over a chosen period. */
export function dehydrationDeficit(weightKg, percentDehydration, replaceOverHr = REHYDRATION_HOURS.default) {
  // % of body weight as a fluid volume: 1 kg lost = 1000 mL, so %  × kg × 10 = mL.
  const deficitMl = percentDehydration * weightKg * 10;
  const mlPerHr = replaceOverHr > 0 ? deficitMl / replaceOverHr : 0;
  const [guidelineLo] = REHYDRATION_HOURS.range;
  return {
    percentDehydration,
    deficitMl,
    replaceOverHr,
    mlPerHr,
    issues: gatherIssues(
      replaceOverHr < guidelineLo
        ? {
            level: 'info',
            message: `AAHA recommends replacing the deficit over ${REHYDRATION_HOURS.range[0]}–${REHYDRATION_HOURS.range[1]} hr. ${replaceOverHr} hr is faster than guideline — a deliberate clinical choice, but monitor for volume overload.`,
          }
        : null,
    ),
    steps: [
      {
        label: 'Fluid deficit',
        words: '% dehydration × body weight (kg) × 10 = deficit (mL)',
        numbers: `${exact(percentDehydration)}% × ${exact(weightKg)} kg × 10 = ${exact(deficitMl)} mL`,
        aside: '1 kg of body weight lost as water is 1000 mL, so each 1% of body weight is 10 mL per kg.',
      },
      {
        label: 'Rate to replace it',
        words: 'deficit (mL) ÷ replacement period (hr) = rate (mL/hr)',
        numbers: `${exact(deficitMl)} mL ÷ ${exact(replaceOverHr)} hr = ${exact(mlPerHr)} mL/hr`,
      },
    ],
  };
}

/** Ongoing losses from a severity band, or an explicit mL/day figure. */
export function ongoingLosses(weightKg, bandId = 'normal', { mlPerDayOverride } = {}) {
  const band = ONGOING_LOSS_BANDS.find((b) => b.id === bandId) ?? ONGOING_LOSS_BANDS[0];
  const mlPerDay = Number.isFinite(mlPerDayOverride)
    ? mlPerDayOverride
    : band.mlPerKgPerDay * weightKg;
  return {
    band,
    mlPerDay,
    mlPerHr: mlPerDay / 24,
    context: NORMAL_LOSSES,
    unverified: true,
    steps: [
      {
        label: 'Ongoing losses',
        words: 'estimated loss for this severity (mL/kg/day) × body weight (kg) = extra fluid per day (mL)',
        numbers: Number.isFinite(mlPerDayOverride)
          ? `entered directly = ${exact(mlPerDay)} mL/day`
          : `${exact(band.mlPerKgPerDay)} mL/kg/day × ${exact(weightKg)} kg = ${exact(mlPerDay)} mL/day`,
      },
      {
        label: 'As an hourly rate',
        words: 'extra fluid per day (mL) ÷ 24 = mL per hour',
        numbers: `${exact(mlPerDay)} ÷ 24 = ${exact(mlPerDay / 24)} mL/hr`,
      },
    ],
  };
}

/**
 * The whole plan: maintenance + deficit replacement + ongoing losses.
 * Returns the combined rate and a breakdown of what each part contributes.
 */
export function fluidPlan({
  weightKg, species,
  percentDehydration = 0,
  replaceOverHr = REHYDRATION_HOURS.default,
  ongoingBandId = 'normal',
  ongoingMlPerDayOverride,
  paediatric = false,
  method = 'allometric',
}) {
  const maintenance = method === 'simple'
    ? maintenanceSimple(weightKg, species, { paediatric })
    : method === 'linear'
      ? maintenanceLinear(weightKg)
      : maintenanceAllometric(weightKg, species);
  const comparison = maintenanceComparison(weightKg, species, { paediatric });
  const deficit = dehydrationDeficit(weightKg, percentDehydration, replaceOverHr);
  const losses = ongoingLosses(weightKg, ongoingBandId, { mlPerDayOverride: ongoingMlPerDayOverride });

  const totalMlPerHr = maintenance.mlPerHr + deficit.mlPerHr + losses.mlPerHr;
  const mlPerKgPerHr = totalMlPerHr / weightKg;
  // Once the deficit is replaced the rate steps down to maintenance plus losses.
  const afterDeficitMlPerHr = maintenance.mlPerHr + losses.mlPerHr;

  const initial = ANAESTHESIA_RATE[species];
  return {
    maintenance,
    comparison,
    deficit,
    losses,
    totalMlPerHr,
    mlPerKgPerHr,
    afterDeficitMlPerHr,
    afterDeficitMlPerKgPerHr: afterDeficitMlPerHr / weightKg,
    issues: gatherIssues(
      deficit.issues,
      comparison.issues,
      mlPerKgPerHr > 10
        ? {
            level: 'warn',
            message: `The combined rate is ${mlPerKgPerHr.toFixed(1)} mL/kg/hr. Sustained rates above about 10 mL/kg/hr risk volume overload — reassess the replacement period, and watch respiratory rate, body weight and serous nasal discharge.`,
          }
        : null,
      percentDehydration >= 12
        ? {
            level: 'warn',
            message: '12% dehydration carries signs of shock. Address hypovolaemia with resuscitation boluses before committing to a rehydration rate.',
          }
        : null,
    ),
    steps: [
      {
        label: 'Combined rate',
        words: 'maintenance (mL/hr) + deficit replacement (mL/hr) + ongoing losses (mL/hr) = total rate (mL/hr)',
        numbers: `${exact(maintenance.mlPerHr)} + ${exact(deficit.mlPerHr)} + ${exact(losses.mlPerHr)} = ${exact(totalMlPerHr)} mL/hr`,
      },
      {
        label: 'As mL/kg/hr',
        words: 'total rate (mL/hr) ÷ body weight (kg) = mL/kg/hr',
        numbers: `${exact(totalMlPerHr)} ÷ ${exact(weightKg)} = ${exact(mlPerKgPerHr)} mL/kg/hr`,
        aside: `For comparison, the AAHA starting rate for a ${species} with normal cardiac and renal function is ${initial} mL/kg/hr.`,
      },
      {
        label: `Rate after the deficit is replaced (${exact(replaceOverHr)} hr)`,
        words: 'maintenance (mL/hr) + ongoing losses (mL/hr) = ongoing rate (mL/hr)',
        numbers: `${exact(maintenance.mlPerHr)} + ${exact(losses.mlPerHr)} = ${exact(afterDeficitMlPerHr)} mL/hr`,
      },
    ],
  };
}

/** Intra-operative rate. */
export function anaesthesiaRate(weightKg, species) {
  const perKg = ANAESTHESIA_RATE[species];
  const mlPerHr = perKg * weightKg;
  return {
    mlPerKgPerHr: perKg,
    mlPerHr,
    note: ANAESTHESIA_RATE.note,
    steps: [
      {
        label: 'Intra-operative rate',
        words: `anaesthesia rate for a ${species} (mL/kg/hr) × body weight (kg) = rate (mL/hr)`,
        numbers: `${perKg} mL/kg/hr × ${exact(weightKg)} kg = ${exact(mlPerHr)} mL/hr`,
      },
    ],
  };
}

/** Subcutaneous fluids, including how many sites are needed. */
export function subcutaneousFluids(weightKg, { mlPerKg } = {}) {
  const [lo, hi] = SUBCUTANEOUS.perDose;
  const chosen = Number.isFinite(mlPerKg) ? mlPerKg : lo;
  const volume = chosen * weightKg;
  const [, maxPerSiteKg] = SUBCUTANEOUS.maxPerSite;
  const maxPerSiteMl = maxPerSiteKg * weightKg;
  const sites = Math.max(1, Math.ceil(volume / maxPerSiteMl));
  return {
    volumeMl: volume,
    volumeRangeMl: [lo * weightKg, hi * weightKg],
    timesDaily: SUBCUTANEOUS.timesDaily,
    sites,
    maxPerSiteMl,
    steps: [
      {
        label: 'Volume per dose',
        words: 'subcutaneous dose (mL/kg) × body weight (kg) = volume (mL)',
        numbers: `${exact(chosen)} mL/kg × ${exact(weightKg)} kg = ${exact(volume)} mL`,
      },
      {
        label: 'Number of sites',
        words: 'volume (mL) ÷ maximum per site (mL), rounded up = sites needed',
        numbers: `${exact(volume)} ÷ ${exact(maxPerSiteMl)} = ${sites} site${sites === 1 ? '' : 's'}`,
      },
    ],
  };
}

/**
 * Potassium supplementation, dose-driven.
 *
 * Deliberately NOT using a serum-potassium lookup table: AAHA Table 11 has not
 * been verified against the primary source. You set the mEq/kg/hr you want and
 * this works out what to add to the bag at your fluid rate, capped at the
 * absolute maximum infusion rate.
 */
export function potassiumSupplementation({ weightKg, fluidRateMlHr, targetMeqPerKgPerHr, bagMl = 1000 }) {
  const cap = POTASSIUM.maxRateMeqPerKgPerHr;
  const capped = Math.min(targetMeqPerKgPerHr, cap);
  const meqPerHr = capped * weightKg;
  // Concentration that delivers the target rate at the prescribed fluid rate.
  const meqPerLitre = fluidRateMlHr > 0 ? (meqPerHr / fluidRateMlHr) * 1000 : NaN;
  const meqPerBag = meqPerLitre * (bagMl / 1000);
  const bagHours = bagMl / fluidRateMlHr;

  return {
    targetMeqPerKgPerHr: targetMeqPerKgPerHr,
    appliedMeqPerKgPerHr: capped,
    meqPerHr,
    meqPerLitre,
    meqPerBag,
    bagMl,
    bagLastsHr: bagHours,
    issues: gatherIssues(
      { level: 'error', message: 'Potassium-supplemented fluids must NEVER be given as a bolus. Check the bag is on a pump at the prescribed rate before connecting.' },
      targetMeqPerKgPerHr > cap
        ? { level: 'warn', message: `Requested ${targetMeqPerKgPerHr} mEq/kg/hr exceeds the maximum safe infusion rate of ${cap} mEq/kg/hr — capped at ${cap}.` }
        : null,
      meqPerLitre > 60
        ? { level: 'warn', message: `${Math.round(meqPerLitre)} mEq/L is high for a peripheral line — consider a central line, or a higher fluid rate at a lower concentration.` }
        : null,
      { level: 'info', message: POTASSIUM.note },
      POTASSIUM.table11 === null
        ? { level: 'info', message: 'AAHA Table 11 (serum-potassium band lookup) is not yet loaded — see src/data/aaha.js. This calculator is dose-driven until it is verified.' }
        : null,
    ),
    steps: [
      {
        label: 'Potassium per hour',
        words: 'target rate (mEq/kg/hr) × body weight (kg) = potassium per hour (mEq/hr)',
        numbers: `${exact(capped)} mEq/kg/hr × ${exact(weightKg)} kg = ${exact(meqPerHr)} mEq/hr`,
      },
      {
        label: 'Concentration needed in the bag',
        words: '(potassium per hour (mEq/hr) ÷ fluid rate (mL/hr)) × 1000 = concentration (mEq/L)',
        numbers: `(${exact(meqPerHr)} ÷ ${exact(fluidRateMlHr)}) × 1000 = ${exact(meqPerLitre)} mEq/L`,
      },
      {
        label: `Potassium to add to a ${bagMl} mL bag`,
        words: 'concentration (mEq/L) × bag volume in litres = potassium to add (mEq)',
        numbers: `${exact(meqPerLitre)} mEq/L × ${exact(bagMl / 1000)} L = ${exact(meqPerBag)} mEq`,
      },
    ],
  };
}
