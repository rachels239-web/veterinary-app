// Patient state, shared by every calculator.
//
// Species and weight are entered once in the header bar and flow into every
// screen, so a weight is never re-typed (and so never mistyped twice).

const STORAGE_KEY = 'vetapp.patient.v1';
const PREFS_KEY = 'vetapp.prefs.v1';

const listeners = new Set();

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : { ...fallback };
  } catch {
    // Private browsing, blocked storage, or corrupt JSON — carry on with defaults.
    return { ...fallback };
  }
}

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable; state still works for this session.
  }
}

export const patient = load(STORAGE_KEY, {
  species: 'dog',
  weightKg: null,
  name: '',
  paediatric: false,
});

export const prefs = load(PREFS_KEY, {
  theme: 'system',
  criUnit: null, // null = use each drug's own default unit
  maintenanceMethod: 'allometric',
});

export function setPatient(patch) {
  Object.assign(patient, patch);
  save(STORAGE_KEY, patient);
  emit();
}

export function setPrefs(patch) {
  Object.assign(prefs, patch);
  save(PREFS_KEY, prefs);
  emit();
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  for (const fn of listeners) fn();
}

/** True when there is enough patient detail to calculate anything. */
export function hasPatient() {
  return Number.isFinite(patient.weightKg) && patient.weightKg > 0;
}

export function patientLabel() {
  const parts = [];
  if (patient.name) parts.push(patient.name);
  parts.push(patient.species === 'cat' ? 'Cat' : 'Dog');
  if (hasPatient()) parts.push(`${patient.weightKg} kg`);
  return parts.join(' · ');
}
