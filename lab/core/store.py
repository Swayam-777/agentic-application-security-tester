"""Tiny JSON store inside the lab's own data folder."""
import json
import threading
import uuid

from .config import DATA_DIR

_lock = threading.RLock()


def _path(name):
    return DATA_DIR / f"{name}.json"


def load(name, default):
    with _lock:
        try:
            return json.loads(_path(name).read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return default


def save(name, value):
    with _lock:
        tmp = _path(name).with_suffix(".tmp")
        tmp.write_text(json.dumps(value, indent=1), encoding="utf-8")
        tmp.replace(_path(name))


def new_id(prefix):
    return f"{prefix}-{uuid.uuid4().hex[:8]}"


def append(name, item, keep=300):
    with _lock:
        items = load(name, [])
        items.append(item)
        save(name, items[-keep:])
