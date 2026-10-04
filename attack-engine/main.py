"""
Main Runner
-----------
Starts the Automated Security Testing Framework.
"""

from attack_engine import run_all_attacks


print("=" * 60)
print("AUTOMATED SECURITY TESTING FRAMEWORK")
print("=" * 60)

print("\nAvailable Security Test Categories:")
print("1. ASI01 - Goal Hijacking")
print("2. ASI02 - Tool Misuse")

choice = input("\nEnter category number (1 or 2): ")


if choice == "1":

    print("\nStarting ASI01 - Goal Hijacking tests...")
    run_all_attacks("ASI01_goal_hijacking")


elif choice == "2":

    print("\nStarting ASI02 - Tool Misuse tests...")
    run_all_attacks("ASI02_tool_misuse")


else:

    print("\nInvalid choice.")
    print("Please run the program again and enter 1 or 2.")