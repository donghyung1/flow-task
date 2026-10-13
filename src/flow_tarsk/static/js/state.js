import * as api from './api.js';

export const state = {
  counts: { today: 0, upcoming: 0, overdue: 0, inbox: 0 },
  projects: [],
  tags: [],
  selectedId: null,
};

// Minimal event bus: sidebar, task:open, task:selected, task:updated, task:deleted, task:reload
const subs = {};
export function on(evt, fn) {
  (subs[evt] ||= new Set()).add(fn);
  return () => subs[evt].delete(fn);
}
export function emit(evt, payload, src) {
  subs[evt]?.forEach((fn) => fn(payload, src));
}

on('task:selected', (id) => { state.selectedId = id; });

export async function refreshCounts() {
  try { state.counts = await api.getCounts({ silent: true }); emit('sidebar'); } catch { /* background */ }
}
export async function refreshProjects() {
  try { state.projects = await api.listProjects(false, { silent: true }); emit('sidebar'); } catch { /* background */ }
}
export async function refreshTags() {
  try { state.tags = await api.listTags({ silent: true }); emit('sidebar'); } catch { /* background */ }
}
export function refreshAll() {
  return Promise.all([refreshCounts(), refreshProjects(), refreshTags()]);
}
