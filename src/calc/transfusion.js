// Blood product volumes.

import { exact } from '../core/format.js';
import { gatherIssues } from '../core/safety.js';

/** Estimated circulating blood volume, mL/kg. */
export const BLOOD_VOLUME = { dog: 90, cat: 60 };

/**
 * Whole blood or packed red cell volume to reach a target PCV.
 *
 * volume = (target PCV − current PCV) ÷ donor PCV × blood volume (mL/kg) × weight
 */
export function redCellTransfusion({ weightKg, species, currentPcv, targetPcv, donorPcv = 40, product = 'whole' }) {
  const bv = BLOOD_VOLUME[species];
  const rise = targetPcv - currentPcv;
  const volumeMl = (rise / donorPcv) * bv * weightKg;
  // Rule of thumb cross-check: 2 mL/kg whole blood (or 1 mL/kg pRBC) raises PCV by ~1%.
  const perPercent = product === 'prbc' ? 1 : 2;
  const ruleOfThumbMl = rise * perPercent * weightKg;

  return {
    volumeMl,
    ruleOfThumbMl,
    rise,
    bloodVolumeMlPerKg: bv,
    issues: gatherIssues(
      rise <= 0 ? { level: 'error', message: 'The target PCV must be higher than the current PCV.' } : null,
      currentPcv < 12
        ? { level: 'warn', message: `A PCV of ${currentPcv}% is critically low — transfuse urgently and reassess the target.` }
        : null,
      volumeMl > 22 * weightKg
        ? { level: 'warn', message: `${Math.round(volumeMl)} mL exceeds roughly 22 mL/kg in one transfusion — consider splitting it and reassessing between units.` }
        : null,
    ),
    steps: [
      {
        label: 'Transfusion volume',
        words: '(target PCV − current PCV) ÷ donor PCV × blood volume (mL/kg) × body weight (kg) = volume (mL)',
        numbers: `(${exact(targetPcv)} − ${exact(currentPcv)}) ÷ ${exact(donorPcv)} × ${bv} × ${exact(weightKg)} = ${exact(volumeMl)} mL`,
      },
      {
        label: 'Rule-of-thumb cross-check',
        words: `PCV points wanted × ${perPercent} mL/kg × body weight (kg) = volume (mL)`,
        numbers: `${exact(rise)} × ${perPercent} × ${exact(weightKg)} = ${exact(ruleOfThumbMl)} mL`,
        aside: `${perPercent} mL/kg of ${product === 'prbc' ? 'packed red cells' : 'whole blood'} raises PCV by roughly 1 percentage point.`,
      },
    ],
  };
}

/** Plasma for coagulopathy or colloid support. */
export function plasmaTransfusion({ weightKg, mlPerKg = 15 }) {
  const volumeMl = mlPerKg * weightKg;
  return {
    volumeMl,
    rangeMl: [10 * weightKg, 20 * weightKg],
    issues: gatherIssues(
      mlPerKg < 10 || mlPerKg > 20
        ? { level: 'warn', message: `${mlPerKg} mL/kg sits outside the usual 10–20 mL/kg plasma dose.` }
        : null,
    ),
    steps: [
      {
        label: 'Plasma volume',
        words: 'plasma dose (mL/kg) × body weight (kg) = volume (mL)',
        numbers: `${exact(mlPerKg)} mL/kg × ${exact(weightKg)} kg = ${exact(volumeMl)} mL`,
      },
    ],
  };
}

/** Transfusion rate: start slowly, then deliver the rest within four hours. */
export function transfusionRate({ volumeMl, weightKg, totalHours = 4 }) {
  const trialRateMlHr = Math.min(0.25 * weightKg, volumeMl / 0.25);
  const remainingMl = Math.max(0, volumeMl - trialRateMlHr * 0.25);
  const mainRateMlHr = remainingMl / Math.max(0.25, totalHours - 0.25);
  return {
    trialRateMlHr,
    trialMinutes: 15,
    mainRateMlHr,
    totalHours,
    issues: gatherIssues({
      level: 'info',
      message: 'Give the first 0.25 mL/kg over 15 minutes while monitoring temperature, pulse and respiration, then increase. Complete any unit within 4 hours of spiking it.',
    }),
    steps: [
      {
        label: 'Trial rate (first 15 min)',
        words: '0.25 mL/kg × body weight (kg) delivered over 15 min = trial rate (mL/hr)',
        numbers: `0.25 × ${exact(weightKg)} = ${exact(0.25 * weightKg)} mL in the first 15 min`,
      },
      {
        label: 'Remaining volume',
        words: 'remaining volume (mL) ÷ remaining hours = rate (mL/hr)',
        numbers: `${exact(remainingMl)} mL ÷ ${exact(totalHours - 0.25)} hr = ${exact(mainRateMlHr)} mL/hr`,
      },
    ],
  };
}
