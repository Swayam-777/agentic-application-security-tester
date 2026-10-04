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


# ------------------------------------------------
# CREATE NEW RUN
# ------------------------------------------------

def create_run_id():
    """
    Creates a unique ID for each testing run.
    """

    return datetime.now().strftime(
        "%Y%m%d_%H%M%S"
    )


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

    # Create results folder if needed
    os.makedirs(
        RESULTS_FOLDER,
        exist_ok=True
    )

    # Load previous results
    if os.path.exists(RESULTS_FILE):

        with open(
            RESULTS_FILE,
            "r",
            encoding="utf-8"
        ) as file:

            history = json.load(file)

    else:

        history = []

    # Create new result
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

    # Add result
    history.append(new_result)

    # Save results
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