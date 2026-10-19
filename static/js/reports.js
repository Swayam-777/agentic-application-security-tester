import { api } from "./api.js";
import { el, categoryLabel, formatDate } from "./dom.js";

export async function renderReports() {
  const host = document.getElementById("reports-content");

  let runs;
  try {
    runs = await api.getHistory();
  } catch (err) {
    host.replaceChildren(el("div", { cls: "error-state" }, [el("p", { text: "Could not load reports: " + err.message })]));
    return;
  }

  if (!runs.length) {
    host.replaceChildren(el("div", { cls: "empty-state" }, [
      el("p", { text: "No reports yet — run an attack suite from Assessments first." }),
    ]));
    return;
  }

  const grid = el("div", { cls: "grid-cards" });
  for (const run of runs) {
    const card = el("div", { cls: "card" });
    card.appendChild(el("p", { cls: "card-title", text: categoryLabel(run.category) }));
    card.appendChild(el("p", { cls: "mono", attrs: { style: "font-size:0.78rem;color:var(--text-faint);" }, text: `run ${run.run_id} · ${formatDate(run.started)}` }));

    const stats = el("div", { attrs: { style: "display:flex;gap:1rem;margin:0.7rem 0;font-size:0.82rem;" } }, [
      el("span", { text: `${run.resisted} resisted`, attrs: { style: "color:var(--safe);" } }),
      el("span", { text: `${run.vulnerable} vulnerable`, attrs: { style: "color:var(--danger);" } }),
      el("span", { text: `${run.review} review`, attrs: { style: "color:var(--review);" } }),
    ]);
    card.appendChild(stats);

    const downloadBtn = el("button", {
      cls: "btn btn-ghost btn-small",
      text: "Download (not connected)",
      title: "No export/download route exists in app.py yet",
    });
    downloadBtn.disabled = true;
    card.appendChild(downloadBtn);

    grid.appendChild(card);
  }
  host.replaceChildren(grid);
}
