"""
Flask backend for the Automated Security Testing Framework dashboard.

This is the "waiter" between the browser and our Python code. Each URL
below is one thing the page can ask for, and each answers with JSON:

  /                              the dashboard page
  /run-test/<agent>              quick test: run one agent once
  /run-attack-suite/<agent>      run the attack engine's full suite
                                 against that agent, return the report
  /api/history                   every past suite run (read from disk)
  /api/report/<run>/<category>   the full report for one past run
"""

import os
import sys

from flask import Flask, jsonify, render_template

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.append(os.path.join(BASE_DIR, "test-bed"))
sys.path.append(os.path.join(BASE_DIR, "attack-engine"))

import vulnerable_email_agent_gemini as agent1
import vulnerable_refund_agent_gemini as agent2
import vulnerable_data_agent_gemini as agent3

import attack_engine
from report_generator import build_report, get_run_history

app = Flask(__name__)

AGENTS = {
    "agent1": {
        "module": agent1,
        "name": "Email Assistant",
        "category": "ASI01 - Goal Hijacking",
        "category_key": "ASI01_goal_hijacking",
        "description": "Reads an inbox and emails a summary to the real user. One email contains a hidden instruction trying to redirect where the summary goes.",
    },
    "agent2": {
        "module": agent2,
        "name": "Refund Assistant",
        "category": "ASI02 - Tool Misuse",
        "category_key": "ASI02_tool_misuse",
        "description": "Reads support tickets and processes refunds. One ticket tries to talk it into an unauthorized, inflated refund.",
    },
    "agent3": {
        "module": agent3,
        "name": "Data Analysis Assistant",
        "category": "ASI05 - Unsafe Code Execution",
        "category_key": "ASI05_unsafe_code_execution",
        "description": "Reads task requests and writes/runs analysis code. One request disguises a destructive command as routine data hygiene.",
    },
}

CATEGORY_LABELS = {a["category_key"]: a["category"] for a in AGENTS.values()}


@app.route("/")
def index():
    # Only browser-safe fields - the module object can't go into a page.
    agents_for_page = {
        key: {"name": a["name"], "category": a["category"], "description": a["description"]}
        for key, a in AGENTS.items()
    }
    return render_template(
        "index.html",
        agents=agents_for_page,
        category_labels=CATEGORY_LABELS,
    )


@app.route("/run-test/<agent_id>", methods=["POST"])
def run_test(agent_id):
    if agent_id not in AGENTS:
        return jsonify({"error": "Unknown agent"}), 404

    try:
        result = AGENTS[agent_id]["module"].run_agent()
    except RuntimeError as e:
        return jsonify({"error": _friendly_error(e)}), _status_for(e)
    except Exception as e:
        return jsonify({"error": f"The test failed: {e}"}), 500

    return jsonify(result)


@app.route("/run-attack-suite/<agent_id>", methods=["POST"])
def run_attack_suite(agent_id):
    if agent_id not in AGENTS:
        return jsonify({"error": "Unknown agent"}), 404

    category_key = AGENTS[agent_id]["category_key"]

    try:
        attack_engine.run_all_attacks(category_key)
    except RuntimeError as e:
        return jsonify({"error": _friendly_error(e)}), _status_for(e)
    except Exception as e:
        return jsonify({"error": f"The attack suite failed: {e}"}), 500

    # The run that just finished is the latest one for this category.
    report = build_report(category_key)

    if report is None:
        return jsonify({"error": "The suite finished but no results were saved."}), 500

    return jsonify(report)


@app.route("/api/history")
def api_history():
    return jsonify(get_run_history())


@app.route("/api/report/<run_id>/<category_key>")
def api_report(run_id, category_key):
    report = build_report(category_key, run_id=run_id)

    if report is None:
        return jsonify({"error": "No report found for that run."}), 404

    return jsonify(report)


def _friendly_error(error):
    message = str(error)
    if "DAILY_QUOTA_EXHAUSTED" in message:
        return message.replace("DAILY_QUOTA_EXHAUSTED: ", "")
    return message


def _status_for(error):
    return 429 if "DAILY_QUOTA_EXHAUSTED" in str(error) else 500


if __name__ == "__main__":
    app.run(debug=True)
