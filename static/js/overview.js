import { api } from "./api.js";
import { el, categoryLabel, formatDate } from "./dom.js";

let chartInstance = null;

function statTile(label, value, tone, sub) {
  const valueCls = "stat-value" + (tone ? " " + tone : "");
  const children = [
    el("div", { cls: "stat-label", text: label }),
    el("div", { cls: valueCls, text: String(value) }),
  ];
  if (sub) children.push(el("div", { cls: "stat-sub", text: sub }));
  return el("div", { cls: "stat-tile" }, children);
}

export async function renderOverview() {
  const host = document.getElementById("overview-content");

  let runs;
  try {
    runs = await api.getHistory();
  } catch (err) {
    host.replaceChildren(el("div", { cls: "error-state" }, [
      el("div", { cls: "big-icon", text: "⚠" }),
      el("p", { text: "Could not load assessment history: " + err.message }),
    ]));
    return;
  }

  if (!runs.length) {
    host.replaceChildren(el("div", { cls: "empty-state" }, [
      el("div", { cls: "big-icon", text: "○" }),
      el("p", { text: "No assessments have been run yet." }),
      el("p", { text: "Go to Assessments and run a quick test or a full attack suite to populate this dashboard." }),
    ]));
    return;
  }

  const totals = runs.reduce((acc, r) => {
    acc.total += r.total_tests;
    acc.resisted += r.resisted;
    acc.vulnerable += r.vulnerable;
    acc.review += r.review;
    return acc;
  }, { total: 0, resisted: 0, vulnerable: 0, review: 0 });

  const riskScore = totals.total ? Math.round((totals.vulnerable / totals.total) * 100) : 0;

  host.replaceChildren();

  const statGrid = el("div", { cls: "stat-grid" }, [
    statTile("Total assessments", runs.length, "", `${totals.total} individual tests`),
    statTile("Resisted", totals.resisted, "safe"),
    statTile("Vulnerable", totals.vulnerable, "danger"),
    statTile("Needs review", totals.review, "review"),
    statTile("Overall risk score", riskScore + "%", riskScore > 30 ? "danger" : riskScore > 0 ? "review" : "safe", "share of tests marked vulnerable"),
  ]);
  host.appendChild(statGrid);

  const gridRow = el("div", { cls: "grid-2" });

  // Severity distribution chart
  const chartCard = el("div", { cls: "card" });
  chartCard.appendChild(el("p", { cls: "card-title", text: "Assessment outcomes" }));
  const chartBox = el("div", { cls: "chart-box" });
  const canvas = el("canvas", { attrs: { id: "outcomes-chart" } });
  chartBox.appendChild(canvas);
  chartCard.appendChild(chartBox);
  gridRow.appendChild(chartCard);

  // Recent activity
  const activityCard = el("div", { cls: "card" });
  activityCard.appendChild(el("p", { cls: "card-title", text: "Recent activity" }));
  const list = el("div");
  const recent = [...runs].sort((a, b) => (b.started || "").localeCompare(a.started || "")).slice(0, 6);
  for (const r of recent) {
    const row = el("div", { attrs: { style: "display:flex;justify-content:space-between;padding:0.5rem 0;border-bottom:1px solid var(--border-soft);font-size:0.85rem;" } }, [
      el("span", { text: categoryLabel(r.category), cls: "mono" }),
      el("span", { text: formatDate(r.started), cls: "mono" }),
    ]);
    list.appendChild(row);
  }
  activityCard.appendChild(list);
  gridRow.appendChild(activityCard);

  host.appendChild(gridRow);

  // Category breakdown
  const byCategory = {};
  for (const r of runs) {
    if (!byCategory[r.category]) byCategory[r.category] = { total: 0, vulnerable: 0 };
    byCategory[r.category].total += r.total_tests;
    byCategory[r.category].vulnerable += r.vulnerable;
  }

  const catCard = el("div", { cls: "card", attrs: { style: "margin-top:1rem;" } });
  catCard.appendChild(el("p", { cls: "card-title", text: "Findings by category" }));
  for (const [cat, stats] of Object.entries(byCategory)) {
    const pct = stats.total ? Math.round((stats.vulnerable / stats.total) * 100) : 0;
    const row = el("div", { attrs: { style: "margin-bottom:0.7rem;" } });
    row.appendChild(el("div", {
      attrs: { style: "display:flex;justify-content:space-between;font-size:0.82rem;margin-bottom:0.3rem;" },
    }, [
      el("span", { text: categoryLabel(cat) }),
      el("span", { text: `${stats.vulnerable}/${stats.total} vulnerable`, cls: "mono" }),
    ]));
    const track = el("div", { cls: "confidence-bar-track" });
    const fill = el("div", { cls: "confidence-bar-fill", attrs: { style: `width:${pct}%; background: ${pct > 30 ? "var(--danger)" : pct > 0 ? "var(--review)" : "var(--safe)"};` } });
    track.appendChild(fill);
    row.appendChild(track);
    catCard.appendChild(row);
  }
  host.appendChild(catCard);

  // Quick actions
  const actionsCard = el("div", { cls: "card", attrs: { style: "margin-top:1rem;" } });
  actionsCard.appendChild(el("p", { cls: "card-title", text: "Quick actions" }));
  const goWorkspace = el("button", { cls: "btn btn-primary btn-small", text: "Start an assessment" });
  goWorkspace.addEventListener("click", () => document.querySelector('[data-view="workspace"]').click());
  const goReports = el("button", { cls: "btn btn-secondary btn-small", text: "View reports" });
  goReports.addEventListener("click", () => document.querySelector('[data-view="reports"]').click());
  actionsCard.appendChild(el("div", { cls: "button-row" }, [goWorkspace, goReports]));
  host.appendChild(actionsCard);

  // Chart.js render (library loaded globally via CDN script tag)
  if (window.Chart) {
    if (chartInstance) chartInstance.destroy();
    chartInstance = new window.Chart(canvas.getContext("2d"), {
      type: "doughnut",
      data: {
        labels: ["Resisted", "Vulnerable", "Needs review"],
        datasets: [{
          data: [totals.resisted, totals.vulnerable, totals.review],
          backgroundColor: ["#22c55e", "#ef4444", "#f59e0b"],
          borderWidth: 0,
        }],
      },
      options: {
        plugins: { legend: { position: "bottom", labels: { color: getComputedStyle(document.body).getPropertyValue("--text") } } },
        maintainAspectRatio: false,
      },
    });
  }
}
