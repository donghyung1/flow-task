import { test as base, expect } from '@playwright/test';

export const RUN = `E2E${Date.now().toString(36)}`;
export const name = (s) => `${RUN} ${s}`;
export const iso = (offsetDays) => new Date(Date.now() + offsetDays * 86400000).toISOString().replace(/\.\d+Z$/, 'Z');

export const test = base.extend({
  api: async ({ request }, use) => {
    const call = async (method, path, data) => {
      const res = await request.fetch(`/api/v1${path}`, { method, data });
      return res.status() === 204 ? null : res.json();
    };
    await use(call);
  },
  // Collects console errors / CSP violations / page errors / unexpected HTTP errors per test.
  issues: [async ({ page }, use) => {
    const issues = [];
    page.expectHttpError = false;
    page.on('console', (m) => { if (['error', 'warning'].includes(m.type()) && !page.expectHttpError) issues.push(`console.${m.type()}: ${m.text()}`); });
    page.on('pageerror', (e) => issues.push(`pageerror: ${e.message}`));
    page.on('response', (r) => { if (r.status() >= 400 && !page.expectHttpError) issues.push(`HTTP ${r.status()} ${r.request().method()} ${r.url()}`); });
    page.on('requestfailed', (r) => issues.push(`requestfailed ${r.url()}`));
    page.dialogs = [];
    page.on('dialog', (d) => { page.dialogs.push(d.message()); d.dismiss(); });
    await use(issues);
    expect(issues).toEqual([]);
  }, { auto: true }],
});

// Remove everything this run created (matched by RUN prefix).
test.afterAll(async ({ request }) => {
  const j = async (m, p) => { const r = await request.fetch(`/api/v1${p}`, { method: m }); return r.status() === 204 ? null : r.json(); };
  for (const q of [RUN, '<img']) {
    const res = await j('GET', `/tasks?q=${encodeURIComponent(q)}&size=100`);
    for (const t of res.items) if (t.title.includes(RUN) || t.title.startsWith('<img')) await j('DELETE', `/tasks/${t.id}`);
  }
  for (const p of await j('GET', '/projects?include_archived=true')) if (p.name.includes(RUN)) await j('DELETE', `/projects/${p.id}`);
  for (const t of await j('GET', '/tags')) if (t.name.includes(RUN)) await j('DELETE', `/tags/${t.id}`);
});

export { expect };
