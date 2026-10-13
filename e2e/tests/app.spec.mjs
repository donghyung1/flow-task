import { test, expect, name, iso } from './fixtures.mjs';

const row = (page, title) => page.locator('li.task', { hasText: title });
const open = async (page, title) => {
  await row(page, title).locator('.task-main').click();
  await page.waitForSelector('#d-title');
};
const toastText = (page) => page.locator('.toast').allInnerTexts();

test('1 loads /app/today with sidebar', async ({ page, api }) => {
  const p = await api('POST', '/projects', { name: name('sidebar-proj'), color: '#112233' });
  await api('POST', '/tasks', { title: name('sidebar'), project_id: p.id, tags: [name('sidetag')] });
  await page.goto('/');
  await expect(page).toHaveURL(/\/app\/today$/);
  const side = page.locator('#sidebar');
  await expect(side.getByText('오늘')).toBeVisible();
  await expect(side.locator('.badge').first()).toBeVisible();
  await expect(side.getByText(name('sidebar-proj'))).toBeVisible();
  await expect(side.getByText(name('sidetag'))).toBeVisible();
});

test('2 quick add persists, stays on /app/today', async ({ page }) => {
  const title = name('quick');
  await page.goto('/app/today');
  await page.locator('#quick-add-input').fill(title);
  await page.locator('#quick-add-input').press('Enter');
  await expect(row(page, title)).toBeVisible();
  await expect(row(page, title)).not.toHaveClass(/pending/);
  await page.reload();
  await expect(row(page, title)).toBeVisible();
  await expect(page).toHaveURL(/\/app\/today$/);
});

test('3 detail edit persists (UTC conversion)', async ({ page, api }) => {
  const t = await api('POST', '/tasks', { title: name('edit'), due_at: iso(0) });
  const title = name('edited');
  await page.goto('/app/today');
  await open(page, name('edit'));
  await page.fill('#d-title', title);
  await page.fill('#d-desc', '메모 내용\n두번째줄');
  await page.fill('#d-due', '2026-10-14T09:00');
  await page.selectOption('#d-prio', 'HIGH');
  for (const tag of [name('업무'), name('work')]) {
    await page.fill('#d-tags', tag);
    await page.press('#d-tags', 'Enter');
  }
  await page.click('.detail button:has-text("저장")');
  await expect(page.locator('.toast', { hasText: '저장했습니다' })).toBeVisible();
  const g = await api('GET', `/tasks/${t.id}`);
  expect(g.title).toBe(title);
  expect(g.description).toBe('메모 내용\n두번째줄');
  expect(g.priority).toBe('HIGH');
  expect(g.due_at).toBe('2026-10-14T00:00:00Z');
  expect(g.tags.map((x) => x.name).sort()).toEqual([name('work'), name('업무')].sort());

  await page.goto(`/app/tags/${encodeURIComponent(name('업무'))}`);
  const r = row(page, title);
  await expect(r).toContainText('높음');
  await expect(r).toContainText('09:00');
  await open(page, title);
  await expect(page.locator('#d-title')).toHaveValue(title);
  await expect(page.locator('#d-due')).toHaveValue('2026-10-14T09:00');
  await expect(page.locator('#d-desc')).toHaveValue('메모 내용\n두번째줄');
  await expect(page.locator('#d-prio')).toHaveValue('HIGH');
  await expect(page.locator('.chips li')).toHaveCount(2);
});

test('4 complete / reopen', async ({ page, api }) => {
  const t = await api('POST', '/tasks', { title: name('toggle') });
  await page.goto('/app/inbox');
  await row(page, name('toggle')).locator('.task-check').check();
  await expect.poll(async () => (await api('GET', `/tasks/${t.id}`)).status).toBe('DONE');
  expect((await api('GET', `/tasks/${t.id}`)).completed_at).toBeTruthy();
  await row(page, name('toggle')).locator('.task-check').uncheck();
  await expect.poll(async () => (await api('GET', `/tasks/${t.id}`)).status).toBe('TODO');
  expect((await api('GET', `/tasks/${t.id}`)).completed_at).toBeNull();
});

