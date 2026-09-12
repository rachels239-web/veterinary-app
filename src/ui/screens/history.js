// Session history and the copyable record summary.

import { h } from '../dom.js';
import { card, note } from '../components.js';
import { copyText } from '../dom.js';
import { entries, entryToText, sessionToText, remove, clear, subscribe } from '../../core/history.js';

const time = (iso) =>
  new Date(iso).toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

export default {
  id: 'history',
  label: 'Record',
  title: 'Session record',
  desc: 'Everything you added to the record, ready to paste into clinical notes. Stored on this device only.',
  needsPatient: false,
  render({ rerender }) {
    if (entries.length === 0) {
      return [h('div.empty', 'Nothing recorded yet. Use "Add to record" on any calculation and it will appear here.')];
    }

    const copyAll = h('button.btn.btn-primary', {
      type: 'button',
      onclick: async (e) => {
        const ok = await copyText(sessionToText());
        e.target.textContent = ok ? 'Copied ✓' : 'Copy failed';
        setTimeout(() => { e.target.textContent = 'Copy whole record'; }, 1800);
      },
    }, 'Copy whole record');

    const clearAll = h('button.btn', {
      type: 'button',
      onclick: () => {
        if (confirm('Clear the whole session record? This cannot be undone.')) { clear(); rerender(); }
      },
    }, 'Clear all');

    return [
      card({ title: `${entries.length} calculation${entries.length === 1 ? '' : 's'}`, actions: [copyAll, clearAll] },
        h('div.stack',
          entries.map((entry) =>
            h('div.history-entry',
              h('div.history-meta', time(entry.at)),
              h('div.history-title', entry.calculator),
              h('div.history-meta',
                [entry.patient.name, entry.patient.species === 'cat' ? 'Cat' : 'Dog', `${entry.patient.weightKg} kg`]
                  .filter(Boolean).join(' · '),
              ),
              h('div.history-lines', entry.lines.join('\n')),
              h('div.btn-row',
                h('button.btn.btn-sm', {
                  type: 'button',
                  onclick: async (e) => {
                    const ok = await copyText(entryToText(entry));
                    e.target.textContent = ok ? 'Copied ✓' : 'Copy failed';
                    setTimeout(() => { e.target.textContent = 'Copy'; }, 1500);
                  },
                }, 'Copy'),
                h('button.btn.btn-sm', {
                  type: 'button',
                  onclick: () => { remove(entry.id); rerender(); },
                }, 'Remove'),
              ),
            ),
          ),
        ),
      ),
      note('Nothing here is sent anywhere. Clearing your browser data for this site will erase it.'),
    ];
  },
  subscribe,
};
