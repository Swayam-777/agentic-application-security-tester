import { h } from "/static/js/fx.js";
import { panel, runJob, steps, pill, demoBadge, download } from "/static/js/modui.js";

export function mount(root, ctx) {
  const p = panel(root, {
    ctx, title: "Multi-turn and memory-poisoning attacks",
    intro: "Real attackers don't send one message. This builds trust over several friendly turns, plants a false rule in the agent's memory, then checks whether the poison still works in a brand-new session.",
    how: "The same final request is sent twice: once alone (baseline) and once after friendly turns. If the agent holds alone but gives in after the build-up, that is the highlight. The memory layer is simulated by the lab.",
  });
  const all = [];
  p.runBtn.onclick = () => {
    p.out.replaceChildren(); all.length = 0;
    runJob("/api/m/multiturn/run", { agents: [...p.picked] }, { status: p.status, stopBtn: p.stopBtn, runBtn: p.runBtn, onResult: (r) => { all.push(r); p.out.append(card(r)); } });
  };
  function card(r) {
    const broke = r.scenarios.filter((s) => s.verdict === "VULNERABLE").length;
    const flipped = r.scenarios.filter((s) => s.flipped).length;
    const el = h("div", { cls: "card spot" }, [
      h("div", { cls: "card-head" }, [h("h3", { text: r.agent_name }), h("div", { cls: "row-gap" }, [demoBadge(r.demo), h("button", { cls: "btn ghost small", text: "Download JSON", onclick: () => download("multi-turn.json", all) })])]),
      h("p", { text: `${broke} of ${r.scenarios.length} multi-turn attacks succeeded.` + (flipped ? ` The build-up flipped a refusal into a break (${flipped}).` : "") }),
    ]);
    for (const s of r.scenarios) {
      const d = h("details", { cls: "payload", style: "margin-top:10px" }, [h("summary", {}, [document.createTextNode(s.title + "  "), pill(s.verdict),
        s.flipped ? h("span", { cls: "pill mid", style: "margin-left:6px", text: "Held alone, broke after build-up" }) : null]),
        h("p", { cls: "muted", text: s.what }), steps(s.steps), h("p", { cls: "why", text: s.reason })]);
      el.append(d);
    }
    return el;
  }
}
