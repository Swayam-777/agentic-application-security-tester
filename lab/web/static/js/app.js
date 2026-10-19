import { api } from "./api.js";
import { startHero } from "./hero.js";
import { h, toast } from "./fx.js";
import * as V from "./views.js";

const TITLES = { overview: "Overview", lab: "Run Lab", history: "History", automation: "Automation", alerts: "Alerts" };

async function refreshBadge() {
  const list = await api.alerts().catch(() => []);
  const n = list.filter((a) => !a.read).length;
  const b = document.getElementById("alert-badge");
  b.hidden = !n; b.textContent = n;
  document.getElementById("bell-ping").hidden = !n;
}

function show(name, opts) {
  if (!TITLES[name]) name = "overview";
  document.querySelectorAll(".view").forEach((v) => (v.hidden = v.id !== "view-" + name));
  document.querySelectorAll(".nav").forEach((n) => n.classList.toggle("active", n.dataset.view === name));
  document.getElementById("page-title").textContent = TITLES[name];
  location.hash = name;
  if (name === "overview") V.renderOverview();
  if (name === "lab") V.initLab(opts && opts.agents);
  if (name === "history") V.renderHistory();
  if (name === "automation") V.renderAutomation();
  if (name === "alerts") V.renderAlerts().then(refreshBadge);
}
V.ctx.go = show;

function setTheme(t) { document.documentElement.dataset.theme = t; try { localStorage.setItem("ag-theme", t); } catch (e) { /* ignore */ } }

async function boot() {
  try { setTheme(localStorage.getItem("ag-theme") || "dark"); } catch (e) { /* ignore */ }
  try { V.ctx.meta = await api.state(); }
  catch (e) { document.querySelector(".main").prepend(h("div", { cls: "callout", text: e.message })); return; }
  const m = V.ctx.meta;
  document.title = m.brand;

  const pill = document.getElementById("mode-pill");
  pill.classList.add(m.live ? "live" : "demo");
  document.getElementById("mode-text").textContent = m.live ? "Live testing ready" : "Simulated demo mode";
  document.getElementById("provider-chips").replaceChildren(...m.providers.map((p) => h("span", { cls: "chip", text: p.label })));
  document.getElementById("hero-demo").hidden = !m.live;

  startHero(document.getElementById("hero-canvas"));
  document.querySelectorAll(".nav").forEach((n) => (n.onclick = () => show(n.dataset.view)));
  document.getElementById("bell-btn").onclick = () => show("alerts");
  document.getElementById("theme-btn").onclick = () => setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
  document.getElementById("hero-run").onclick = () => { show("lab"); };
  document.getElementById("hero-demo").onclick = () => { show("lab"); document.querySelector('#mode-seg [data-mode="demo"]').click(); };
  document.getElementById("start-btn").onclick = V.startTest;
  document.getElementById("exp-csv").onclick = () => V.exportAll("csv");
  document.getElementById("exp-json").onclick = () => V.exportAll("json");
  document.getElementById("mark-read").onclick = async () => { await api.readAlerts(); V.renderAlerts(); refreshBadge(); };
  V.initScheduleForm();

  show(location.hash.slice(1) || "overview");
  refreshBadge();
  setInterval(refreshBadge, 20000);
}
boot();
