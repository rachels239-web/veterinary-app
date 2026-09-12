// Converters and pump-rate arithmetic.

import { h } from '../dom.js';
import { card, fieldRow, numberField, selectField, headline, result, resultGrid, explain, note, table } from '../components.js';
import { roundVolume, exact } from '../../core/format.js';
import { CONVERTERS, criRateAllUnits, pumpRateToDose, doseToPumpRate } from '../../calc/converters.js';
import { CRI_UNIT_NAMES } from '../../core/units.js';
import { STOCK } from '../../data/concentrations.js';

const state = {
  convert: Object.fromEntries(CONVERTERS.map((c) => [c.id, 1])),
  criValue: 0.6,
  criUnit: 'mg/kg/hr',
  pumpDirection: 'rate-to-dose',
  mlPerHr: 5,
  mgPerKgPerHr: 0.6,
  mgPerMl: 100,
};

const r = (v) => roundVolume(v);

export default {
  id: 'tools',
  label: 'Converters',
  title: 'Converters & pump arithmetic',
  desc: 'Unit conversions, and working backwards from a pump rate to a dose.',
  render({ weightKg, rerender }) {
    return [
      card({ title: 'Unit converters' },
        CONVERTERS.map((c) =>
          h('div.stack',
            fieldRow(
              numberField({
                id: `conv-${c.id}`, label: c.label, unit: c.from,
                value: state.convert[c.id], step: 'any',
                onInput: (v) => { state.convert[c.id] = v ?? 0; rerender(); },
              }),
              result({ label: `= ${c.to}`, value: c.forward(state.convert[c.id] ?? 0), unit: c.to, tone: 'good' }),
            ),
            explain([{ label: c.label, words: `${c.from} to ${c.to}`, numbers: c.explain(state.convert[c.id] ?? 0), aside: c.aside }]),
          ),
        ),
      ),

      card({ title: 'CRI rate in every unit' },
        fieldRow(
          numberField({
            id: 'cri-val', label: 'Rate', value: state.criValue, step: 'any',
            onInput: (v) => { state.criValue = v ?? 0; rerender(); },
          }),
          selectField({
            id: 'cri-u', label: 'Unit', value: state.criUnit,
            options: CRI_UNIT_NAMES.map((u) => ({ value: u, label: u })),
            onChange: (v) => { state.criUnit = v; rerender(); },
          }),
        ),
        resultGrid(
          criRateAllUnits(state.criValue, state.criUnit)
            .filter((u) => !u.isSource)
            .map((u) => result({ label: u.unit, value: u.value, unit: '' })),
        ),
        note('10 µg/kg/min and 0.6 mg/kg/hr are the same rate — a common source of decimal errors.'),
      ),

      card({
        title: 'Pump rate ↔ dose',
        subtitle: 'What is this pump actually delivering, or what rate do I need?',
      },
        selectField({
          id: 'pump-dir', label: 'Direction', value: state.pumpDirection,
          options: [
            { value: 'rate-to-dose', label: 'I have a pump rate — what dose is that?' },
            { value: 'dose-to-rate', label: 'I want a dose — what pump rate?' },
          ],
          onChange: (v) => { state.pumpDirection = v; rerender(); },
        }),
        fieldRow(
          state.pumpDirection === 'rate-to-dose'
            ? numberField({ id: 'p-rate', label: 'Pump rate', unit: 'mL/hr', value: state.mlPerHr, step: '0.1', onInput: (v) => { state.mlPerHr = v ?? 0; rerender(); } })
            : numberField({ id: 'p-dose', label: 'Target dose', unit: 'mg/kg/hr', value: state.mgPerKgPerHr, step: 'any', onInput: (v) => { state.mgPerKgPerHr = v ?? 0; rerender(); } }),
          numberField({ id: 'p-conc', label: 'Concentration', unit: 'mg/mL', value: state.mgPerMl, step: 'any', onInput: (v) => { state.mgPerMl = v ?? 1; rerender(); } }),
          selectField({
            id: 'p-stock', label: 'Or pick a stock product', value: '',
            options: [{ value: '', label: 'Choose…' }, ...STOCK.map((s) => ({ value: s.id, label: s.label }))],
            onChange: (v) => {
              const s = STOCK.find((x) => x.id === v);
              if (s) { state.mgPerMl = s.mgPerMl; rerender(); }
            },
          }),
        ),
        (() => {
          if (state.pumpDirection === 'rate-to-dose') {
            const out = pumpRateToDose({ mlPerHr: state.mlPerHr, mgPerMl: state.mgPerMl, weightKg });
            return [
              headline({ label: 'Delivered dose', value: out.mgPerKgPerHr, unit: 'mg/kg/hr', sub: `${r(out.mgPerHr)} mg/hr for a ${weightKg} kg patient` }),
              explain(out.steps),
            ];
          }
          const out = doseToPumpRate({ mgPerKgPerHr: state.mgPerKgPerHr, mgPerMl: state.mgPerMl, weightKg });
          return [
            headline({ label: 'Set the pump to', value: out.mlPerHr, unit: 'mL/hr' }),
            explain(out.steps),
          ];
        })(),
      ),

      card({ title: 'Stock concentrations', subtitle: 'What the app assumes you have. Edit src/data/concentrations.js to change them.' },
        table({
          head: ['Product', 'mg/mL', ''],
          rows: STOCK.map((s) => ({
            cells: [s.label, exact(s.mgPerMl), s.confirm ? h('span.pill.pill-out', 'confirm') : (s.note ?? '')],
          })),
        }),
      ),
    ];
  },
};
