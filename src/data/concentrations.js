// Stock concentrations held in the practice.
//
// Adding a product: copy a line, give it a unique `id`, and set `mgPerMl`.
// Everything downstream (CRI volumes, dose volumes, dilution advice) picks it up
// automatically. Concentration remains editable in the app for one-off products.

export const STOCK = [
  { id: 'lidocaine-2', drug: 'lidocaine', label: 'Lidocaine 2%', mgPerMl: 20, note: '2% = 20 mg/mL' },
  { id: 'ketamine-100', drug: 'ketamine', label: 'Ketamine 100 mg/mL', mgPerMl: 100 },
  { id: 'methadone-10', drug: 'methadone', label: 'Methadone 10 mg/mL', mgPerMl: 10 },
  { id: 'butorphanol-10', drug: 'butorphanol', label: 'Butorphanol 10 mg/mL', mgPerMl: 10 },
  { id: 'buprenorphine-0.3', drug: 'buprenorphine', label: 'Buprenorphine 0.3 mg/mL', mgPerMl: 0.3 },
  { id: 'fentanyl-50', drug: 'fentanyl', label: 'Fentanyl 100 µg/2 mL', mgPerMl: 0.05, note: '= 50 µg/mL' },

  // Resuscitation drugs. Confirm these against your own stock — they are the
  // common presentations, not a record of what is on your crash trolley.
  { id: 'adrenaline-1', drug: 'adrenaline', label: 'Adrenaline 1 mg/mL (1:1000)', mgPerMl: 1, confirm: true },
  { id: 'atropine-0.6', drug: 'atropine', label: 'Atropine 0.6 mg/mL', mgPerMl: 0.6, confirm: true },
  { id: 'amiodarone-50', drug: 'amiodarone', label: 'Amiodarone 50 mg/mL', mgPerMl: 50, confirm: true },
  { id: 'naloxone-0.4', drug: 'naloxone', label: 'Naloxone 0.4 mg/mL', mgPerMl: 0.4, confirm: true },
  { id: 'flumazenil-0.1', drug: 'flumazenil', label: 'Flumazenil 0.1 mg/mL', mgPerMl: 0.1, confirm: true },
  { id: 'atipamezole-5', drug: 'atipamezole', label: 'Atipamezole 5 mg/mL', mgPerMl: 5, confirm: true },
  { id: 'calcium-gluconate-10', drug: 'calcium gluconate', label: 'Calcium gluconate 10%', mgPerMl: 100, confirm: true },
];

export const FLUIDS = [
  { id: 'hartmanns', label: "Hartmann's (lactated Ringer's)", tonicity: 'isotonic replacement' },
  { id: 'nacl-0.9', label: '0.9% NaCl', tonicity: 'isotonic replacement' },
];

const byId = new Map(STOCK.map((s) => [s.id, s]));
export const stockById = (id) => byId.get(id);
export const stockForDrug = (drug) => STOCK.filter((s) => s.drug === drug);