test('5 subtasks progress', async ({ page, api }) => {
  const t = await api('POST', '/tasks', { title: name('parent') });
  await page.goto('/app/inbox');
  await open(page, name('parent'));
  for (const s of ['서브1', '서브2']) {
    await page.fill('#sub-new', s);
    await page.press('#sub-new', 'Enter');
    await expect(page.locator('.subs-list li', { hasText: s })).toBeVisible();
  }
  await page.locator('.subs-list li', { hasText: '서브1' }).locator('input').check();
  await expect(page.locator('#subs-h')).toContainText('1/2');
  await expect(row(page, name('parent')).locator('.sub')).toContainText('1/2');
  const g = await api('GET', `/tasks/${t.id}`);
  expect(g.subtasks_progress).toEqual({ done: 1, total: 2 });
});

test('6 manage projects and tags', async ({ page }) => {
  const a = name('projA'), b = name('projB'), tag1 = name('tag1'), tag2 = name('tag2');
  await page.goto('/app/manage');
  await page.fill('#np-name', a);
  await page.locator('#np-color').evaluate((e) => { e.value = '#ff0000'; });
  await page.click('form:has(#np-name) button[type=submit]');
  const nameInput = (n) => page.locator(`input[aria-label="프로젝트 이름: ${n}"]`);
  const formOf = (loc) => loc.locator('xpath=ancestor::form');
  await expect(nameInput(a)).toBeVisible();
  await expect(page.locator('#sidebar')).toContainText(a);
  await nameInput(a).fill(b);
  await formOf(nameInput(a)).locator('button:has-text("저장")').click();
  await expect(nameInput(b)).toBeVisible();
  await expect(page.locator('#sidebar')).toContainText(b);
  await formOf(nameInput(b)).locator('input[type=checkbox]').check();
  await formOf(nameInput(b)).locator('button:has-text("저장")').click();
  await expect(page.locator('#sidebar')).not.toContainText(b);

  await page.fill('#nt-name', tag1);
  await page.click('form:has(#nt-name) button[type=submit]');
  const tagInput = (n) => page.locator(`input[aria-label="태그 이름: ${n}"]`);
  await expect(tagInput(tag1)).toBeVisible();
  page.expectHttpError = true;
  await page.fill('#nt-name', tag1);
  await page.click('form:has(#nt-name) button[type=submit]');
  await expect(page.locator('.toast-error')).toContainText('이미 존재');
  page.expectHttpError = false;
  await tagInput(tag1).fill(tag2);
  await formOf(tagInput(tag1)).locator('button:has-text("저장")').click();
  await expect(tagInput(tag2)).toBeVisible();
  await formOf(tagInput(tag2)).locator('button:has-text("삭제")').click();
  await page.click('.modal button.btn-danger');
  await expect(tagInput(tag2)).toHaveCount(0);
});

test('7 project view quick-add; delete project moves tasks to inbox', async ({ page, api }) => {
  const p = await api('POST', '/projects', { name: name('pv'), color: '#00ff00' });
  await page.goto(`/app/projects/${p.id}`);
  await page.fill('#quick-add-input', name('pvtask'));
  await page.press('#quick-add-input', 'Enter');
  await expect(row(page, name('pvtask'))).not.toHaveClass(/pending/);
  expect((await api('GET', `/tasks?project_id=${p.id}`)).total).toBe(1);
  await page.goto('/app/manage');
  const f = page.locator(`input[aria-label="프로젝트 이름: ${name('pv')}"]`).locator('xpath=ancestor::form');
  await f.locator('button:has-text("삭제")').click();
  await page.click('.modal button.btn-danger');
  await expect(f).toHaveCount(0);
  const t = (await api('GET', `/tasks?q=${encodeURIComponent(name('pvtask'))}`)).items[0];
  expect(t.project_id).toBeNull();
  await page.goto('/app/inbox');
  await expect(row(page, name('pvtask'))).toBeVisible();
});

