import { h } from '../dom.js';

// onAdd(title) -> Promise; on rejection the typed title is restored.
export function quickAdd({ onAdd, placeholder = '할 일 추가 (N)' }) {
  const input = h('input', { id: 'quick-add-input', type: 'text', maxlength: '200', placeholder, autocomplete: 'off' });
  const el = h('form', { class: 'quick-add' },
    h('label', { class: 'sr-only', for: 'quick-add-input' }, '새 할 일'),
    input,
    h('button', { type: 'submit', class: 'btn btn-primary' }, '추가'));
  el.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = input.value.trim();
    if (!title) return;
    input.value = '';
    try { await onAdd(title); } catch { if (!input.value) input.value = title; }
    input.focus();
  });
  return { el, input };
}
