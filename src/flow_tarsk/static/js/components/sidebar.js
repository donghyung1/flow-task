import { h, dot } from '../dom.js';
import { state } from '../state.js';

const SMART = [
  ['오늘', '/app/today', 'today'],
  ['예정', '/app/upcoming', 'upcoming'],
  ['지연됨', '/app/overdue', 'overdue'],
  ['인박스', '/app/inbox', 'inbox'],
];
const dec = (s) => { try { return decodeURIComponent(s); } catch { return s; } };

export function createSidebar(el) {
  function link(href, kids, extra) {
    const a = h('a', { class: 'nav-link', href }, kids);
    if (dec(href) === dec(location.pathname)) a.setAttribute('aria-current', 'page');
    if (extra) a.append(extra);
    return a;
  }
  function render() {
    const focused = document.activeElement && el.contains(document.activeElement) ? document.activeElement.getAttribute('href') : null;
    const item = (a) => h('li', null, a);
    const smart = h('ul', null, SMART.map(([label, href, key]) => {
      const n = state.counts[key] || 0;
      return item(link(href, h('span', { class: 'nav-label' }, label),
        h('span', { class: 'badge' + (key === 'overdue' && n > 0 ? ' badge-danger' : ''), 'aria-label': `${n}개` }, String(n))));
    }));
    const projects = state.projects.length
      ? h('ul', null, state.projects.map((p) => item(link(`/app/projects/${p.id}`, [dot(p.color), h('span', { class: 'nav-label' }, p.name)],
        h('span', { class: 'badge', 'aria-label': `${p.open_count}개` }, String(p.open_count))))))
      : h('p', { class: 'nav-empty' }, '프로젝트가 없습니다');
    const tags = state.tags.length
      ? h('ul', null, state.tags.map((t) => item(link(`/app/tags/${encodeURIComponent(t.name)}`, h('span', { class: 'nav-label' }, `#${t.name}`)))))
      : h('p', { class: 'nav-empty' }, '태그가 없습니다');
    el.replaceChildren(
      h('div', { class: 'nav-section' }, smart),
      h('div', { class: 'nav-section' }, h('div', { class: 'nav-head' }, '프로젝트'), projects),
      h('div', { class: 'nav-section' }, h('div', { class: 'nav-head' }, '태그'), tags),
      h('div', { class: 'nav-section' }, h('ul', null, item(link('/app/stats', h('span', { class: 'nav-label' }, '통계'))), item(link('/app/manage', h('span', { class: 'nav-label' }, '관리'))))));
    if (focused) {
      const a = [...el.querySelectorAll('a')].find((x) => x.getAttribute('href') === focused);
      if (a) a.focus();
    }
  }
  render();
  return { render };
}
