// Unit handling for VetApp.
//
// Everything is canonicalised internally: mass in mg, volume in mL, weight in kg,
// CRI rates in mg/kg/hr. Display conversion happens at the edge only, so no
// calculation ever has to care which unit the user is looking at.

export const MG_PER_MCG = 0.001;
export const KG_PER_LB = 0.45359237;

/** A percentage solution is grams per 100 mL, so 1% = 10 mg/mL. */
export const percentToMgPerMl = (percent) => percent * 10;
export const mgPerMlToPercent = (mgPerMl) => mgPerMl / 10;

export const mcgToMg = (mcg) => mcg * MG_PER_MCG;
export const mgToMcg = (mg) => mg / MG_PER_MCG;

export const lbToKg = (lb) => lb * KG_PER_LB;
export const kgToLb = (kg) => kg / KG_PER_LB;

// CRI rate units. mg/kg/hr is canonical; these convert to and from it.
// mcg/kg/min -> mg/kg/hr is x60 (minutes to hours) then /1000 (mcg to mg).
export const CRI_UNITS = {
  'mg/kg/hr': { toCanonical: (v) => v, fromCanonical: (v) => v },
  'mcg/kg/hr': { toCanonical: (v) => v / 1000, fromCanonical: (v) => v * 1000 },
  'mcg/kg/min': { toCanonical: (v) => (v * 60) / 1000, fromCanonical: (v) => (v * 1000) / 60 },
  'mg/kg/min': { toCanonical: (v) => v * 60, fromCanonical: (v) => v / 60 },
};

export const CRI_UNIT_NAMES = Object.keys(CRI_UNITS);

/** Convert a CRI rate between any two supported units. */
export function convertCriRate(value, fromUnit, toUnit) {
  const from = CRI_UNITS[fromUnit];
  const to = CRI_UNITS[toUnit];
  if (!from || !to) throw new Error(`Unknown CRI unit: ${fromUnit} -> ${toUnit}`);
  return to.fromCanonical(from.toCanonical(value));
}

export const toCanonicalRate = (value, unit) => CRI_UNITS[unit].toCanonical(value);
export const fromCanonicalRate = (value, unit) => CRI_UNITS[unit].fromCanonical(value);

/** Volume of stock solution needed to deliver a given mass. */
export function volumeForMass(mg, mgPerMl) {
  if (!(mgPerMl > 0)) return NaN;
  return mg / mgPerMl;
}
