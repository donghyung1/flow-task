import { mountTaskView } from '../components/task-list.js';

export function mount(main) {
  return mountTaskView(main, { title: '인박스', path: '/views/inbox', doneToggle: true, query: (done) => (done ? { include_done: true } : {}), quick: () => ({}), reorder: true, empty: '인박스가 비었습니다.' });
}
