import { h, dot } from '../dom.js';
import * as api from '../api.js';
import { state, on, emit, refreshCounts, refreshProjects, refreshTags } from '../state.js';
import { createTaskItem } from '../components/task-item.js';
import { createQuickAdd } from '../components/quick-add.js';
import { toast } from '../components/toast.js';

const SORTS = [
  ['', '기본 정렬'], ['sort_order', '수동 순서'], ['due_at', '마감 빠른 순'], ['-due_at', '마감 늦은 순'],
  ['-priority', '우선순위 높은 순'], ['priority', '우선순위 낮은 순'], ['-created_at', '최근 생성 순'], ['created_at', '오래된 순'],
];
const FILTERS = [['active', '미완료'], ['all', '전체'], ['TODO', '할 일'], ['IN_PROGRESS', '진행 중'], ['DONE', '완료']];
const SIZE = 20;

/*
 cfg: { title, color?, path, params, empty, filter?, filterDefault?, defaultManual?, reorder?,
        addDefaults?: () => body fields, placeholder? }
*/
export function mountList(root, cfg) {
  let items = [];
  let total = 0;
  let page = 1;
  let token = 0;
  let seq = 0;
  let destroyed = false;
  let loading = false;
  let sort = '';
  let filter = cfg.filter ? cfg.filterDefault || 'active' : null;

  const titleEl = h('h1', { class: 'view-title', tabindex: '-1' }, cfg.color ? dot(cfg.color) : null, h('span', null, cfg.title));
  const countEl = h('span', { class: 'view-count' });
  const sortSel = h('select', { id: 'sort-sel', onchange: (e) => { sort = e.target.value; load(true); } },
    ...SORTS.map(([v, l]) => h('option', { value: v }, l)));
  const filterSel = cfg.filter ? h('select', { id: 'filter-sel', value: filter, onchange: (e) => { filter = e.target.value; load(true); } },
    ...FILTERS.map(([v, l]) => h('option', { value: v }, l))) : null;
  const listEl = h('ul', { class: 'task-list', 'aria-label': '할 일 목록' });
  const statusEl = h('p', { class: 'list-status', role: 'status' });
  const moreBtn = h('button', { type: 'button', class: 'btn', onclick: () => { page++; load(false); } }, '더 보기');
  const moreWrap = h('div', { class: 'more-wrap', hidden: true }, moreBtn);

  const quick = cfg.addDefaults ? createQuickAdd({ placeholder: cfg.placeholder || '새 할 일을 입력하고 Enter', onSubmit: add }) : null;

  root.append(
    h('div', { class: 'view-head' }, titleEl, countEl,
      h('div', { class: 'view-controls' },
        filterSel ? h('label', null, '상태', filterSel) : null,
        h('label', null, '정렬', sortSel))),
    quick, listEl, statusEl, moreWrap);

  const canReorder = () => !!cfg.reorder && (sort === 'sort_order' || (sort === '' && !!cfg.defaultManual));

  function params(pg) {
    const q = { ...cfg.params, page: pg, size: SIZE };
    if (sort) q.sort = sort;
    if (filter === 'active') q.status = 'TODO,IN_PROGRESS';
    else if (filter && filter !== 'all') q.status = filter;
    return q;
  }

  async function load(reset) {
    const my = ++token;
    loading = true;
    if (reset) { page = 1; items = []; total = 0; renderList(); }
    moreBtn.disabled = true;
    try {
      const res = await api.getList(cfg.path, params(page));
      if (my !== token || destroyed) return;
      loading = false;
      items = reset ? res.items : items.concat(res.items);
      total = res.total;
    } catch {
      if (my !== token || destroyed) return;
      loading = false;
      if (!reset) page--;
      statusEl.replaceChildren('목록을 불러오지 못했습니다. ', h('button', { type: 'button', class: 'btn btn-sm', onclick: () => load(reset) }, '다시 시도'));
      moreBtn.disabled = false;
      return;
    }
    moreBtn.disabled = false;
    renderList();
  }

  function build(t, i) {
    return createTaskItem(t, {
      canReorder: canReorder(), index: i, count: items.length, selected: state.selectedId === t.id,
      onToggle: toggle, onOpen: (x) => emit('task:open', x.id), onMove: (idx, d, role) => move(idx, idx + d, role),
    });
  }

  function renderList() {
    listEl.replaceChildren(...items.map(build));
    countEl.textContent = total ? `${total}개` : '';
    statusEl.replaceChildren(loading ? '불러오는 중…' : items.length ? '' : cfg.empty || '할 일이 없습니다.');
    moreWrap.hidden = items.length >= total;
  }

  function replaceTask(t) {
    const i = items.findIndex((x) => x.id === t.id);
    if (i < 0) return;
    items[i] = t;
    const old = listEl.children[i];
    const li = build(t, i);
    const role = old.contains(document.activeElement) ? document.activeElement.dataset.role : null;
    old.replaceWith(li);
    if (role) li.querySelector(`[data-role="${role}"]`)?.focus();
  }

  async function toggle(task) {
    const doneNow = task.status !== 'DONE';
    const optimistic = { ...task, status: doneNow ? 'DONE' : 'TODO', completed_at: doneNow ? new Date().toISOString() : null };
    replaceTask(optimistic);
    emit('task:updated', optimistic, 'list');
    try {
      const res = doneNow ? await api.completeTask(task.id) : await api.reopenTask(task.id);
      const merged = { ...optimistic, ...res };
      replaceTask(merged);
      emit('task:updated', merged, 'list');
      refreshCounts(); refreshProjects();
      if (doneNow && task.recurrence_rule) load(true);
    } catch {
      replaceTask(task);
      emit('task:updated', task, 'list');
    }
  }

  async function add(title) {
    const body = { title, ...cfg.addDefaults() };
    const proj = body.project_id ? state.projects.find((p) => p.id === body.project_id) : null;
    const tmp = {
      id: `tmp${++seq}`, title, description: null, status: 'TODO', priority: 'NONE', due_at: body.due_at || null,
      project_id: body.project_id || null, project: proj ? { id: proj.id, name: proj.name, color: proj.color } : null,
      tags: (body.tags || []).map((name) => ({ name, color: null })), subtasks_progress: { done: 0, total: 0 }, _pending: true,
    };
    items.unshift(tmp); total++;
    renderList();
    try {
      const t = await api.createTask(body);
      const i = items.findIndex((x) => x.id === tmp.id);
      if (i >= 0) items[i] = t;
      if (!destroyed) renderList();
      refreshCounts(); refreshProjects(); if (body.tags) refreshTags();
      return true;
    } catch {
      items = items.filter((x) => x.id !== tmp.id); total--;
      if (!destroyed) renderList();
      return false;
    }
  }

  async function move(from, to, role) {
    if (to < 0 || to >= items.length || items.some((t) => t._pending)) return;
    const vals = items.map((t) => t.sort_order ?? 0).sort((a, b) => a - b);
    const unique = new Set(vals).size === vals.length;
    const [m] = items.splice(from, 1);
    items.splice(to, 0, m);
    const changed = [];
    items.forEach((t, i) => {
      const v = unique ? vals[i] : vals[0] + i;
      if (t.sort_order !== v) { t.sort_order = v; changed.push({ id: t.id, sort_order: v }); }
    });
    renderList();
    if (role) listEl.children[to]?.querySelector(`[data-role="${role}"]`)?.focus();
    toast(`"${m.title}" 순서를 ${to + 1}번째로 옮겼습니다.`);
    if (!changed.length) return;
    try { await api.reorderTasks(changed); } catch { load(true); }
  }

  // drag & drop (keyboard users have the up/down buttons)
  let dragId = null;
  const liOf = (e) => (e.target.closest ? e.target.closest('li.task') : null);
  listEl.addEventListener('dragstart', (e) => {
    const li = liOf(e);
    if (!li) return;
    dragId = li.dataset.id;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', dragId);
    li.classList.add('dragging');
  });
  listEl.addEventListener('dragover', (e) => {
    const li = liOf(e);
    if (!li || dragId == null) return;
    e.preventDefault();
    listEl.querySelectorAll('.drop-target').forEach((x) => x.classList.remove('drop-target'));
    li.classList.add('drop-target');
  });
  listEl.addEventListener('drop', (e) => {
    const li = liOf(e);
    if (!li || dragId == null) return;
    e.preventDefault();
    const to = [...listEl.children].indexOf(li);
    const from = items.findIndex((t) => String(t.id) === dragId);
    dragId = null;
    if (from >= 0 && to >= 0 && from !== to) move(from, to);
  });
  listEl.addEventListener('dragend', () => {
    dragId = null;
    listEl.querySelectorAll('.dragging,.drop-target').forEach((x) => x.classList.remove('dragging', 'drop-target'));
  });

  const unsubs = [
    on('task:updated', (t, src) => { if (src !== 'list') replaceTask(t); }),
    on('task:deleted', (id) => {
      const n = items.length;
      items = items.filter((x) => x.id !== id);
      if (items.length !== n) { total--; renderList(); }
    }),
    on('task:selected', () => {
      listEl.querySelectorAll('li.task').forEach((li) => li.classList.toggle('selected', String(state.selectedId) === li.dataset.id));
    }),
    on('task:reload', () => load(true)),
  ];

  load(true);

  return {
    setTitle(text) {
      titleEl.lastChild.textContent = text;
      document.title = `${text} · Task Flow`;
    },
    destroy() { destroyed = true; token++; unsubs.forEach((u) => u()); },
  };
}
