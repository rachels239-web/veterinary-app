// 2024 RECOVER CPR guideline doses.
//
// Source: Burkitt-Creedon et al. 2024 RECOVER Guidelines, J Vet Emerg Crit Care
//         doi:10.1111/vec.13391 (and the ALS paper, doi:10.1111/vec.13389)
//
// `verified: true` means the figure was confirmed across multiple independent
// summaries of the 2024 guidelines. `verified: false` means it is a conventional
// dose that was NOT confirmed against the 2024 document — check it before use.
//
// Notable 2024 changes reflected here:
//   - high-dose adrenaline has been REMOVED (no longer recommended)
//   - atropine is a SINGLE dose only; repeat dosing is advised against
//   - esmolol is new, for shockable rhythms that do not convert
//   - vasopressin is prioritised for shockable rhythms
//   - the ETCO2 target rose from 15 to 18 mmHg

export const RECOVER_SOURCE = {
  name: '2024 RECOVER Guidelines',
  citation: 'Burkitt-Creedon et al. J Vet Emerg Crit Care 2024; doi:10.1111/vec.13391',
  url: 'https://recoverinitiative.org/2024-guidelines/',
};

export const RECOVER_DRUGS = [
  {
    id: 'adrenaline',
    name: 'Adrenaline (epinephrine)',
    doseMgPerKg: 0.01,
    stockId: 'adrenaline-1',
    route: 'IV / IO',
    indication: 'All arrest rhythms',
    interval: 'Every other BLS cycle (every 3–5 min)',
    species: ['dog', 'cat'],
    verified: true,
    note: 'Low dose only. High-dose adrenaline (0.1 mg/kg) was REMOVED in the 2024 guidelines and is no longer recommended.',
  },
  {
    id: 'vasopressin',
    name: 'Vasopressin',
    doseUnitsPerKg: 0.8,
    unitsPerMl: 20,
    route: 'IV / IO',
    indication: 'Prioritised for shockable rhythms; may replace or accompany adrenaline',
    interval: 'Every other BLS cycle',
    species: ['dog', 'cat'],
    verified: true,
    confirmStock: true,
  },
  {
    id: 'atropine',
    name: 'Atropine',
    doseMgPerKg: 0.04,
    stockId: 'atropine-0.6',
    route: 'IV / IO',
    indication: 'Non-shockable rhythms (asystole, PEA)',
    interval: 'SINGLE DOSE ONLY',
    species: ['dog', 'cat'],
    verified: true,
    note: '2024 guidelines advise AGAINST repeat dosing — long half-life, and higher cumulative doses are associated with poorer outcomes in dogs.',
  },
  {
    id: 'lidocaine-cpr',
    name: 'Lidocaine',
    doseMgPerKg: 2,
    stockId: 'lidocaine-2',
    route: 'IV / IO over 2–4 min',
    indication: 'Refractory shockable rhythm (VF / pulseless VT) — DOGS',
    species: ['dog'],
    verified: true,
  },
  {
    id: 'amiodarone-cpr',
    name: 'Amiodarone',
    doseMgPerKg: 5,
    stockId: 'amiodarone-50',
    route: 'IV / IO',
    indication: 'Refractory shockable rhythm (VF / pulseless VT) — CATS',
    species: ['cat'],
    verified: true,
  },
  {
    id: 'esmolol',
    name: 'Esmolol',
    doseMgPerKg: 0.5,
    mgPerMl: 10,
    route: 'IV / IO over 3–5 min, then CRI',
    indication: 'Shockable rhythm that does not convert after the first shock',
    criMcgPerKgPerMin: 50,
    species: ['dog', 'cat'],
    verified: true,
    confirmStock: true,
    note: 'New in 2024. Follow the bolus with a CRI at 50 µg/kg/min to blunt catecholamine effects.',
  },
  {
    id: 'naloxone',
    name: 'Naloxone',
    doseMgPerKg: 0.04,
    stockId: 'naloxone-0.4',
    route: 'IV / IO',
    indication: 'Opioid reversal',
    species: ['dog', 'cat'],
    verified: false,
  },
  {
    id: 'flumazenil',
    name: 'Flumazenil',
    doseMgPerKg: 0.01,
    stockId: 'flumazenil-0.1',
    route: 'IV / IO',
    indication: 'Benzodiazepine reversal',
    species: ['dog', 'cat'],
    verified: false,
  },
  {
    id: 'atipamezole',
    name: 'Atipamezole',
    doseMgPerKg: 0.1,
    stockId: 'atipamezole-5',
    route: 'IM preferred',
    indication: 'Alpha-2 agonist reversal',
    species: ['dog', 'cat'],
    verified: false,
  },
  {
    id: 'calcium-gluconate',
    name: 'Calcium gluconate 10%',
    doseMlPerKg: [0.5, 1.5],
    stockId: 'calcium-gluconate-10',
    route: 'IV / IO slowly',
    indication: 'Documented hyperkalaemia or ionised hypocalcaemia',
    species: ['dog', 'cat'],
    verified: false,
  },
];

/** Defibrillation energies, J/kg. */
export const DEFIBRILLATION = {
  biphasic: { external: [2, 4], internal: [0.2, 0.4] },
  monophasic: { external: [4, 6], internal: [0.5, 1] },
  verified: true,
  escalation: 'Double the dose for the second shock (biphasic: 2 J/kg then 4 J/kg), then hold that dose for subsequent shocks — do not keep escalating.',
};

/** Basic life support targets. */
export const BLS_TARGETS = {
  compressionRatePerMin: [100, 120],
  compressionDepth: 'One third to one half of the chest width, with full recoil between compressions',
  ventilationRatePerMin: 10,
  ventilationInterval: '1 breath every 6 seconds',
  cycleMinutes: 2,
  etco2TargetMmHg: 18,
  verified: true,
  note: 'The ETCO2 target rose from 15 to 18 mmHg in the 2024 guidelines. Swap compressor every 2-minute cycle.',
};
