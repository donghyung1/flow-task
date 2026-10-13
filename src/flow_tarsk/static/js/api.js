import { toast } from './components/toast.js';

const BASE = '/api/v1';
const MESSAGES = {
  TASK_NOT_FOUND: '할 일을 찾을 수 없습니다.',
  PROJECT_NOT_FOUND: '프로젝트를 찾을 수 없습니다.',
  TAG_NOT_FOUND: '태그를 찾을 수 없습니다.',
  TAG_NAME_CONFLICT: '이미 존재하는 태그 이름입니다.',
  SUBTASK_DEPTH_EXCEEDED: '하위 작업에는 하위 작업을 추가할 수 없습니다.',
  TOO_MANY_TAGS: '태그는 최대 10개까지 지정할 수 있습니다.',
  INVALID_RECURRENCE: '반복 규칙이 올바르지 않습니다.',
  VALIDATION_ERROR: '입력값이 올바르지 않습니다.',
};

export class ApiError extends Error {
  constructor(code, message, status, details) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export async function request(method, path, { query, body, silent } = {}) {
  let url = BASE + path;
  if (query) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null && v !== '') qs.set(k, v);
    const s = qs.toString();
    if (s) url += '?' + s;
  }
  const init = { method };
  if (body !== undefined) {
    init.headers = { 'Content-Type': 'application/json' };
    init.body = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(url, init);
  } catch {
    const err = new ApiError('NETWORK_ERROR', '서버에 연결할 수 없습니다.', 0);
    if (!silent) toast(err.message, 'error');
    throw err;
  }
  if (res.status === 204) return null;
  let data = null;
  try { data = await res.json(); } catch { /* non-JSON */ }
  if (!res.ok) {
    const e = data && data.error;
    const code = (e && e.code) || `HTTP_${res.status}`;
    const err = new ApiError(code, MESSAGES[code] || (e && e.message) || `요청에 실패했습니다 (${res.status})`, res.status, e && e.details);
    if (!silent) toast(err.message, 'error');
    throw err;
  }
  return data;
}

const get = (p, query, o) => request('GET', p, { query, ...o });

// tasks
export const getList = (path, query) => get(path, query);
export const getTask = (id) => get(`/tasks/${id}`);
export const createTask = (body) => request('POST', '/tasks', { body });
export const updateTask = (id, body) => request('PATCH', `/tasks/${id}`, { body });
export const deleteTask = (id) => request('DELETE', `/tasks/${id}`);
export const completeTask = (id) => request('POST', `/tasks/${id}/complete`);
export const reopenTask = (id) => request('POST', `/tasks/${id}/reopen`);
export const addSubtask = (id, body) => request('POST', `/tasks/${id}/subtasks`, { body });
export const reorderTasks = (items) => request('PATCH', '/tasks/reorder', { body: { items } });
// views / stats
export const getCounts = (o) => get('/views/counts', undefined, o);
export const getStats = (days) => get('/stats', { days });
// projects
export const listProjects = (archived, o) => get('/projects', { include_archived: archived ? 'true' : 'false' }, o);
export const getProject = (id) => get(`/projects/${id}`);
export const createProject = (body) => request('POST', '/projects', { body });
export const updateProject = (id, body) => request('PATCH', `/projects/${id}`, { body });
export const deleteProject = (id) => request('DELETE', `/projects/${id}`);
// tags
export const listTags = (o) => get('/tags', undefined, o);
export const createTag = (body) => request('POST', '/tags', { body });
export const updateTag = (id, body) => request('PATCH', `/tags/${id}`, { body });
export const deleteTag = (id) => request('DELETE', `/tags/${id}`);
