import { h } from '../dom.js';
import { pad } from '../util.js';

const WD = [['MO', '월'], ['TU', '화'], ['WE', '수'], ['TH', '목'], ['FR', '금'], ['SA', '토'], ['SU', '일']];
const FREQS = ['DAILY', 'WEEKLY', 'MONTHLY'];

function parse(rule) {
  const o = { freq: 'NONE', days: [], monthday: 1, interval: 1, until: '' };
  if (!rule) return o;
  const p = Object.fromEntries(rule.split(';').map((s) => s.split('=')));
  if (FREQS.includes(p.FREQ)) o.freq = p.FREQ;
  if (p.BYDAY) o.days = p.BYDAY.split(',');
  if (p.BYMONTHDAY) o.monthday = Number(p.BYMONTHDAY) || 1;
  if (p.INTERVAL) o.interval = Number(p.INTERVAL) || 1;
  const m = p.UNTIL && /^(\d{4})(\d\d)(\d\d)T(\d\d)(\d\d)(\d\d)Z$/.exec(p.UNTIL);
  if (m) {
    const d = new Date(Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +m[6]));
    o.until = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  return o;
}

// Returns { el, getValue() }. getValue returns an RRULE string or null; throws Error(message) when invalid.
export function createRecurrenceField(rule) {
  const cur = parse(rule);
  let touched = false;
  const sel = h('select', { id: 'd-rec', value: cur.freq },
    h('option', { value: 'NONE' }, '반복 안 함'),
    h('option', { value: 'DAILY' }, '매일'),
    h('option', { value: 'WEEKLY' }, '매주'),
    h('option', { value: 'MONTHLY' }, '매월'));
  const days = WD.map(([k, l]) => h('label', null, h('input', { type: 'checkbox', value: k, checked: cur.days.includes(k) }), l));
  const weekly = h('div', { class: 'weekdays', role: 'group', 'aria-label': '반복 요일' }, ...days);
  const monthday = h('input', { id: 'd-rec-md', type: 'number', min: '1', max: '31', value: String(cur.monthday) });
  const monthly = h('div', { class: 'field-row' }, h('label', { for: 'd-rec-md' }, '매월'), monthday, '일');
  const interval = h('input', { id: 'd-rec-int', type: 'number', min: '1', max: '99', value: String(cur.interval) });
  const until = h('input', { id: 'd-rec-until', type: 'date', value: cur.until });
  const opts = h('div', { class: 'field-row' },
    h('label', { for: 'd-rec-int' }, '간격'), interval,
    h('label', { for: 'd-rec-until' }, '종료일(선택)'), until);

  function sync() {
    weekly.hidden = sel.value !== 'WEEKLY';
    monthly.hidden = sel.value !== 'MONTHLY';
    opts.hidden = sel.value === 'NONE';
  }
  sel.addEventListener('change', sync);
  const el = h('fieldset', { class: 'field' }, h('legend', null, '반복'), sel, weekly, monthly, opts);
  el.addEventListener('change', () => { touched = true; });
  sync();

  function getValue() {
    if (!touched) return rule || null;
    const f = sel.value;
    if (f === 'NONE') return null;
    let s = `FREQ=${f}`;
    if (f === 'WEEKLY') {
      const picked = days.map((l) => l.firstChild).filter((c) => c.checked).map((c) => c.value);
      if (!picked.length) throw new Error('반복할 요일을 하나 이상 선택하세요.');
      s += `;BYDAY=${picked.join(',')}`;
    } else if (f === 'MONTHLY') {
      const d = Number(monthday.value);
      if (!(d >= 1 && d <= 31)) throw new Error('매월 반복일은 1~31 사이여야 합니다.');
      s += `;BYMONTHDAY=${d}`;
    }
    const n = Number(interval.value);
    if (n > 1) s += `;INTERVAL=${n}`;
    if (until.value) {
      const [y, m, d] = until.value.split('-').map(Number);
      const u = new Date(y, m - 1, d, 23, 59, 59);
      s += `;UNTIL=${u.getUTCFullYear()}${pad(u.getUTCMonth() + 1)}${pad(u.getUTCDate())}T${pad(u.getUTCHours())}${pad(u.getUTCMinutes())}${pad(u.getUTCSeconds())}Z`;
    }
    return s;
  }
  return { el, getValue };
}
