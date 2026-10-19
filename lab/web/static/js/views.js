import { h, countUp, gauge, sparkline, toast, typewriter } from "./fx.js";
import { api } from "./api.js";
import { createPlayer, runToEvents } from "./player.js";
import { exportRunsCsv, exportRunsJson } from "./export.js";

export const ctx = { meta: null, runs: [], go: () => {} };
const fmt = (ts) => new Date(ts * 1000).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });

/* ---------- Overview ---------- */
export async function renderOverview() {
  ctx.runs = await api.runs().catch(() => []);
  const real = ctx.runs.filter((r) => !r.incomplete);
  const latest = {};
  for (const r of [...real].reverse()) latest[r.agent] = r;       // newest per agent
  const issues = real.reduce((s, r) => s + (r.issues || 0), 0);
  const missed = real.reduce((s, r) => s + (r.agent_missed || 0), 0);
  const scores = Object.values(latest).map((r) => r.score);
  const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

  const tiles = document.getElementById("tiles");
  tiles.replaceChildren();
  [["Tests run", real.length, ""], ["Agents covered", Object.keys(latest).length, ""], ["Issues found", issues, "warn"],
   ["Average resistance", avg, "", "%"]].forEach(([l, n, c, suf], i) => {
    const nb = h("div", { cls: "n", text: "0" });
    tiles.append(h("div", { cls: "tile " + c, style: `animation-delay:${i * 90}ms` }, [nb, h("div", { cls: "l", text: l })]));
    countUp(nb, n, 1100, suf || "");
  });

  const hl = document.getElementById("headline");
  if (missed > 0) {
    hl.hidden = false;
    hl.replaceChildren(h("div", {}, [h("strong", { text: `The jury caught ${missed} issue${missed > 1 ? "s" : ""} the agents missed. ` }),
      document.createTextNode("In these cases the agent said it followed its rules, but the evidence showed it did not.")]));
  } else hl.hidden = true;

  const ps = await api.providerStats().catch(() => []);
  const tr = document.getElementById("trust");
  tr.hidden = !ps.length;
  if (ps.length) {
    tr.replaceChildren(h("h3", { text: "Which AI the jury trusts most" }),
      h("p", { cls: "muted", text: "Each AI earns trust by how often its verdict matches the final jury decision. Trusted AIs count more." }),
      ...ps.map((p) => { const bar = h("i", { style: "display:block;height:8px;border-radius:99px;width:0;background:linear-gradient(90deg,var(--acc),var(--acc2));transition:width 1.2s" });
        setTimeout(() => (bar.style.width = p.trust + "%"), 80);
        return h("div", { style: "margin:10px 0" }, [h("div", { style: "display:flex;justify-content:space-between", }, [h("span", { text: p.name }), h("span", { cls: "muted", text: `${p.trust}% · ${p.total} verdicts` })]),
          h("div", { style: "background:rgba(120,150,220,.14);border-radius:99px" }, [bar])]); }));
  }
  const grid = document.getElementById("agent-grid");
  grid.replaceChildren();
  ctx.meta.agents.forEach((a, i) => {
    const hist = real.filter((r) => r.agent === a.id).map((r) => r.score).reverse();
    const l = latest[a.id];
    grid.append(h("div", { cls: "card spot agent-card", style: `animation-delay:${i * 110}ms` }, [
      h("div", { cls: "top-row" }, [h("div", {}, [h("h3", { text: a.name }), h("p", { cls: "muted", text: a.blurb })]), h("span", { cls: "tag", text: a.category })]),
      l ? gauge(l.score) : h("p", { cls: "muted", style: "padding:34px 0;text-align:center", text: "Not tested yet" }),
      l ? h("p", { cls: "muted", style: "text-align:center", text: l.breaking_point ? `Broke at level ${l.breaking_point}` : "Held every level" }) : null,
      hist.length > 1 ? sparkline(hist) : null,
      h("button", { cls: "btn ghost small", style: "margin-top:12px", text: "Test this agent", onclick: () => ctx.go("lab", { agents: [a.id] }) }),
    ]));
  });
}

/* ---------- Run Lab ---------- */
let selected = new Set(), mode = "live", running = false;

function pickers(host, set, onchange) {
  host.replaceChildren();
  for (const a of ctx.meta.agents) {
    const b = h("button", { type: "button", cls: "pick" + (set.has(a.id) ? " on" : "") }, [
      h("strong", { text: a.name }), h("small", { text: `${a.category} · ${a.risk}` })]);
    b.onclick = () => { set.has(a.id) ? set.delete(a.id) : set.add(a.id); b.classList.toggle("on"); onchange && onchange(); };
    host.append(b);
  }
}

export function initLab(preselect) {
  if (preselect) selected = new Set(preselect);
  if (!selected.size) selected = new Set(ctx.meta.agents.map((a) => a.id));
  pickers(document.getElementById("agent-select"), selected);
  const seg = document.getElementById("mode-seg");
  seg.hidden = !ctx.meta.live;
  document.getElementById("seg-project").hidden = !ctx.meta.project_agents;
  mode = ctx.meta.live ? mode : "demo";
  seg.querySelectorAll("button").forEach((b) => {
    b.classList.toggle("on", b.dataset.mode === mode);
    b.onclick = () => { mode = b.dataset.mode; seg.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b)); };
  });
}

