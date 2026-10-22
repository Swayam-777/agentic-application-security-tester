"""Finds experiment modules in lab/modules/ and plugs them in. To remove a feature, delete its folder."""
import importlib
from flask import Blueprint, abort, jsonify, send_from_directory

from .config import ROOT

MODULES_DIR = ROOT / "modules"
LOADED = []


def load(app):
    if MODULES_DIR.is_dir():
        for d in sorted(MODULES_DIR.iterdir()):
            if not (d.is_dir() and (d / "__init__.py").is_file() and not d.name.startswith("_")):
                continue
            try:
                mod = importlib.import_module(f"modules.{d.name}")
                bp = Blueprint("m_" + d.name, __name__)
                mod.register(bp)
                app.register_blueprint(bp, url_prefix=f"/api/m/{d.name}")
                LOADED.append({**mod.META, "id": d.name})
            except Exception as e:       # a broken module never stops the lab
                print(f"[module {d.name}] skipped: {e}")

    @app.get("/api/modules")
    def modules():
        return jsonify(LOADED)

    @app.get("/modules/<mid>/<path:fn>")
    def module_file(mid, fn):
        if mid not in {m["id"] for m in LOADED} or not fn.endswith((".js", ".css")):
            abort(404)
        return send_from_directory(MODULES_DIR / mid, fn)
