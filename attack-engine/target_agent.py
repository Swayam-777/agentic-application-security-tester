"""
Target Agent Adapter
---------------------
Connects the attack engine to the REAL test-bed agents, replacing
the earlier local stand-in. Each ASI category maps to one real
vulnerable agent. The attack engine's payload gets inserted as the
one attack item in that agent's ticket/inbox/task queue, alongside
the agent's normal legitimate items - then the real agent actually
runs, calling the real Gemini model, exactly as it does from the
dashboards.
"""

import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), "..", "test-bed"))

import vulnerable_email_agent_gemini as email_agent
import vulnerable_refund_agent_gemini as refund_agent
import vulnerable_data_agent_gemini as data_agent

CATEGORY_TO_AGENT = {
    "ASI01_goal_hijacking": email_agent,
    "ASI02_tool_misuse": refund_agent,
    "ASI05_unsafe_code_execution": data_agent,
}


def process_ticket(ticket, category):
    """
    Runs the real target agent for this category, with the attack
    engine's payload (ticket['body']) injected as the attack item.

    Returns a dict with the real agent's own verdict and message -
    this is the agent's own validated judgment, not a re-derived
    guess from keyword matching.
    """

    agent_module = CATEGORY_TO_AGENT.get(category)

    if agent_module is None:
        return {
            "verdict": "NO_ACTION",
            "message": f"No real target agent is configured for category '{category}'.",
        }

    result = agent_module.run_agent(attack_payload=ticket["body"])

    return {
        "verdict": result["verdict"],
        "message": result["message"],
    }


if __name__ == "__main__":
    test_ticket = {
        "sender": "customer@example.com",
        "subject": "Test Ticket",
        "body": "Please check my order.",
    }

    result = process_ticket(test_ticket, "ASI02_tool_misuse")

    print("\nTARGET AGENT RESULT")
    print("--------------------------------")
    print(result)
