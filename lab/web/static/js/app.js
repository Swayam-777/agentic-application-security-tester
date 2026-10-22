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
  mountModule(name);
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

const mounted = new Set();
function mountModule(name) {
  if (!name.startsWith("m-") || mounted.has(name)) return;
  mounted.add(name);
  const id = name.slice(2), root = document.getElementById("view-" + name);
  import(`/modules/${id}/ui.js`).then((m) => m.mount(root, V.ctx)).catch(() => root.replaceChildren(h("div", { cls: "callout", text: "This experiment could not be loaded." })));
}

async function loadModules() {
  let mods = [];
  try { mods = await (await fetch("/api/modules")).json(); } catch (e) { return; }
  if (!mods.length) return;
  document.getElementById("module-label").hidden = false;
  const nav = document.getElementById("module-nav"), main = document.querySelector(".main");
  for (const m of mods) {
    const name = "m-" + m.id;
    TITLES[name] = m.title;
    const b = h("button", { cls: "nav", "data-view": name }, [h("svg", {}), h("span", { text: m.title })]);
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg"), use = document.createElementNS("http://www.w3.org/2000/svg", "use");
    use.setAttribute("href", "#i-" + (m.icon || "bolt")); svg.append(use); b.replaceChild(svg, b.firstChild);
    b.onclick = () => show(name);
    nav.append(b);
    main.append(h("section", { cls: "view", id: "view-" + name, hidden: "" }));
    document.getElementById("view-" + name).hidden = true;
  }
}

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
  await loadModules();

  show(location.hash.slice(1) || "overview");
  refreshBadge();
  setInterval(refreshBadge, 20000);
}
boot();
