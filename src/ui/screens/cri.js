// CRI screen: loading doses, the mix, and what the patient actually receives
// when the fluid rate changes.

import { h } from '../dom.js';
import {
  card, fieldRow, numberField, selectField, segmented, checkboxField,
  headline, result, resultGrid, issueList, explain, table, note,
} from '../components.js';
import { patient } from '../../core/state.js';
import { record } from '../../core/history.js';
import { roundVolume, duration, exact } from '../../core/format.js';
import { fromCanonicalRate, CRI_UNIT_NAMES } from '../../core/units.js';
import {
  resolveComponents, syringeCri, bagCri, loadingDose, deliveredDoseTable,
  SYRINGE_SIZES, BAG_SIZES,
} from '../../calc/cri.js';
import { CRI_DRUGS } from '../../data/cri-drugs.js';
import { protocolsForSpecies, protocolById } from '../../data/cri-protocols.js';
import { ANAESTHESIA_RATE } from '../../data/aaha.js';

const state = {
  source: 'protocol',      // 'protocol' | 'single'
  protocolId: null,
  drugId: null,
  mode: 'syringe',         // 'syringe' | 'bag'
  syringeMl: 60,
  syringeHours: 6,
  syringeDriver: 'duration', // 'duration' | 'rate'
  pumpRateMlHr: 5,
  bagMl: 1000,
  surgicalMlPerKgPerHr: null,
  postopMlPerKgPerHr: 2,
  withdrawEqualVolume: true,
  includeLidocaineLoad: false,
  unitOverride: null,
};

const r = (v) => roundVolume(v);

/** Reset the selection when the species changes out from under it. */
function ensureSelection(species) {
  const protocols = protocolsForSpecies(species);
  if (state.source === 'protocol') {
    if (!protocols.some((p) => p.id === state.protocolId)) {
      state.protocolId = protocols[0]?.id ?? null;
    }
  }
  const drugs = CRI_DRUGS.filter((d) => d.species[species]);
  if (!drugs.some((d) => d.id === state.drugId)) state.drugId = drugs[0]?.id ?? null;
  if (state.surgicalMlPerKgPerHr === null) state.surgicalMlPerKgPerHr = ANAESTHESIA_RATE[species];
}

/** Components for the current selection, with the optional lidocaine load applied. */
function currentComponents(species) {
  const overrides = {};
  const base = state.source === 'protocol'
    ? resolveComponents(state.protocolId, species)
    : resolveComponents([state.drugId], species);

  return base.map((c) => {
    if (c.drugId === 'lidocaine' && state.includeLidocaineLoad && c.loadMgKg === null) {
      return { ...c, loadMgKg: c.optionalLoadMgKg };
    }
    return c;
  });
}

function rateText(component) {
  const unit = state.unitOverride ?? component.displayUnit;
  const v = fromCanonicalRate(component.rateMgKgHr, unit);
  return `${exact(v)} ${unit}`;
}

function saveButton(calculator, inputs, lines) {
  return h('button.btn.btn-sm', {
    type: 'button',
    onclick: (e) => {
      record({ calculator, patient, inputs, lines });
      e.target.textContent = 'Added ✓';
      setTimeout(() => { e.target.textContent = 'Add to record'; }, 1600);
    },
  }, 'Add to record');
}

/* ---------- selection ---------- */

