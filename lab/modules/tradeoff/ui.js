import { h } from "/static/js/fx.js";
import { panel, runJob, demoBadge, download } from "/static/js/modui.js";

const COLORS = { "Base prompt": "#38bdf8", "With safety prompt": "#a78bfa" };

export function mount(root, ctx) {
  const p = panel(root, {
    ctx, title: "Security versus usefulness",
    intro: "A locked-down agent that refuses everything is 'secure' but useless. This gives every agent two scores: how well it resists attacks, and how well it still does normal everyday jobs, then plots them together.",
    how: "Security = share of 5 attack levels resisted (judged by what the agent actually did). Usefulness = share of 3 ordinary tasks done correctly. Each agent is measured with and without a safety prompt.",
  });
  const all = [];
  const chart = h("canvas", { height: "320", style: "width:100%;height:320px;display:block" });
  const legend = h("div", { cls: "legend", style: "margin:8px 0" });
  const plotCard = h("div", { cls: "card spot", hidden: "" }, [h("h3", { text: "Security vs usefulness map" }), legend, chart]); plotCard.hidden = true;
  const list = h("div");
  p.out.append(plotCard, list);
  p.runBtn.onclick = () => {
    list.replaceChildren(); all.length = 0; plotCard.hidden = true;
    runJob("/api/m/tradeoff/run", { agents: [...p.picked] }, { status: p.status, stopBtn: p.stopBtn, runBtn: p.runBtn, onResult: (r) => { all.push(r); list.append(card(r)); draw(); } });
  };
  function card(r) {
    const el = h("div", { cls: "card spot" }, [h("div", { cls: "card-head" }, [h("h3", { text: r.agent_name }), h("div", { cls: "row-gap" }, [demoBadge(r.demo), h("button", { cls: "btn ghost small", text: "Download JSON", onclick: () => download("security-vs-usefulness.json", all) })])])]);
    for (const pt of r.points) el.append(h("p", {}, [h("b", { text: pt.config + ": " }), `security ${pt.security}%, usefulness ${pt.usefulness}% · `, h("span", { cls: "pill " + (pt.quadrant.startsWith("Secure and") ? "good" : pt.quadrant.startsWith("Neither") || pt.quadrant.startsWith("Useful") ? "bad" : "mid"), text: pt.quadrant })]));
    return el;
  }
  function draw() {
    plotCard.hidden = false;
    legend.replaceChildren(...Object.entries(COLORS).map(([k, c]) => h("span", {}, [h("i", { style: `background:${c}` }), k])));
    const dpr = Math.min(2, devicePixelRatio || 1), W = chart.clientWidth, H = 320;
    chart.width = W * dpr; chart.height = H * dpr;
    const c = chart.getContext("2d"); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
    const light = document.documentElement.dataset.theme === "light", txt = light ? "#53648b" : "#8b9bc2", grid = light ? "rgba(60,90,150,.18)" : "rgba(130,160,230,.16)";
    const L = 50, B = 34, w = W - L - 30, hh = H - B - 34, X = (v) => L + (v / 100) * w, Y = (v) => 24 + hh - (v / 100) * hh;
    c.fillStyle = "rgba(52,211,153,.08)"; c.fillRect(X(70), Y(100), X(100) - X(70), Y(70) - Y(100));
    c.strokeStyle = grid; c.fillStyle = txt; c.font = "11px system-ui";
    for (let v = 0; v <= 100; v += 25) { c.beginPath(); c.moveTo(L, Y(v)); c.lineTo(W - 30, Y(v)); c.stroke(); c.beginPath(); c.moveTo(X(v), 24); c.lineTo(X(v), 24 + hh); c.stroke(); c.fillText(v, 8, Y(v) + 4); c.fillText(v, X(v) - 6, H - 12); }
    c.fillText("Security →", W - 80, H - 2); c.save(); c.translate(12, 70); c.rotate(-Math.PI / 2); c.fillText("Usefulness →", 0, 0); c.restore();
    c.fillStyle = "rgba(52,211,153,.7)"; c.fillText("Secure and useful", X(70) + 6, Y(100) + 16);
    for (const r of all) {
      const [a, b] = r.points;
      c.strokeStyle = "rgba(139,155,194,.6)"; c.setLineDash([4, 4]); c.beginPath(); c.moveTo(X(a.security), Y(a.usefulness)); c.lineTo(X(b.security), Y(b.usefulness)); c.stroke(); c.setLineDash([]);
      for (const pt of r.points) { c.fillStyle = COLORS[pt.config]; c.beginPath(); c.arc(X(pt.security), Y(pt.usefulness), 7, 0, 7); c.fill(); }
      c.fillStyle = light ? "#0e1a33" : "#e8eefc"; c.fillText(r.agent_name.split(" ")[0], X(a.security) + 10, Y(a.usefulness) - 8);
    }
  }
}
