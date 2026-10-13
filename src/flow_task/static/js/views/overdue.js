import { mountTaskView } from '../components/task-list.js';

export function mount(main) {
  return mountTaskView(main, { title: '지연됨', path: '/views/overdue', doneToggle: true, query: (done) => (done ? { include_done: true } : {}), empty: '지연된 할 일이 없습니다.' });
}
