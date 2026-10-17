"""
Main Runner
-----------
Starts the Automated Security Testing Framework.
After the tests finish, prints a report for that run.
"""

from attack_engine import run_all_attacks
from report_generator import generate_report

CATEGORIES = {
    "1": ("ASI01 - Goal Hijacking", "ASI01_goal_hijacking"),
    "2": ("ASI02 - Tool Misuse", "ASI02_tool_misuse"),
    "3": ("ASI05 - Unsafe Code Execution", "ASI05_unsafe_code_execution"),
}

print("=" * 60)
print("AUTOMATED SECURITY TESTING FRAMEWORK")
print("=" * 60)

print("\nAvailable Security Test Categories:")
for key, (label, _) in CATEGORIES.items():
    print(f"{key}. {label}")

choice = input("\nEnter category number (1, 2, or 3): ").strip()

if choice not in CATEGORIES:
    print("\nInvalid choice.")
    print("Please run the program again and enter 1, 2, or 3.")
else:
    label, category = CATEGORIES[choice]
    print(f"\nStarting {label} tests...")
    try:
        run_all_attacks(category)
        generate_report(category)
    except RuntimeError as e:
        if "DAILY_QUOTA_EXHAUSTED" in str(e):
            print("\n" + "=" * 60)
            print("RUN STOPPED - DAILY API QUOTA USED UP")
            print("=" * 60)
            print(str(e).replace("DAILY_QUOTA_EXHAUSTED: ", ""))
            print("Results saved so far are kept in results/attack_results.json.")
        else:
            raise
