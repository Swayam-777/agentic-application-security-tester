import { api } from "./api.js";
import { el, categoryLabel, formatDate } from "./dom.js";

export async function renderHistory(onViewRun) {
  const host = document.getElementById("history-content");

  let runs;
  try {
    runs = await api.getHistory();
  } catch (err) {
    host.replaceChildren(el("div", { cls: "error-state" }, [el("p", { text: "Could not load run history: " + err.message })]));
    return;
  }

  if (!runs.length) {
    host.replaceChildren(el("div", { cls: "empty-state" }, [
      el("p", { text: "No attack suites have been run yet." }),
    ]));
    return;
  }

  const tableWrap = el("div", { cls: "table-wrap" });
  const table = el("table", { cls: "data-table" });
  table.appendChild(el("thead", {}, [el("tr", {}, [
    el("th", { text: "Date" }),
    el("th", { text: "Category" }),
    el("th", { text: "Tests" }),
    el("th", { text: "Resisted" }),
    el("th", { text: "Vulnerable" }),
    el("th", { text: "Review" }),
    el("th", { text: "" }),
    el("th", { text: "" }),
  ])]));

  const tbody = el("tbody");
  for (const run of runs) {
    const viewBtn = el("button", { cls: "btn btn-secondary btn-small", text: "View" });
    viewBtn.addEventListener("click", () => onViewRun(run.run_id, run.category));

    const compareBtn = el("button", { cls: "btn btn-ghost btn-small", text: "Compare", title: "Not connected — no comparison endpoint in the backend yet" });
    compareBtn.disabled = true;

    tbody.appendChild(el("tr", {}, [
      el("td", { text: formatDate(run.started) }),
      el("td", { cls: "mono", text: categoryLabel(run.category) }),
      el("td", { text: String(run.total_tests) }),
      el("td", { text: String(run.resisted) }),
      el("td", { text: String(run.vulnerable) }),
      el("td", { text: String(run.review) }),
      el("td", {}, [viewBtn]),
      el("td", {}, [compareBtn]),
    ]));
  }
  table.appendChild(tbody);
  tableWrap.appendChild(table);
  host.replaceChildren(tableWrap);
}
