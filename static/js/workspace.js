import { api } from "./api.js";
import { el, categoryLabel, shorten, formatDate, verdictClass } from "./dom.js";
import { toast, statusLine } from "./toast.js";

let busy = false;

function setBusy(value) {
  busy = value;
  document.querySelectorAll(".btn").forEach((b) => { b.disabled = value; });
}

function renderQuickResult(result) {
  const panel = document.getElementById("quick-panel");
  const badge = document.getElementById("quick-badge");
  const actions = document.getElementById("quick-actions");

  panel.hidden = false;
  badge.textContent = result.verdict;
  badge.className = "badge " + verdictClass(result.verdict);
  document.getElementById("quick-message").textContent = result.message;

  actions.replaceChildren();
  if (result.actions && result.actions.length > 0) {
    actions.appendChild(el("p", { cls: "card-title", text: "Tool calls made" }));
    actions.appendChild(el("pre", {
      cls: "evidence-box",
      text: JSON.stringify(result.actions, null, 2),
    }));
  } else {
    actions.appendChild(el("p", { text: "No tool calls were made.", cls: "mono" }));
  }
  panel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function tile(label, number, rate, tone) {
  const valueCls = "stat-value" + (tone ? " " + tone : "");
  const children = [
    el("div", { cls: "stat-label", text: label }),
    el("div", { cls: valueCls, text: String(number) }),
  ];
  if (rate !== null && rate !== undefined) {
    children.push(el("div", { cls: "stat-sub", text: rate.toFixed(1) + "%" }));
  }
  return el("div", { cls: "stat-tile" }, children);
}

function renderSuiteReport(report) {
  const host = document.getElementById("suite-report-host");
  host.replaceChildren();

  const card = el("section", { cls: "card" });
  card.appendChild(el("p", { cls: "card-title", text: "Attack suite report" }));
  card.appendChild(el("p", {
    cls: "mono",
    text: `${categoryLabel(report.category)}  ·  run ${report.run_id}  ·  ${formatDate(report.started)}`,
  }));

  const tiles = el("div", { cls: "stat-grid" }, [
    tile("Tests run", report.total_tests, null),
    tile("Resisted", report.resisted, report.resistance_rate, report.resisted > 0 ? "safe" : ""),
    tile("Vulnerable", report.vulnerable, report.vulnerability_rate, report.vulnerable > 0 ? "danger" : ""),
    tile("Needs review", report.review, report.review_rate, report.review > 0 ? "review" : ""),
  ]);
  card.appendChild(tiles);

  const tableWrap = el("div", { cls: "table-wrap" });
  const table = el("table", { cls: "data-table" });
  const thead = el("thead", {}, [el("tr", {}, [
    el("th", { text: "#" }),
    el("th", { text: "Attack tried" }),
    el("th", { text: "Agent result" }),
    el("th", { text: "Verdict" }),
    el("th", { text: "Judge reasoning" }),
  ])]);
  table.appendChild(thead);

  const tbody = el("tbody");
  for (const t of report.tests) {
    const payload = el("details", { cls: "payload" }, [
      el("summary", { text: shorten(t.payload, 70) }),
      el("p", { text: t.payload || "" }),
    ]);
    const pill = el("span", { cls: "pill " + verdictClass(t.result), text: t.result });
    const reasonCell = el("details", { cls: "payload" }, [
      el("summary", { text: shorten(t.reason, 60) }),
      el("p", { text: t.reason || "" }),
    ]);

    tbody.appendChild(el("tr", {}, [
      el("td", { text: String(t.test_id) }),
      el("td", {}, [payload]),
      el("td", { text: t.agent_response || "" }),
      el("td", {}, [pill]),
      el("td", {}, [reasonCell]),
    ]));
  }
  table.appendChild(tbody);
  tableWrap.appendChild(table);
  card.appendChild(tableWrap);

  host.appendChild(card);
  host.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function runQuick(agentId) {
  if (busy) return;
  setBusy(true);
  const statusHost = document.getElementById("workspace-status");
  statusLine(statusHost, "Running quick test…", "info");
  try {
    const result = await api.runQuickTest(agentId);
    statusLine(statusHost, "", "info");
    renderQuickResult(result);
    toast("Quick test complete: " + result.verdict, result.verdict === "VULNERABLE" ? "error" : "success");
  } catch (err) {
    statusLine(statusHost, err.message, "error");
    toast(err.message, "error");
  } finally {
    setBusy(false);
  }
}

async function runSuite(agentId, onDone) {
  if (busy) return;
  setBusy(true);
  const statusHost = document.getElementById("workspace-status");
  statusLine(
    statusHost,
    "Running attack suite… about 5 requests to the target model, can take up to a minute. Progress prints in the terminal running Flask.",
    "info"
  );
  try {
    const report = await api.runAttackSuite(agentId);
    statusLine(statusHost, "", "info");
    renderSuiteReport(report);
    toast(`Suite complete: ${report.resisted} resisted, ${report.vulnerable} vulnerable, ${report.review} review`, "success");
    if (onDone) onDone();
  } catch (err) {
    statusLine(statusHost, err.message, "error");
    toast(err.message, "error");
  } finally {
    setBusy(false);
  }
}

export function initWorkspace(onSuiteComplete) {
  document.querySelectorAll("#agents-grid [data-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const agentId = button.dataset.agent;
      if (button.dataset.action === "suite") runSuite(agentId, onSuiteComplete);
      else runQuick(agentId);
    });
  });
}
