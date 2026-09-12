// Fluid therapy screen.

import { h } from '../dom.js';
import {
  card, fieldRow, numberField, selectField, segmented, checkboxField,
  headline, result, resultGrid, issueList, explain, table, note,
} from '../components.js';
import { patient, prefs, setPrefs } from '../../core/state.js';
import { record } from '../../core/history.js';
import { roundVolume, duration } from '../../core/format.js';
import {
  fluidPlan, resuscitationBolus, anaesthesiaRate, subcutaneousFluids,
  potassiumSupplementation, maintenanceComparison,
} from '../../calc/fluids.js';
import { DEHYDRATION_BANDS, ONGOING_LOSS_BANDS, REHYDRATION_HOURS, NORMAL_LOSSES, SOURCE } from '../../data/aaha.js';

const state = {
  percentDehydration: 0,
  replaceOverHr: REHYDRATION_HOURS.default,
  ongoingBandId: 'normal',
  bolusMlPerKg: null,
  scMlPerKg: null,
  kTargetMeqPerKgPerHr: 0.1,
  kFluidRateMlHr: null,
  kBagMl: 1000,
};

const r = (v) => roundVolume(v);

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

/* ---------- fluid plan ---------- */

function planCard(weightKg, species, rerender) {
  const plan = fluidPlan({
    weightKg, species,
    percentDehydration: state.percentDehydration,
    replaceOverHr: state.replaceOverHr,
    ongoingBandId: state.ongoingBandId,
    paediatric: patient.paediatric,
    method: prefs.maintenanceMethod,
  });

  const band = ONGOING_LOSS_BANDS.find((b) => b.id === state.ongoingBandId);
  const dehydrationBand = DEHYDRATION_BANDS.find((b) => b.percent === state.percentDehydration);
  const hasDeficit = state.percentDehydration > 0;

  const lines = [
    `Total rate: ${r(plan.totalMlPerHr)} mL/hr (${r(plan.mlPerKgPerHr)} mL/kg/hr)`,
    `Maintenance: ${r(plan.maintenance.mlPerHr)} mL/hr`,
    hasDeficit ? `Deficit: ${r(plan.deficit.deficitMl)} mL over ${state.replaceOverHr} hr = ${r(plan.deficit.mlPerHr)} mL/hr` : null,
    band.mlPerKgPerDay > 0 ? `Ongoing losses (${band.label}): ${r(plan.losses.mlPerHr)} mL/hr` : null,
    hasDeficit ? `After deficit replaced: ${r(plan.afterDeficitMlPerHr)} mL/hr` : null,
  ].filter(Boolean);

  return card({
    title: 'Fluid plan',
    subtitle: 'Maintenance plus deficit replacement plus ongoing losses.',
    actions: saveButton('Fluid plan', {
      dehydration: `${state.percentDehydration}%`,
      'replace over': `${state.replaceOverHr} hr`,
      losses: band.label,
    }, lines),
  },
    fieldRow(
      selectField({
        id: 'dehydration', label: 'Dehydration', value: String(state.percentDehydration),
        options: DEHYDRATION_BANDS.map((b) => ({ value: String(b.percent), label: b.label })),
        onChange: (v) => { state.percentDehydration = Number(v); rerender(); },
        hint: dehydrationBand?.signs,
      }),
      selectField({
        id: 'losses', label: 'Ongoing losses', value: state.ongoingBandId,
        options: ONGOING_LOSS_BANDS.map((b) => ({ value: b.id, label: `${b.label} — ${b.mlPerKgPerDay} mL/kg/day` })),
        onChange: (v) => { state.ongoingBandId = v; rerender(); },
        hint: band?.signs,
      }),
    ),
    h('div.field',
      h('span.field-label', 'Replace the deficit over'),
      segmented({
        value: state.replaceOverHr,
        options: REHYDRATION_HOURS.options.map((hr) => ({ value: hr, label: `${hr} hr` })),
        onChange: (v) => { state.replaceOverHr = v; rerender(); },
      }),
      h('span.field-hint', `AAHA recommends ${REHYDRATION_HOURS.range.join('–')} hr.`),
    ),
    headline({
      label: hasDeficit ? 'Total rate now' : 'Fluid rate',
      value: plan.totalMlPerHr, unit: 'mL/hr',
      // Only mention the step-down when there actually is one.
      sub: hasDeficit
        ? `${r(plan.mlPerKgPerHr)} mL/kg/hr · steps down to ${r(plan.afterDeficitMlPerHr)} mL/hr after ${state.replaceOverHr} hr`
        : `${r(plan.mlPerKgPerHr)} mL/kg/hr`,
      tone: plan.mlPerKgPerHr > 10 ? 'warn' : 'primary',
    }),
    resultGrid(
      result({ label: 'Maintenance', value: plan.maintenance.mlPerHr, unit: 'mL/hr', note: `${r(plan.maintenance.mlPerDay)} mL/day` }),
      state.percentDehydration > 0
        ? result({ label: `Deficit over ${state.replaceOverHr} hr`, value: plan.deficit.mlPerHr, unit: 'mL/hr', note: `${r(plan.deficit.deficitMl)} mL total` })
        : null,
      band.mlPerKgPerDay > 0
        ? result({ label: 'Ongoing losses', value: plan.losses.mlPerHr, unit: 'mL/hr', note: `${r(plan.losses.mlPerDay)} mL/day` })
        : null,
      hasDeficit
        ? result({ label: 'Once rehydrated', value: plan.afterDeficitMlPerHr, unit: 'mL/hr', note: `${r(plan.afterDeficitMlPerKgPerHr)} mL/kg/hr` })
        : null,
    ),
    issueList(plan.issues),
    explain([
      ...plan.maintenance.steps,
      ...(state.percentDehydration > 0 ? plan.deficit.steps : []),
      ...(band.mlPerKgPerDay > 0 ? plan.losses.steps : []),
      ...plan.steps,
    ]),
    band.mlPerKgPerDay === 0
      ? note(NORMAL_LOSSES.note, ` Normal insensible loss is about ${NORMAL_LOSSES.insensibleMlPerKgPerDay} mL/kg/day and normal urine output ${NORMAL_LOSSES.urineMlPerKgPerHr.join('–')} mL/kg/hr.`)
      : null,
  );
}