function selectionCard(species, rerender) {
  const protocols = protocolsForSpecies(species);
  const drugs = CRI_DRUGS.filter((d) => d.species[species]);
  const protocol = state.source === 'protocol' ? protocolById(state.protocolId) : null;
  const hasLidocaine = currentComponents(species).some((c) => c.drugId === 'lidocaine');

  return card({ title: 'What are you running?' },
    segmented({
      value: state.source,
      options: [
        { value: 'protocol', label: 'Combination protocol' },
        { value: 'single', label: 'Single drug' },
      ],
      onChange: (v) => { state.source = v; rerender(); },
    }),
    state.source === 'protocol'
      ? (protocols.length === 0
          ? h('div.empty', `No combination protocols are defined for cats yet.`)
          : selectField({
              id: 'cri-protocol', label: 'Protocol', value: state.protocolId,
              options: protocols.map((p) => ({ value: p.id, label: `${p.name} — ${p.longName}` })),
              onChange: (v) => { state.protocolId = v; rerender(); },
              hint: protocol?.notes,
            }))
      : selectField({
          id: 'cri-drug', label: 'Drug', value: state.drugId,
          options: drugs.map((d) => ({ value: d.id, label: d.name })),
          onChange: (v) => { state.drugId = v; rerender(); },
          hint: CRI_DRUGS.find((d) => d.id === state.drugId)?.notes,
        }),
    hasLidocaine
      ? checkboxField({
          id: 'lido-load', label: 'Include a lidocaine loading dose',
          checked: state.includeLidocaineLoad,
          hint: 'Your protocol has no lidocaine load. Most MLK protocols give 1–2 mg/kg slowly IV over 2–5 min for a faster onset.',
          onChange: (v) => { state.includeLidocaineLoad = v; rerender(); },
        })
      : null,
    selectField({
      id: 'cri-unit', label: 'Show rates in',
      value: state.unitOverride ?? 'auto',
      options: [{ value: 'auto', label: 'Each drug’s usual unit' }, ...CRI_UNIT_NAMES.map((u) => ({ value: u, label: u }))],
      onChange: (v) => { state.unitOverride = v === 'auto' ? null : v; rerender(); },
    }),
    protocol?.confirm
      ? issueList([{ level: 'warn', message: `${protocol.name}: ${protocol.provenance}. Check the rates against your own protocol before use.` }])
      : null,
  );
}

/* ---------- loading doses ---------- */

function loadingCard(components, weightKg) {
  const doses = components.map((c) => loadingDose(c, weightKg)).filter(Boolean);
  if (doses.length === 0) {
    return card({ title: 'Loading doses' },
      h('div.empty', 'No loading doses in this protocol.'),
    );
  }
  const lines = doses.map((d) => `${d.name} load ${d.doseMgKg} mg/kg = ${r(d.massMg)} mg = ${r(d.volumeMl)} mL`);
  return card({
    title: 'Loading doses',
    subtitle: 'Give slowly IV before starting the infusion.',
    actions: saveButton('CRI loading doses', {}, lines),
  },
    resultGrid(doses.map((d) =>
      result({
        label: `${d.name} · ${d.doseMgKg} mg/kg`,
        value: d.volumeMl, unit: 'mL',
        note: `${r(d.massMg)} mg from ${d.mgPerMl} mg/mL`,
        tone: d.issues.some((i) => i.level === 'info') ? 'warn' : 'normal',
      }),
    )),
    issueList(doses.flatMap((d) => d.issues)),
    explain(doses.flatMap((d) => d.steps)),
  );
}

/* ---------- syringe mode ---------- */

function syringeCard(components, weightKg, rerender) {
  const mix = syringeCri({
    components, weightKg,
    syringeMl: state.syringeMl,
    durationHr: state.syringeDriver === 'duration' ? state.syringeHours : undefined,
    pumpRateMlHr: state.syringeDriver === 'rate' ? state.pumpRateMlHr : undefined,
  });

  const lines = [
    `${state.syringeMl} mL syringe at ${r(mix.pumpRateMlHr)} mL/hr, runs ${duration(mix.runsForHr)}`,
    ...mix.mixes.map((m) => `${m.name}: ${r(m.stockVolumeMl)} mL (${r(m.totalMg)} mg) — delivers ${rateText(m)}`),
    `Diluent: ${r(mix.diluentMl)} mL`,
  ];

  return card({
    title: 'Syringe pump mix',
    subtitle: 'The drug concentration is independent of the fluid rate, so changing fluids later does not change the dose.',
    badge: 'Recommended',
    actions: saveButton('CRI — syringe pump', { syringe: `${state.syringeMl} mL`, rate: `${r(mix.pumpRateMlHr)} mL/hr` }, lines),
  },
    fieldRow(
      selectField({
        id: 'syringe-size', label: 'Syringe', value: String(state.syringeMl),
        options: SYRINGE_SIZES.map((s) => ({ value: String(s), label: `${s} mL` })),
        onChange: (v) => { state.syringeMl = Number(v); rerender(); },
      }),
      h('div.field',
        h('span.field-label', 'Set by'),
        segmented({
          value: state.syringeDriver,
          options: [{ value: 'duration', label: 'How long it lasts' }, { value: 'rate', label: 'Pump rate' }],
          onChange: (v) => { state.syringeDriver = v; rerender(); },
        }),
      ),
      state.syringeDriver === 'duration'
        ? numberField({
            id: 'syringe-hours', label: 'Make it last', unit: 'hr',
            value: state.syringeHours, step: '0.5', min: '0.5',
            onInput: (v) => { state.syringeHours = v ?? 6; rerender(); },
          })
        : numberField({
            id: 'pump-rate', label: 'Pump rate', unit: 'mL/hr',
            value: state.pumpRateMlHr, step: '0.1', min: '0.1',
            onInput: (v) => { state.pumpRateMlHr = v ?? 5; rerender(); },
          }),
    ),
    headline({
      label: 'Set the pump to',
      value: mix.pumpRateMlHr, unit: 'mL/hr',
      sub: `${state.syringeMl} mL syringe runs for ${duration(mix.runsForHr)}`,
    }),
    h('p.subhead', 'Make up the syringe'),
    table({
      head: ['Drug', 'Draw', 'Total drug', 'Final conc.', 'Delivers'],
      rows: mix.mixes.map((m) => ({
        tone: m.contraindicated ? 'danger' : null,
        cells: [
          m.name,
          `${r(m.stockVolumeMl)} mL`,
          `${r(m.totalMg)} mg`,
          `${r(m.finalMgPerMl)} mg/mL`,
          rateText(m),
        ],
      })).concat([{
        cells: ['Diluent (0.9% NaCl)', `${r(mix.diluentMl)} mL`, '—', '—', `to ${state.syringeMl} mL total`],
      }]),
    }),
    issueList(mix.issues),
    explain([...mix.steps, ...mix.mixes.flatMap((m) => m.steps)]),
  );
}

