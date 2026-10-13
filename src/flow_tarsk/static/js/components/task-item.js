import { h, dot } from '../dom.js';
import { state, emit } from '../state.js';
import { PRIORITY, fmtDue, isOverdue } from '../util.js';

export function taskRow(t, { reorder, first, last, onToggle, onMove }) {
  const prio = t.priority && t.priority !== 'NONE' ? t.priority.toLowerCase() : '';
  const done = t.status === 'DONE';
  const check = h('input', { type: 'checkbox', class: 'task-check', checked: done, disabled: !!t.pending, 'aria-label': `완료: ${t.title}` });
  const meta = h('span', { class: 'task-meta' });
  if (t.due_at) meta.append(h('span', { class: 'due' + (isOverdue(t) ? ' overdue' : '') }, fmtDue(t.due_at)));
  if (prio) meta.append(h('span', { class: `prio prio-${prio}` }, PRIORITY[t.priority]));
  const sp = t.subtasks_progress;
  if (sp && sp.total > 0) meta.append(h('span', { class: 'sub', title: '하위 작업' }, `${sp.done}/${sp.total}`));
  if (t.project) meta.append(h('span', { class: 'project' }, dot(t.project.color), t.project.name));
  if (t.recurrence_rule) meta.append(h('span', { class: 'rec' }, '반복'));
  for (const g of t.tags || []) {
    const s = h('span', { class: 'tag' }, `#${g.name}`);
    if (g.color) s.style.setProperty('--c', g.color);
    meta.append(s);
  }
  const main = h('button', { type: 'button', class: 'task-main', onclick: () => { if (t.id) emit('task:open', t.id); } },
    h('span', { class: 'task-title' }, t.title), meta);
  const li = h('li', {
    class: ['task', prio && `prio-${prio}`, done && 'done', t.pending && 'pending', t.id && t.id === state.selectedId && 'selected'].filter(Boolean).join(' '),
    dataset: t.id ? { id: String(t.id) } : {},
  }, check, main);
  check.addEventListener('change', () => onToggle(t, li, check));
  if (reorder) {
    li.append(h('div', { class: 'reorder' },
      h('button', { type: 'button', class: 'icon-btn', dataset: { role: 'up' }, disabled: first, 'aria-label': `위로 이동: ${t.title}`, onclick: () => onMove(t, -1) }, '▲'),
      h('button', { type: 'button', class: 'icon-btn', dataset: { role: 'down' }, disabled: last, 'aria-label': `아래로 이동: ${t.title}`, onclick: () => onMove(t, 1) }, '▼')));
  }
  return li;
}
