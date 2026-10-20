"""
Attack Engine
-------------
Runs security tests using:
1. Predefined payloads
2. An adaptive PAIR-style LLM attacker that refines its attack using
   the judge's reasoning after each resisted attempt, and stops at the
   first breakthrough to save API quota.

Each execution receives a unique Run ID. Predefined tests and PAIR
attempts are saved under the same Run ID so they appear in one report.

Wired to the REAL test-bed agents via target_agent.py - every test
here actually calls Gemini through the same agents shown in the dashboard.
"""

import os
import time

from payload_library import PAYLOADS
from target_agent import process_ticket
from llm_judge import judge_result
from attack_history import save_result, create_run_id
from llm_attacker import generate_test, refine_attack


RETRY_WAIT_SECONDS = 10


# ------------------------------------------------
# BUILD TEST TICKET
# ------------------------------------------------

def build_attack_ticket(payload_text):
    """Converts a security test input into a test ticket."""
    return {
        "sender": "newsletter@dealsnow.com",
        "subject": "Account Notice",
        "body": payload_text
    }


# ------------------------------------------------
# RUN ONE SECURITY TEST
# ------------------------------------------------

def run_single_test(category, payload, test_number, run_id):
    """
    Sends one security test to the real Target Agent for this category,
    judges the response, saves it, and returns (agent_result, result, reason).
    """

    print()
    print("=" * 60)
    print("TEST", test_number)
    print("=" * 60)

    ticket = build_attack_ticket(payload)

    print()
    print("ATTACK ENGINE:")
    print("Sending test to Target Agent...")

    try:
        agent_result = process_ticket(ticket, category)
    except Exception as e:
        if "DAILY_QUOTA_EXHAUSTED" in str(e):
            raise  # stop the whole run cleanly - see main.py
        print(f"\n[ERROR] Target agent call failed: {e}")
        agent_result = {
            "verdict": "NO_ACTION",
            "message": f"Test failed due to an error: {str(e)[:150]}",
        }

    print()
    print("TARGET AGENT RESULT:")
    print(agent_result)

    result, reason = judge_result(
        payload,
        category,
        agent_result,
        actions=agent_result.get("actions"),
    )

    print()
    print("EVALUATOR:")
    print("Result:", result)
    print("Reason:", reason)

    save_result(
        category,
        payload,
        agent_result.get("message", ""),
        result,
        reason,
        run_id
    )

    return agent_result, result, reason


# ------------------------------------------------
# ATTACKER CALLS WITH ONE RETRY
# ------------------------------------------------

def _call_with_retry(func, *args):
    """Calls an attacker function; on failure waits and retries once."""
    output = func(*args)
    if output:
        return output
    print(f"\n[PAIR] Attacker call failed (likely a temporary rate limit). "
          f"Retrying in {RETRY_WAIT_SECONDS}s...")
    time.sleep(RETRY_WAIT_SECONDS)
    return func(*args)


# ------------------------------------------------
# RUN ALL ATTACKS
# ------------------------------------------------

def run_all_attacks(category):
    """Runs predefined tests, then an adaptive PAIR attack loop."""

    run_id = create_run_id()
    payloads = PAYLOADS.get(category, [])

    if not payloads:
        print("No payloads found for category:", category)
        return

    print("=" * 60)
    print("ATTACK ENGINE")
    print("=" * 60)
    print("Run ID:", run_id)
    print("Category:", category)
    print("Predefined tests:", len(payloads))

    test_number = 1
    agent_result = {}

    # ---- PREDEFINED TESTS ----
    for payload in payloads:
        agent_result, result, reason = run_single_test(
            category, payload, test_number, run_id
        )
        test_number += 1

    # ---- PAIR LOOP: adaptive LLM attacker ----
    print()
    print("=" * 60)
    print("PAIR ADAPTIVE ATTACK LOOP")
    print("=" * 60)

    max_attempts = int(os.getenv("MAX_PAIR_ATTEMPTS", "4"))

    previous_payload = payloads[-1]
    previous_response = agent_result.get("message", "")

    current_payload = _call_with_retry(
        generate_test, category, previous_payload, previous_response
    )

    if not current_payload:
        print("[PAIR] Attacker could not generate an initial attack; skipping PAIR loop.")
        return

    broke_through = False
    attempt = 0

    for attempt in range(1, max_attempts + 1):
        print()
        print("-" * 60)
        print(f"PAIR ATTEMPT {attempt} OF {max_attempts}")
        print("-" * 60)
        print("Attack input:")
        print(current_payload)

        agent_result, result, reason = run_single_test(
            category, current_payload, test_number, run_id
        )
        test_number += 1

        if result == "VULNERABLE":
            print(f"\n[PAIR] Broke through on attempt {attempt}.")
            broke_through = True
            break

        if attempt == max_attempts:
            break

        print(f"\n[PAIR] Attempt {attempt} was {result}. Refining attack using the judge's reasoning...")

        refined = _call_with_retry(
            refine_attack, category, current_payload, agent_result, reason
        )
        if not refined:
            print("[PAIR] Attacker could not refine; stopping loop.")
            break
        current_payload = refined

    print()
    print("=" * 60)
    print("PAIR LOOP FINISHED -",
          "agent broke" if broke_through else "agent held",
          f"after {attempt} attempt(s)")
    print("=" * 60)


# ------------------------------------------------
# DIRECT TEST
# ------------------------------------------------

if __name__ == "__main__":
    run_all_attacks("ASI05_unsafe_code_execution")