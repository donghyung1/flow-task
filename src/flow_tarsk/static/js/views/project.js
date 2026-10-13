import { dot } from '../dom.js';
import * as api from '../api.js';
import { mountTaskView } from '../components/task-list.js';

export function mount(main, route) {
  const id = route.id;
  let alive = true;
  const v = mountTaskView(main, {
    title: '프로젝트', path: '/tasks', doneToggle: true, reorder: true, empty: '이 프로젝트에 할 일이 없습니다.',
    query: (done) => ({ project_id: id, ...(done ? {} : { status: 'TODO,IN_PROGRESS' }) }),
    quick: () => ({ project_id: id }),
  });
  api.getProject(id).then((p) => {
    if (!alive) return;
    v.titleEl.replaceChildren(dot(p.color), p.name);
    document.title = `${p.name} · Task Flow`;
  }).catch(() => {});
  return { destroy() { alive = false; v.destroy(); } };
}
