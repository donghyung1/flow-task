import { h } from '../dom.js';
import * as api from '../api.js';
import { state, on, emit, refreshCounts, refreshProjects, refreshTags } from '../state.js';
import { PRIORITY, STATUS, localInputValue, inputToUtc, pad, toUtcIso } from '../util.js';
import { toast } from './toast.js';
import { confirmDialog } from './modal.js';

// 일월화수목금토 <-> RRULE BYDAY
const DAYS = [['일', 'SU'], ['월', 'MO'], ['화', 'TU'], ['수', 'WE'], ['목', 'TH'], ['금', 'FR'], ['토', 'SA']];
const BYDAY_ORDER = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];

function parseRule(rule) {
  const r = { freq: '', byday: [], monthday: '', interval: 1, until: '' };
  if (!rule) return r;
  for (const part of rule.split(';')) {
    const [k, v = ''] = part.split('=');
    if (k === 'FREQ') r.freq = v;
    else if (k === 'BYDAY') r.byday = v.split(',');
    else if (k === 'BYMONTHDAY') r.monthday = v;
    else if (k === 'INTERVAL') r.interval = Number(v) || 1;
    else if (k === 'UNTIL') {
      const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(v);
      if (m) {
        const d = new Date(Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +m[6]));
        r.until = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      }
    }
  }
  return r;
}