/* ---------- maintenance method comparison ---------- */

function comparisonCard(weightKg, species, rerender) {
  const cmp = maintenanceComparison(weightKg, species, { paediatric: patient.paediatric });
  return card({
    title: 'Maintenance — the three published formulas',
    subtitle: 'These genuinely disagree. Pick the one your practice uses and stay consistent.',
    badge: cmp.spreadFactor > 1.3 ? `${cmp.spreadFactor.toFixed(2)}× spread` : null,
  },
    table({
      head: ['Formula', 'mL/day', 'mL/kg/day', 'mL/hr', ''],
      rows: cmp.methods.map((m) => ({
        tone: m.id === prefs.maintenanceMethod ? 'good' : null,
        cells: [
          m.label,
          r(m.mlPerDay),
          m.mlPerKgPerDay.toFixed(1),
          r(m.mlPerDay / 24),
          m.id === prefs.maintenanceMethod
            ? h('span.pill.pill-in', 'in use')
            : h('button.btn.btn-sm', {
                type: 'button',
                onclick: () => { setPrefs({ maintenanceMethod: m.id }); rerender(); },
              }, 'Use this'),
        ],
      })),
    }),
    issueList(cmp.issues),
    patient.species === 'dog' || patient.species === 'cat'
      ? checkboxField({
          id: 'paediatric', label: 'Paediatric patient',
          checked: patient.paediatric,
          hint: 'Applies the paediatric multiplier to the simple formula (×3 puppies, ×2.5 kittens).',
          onChange: (v) => { patient.paediatric = v; rerender(); },
        })
      : null,
  );
}

/* ---------- resuscitation ---------- */

function bolusCard(weightKg, species, rerender) {
  const bolus = resuscitationBolus(weightKg, species, { mlPerKg: state.bolusMlPerKg ?? undefined });
  const [lo, hi] = bolus.rangeMlPerKg;
  const lines = [
    `Bolus: ${r(bolus.volumeMl)} mL (${bolus.chosenMlPerKg} mL/kg) over ${bolus.overMinutes} min`,
    `Pump rate for the bolus: ${r(bolus.pumpRateMlHr)} mL/hr`,
  ];
  return card({
    title: 'Resuscitation bolus',
    subtitle: 'For hypovolaemia. Small boluses to a measured endpoint, repeated.',
    badge: 'AAHA 2024',
    actions: saveButton('Resuscitation bolus', { dose: `${bolus.chosenMlPerKg} mL/kg` }, lines),
  },
    h('div.field',
      h('span.field-label', `Bolus dose for a ${species}`),
      segmented({
        value: bolus.chosenMlPerKg,
        options: [
          { value: lo, label: `${lo} mL/kg` },
          ...(hi !== lo ? [{ value: hi, label: `${hi} mL/kg` }] : []),
        ],
        onChange: (v) => { state.bolusMlPerKg = v; rerender(); },
      }),
      h('span.field-hint', `AAHA range for a ${species}: ${lo}–${hi} mL/kg.`),
    ),
    headline({
      label: `Give over ${bolus.overMinutes} minutes`,
      value: bolus.volumeMl, unit: 'mL',
      sub: `Set the pump to ${r(bolus.pumpRateMlHr)} mL/hr for ${bolus.overMinutes} min · full range ${r(bolus.volumeRangeMl[0])}–${r(bolus.volumeRangeMl[1])} mL`,
    }),
    issueList([{ level: 'info', message: bolus.note }]),
    explain(bolus.steps),
    note('Much smaller than the historical 80–90 mL/kg "shock dose" — reassess perfusion between boluses rather than committing to a large volume up front.'),
  );
}

/* ---------- anaesthesia and subcutaneous ---------- */

