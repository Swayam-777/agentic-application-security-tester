"""Generic background task runner used by experiment modules (same queue and Stop button as normal tests)."""
import threading
import time

from . import runner, store


def start_task(fn):
    """fn(emit, cancelled) runs in the background. emit(event_dict) streams events to the page."""
    job_id = store.new_id("job")
    job = {"id": job_id, "status": "running", "events": [], "started": time.time()}
    runner.JOBS[job_id] = job

    def emit(ev):
        job["events"].append(ev)

    def work():
        waited = 0
        while not runner._run_lock.acquire(timeout=2):
            waited += 2
            if job.get("cancel"):
                job["status"] = "done"
                emit({"type": "job_done"})
                return
            if waited % 6 == 0:
                emit({"type": "status", "text": "Waiting for an earlier test to finish… (use Stop to skip the wait)"})
        try:
            fn(emit, lambda: bool(job.get("cancel")))
        except Exception:
            emit({"type": "error", "code": "unexpected"})
        finally:
            runner._run_lock.release()
            job["status"] = "done"
            emit({"type": "job_done"})
    threading.Thread(target=work, daemon=True).start()
    return job_id
