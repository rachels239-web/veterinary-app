// Constants from the 2024 AAHA Fluid Therapy Guidelines for Dogs and Cats.
//
// Every figure carries its provenance. `verified: true` means it was confirmed
// across multiple independent sources; `verified: false` means it still needs
// checking against the primary document before clinical reliance.
//
// Primary source: https://www.aaha.org/resources/2024-aaha-fluid-therapy-guidelines-for-dogs-and-cats/

export const SOURCE = {
  name: '2024 AAHA Fluid Therapy Guidelines for Dogs and Cats',
  url: 'https://www.aaha.org/resources/2024-aaha-fluid-therapy-guidelines-for-dogs-and-cats/',
  citation: 'J Am Anim Hosp Assoc 2024;60(4):131–163',
};

/** Allometric maintenance: constant × body weight^0.75 = mL per 24 hr. */
export const MAINTENANCE_ALLOMETRIC = {
  exponent: 0.75,
  dog: 132,
  cat: 80,
  verified: true,
  note: 'Predicts metabolic water requirement more accurately than a linear rate below 10 kg and above 30 kg.',
};

/** Linear alternative, valid only between 2 and 70 kg. */
export const MAINTENANCE_LINEAR = {
  multiplier: 30,
  offset: 70,
  validRangeKg: [2, 70],
  verified: true,
};

/** Simple per-kilo daily rates. */
export const MAINTENANCE_SIMPLE = {
  dog: 60,
  cat: 40,
  unit: 'mL/kg/day',
  paediatricMultiplier: { dog: 3, cat: 2.5 },
  verified: true,
};

/** Starting IV rates for a patient with normal cardiac and renal function. */
export const INITIAL_IV_RATE = {
  dog: [5, 5],
  cat: [3, 5],
  unit: 'mL/kg/hr',
  verified: true,
};

/**
 * Resuscitation boluses. Note how much smaller these are than the historical
 * 80–90 mL/kg "shock dose" — small boluses to a measured endpoint, repeated.
 */
export const RESUSCITATION_BOLUS = {
  dog: [15, 20],
  cat: [5, 10],
  unit: 'mL/kg',
  overMinutes: 15,
  verified: true,
  note: 'Give over approximately 15 minutes and repeat until target perfusion parameters are met, reassessing between boluses.',
};

/** Rehydration period recommended by AAHA. */
export const REHYDRATION_HOURS = {
  range: [12, 24],
  options: [4, 6, 12, 24],
  default: 6,
  verified: true,
  note: 'AAHA recommends sustained delivery over 12–24 hr. Faster replacement is a deliberate clinical choice.',
};

/** Intra-operative rates, carried forward from the 2013/2020 guidelines. */
export const ANAESTHESIA_RATE = {
  dog: 5,
  cat: 3,
  unit: 'mL/kg/hr',
  verified: true,
  note: 'Fluids may not be necessary at all for euhydrated, euvolaemic, healthy patients having short procedures under injectable anaesthesia.',
};

export const SUBCUTANEOUS = {
  perDose: [20, 30],
  unit: 'mL/kg',
  timesDaily: [1, 2],
  maxPerSite: [10, 20],
  verified: true,
};

/**
 * Dehydration assessment. Percentages are the conventional clinical bands;
 * the deficit formula itself is universal.
 */
export const DEHYDRATION_BANDS = [
  { percent: 0, label: 'Not clinically detectable (<5%)', signs: 'No detectable abnormality. History may still suggest losses.' },
  { percent: 5, label: '5% — mild', signs: 'Subtle loss of skin turgor, tacky mucous membranes.' },
  { percent: 7, label: '7% — moderate', signs: 'Decreased skin turgor, dry mucous membranes, slightly sunken eyes, normal pulse quality.' },
  { percent: 10, label: '10% — marked', signs: 'Marked loss of skin turgor, dry mucous membranes, sunken eyes, weak rapid pulses, tachycardia.' },
  { percent: 12, label: '12% — severe', signs: 'All of the above plus signs of shock: obtundation, poor pulses, prolonged CRT, cool extremities.' },
];

/**
 * Ongoing-loss bands.
 *
 * NOT from AAHA — these are pragmatic clinical estimates to be confirmed against
 * house practice. Normal insensible and faecal losses are already covered by the
 * maintenance calculation, so the "normal" band adds nothing.
 */
export const ONGOING_LOSS_BANDS = [
  { id: 'normal', label: 'Normal — no abnormal losses', mlPerKgPerDay: 0, signs: 'Already covered by maintenance.' },
  { id: 'mild', label: 'Mild', mlPerKgPerDay: 5, signs: 'Occasional vomiting or soft stool; one or two episodes a day.' },
  { id: 'moderate', label: 'Moderate', mlPerKgPerDay: 15, signs: 'Several episodes a day of vomiting and/or diarrhoea.' },
  { id: 'severe', label: 'Severe', mlPerKgPerDay: 30, signs: 'Profuse or frequent losses; large-volume watery diarrhoea, repeated vomiting.' },
];

/** Context figures so "normal" has a meaning on screen. */
export const NORMAL_LOSSES = {
  insensibleMlPerKgPerDay: 20,
  urineMlPerKgPerHr: [1, 2],
  note: 'Normal insensible (respiratory and cutaneous) and faecal losses plus normal urine output are what the maintenance figure is designed to replace.',
};

/**
 * Potassium supplementation.
 *
 * AAHA Table 11 has deliberately NOT been transcribed — the figures available
 * secondhand looked wrong for a peripheral line, and a transcription error here
 * is lethal. The calculator is dose-driven instead, with a hard ceiling.
 * Paste Table 11 in here to enable the band lookup.
 */
export const POTASSIUM = {
  maxRateMeqPerKgPerHr: 0.5,
  verified: true,
  neverBolus: true,
  table11: null, // <- awaiting verified transcription
  note: 'Fluids supplemented with potassium must never be given as a bolus. Recheck serum potassium every 24–48 hr and adjust.',
};
