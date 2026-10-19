"""Central settings for the lab. The product name lives here and nowhere else."""
import os
from pathlib import Path

BRAND = "AgentGuard"          # change this one word to rename the whole product
TAGLINE = "Pressure-test your AI agents before attackers do"

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
DATA_DIR.mkdir(exist_ok=True)


def load_env():
    """Tiny .env reader (no extra install). Looks in lab/ then the project root."""
    for folder in (ROOT, ROOT.parent):
        f = folder / ".env"
        if f.is_file():
            for line in f.read_text(encoding="utf-8", errors="ignore").splitlines():
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                k, v = k.strip(), v.strip().strip('"').strip("'")
                if k and k not in os.environ:
                    os.environ[k] = v


load_env()

PORT = int(os.environ.get("LAB_PORT", "5001"))
FORCE_DEMO = os.environ.get("LAB_MOCK", "").strip() in ("1", "true", "yes")
