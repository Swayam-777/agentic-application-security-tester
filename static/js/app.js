import { pingBackend } from "./api.js";
import { toast } from "./toast.js";
import { initWorkspace } from "./workspace.js";
import { renderOverview } from "./overview.js";
import { renderHistory } from "./history.js";
import { renderReports } from "./reports.js";
import { renderExplorer } from "./explorer.js";
import { initJudgeView } from "./judge.js";

const VIEW_META = {
  overview:   { title: "Overview",      crumb: "SentinelX / Overview" },
  workspace:  { title: "Assessments",   crumb: "SentinelX / Assessments" },
  explorer:   { title: "Vulnerabilities", crumb: "SentinelX / Vulnerabilities" },
  judge:      { title: "LLM Judge",     crumb: "SentinelX / LLM Judge" },
  history:    { title: "Run History",   crumb: "SentinelX / Run History" },
  reports:    { title: "Reports",       crumb: "SentinelX / Reports" },
  automation: { title: "Automations",   crumb: "SentinelX / Automations" },
  settings:   { title: "Settings",      crumb: "SentinelX / Settings" },
};

function setView(name) {
  if (!VIEW_META[name]) name = "overview";

  document.querySelectorAll(".view").forEach((v) => { v.hidden = true; });
  const target = document.getElementById("view-" + name);
  if (target) target.hidden = false;

  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.toggle("active", item.dataset.view === name);
  });

  document.getElementById("topbar-title").textContent = VIEW_META[name].title;
  document.getElementById("topbar-breadcrumb").textContent = VIEW_META[name].crumb;

  window.location.hash = name;
  loadView(name);
}

function loadView(name) {
  if (name === "overview") renderOverview();
  else if (name === "history") renderHistory(viewRunFromHistory);
  else if (name === "reports") renderReports();
  else if (name === "explorer") renderExplorer();
  else if (name === "judge") initJudgeView();
  // workspace is event-driven (buttons), nothing to load on entry.
}

function viewRunFromHistory(runId, category) {
  setView("judge");
  // Give the judge view a moment to populate its <select>, then pick this run.
  setTimeout(() => {
    const select = document.getElementById("judge-run-select");
    const value = `${runId}::${category}`;
    select.value = value;
    select.dispatchEvent(new Event("change"));
  }, 150);
}

// ---------- Sidebar nav wiring ----------

document.querySelectorAll(".nav-item").forEach((item) => {
  item.addEventListener("click", () => setView(item.dataset.view));
});

// ---------- Sidebar collapse ----------

const shell = document.getElementById("app-shell");
const collapseBtn = document.getElementById("collapse-btn");

function loadCollapsedPref() {
  try {
    return localStorage.getItem("sentinelx-sidebar-collapsed") === "1";
  } catch (e) {
    return false;
  }
}

function saveCollapsedPref(value) {
  try {
    localStorage.setItem("sentinelx-sidebar-collapsed", value ? "1" : "0");
  } catch (e) { /* ignore - private browsing etc. */ }
}

if (loadCollapsedPref()) shell.classList.add("sidebar-collapsed");

collapseBtn.addEventListener("click", () => {
  shell.classList.toggle("sidebar-collapsed");
  saveCollapsedPref(shell.classList.contains("sidebar-collapsed"));
});

// ---------- Theme toggle ----------

function loadTheme() {
  try {
    return localStorage.getItem("sentinelx-theme") || "dark";
  } catch (e) {
    return "dark";
  }
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  try { localStorage.setItem("sentinelx-theme", theme); } catch (e) { /* ignore */ }
}

applyTheme(loadTheme());

document.getElementById("theme-btn").addEventListener("click", () => {
  const current = document.documentElement.getAttribute("data-theme") || "dark";
  applyTheme(current === "dark" ? "light" : "dark");
});

document.getElementById("settings-theme-dark")?.addEventListener("click", () => applyTheme("dark"));
document.getElementById("settings-theme-light")?.addEventListener("click", () => applyTheme("light"));

// ---------- Backend connection status ----------

async function refreshConnStatus() {
  const dot = document.getElementById("conn-dot");
  const text = document.getElementById("conn-text");
  const settingsConn = document.getElementById("settings-conn");
  const ok = await pingBackend();
  dot.className = "conn-dot " + (ok ? "ok" : "bad");
  text.textContent = ok ? "Connected" : "Unreachable";
  if (settingsConn) {
    settingsConn.textContent = ok
      ? "Flask backend is reachable at this origin."
      : "Could not reach the Flask backend — is `python app.py` still running?";
  }
  return ok;
}

// ---------- Refresh button ----------

document.getElementById("refresh-btn").addEventListener("click", async () => {
  await refreshConnStatus();
  const current = window.location.hash.replace("#", "") || "overview";
  loadView(current);
  toast("Refreshed");
});

// ---------- Init ----------

initWorkspace(() => {
  // After a suite finishes, keep history/judge data fresh if the user
  // later navigates there - cheap to just let them re-fetch on entry,
  // nothing to do here beyond a toast (already handled in workspace.js).
});

refreshConnStatus();
setInterval(refreshConnStatus, 30000);

const initialView = window.location.hash.replace("#", "") || "overview";
setView(initialView);