function anaesthesiaCard(weightKg, species) {
  const a = anaesthesiaRate(weightKg, species);
  return card({
    title: 'Intra-operative rate',
    badge: 'AAHA 2024',
    actions: saveButton('Intra-operative fluid rate', {}, [`${r(a.mlPerHr)} mL/hr (${a.mlPerKgPerHr} mL/kg/hr)`]),
  },
    headline({ label: 'Anaesthesia rate', value: a.mlPerHr, unit: 'mL/hr', sub: `${a.mlPerKgPerHr} mL/kg/hr for a ${species}` }),
    issueList([{ level: 'info', message: a.note }]),
    explain(a.steps),
  );
}

function subcutCard(weightKg, rerender) {
  const sc = subcutaneousFluids(weightKg, { mlPerKg: state.scMlPerKg ?? undefined });
  return card({
    title: 'Subcutaneous fluids',
    badge: 'AAHA 2024',
    actions: saveButton('Subcutaneous fluids', {}, [`${r(sc.volumeMl)} mL over ${sc.sites} site(s)`]),
  },
    numberField({
      id: 'sc-dose', label: 'Dose', unit: 'mL/kg',
      value: state.scMlPerKg ?? 20, step: '1', min: '1',
      hint: 'Usual range 20–30 mL/kg, once or twice daily.',
      onInput: (v) => { state.scMlPerKg = v; rerender(); },
    }),
    headline({ label: 'Volume per dose', value: sc.volumeMl, unit: 'mL', sub: `Split over ${sc.sites} site${sc.sites === 1 ? '' : 's'} (max ${r(sc.maxPerSiteMl)} mL per site) · ${sc.timesDaily.join('–')} × daily` }),
    explain(sc.steps),
  );
}

/* ---------- potassium ---------- */

function potassiumCard(weightKg, rerender) {
  const fluidRate = state.kFluidRateMlHr
    ?? r(fluidPlan({ weightKg, species: patient.species, method: prefs.maintenanceMethod }).maintenance.mlPerHr);
  const k = potassiumSupplementation({
    weightKg,
    fluidRateMlHr: fluidRate,
    targetMeqPerKgPerHr: state.kTargetMeqPerKgPerHr,
    bagMl: state.kBagMl,
  });
  const lines = [
    `Target ${k.appliedMeqPerKgPerHr} mEq/kg/hr at ${fluidRate} mL/hr`,
    `Add ${r(k.meqPerBag)} mEq KCl to a ${k.bagMl} mL bag (= ${r(k.meqPerLitre)} mEq/L)`,
    `Bag lasts ${duration(k.bagLastsHr)}`,
  ];
  return card({
    title: 'Potassium supplementation',
    subtitle: 'Dose-driven: you set the mEq/kg/hr and this works out what the bag needs.',
    badge: 'Table 11 pending',
    actions: saveButton('Potassium supplementation', { target: `${state.kTargetMeqPerKgPerHr} mEq/kg/hr`, rate: `${fluidRate} mL/hr` }, lines),
  },
    fieldRow(
      numberField({
        id: 'k-target', label: 'Target potassium rate', unit: 'mEq/kg/hr',
        value: state.kTargetMeqPerKgPerHr, step: '0.05', min: '0', max: '0.5',
        hint: 'Absolute maximum 0.5 mEq/kg/hr.',
        onInput: (v) => { state.kTargetMeqPerKgPerHr = v ?? 0; rerender(); },
      }),
      numberField({
        id: 'k-rate', label: 'Fluid rate', unit: 'mL/hr',
        value: fluidRate, step: '1', min: '1',
        hint: 'Defaults to the maintenance rate above.',
        onInput: (v) => { state.kFluidRateMlHr = v; rerender(); },
      }),
      selectField({
        id: 'k-bag', label: 'Bag size', value: String(state.kBagMl),
        options: [{ value: '1000', label: '1 L' }, { value: '500', label: '500 mL' }],
        onChange: (v) => { state.kBagMl = Number(v); rerender(); },
      }),
    ),
    headline({
      label: `Add to a ${k.bagMl} mL bag`,
      value: k.meqPerBag, unit: 'mEq KCl',
      sub: `${r(k.meqPerLitre)} mEq/L · delivers ${r(k.meqPerHr)} mEq/hr · bag lasts ${duration(k.bagLastsHr)}`,
      tone: k.meqPerLitre > 60 ? 'warn' : 'primary',
    }),
    issueList(k.issues),
    explain(k.steps),
  );
}

/* ---------- screen ---------- */

export default {
  id: 'fluids',
  label: 'Fluids',
  title: 'Fluid therapy',
  desc: 'Following the 2024 AAHA Fluid Therapy Guidelines. Hartmann’s or 0.9% NaCl.',
  render(ctx) {
    const { weightKg, species, rerender } = ctx;
    return [
      planCard(weightKg, species, rerender),
      comparisonCard(weightKg, species, rerender),
      bolusCard(weightKg, species, rerender),
      anaesthesiaCard(weightKg, species),
      subcutCard(weightKg, rerender),
      potassiumCard(weightKg, rerender),
      note('Source: ', h('a', { href: SOURCE.url, target: '_blank', rel: 'noopener' }, SOURCE.name), `. ${SOURCE.citation}.`),
    ];
  },
};
