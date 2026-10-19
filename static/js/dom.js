// Small shared DOM helpers used across every view module.
// el() always uses textContent (never innerHTML) for untrusted backend
// text - attack payloads and agent output can contain anything, including
// HTML, and must render as plain text, not be interpreted.

export function el(tag, options = {}, children = []) {
  const node = document.createElement(tag);
  if (options.cls) node.className = options.cls;
  if (options.text !== undefined) node.textContent = options.text;
  if (options.title) node.title = options.title;
  if (options.attrs) {
    for (const [k, v] of Object.entries(options.attrs)) node.setAttribute(k, v);
  }
  for (const child of children) node.appendChild(child);
  return node;
}

export function formatDate(iso) {
  if (!iso) return "-";
  const date = new Date(iso);
  if (isNaN(date)) return iso;
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

const CATEGORY_LABELS = window.CATEGORY_LABELS || {};

export function categoryLabel(key) {
  return CATEGORY_LABELS[key] || key;
}

export function shorten(text, max) {
  const flat = (text || "").replace(/\s+/g, " ").trim();
  return flat.length > max ? flat.slice(0, max) + "…" : flat;
}

export function verdictClass(verdict) {
  return "pill-" + String(verdict || "").toLowerCase();
}

export function clear(node) {
  node.replaceChildren();
}
