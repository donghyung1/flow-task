import { h, $ } from './dom.js';
import { state, on, emit, refreshAll } from './state.js';
import { createSidebar } from './components/sidebar.js';
import { initDetail } from './components/task-detail.js';
import { isModalOpen } from './components/modal.js';
import * as today from './views/today.js';
import * as upcoming from './views/upcoming.js';
import * as overdue from './views/overdue.js';
import * as inbox from './views/inbox.js';
import * as project from './views/project.js';
import * as tag from './views/tag.js';
import * as search from './views/search.js';
import * as stats from './views/stats.js';
import * as manage from './views/manage.js';

const VIEWS = { today, upcoming, overdue, inbox, project, tag, search, stats, manage };
const main = $('main');
const menuBtn = $('menu-btn');
const searchInput = $('search-input');
const detail = initDetail($('detail'));
const sidebar = createSidebar($('sidebar'));
let current = null;

function match(pathname) {
  const p = pathname.replace(/\/+$/, '') || '/';
  if (p === '/' || p === '/app') return { redirect: '/app/today' };
  let m = /^\/app\/(today|upcoming|overdue|inbox|stats|manage|search)$/.exec(p);
  if (m) return { name: m[1] };
  m = /^\/app\/projects\/(\d+)$/.exec(p);
  if (m) return { name: 'project', id: Number(m[1]) };
  m = /^\/app\/tags\/([^/]+)$/.exec(p);
  if (m) {
    try { return { name: 'tag', tag: decodeURIComponent(m[1]) }; } catch { /* fallthrough */ }
  }
  return { name: 'notfound' };
}

function setMenu(open) {
  document.body.classList.toggle('sidebar-open', open);
  menuBtn.setAttribute('aria-expanded', String(open));
  menuBtn.setAttribute('aria-label', open ? '메뉴 닫기' : '메뉴 열기');
}

function render(moveFocus) {
  const route = match(location.pathname);
  if (route.redirect) { history.replaceState(null, '', route.redirect); return render(moveFocus); }
  route.query = new URLSearchParams(location.search);
  if (current) current.destroy?.();
  main.replaceChildren();
  main.scrollTop = 0;
  const mod = VIEWS[route.name];
  if (mod) {
    document.title = 'Task Flow';
    current = mod.mount(main, route);
    if (route.name === 'search') searchInput.value = route.query.get('q') || '';
  } else {
    current = null;
    main.append(h('h1', { class: 'view-title', tabindex: '-1' }, '페이지를 찾을 수 없습니다'),
      h('p', null, h('a', { href: '/app/today', class: 'btn' }, '오늘 할 일로 이동')));
  }
  const h1 = main.querySelector('h1');
  if (!document.title.includes('·') && h1) document.title = `${h1.textContent} · Task Flow`;
  sidebar.render();
  setMenu(false);
  if (moveFocus && h1) h1.focus({ preventScroll: true });
}

export function navigate(url) {
  if (url !== location.pathname + location.search) history.pushState(null, '', url);
  render(true);
}

document.addEventListener('click', (e) => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = e.target.closest && e.target.closest('a[href]');
  if (!a || a.target || a.hasAttribute('download')) return;
  if (a.origin !== location.origin || !(a.pathname === '/app' || a.pathname.startsWith('/app/'))) return;
  e.preventDefault();
  navigate(a.pathname + a.search);
});
window.addEventListener('popstate', () => render(false));

$('search-form').addEventListener('submit', (e) => {
  e.preventDefault();
  navigate(`/app/search?q=${encodeURIComponent(searchInput.value.trim())}`);
});

menuBtn.addEventListener('click', () => setMenu(!document.body.classList.contains('sidebar-open')));
$('scrim').addEventListener('click', () => { setMenu(false); menuBtn.focus(); });
on('sidebar', () => sidebar.render());

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (isModalOpen()) return;
    if (document.body.classList.contains('sidebar-open')) { setMenu(false); menuBtn.focus(); }
    else if (detail.isOpen()) detail.requestClose();
    return;
  }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const t = e.target;
  if (t.matches && t.matches('input, textarea, select, [contenteditable]')) return;
  if (isModalOpen()) return;
  if (e.code === 'KeyN' && !e.shiftKey) {
    const q = $('quick-add-input');
    if (q) { e.preventDefault(); q.focus(); }
  } else if (e.key === '/') {
    e.preventDefault();
    searchInput.focus();
    searchInput.select();
  }
});

refreshAll();
render(false);
