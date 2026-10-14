import { h } from '../dom.js';

let openCount = 0;
export const isModalOpen = () => openCount > 0;

const FOCUSABLE = 'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled)';

export function confirmDialog({ title, message, confirmLabel = '확인', cancelLabel = '취소', danger = true }) {
  return new Promise((resolve) => {
    const prev = document.activeElement;
    const cancel = h('button', { type: 'button', class: 'btn' }, cancelLabel);
    const ok = h('button', { type: 'button', class: 'btn ' + (danger ? 'btn-danger' : 'btn-primary') }, confirmLabel);
    const dlg = h('div', { class: 'modal', role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': 'modal-title', 'aria-describedby': 'modal-msg' },
      h('h2', { id: 'modal-title' }, title),
      h('p', { id: 'modal-msg' }, message),
      h('div', { class: 'modal-actions' }, cancel, ok));
    const backdrop = h('div', { class: 'modal-backdrop' }, dlg);
    openCount++;
    let closed = false;
    function close(result) {
      if (closed) return;
      closed = true;
      document.removeEventListener('keydown', onKey, true);
      backdrop.remove();
      setTimeout(() => { openCount--; }, 0);
      if (prev && prev.isConnected) prev.focus();
      resolve(result);
    }
    function onKey(e) {
      if (e.key === 'Escape') {
        e.preventDefault(); e.stopPropagation();
        close(false);
      } else if (e.key === 'Tab') {
        const f = [...dlg.querySelectorAll(FOCUSABLE)];
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (!dlg.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
        else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
    document.addEventListener('keydown', onKey, true);
    cancel.addEventListener('click', () => close(false));
    ok.addEventListener('click', () => close(true));
    backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop) close(false); });
    document.body.append(backdrop);
    (danger ? cancel : ok).focus();
  });
}
