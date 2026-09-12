// Shared UI pieces: input fields, result cards, warning banners and the
// "show the calculation" panel.

import { h, clear } from './dom.js';
import { fmt, exact as exactText, trim } from '../core/format.js';

/* ---------- inputs ---------- */

export function numberField({ id, label, value, unit, step = 'any', min, max, hint, onInput, placeholder, disabled }) {
  const input = h('input.field-input', {
    type: 'number', id, step, min, max, disabled,
    value: value ?? '',
    placeholder: placeholder ?? '',
    inputmode: 'decimal',
    oninput: (e) => {
      const raw = e.target.value;
      onInput(raw === '' ? null : Number(raw));
    },
  });
  return h('label.field', { for: id },
    h('span.field-label', label),
    h('div.field-row', input, unit ? h('span.field-unit', unit) : null),
    hint ? h('span.field-hint', hint) : null,
  );
}

export function segmented({ label, value, options, onChange, hint }) {
  const group = h('div.segmented', { role: 'radiogroup' },
    options.map((opt) =>
      h('button.segment', {
        type: 'button',
        class: opt.value === value ? 'is-active' : '',
        role: 'radio',
        'aria-checked': opt.value === value ? 'true' : 'false',
        onclick: () => onChange(opt.value),
      }, opt.label),
    ),
  );
  if (!label) return group;
  return h('div.field',
    h('span.field-label', label),
    group,
    hint ? h('span.field-hint', hint) : null,
  );
}

export function selectField({ id, label, value, options, onChange, hint }) {
  const select = h('select.field-input', {
    id,
    onchange: (e) => onChange(e.target.value),
  }, options.map((opt) =>
    h('option', { value: opt.value, selected: opt.value === value }, opt.label),
  ));
  return h('label.field', { for: id },
    h('span.field-label', label),
    h('div.field-row', select),
    hint ? h('span.field-hint', hint) : null,
  );
}

export function checkboxField({ id, label, checked, onChange, hint }) {
  return h('label.check', { for: id },
    h('input', {
      type: 'checkbox', id, checked,
      onchange: (e) => onChange(e.target.checked),
    }),
    h('span.check-body',
      h('span.check-label', label),
      hint ? h('span.field-hint', hint) : null,
    ),
  );
}

/* ---------- results ---------- */

/**
 * A single result. `kind` picks the rounding rule ('volume' or 'mass').
 * The unrounded figure is shown underneath whenever rounding changed it.
 */
export function result({ label, value, unit, kind = 'volume', tone = 'normal', note, text }) {
  const f = Number.isFinite(value) ? fmt(value, unit, kind) : null;
  return h(`div.result.tone-${tone}`,
    h('span.result-label', label),
    h('span.result-value', text ?? (f ? f.text : '—')),
    f?.showExact ? h('span.result-exact', `exactly ${f.exact}`) : null,
    note ? h('span.result-note', note) : null,
  );
}

export function resultGrid(...results) {
  return h('div.result-grid', results.flat(Infinity).filter(Boolean));
}

/** Headline figure — the one number the user came for. */
export function headline({ label, value, unit, kind = 'volume', sub, tone = 'primary', text }) {
  const f = Number.isFinite(value) ? fmt(value, unit, kind) : null;
  return h(`div.headline.tone-${tone}`,
    h('span.headline-label', label),
    h('span.headline-value', text ?? (f ? f.text : '—')),
    f?.showExact ? h('span.headline-exact', `exactly ${f.exact}`) : null,
    sub ? h('span.headline-sub', sub) : null,
  );
}

/* ---------- warnings ---------- */

const TONE_LABEL = { error: 'Stop', warn: 'Check', info: 'Note' };

export function issueList(issues) {
  const list = (issues ?? []).filter(Boolean);
  if (list.length === 0) return null;
  return h('div.issues',
    list.map((issue) =>
      h(`div.issue.issue-${issue.level}`,
        h('span.issue-tag', TONE_LABEL[issue.level] ?? 'Note'),
        h('span.issue-text', issue.message),
      ),
    ),
  );
}

/* ---------- the calculation panel ---------- */

/**
 * The expandable working.
 *
 * Each step shows the formula in words first, then the same formula with this
 * patient's numbers substituted in, so it is obvious what went where.
 */
export function explain(steps, { title = 'Show the calculation', open = false } = {}) {
  const list = (steps ?? []).flat(Infinity).filter(Boolean);
  if (list.length === 0) return null;
  return h('details.explain', { open },
    h('summary.explain-summary', title),
    h('div.explain-body',
      list.map((step) =>
        h('div.step',
          step.label ? h('div.step-label', step.label) : null,
          h('div.step-words', step.words),
          h('div.step-numbers', step.numbers),
          step.aside ? h('div.step-aside', step.aside) : null,
        ),
      ),
    ),
  );
}

/* ---------- layout ---------- */

export function card({ title, subtitle, badge, actions }, ...children) {
  return h('section.card',
    title || badge
      ? h('div.card-head',
          h('div.card-titles',
            title ? h('h2.card-title', title) : null,
            subtitle ? h('p.card-subtitle', subtitle) : null,
          ),
          badge ? h('span.badge', badge) : null,
          actions ? h('div.card-actions', actions) : null,
        )
      : null,
    h('div.card-body', children),
  );
}

export function fieldRow(...fields) {
  return h('div.field-grid', fields.flat(Infinity).filter(Boolean));
}

export function table({ head, rows, caption }) {
  return h('div.table-wrap',
    caption ? h('p.table-caption', caption) : null,
    h('table.table',
      h('thead', h('tr', head.map((cell) => h('th', cell)))),
      h('tbody', rows.map((row) =>
        h('tr', { class: row.tone ? `row-${row.tone}` : '' },
          (row.cells ?? row).map((cell) =>
            h('td', cell instanceof Node ? cell : String(cell)),
          ),
        ),
      )),
    ),
  );
}

export function note(...children) {
  return h('p.note', children);
}

export function emptyState(message) {
  return h('div.empty', message);
}

export { clear, exactText, trim };
