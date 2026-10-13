import { h } from '../dom.js';
import * as api from '../api.js';
import { refreshProjects, refreshTags, refreshCounts, emit } from '../state.js';
import { confirmDialog } from '../components/modal.js';
import { toast } from '../components/toast.js';

export function mount(main) {
  let alive = true;
  const projList = h('div', { class: 'manage-list' });
  const tagList = h('div', { class: 'manage-list' });

  async function loadProjects() {
    try {
      const ps = await api.listProjects(true);
      if (!alive) return;
      projList.replaceChildren(...ps.map(projectRow));
      if (!ps.length) projList.append(h('p', { class: 'muted' }, '프로젝트가 없습니다.'));
    } catch { /* toast */ }
  }
  async function loadTags() {
    try {
      const ts = await api.listTags();
      if (!alive) return;
      tagList.replaceChildren(...ts.map(tagRow));
      if (!ts.length) tagList.append(h('p', { class: 'muted' }, '태그가 없습니다.'));
    } catch { /* toast */ }
  }

  function projectRow(p) {
    const name = h('input', { type: 'text', maxlength: '50', required: true, value: p.name, 'aria-label': `프로젝트 이름: ${p.name}` });
    const color = h('input', { type: 'color', value: p.color || '#4f46e5', 'aria-label': `프로젝트 색상: ${p.name}` });
    const arch = h('input', { type: 'checkbox', checked: !!p.is_archived });
    const f = h('form', { class: 'manage-form' }, name, color, h('label', null, arch, '보관'),
      h('button', { type: 'submit', class: 'btn btn-sm' }, '저장'),
      h('button', { type: 'button', class: 'btn btn-sm btn-text-danger', onclick: async () => {
        const ok = await confirmDialog({ title: '프로젝트 삭제', message: `"${p.name}" 프로젝트를 삭제할까요? 소속 할 일은 인박스로 이동합니다.`, confirmLabel: '삭제' });
        if (!ok) return;
        try { await api.deleteProject(p.id); } catch { return; }
        toast('삭제했습니다');
        await Promise.all([loadProjects(), refreshProjects(), refreshCounts()]);
        emit('task:reload');
      } }, '삭제'));
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!name.value.trim()) { toast('이름을 입력하세요.', 'error'); return; }
      try {
        await api.updateProject(p.id, { name: name.value.trim(), color: color.value, is_archived: arch.checked });
      } catch { return; }
      toast('저장했습니다');
      await Promise.all([loadProjects(), refreshProjects()]);
    });
    return f;
  }

  function tagRow(t) {
    const name = h('input', { type: 'text', maxlength: '30', required: true, value: t.name, 'aria-label': `태그 이름: ${t.name}` });
    const f = h('form', { class: 'manage-form' }, name, h('span', { class: 'muted' }, `${t.task_count ?? 0}개`),
      h('button', { type: 'submit', class: 'btn btn-sm' }, '저장'),
      h('button', { type: 'button', class: 'btn btn-sm btn-text-danger', onclick: async () => {
        const ok = await confirmDialog({ title: '태그 삭제', message: `"${t.name}" 태그를 삭제할까요? 할 일에서도 제거됩니다.`, confirmLabel: '삭제' });
        if (!ok) return;
        try { await api.deleteTag(t.id); } catch { return; }
        toast('삭제했습니다');
        await Promise.all([loadTags(), refreshTags()]);
        emit('task:reload');
      } }, '삭제'));
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!name.value.trim()) { toast('이름을 입력하세요.', 'error'); return; }
      try { await api.updateTag(t.id, { name: name.value.trim() }); } catch { return; }
      toast('저장했습니다');
      await Promise.all([loadTags(), refreshTags()]);
    });
    return f;
  }

  const npName = h('input', { id: 'np-name', type: 'text', maxlength: '50', required: true, placeholder: '새 프로젝트 이름', autocomplete: 'off' });
  const npColor = h('input', { id: 'np-color', type: 'color', value: '#4f46e5', 'aria-label': '새 프로젝트 색상' });
  const npForm = h('form', { class: 'manage-form' },
    h('label', { class: 'sr-only', for: 'np-name' }, '새 프로젝트 이름'), npName, npColor,
    h('button', { type: 'submit', class: 'btn btn-primary' }, '프로젝트 추가'));
  npForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const n = npName.value.trim();
    if (!n) return;
    try { await api.createProject({ name: n, color: npColor.value }); } catch { return; }
    npName.value = '';
    await Promise.all([loadProjects(), refreshProjects()]);
  });

  const ntName = h('input', { id: 'nt-name', type: 'text', maxlength: '30', required: true, placeholder: '새 태그 이름', autocomplete: 'off' });
  const ntForm = h('form', { class: 'manage-form' },
    h('label', { class: 'sr-only', for: 'nt-name' }, '새 태그 이름'), ntName,
    h('button', { type: 'submit', class: 'btn btn-primary' }, '태그 추가'));
  ntForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const n = ntName.value.trim();
    if (!n) return;
    try { await api.createTag({ name: n }); } catch { return; }
    ntName.value = '';
    await Promise.all([loadTags(), refreshTags()]);
  });

  main.append(
    h('div', { class: 'view-head' }, h('h1', { class: 'view-title', tabindex: '-1' }, '관리')),
    h('div', { class: 'manage-grid' },
      h('section', { class: 'card', 'aria-labelledby': 'mg-p' }, h('h2', { id: 'mg-p' }, '프로젝트'), npForm, projList),
      h('section', { class: 'card', 'aria-labelledby': 'mg-t' }, h('h2', { id: 'mg-t' }, '태그'), ntForm, tagList)));
  loadProjects();
  loadTags();
  return { destroy() { alive = false; } };
}
