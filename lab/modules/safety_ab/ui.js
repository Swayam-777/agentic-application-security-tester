import { h } from "/static/js/fx.js";
import { panel, runJob, demoBadge, download } from "/static/js/modui.js";

export function mount(root, ctx) {
  const trials = h("select", {}, [h("option", { value: "1", text: "1 repeat (fast)" }), h("option", { value: "2", text: "2 repeats" }), h("option", { value: "3", text: "3 repeats (steadier)" })]);
  const jury = h("input", { type: "checkbox", checked: "" });
  const p = panel(root, {
    ctx, title: "Safety prompt A/B experiment",
    intro: "Does adding a strong safety prompt really make an agent safer? The same attacks are run twice: once on the agent as it is, once with a safety prompt added. Then the attack success rates are compared.",
    how: "Five attack levels per agent. AI models give different answers each time, so use more repeats for a steadier result.",
    extraControls: [h("div", { cls: "setup-row", style: "margin-top:10px" }, [trials, h("label", { style: "display:flex;gap:8px;align-items:center" }, [jury, "Use the full jury (slower, more accurate)"])])],
  });
  const all = [];
  p.runBtn.onclick = () => {
    p.out.replaceChildren(); all.length = 0;
    runJob("/api/m/safety_ab/run", { agents: [...p.picked], trials: +trials.value, jury: jury.checked }, { status: p.status, stopBtn: p.stopBtn, runBtn: p.runBtn, onResult: (r) => { all.push(r); p.out.append(card(r)); } });
  };
  function bar(label, pct, color) {
    const fill = h("i", { style: `display:block;height:100%;width:0;border-radius:99px;background:${color};transition:width 1.2s` });
    setTimeout(() => (fill.style.width = pct + "%"), 80);
    return h("div", { style: "margin:8px 0" }, [h("div", { style: "display:flex;justify-content:space-between" }, [h("span", { text: label }), h("b", { text: pct + "% attacks succeeded" })]),
      h("div", { style: "height:12px;border-radius:99px;background:rgba(120,150,220,.14)" }, [fill])]);
  }
  function card(r) {
    const el = h("div", { cls: "card spot" }, [h("div", { cls: "card-head" }, [h("h3", { text: r.agent_name }), h("div", { cls: "row-gap" }, [demoBadge(r.demo), h("button", { cls: "btn ghost small", text: "Download JSON", onclick: () => download("safety-ab.json", all) })])]),
      bar("Without safety prompt", r.asr_a, "linear-gradient(90deg,#fb5a6b,#fbbf24)"), bar("With safety prompt", r.asr_b, "linear-gradient(90deg,#34d399,#38bdf8)"),
      h("p", { cls: "callout", text: r.note })]);
    const rows = r.rows.map((x) => h("tr", {}, [h("td", { text: `${x.level}. ${x.label}` }),
      h("td", {}, [h("span", { cls: "pill " + (x.A.some((t) => t.verdict === "VULNERABLE") ? "bad" : "good"), text: `${x.A.filter((t) => t.verdict === "VULNERABLE").length}/${x.A.length} broke` })]),
      h("td", {}, [h("span", { cls: "pill " + (x.B.some((t) => t.verdict === "VULNERABLE") ? "bad" : "good"), text: `${x.B.filter((t) => t.verdict === "VULNERABLE").length}/${x.B.length} broke` })])]));
    el.append(h("div", { cls: "table-wrap" }, [h("table", {}, [h("thead", {}, [h("tr", {}, ["Level", "Without", "With"].map((t) => h("th", { text: t })))]), h("tbody", {}, rows)])]));
    return el;
  }
}
