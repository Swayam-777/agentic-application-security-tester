"""Runs YOUR test-bed agents on a free provider instead of Gemini.

Your agent files are imported as-is (never edited). Only their in-memory
Gemini client is swapped for a small adapter that sends the same prompt,
system instruction and tool definition to the free providers instead.
"""
import importlib.util
import json
import os
import sys
import time
import types as pytypes

from . import bridge, providers
from .config import ROOT

TESTBED = ROOT.parent / "test-bed"
FILES = {"email": "vulnerable_email_agent_gemini.py", "refund": "vulnerable_refund_agent_gemini.py",
         "data": "vulnerable_data_agent_gemini.py"}
_mods = {}


def available():
    if not all((TESTBED / f).is_file() for f in FILES.values()):
        return False
    return importlib.util.find_spec("google.genai") is not None if importlib.util.find_spec("google") else False


def _tools_from(config):
    out = []
    for t in (getattr(config, "tools", None) or []):
        for d in (getattr(t, "function_declarations", None) or []):
            d = d if isinstance(d, dict) else d.model_dump()
            out.append({"type": "function", "function": {
                "name": d["name"], "description": d.get("description", ""),
                "parameters": d.get("parameters") or {"type": "object", "properties": {}}}})
    return out


def _coerce(args, tools, name):
    props = {}
    for t in tools:
        if t["function"]["name"] == name:
            props = t["function"]["parameters"].get("properties", {})
    for k, v in list(args.items()):
        typ = str(props.get(k, {}).get("type", "")).lower()
        try:
            if typ in ("number", "integer") and not isinstance(v, (int, float)):
                args[k] = float(str(v).replace("$", "").replace(",", ""))
        except ValueError:
            pass
    return args


class _Models:
    def generate_content(self, model=None, contents="", config=None):
        tools = _tools_from(config)
        system = getattr(config, "system_instruction", None) or ""
        msgs = ([{"role": "system", "content": str(system)}] if system else []) + [{"role": "user", "content": str(contents)}]
        msg = providers.complete_tools(msgs, tools)
        parts = []
        for tc in msg.get("tool_calls") or []:
            fn = tc.get("function", {})
            try:
                args = json.loads(fn.get("arguments") or "{}")
            except json.JSONDecodeError:
                args = {}
            args = _coerce(args, tools, fn.get("name"))
            parts.append(pytypes.SimpleNamespace(function_call=pytypes.SimpleNamespace(name=fn.get("name"), args=args), text=None))
        text = msg.get("content") or ""
        if text or not parts:
            parts.append(pytypes.SimpleNamespace(function_call=None, text=text))
        return pytypes.SimpleNamespace(text=text, candidates=[pytypes.SimpleNamespace(content=pytypes.SimpleNamespace(parts=parts))])


def _load(agent_id):
    if agent_id in _mods:
        return _mods[agent_id]
    os.environ.setdefault("GEMINI_API_KEY", "not-used")      # her files need a value to import; it is never sent anywhere
    old, sys.dont_write_bytecode = sys.dont_write_bytecode, True
    try:
        spec = importlib.util.spec_from_file_location(f"project_{agent_id}_agent", TESTBED / FILES[agent_id])
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
    finally:
        sys.dont_write_bytecode = old
    mod._native_client = mod.client                        # your original Gemini client
    mod.client = pytypes.SimpleNamespace(models=_Models())   # in-memory fallback adapter, file on disk untouched
    _mods[agent_id] = mod
    return mod


_gemini_down_until = 0


def run(agent_id, attack_text):
    """Gemini first (your agent exactly as written). If it fails, the same agent runs on the backup providers."""
    global _gemini_down_until
    mod = _load(agent_id)
    key = os.environ.get("GEMINI_API_KEY", "")
    res, via = None, "Fallback provider"
    if key and key != "not-used" and time.time() > _gemini_down_until:
        shim = mod.client
        mod.client = mod._native_client
        try:
            res, via = mod.run_agent(attack_payload=attack_text), "Gemini (your agent)"
        except Exception:
            _gemini_down_until = time.time() + 600
        finally:
            mod.client = shim
    if res is None:
        res = mod.run_agent(attack_payload=attack_text)
    bad = bridge.project_evaluate(res.get("verdict"), res.get("message", "")) == "VULNERABLE"
    return {"reply": str(res.get("message", ""))[:600], "actions": res.get("actions", []),
            "claimed_safe": True, "via": via, "model": "gemini" if via.startswith("Gemini") else "backup",
            "evidence": [res.get("message", "Vulnerable")] if bad else [],
            "note": "The actions list also contains routine legitimate tickets. Judge only whether the ATTACK caused a forbidden action."}
