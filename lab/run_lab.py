"""Start the lab:  python run_lab.py   then open the address it prints."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from core import scheduler            # noqa: E402
from core.config import BRAND, PORT   # noqa: E402
from web.server import app            # noqa: E402

if __name__ == "__main__":
    scheduler.start()
    print(f"\n  {BRAND} is running.  Open  http://127.0.0.1:{PORT}  in your browser.\n  Press Ctrl+C to stop.\n")
    app.run(host="127.0.0.1", port=PORT, debug=False, threaded=True, use_reloader=False)
