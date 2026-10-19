function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;

export function exportRunsJson(runs, name = "report") {
  download(`${name}.json`, JSON.stringify(runs, null, 2), "application/json");
}
export function exportRunsCsv(runs, name = "report") {
  const head = ["Date", "Agent", "Category", "Mode", "Rung", "Pressure level", "Verdict", "Confidence", "Jury basis", "Reason"];
  const rows = [head.map(esc).join(",")];
  for (const r of runs) {
    for (const x of r.rungs || []) {
      rows.push([new Date(r.ts * 1000).toISOString(), r.agent_name, r.category, r.demo ? "Simulated" : "Live", x.rung, x.label,
        x.verdict, x.confidence, x.basis, x.reason].map(esc).join(","));
    }
  }
  download(`${name}.csv`, rows.join("\n"), "text/csv");
}
export const printReport = () => window.print();
