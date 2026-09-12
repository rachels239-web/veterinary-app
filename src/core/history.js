// Session history: a log of what was calculated, and a plain-text summary that
// can be pasted straight into a clinical record.
//
// Everything stays on this device. Nothing is sent anywhere.

const STORAGE_KEY = 'vetapp.history.v1';
const MAX_ENTRIES = 60;

const listeners = new Set();

function read() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function write(entries) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Storage unavailable — history is best-effort.
  }
  for (const fn of listeners) fn();
}

export let entries = read();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Record a calculation.
 * `lines` are the human-readable result lines; `inputs` is what was entered.
 */
export function record({ calculator, patient, inputs = {}, lines = [] }) {
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    at: new Date().toISOString(),
    calculator,
    patient: { ...patient },
    inputs,
    lines,
  };
  entries = [entry, ...entries].slice(0, MAX_ENTRIES);
  write(entries);
  return entry;
}

export function remove(id) {
  entries = entries.filter((e) => e.id !== id);
  write(entries);
}

export function clear() {
  entries = [];
  write(entries);
}

const time = (iso) =>
  new Date(iso).toLocaleString(undefined, {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });

/** One entry as pasteable text. */
export function entryToText(entry) {
  const p = entry.patient;
  const head = [p.name, p.species === 'cat' ? 'Cat' : 'Dog', `${p.weightKg} kg`]
    .filter(Boolean)
    .join(' · ');
  const inputs = Object.entries(entry.inputs)
    .map(([k, v]) => `${k}: ${v}`)
    .join(', ');
  return [
    `${entry.calculator} — ${time(entry.at)}`,
    head,
    inputs ? `Entered: ${inputs}` : null,
    ...entry.lines.map((l) => `  ${l}`),
  ]
    .filter(Boolean)
    .join('\n');
}

/** The whole session as one pasteable block. */
export function sessionToText() {
  if (entries.length === 0) return 'No calculations recorded.';
  return [
    'VetApp calculation record',
    `Generated ${time(new Date().toISOString())}`,
    '',
    ...entries.slice().reverse().map(entryToText),
    '',
    'Calculated with VetApp. Figures are a clinical aid and should be checked before administration.',
  ].join('\n\n');
}
