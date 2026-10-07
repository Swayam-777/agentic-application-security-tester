"""
Attack History
--------------
Saves security test results into a JSON file.
Groups tests using a Run ID.
"""

import json
import os
from datetime import datetime


RESULTS_FOLDER = "results"

RESULTS_FILE = os.path.join(
    RESULTS_FOLDER,
    "attack_results.json"
)


def create_run_id():
    return datetime.now().strftime("%Y%m%d_%H%M%S")


def save_result(category, payload, response, result, reason, run_id):
    os.makedirs(RESULTS_FOLDER, exist_ok=True)

    if os.path.exists(RESULTS_FILE):
        with open(RESULTS_FILE, "r", encoding="utf-8") as file:
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

    with open(RESULTS_FILE, "w", encoding="utf-8") as file:
        json.dump(history, file, indent=4)

    print()
    print("ATTACK HISTORY:")
    print("Result saved to:", RESULTS_FILE)


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
    print("\nRun ID:", run_id)
