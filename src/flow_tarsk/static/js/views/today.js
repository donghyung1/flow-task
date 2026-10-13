import { h } from '../dom.js';
import { mountTaskView } from '../components/task-list.js';
import { endOfDayUtc } from '../util.js';

export function mount(main) {
  const v = mountTaskView(main, { title: '오늘', path: '/views/today', doneToggle: true, query: (done) => (done ? { include_done: true } : {}), quick: () => ({ due_at: endOfDayUtc(0) }), empty: '오늘 할 일이 없습니다.' });
  const date = new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' });
  v.titleEl.classList.add('is-today');
  v.titleEl.after(h('p', { class: 'view-date' }, date));
  return v;
}
