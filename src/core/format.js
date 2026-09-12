// Number formatting and rounding rules for VetApp.
//
// Agreed convention:
//   - 1 decimal place at or above 1 mL
//   - 2 decimal places between 0.1 and 1 mL
//   - 2 significant figures below 0.1 mL, so 0.024 stays 0.024 rather than
//     rounding to 0.02 (a 17% error, and feline CRI rates live down here)
//   - the unrounded value is always available alongside the rounded one
//
// Rates use the same tiered rule rather than a flat 0.1 mL/hr, because a cat
// ketamine CRI can legitimately land at 0.024 mL/hr and 0.1 resolution would
// round it away entirely.

const pow10 = (dp) => 10 ** dp;

/** Round half-up at `dp` decimal places, guarding against float representation error. */
export function round(value, dp = 2) {
  if (!Number.isFinite(value)) return NaN;
  const f = pow10(dp);
  const scaled = value * f;
  // Nudge by a relative epsilon so 1.005 -> 1.01 rather than 1.00.
  const nudged = scaled + Math.sign(scaled) * Math.abs(scaled) * Number.EPSILON * 4;
  return Math.round(nudged) / f;
}

/** Tiered rounding used for every volume and rate we display. */
export function roundVolume(value) {
  if (!Number.isFinite(value)) return NaN;
  const a = Math.abs(value);
  if (a === 0) return 0;
  if (a < 0.1) return Number(value.toPrecision(2));
  if (a < 1) return round(value, 2);
  return round(value, 1);
}

export const roundRate = roundVolume;

/** Drug masses: keep enough precision to stay meaningful at feline doses. */
export function roundMass(mg) {
  if (!Number.isFinite(mg)) return NaN;
  const a = Math.abs(mg);
  if (a === 0) return 0;
  if (a < 0.1) return Number(mg.toPrecision(2));
  if (a < 1) return round(mg, 3);
  if (a < 10) return round(mg, 2);
  return round(mg, 1);
}

/** Strip trailing zeros so 2.50 reads as 2.5 and 2.00 as 2. */
export function trim(value) {
  if (!Number.isFinite(value)) return '—';
  return String(Number(value));
}

/** Full-precision text for the "exact" line under a rounded result. */
export function exact(value, maxDp = 4) {
  if (!Number.isFinite(value)) return '—';
  const fixed = value.toFixed(maxDp);
  const trimmed = fixed.replace(/0+$/, '').replace(/\.$/, '');
  return trimmed === '' || trimmed === '-0' ? '0' : trimmed;
}

/**
 * Format a value for display.
 * Returns both the rounded text and the exact text so the UI can show
 * "4.2 mL/hr" with "4.1666…" underneath without recomputing.
 */
export function fmt(value, unit = '', kind = 'volume') {
  const rounder = kind === 'mass' ? roundMass : roundVolume;
  const rounded = rounder(value);
  const suffix = unit ? ` ${unit}` : '';
  const roundedText = trim(rounded) + suffix;
  const exactText = exact(value) + suffix;
  return {
    value,
    rounded,
    text: roundedText,
    exact: exactText,
    // Only worth showing the exact line when rounding actually changed something.
    showExact: Number.isFinite(value) && exact(rounded) !== exact(value),
  };
}

/** Human-readable duration from a number of hours. */
export function duration(hours) {
  if (!Number.isFinite(hours) || hours <= 0) return '—';
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) return `${h} hr`;
  if (m === 60) return `${h + 1} hr`;
  return `${h} hr ${m} min`;
}