test('8 upcoming / overdue / inbox / tag / search views', async ({ page, api }) => {
  await api('POST', '/tasks', { title: name('past'), due_at: iso(-2), tags: [name('vtag')] });
  await api('POST', '/tasks', { title: name('future'), due_at: iso(3) });
  await api('POST', '/tasks', { title: name('한글검색 대상'), description: '내용' });
  await page.goto('/app/overdue');
  await expect(row(page, name('past'))).toBeVisible();
  await expect(row(page, name('future'))).toHaveCount(0);
  await page.goto('/app/upcoming');
  await expect(row(page, name('future'))).toBeVisible();
  await expect(row(page, name('past'))).toHaveCount(0);
  await page.goto('/app/inbox');
  await expect(row(page, name('한글검색'))).toBeVisible();
  await page.goto(`/app/tags/${encodeURIComponent(name('vtag'))}`);
  await expect(page.locator('li.task')).toHaveCount(1);
  await expect(row(page, name('past'))).toBeVisible();
  await page.goto('/app/today');
  await expect(page.locator('#quick-add-input')).toBeVisible();
  await page.locator('body').click({ position: { x: 5, y: 400 } });
  await page.keyboard.press('/');
  await page.keyboard.type(`${name('한글검색')}`);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/app\/search\?q=/);
  await expect(page.locator('li.task')).toHaveCount(1);
  await expect(row(page, '한글검색 대상')).toBeVisible();
  await page.fill('#search-input', '대상');
  await page.press('#search-input', 'Enter');
  await expect(row(page, name('한글검색 대상'))).toBeVisible();
});

test('9 weekly recurrence creates next occurrence', async ({ page, api }) => {
  const t = await api('POST', '/tasks', { title: name('rec'), due_at: iso(2) });
  await page.goto('/app/upcoming');
  await open(page, name('rec'));
  await page.selectOption('#d-rec', 'WEEKLY');
  await page.locator('.weekdays label:has-text("수") input').check();
  await page.click('.detail button:has-text("저장")');
  await expect(page.locator('.toast', { hasText: '저장했습니다' })).toBeVisible();
  const g = await api('GET', `/tasks/${t.id}`);
  expect(g.recurrence_rule).toBe('FREQ=WEEKLY;BYDAY=WE');
  await page.keyboard.press('Escape');
  await row(page, name('rec')).locator('.task-check').click();
  await expect.poll(async () => (await api('GET', `/tasks?q=${encodeURIComponent(name('rec'))}&status=TODO`)).items.length).toBe(1);
  const next = (await api('GET', `/tasks?q=${encodeURIComponent(name('rec'))}&status=TODO`)).items[0];
  expect(next.id).not.toBe(t.id);
  expect(new Date(next.due_at).getTime()).toBeGreaterThan(new Date(g.due_at).getTime());
  expect(next.recurrence_rule).toBe('FREQ=WEEKLY;BYDAY=WE');
});

test('10 reorder persists', async ({ page, api }) => {
  const names = ['R1', 'R2', 'R3'].map(name);
  const p = await api('POST', '/projects', { name: name('reorder'), color: '#abcdef' });
  for (const n of names) await api('POST', '/tasks', { title: n, project_id: p.id });
  await page.goto(`/app/projects/${p.id}`);
  const order = async () => (await page.locator('.task-title').allInnerTexts()).join();
  await expect(page.locator('li.task')).toHaveCount(3);
  const before = await order();
  await row(page, name('R3')).locator('[data-role=up]').click();
  await expect.poll(order).not.toBe(before);
  const after = await order();
  await page.waitForTimeout(500);
  await page.reload();
  await expect(page.locator('li.task')).toHaveCount(3);
  expect(await order()).toBe(after);
});

test('11 stats view', async ({ page, api }) => {
  const p = await api('POST', '/projects', { name: name('stat'), color: '#445566' });
  const t = await api('POST', '/tasks', { title: name('stat'), project_id: p.id });
  await api('POST', `/tasks/${t.id}/complete`);
  await page.goto('/app/stats');
  await expect(page.locator('svg.chart rect.bar')).toHaveCount(7);
  await expect(page.locator('main')).toContainText('연속 완료');
  await expect(page.locator('.rate-row', { hasText: name('stat') })).toContainText('1/1 (100%)');
});

