import { h } from "/static/js/fx.js";
import { panel, runJob, steps, pill, demoBadge, download } from "/static/js/modui.js";

export function mount(root, ctx) {
  const p = panel(root, {
    ctx, withAgents: false, title: "Poisoned-tool and rug-pull tests",
    intro: "Modern agents use outside tools (for example MCP servers). If a tool is poisoned, an attacker never has to talk to the agent at all. This tests four tool-based tricks on a workspace assistant that has a strict internal-email-only rule.",
    how: "Each trick is simulated by the lab. The verdict comes from checking the tool calls the agent actually made, not from what it said.",
  });
  p.runBtn.onclick = () => {
    p.out.replaceChildren();
    runJob("/api/m/mcp_tools/run", {}, { status: p.status, stopBtn: p.stopBtn, runBtn: p.runBtn, onResult: (r) => p.out.append(card(r)) });
  };
  function card(r) {
    const broke = r.scenarios.filter((s) => s.verdict === "VULNERABLE").length;
    const el = h("div", { cls: "card spot" }, [h("div", { cls: "card-head" }, [h("h3", { text: `${broke} of ${r.scenarios.length} tool attacks succeeded` }), h("div", { cls: "row-gap" }, [demoBadge(r.demo), h("button", { cls: "btn ghost small", text: "Download JSON", onclick: () => download("tool-attacks.json", r) })])])]);
    for (const s of r.scenarios) {
      el.append(h("details", { cls: "payload", style: "margin-top:10px" }, [h("summary", {}, [document.createTextNode(s.title + "  "), pill(s.verdict), h("span", { cls: "tag", style: "margin-left:8px", text: s.tag }),
        s.broke_at ? h("span", { cls: "pill mid", style: "margin-left:6px", text: s.calls > 1 ? `Held ${s.broke_at - 1} call(s), broke on call ${s.broke_at}` : "Broke on the first call" }) : null]),
        h("p", { cls: "muted", text: s.what }), steps(s.steps), s.violations.length ? h("p", { cls: "why", text: "Evidence: " + s.violations.join("; ") + "." }) : h("p", { cls: "why", text: "No forbidden tool use found." })]));
    }
    return el;
  }
}
