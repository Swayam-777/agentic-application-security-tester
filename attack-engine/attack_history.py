"""
Attack History
--------------
Saves security test results into a JSON file.
Groups tests using a Run ID.

The results file always lives in <repo root>/results/, no matter which
folder the program is launched from. That lets the attack engine, the
report generator and the dashboard all read and write the same file.
"""

import json
import os
from datetime import datetime


_HERE = os.path.dirname(os.path.abspath(__file__))

RESULTS_FOLDER = os.path.normpath(os.path.join(_HERE, "..", "results"))

RESULTS_FILE = os.path.join(
    RESULTS_FOLDER,
    "attack_results.json"
)


# ------------------------------------------------
# CREATE NEW RUN
# ------------------------------------------------

def _saved_run_ids():
    """
    Returns the run IDs already stored in the results file.
    """

    if not os.path.exists(RESULTS_FILE):
        return set()

    with open(RESULTS_FILE, "r", encoding="utf-8") as file:
        return {item.get("run_id") for item in json.load(file)}


def create_run_id():
    """
    Creates a unique ID for each testing run.

    The ID is the current date and time. If a run with that exact
    second was already saved (two runs started back to back), a number
    is added so the two runs never get mixed together in one report.
    """

    base = datetime.now().strftime("%Y%m%d_%H%M%S")

    existing = _saved_run_ids()

    run_id = base
    number = 2

    while run_id in existing:
        run_id = f"{base}_{number}"
        number += 1

    return run_id


# ------------------------------------------------
# SAVE RESULT
# ------------------------------------------------

def save_result(
    category,
    payload,
    response,
    result,
    reason,
    run_id
):
    """
    Saves one security test result.
    """

    os.makedirs(
        RESULTS_FOLDER,
        exist_ok=True
    )

    if os.path.exists(RESULTS_FILE):

        with open(
            RESULTS_FILE,
            "r",
            encoding="utf-8"
        ) as file:

            history = json.load(file)

    else:

        history = []

    new_result = {

        "test_id": len(history) + 1,

        "run_id": run_id,

        "timestamp": datetime.now().isoformat(),

        "category": category,

        "payload": payload,

        "response": response,

        "result": result,

        "reason": reason
    }

    history.append(new_result)

    with open(
        RESULTS_FILE,
        "w",
        encoding="utf-8"
    ) as file:

        json.dump(
            history,
            file,
            indent=4
        )

    print()
    print("ATTACK HISTORY:")
    print("Result saved to:", RESULTS_FILE)


# ------------------------------------------------
# DIRECT TEST
# ------------------------------------------------

if __name__ == "__main__":

    run_id = create_run_id()

    save_result(
        "ASI01_goal_hijacking",
        "Example security test",
        "The agent rejected the request.",
        "RESISTED",
        "The target agent rejected the untrusted instruction.",
        run_id
    )

    print()
    print("Run ID:", run_id)