export async function startTest() {
  if (running) return;
  if (!selected.size) return toast("Choose at least one agent to test.", true);
  const btn = document.getElementById("start-btn");
  const stage = document.getElementById("stage");
  running = true; btn.disabled = true;
  stage.replaceChildren();
  try {
    const { job } = await api.start([...selected], mode);
    const player = createPlayer(stage, ctx.meta);
    let since = 0, status = "running";
    while (status === "running") {
      const r = await api.job(job, since);
      since = r.next; status = r.status;
      if (r.events.length) player.push(r.events);
      await new Promise((res) => setTimeout(res, 600));
    }
    const r = await api.job(job, since);
    if (r.events.length) player.push(r.events);
    await player.finished();
    toast("Test complete");
  } catch (e) { toast(e.message, true); }
  running = false; btn.disabled = false;
}

export async function replay(runId) {
  ctx.go("lab");
  const stage = document.getElementById("stage");
  stage.replaceChildren();
  try {
    const run = await api.run(runId);
    createPlayer(stage, ctx.meta, { fast: true }).push(runToEvents(run, ctx.meta));
  } catch (e) { toast(e.message, true); }
}

/* ---------- History ---------- */
const COLORS = ["#38bdf8", "#a78bfa", "#34d399", "#fbbf24"];
function drawTrend(canvas, runs) {
  const dpr = Math.min(2, devicePixelRatio || 1);
  const W = canvas.clientWidth, H = 220;
  canvas.width = W * dpr; canvas.height = H * dpr;
  const c = canvas.getContext("2d"); c.setTransform(dpr, 0, 0, dpr, 0, 0);
  const light = document.documentElement.dataset.theme === "light";
  const grid = light ? "rgba(60,90,150,.15)" : "rgba(130,160,230,.14)", txt = light ? "#53648b" : "#8b9bc2";
  const padL = 34, padB = 22, w = W - padL - 10, hh = H - padB - 10;
  c.font = "11px system-ui"; c.fillStyle = txt; c.strokeStyle = grid;
  for (let v = 0; v <= 100; v += 25) { const y = 10 + hh - (v / 100) * hh; c.beginPath(); c.moveTo(padL, y); c.lineTo(W - 6, y); c.stroke(); c.fillText(v, 4, y + 4); }
  const ids = ctx.meta.agents.map((a) => a.id);
  const series = ids.map((id) => runs.filter((r) => r.agent === id).sort((a, b) => a.ts - b.ts));
  const maxN = Math.max(2, ...series.map((s) => s.length));
  const start = performance.now();
  const anim = (t) => {
    const p = Math.min(1, (t - start) / 1100);
    c.clearRect(padL - 1, 0, W, H - padB + 6);
    c.strokeStyle = grid;
    for (let v = 0; v <= 100; v += 25) { const y = 10 + hh - (v / 100) * hh; c.beginPath(); c.moveTo(padL, y); c.lineTo(W - 6, y); c.stroke(); }
    series.forEach((s, k) => {
      if (!s.length) return;
      c.strokeStyle = COLORS[k % 4]; c.fillStyle = COLORS[k % 4]; c.lineWidth = 2.4; c.lineJoin = "round";
      const pts = s.map((r, i) => [padL + (i / (maxN - 1)) * w, 10 + hh - (r.score / 100) * hh]);
      const upto = Math.max(1, Math.floor(1 + p * (pts.length - 1)));
      c.beginPath(); pts.slice(0, upto).forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke();
      pts.slice(0, upto).forEach(([x, y]) => { c.beginPath(); c.arc(x, y, 3.5, 0, 7); c.fill(); });
    });
    if (p < 1) requestAnimationFrame(anim);
  };
  requestAnimationFrame(anim);
}

