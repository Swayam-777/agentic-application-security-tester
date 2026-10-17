// ------------------------------------------------------------
// Small helpers
// ------------------------------------------------------------

const CATEGORY_LABELS = window.CATEGORY_LABELS || {};

// Builds an element and sets its text with textContent (never innerHTML),
// because attack payloads and agent output can contain anything - including
// HTML - and must be displayed as plain text, not interpreted.
function el(tag, options = {}, children = []) {
  const node = document.createElement(tag);
  if (options.cls) node.className = options.cls;
  if (options.text !== undefined) node.textContent = options.text;
  if (options.title) node.title = options.title;
  for (const child of children) node.appendChild(child);
  return node;
}

function formatDate(iso) {
  if (!iso) return "-";
  const date = new Date(iso);
  if (isNaN(date)) return iso;
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function categoryLabel(key) {
  return CATEGORY_LABELS[key] || key;
}

function shorten(text, max) {
  const flat = (text || "").replace(/\s+/g, " ").trim();
  return flat.length > max ? flat.slice(0, max) + "…" : flat;
}

async function postJSON(url) {
  const response = await fetch(url, { method: "POST" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Server responded with ${response.status}`);
  }
  return data;
}

// ------------------------------------------------------------
// Status line + busy state
// ------------------------------------------------------------

function showStatus(message, kind) {
  const status = document.getElementById("status");
  status.textContent = message;
  status.className = "status status-" + kind;
  status.hidden = false;
}

function hideStatus() {
  document.getElementById("status").hidden = true;
}

let busy = false;

function setBusy(value) {
  busy = value;
  document.querySelectorAll(".btn").forEach((button) => {
    button.disabled = value;
  });
}

// ------------------------------------------------------------
// Quick test (one agent, one run)
// ------------------------------------------------------------

async function runQuickTest(agentId) {
  if (busy) return;
  setBusy(true);
  showStatus("Running quick test…", "info");

  try {
    const result = await postJSON(`/run-test/${agentId}`);
    hideStatus();
    renderQuickResult(result);
  } catch (err) {
    showStatus(err.message, "error");
  } finally {
    setBusy(false);
  }
}

function renderQuickResult(result) {
  const panel = document.getElementById("quick-panel");
  const badge = document.getElementById("quick-badge");
  const actions = document.getElementById("quick-actions");

  panel.hidden = false;
  badge.textContent = result.verdict;
  badge.className = "verdict-badge verdict-" + result.verdict.toLowerCase();
  document.getElementById("quick-message").textContent = result.message;

  actions.replaceChildren();
  if (result.actions && result.actions.length > 0) {
    actions.appendChild(el("h3", { text: "Tool calls made" }));
    actions.appendChild(el("pre", { text: JSON.stringify(result.actions, null, 2) }));
  } else {
    actions.appendChild(el("p", { text: "No tool calls were made." }));
  }
}

// ------------------------------------------------------------
// Attack suite (the attack engine, several attacks, one report)
// ------------------------------------------------------------

async function runAttackSuite(agentId) {
  if (busy) return;
  setBusy(true);
  showStatus(
    "Running attack suite… this makes about 5 Gemini requests and can take up to a minute. " +
    "Progress prints in the terminal running Flask.",
    "info"
  );

  try {
    const report = await postJSON(`/run-attack-suite/${agentId}`);
    hideStatus();
    renderReport(report);
    await loadHistory();
    document.getElementById("report-panel").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (err) {
    showStatus(err.message, "error");
  } finally {
    setBusy(false);
  }
}

function tile(label, number, rate, tone) {
  const numberClass = "tile-number" + (tone ? " is-" + tone : "");
  const children = [
    el("div", { cls: numberClass, text: String(number) }),
    el("div", { cls: "tile-label", text: label }),
  ];
  if (rate !== null) {
    children.push(el("div", { cls: "tile-rate", text: rate.toFixed(1) + "%" }));
  }
  return el("div", { cls: "tile" }, children);
}

function renderReport(report) {
  document.getElementById("report-panel").hidden = false;

  document.getElementById("report-meta").textContent =
    `${categoryLabel(report.category)}  ·  run ${report.run_id}  ·  ${formatDate(report.started)}`;

  const tiles = document.getElementById("report-tiles");
  tiles.replaceChildren(
    tile("Tests run", report.total_tests, null),
    tile("Resisted", report.resisted, report.resistance_rate, report.resisted > 0 ? "safe" : ""),
    tile("Vulnerable", report.vulnerable, report.vulnerability_rate, report.vulnerable > 0 ? "danger" : ""),
    tile("Needs review", report.review, report.review_rate, "")
  );

  const body = document.getElementById("report-body");
  body.replaceChildren();

  for (const test of report.tests) {
    const payload = el("details", { cls: "payload" }, [
      el("summary", { text: shorten(test.payload, 80) }),
      el("p", { text: test.payload || "" }),
    ]);

    const pill = el("span", {
      cls: "verdict-pill verdict-" + String(test.result).toLowerCase(),
      text: test.result,
    });

    body.appendChild(el("tr", {}, [
      el("td", { text: String(test.test_id) }),
      el("td", {}, [payload]),
      el("td", { text: test.agent_response || "" }),
      el("td", {}, [pill]),
      el("td", { text: test.reason || "" }),
    ]));
  }
}

// ------------------------------------------------------------
// Run history (read from disk, so it survives refreshes)
// ------------------------------------------------------------

async function loadHistory() {
  const response = await fetch("/api/history");
  const runs = await response.json();

  const body = document.getElementById("history-body");
  body.replaceChildren();
  document.getElementById("no-history").hidden = runs.length > 0;

  for (const run of runs) {
    const viewButton = el("button", { cls: "btn btn-secondary btn-small", text: "View" });
    viewButton.addEventListener("click", () => viewRun(run.run_id, run.category));

    body.appendChild(el("tr", {}, [
      el("td", { text: formatDate(run.started) }),
      el("td", { cls: "mono", text: categoryLabel(run.category) }),
      el("td", { text: String(run.total_tests) }),
      el("td", { text: String(run.resisted) }),
      el("td", { text: String(run.vulnerable) }),
      el("td", { text: String(run.review) }),
      el("td", {}, [viewButton]),
    ]));
  }
}

async function viewRun(runId, categoryKey) {
  if (busy) return;
  try {
    const response = await fetch(
      `/api/report/${encodeURIComponent(runId)}/${encodeURIComponent(categoryKey)}`
    );
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not load that run.");
    renderReport(data);
    document.getElementById("report-panel").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (err) {
    showStatus(err.message, "error");
  }
}

// ------------------------------------------------------------
// Wire up the buttons and load saved history
// ------------------------------------------------------------

document.querySelectorAll("[data-action]").forEach((button) => {
  button.addEventListener("click", () => {
    const agentId = button.dataset.agent;
    if (button.dataset.action === "suite") runAttackSuite(agentId);
    else runQuickTest(agentId);
  });
});

loadHistory();
