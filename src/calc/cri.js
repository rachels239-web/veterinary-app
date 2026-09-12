// CRI calculations: loading doses, syringe-pump mixes, fluid-bag mixes, and the
// delivered-dose table that shows what happens when the fluid rate changes.

import { criDrugById, doseFor } from '../data/cri-drugs.js';
import { protocolById } from '../data/cri-protocols.js';
import { stockById } from '../data/concentrations.js';
import { fromCanonicalRate } from '../core/units.js';
import { checkRange, dilutionAdvice, gatherIssues } from '../core/safety.js';
import { exact, roundVolume } from '../core/format.js';

export const SYRINGE_SIZES = [10, 30, 60];
export const BAG_SIZES = [500, 1000];

/** Format a canonical mg/kg/hr rate in a drug's display unit. */
export function displayRate(rateMgKgHr, unit) {
  return { value: fromCanonicalRate(rateMgKgHr, unit), unit };
}

/**
 * Expand a protocol id (or a list of single drug ids) into fully resolved
 * components, applying per-species defaults and any user overrides.
 */
export function resolveComponents(source, species, overrides = {}) {
  const protocol = typeof source === 'string' ? protocolById(source) : null;
  const specs = protocol
    ? protocol.components
    : (Array.isArray(source) ? source : [source]).map((d) =>
        typeof d === 'string' ? { drug: d } : d,
      );

  return specs.map((spec) => {
    const drug = criDrugById(spec.drug);
    if (!drug) throw new Error(`Unknown CRI drug: ${spec.drug}`);
    const speciesDose = doseFor(spec.drug, species) ?? {};
    const override = overrides[spec.drug] ?? {};
    const stock = stockById(override.stockId ?? drug.defaultStockId);

    // `load` may legitimately be null (no loading dose), so only fall back when
    // the key is absent rather than when it is explicitly null.
    const load = 'load' in override ? override.load
      : 'load' in spec ? spec.load
      : speciesDose.load ?? null;

    return {
      drugId: drug.id,
      name: drug.name,
      displayUnit: override.displayUnit ?? drug.displayUnit,
      rateMgKgHr: override.rate ?? spec.rate ?? speciesDose.rate,
      loadMgKg: load,
      optionalLoadMgKg: speciesDose.optionalLoad ?? null,
      range: speciesDose.range ?? null,
      loadRange: speciesDose.loadRange ?? null,
      mgPerMl: override.mgPerMl ?? stock?.mgPerMl,
      stockLabel: stock?.label ?? 'custom concentration',
      contraindicated: Boolean(speciesDose.contraindicated),
      contraindicationReason: speciesDose.contraindicationReason ?? null,
      confirm: Boolean(drug.confirm),
      notes: drug.notes,
    };
  });
}

/** Loading dose for one component. */
export function loadingDose(component, weightKg) {
  if (!Number.isFinite(component.loadMgKg) || component.loadMgKg === null) return null;
  const massMg = component.loadMgKg * weightKg;
  const volumeMl = massMg / component.mgPerMl;
  return {
    drugId: component.drugId,
    name: component.name,
    doseMgKg: component.loadMgKg,
    massMg,
    volumeMl,
    mgPerMl: component.mgPerMl,
    issues: gatherIssues(
      dilutionAdvice(volumeMl, component.mgPerMl),
      checkRange(component.loadMgKg, component.loadRange, {
        label: `${component.name} loading dose`,
        unit: 'mg/kg',
        format: (v) => exact(v),
      }),
    ),
    steps: [
      {
        label: `${component.name} loading dose`,
        words: 'loading dose (mg/kg) × body weight (kg) = mass to give (mg)',
        numbers: `${exact(component.loadMgKg)} mg/kg × ${exact(weightKg)} kg = ${exact(massMg)} mg`,
      },
      {
        label: 'Volume to draw',
        words: 'mass to give (mg) ÷ stock concentration (mg/mL) = volume (mL)',
        numbers: `${exact(massMg)} mg ÷ ${exact(component.mgPerMl)} mg/mL = ${exact(volumeMl)} mL`,
      },
    ],
  };
}

/**
 * Syringe-pump mix. The drug concentration is independent of the fluid rate, so
 * changing fluids later does not change the delivered dose.
 *
 * Drive it either by how long the syringe should last (`durationHr`) or by a
 * fixed pump rate (`pumpRateMlHr`); the other is derived.
 */
