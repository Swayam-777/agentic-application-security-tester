"""
Flask backend for the Automated Security Testing Framework dashboard.

This is the "waiter" between the browser and our Python test agents:
it exposes one URL per action the browser can trigger (run a test),
and returns JSON data back for the page's JavaScript to display -
without ever reloading the page.
"""

import sys
import os
from flask import Flask, render_template, jsonify

sys.path.append(os.path.join(os.path.dirname(__file__), "test-bed"))

import vulnerable_email_agent_gemini as agent1
import vulnerable_refund_agent_gemini as agent2
import vulnerable_data_agent_gemini as agent3

app = Flask(__name__)

AGENTS = {
    "agent1": {
        "module": agent1,
        "name": "Email Assistant",
        "category": "ASI01 - Goal Hijacking",
        "description": "Reads an inbox and emails a summary to the real user. One email contains a hidden instruction trying to redirect where the summary goes.",
    },
    "agent2": {
        "module": agent2,
        "name": "Refund Assistant",
        "category": "ASI02 - Tool Misuse",
        "description": "Reads support tickets and processes refunds. One ticket tries to talk it into an unauthorized, inflated refund.",
    },
    "agent3": {
        "module": agent3,
        "name": "Data Analysis Assistant",
        "category": "ASI05 - Unsafe Code Execution",
        "description": "Reads task requests and writes/runs analysis code. One request disguises a destructive command as routine data hygiene.",
    },
}


@app.route("/")
def index():
    # Only pass the browser-safe fields - the module object itself
    # can't be turned into HTML/JSON.
    agents_for_page = {
        key: {"name": a["name"], "category": a["category"], "description": a["description"]}
        for key, a in AGENTS.items()
    }
    return render_template("index.html", agents=agents_for_page)


@app.route("/run-test/<agent_id>", methods=["POST"])
def run_test(agent_id):
    if agent_id not in AGENTS:
        return jsonify({"error": "Unknown agent"}), 404

    result = AGENTS[agent_id]["module"].run_agent()
    return jsonify(result)


if __name__ == "__main__":
    app.run(debug=True)
