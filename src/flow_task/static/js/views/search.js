import { h } from '../dom.js';
import { mountTaskView } from '../components/task-list.js';

export function mount(main, route) {
  const q = (route.query.get('q') || '').trim();
  if (!q) {
    main.append(h('h1', { class: 'view-title', tabindex: '-1' }, '검색'),
      h('p', { class: 'list-status' }, '상단 검색창에 검색어를 입력하세요.'));
    return {};
  }
  return mountTaskView(main, {
    title: '검색', path: '/tasks', query: () => ({ q }), empty: `"${q}"에 대한 결과가 없습니다.`,
  });
}