test('12 keyboard shortcuts and history', async ({ page, api }) => {
  await api('POST', '/tasks', { title: name('kbd') });
  await page.goto('/app/inbox');
  await expect(row(page, name('kbd'))).toBeVisible();
  await page.locator('h1').click();
  await page.keyboard.press('n');
  await expect(page.locator('#quick-add-input')).toBeFocused();
  await page.locator('h1').click();
  await page.keyboard.press('/');
  await expect(page.locator('#search-input')).toBeFocused();
  await open(page, name('kbd'));
  await page.keyboard.press('Escape');
  await expect(page.locator('#detail')).toBeHidden();
  await page.click('#sidebar a[href="/app/upcoming"]');
  await expect(page.locator('h1')).toContainText('예정');
  await page.click('#sidebar a[href="/app/stats"]');
  await expect(page.locator('h1')).toContainText('통계');
  await page.goBack();
  await expect(page.locator('h1')).toContainText('예정');
  await page.goBack();
  await expect(page.locator('h1')).toContainText('인박스');
  await page.goForward();
  await expect(page.locator('h1')).toContainText('예정');
});

test('13 XSS title is rendered as text', async ({ page }) => {
  const title = '<img src=x onerror=alert(1)>';
  await page.goto('/app/inbox');
  await page.fill('#quick-add-input', title);
  await page.press('#quick-add-input', 'Enter');
  await expect(row(page, title)).not.toHaveClass(/pending/);
  await expect(page.locator('main img')).toHaveCount(0);
  await open(page, title);
  await expect(page.locator('#detail img')).toHaveCount(0);
  expect(page.dialogs).toEqual([]);
  // cleanup (title does not carry the RUN prefix)
  page.once('dialog', () => {});
  await page.click('.detail button:has-text("삭제")');
  await page.click('.modal button.btn-danger');
  await expect(row(page, title)).toHaveCount(0);
});

test('14 mobile hamburger and detail panel', async ({ browser, api }) => {
  await api('POST', '/tasks', { title: name('mobile') });
  const ctx = await browser.newContext({ viewport: { width: 375, height: 800 }, timezoneId: 'Asia/Seoul', locale: 'ko-KR', baseURL: process.env.BASE_URL || 'http://127.0.0.1:8000' });
  const m = await ctx.newPage();
  const errs = [];
  m.on('console', (x) => { if (x.type() === 'error') errs.push(x.text()); });
  m.on('pageerror', (e) => errs.push(e.message));
  await m.goto('/app/inbox');
  await expect(row(m, name('mobile'))).toBeVisible();
  await expect(m.locator('#menu-btn')).toBeVisible();
  await expect(m.locator('#sidebar')).not.toBeInViewport();
  await m.click('#menu-btn');
  await expect(m.locator('#menu-btn')).toHaveAttribute('aria-expanded', 'true');
  await expect(m.locator('#sidebar')).toBeInViewport();
  await m.click('#menu-btn');
  await expect(m.locator('#menu-btn')).toHaveAttribute('aria-expanded', 'false');
  await open(m, name('mobile'));
  await expect(m.locator('#detail')).toBeInViewport({ ratio: 0.9 });
  await m.fill('#d-title', name('mobile edited'));
  await m.click('.detail button:has-text("저장")');
  await expect(m.locator('.toast', { hasText: '저장했습니다' })).toBeVisible();
  await m.click('button[aria-label="상세 패널 닫기"]');
  await expect(m.locator('#detail')).toBeHidden();
  expect(await m.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  expect(errs).toEqual([]);
  await ctx.close();
});

test('15 optimistic add rolls back on 500', async ({ page }) => {
  await page.goto('/app/inbox');
  await expect(page.locator('#quick-add-input')).toBeVisible();
  await page.route('**/api/v1/tasks', (r) => (r.request().method() === 'POST'
    ? r.fulfill({ status: 500, contentType: 'application/json', body: '{"error":{"code":"INTERNAL","message":"boom"}}' })
    : r.continue()));
  page.expectHttpError = true;
  const title = name('rollback');
  await page.fill('#quick-add-input', title);
  await page.press('#quick-add-input', 'Enter');
  await expect(page.locator('.toast-error')).toBeVisible();
  await expect(row(page, title)).toHaveCount(0);
  await expect(page.locator('#quick-add-input')).toHaveValue(title);
});
