export const PRIORITY = { NONE: '없음', LOW: '낮음', MEDIUM: '보통', HIGH: '높음' };
export const STATUS = { TODO: '할 일', IN_PROGRESS: '진행 중', DONE: '완료' };
const DAYS = ['일', '월', '화', '수', '목', '금', '토'];
export const pad = (n) => String(n).padStart(2, '0');

export const toUtcIso = (d) => d.toISOString().replace(/\.\d{3}Z$/, 'Z');

export function localInputValue(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export const inputToUtc = (v) => (v ? toUtcIso(new Date(v)) : null);

// local day (offset days from today) 23:59 -> UTC ISO
export function endOfDayUtc(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  d.setHours(23, 59, 0, 0);
  return toUtcIso(d);
}

export function fmtDue(iso) {
  const d = new Date(iso);
  const now = new Date();
  const day0 = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate());
  const diff = Math.round((day0(d) - day0(now)) / 86400000);
  let day;
  if (diff === 0) day = '오늘';
  else if (diff === 1) day = '내일';
  else if (diff === -1) day = '어제';
  else {
    day = `${d.getMonth() + 1}월 ${d.getDate()}일 (${DAYS[d.getDay()]})`;
    if (d.getFullYear() !== now.getFullYear()) day = `${d.getFullYear()}년 ${day}`;
  }
  return `${day} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const isOverdue = (t) => !!t.due_at && t.status !== 'DONE' && new Date(t.due_at) < new Date();
