import time
from flask import Flask, jsonify, render_template, request

from core import bridge, store, testbed, providers, runner, scheduler, store
from core.config import BRAND, TAGLINE
from core.scenarios import AGENTS, CATEGORIES, RUNGS

app = Flask(__name__, template_folder="templates", static_folder="static")
app.config["JSON_SORT_KEYS"] = False


def err(code, msg, status=400):
    return jsonify({"error": {"code": code, "message": msg}}), status


@app.get("/")
def home():
    return render_template("console.html", brand=BRAND, tagline=TAGLINE)


@app.get("/api/state")
def state():
    return jsonify({
        "brand": BRAND, "tagline": TAGLINE, "live": runner.live_available(), "project_agents": runner.live_available() and testbed.available(),
        "providers": [p for p in providers.status() if p["connected"]],
        "rungs": RUNGS, "team_payloads": bridge.loaded["payloads"],
        "agents": [{"id": k, "name": v["name"], "category": v["category"], "risk": v["risk"], "blurb": v["blurb"]}
                   for k, v in AGENTS.items()],
        "advice": CATEGORIES,
    })


@app.post("/api/runs")
def start_run():
    body = request.get_json(silent=True) or {}
    ids = [a for a in body.get("agents", []) if a in AGENTS]
    if not ids:
        return err("no_agent", "Choose at least one agent to test.")
    want_demo = body.get("mode") == "demo"
    demo = want_demo or not runner.live_available()
    engine = "project" if body.get("mode") == "project" and not demo and testbed.available() else "lab"
    return jsonify({"job": runner.start_job(ids, demo, engine=engine), "demo": demo})


@app.get("/api/jobs/<job_id>")
def job(job_id):
    j = runner.JOBS.get(job_id)
    if not j:
        return err("gone", "That test session has ended.", 404)
    since = int(request.args.get("since", 0))
    return jsonify({"status": j["status"], "events": j["events"][since:], "next": len(j["events"])})


@app.get("/api/runs")
def runs():
    out = []
    for r in reversed(store.load("runs", [])):
        out.append({k: r.get(k) for k in ("id", "ts", "agent", "agent_name", "category", "demo", "source",
                                          "score", "breaking_point", "issues", "agent_missed", "incomplete")})
    return jsonify(out)


@app.get("/api/runs/<run_id>")
def run_detail(run_id):
    for r in store.load("runs", []):
        if r["id"] == run_id:
            return jsonify(r)
    return err("gone", "That run could not be found.", 404)


@app.get("/api/provider-stats")
def provider_stats():
    st = store.load("provider_stats", {})
    return jsonify(sorted(({"name": k, "agree": v["agree"], "total": v["total"],
                            "trust": round(100 * (v["agree"] + 1) / (v["total"] + 2))} for k, v in st.items()),
                          key=lambda x: -x["trust"]))


@app.get("/api/project-runs")
def project_runs():
    return jsonify(bridge.project_runs())


@app.get("/api/schedules")
def schedules():
    return jsonify(scheduler.list_all())


@app.post("/api/schedules")
def schedule_new():
    b = request.get_json(silent=True) or {}
    return jsonify(scheduler.create(b.get("name"), b.get("agents", []), b.get("every_minutes", 60)))


@app.patch("/api/schedules/<sid>")
def schedule_edit(sid):
    s = scheduler.update(sid, **(request.get_json(silent=True) or {}))
    return jsonify(s) if s else err("gone", "That schedule no longer exists.", 404)


@app.delete("/api/schedules/<sid>")
def schedule_del(sid):
    scheduler.delete(sid)
    return jsonify({"ok": True})


@app.post("/api/schedules/<sid>/run")
def schedule_run(sid):
    j = scheduler.run_now(sid)
    return jsonify({"job": j}) if j else err("gone", "That schedule no longer exists.", 404)


@app.get("/api/alerts")
def alerts():
    return jsonify(list(reversed(store.load("alerts", []))))


@app.post("/api/alerts/read")
def alerts_read():
    items = store.load("alerts", [])
    for a in items:
        a["read"] = True
    store.save("alerts", items)
    return jsonify({"ok": True})
