"""Background scheduler: re-tests agents on a timer and raises regression alerts."""
import threading
import time

from . import runner, store
from .scenarios import AGENTS

_started = False


def list_all():
    return store.load("schedules", [])


def create(name, agents, every_minutes):
    agents = [a for a in agents if a in AGENTS] or list(AGENTS)
    every = max(5, int(every_minutes))
    s = {"id": store.new_id("sch"), "name": (name or "Scheduled check")[:60], "agents": agents,
         "every_minutes": every, "enabled": True, "last_run": None, "next_run": time.time() + every * 60}
    items = list_all()
    items.append(s)
    store.save("schedules", items)
    return s


def update(sid, **fields):
    items = list_all()
    for s in items:
        if s["id"] == sid:
            for k in ("name", "enabled", "every_minutes", "agents"):
                if k in fields:
                    s[k] = fields[k]
            if "every_minutes" in fields:
                s["every_minutes"] = max(5, int(s["every_minutes"]))
                s["next_run"] = time.time() + s["every_minutes"] * 60
            store.save("schedules", items)
            return s
    return None


def delete(sid):
    store.save("schedules", [s for s in list_all() if s["id"] != sid])


def run_now(sid):
    for s in list_all():
        if s["id"] == sid:
            return _fire(s)
    return None


def _fire(s):
    demo = not runner.live_available()
    job_id = runner.start_job(s["agents"], demo, source="schedule")
    items = list_all()
    for it in items:
        if it["id"] == s["id"]:
            it["last_run"] = time.time()
            it["next_run"] = time.time() + it["every_minutes"] * 60
    store.save("schedules", items)
    return job_id


def _loop():
    while True:
        time.sleep(20)
        try:
            for s in list_all():
                if s["enabled"] and s["next_run"] <= time.time():
                    _fire(s)
        except Exception:
            pass


def start():
    global _started
    if not _started:
        _started = True
        threading.Thread(target=_loop, daemon=True).start()