export function initDetail(el) {
  let cur = null;
  let tags = [];
  let seq = 0;
  let returnFocus = null;

  const isOpen = () => !el.hidden;

  function close() {
    seq++;
    if (!isOpen()) return;
    el.hidden = true;
    el.replaceChildren();
    document.body.classList.remove('panel-open');
    cur = null;
    emit('task:selected', null);
    if (returnFocus && returnFocus.isConnected) returnFocus.focus();
    returnFocus = null;
  }

  async function open(id) {
    const my = ++seq;
    if (!isOpen()) returnFocus = document.activeElement;
    let t;
    try { t = await api.getTask(id); } catch { return; }
    if (my !== seq) return;
    render(t);
    el.hidden = false;
    document.body.classList.add('panel-open');
    emit('task:selected', id);
    const title = el.querySelector('#d-title');
    if (title) title.focus();
  }

  function buildRule(f) {
    const freq = f.rec.value;
    if (!freq) return null;
    let rule = `FREQ=${freq}`;
    if (freq === 'WEEKLY') {
      let days = DAYS.filter(([, code], i) => f.wd[i].checked).map(([, c]) => c);
      if (!days.length) {
        const due = f.due.value ? new Date(f.due.value) : new Date();
        days = [DAYS[due.getDay()][1]];
      }
      rule += `;BYDAY=${BYDAY_ORDER.filter((c) => days.includes(c)).join(',')}`;
    } else if (freq === 'MONTHLY') {
      const md = Number(f.monthday.value) || (f.due.value ? new Date(f.due.value).getDate() : new Date().getDate());
      rule += `;BYMONTHDAY=${Math.min(31, Math.max(1, md))}`;
    }
    const iv = Number(f.interval.value);
    if (iv > 1) rule += `;INTERVAL=${iv}`;
    if (f.until.value) {
      const [y, m, d] = f.until.value.split('-').map(Number);
      rule += `;UNTIL=${toUtcIso(new Date(y, m - 1, d, 23, 59, 59)).replace(/[-:]/g, '')}`;
    }
    return rule;
  }

  function render(t) {
    cur = t;
    tags = (t.tags || []).map((x) => x.name);
    const rule = parseRule(t.recurrence_rule);

    const field = (id, label, control) => h('div', { class: 'field' }, h('label', { for: id }, label), control);
    const sel = (id, opts, value) => h('select', { id }, opts.map(([v, l]) => h('option', { value: v, selected: v === value }, l)));

    const title = h('input', { id: 'd-title', type: 'text', maxlength: '200', required: true, value: t.title });
    const desc = h('textarea', { id: 'd-desc', rows: '4', maxlength: '5000' });
    desc.value = t.description || '';
    const due = h('input', { id: 'd-due', type: 'datetime-local', value: localInputValue(t.due_at) });
    const prio = sel('d-prio', Object.entries(PRIORITY), t.priority);
    const status = sel('d-status', Object.entries(STATUS), t.status);
    const project = sel('d-project', [['', '인박스 (없음)'], ...state.projects.map((p) => [String(p.id), p.name])], t.project_id ? String(t.project_id) : '');
    if (t.project_id && !state.projects.some((p) => p.id === t.project_id) && t.project) {
      project.append(h('option', { value: String(t.project_id), selected: true }, t.project.name));
    }

    // tags
    const chips = h('ul', { class: 'chips', 'aria-label': '지정된 태그' });
    const tagInput = h('input', { id: 'd-tags', type: 'text', maxlength: '30', placeholder: '태그 입력 후 Enter', autocomplete: 'off', list: 'd-tags-list' });
    const tagList = h('datalist', { id: 'd-tags-list' }, state.tags.map((x) => h('option', { value: x.name })));
    function drawChips() {
      chips.replaceChildren(...tags.map((n) => h('li', null, n,
        h('button', { type: 'button', 'aria-label': `태그 제거: ${n}`, onclick: () => { tags = tags.filter((x) => x !== n); drawChips(); } }, '×'))));
    }
    function addTag() {
      const v = tagInput.value.trim().replace(/^#/, '');
      if (!v) return;
      if (tags.length >= 10) { toast('태그는 최대 10개까지 지정할 수 있습니다.', 'error'); return; }
      if (!tags.includes(v)) tags.push(v);
      tagInput.value = '';
      drawChips();
    }
    tagInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); addTag(); }
    });
    drawChips();

    // recurrence
    const rec = sel('d-rec', [['', '반복 안 함'], ['DAILY', '매일'], ['WEEKLY', '매주'], ['MONTHLY', '매월']], rule.freq);
    const wd = DAYS.map(([label, code]) => h('input', { type: 'checkbox', value: code, checked: rule.byday.includes(code) }));
    const weekdays = h('div', { class: 'weekdays', role: 'group', 'aria-label': '반복 요일' }, DAYS.map(([label], i) => h('label', null, wd[i], label)));
    const monthday = h('input', { id: 'd-monthday', type: 'number', min: '1', max: '31', value: rule.monthday });
    const monthRow = h('div', { class: 'field' }, h('label', { for: 'd-monthday' }, '반복할 날짜 (일)'), monthday);
    const interval = h('input', { id: 'd-interval', type: 'number', min: '1', max: '99', value: String(rule.interval) });
    const until = h('input', { id: 'd-until', type: 'date', value: rule.until });
    const recMore = h('div', { class: 'field-grid' },
      h('div', { class: 'field' }, h('label', { for: 'd-interval' }, '간격'), interval),
      h('div', { class: 'field' }, h('label', { for: 'd-until' }, '종료일 (선택)'), until));
    function syncRec() {
      weekdays.hidden = rec.value !== 'WEEKLY';
      monthRow.hidden = rec.value !== 'MONTHLY';
      recMore.hidden = !rec.value;
    }
    rec.addEventListener('change', syncRec);
    syncRec();

    const saveBtn = h('button', { type: 'submit', class: 'btn btn-primary' }, '저장');
    const delBtn = h('button', { type: 'button', class: 'btn btn-text-danger', onclick: onDelete }, '삭제');
    const form = h('form', { class: 'detail-body', novalidate: true },
      field('d-title', '제목', title),
      field('d-desc', '메모', desc),
      h('div', { class: 'field-grid' }, field('d-due', '마감', due), field('d-prio', '우선순위', prio)),
      h('div', { class: 'field-grid' }, field('d-status', '상태', status), field('d-project', '프로젝트', project)),
      h('div', { class: 'field' }, h('label', { for: 'd-tags' }, '태그'), h('div', { class: 'tag-input-wrap' }, tagInput, tagList, chips)),
      h('fieldset', { class: 'field' }, h('legend', null, '반복'),
        field('d-rec', '주기', rec), weekdays, monthRow, recMore),
      h('div', { class: 'form-actions' }, delBtn, saveBtn));

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const ttl = title.value.trim();
      if (!ttl) { toast('제목을 입력하세요.', 'error'); title.focus(); return; }
      addTag();
      const body = {
        title: ttl,
        description: desc.value.trim() ? desc.value : null,
        due_at: inputToUtc(due.value),
        priority: prio.value,
        project_id: project.value ? Number(project.value) : null,
        tags: [...tags],
        recurrence_rule: buildRule({ rec, wd, due, monthday, interval, until }),
      };
      if (status.value !== cur.status) body.status = status.value;
      saveBtn.disabled = true;
      try {
        const r = await api.updateTask(cur.id, body);
        cur = { ...cur, ...r, subtasks: cur.subtasks };
        toast('저장했습니다');
        emit('task:updated', r, 'detail');
        refreshCounts(); refreshProjects(); refreshTags();
      } catch { /* toast shown by api */ }
      saveBtn.disabled = false;
    });

    // subtasks
    const subs = t.subtasks || [];
    const heading = h('h3', { id: 'subs-h' });
    const bar = h('span');
    const list = h('ul', { class: 'subs-list' });
    function progress() {
      const total = subs.length, done = subs.filter((s) => s.status === 'DONE').length;
      heading.textContent = `하위 작업 ${done}/${total}`;
      bar.style.setProperty('--w', total ? `${Math.round((done / total) * 100)}%` : '0%');
    }
    async function syncParent() {
      progress();
      try {
        const p = await api.getTask(cur.id);
        emit('task:updated', p, 'detail');
      } catch { /* toast shown */ }
    }
    function subItem(s) {
      const box = h('input', { type: 'checkbox', checked: s.status === 'DONE', 'aria-label': `완료: ${s.title}` });
      const li = h('li', { class: s.status === 'DONE' ? 'done' : '' }, box, h('span', { class: 'sub-title' }, s.title));
      box.addEventListener('change', async () => {
        const doneNow = box.checked;
        try {
          const r = doneNow ? await api.completeTask(s.id) : await api.reopenTask(s.id);
          s.status = r.status;
          li.classList.toggle('done', doneNow);
          refreshCounts();
          syncParent();
        } catch { box.checked = !doneNow; }
      });
      return li;
    }
    subs.forEach((s) => list.append(subItem(s)));
    progress();
    const subInput = h('input', { id: 'sub-new', type: 'text', maxlength: '200', placeholder: '하위 작업 추가 후 Enter', autocomplete: 'off' });
    const subForm = h('form', { class: 'sub-add' },
      h('label', { class: 'sr-only', for: 'sub-new' }, '새 하위 작업'), subInput,
      h('button', { type: 'submit', class: 'btn' }, '추가'));
    subForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const v = subInput.value.trim();
      if (!v) return;
      try {
        const s = await api.addSubtask(cur.id, { title: v });
        subs.push(s);
        list.append(subItem(s));
        subInput.value = '';
        syncParent();
      } catch { /* toast shown */ }
    });
    const subSection = h('section', { class: 'detail-body subs', 'aria-labelledby': 'subs-h' },
      heading, h('div', { class: 'progress', 'aria-hidden': 'true' }, bar), list, subForm);
    if (t.parent_id) subSection.hidden = true;

    const head = h('div', { class: 'detail-head' }, h('h2', null, '할 일 상세'),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': '상세 패널 닫기', onclick: close }, '✕'));
    el.replaceChildren(head, form, subSection);
  }

  async function onDelete() {
    if (!cur) return;
    const ok = await confirmDialog({ title: '할 일 삭제', message: `"${cur.title}" 할 일을 삭제할까요?`, confirmLabel: '삭제' });
    if (!ok || !cur) return;
    const id = cur.id;
    try {
      await api.deleteTask(id);
    } catch { return; }
    toast('삭제했습니다');
    close();
    emit('task:deleted', { id }, 'detail');
    refreshCounts(); refreshProjects(); refreshTags();
  }

  on('task:open', (id) => open(id));
  on('task:updated', (t, src) => {
    if (src === 'list' && cur && t.id === cur.id) {
      const s = el.querySelector('#d-status');
      if (s) s.value = t.status;
      cur.status = t.status;
    }
  });

  return { isOpen, requestClose: close, open };
}
