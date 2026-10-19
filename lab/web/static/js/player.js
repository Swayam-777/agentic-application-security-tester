import { h, sleep, typewriter, gauge, countUp, reduced } from "./fx.js";
import { api } from "./api.js";
import { exportRunsCsv, exportRunsJson, printReport } from "./export.js";

// Plays a stream of events as an animated pressure ladder + jury deliberation.
export function createPlayer(host, meta, { fast = false } = {}) {
  const queue = [];
  let busy = false;
  const blocks = {};
  const tw = fast ? 0 : 11;

  function block(ev) {
    const ag = meta.agents.find((a) => a.id === ev.agent) || {};
    const rungs = h("div", { cls: "rungs" });
    const meter = h("i");
    const root = h("section", { cls: "run" }, [
      h("div", { cls: "run-head" }, [
        h("h3", { text: ev.name }), h("span", { cls: "tag", text: `${ag.category || ""} · ${ag.risk || ""}` }),
        ev.demo ? h("span", { cls: "badge-demo", text: "Simulated demo" }) : null]),
      h("div", { cls: "ladder" }, [h("div", { cls: "pressure" }, [meter]), rungs]),
    ]);
    host.append(root);
    root.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    return (blocks[ev.agent] = { root, rungs, meter, cards: {}, broke: false, cat: ag.category });
  }

  async function handle(ev) {
    if (ev.type === "agent_start") { block(ev); return; }
    const b = blocks[ev.agent];
    if (ev.type === "rung_start") {
      const attackP = h("p");
      const replyP = h("p", {}, [h("span", { cls: "think" }, [h("i"), h("i"), h("i")])]);
      const stamp = h("span", { cls: "stamp" });
      const card = h("article", { cls: "rung scanning" }, [
        h("div", { cls: "rung-head" }, [h("span", { cls: "rung-n", text: ev.rung }), h("span", { cls: "rung-label", text: ev.label }), stamp]),
        h("div", { cls: "bubble attack" }, [h("label", { text: "Attack" }), attackP]),
        h("div", { cls: "bubble agent" }, [h("label", { text: "Agent" }), replyP]),
      ]);
      b.rungs.append(card);
      b.cards[ev.rung] = { card, replyP, stamp };
      b.meter.style.height = Math.min(ev.rung / 5, 1) * 80 + "%";
      await typewriter(attackP, ev.attack, tw);
      return;
    }
    if (ev.type === "rung_done") {
      const c = b.cards[ev.rung];
      await typewriter(c.replyP, ev.reply || "(no reply)", tw);
      if (ev.actions && ev.actions.length) {
        const row = h("div", { cls: "acts" });
        for (const a of ev.actions) {
          const bad = ev.violations && ev.violations.length;
          const arg = Object.values(a.args || {}).map(String).join(", ").slice(0, 70);
          row.append(h("span", { cls: "act" + (bad ? " bad" : ""), text: `${a.tool}(${arg})` }));
        }
        c.replyP.parentElement.append(row);
      }
      const jury = h("div", { cls: "jury" });
      const jurors = ev.jurors.length ? ev.jurors : [{ label: "Evidence check", provider: "Action audit", vote: ev.verdict === "VULNERABLE" ? "VULNERABLE" : "RESISTED", reasoning: ev.reason }];
      const els = jurors.map((j) => {
        const e = h("div", { cls: "juror thinking" }, [
          h("div", { cls: "who" }, [h("span", { cls: "av", text: (j.label || "J").slice(-1) }), `${j.label} · ${j.provider}`]),
          h("div", { cls: "vote" }, [h("span", { cls: "think" }, [h("i"), h("i"), h("i")])])]);
        jury.append(e);
        return e;
      });
      c.card.append(jury);
      for (let i = 0; i < els.length; i++) { await sleep(180); els[i].classList.add("in"); }
      for (let i = 0; i < els.length; i++) {
        await sleep(fast ? 80 : 650);
        const j = jurors[i], e = els[i];
        e.classList.remove("thinking"); e.classList.add("v-" + j.vote);
        const vote = e.querySelector(".vote");
        vote.replaceChildren(document.createTextNode(j.vote === "VULNERABLE" ? "Vulnerable" : "Resisted"));
        vote.classList.add("pop");
        if (j.reasoning && jurors.length > 0) e.title = j.reasoning;
      }
      await sleep(fast ? 80 : 450);
      const cls = ev.verdict.toLowerCase();
      c.card.classList.remove("scanning"); c.card.classList.add(cls);
      c.stamp.textContent = ev.verdict === "RESISTED" ? "HELD" : ev.verdict === "VULNERABLE" ? "BROKE" : "REVIEW";
      c.stamp.classList.add(cls, "show");
      const why = h("p", { cls: "why" });
      c.card.append(why);
      await typewriter(why, `${ev.reason} (${Math.round(ev.confidence * 100)}% confident)`, tw);
      if (ev.agent_missed) c.card.append(h("div", { cls: "callout", text: "The agent reported it followed the rules. The jury found otherwise." }));
      if (ev.verdict === "VULNERABLE" && !b.broke) {
        b.broke = true;
        c.card.classList.add("shake");
        c.card.before(h("div", { cls: "break-banner", text: `Breaking point reached at level ${ev.rung}: ${ev.label}` }));
      }
      return;
    }
    if (ev.type === "agent_done") {
      b.meter.style.height = "100%";
      const sum = h("div", { cls: "card summary" });
      sum.append(gauge(ev.score));
      const stat = (n, l) => { const nb = h("b", { text: "0" }); countUp(nb, n, 1000); return h("div", {}, [nb, h("span", { cls: "muted", text: l })]); };
      const right = h("div", {}, [
        h("div", { cls: "stats" }, [stat(ev.issues, "issues found"), stat(ev.agent_missed, "missed by the agent itself"),
          h("div", {}, [h("b", { text: ev.breaking_point ? `Level ${ev.breaking_point}` : "Held every level" }), h("span", { cls: "muted", text: "breaking point" })])]),
      ]);
      const fix = (meta.advice[b.cat] || {}).fix;
      if (ev.issues && fix) {
        right.append(h("p", { cls: "muted", text: "How to harden it:", style: "margin-top:12px" }));
        right.append(h("ul", { cls: "fixes" }, fix.map((f) => h("li", { text: f }))));
      }
      const row = h("div", { cls: "export-row" });
      let full = null;
      const need = async () => (full ||= await api.run(ev.run_id));
      row.append(
        h("button", { cls: "btn ghost small", text: "Download CSV", onclick: async () => exportRunsCsv([await need()], "report") }),
        h("button", { cls: "btn ghost small", text: "Download JSON", onclick: async () => exportRunsJson([await need()], "report") }),
        h("button", { cls: "btn ghost small", text: "Print / save as PDF", onclick: printReport }));
      right.append(row);
      sum.append(right);
      b.root.append(sum);
      return;
    }
    if (ev.type === "error") {
      const { friendly } = await import("./api.js");
      host.append(h("div", { cls: "callout", text: friendly(ev.code) }));
    }
  }

  async function pump() {
    if (busy) return;
    busy = true;
    while (queue.length) { try { await handle(queue.shift()); } catch (e) { console.error(e); } }
    busy = false;
    if (done) done();
  }
  let done = null;
  return {
    push(evs) { queue.push(...evs); pump(); },
    finished: () => new Promise((res) => { if (!busy && !queue.length) res(); else done = res; }),
  };
}

export function runToEvents(run, meta) {
  const evs = [{ type: "agent_start", agent: run.agent, name: run.agent_name, demo: run.demo }];
  for (const r of run.rungs) {
    evs.push({ type: "rung_start", agent: run.agent, rung: r.rung, label: r.label, attack: r.attack });
    evs.push({ type: "rung_done", agent: run.agent, ...r });
  }
  evs.push({ type: "agent_done", agent: run.agent, run_id: run.id, score: run.score, breaking_point: run.breaking_point,
    issues: run.issues, agent_missed: run.agent_missed });
  return evs;
}