export async function renderHistory() {
  const runs = await api.runs().catch(() => []);
  ctx.runs = runs;
  const empty = document.getElementById("trend-empty"), cv = document.getElementById("trend");
  const real = runs.filter((r) => !r.incomplete);
  empty.hidden = real.length > 1; cv.hidden = real.length <= 1;
  document.getElementById("trend-legend").replaceChildren(...ctx.meta.agents.map((a, i) =>
    h("span", {}, [h("i", { style: `background:${COLORS[i % 4]}` }), a.name])));
  if (real.length > 1) drawTrend(cv, real);

  const pr = await api.projectRuns().catch(() => []);
  const ph = document.getElementById("project-runs");
  ph.replaceChildren();
  if (pr.length) {
    ph.append(h("h3", { text: "Earlier dashboard runs" }), h("div", { cls: "table-wrap" }, [h("table", {}, [
      h("thead", {}, [h("tr", {}, ["Run", "Category", "Tests", "Vulnerable", "Needs review"].map((t) => h("th", { text: t })))]),
      h("tbody", {}, pr.slice(0, 15).map((r) => h("tr", {}, [r.id, r.category, r.total, r.vulnerable, r.review].map((v) => h("td", { text: String(v ?? "") })))))])]));
  }
  const host = document.getElementById("history-table");
  if (!runs.length) { host.replaceChildren(h("div", { cls: "empty", text: "No tests yet. Run your first pressure test to see it here." })); return; }
  const rows = runs.map((r, i) => h("tr", { style: `animation-delay:${Math.min(i, 12) * 40}ms` }, [
    h("td", { text: fmt(r.ts) }), h("td", { text: r.agent_name }),
    h("td", {}, [h("span", { cls: "pill " + (r.score >= 80 ? "good" : r.score >= 50 ? "mid" : "bad"), text: r.score + "%" })]),
    h("td", { text: r.breaking_point ? `Level ${r.breaking_point}` : "Held all" }),
    h("td", { text: r.issues ?? 0 }),
    h("td", { text: (r.demo ? "Simulated" : "Live") + (r.source === "schedule" ? " · scheduled" : "") }),
    h("td", {}, [h("button", { cls: "btn ghost small", text: "Replay", onclick: () => replay(r.id) })]),
  ]));
  host.replaceChildren(h("table", {}, [
    h("thead", {}, [h("tr", {}, ["When", "Agent", "Resistance", "Broke at", "Issues", "Mode", ""].map((t) => h("th", { text: t })))]),
    h("tbody", {}, rows)]));
}

export async function exportAll(kind) {
  const full = await Promise.all(ctx.runs.map((r) => api.run(r.id).catch(() => null)));
  const ok = full.filter(Boolean);
  if (!ok.length) return toast("Nothing to export yet.", true);
  kind === "csv" ? exportRunsCsv(ok, "history") : exportRunsJson(ok, "history");
}

/* ---------- Automation ---------- */
const sel = new Set();
let ticker = null;
const every = { 15: "Every 15 minutes", 60: "Every hour", 360: "Every 6 hours", 1440: "Every day" };
const clock = (s) => { s = Math.max(0, Math.round(s)); const hh = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return `${hh ? hh + "h " : ""}${String(m).padStart(2, "0")}m ${String(s % 60).padStart(2, "0")}s`; };

export async function renderAutomation() {
  if (!sel.size) ctx.meta.agents.forEach((a) => sel.add(a.id));
  pickers(document.getElementById("sched-agents"), sel);
  const list = document.getElementById("sched-list");
  const items = await api.schedules().catch(() => []);
  list.replaceChildren();
  if (!items.length) list.append(h("div", { cls: "card empty", text: "No schedules yet. Create one above and your agents will be re-tested automatically." }));
  const counters = [];
  items.forEach((s, i) => {
    const cd = h("div", { cls: "count", text: "--" });
    counters.push([cd, s]);
    const sw = h("button", { cls: "switch" + (s.enabled ? " on" : ""), title: "Pause or resume" });
    sw.onclick = async () => { await api.editSchedule(s.id, { enabled: !s.enabled }); renderAutomation(); };
    list.append(h("div", { cls: "card spot sched", style: `animation-delay:${i * 90}ms` }, [
      h("div", { style: "display:flex;align-items:center" }, [h("h3", { text: s.name }), sw]),
      h("p", { cls: "meta", text: `${every[s.every_minutes] || `Every ${s.every_minutes} minutes`} · ${s.agents.length} agent${s.agents.length > 1 ? "s" : ""}` }),
      h("p", { cls: "muted", text: s.enabled ? "Next check in" : "Paused" }), s.enabled ? cd : null,
      h("div", { cls: "acts-row" }, [
        h("button", { cls: "btn ghost small", text: "Run now", onclick: async () => { try { await api.runSchedule(s.id); toast("Check started. Results appear in History."); } catch (e) { toast(e.message, true); } } }),
        h("button", { cls: "btn ghost small", text: "Delete", onclick: async () => { await api.delSchedule(s.id); renderAutomation(); } })]),
    ]));
  });
  clearInterval(ticker);
  ticker = setInterval(() => counters.forEach(([el, s]) => { el.textContent = clock(s.next_run - Date.now() / 1000); }), 1000);
}

export function initScheduleForm() {
  document.getElementById("sched-form").onsubmit = async (e) => {
    e.preventDefault();
    try {
      await api.newSchedule({ name: document.getElementById("sched-name").value, agents: [...sel], every_minutes: +document.getElementById("sched-every").value });
      document.getElementById("sched-name").value = "";
      toast("Schedule created");
      renderAutomation();
    } catch (er) { toast(er.message, true); }
  };
}

/* ---------- Alerts ---------- */
export async function renderAlerts() {
  const list = await api.alerts().catch(() => []);
  const host = document.getElementById("alert-list");
  host.replaceChildren();
  if (!list.length) host.append(h("div", { cls: "empty", text: "All quiet. You will be alerted here if an agent gets weaker between tests." }));
  list.forEach((a, i) => host.append(h("div", { cls: `alert ${a.severity}${a.read ? "" : " unread"}`, style: `animation-delay:${i * 50}ms` }, [
    h("div", {}, [h("div", { text: a.text }), h("small", { text: fmt(a.ts) })])])));
  return list.filter((a) => !a.read).length;
}
