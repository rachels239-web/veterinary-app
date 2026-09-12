// Range checking, plausibility guards and the small-volume dilution helper.

/** Minimum volume we consider accurately drawable with a standard syringe. */
export const MIN_DRAWABLE_ML = 0.1;

/** Plausible body weights. Outside these we warn rather than block. */
export const WEIGHT_LIMITS = {
  dog: { min: 0.5, max: 90, typical: [1, 70] },
  cat: { min: 0.3, max: 12, typical: [1.5, 8] },
};

export function checkWeight(weightKg, species) {
  const limits = WEIGHT_LIMITS[species];
  if (!limits || !Number.isFinite(weightKg)) return null;
  if (weightKg <= 0) return { level: 'error', message: 'Weight must be greater than zero.' };
  if (weightKg < limits.min) {
    return { level: 'error', message: `${weightKg} kg is below the plausible range for a ${species} (${limits.min}–${limits.max} kg). Check the weight before dosing.` };
  }
  if (weightKg > limits.max) {
    return { level: 'error', message: `${weightKg} kg is above the plausible range for a ${species} (${limits.min}–${limits.max} kg). Check the weight before dosing.` };
  }
  const [lo, hi] = limits.typical;
  if (weightKg < lo || weightKg > hi) {
    return { level: 'warn', message: `${weightKg} kg is unusual for a ${species} but possible — double-check it.` };
  }
  return null;
}

/**
 * Compare a value against an accepted [min, max] range.
 * Returns null when in range, otherwise a warning describing the direction.
 */
export function checkRange(value, range, { label = 'Dose', unit = '', format = (v) => String(v) } = {}) {
  if (!range || !Number.isFinite(value)) return null;
  const [min, max] = range;
  const suffix = unit ? ` ${unit}` : '';
  if (value < min) {
    return {
      level: 'warn',
      direction: 'below',
      message: `${label} ${format(value)}${suffix} is BELOW the accepted range of ${format(min)}–${format(max)}${suffix}.`,
    };
  }
  if (value > max) {
    return {
      level: 'warn',
      direction: 'above',
      message: `${label} ${format(value)}${suffix} is ABOVE the accepted range of ${format(min)}–${format(max)}${suffix}.`,
    };
  }
  return null;
}

/**
 * Advice for volumes too small to draw accurately.
 *
 * A 4 kg cat needing 0.4 mg of methadone from a 10 mg/mL vial must draw 0.04 mL,
 * which no syringe measures reliably. This works out a dilution that brings the
 * volume up to something measurable.
 */
export function dilutionAdvice(volumeMl, mgPerMl, { minVolume = MIN_DRAWABLE_ML } = {}) {
  if (!Number.isFinite(volumeMl) || volumeMl <= 0 || volumeMl >= minVolume) return null;
  // Step through decade dilutions until the volume is comfortably drawable.
  const factors = [10, 100, 1000];
  const factor = factors.find((f) => volumeMl * f >= minVolume);
  if (!factor) return null;
  return {
    level: 'info',
    factor,
    dilutedMgPerMl: mgPerMl / factor,
    dilutedVolumeMl: volumeMl * factor,
    message:
      `${volumeMl.toPrecision(2)} mL is too small to draw accurately. ` +
      `Dilute 1 mL of stock to ${factor} mL (giving ${Number((mgPerMl / factor).toPrecision(3))} mg/mL), ` +
      `then draw ${Number((volumeMl * factor).toPrecision(3))} mL.`,
  };
}

/** Collect non-null issues, most severe first. */
export function gatherIssues(...issues) {
  const order = { error: 0, warn: 1, info: 2 };
  return issues
    .flat()
    .filter(Boolean)
    .sort((a, b) => (order[a.level] ?? 3) - (order[b.level] ?? 3));
}