export function syringeCri({ components, weightKg, syringeMl, durationHr, pumpRateMlHr }) {
  const rate = Number.isFinite(pumpRateMlHr) ? pumpRateMlHr : syringeMl / durationHr;
  const hours = Number.isFinite(pumpRateMlHr) ? syringeMl / pumpRateMlHr : durationHr;

  const mixes = components.map((c) => {
    const mgPerHr = c.rateMgKgHr * weightKg;
    const totalMg = mgPerHr * hours;
    const stockVolumeMl = totalMg / c.mgPerMl;
    const finalMgPerMl = totalMg / syringeMl;
    return {
      ...c,
      mgPerHr,
      totalMg,
      stockVolumeMl,
      finalMgPerMl,
      issues: gatherIssues(
        c.contraindicated
          ? { level: 'error', message: `${c.name}: ${c.contraindicationReason}` }
          : null,
        checkRange(c.rateMgKgHr, c.range, {
          label: `${c.name} CRI`,
          unit: 'mg/kg/hr',
          format: (v) => exact(v),
        }),
        dilutionAdvice(stockVolumeMl, c.mgPerMl),
      ),
      steps: [
        {
          label: `${c.name} per hour`,
          words: 'CRI rate (mg/kg/hr) × body weight (kg) = drug needed each hour (mg/hr)',
          numbers: `${exact(c.rateMgKgHr)} mg/kg/hr × ${exact(weightKg)} kg = ${exact(mgPerHr)} mg/hr`,
        },
        {
          label: 'Drug for the whole syringe',
          words: 'drug each hour (mg/hr) × how long the syringe runs (hr) = total drug (mg)',
          numbers: `${exact(mgPerHr)} mg/hr × ${exact(hours)} hr = ${exact(totalMg)} mg`,
        },
        {
          label: 'Volume of stock to draw',
          words: 'total drug (mg) ÷ stock concentration (mg/mL) = volume to draw (mL)',
          numbers: `${exact(totalMg)} mg ÷ ${exact(c.mgPerMl)} mg/mL = ${exact(stockVolumeMl)} mL`,
        },
      ],
    };
  });

  const drugVolumeMl = mixes.reduce((sum, m) => sum + m.stockVolumeMl, 0);
  const diluentMl = syringeMl - drugVolumeMl;

  const issues = gatherIssues(
    mixes.flatMap((m) => m.issues),
    drugVolumeMl > syringeMl
      ? {
          level: 'error',
          message:
            `The drugs alone come to ${roundVolume(drugVolumeMl)} mL, which will not fit in a ${syringeMl} mL syringe. ` +
            `Run the pump faster, use a larger syringe, or shorten the interval between refills.`,
        }
      : null,
    diluentMl > 0 && diluentMl < syringeMl * 0.1
      ? {
          level: 'warn',
          message: `Only ${roundVolume(diluentMl)} mL of diluent — the mix is nearly neat drug. Check this is what you intend.`,
        }
      : null,
  );

  return {
    mode: 'syringe',
    syringeMl,
    pumpRateMlHr: rate,
    runsForHr: hours,
    drugVolumeMl,
    diluentMl,
    mixes,
    issues,
    steps: [
      {
        label: 'Pump rate',
        words: 'syringe volume (mL) ÷ how long it should last (hr) = pump rate (mL/hr)',
        numbers: `${exact(syringeMl)} mL ÷ ${exact(hours)} hr = ${exact(rate)} mL/hr`,
      },
    ],
  };
}

/**
 * Fluid-bag mix. The drug is carried by the fluids, so the delivered dose is
 * locked to the fluid rate the bag was designed for.
 *
 * Volumes assume an equal volume is withdrawn from the bag before adding drug,
 * so the final bag volume is `bagMl`. When `withdrawEqualVolume` is false the
 * bag ends up over-filled and the delivered dose is reported as actually lower —
 * no hidden compensation, the real number is shown.
 */
