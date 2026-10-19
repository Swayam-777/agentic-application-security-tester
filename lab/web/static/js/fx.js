export const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
export const sleep = (ms) => new Promise((r) => setTimeout(r, reduced ? 0 : ms));

export function h(tag, props = {}, kids = []) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "cls") e.className = v;
    else if (k === "text") e.textContent = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  }
  for (const c of [].concat(kids)) if (c != null) e.append(c.nodeType ? c : document.createTextNode(c));
  return e;
}

export function icon(name) {
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const u = document.createElementNS("http://www.w3.org/2000/svg", "use");
  u.setAttribute("href", "#i-" + name);
  s.append(u);
  return s;
}

export async function typewriter(el, text, speed = 12) {
  el.textContent = "";
  if (reduced || speed <= 0) { el.textContent = text; return; }
  for (let i = 0; i < text.length; i += 2) {
    el.textContent = text.slice(0, i + 2);
    await sleep(speed);
  }
  el.textContent = text;
}

export function countUp(el, to, ms = 1100, suffix = "") {
  if (reduced) { el.textContent = to + suffix; return; }
  const t0 = performance.now();
  const step = (t) => {
    const p = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(to * e) + suffix;
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

export function toast(msg, bad = false) {
  const t = h("div", { cls: "toast" + (bad ? " err" : ""), text: msg });
  document.getElementById("toasts").append(t);
  setTimeout(() => t.remove(), 4200);
}

export function scoreColor(s) { return s >= 80 ? "var(--ok)" : s >= 50 ? "var(--warn)" : "var(--bad)"; }

export function gauge(score, animate = true) {
  const R = 52, C = 2 * Math.PI * R;
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 120 120");
  const mk = (cls) => {
    const c = document.createElementNS(NS, "circle");
    c.setAttribute("cx", 60); c.setAttribute("cy", 60); c.setAttribute("r", R);
    c.setAttribute("fill", "none"); c.setAttribute("stroke-width", 10); c.setAttribute("class", cls);
    return c;
  };
  const trk = mk("trk"), val = mk("val");
  val.setAttribute("stroke-dasharray", C); val.setAttribute("stroke-dashoffset", C);
  val.setAttribute("stroke", scoreColor(score));
  svg.append(trk, val);
  const num = h("b", { text: "0" });
  const wrap = h("div", { cls: "gauge" }, [svg, num]);
  const go = () => { val.setAttribute("stroke-dashoffset", C * (1 - score / 100)); countUp(num, score, 1300); };
  if (animate) requestAnimationFrame(() => setTimeout(go, 60)); else go();
  return wrap;
}

export function sparkline(values, w = 240, hgt = 36) {
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${w} ${hgt}`); svg.setAttribute("class", "spark"); svg.style.width = "100%"; svg.style.height = hgt + "px";
  if (values.length < 2) return svg;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * (w - 6) + 3},${hgt - 4 - (v / 100) * (hgt - 8)}`).join(" ");
  const p = document.createElementNS(NS, "polyline");
  p.setAttribute("points", pts); p.setAttribute("fill", "none"); p.setAttribute("stroke", "#38bdf8");
  p.setAttribute("stroke-width", 2.2); p.setAttribute("stroke-linecap", "round"); p.setAttribute("stroke-linejoin", "round");
  const len = w * 2; p.setAttribute("stroke-dasharray", len); p.setAttribute("stroke-dashoffset", len);
  p.style.transition = "stroke-dashoffset 1.4s ease";
  svg.append(p);
  requestAnimationFrame(() => setTimeout(() => p.setAttribute("stroke-dashoffset", 0), 50));
  return svg;
}

// spotlight that follows the cursor on every .spot card
document.addEventListener("pointermove", (e) => {
  const c = e.target.closest && e.target.closest(".spot");
  if (!c) return;
  const r = c.getBoundingClientRect();
  c.style.setProperty("--mx", e.clientX - r.left + "px");
  c.style.setProperty("--my", e.clientY - r.top + "px");
});
