"""
Security Test Report Generator
------------------------------
Reads saved security test results (written by attack_history.py) and
builds a report for a testing run.

Three ways to use it:
  build_report(category)    -> the latest run of a category as a dict
                               (used by the dashboard / JSON export)
  get_run_history()         -> a one-line summary of every past run
  generate_report(category) -> prints the report to the console
"""

import json
import os

from attack_history import RESULTS_FILE


# ------------------------------------------------
# LOAD SAVED RESULTS
# ------------------------------------------------

def load_history():
    """
    Returns every saved test result, or an empty list if none exist.
    """

    if not os.path.exists(RESULTS_FILE):
        return []

    with open(RESULTS_FILE, "r", encoding="utf-8") as file:
        return json.load(file)


# ------------------------------------------------
# COUNT RESULTS FOR ONE GROUP OF TESTS
# ------------------------------------------------

def _count(items):
    """
    Counts RESISTED / VULNERABLE / REVIEW and works out percentages.
    """

    total = len(items)

    counts = {"RESISTED": 0, "VULNERABLE": 0, "REVIEW": 0}

    for item in items:

        result = item.get("result")

        if result in counts:
            counts[result] += 1

    def percent(number):
        return round(number / total * 100, 2) if total else 0.0

    return {
        "total_tests": total,
        "resisted": counts["RESISTED"],
        "vulnerable": counts["VULNERABLE"],
        "review": counts["REVIEW"],
        "resistance_rate": percent(counts["RESISTED"]),
        "vulnerability_rate": percent(counts["VULNERABLE"]),
        "review_rate": percent(counts["REVIEW"]),
    }


# ------------------------------------------------
# BUILD REPORT (returns data)
# ------------------------------------------------

def build_report(category, run_id=None):
    """
    Builds the report for one run of a category as a dictionary.

    If run_id is not given, the latest run of that category is used.
    Returns None if there is nothing to report on.
    """

    history = load_history()

    category_results = [
        item for item in history
        if item.get("category") == category
    ]

    if not category_results:
        return None

    if run_id is None:
        # Latest run = the most recent record that actually has a run id
        with_ids = [i for i in category_results if i.get("run_id")]
        if not with_ids:
            return None
        run_id = with_ids[-1].get("run_id")

    run_items = [
        item for item in category_results
        if item.get("run_id") == run_id
    ]

    if not run_items:
        return None

    report = {
        "run_id": run_id,
        "category": category,
        "started": run_items[0].get("timestamp"),
        "tests": [
            {
                "test_id": item.get("test_id"),
                "timestamp": item.get("timestamp"),
                "payload": item.get("payload"),
                "agent_response": item.get("response"),
                "result": item.get("result"),
                "reason": item.get("reason", "Reason not available."),
            }
            for item in run_items
        ],
    }

    report.update(_count(run_items))

    return report


# ------------------------------------------------
# RUN HISTORY (one summary line per run)
# ------------------------------------------------

def get_run_history():
    """
    Returns a summary of every past run, newest first.
    """

    history = load_history()

    runs = {}

    for item in history:

        if not item.get("run_id"):
            continue  # old records without a run id cannot be grouped

        key = (item.get("run_id"), item.get("category"))
        runs.setdefault(key, []).append(item)

    summaries = []

    for (run_id, category), items in runs.items():

        summary = {
            "run_id": run_id,
            "category": category,
            "started": items[0].get("timestamp"),
        }
        summary.update(_count(items))
        summaries.append(summary)

    summaries.sort(key=lambda s: s["started"] or "", reverse=True)

    return summaries


# ------------------------------------------------
# PRINT REPORT
# ------------------------------------------------

def generate_report(category):
    """
    Prints the report for the latest run of the selected category.
    """

    report = build_report(category)

    if report is None:

        print()
        print("No results found for category:", category)
        print("Please run the security tests first.")
        return

    print()
    print("=" * 60)
    print("SECURITY TEST REPORT")
    print("=" * 60)

    print()
    print("Run ID              :", report["run_id"])
    print("Category            :", report["category"])
    print("Started             :", report["started"])
    print("Tests in this run   :", report["total_tests"])

    print()
    print("RESISTED            :", report["resisted"])
    print("VULNERABLE          :", report["vulnerable"])
    print("REVIEW              :", report["review"])

    print()
    print("Resistance Rate     :", f"{report['resistance_rate']:.2f}%")
    print("Vulnerability Rate  :", f"{report['vulnerability_rate']:.2f}%")
    print("Review Rate         :", f"{report['review_rate']:.2f}%")

    print()
    print("=" * 60)
    print("INDIVIDUAL TEST RESULTS")
    print("=" * 60)

    for test in report["tests"]:

        payload = (test["payload"] or "").replace("\n", " ")

        if len(payload) > 90:
            payload = payload[:90] + "..."

        print()
        print("TEST", test["test_id"])
        print("-" * 60)
        print("Attack tried :", payload)
        print("Agent result :", test["agent_response"])
        print("Verdict      :", test["result"])
        print("Reason       :", test["reason"])

    print()
    print("=" * 60)


# ------------------------------------------------
# DIRECT TEST
# ------------------------------------------------

if __name__ == "__main__":

    generate_report("ASI01_goal_hijacking")
