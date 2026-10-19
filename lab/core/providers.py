"""Multi-provider LLM access (OpenAI-compatible, stdlib only, no Gemini).

Providers are optional. Any provider whose key is present is used; if one is
rate-limited the next takes over automatically. Model names are discovered
from each provider at runtime so retired names never break the lab.
"""
import json
import os
import threading
import time
import urllib.error
import urllib.request

PROVIDERS = {
    "gemini": {
        "label": "Gemini", "base": "https://generativelanguage.googleapis.com/v1beta/openai", "env": "GEMINI_API_KEY", "rpm": 10,
        "prefer": [], "strip": "models/", "match": "flash",
    },
    "groq": {
        "label": "Groq", "base": "https://api.groq.com/openai/v1", "env": "GROQ_API_KEY", "rpm": 25,
        "prefer": ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "openai/gpt-oss-20b",
                   "qwen/qwen3-32b", "gemma2-9b-it"],
    },
    "cerebras": {
        "label": "Cerebras", "base": "https://api.cerebras.ai/v1", "env": "CEREBRAS_API_KEY", "rpm": 25,
        "prefer": ["llama-3.3-70b", "llama3.1-8b", "gpt-oss-120b", "qwen-3-32b"],
    },
    "openrouter": {
        "label": "OpenRouter", "base": "https://openrouter.ai/api/v1", "env": "OPENROUTER_API_KEY", "rpm": 15,
        "prefer": ["meta-llama/llama-3.3-70b-instruct:free", "mistralai/mistral-small-3.2-24b-instruct:free",
                   "google/gemma-3-27b-it:free", "qwen/qwen3-14b:free"],
        "free_only": True,
    },
    "mistral": {
        "label": "Mistral", "base": "https://api.mistral.ai/v1", "env": "MISTRAL_API_KEY", "rpm": 20,
        "prefer": ["mistral-small-latest", "open-mistral-nemo", "ministral-8b-latest"],
    },
}

_BAD_WORDS = ("embed", "whisper", "tts", "guard", "moderation", "vision", "ocr", "transcri", "image", "live", "audio", "robotics", "computer", "aqa")


class ProviderError(Exception):
    def __init__(self, kind, msg="", retry_after=0):
        super().__init__(msg or kind)
        self.kind, self.retry_after = kind, retry_after


class AllProvidersFailed(Exception):
    pass


_lock = threading.Lock()
_last_call = {}
_cooldown = {}        # provider -> epoch until usable
_dead = set()         # providers with rejected keys this session
_bad_models = set()   # (provider, model) pairs that returned "not found"
_models_cache = {}    # provider -> [models]
_calls_today = {}     # provider -> count (this process)


def _key(pid):
    return os.environ.get(PROVIDERS[pid]["env"], "").strip()


def ready_providers():
    return [p for p in PROVIDERS if _key(p) and p not in _dead]


def status():
    out = []
    for pid, cfg in PROVIDERS.items():
        has = bool(_key(pid))
        out.append({
            "id": pid, "label": cfg["label"], "connected": has and pid not in _dead,
            "cooling": _cooldown.get(pid, 0) > time.time(),
            "calls": _calls_today.get(pid, 0),
        })
    return out


