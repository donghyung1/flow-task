import { h, svg, dot } from '../dom.js';
import * as api from '../api.js';

function chart(daily) {
  const W = 420, H = 190, top = 24, plot = 130, bw = 36, step = 56, left = 14;
  const max = Math.max(1, ...daily.map((d) => d.completed));
  const g = svg('svg', { class: 'chart', viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': `최근 ${daily.length}일 완료한 할 일: ${daily.map((d) => `${d.date} ${d.completed}개`).join(', ')}` });
  g.append(svg('line', { class: 'axis', x1: 4, x2: W - 4, y1: top + plot, y2: top + plot }));
  daily.forEach((d, i) => {
    const bh = Math.round((d.completed / max) * plot);
    const x = left + i * step;
    g.append(
      svg('rect', { class: 'bar', x, y: top + plot - bh, width: bw, height: bh, rx: 3 }, svg('title', null, `${d.date}: ${d.completed}개`)),
      svg('text', { class: 'val', x: x + bw / 2, y: top + plot - bh - 5 }, String(d.completed)),
      svg('text', { x: x + bw / 2, y: top + plot + 16 }, d.date.slice(5).replace('-', '/')));
  });
  return g;
}

export function mount(main) {
  let alive = true;
  const body = h('div', null, h('p', { class: 'list-status', role: 'status' }, '불러오는 중…'));
  main.append(h('div', { class: 'view-head' }, h('h1', { class: 'view-title', tabindex: '-1' }, '통계')), body);
  api.getStats(7).then((s) => {
    if (!alive) return;
    const week = s.daily.reduce((a, d) => a + d.completed, 0);
    const rows = s.by_project.length ? s.by_project.map((p) => {
      const pct = Math.round((p.rate || 0) * 100);
      const bar = h('span');
      bar.style.setProperty('--w', `${pct}%`);
      if (p.color) bar.style.setProperty('--c', p.color);
      return h('div', { class: 'rate-row' },
        h('span', { class: 'name' }, dot(p.color), p.name),
        h('div', { class: 'progress', 'aria-hidden': 'true' }, bar),
        h('span', { class: 'rate' }, `${p.done}/${p.total} (${pct}%)`));
    }) : [h('p', { class: 'muted' }, '프로젝트가 없습니다.')];
    body.replaceChildren(
      h('div', { class: 'stat-cards' },
        h('div', { class: 'card' }, h('div', { class: 'num' }, `${s.streak}일`), h('div', { class: 'lbl' }, '연속 완료')),
        h('div', { class: 'card' }, h('div', { class: 'num' }, String(week)), h('div', { class: 'lbl' }, '최근 7일 완료')),
        h('div', { class: 'card' }, h('div', { class: 'num' }, String(s.total_completed)), h('div', { class: 'lbl' }, '전체 완료'))),
      h('section', { class: 'card' }, h('h2', null, '최근 7일 완료 수'), chart(s.daily)),
      h('section', { class: 'card' }, h('h2', null, '프로젝트별 완료율'), ...rows));
  }).catch(() => { if (alive) body.replaceChildren(h('p', { class: 'list-status' }, '통계를 불러오지 못했습니다.')); });
  return { destroy() { alive = false; } };
}
