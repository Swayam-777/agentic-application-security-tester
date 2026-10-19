import { api } from "./api.js";
import { el, categoryLabel, shorten, formatDate } from "./dom.js";

const PAGE_SIZE = 10;

let allFindings = [];
let filtered = [];
let sortKey = "timestamp";
let sortDir = "desc";
let page = 1;

function severityFor(verdict) {
  if (verdict === "VULNERABLE") return { label: "High", cls: "pill-vulnerable" };
  if (verdict === "REVIEW") return { label: "Medium", cls: "pill-review" };
  return { label: "Pass", cls: "pill-resisted" };
}

async function loadAllFindings() {
  const runs = await api.getHistory();
  const findings = [];
  // Each history row only has a summary - the individual test rows live
  // behind /api/report/<run_id>/<category>, so fetch each run's full
  // report and flatten every test into one findings list.
  for (const run of runs) {
    try {
      const report = await api.getReport(run.run_id, run.category);
      for (const t of report.tests) {
        findings.push({
          id: `${run.run_id}-${t.test_id}`,
          title: shorten(t.payload, 60) || "(no payload text)",
          severity: severityFor(t.result),
          category: run.category,
          agent: categoryLabel(run.category),
          run_id: run.run_id,
          verdict: t.result,
          timestamp: t.timestamp,
          payload: t.payload,
          response: t.agent_response,
          reason: t.reason,
        });
      }
    } catch (e) {
      // A single run's report failing to load shouldn't block the rest.
      continue;
    }
  }
  return findings;
}

function applyFilters(searchTerm, severityFilter) {
  filtered = allFindings.filter((f) => {
    if (severityFilter && f.severity.label !== severityFilter) return false;
    if (!searchTerm) return true;
    const haystack = `${f.title} ${f.category} ${f.verdict} ${f.reason}`.toLowerCase();
    return haystack.includes(searchTerm.toLowerCase());
  });
  filtered.sort((a, b) => {
    const av = a[sortKey] || "";
    const bv = b[sortKey] || "";
    const cmp = String(av).localeCompare(String(bv));
    return sortDir === "asc" ? cmp : -cmp;
  });
  page = 1;
}

function renderTable(host) {
  host.replaceChildren();

  if (!filtered.length) {
    host.appendChild(el("div", { cls: "empty-state" }, [el("p", { text: "No findings match your filters." })]));
    return;
  }

  const start = (page - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(start, start + PAGE_SIZE);

  const tableWrap = el("div", { cls: "table-wrap" });
  const table = el("table", { cls: "data-table" });

  const columns = [
    ["title", "Finding"],
    ["severity", "Severity"],
    ["category", "Category"],
    ["verdict", "Verdict"],
    ["timestamp", "Date"],
  ];

  const headRow = el("tr");
  for (const [key, label] of columns) {
    const th = el("th", { cls: sortKey === key ? "sorted" : "" }, [
      document.createTextNode(label),
      el("span", { cls: "sort-arrow", text: sortKey === key ? (sortDir === "asc" ? "▲" : "▼") : "⇅" }),
    ]);
    th.addEventListener("click", () => {
      if (sortKey === key) sortDir = sortDir === "asc" ? "desc" : "asc";
      else { sortKey = key; sortDir = "asc"; }
      applyFilters(
        document.getElementById("explorer-search").value,
        document.getElementById("explorer-severity").value
      );
      renderTable(host);
    });
    headRow.appendChild(th);
  }
  table.appendChild(el("thead", {}, [headRow]));

  const tbody = el("tbody");
  for (const f of pageItems) {
    const detail = el("details", { cls: "payload" }, [
      el("summary", { text: f.title }),
      el("p", { text: `Payload: ${f.payload || ""}` }),
      el("p", { text: `Agent response: ${f.response || ""}` }),
      el("p", { text: `Judge reasoning: ${f.reason || ""}` }),
    ]);

    tbody.appendChild(el("tr", {}, [
      el("td", {}, [detail]),
      el("td", {}, [el("span", { cls: "pill " + f.severity.cls, text: f.severity.label })]),
      el("td", { cls: "mono", text: f.category }),
      el("td", {}, [el("span", { cls: "pill pill-" + f.verdict.toLowerCase(), text: f.verdict })]),
      el("td", { cls: "mono", text: formatDate(f.timestamp) }),
    ]));
  }
  table.appendChild(tbody);
  tableWrap.appendChild(table);
  host.appendChild(tableWrap);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pagination = el("div", { cls: "pagination" });
  const prevBtn = el("button", { cls: "btn btn-ghost btn-small", text: "Prev" });
  prevBtn.disabled = page <= 1;
  prevBtn.addEventListener("click", () => { page--; renderTable(host); });
  const nextBtn = el("button", { cls: "btn btn-ghost btn-small", text: "Next" });
  nextBtn.disabled = page >= totalPages;
  nextBtn.addEventListener("click", () => { page++; renderTable(host); });
  pagination.appendChild(el("span", { text: `Page ${page} of ${totalPages} · ${filtered.length} findings` }));
  pagination.appendChild(prevBtn);
  pagination.appendChild(nextBtn);
  host.appendChild(pagination);
}

export async function renderExplorer() {
  const host = document.getElementById("explorer-content");
  host.replaceChildren(el("div", { cls: "skeleton", attrs: { style: "height:300px;" } }));

  try {
    allFindings = await loadAllFindings();
  } catch (err) {
    host.replaceChildren(el("div", { cls: "error-state" }, [el("p", { text: "Could not load findings: " + err.message })]));
    return;
  }

  host.replaceChildren();

  const toolbar = el("div", { cls: "toolbar" });
  const search = el("input", { attrs: { type: "search", id: "explorer-search", placeholder: "Search findings, categories, reasoning…" } });
  const severitySelect = el("select", { attrs: { id: "explorer-severity" } }, [
    el("option", { attrs: { value: "" }, text: "All severities" }),
    el("option", { attrs: { value: "High" }, text: "High" }),
    el("option", { attrs: { value: "Medium" }, text: "Medium" }),
    el("option", { attrs: { value: "Pass" }, text: "Pass" }),
  ]);
  toolbar.appendChild(search);
  toolbar.appendChild(severitySelect);
  host.appendChild(toolbar);

  const tableHost = el("div");
  host.appendChild(tableHost);

  if (!allFindings.length) {
    tableHost.appendChild(el("div", { cls: "empty-state" }, [el("p", { text: "No findings yet — run an attack suite first." })]));
    return;
  }

  const refresh = () => {
    applyFilters(search.value, severitySelect.value);
    renderTable(tableHost);
  };

  search.addEventListener("input", refresh);
  severitySelect.addEventListener("change", refresh);
  refresh();
}