def _http(method, url, key, body=None, timeout=45):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={
        "Authorization": f"Bearer {key}", "Content-Type": "application/json",
        "User-Agent": "agentguard-lab/1.0", "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read().decode("utf-8", "ignore"))
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", "ignore")[:400]
        if e.code in (401, 403):
            raise ProviderError("auth", raw)
        if e.code == 404 or ("model" in raw.lower() and ("not found" in raw.lower() or "decommission" in raw.lower())):
            raise ProviderError("model", raw)
        if e.code == 429 and ("perday" in raw.lower().replace(" ", "").replace("_", "") or "daily" in raw.lower()):
            raise ProviderError("quota", raw)
        if e.code == 429:
            ra = e.headers.get("retry-after")
            try:
                ra = float(ra)
            except (TypeError, ValueError):
                ra = 20
            raise ProviderError("rate", raw, ra)
        if e.code >= 500:
            raise ProviderError("down", raw)
        raise ProviderError("other", raw)
    except (urllib.error.URLError, TimeoutError, OSError) as e:
        raise ProviderError("down", str(e))


def models(pid):
    """Ordered usable models for a provider, discovered live (cached)."""
    if pid in _models_cache:
        return [m for m in _models_cache[pid] if (pid, m) not in _bad_models]
    cfg, found = PROVIDERS[pid], []
    try:
        ids = [m.get("id", "") for m in _http("GET", cfg["base"] + "/models", _key(pid)).get("data", [])]
        strip = cfg.get("strip", "")
        ids = [i[len(strip):] if strip and i.startswith(strip) else i for i in ids]
        ids = [i for i in ids if i and not any(w in i.lower() for w in _BAD_WORDS)]
        if cfg.get("match"):
            ids = sorted([i for i in ids if cfg["match"] in i], reverse=True)
        if cfg.get("free_only"):
            ids = [i for i in ids if i.endswith(":free")]
        found = [m for m in cfg["prefer"] if m in ids]
        if not found:
            found = ids[:3]
    except ProviderError as e:
        if e.kind == "auth":
            _dead.add(pid)
            return []
        found = list(cfg["prefer"])   # discovery failed: try preferred names blindly
    _models_cache[pid] = found
    return found


def _throttle(pid):
    gap = 60.0 / PROVIDERS[pid]["rpm"]
    with _lock:
        wait = _last_call.get(pid, 0) + gap - time.time()
        _last_call[pid] = time.time() + max(wait, 0)
    if wait > 0:
        time.sleep(wait)


def chat(pid, model, messages, max_tokens=700, temperature=0.2):
    _throttle(pid)
    body = {"model": model, "messages": messages, "max_tokens": max_tokens, "temperature": temperature}
    res = _http("POST", PROVIDERS[pid]["base"] + "/chat/completions", _key(pid), body)
    _calls_today[pid] = _calls_today.get(pid, 0) + 1
    try:
        return res["choices"][0]["message"]["content"] or ""
    except (KeyError, IndexError, TypeError):
        raise ProviderError("other", "empty response")


def complete_tools(messages, tools, max_tokens=700):
    """Chat with tool definitions (OpenAI format). Returns the raw message dict, with failover."""
    last = None
    for pid, model in candidates():
        for attempt in (1, 2):
            try:
                _throttle(pid)
                body = {"model": model, "messages": messages, "max_tokens": max_tokens, "temperature": 0.2}
                if tools:
                    body["tools"] = tools
                res = _http("POST", PROVIDERS[pid]["base"] + "/chat/completions", _key(pid), body)
                _calls_today[pid] = _calls_today.get(pid, 0) + 1
                return res["choices"][0]["message"]
            except ProviderError as e:
                last = e
                if e.kind == "auth":
                    _dead.add(pid)
                elif e.kind in ("model", "quota"):
                    _bad_models.add((pid, model))
                elif e.kind == "rate":
                    _cooldown[pid] = time.time() + min(e.retry_after or 20, 90)
                elif e.kind == "down" and attempt == 1:
                    time.sleep(2)
                    continue
                elif e.kind == "other" and tools:
                    break     # this model may not support tools: try the next one
                break
            except (KeyError, IndexError, TypeError):
                break
    raise AllProvidersFailed(str(last) if last else "no provider connected")


def candidates(skip=()):
    out = []
    for pid in ready_providers():
        if pid in skip or _cooldown.get(pid, 0) > time.time():
            continue
        for m in models(pid):
            out.append((pid, m))
    return out


def complete(messages, prefer=None, max_tokens=700):
    """Try providers in order with automatic failover. Returns (text, provider, model)."""
    order = candidates()
    if prefer:
        order.sort(key=lambda c: 0 if c == prefer else 1)
    last = None
    for pid, model in order:
        if (pid, model) in _bad_models:
            continue
        for attempt in (1, 2):
            try:
                return chat(pid, model, messages, max_tokens), pid, model
            except ProviderError as e:
                last = e
                if e.kind == "auth":
                    _dead.add(pid)
                    break
                if e.kind in ("model", "quota"):
                    _bad_models.add((pid, model))
                    break
                if e.kind == "rate":
                    _cooldown[pid] = time.time() + min(e.retry_after or 20, 90)
                    break
                if e.kind == "down" and attempt == 1:
                    time.sleep(2)
                    continue
                break
    raise AllProvidersFailed(str(last) if last else "no provider connected")


def juror_slots(n=3):
    """Pick up to n distinct (provider, model) pairs, spreading across providers."""
    by_provider = {}
    for pid, m in candidates():
        by_provider.setdefault(pid, []).append(m)
    slots, i = [], 0
    while len(slots) < n and by_provider:
        progressed = False
        for pid in list(by_provider):
            if i < len(by_provider[pid]) and len(slots) < n:
                slots.append((pid, by_provider[pid][i]))
                progressed = True
        if not progressed:
            break
        i += 1
    return slots


def ask_slot(slot, messages, max_tokens=500):
    pid, model = slot
    for _ in range(2):
        try:
            return chat(pid, model, messages, max_tokens)
        except ProviderError as e:
            if e.kind == "rate":
                _cooldown[pid] = time.time() + min(e.retry_after or 20, 90)
                return None
            if e.kind == "auth":
                _dead.add(pid)
                return None
            if e.kind in ("model", "quota"):
                _bad_models.add(slot)
                return None
            time.sleep(2)
    return None


def label(pid):
    return PROVIDERS.get(pid, {}).get("label", pid)
