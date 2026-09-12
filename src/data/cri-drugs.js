// CRI drug definitions.
//
// All rates are stored canonically as mg/kg/hr and all loading doses as mg/kg,
// regardless of how the drug is conventionally written. `displayUnit` controls
// what the app shows by default; the user can toggle units at any time.
//
// ADDING A DRUG: copy a block, give it a unique `id`, set the stock product and
// the per-species doses. It appears in the CRI picker immediately.
//
// `range` is the accepted analgesic/therapeutic window. Results outside it get a
// warning rather than a block, except where `contraindicated` is set.
// `provenance` records where the numbers came from so they can be audited.

export const CRI_DRUGS = [
  {
    id: 'methadone',
    name: 'Methadone',
    defaultStockId: 'methadone-10',
    displayUnit: 'mg/kg/hr',
    species: {
      dog: { load: 0.2, rate: 0.1, range: [0.05, 0.2], loadRange: [0.1, 0.3] },
      cat: { load: 0.1, rate: 0.1, range: [0.05, 0.15], loadRange: [0.05, 0.2] },
    },
    provenance: 'House protocol',
    notes: 'Full mu agonist. Same CRI rate in cats and dogs.',
  },
  {
    id: 'ketamine',
    name: 'Ketamine',
    defaultStockId: 'ketamine-100',
    displayUnit: 'mg/kg/hr',
    species: {
      dog: { load: 1, rate: 0.6, range: [0.12, 0.6], loadRange: [0.5, 1] },
      cat: { load: 0.5, rate: 0.6, range: [0.12, 0.6], loadRange: [0.25, 0.5] },
    },
    provenance: 'House protocol; range equals the conventional 2–10 µg/kg/min analgesic window',
    notes: 'NMDA antagonist for wind-up pain. 0.6 mg/kg/hr is the top of the analgesic range — commonly reduced to 0.12–0.3 mg/kg/hr post-operatively.',
  },
  {
    id: 'lidocaine',
    name: 'Lidocaine',
    defaultStockId: 'lidocaine-2',
    displayUnit: 'mg/kg/hr',
    species: {
      dog: { load: null, rate: 3, range: [1.5, 3], loadRange: [1, 2], optionalLoad: 1.5 },
      cat: {
        load: null, rate: 1, range: [0.6, 1.2], loadRange: [0.25, 0.5], optionalLoad: 0.25,
        contraindicated: true,
        contraindicationReason:
          'Cats are markedly more sensitive to the cardiovascular depressant effects of lidocaine. Most combination protocols omit it entirely in cats.',
      },
    },
    provenance: 'House protocol; canine range equals the conventional 25–50 µg/kg/min window',
    notes: '3 mg/kg/hr is the top of the canine analgesic range. No loading dose is set by default — enable one if you want a faster onset.',
  },
  {
    id: 'fentanyl',
    name: 'Fentanyl',
    defaultStockId: 'fentanyl-50',
    // Fentanyl is the one drug deliberately defaulted to µg: 0.005 mg/kg/hr is
    // an invitation to lose a decimal place.
    displayUnit: 'mcg/kg/hr',
    species: {
      dog: { load: 0.003, rate: 0.005, range: [0.002, 0.01], loadRange: [0.002, 0.005] },
      cat: { load: 0.002, rate: 0.003, range: [0.002, 0.005], loadRange: [0.001, 0.003] },
    },
    provenance: 'Conventional small-animal ranges — not yet confirmed against house protocol',
    notes: 'Potent full mu agonist. Expect respiratory depression and bradycardia; ventilatory support may be required intra-operatively.',
  },
  {
    id: 'butorphanol',
    name: 'Butorphanol',
    defaultStockId: 'butorphanol-10',
    displayUnit: 'mg/kg/hr',
    species: {
      dog: { load: 0.2, rate: 0.1, range: [0.1, 0.2], loadRange: [0.1, 0.4] },
      cat: { load: 0.2, rate: 0.1, range: [0.1, 0.2], loadRange: [0.1, 0.4] },
    },
    provenance: 'Conventional ranges — CONFIRM before clinical use',
    confirm: true,
    notes: 'Kappa agonist / mu antagonist. Sedation and visceral analgesia, weak somatic analgesia; short acting.',
  },
];

const byId = new Map(CRI_DRUGS.map((d) => [d.id, d]));
export const criDrugById = (id) => byId.get(id);

/** Per-species dose block for a drug, or undefined if not defined for that species. */
export function doseFor(drugId, species) {
  return byId.get(drugId)?.species?.[species];
}
