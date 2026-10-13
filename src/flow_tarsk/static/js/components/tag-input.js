import { h } from '../dom.js';
import { state } from '../state.js';
import { toast } from './toast.js';

export const MAX_TAGS = 10;

export function createTagInput(initial, onChange) {
  let tags = [...initial];
  const chips = h('ul', { class: 'chips', 'aria-label': '선택한 태그' });
  const input = h('input', { id: 'd-tags', type: 'text', maxlength: '30', list: 'tag-suggest', autocomplete: 'off', placeholder: '태그 입력 후 Enter 또는 쉼표' });
  const datalist = h('datalist', { id: 'tag-suggest' }, ...state.tags.map((t) => h('option', { value: t.name })));

  function paint() {
    chips.replaceChildren(...tags.map((t) => h('li', null, `#${t}`,
      h('button', { type: 'button', 'aria-label': `태그 ${t} 삭제`, onclick: () => { tags = tags.filter((x) => x !== t); paint(); onChange(); input.focus(); } }, '✕'))));
  }
  function commit() {
    const v = input.value.replace(/^#+/, '').trim();
    input.value = '';
    if (!v || tags.includes(v)) return;
    if (tags.length >= MAX_TAGS) { toast(`태그는 최대 ${MAX_TAGS}개까지 지정할 수 있습니다.`, 'error'); return; }
    tags.push(v);
    paint();
    onChange();
  }
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commit(); }
    else if (e.key === 'Backspace' && !input.value && tags.length) { tags.pop(); paint(); onChange(); }
  });
  input.addEventListener('blur', commit);
  paint();
  return { el: h('div', { class: 'tag-input-wrap' }, chips, input, datalist), getValue: () => { commit(); return [...tags]; } };
}
