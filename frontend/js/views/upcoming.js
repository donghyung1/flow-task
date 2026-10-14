import { mountTaskView } from '../components/task-list.js';
import { endOfDayUtc } from '../util.js';

export function mount(main) {
  return mountTaskView(main, { title: '예정', path: '/views/upcoming', doneToggle: true, query: (done) => (done ? { include_done: true } : {}), quick: () => ({ due_at: endOfDayUtc(1) }), empty: '예정된 할 일이 없습니다.' });
}
