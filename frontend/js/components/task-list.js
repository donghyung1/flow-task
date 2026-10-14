import { h } from '../dom.js';
import * as api from '../api.js';
import { on, emit, refreshCounts } from '../state.js';
import { taskRow } from './task-item.js';
import { quickAdd } from './quick-add.js';

const SIZE = 50;

// o: { title, path, query(showDone)->obj, quick()->extra body | undefined, reorder, empty, doneToggle, doneDefault }
export function mountTaskView(main, o) {
  let items = [], total = 0, loaded = false, failed = false, alive = true, seq = 0, tmp = 0, curSize = SIZE;
  let showDone = (() => { try { const v = localStorage.getItem('flowtask.showDone'); return v === '1' ? true : v === '0' ? false : !!o.doneDefault; } catch { return !!o.doneDefault; } })();
  const titleEl = h('h1', { class: 'view-title', tabindex: '-1' }, o.title);
  const countEl = h('span', { class: 'view-count' });
  const controls = h('div', { class: 'view-controls' });
  if (o.doneToggle) {
    const box = h('input', { type: 'checkbox', checked: showDone, onchange: () => { showDone = box.checked; try { localStorage.setItem('flowtask.showDone', showDone ? '1' : '0'); } catch {} load(); } });
    controls.append(h('label', null, box, '완료 표시'));
  }
  const listEl = h('ul', { class: 'task-list' });
  const status = h('p', { class: 'list-status', role: 'status' });
  const moreBtn = h('button', { type: 'button', class: 'btn', onclick: () => loadMore() }, '더 보기');
  const moreWrap = h('div', { class: 'more-wrap', hidden: true }, moreBtn);
  main.append(h('div', { class: 'view-head' }, titleEl, countEl, controls));
  if (o.quick) main.append(quickAdd({ onAdd: add }).el);
  main.append(listEl, status, moreWrap);

  const serverCount = () => items.filter((t) => !t.pending).length;

  function draw(focus) {
    if (!alive) return;
    listEl.replaceChildren(...items.map((t, i) => taskRow(t, {
      reorder: o.reorder && !t.pending, first: i === 0, last: i === items.length - 1, onToggle: toggle, onMove: move,
    })));
    countEl.textContent = loaded ? `${total}개` : '';
    status.textContent = !loaded ? (failed ? '목록을 불러오지 못했습니다.' : '불러오는 중…') : items.length ? '' : (o.empty || '할 일이 없습니다.');
    moreWrap.hidden = !(loaded && serverCount() < total);
    if (focus) {
      const li = listEl.querySelector(`li[data-id="${focus.id}"]`);
      const b = li && (li.querySelector(`[data-role=${focus.role}]:not(:disabled)`) || li.querySelector('.reorder button:not(:disabled)'));
      if (b) b.focus();
    }
  }

  const q = (page, size) => ({ ...o.query(showDone), page, size });

  async function load() {
    const my = ++seq;
    curSize = Math.min(100, Math.max(SIZE, serverCount()));
    try {
      const r = await api.getList(o.path, q(1, curSize));
      if (!alive || my !== seq) return;
      items = [...r.items, ...items.filter((t) => t.pending)];
      total = r.total; failed = false;
    } catch {
      if (!alive || my !== seq) return;
      failed = true;
    }
    loaded = true;
    draw();
  }

  async function loadMore() {
    const my = ++seq;
    moreBtn.disabled = true;
    try {
      const r = await api.getList(o.path, q(Math.floor(serverCount() / curSize) + 1, curSize));
      if (!alive || my !== seq) return;
      const have = new Set(items.map((t) => t.id));
      items = [...items.filter((t) => !t.pending), ...r.items.filter((t) => !have.has(t.id)), ...items.filter((t) => t.pending)];
      total = r.total;
      draw();
    } catch { /* toast shown by api */ }
    moreBtn.disabled = false;
  }

  async function add(title) {
    const body = { title, ...(o.quick() || {}) };
    const p = { id: null, pending: true, tmp: ++tmp, title, status: 'TODO', priority: 'NONE', due_at: body.due_at || null, tags: [], subtasks_progress: { done: 0, total: 0 } };
    items.push(p);
    draw();
    try {
      const r = await api.createTask(body);
      const i = items.indexOf(p);
      if (i >= 0) items[i] = r;
      total++;
      draw();
      refreshCounts();
    } catch (e) {
      const i = items.indexOf(p);
      if (i >= 0) items.splice(i, 1);
      draw();
      throw e;
    }
  }

  async function toggle(t, li, box) {
    const doneNow = box.checked;
    const prev = t.status;
    t.status = doneNow ? 'DONE' : 'TODO';
    li.classList.toggle('done', doneNow);
    if (doneNow) {
      li.classList.add('stamped');
      box.addEventListener('animationend', () => li.classList.remove('stamped'), { once: true });
    } else li.classList.remove('stamped');
    try {
      const r = doneNow ? await api.completeTask(t.id) : await api.reopenTask(t.id);
      Object.assign(t, r);
      emit('task:updated', r, 'list');
      refreshCounts();
      if (doneNow && r.recurrence_rule) load();
    } catch {
      t.status = prev;
      box.checked = prev === 'DONE';
      li.classList.toggle('done', prev === 'DONE');
    }
  }

  async function move(t, dir) {
    const i = items.indexOf(t), j = i + dir;
    if (j < 0 || j >= items.length || items[j].pending || t.pending) return;
    [items[i], items[j]] = [items[j], items[i]];
    draw({ id: t.id, role: dir < 0 ? 'up' : 'down' });
    try {
      await api.reorderTasks(items.filter((x) => !x.pending).map((x, n) => ({ id: x.id, sort_order: n })));
    } catch { load(); }
  }

  const offs = [
    on('task:updated', (t, src) => { if (src !== 'list') load(); }),
    on('task:deleted', (t) => {
      const i = items.findIndex((x) => x.id === t.id);
      if (i >= 0) { items.splice(i, 1); total = Math.max(0, total - 1); draw(); }
    }),
    on('task:reload', () => load()),
    on('task:selected', (id) => {
      listEl.querySelectorAll('li.task').forEach((li) => li.classList.toggle('selected', id != null && li.dataset.id === String(id)));
    }),
  ];

  draw();
  load();
  return {
    titleEl,
    destroy() { alive = false; offs.forEach((f) => f()); },
  };
}
