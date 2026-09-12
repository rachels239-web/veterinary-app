// App shell: patient bar, navigation, and screen rendering.

import { h, clear, $ } from './dom.js';
import { numberField, segmented, card } from './components.js';
import { patient, prefs, setPatient, setPrefs, hasPatient } from '../core/state.js';
import { checkWeight } from '../core/safety.js';
import { issueList } from './components.js';
import * as history from '../core/history.js';

import fluids from './screens/fluids.js';
import cri from './screens/cri.js';
import emergency from './screens/emergency.js';
import nutrition from './screens/nutrition.js';
import tools from './screens/tools.js';
import record from './screens/history.js';

const SCREENS = [fluids, cri, emergency, nutrition, tools, record];

let activeId = SCREENS[0].id;

/* ---------- theme ---------- */

function applyTheme() {
  const root = document.documentElement;
  if (prefs.theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', prefs.theme);
}

function cycleTheme() {
  const order = ['system', 'light', 'dark'];
  const next = order[(order.indexOf(prefs.theme) + 1) % order.length];
  setPrefs({ theme: next });
  applyTheme();
}

const THEME_ICON = { system: '◐', light: '☀', dark: '☾' };

/* ---------- routing ---------- */

function readHash() {
  const id = location.hash.replace(/^#\/?/, '');
  if (SCREENS.some((s) => s.id === id)) activeId = id;
}

function go(id) {
  activeId = id;
  location.hash = `#/${id}`;
  render();
  document.querySelector('.main')?.scrollIntoView({ block: 'start', behavior: 'instant' });
}

/* ---------- shell pieces ---------- */

function topbar() {
  return h('header.topbar',
    h('div.topbar-inner',
      h('div.brand', h('span.brand-mark', '🐾'), 'VetApp'),
      h('button.icon-btn', {
        type: 'button',
        title: `Theme: ${prefs.theme}`,
        'aria-label': `Theme: ${prefs.theme}. Click to change.`,
        onclick: cycleTheme,
      }, THEME_ICON[prefs.theme]),
    ),
  );
}

function patientBar() {
  const weightIssue = hasPatient() ? checkWeight(patient.weightKg, patient.species) : null;
  return h('div.patient-bar',
    h('div.patient-inner',
      h('div.field.field-species',
        h('span.field-label', 'Species'),
        segmented({
          value: patient.species,
          options: [{ value: 'dog', label: 'Dog' }, { value: 'cat', label: 'Cat' }],
          onChange: (v) => { setPatient({ species: v }); render(); },
        }),
      ),
      h('div.field-weight',
        numberField({
          id: 'weight', label: 'Weight', unit: 'kg',
          value: patient.weightKg, step: '0.1', min: '0',
          placeholder: '—',
          onInput: (v) => { setPatient({ weightKg: v }); render(); },
        }),
      ),
      h('div.field-name',
        h('label.field', { for: 'pname' },
          h('span.field-label', 'Patient (optional)'),
          h('div.field-row',
            h('input.field-input', {
              type: 'text', id: 'pname', value: patient.name,
              placeholder: 'Name or case number',
              oninput: (e) => setPatient({ name: e.target.value }),
            }),
          ),
        ),
      ),
      !hasPatient() ? h('span.patient-missing', 'Enter a weight to start') : null,
    ),
    weightIssue ? h('div.patient-inner', { style: 'padding-top:0' }, issueList([weightIssue])) : null,
  );
}

function nav() {
  return h('nav.nav',
    h('div.nav-inner',
      SCREENS.map((s) =>
        h('button.nav-link', {
          type: 'button',
          class: s.id === activeId ? 'is-active' : '',
          onclick: () => go(s.id),
        },
          s.label,
          s.id === 'history'
            ? h('span.pill.pill-in', {
                dataset: { historyCount: '' },
                hidden: history.entries.length === 0,
                style: 'margin-left:6px',
              }, String(history.entries.length))
            : null,
        ),
      ),
    ),
  );
}

function disclaimer() {
  return h('p.disclaimer',
    'VetApp is a calculation aid for your own clinical use. Every figure should be checked before administration, ',
    'and clinical judgement always overrides a calculator. Nothing you enter leaves this device.',
  );
}

/* ---------- render ---------- */

function render() {
  const root = $('#app');
  if (!root) return;

  const screen = SCREENS.find((s) => s.id === activeId) ?? SCREENS[0];
  const needsPatient = screen.needsPatient !== false;

  const main = h('main.main',
    h('div.screen-head',
      h('h1.screen-title', screen.title),
      screen.desc ? h('p.screen-desc', screen.desc) : null,
    ),
  );

  if (needsPatient && !hasPatient()) {
    main.append(h('div.empty', 'Enter a body weight in the bar above and this screen will fill in.'));
  } else {
    const weightIssue = hasPatient() ? checkWeight(patient.weightKg, patient.species) : null;
    if (weightIssue?.level === 'error') {
      main.append(h('div.empty', 'Check the weight before calculating — it is outside the plausible range for this species.'));
    } else {
      const ctx = {
        weightKg: patient.weightKg,
        species: patient.species,
        rerender: render,
      };
      const content = [screen.render(ctx)].flat(Infinity).filter(Boolean);
      main.append(...content);
    }
  }

  main.append(disclaimer());

  clear(root);
  root.append(topbar(), patientBar(), nav(), main);
}

function updateHistoryBadge() {
  const badge = document.querySelector('[data-history-count]');
  if (!badge) return;
  badge.textContent = String(history.entries.length);
  badge.hidden = history.entries.length === 0;
}

/* ---------- boot ---------- */

export function boot() {
  applyTheme();
  readHash();
  window.addEventListener('hashchange', () => { readHash(); render(); });
  // Update only the nav badge when history changes. A full re-render here would
  // detach the "Add to record" button mid-click and swallow its confirmation.
  history.subscribe(updateHistoryBadge);
  render();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {
        // Offline support is a bonus, not a requirement.
      });
    });
  }
}
