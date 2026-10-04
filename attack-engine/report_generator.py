"""
Security Test Report Generator
------------------------------
Reads saved security test results and
reports the latest testing run.
"""

import json
import os


# ------------------------------------------------
# RESULTS FILE
# ------------------------------------------------

RESULTS_FILE = os.path.join(
    "results",
    "attack_results.json"
)


# ------------------------------------------------
# GENERATE REPORT
# ------------------------------------------------

def generate_report(category):
    """
    Generates a report for the latest run
    of the selected category.
    """

    # Check results file
    if not os.path.exists(RESULTS_FILE):

        print("No results file found.")
        print("Please run the security tests first.")
        return

    # Read results
    with open(
        RESULTS_FILE,
        "r",
        encoding="utf-8"
    ) as file:

        history = json.load(file)

    # ------------------------------------------------
    # FIND RESULTS FOR CATEGORY
    # ------------------------------------------------

    category_results = []

    for item in history:

        if item.get("category") == category:

            category_results.append(item)

    if not category_results:

        print("No results found for category:", category)
        return

    # ------------------------------------------------
    # FIND LATEST RUN
    # ------------------------------------------------

    latest_run_id = category_results[-1].get("run_id")

    # If old records do not have a Run ID
    if not latest_run_id:

        print("The latest results do not contain a Run ID.")
        print("Run the security tests again.")
        return

    # ------------------------------------------------
    # SELECT ONLY LATEST RUN
    # ------------------------------------------------

    latest_results = []

    for item in category_results:

        if item.get("run_id") == latest_run_id:

            latest_results.append(item)

    # ------------------------------------------------
    # COUNT RESULTS
    # ------------------------------------------------

    total_tests = len(latest_results)

    resisted = 0
    vulnerable = 0
    review = 0

    for item in latest_results:

        result = item.get("result")

        if result == "RESISTED":

            resisted += 1

        elif result == "VULNERABLE":

            vulnerable += 1

        elif result == "REVIEW":

            review += 1

    # ------------------------------------------------
    # CALCULATE PERCENTAGES
    # ------------------------------------------------

    resistance_rate = (
        resisted / total_tests
    ) * 100

    vulnerability_rate = (
        vulnerable / total_tests
    ) * 100

    review_rate = (
        review / total_tests
    ) * 100

    # ------------------------------------------------
    # DISPLAY SUMMARY
    # ------------------------------------------------

    print()
    print("=" * 60)
    print("LATEST SECURITY TEST RUN")
    print("=" * 60)

    print()
    print("Run ID              :", latest_run_id)
    print("Category            :", category)
    print("Tests in this run   :", total_tests)

    print()
    print("RESISTED            :", resisted)
    print("VULNERABLE          :", vulnerable)
    print("REVIEW              :", review)

    print()
    print("Resistance Rate     :", f"{resistance_rate:.2f}%")
    print("Vulnerability Rate  :", f"{vulnerability_rate:.2f}%")
    print("Review Rate         :", f"{review_rate:.2f}%")

    # ------------------------------------------------
    # INDIVIDUAL RESULTS
    # ------------------------------------------------

    print()
    print("=" * 60)
    print("INDIVIDUAL TEST RESULTS")
    print("=" * 60)

    for item in latest_results:

        print()
        print("TEST", item.get("test_id"))
        print("-" * 60)

        print(
            "Result   :",
            item.get("result")
        )

        print(
            "Reason   :",
            item.get(
                "reason",
                "Reason not available."
            )
        )

    print()
    print("=" * 60)


# ------------------------------------------------
# DIRECT TEST
# ------------------------------------------------

if __name__ == "__main__":

    generate_report(
        "ASI01_goal_hijacking"
    )