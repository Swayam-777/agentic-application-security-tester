// Shared building blocks for experiment modules (each module's ui.js imports this).
import { h, toast } from "./fx.js";
import { api, friendly } from "./api.js";

export async function post(path, body) {
  let res;
  try { res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) }); }
  catch (e) { throw new Error(friendly("network")); }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(friendly(data && data.error && data.error.code, data && data.error && data.error.message));
  return data;
}
export const get = (path) => fetch(path).then((r) => r.json());

export function download(name, obj) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" }));
  const a = document.createElement("a"); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function pill(verdict) {
  const cls = verdict === "VULNERABLE" ? "bad" : verdict === "RESISTED" ? "good" : "mid";
  const txt = verdict === "VULNERABLE" ? "Fooled" : verdict === "RESISTED" ? "Held" : "Review";
  return h("span", { cls: "pill " + cls, text: txt });
}

export function demoBadge(isDemo) { return isDemo ? h("span", { cls: "badge-demo", text: "Simulated demo" }) : null; }

export function steps(list) {
  const wrap = h("div", { style: "display:flex;flex-direction:column;gap:6px;margin-top:8px" });
  for (const s of list) {
    const cls = s.kind === "attack" ? "bubble attack" : s.kind === "agent" ? "bubble agent" : "bubble";
    const label = { user: "User", attack: "Attack", agent: "Agent", tool: "Tool", note: "Memory" }[s.kind] || s.kind;
    const b = h("div", { cls, style: s.kind === "tool" || s.kind === "note" ? "background:rgba(251,191,36,.10);border-left:3px solid var(--warn)" : s.kind === "user" ? "background:rgba(120,150,220,.08)" : "" },
      [h("label", { text: label }), h("div", { text: s.text })]);
    if (s.actions && s.actions.length) {
      const row = h("div", { cls: "acts" });
      for (const a of s.actions) row.append(h("span", { cls: "act", text: `${a.tool}(${Object.values(a.args || {}).map(String).join(", ").slice(0, 60)})` }));
      b.append(row);
    }
    wrap.append(b);
  }
  return wrap;
}

// Starts a module job and streams its events. Returns when the job is done.
export async function runJob(path, body, { status, onResult, stopBtn, runBtn }) {
  runBtn.disabled = true; stopBtn.hidden = false; stopBtn.disabled = false;
  let jobId = null, finished = false, since = 0;
  stopBtn.onclick = () => { stopBtn.disabled = true; status.textContent = "Stopping…"; if (jobId) api.cancel(jobId).catch(() => {}); };
  status.hidden = false; status.textContent = "Starting…";
  try {
    const { job } = await post(path, body);
    jobId = job;
    while (!finished) {
      const r = await api.job(job, since);
      since = r.next;
      for (const ev of r.events) {
        if (ev.type === "status") status.textContent = ev.text;
        else if (ev.type === "result") onResult(ev.data);
        else if (ev.type === "error") status.textContent = friendly(ev.code);
        else if (ev.type === "job_done") finished = true;
      }
      if (!finished) await new Promise((res) => setTimeout(res, 800));
    }
    if (!/busy|wrong/i.test(status.textContent)) status.textContent = "Finished.";
  } catch (e) { status.textContent = e.message; toast(e.message, true); }
  runBtn.disabled = false; stopBtn.hidden = true;
}

// Standard panel: title, explanation, agent chips, run/stop, status, results area.
export function panel(root, { title, intro, how, ctx, withAgents = true, extraControls = [] }) {
  root.replaceChildren();
  const picked = new Set(ctx.meta.agents.map((a) => a.id));
  const chips = h("div", { cls: "chips-select" });
  if (withAgents) for (const a of ctx.meta.agents) {
    const b = h("button", { type: "button", cls: "pick on" }, [h("strong", { text: a.name }), h("small", { text: a.risk })]);
    b.onclick = () => { picked.has(a.id) ? picked.delete(a.id) : picked.add(a.id); b.classList.toggle("on"); };
    chips.append(b);
  }
  const runBtn = h("button", { cls: "btn primary glow", text: "Run experiment" });
  const stopBtn = h("button", { cls: "btn ghost", text: "Stop", hidden: "" }); stopBtn.hidden = true;
  const status = h("div", { cls: "callout", hidden: "" }); status.hidden = true;
  const out = h("div");
  root.append(h("div", { cls: "card spot" }, [h("h3", { text: title }), h("p", { cls: "muted", text: intro }),
    how ? h("p", { cls: "muted", style: "margin-top:6px", text: "How it works: " + how }) : null,
    withAgents ? chips : null, ...extraControls,
    h("div", { cls: "setup-row", style: "margin-top:12px" }, [runBtn, stopBtn])]), status, out);
  return { picked, runBtn, stopBtn, status, out };
}