/* ---------- bag mode ---------- */

function bagCard(components, weightKg, species, rerender) {
  const surgicalRate = state.surgicalMlPerKgPerHr * weightKg;
  const postopRate = state.postopMlPerKgPerHr * weightKg;

  const mix = bagCri({
    components, weightKg,
    bagMl: state.bagMl,
    fluidRateMlHr: surgicalRate,
    withdrawEqualVolume: state.withdrawEqualVolume,
  });

  const rates = deliveredDoseTable({
    components, weightKg,
    designRateMlHr: surgicalRate,
    evaluateRates: [
      { label: `Surgical — ${state.surgicalMlPerKgPerHr} mL/kg/hr`, rateMlHr: surgicalRate },
      { label: `Post-op — ${state.postopMlPerKgPerHr} mL/kg/hr`, rateMlHr: postopRate },
    ],
  });

  const postop = rates[1];

  const lines = [
    `${state.bagMl} mL bag at ${r(surgicalRate)} mL/hr (${state.surgicalMlPerKgPerHr} mL/kg/hr), lasts ${duration(mix.bagLastsHr)}`,
    ...mix.mixes.map((m) => `${m.name}: add ${r(m.stockVolumeMl)} mL (${r(m.totalMg)} mg)`),
    state.withdrawEqualVolume ? `Withdraw ${r(mix.addedVolumeMl)} mL from the bag first` : `Final bag volume ${r(mix.finalVolumeMl)} mL`,
    `At the post-op rate of ${r(postopRate)} mL/hr the bag delivers ${(postop.factor * 100).toFixed(0)}% of the intended dose`,
  ];

  return card({
    title: 'Fluid bag mix',
    subtitle: 'The drug is carried by the fluids, so the dose is locked to the fluid rate the bag was mixed for.',
    actions: saveButton('CRI — fluid bag', { bag: `${state.bagMl} mL`, rate: `${r(surgicalRate)} mL/hr` }, lines),
  },
    fieldRow(
      selectField({
        id: 'bag-size', label: 'Bag', value: String(state.bagMl),
        options: BAG_SIZES.map((b) => ({ value: String(b), label: b === 1000 ? '1 L' : `${b} mL` })),
        onChange: (v) => { state.bagMl = Number(v); rerender(); },
      }),
      numberField({
        id: 'surgical-rate', label: 'Surgical fluid rate', unit: 'mL/kg/hr',
        value: state.surgicalMlPerKgPerHr, step: '0.5', min: '0.5',
        hint: `${r(surgicalRate)} mL/hr · AAHA anaesthesia rate for a ${species} is ${ANAESTHESIA_RATE[species]}`,
        onInput: (v) => { state.surgicalMlPerKgPerHr = v ?? ANAESTHESIA_RATE[species]; rerender(); },
      }),
      numberField({
        id: 'postop-rate', label: 'Post-op fluid rate', unit: 'mL/kg/hr',
        value: state.postopMlPerKgPerHr, step: '0.5', min: '0',
        hint: `${r(postopRate)} mL/hr`,
        onInput: (v) => { state.postopMlPerKgPerHr = v ?? 2; rerender(); },
      }),
    ),
    checkboxField({
      id: 'withdraw', label: 'Withdraw an equal volume from the bag first',
      checked: state.withdrawEqualVolume,
      hint: 'Keeps the final volume at the bag size so the concentration is exact.',
      onChange: (v) => { state.withdrawEqualVolume = v; rerender(); },
    }),
    headline({
      label: `Run the bag at`,
      value: surgicalRate, unit: 'mL/hr',
      sub: `${state.bagMl} mL lasts ${duration(mix.bagLastsHr)} · total ${r(mix.addedVolumeMl)} mL of drug added`,
    }),
    h('p.subhead', 'Add to the bag'),
    table({
      head: ['Drug', 'Add', 'Total drug', 'Conc. in bag'],
      rows: mix.mixes.map((m) => ({
        tone: m.contraindicated ? 'danger' : null,
        cells: [m.name, `${r(m.stockVolumeMl)} mL`, `${r(m.totalMg)} mg`, `${r(m.bagMgPerMl)} mg/mL`],
      })),
    }),
    issueList(mix.issues),

    h('p.subhead', 'What the patient actually gets when the rate changes'),
    table({
      caption: 'A bag mixed for the surgical rate delivers proportionally less of every drug once you slow the fluids down.',
      head: ['Drug', ...rates.map((entry) => `${entry.label.split(' — ')[0]} (${(entry.factor * 100).toFixed(0)}%)`)],
      rows: mix.mixes.map((m, i) => ({
        tone: rates.some((entry) => !entry.rows[i].inRange) ? 'warn' : null,
        cells: [
          m.name,
          ...rates.map((entry) => {
            const row = entry.rows[i];
            const unit = state.unitOverride ?? row.displayUnit;
            return h('span', {},
              h('span', `${exact(fromCanonicalRate(row.deliveredMgKgHr, unit))} `),
              h('span.pill', { class: row.inRange ? 'pill-in' : 'pill-out' }, row.inRange ? 'in' : 'out'),
            );
          }),
        ],
      })),
    }),
    note(
      rates.map((entry) => `${entry.label} = ${r(entry.rateMlHr)} mL/hr`).join(' · '),
      `. Rates are ${state.unitOverride ?? 'in each drug’s usual unit'}, per kilogram per hour.`,
    ),
    postop.anyOutOfRange
      ? issueList([{
          level: 'warn',
          message:
            `At ${state.postopMlPerKgPerHr} mL/kg/hr this bag delivers only ${(postop.factor * 100).toFixed(0)}% of the intended dose, ` +
            `putting ${postop.rows.filter((row) => !row.inRange).map((row) => row.name).join(' and ')} outside the analgesic range. ` +
            `Either mix a second bag for the post-op rate, or move the CRI onto a syringe pump so it is independent of the fluids.`,
        }])
      : null,
    explain([...mix.steps, ...mix.mixes.flatMap((m) => m.steps)]),
  );
}

/* ---------- screen ---------- */

export default {
  id: 'cri',
  label: 'CRIs',
  title: 'Constant rate infusions',
  desc: 'Loading doses, the mix, and what the patient receives if the fluid rate changes.',
  render(ctx) {
    const { weightKg, species, rerender } = ctx;
    ensureSelection(species);
    const components = currentComponents(species);

    return [
      selectionCard(species, rerender),
      components.length === 0
        ? h('div.empty', 'Nothing selected.')
        : [
            loadingCard(components, weightKg),
            card({ title: 'How are you delivering it?' },
              segmented({
                value: state.mode,
                options: [
                  { value: 'syringe', label: 'Syringe pump' },
                  { value: 'bag', label: 'Fluid bag' },
                ],
                onChange: (v) => { state.mode = v; rerender(); },
              }),
              note(state.mode === 'syringe'
                ? 'The CRI runs on its own pump. Changing the fluid rate has no effect on the dose.'
                : 'The drugs go into the fluid bag. The dose is tied to the fluid rate — see the table at the bottom.'),
            ),
            state.mode === 'syringe'
              ? syringeCard(components, weightKg, rerender)
              : bagCard(components, weightKg, species, rerender),
          ],
    ];
  },
};
