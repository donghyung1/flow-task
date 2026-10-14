// Tiny DOM helpers. User data is only ever inserted via text nodes / textContent.
const SVG_NS = 'http://www.w3.org/2000/svg';
const PROPS = new Set(['value', 'checked', 'disabled', 'hidden', 'selected', 'textContent', 'className']);

export function append(el, kids) {
  for (const c of kids.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  for (const [k, raw] of Object.entries(attrs || {})) {
    let v = raw;
    if (typeof v === 'boolean' && (k.startsWith('aria-') || k === 'draggable')) v = String(v);
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.length > 2 && k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (PROPS.has(k)) el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, children);
  if (tag === 'select' && attrs && attrs.value != null) el.value = attrs.value;
  return el;
}

export function svg(tag, attrs, ...children) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) if (v != null) el.setAttribute(k, v);
  for (const c of children.flat()) if (c != null) el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return el;
}

// Colored dot; color is passed through a CSS custom property (CSSOM, CSP-safe).
export function dot(color) {
  const el = h('span', { class: 'dot', 'aria-hidden': 'true' });
  if (color) el.style.setProperty('--c', color);
  return el;
}

export const $ = (id) => document.getElementById(id);
