import { h } from '../dom.js';

export function toast(message, type = 'info') {
  const region = document.getElementById('toast-region');
  if (!region) return;
  const err = type === 'error';
  const el = h('div', { class: err ? 'toast toast-error' : 'toast', role: err ? 'alert' : 'status' }, message);
  const remove = () => el.remove();
  el.addEventListener('click', remove);
  region.append(el);
  setTimeout(remove, err ? 6000 : 3500);
}