export function bagCri({ components, weightKg, bagMl, fluidRateMlHr, withdrawEqualVolume = true }) {
  const bagHours = bagMl / fluidRateMlHr;

  const mixes = components.map((c) => {
    const mgPerHr = c.rateMgKgHr * weightKg;
    const totalMg = mgPerHr * bagHours;
    const stockVolumeMl = totalMg / c.mgPerMl;
    return {
      ...c,
      mgPerHr,
      totalMg,
      stockVolumeMl,
      bagMgPerMl: totalMg / bagMl,
      issues: gatherIssues(
        c.contraindicated
          ? { level: 'error', message: `${c.name}: ${c.contraindicationReason}` }
          : null,
        checkRange(c.rateMgKgHr, c.range, {
          label: `${c.name} CRI`,
          unit: 'mg/kg/hr',
          format: (v) => exact(v),
        }),
        dilutionAdvice(stockVolumeMl, c.mgPerMl),
      ),
      steps: [
        {
          label: `${c.name} per hour`,
          words: 'CRI rate (mg/kg/hr) × body weight (kg) = drug needed each hour (mg/hr)',
          numbers: `${exact(c.rateMgKgHr)} mg/kg/hr × ${exact(weightKg)} kg = ${exact(mgPerHr)} mg/hr`,
        },
        {
          label: 'Drug for the whole bag',
          words: 'drug each hour (mg/hr) × how long the bag lasts (hr) = total drug for the bag (mg)',
          numbers: `${exact(mgPerHr)} mg/hr × ${exact(bagHours)} hr = ${exact(totalMg)} mg`,
        },
        {
          label: 'Volume to add to the bag',
          words: 'total drug (mg) ÷ stock concentration (mg/mL) = volume to add (mL)',
          numbers: `${exact(totalMg)} mg ÷ ${exact(c.mgPerMl)} mg/mL = ${exact(stockVolumeMl)} mL`,
        },
      ],
    };
  });

  const addedVolumeMl = mixes.reduce((sum, m) => sum + m.stockVolumeMl, 0);
  const finalVolumeMl = withdrawEqualVolume ? bagMl : bagMl + addedVolumeMl;
  // Over-filling the bag dilutes every drug by the same factor.
  const deliveryFactor = bagMl / finalVolumeMl;
  const dilutionErrorPct = (1 - deliveryFactor) * 100;

  const issues = gatherIssues(
    mixes.flatMap((m) => m.issues),
    !withdrawEqualVolume && dilutionErrorPct > 2
      ? {
          level: 'warn',
          message:
            `Adding ${roundVolume(addedVolumeMl)} mL to a full ${bagMl} mL bag without withdrawing first ` +
            `makes the final volume ${roundVolume(finalVolumeMl)} mL, so every drug is delivered about ` +
            `${dilutionErrorPct.toFixed(1)}% below the intended dose. Withdraw ${roundVolume(addedVolumeMl)} mL first to avoid this.`,
        }
      : null,
    addedVolumeMl > bagMl * 0.1
      ? {
          level: 'warn',
          message: `${roundVolume(addedVolumeMl)} mL of drug into a ${bagMl} mL bag is a large addition — withdrawing an equal volume first matters here.`,
        }
      : null,
  );

  return {
    mode: 'bag',
    bagMl,
    fluidRateMlHr,
    bagLastsHr: bagHours,
    addedVolumeMl,
    finalVolumeMl,
    withdrawEqualVolume,
    deliveryFactor,
    dilutionErrorPct,
    mixes,
    issues,
    steps: [
      {
        label: 'How long the bag lasts',
        words: 'bag volume (mL) ÷ fluid rate (mL/hr) = hours the bag runs (hr)',
        numbers: `${exact(bagMl)} mL ÷ ${exact(fluidRateMlHr)} mL/hr = ${exact(bagHours)} hr`,
      },
    ],
  };
}

/**
 * What the patient actually receives when the fluid rate changes.
 *
 * A bag mixed for a surgical rate of 100 mL/hr and then run at 40 mL/hr post-op
 * delivers 40% of the intended dose of every drug in it. This is the table that
 * makes that visible.
 */
export function deliveredDoseTable({ components, designRateMlHr, evaluateRates, weightKg }) {
  return evaluateRates.map((entry) => {
    const rate = typeof entry === 'number' ? entry : entry.rateMlHr;
    const label = typeof entry === 'number' ? `${rate} mL/hr` : entry.label;
    const factor = rate / designRateMlHr;
    const rows = components.map((c) => {
      const delivered = c.rateMgKgHr * factor;
      const issue = checkRange(delivered, c.range, {
        label: c.name,
        unit: 'mg/kg/hr',
        format: (v) => exact(v),
      });
      return {
        drugId: c.drugId,
        name: c.name,
        displayUnit: c.displayUnit,
        intendedMgKgHr: c.rateMgKgHr,
        deliveredMgKgHr: delivered,
        mgPerHr: delivered * weightKg,
        inRange: !issue,
        issue,
      };
    });
    return { label, rateMlHr: rate, factor, rows, anyOutOfRange: rows.some((r) => !r.inRange) };
  });
}
