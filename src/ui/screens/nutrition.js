// Energy requirements, transfusion volumes and body surface area.

import { h } from '../dom.js';
import { card, fieldRow, numberField, selectField, headline, result, resultGrid, issueList, explain, note } from '../components.js';
import { patient } from '../../core/state.js';
import { record } from '../../core/history.js';
import { roundVolume } from '../../core/format.js';
import { rer, mer, bodySurfaceArea, MER_FACTORS } from '../../calc/nutrition.js';
import { redCellTransfusion, plasmaTransfusion, transfusionRate, BLOOD_VOLUME } from '../../calc/transfusion.js';

const state = {
  factorId: 'hospitalised',
  kcalPerMl: null,
  mealsPerDay: 3,
  currentPcv: 15,
  targetPcv: 25,
  donorPcv: 40,
  product: 'whole',
  plasmaMlPerKg: 15,
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

export default {
  id: 'nutrition',
  label: 'Nutrition & blood',
  title: 'Nutrition, transfusion & body surface area',
  desc: 'Energy requirements, blood product volumes, and BSA for chemotherapy dosing.',
  render({ weightKg, species, rerender }) {
    const energy = mer(weightKg, species, state.factorId, {
      kcalPerMl: state.kcalPerMl ?? undefined,
      mealsPerDay: state.mealsPerDay,
    });
    const factors = MER_FACTORS[species];
    const blood = redCellTransfusion({
      weightKg, species,
      currentPcv: state.currentPcv, targetPcv: state.targetPcv,
      donorPcv: state.donorPcv, product: state.product,
    });
    const rate = transfusionRate({ volumeMl: blood.volumeMl, weightKg });
    const plasma = plasmaTransfusion({ weightKg, mlPerKg: state.plasmaMlPerKg });
    const bsa = bodySurfaceArea(weightKg, species);

    return [
      card({
        title: 'Energy requirement',
        actions: saveButton('Energy requirement', { stage: energy.factor.label }, [
          `RER ${Math.round(energy.rer.kcalPerDay)} kcal/day`,
          `Daily requirement ${Math.round(energy.kcalPerDay)} kcal/day (×${energy.factor.factor})`,
          ...(energy.mlPerDay ? [`Diet: ${r(energy.mlPerDay)} mL/day = ${r(energy.mlPerMeal)} mL over ${state.mealsPerDay} meals`] : []),
        ]),
      },
        fieldRow(
          selectField({
            id: 'mer-factor', label: 'Life stage', value: state.factorId,
            options: factors.map((f) => ({ value: f.id, label: `${f.label} (×${f.factor})` })),
            onChange: (v) => { state.factorId = v; rerender(); },
            hint: energy.factor.note,
          }),
          numberField({
            id: 'diet-density', label: 'Diet energy density', unit: 'kcal/mL',
            value: state.kcalPerMl, step: '0.05', min: '0.1', placeholder: 'optional',
            hint: 'Enter this to get a feeding volume.',
            onInput: (v) => { state.kcalPerMl = v; rerender(); },
          }),
          numberField({
            id: 'meals', label: 'Meals per day', value: state.mealsPerDay, step: '1', min: '1',
            onInput: (v) => { state.mealsPerDay = v ?? 3; rerender(); },
          }),
        ),
        headline({
          label: 'Daily energy requirement',
          value: energy.kcalPerDay, unit: 'kcal/day',
          sub: `RER ${Math.round(energy.rer.kcalPerDay)} kcal/day × ${energy.factor.factor}`,
        }),
        energy.mlPerDay
          ? resultGrid(
              result({ label: 'Volume per day', value: energy.mlPerDay, unit: 'mL' }),
              result({ label: `Per meal (${state.mealsPerDay} meals)`, value: energy.mlPerMeal, unit: 'mL', tone: 'good' }),
            )
          : null,
        issueList(energy.rer.issues),
        explain(energy.steps),
      ),

      card({
        title: 'Red cell transfusion',
        actions: saveButton('Red cell transfusion', { from: `${state.currentPcv}%`, to: `${state.targetPcv}%` }, [
          `${state.product === 'prbc' ? 'Packed red cells' : 'Whole blood'}: ${r(blood.volumeMl)} mL`,
          `Trial rate ${r(rate.trialRateMlHr)} mL in the first 15 min, then ${r(rate.mainRateMlHr)} mL/hr`,
        ]),
      },
        fieldRow(
          numberField({ id: 'pcv-now', label: 'Current PCV', unit: '%', value: state.currentPcv, step: '1', min: '1', max: '60', onInput: (v) => { state.currentPcv = v ?? 0; rerender(); } }),
          numberField({ id: 'pcv-target', label: 'Target PCV', unit: '%', value: state.targetPcv, step: '1', min: '1', max: '60', onInput: (v) => { state.targetPcv = v ?? 0; rerender(); } }),
          numberField({ id: 'pcv-donor', label: 'Donor PCV', unit: '%', value: state.donorPcv, step: '1', min: '10', max: '80', onInput: (v) => { state.donorPcv = v ?? 40; rerender(); } }),
          selectField({
            id: 'product', label: 'Product', value: state.product,
            options: [{ value: 'whole', label: 'Whole blood' }, { value: 'prbc', label: 'Packed red cells' }],
            onChange: (v) => { state.product = v; rerender(); },
          }),
        ),
        headline({
          label: 'Volume to transfuse',
          value: blood.volumeMl, unit: 'mL',
          sub: `Rule of thumb gives ${r(blood.ruleOfThumbMl)} mL · blood volume ${blood.bloodVolumeMlPerKg} mL/kg for a ${species}`,
        }),
        resultGrid(
          result({ label: 'First 15 min', value: rate.trialRateMlHr, unit: 'mL', note: 'Monitor TPR closely' }),
          result({ label: 'Then run at', value: rate.mainRateMlHr, unit: 'mL/hr', note: 'Complete within 4 hr', tone: 'good' }),
        ),
        issueList([...blood.issues, ...rate.issues]),
        explain([...blood.steps, ...rate.steps]),
      ),

      card({ title: 'Plasma', actions: saveButton('Plasma transfusion', { dose: `${state.plasmaMlPerKg} mL/kg` }, [`${r(plasma.volumeMl)} mL`]) },
        numberField({
          id: 'plasma-dose', label: 'Dose', unit: 'mL/kg',
          value: state.plasmaMlPerKg, step: '1', min: '1',
          hint: 'Usual range 10–20 mL/kg.',
          onInput: (v) => { state.plasmaMlPerKg = v ?? 15; rerender(); },
        }),
        headline({ label: 'Plasma volume', value: plasma.volumeMl, unit: 'mL', sub: `Range ${r(plasma.rangeMl[0])}–${r(plasma.rangeMl[1])} mL` }),
        issueList(plasma.issues),
        explain(plasma.steps),
      ),

      card({ title: 'Body surface area', subtitle: 'For chemotherapy and other BSA-based dosing.' },
        headline({ label: 'Body surface area', text: `${bsa.m2.toFixed(3)} m²`, sub: `Constant ${bsa.k} for a ${species}` }),
        explain(bsa.steps),
      ),
    ];
  },
};
