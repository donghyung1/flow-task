import { mountTaskView } from '../components/task-list.js';

export function mount(main, route) {
  const tag = route.tag;
  return mountTaskView(main, {
    title: `#${tag}`, path: '/tasks', doneToggle: true, reorder: true, empty: '이 태그의 할 일이 없습니다.',
    query: (done) => ({ tag, ...(done ? {} : { status: 'TODO,IN_PROGRESS' }) }),
    quick: () => ({ tags: [tag] }),
  });
}
