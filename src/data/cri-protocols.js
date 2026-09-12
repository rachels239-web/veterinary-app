// Multi-agent CRI protocols.
//
// A protocol is just a list of component drugs with the rate to use. Omitting
// `load` or `rate` falls back to the drug's own default for the species.
//
// ADDING A PROTOCOL: copy a block, give it a unique `id`, list the species it is
// licensed for in your hands, and name the components. It appears in the picker
// immediately and inherits all the bag/syringe and rate-change machinery.

export const CRI_PROTOCOLS = [
  {
    id: 'mlk',
    name: 'MLK',
    longName: 'Methadone + Lidocaine + Ketamine',
    species: ['dog'],
    components: [
      { drug: 'methadone', load: 0.2, rate: 0.1 },
      { drug: 'lidocaine', load: null, rate: 3 },
      { drug: 'ketamine', load: 1, rate: 0.6 },
    ],
    provenance: 'House protocol',
    notes:
      'Canine only — lidocaine is omitted in cats. All three agents sit at the top of their analgesic ranges, which suits intra-operative use; consider reducing ketamine and lidocaine post-operatively.',
  },
  {
    id: 'mk',
    name: 'MK',
    longName: 'Methadone + Ketamine (feline)',
    species: ['cat'],
    components: [
      { drug: 'methadone', load: 0.1, rate: 0.1 },
      { drug: 'ketamine', load: 0.5, rate: 0.6 },
    ],
    provenance: 'House protocol',
    notes: 'The feline equivalent of MLK, with lidocaine deliberately omitted.',
  },
  {
    id: 'flk',
    name: 'FLK',
    longName: 'Fentanyl + Lidocaine + Ketamine',
    species: ['dog'],
    components: [
      { drug: 'fentanyl', load: 0.003, rate: 0.005 },
      { drug: 'lidocaine', load: null, rate: 3 },
      { drug: 'ketamine', load: 1, rate: 0.6 },
    ],
    provenance: 'Conventional ranges — CONFIRM before clinical use',
    confirm: true,
    notes:
      'Fentanyl-based alternative to MLK where a more titratable, shorter-acting opioid is wanted. Canine only.',
  },
  {
    id: 'fk',
    name: 'FK',
    longName: 'Fentanyl + Ketamine (feline)',
    species: ['cat'],
    components: [
      { drug: 'fentanyl', load: 0.002, rate: 0.003 },
      { drug: 'ketamine', load: 0.5, rate: 0.6 },
    ],
    provenance: 'Conventional ranges — CONFIRM before clinical use',
    confirm: true,
    notes: 'Feline FLK with lidocaine omitted.',
  },
];

const byId = new Map(CRI_PROTOCOLS.map((p) => [p.id, p]));
export const protocolById = (id) => byId.get(id);
export const protocolsForSpecies = (species) =>
  CRI_PROTOCOLS.filter((p) => p.species.includes(species));
