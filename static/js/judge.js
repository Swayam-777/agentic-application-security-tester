import { api } from "./api.js";
import { el, categoryLabel, formatDate } from "./dom.js";
import { parseJudgeReason, agreementLabel } from "./judge-parse.js";

let runsCache = [];

async function populateRunSelect() {
  const select = document.getElementById("judge-run-select");
  try {
    runsCache = await api.getHistory();
  } catch (e) {
    return;
  }
  select.replaceChildren(el("option", { attrs: { value: "" }, text: "Select a run…" }));
  for (const run of runsCache) {
    select.appendChild(el("option", {
      attrs: { value: `${run.run_id}::${run.category}` },
      text: `${categoryLabel(run.category)} — ${formatDate(run.started)} (${run.run_id})`,
    }));
  }
}

function judgeTestCard(test) {
  const parsed = parseJudgeReason(test.reason);

  const card = el("div", { cls: "judge-test-card" });

  const header = el("div", { attrs: { style: "display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem;" } }, [
    el("strong", { text: `Test ${test.test_id}` }),
    el("span", { cls: "pill pill-" + String(test.result).toLowerCase(), text: test.result }),
  ]);
  card.appendChild(header);

  const row = el("div", { cls: "judge-row" });

  row.appendChild(el("div", { cls: "judge-field" }, [
    el("div", { cls: "judge-field-label", text: "Agreement" }),
    el("div", { cls: "judge-field-value", text: agreementLabel(parsed.agreement) }),
  ]));

  row.appendChild(el("div", { cls: "judge-field" }, [
    el("div", { cls: "judge-field-label", text: "Jurors consulted" }),
    el("div", { cls: "judge-field-value", text: [parsed.usedGemini && "Gemini", parsed.usedGroq && "Groq"].filter(Boolean).join(" + ") || "n/a" }),
  ]));

  card.appendChild(row);

  if (parsed.confidence !== null) {
    const confWrap = el("div", { attrs: { style: "margin:0.6rem 0;" } });
    confWrap.appendChild(el("div", { cls: "judge-field-label", text: `Confidence — ${(parsed.confidence * 100).toFixed(0)}%` }));
    const track = el("div", { cls: "confidence-bar-track" });
    track.appendChild(el("div", { cls: "confidence-bar-fill", attrs: { style: `width:${parsed.confidence * 100}%;` } }));
    confWrap.appendChild(track);
    card.appendChild(confWrap);
  }

  card.appendChild(el("div", { cls: "judge-field-label", attrs: { style: "margin-top:0.6rem;" }, text: "Attack payload" }));
  card.appendChild(el("div", { cls: "evidence-box", text: test.payload || "" }));

  card.appendChild(el("div", { cls: "judge-field-label", attrs: { style: "margin-top:0.6rem;" }, text: "Agent's self-reported response" }));
  card.appendChild(el("div", { cls: "evidence-box", text: test.agent_response || "" }));

  card.appendChild(el("div", { cls: "judge-field-label", attrs: { style: "margin-top:0.6rem;" }, text: "Judge's full reasoning" }));
  card.appendChild(el("div", { cls: "evidence-box", text: parsed.raw || "(no judge reasoning on this row — likely predates the judge module)" }));

  return card;
}

async function loadAndRenderRun(runId, category) {
  const host = document.getElementById("judge-content");
  host.replaceChildren(el("div", { cls: "skeleton", attrs: { style: "height:200px;" } }));
  try {
    const report = await api.getReport(runId, category);
    host.replaceChildren();
    for (const test of report.tests) {
      host.appendChild(judgeTestCard(test));
    }
  } catch (err) {
    host.replaceChildren(el("div", { cls: "error-state" }, [el("p", { text: "Could not load this run: " + err.message })]));
  }
}

export async function initJudgeView() {
  await populateRunSelect();
  const select = document.getElementById("judge-run-select");
  select.addEventListener("change", () => {
    if (!select.value) {
      document.getElementById("judge-content").replaceChildren(
        el("div", { cls: "empty-state" }, [el("p", { text: "Select a run above to see per-test judge detail." })])
      );
      return;
    }
    const [runId, category] = select.value.split("::");
    loadAndRenderRun(runId, category);
  });

  if (!runsCache.length) {
    document.getElementById("judge-content").replaceChildren(
      el("div", { cls: "empty-state" }, [el("p", { text: "No runs yet — run an attack suite in Assessments first." })])
    );
  } else {
    document.getElementById("judge-content").replaceChildren(
      el("div", { cls: "empty-state" }, [el("p", { text: "Select a run above to see per-test judge detail." })])
    );
  }
}
