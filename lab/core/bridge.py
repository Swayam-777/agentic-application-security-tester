"""Read-only link to the main project. Never writes to or changes project files."""
import importlib.util
import json
import os
import sys

from .config import ROOT
from .scenarios import AGENTS, RUNGS

PROJECT = ROOT.parent
CAT_KEY = {"ASI01": "ASI01_goal_hijacking", "ASI02": "ASI02_tool_misuse", "ASI05": "ASI05_unsafe_code_execution"}
loaded = {"payloads": 0}


def _library():
    f = PROJECT / "attack-engine" / "payload_library.py"
    if not f.is_file():
        return {}
    old, sys.dont_write_bytecode = sys.dont_write_bytecode, True   # never leave files in the project
    try:
        spec = importlib.util.spec_from_file_location("project_payload_library", f)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        return getattr(mod, "PAYLOADS", {})
    except Exception:
        return {}
    finally:
        sys.dont_write_bytecode = old


def attach_project_payloads():
    """Append the team's own payloads (attack-engine) as extra rungs after the 5 pressure levels."""
    lib = _library()
    for aid, a in AGENTS.items():
        a["labels"] = list(RUNGS)
        for i, text in enumerate(lib.get(CAT_KEY[a["category"]], []), 1):
            a["ladder"].append(str(text))
            a["labels"].append(f"Team payload {i}")
            loaded["payloads"] += 1


def project_runs():
    """Earlier runs saved by the main dashboard (results/attack_results.json), summarised."""
    f = PROJECT / "results" / "attack_results.json"
    try:
        items = json.loads(f.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return []
    runs = {}
    for t in items:
        r = runs.setdefault(t.get("run_id"), {"id": t.get("run_id"), "category": t.get("category", ""),
                                              "ts": t.get("timestamp", ""), "total": 0, "vulnerable": 0, "review": 0})
        r["total"] += 1
        res = str(t.get("result", "")).upper()
        r["vulnerable"] += res == "VULNERABLE"
        r["review"] += res == "REVIEW"
    return sorted(runs.values(), key=lambda r: str(r["ts"]), reverse=True)


attach_project_payloads()


_mods = {}


def _load_engine_module(name):
    if name in _mods:
        return _mods[name]
    f = PROJECT / "attack-engine" / f"{name}.py"
    mod = None
    if f.is_file():
        old, sys.dont_write_bytecode = sys.dont_write_bytecode, True
        try:
            spec = importlib.util.spec_from_file_location(f"project_{name}", f)
            mod = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(mod)
        except Exception:
            mod = None
        finally:
            sys.dont_write_bytecode = old
    _mods[name] = mod
    return mod


def project_jurors(agent_id, attack, result):
    """Your own llm_judge.py as extra jurors (its Gemini and Groq jurors). Failures are skipped quietly."""
    mod = _load_engine_module("llm_judge")
    if not mod or not hasattr(mod, "_build_prompt"):
        return []
    try:
        prompt = mod._build_prompt(attack, CAT_KEY[AGENTS[agent_id]["category"]], result.get("reply", ""), result.get("actions", []))
    except Exception:
        return []
    out = []
    for name, fn in (("Gemini", "_ask_gemini"), ("Groq", "_ask_groq")):
        if not hasattr(mod, fn):
            continue
        try:
            v = getattr(mod, fn)(prompt)
        except Exception:
            v = None
        if v:
            out.append({"label": f"Project judge ({name})", "provider": f"Your judge · {name}", "model": v.get("model", ""),
                        "vote": "VULNERABLE" if v["attack_succeeded"] else "RESISTED",
                        "confidence": float(v["confidence"]), "reasoning": str(v["reasoning"])[:300]})
    return out


def save_to_project(run):
    """Writes finished live runs into the project's own results file via attack_history.py, so the old dashboard shows them too."""
    if run.get("demo") or os.environ.get("LAB_SAVE_TO_PROJECT", "1") == "0":
        return
    mod = _load_engine_module("attack_history")
    if not mod:
        return
    try:
        rid = mod.create_run_id()
        key = CAT_KEY[run["category"]]
        for r in run["rungs"]:
            mod.save_result(key, r["attack"], r["reply"], r["verdict"], r["reason"], rid)
    except Exception:
        pass


def project_evaluate(verdict, message):
    """Your evaluator.py translates a test-bed agent's own verdict into RESISTED / VULNERABLE / REVIEW."""
    mod = _load_engine_module("evaluator")
    if mod and hasattr(mod, "evaluate_result"):
        try:
            return mod.evaluate_result({"verdict": verdict, "message": message})[0]
        except Exception:
            pass
    return {"SAFE": "RESISTED", "VULNERABLE": "VULNERABLE"}.get(verdict, "REVIEW")
