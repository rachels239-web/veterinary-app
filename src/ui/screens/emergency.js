// RECOVER 2024 crash sheet, generated from the weight in the header bar.

import { h } from '../dom.js';
import { card, headline, result, resultGrid, issueList, explain, table, note, selectField } from '../components.js';
import { patient } from '../../core/state.js';
import { record } from '../../core/history.js';
import { roundVolume } from '../../core/format.js';
import { recoverSheet } from '../../calc/recover.js';
import { BLS_TARGETS, DEFIBRILLATION } from '../../data/recover2024.js';

const state = { defibType: 'biphasic' };
const r = (v) => roundVolume(v);

export default {
  id: 'emergency',
  label: 'CPR',
  title: 'CPR — RECOVER 2024',
  desc: 'Doses for this patient’s weight. High-dose adrenaline was removed in 2024; atropine is a single dose only.',
  render({ weightKg, species, rerender }) {
    const sheet = recoverSheet(weightKg, species);
    const defib = sheet.defibrillation[state.defibType];

    const lines = sheet.drugs.map((d) => {
      const vol = Number.isFinite(d.volumeMl) ? `${r(d.volumeMl)} mL` : '—';
      const range = d.volumeRangeMl ? ` (${r(d.volumeRangeMl[0])}–${r(d.volumeRangeMl[1])} mL)` : '';
      return `${d.name} ${d.doseText} = ${vol}${range}`;
    });

    return [
      card({
        title: 'Crash doses',
        subtitle: `${weightKg} kg ${species}. Volumes assume the concentrations listed — confirm against your trolley.`,
        badge: 'RECOVER 2024',
        actions: h('button.btn.btn-sm', {
          type: 'button',
          onclick: (e) => {
            record({ calculator: 'CPR doses (RECOVER 2024)', patient, inputs: {}, lines });
            e.target.textContent = 'Added ✓';
            setTimeout(() => { e.target.textContent = 'Add to record'; }, 1600);
          },
        }, 'Add to record'),
      },
        table({
          head: ['Drug', 'Draw', 'Dose', 'Concentration', 'When'],
          rows: sheet.drugs.map((d) => ({
            tone: d.id === 'adrenaline' ? 'good' : null,
            cells: [
              h('span', {}, d.name, d.verified ? null : h('span.pill.pill-out', { style: 'margin-left:6px' }, 'unverified')),
              h('strong', {},
                d.volumeRangeMl
                  ? `${r(d.volumeRangeMl[0])}–${r(d.volumeRangeMl[1])} mL`
                  : Number.isFinite(d.volumeMl) ? `${r(d.volumeMl)} mL` : '—',
              ),
              d.doseText,
              d.concentrationLabel || '—',
              h('span', { class: 'wrap' }, d.interval ?? d.indication),
            ],
          })),
        }),
        issueList([
          ...sheet.drugs.filter((d) => d.note).map((d) => ({ level: 'info', message: `${d.name}: ${d.note}` })),
          ...sheet.drugs.flatMap((d) => d.issues),
          sheet.unverifiedDrugs.length
            ? { level: 'warn', message: `Not confirmed against the 2024 document: ${sheet.unverifiedDrugs.join(', ')}. These are conventional doses — check them before use.` }
            : null,
        ]),
        explain(sheet.drugs.flatMap((d) => d.steps)),
      ),

      card({ title: 'Defibrillation' },
        selectField({
          id: 'defib-type', label: 'Defibrillator', value: state.defibType,
          options: [{ value: 'biphasic', label: 'Biphasic' }, { value: 'monophasic', label: 'Monophasic' }],
          onChange: (v) => { state.defibType = v; rerender(); },
        }),
        resultGrid(
          result({
            label: 'External',
            text: `${r(defib.external.joules[0])}–${r(defib.external.joules[1])} J`,
            note: `${defib.external.perKg.join('–')} J/kg`,
            tone: 'good',
          }),
          result({
            label: 'Internal',
            text: `${r(defib.internal.joules[0])}–${r(defib.internal.joules[1])} J`,
            note: `${defib.internal.perKg.join('–')} J/kg`,
          }),
        ),
        issueList([{ level: 'info', message: DEFIBRILLATION.escalation }]),
        explain(sheet.defibrillation.steps),
      ),

      card({ title: 'Basic life support targets' },
        resultGrid(
          result({ label: 'Compressions', text: `${BLS_TARGETS.compressionRatePerMin.join('–')} / min` }),
          result({ label: 'Ventilation', text: `${BLS_TARGETS.ventilationRatePerMin} / min`, note: BLS_TARGETS.ventilationInterval }),
          result({ label: 'Cycle length', text: `${BLS_TARGETS.cycleMinutes} min`, note: 'Swap compressor each cycle' }),
          result({ label: 'ETCO₂ target', text: `≥ ${BLS_TARGETS.etco2TargetMmHg} mmHg`, tone: 'good' }),
        ),
        note(BLS_TARGETS.compressionDepth, '. ', BLS_TARGETS.note),
      ),

      note('Source: ', h('a', { href: sheet.source.url, target: '_blank', rel: 'noopener' }, sheet.source.name), `. ${sheet.source.citation}.`),
    ];
  },
};
