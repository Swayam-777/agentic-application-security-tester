let historyCount = 0;

async function runTest(agentId) {
  const card = document.querySelector(`.agent-card[data-agent-id="${agentId}"]`);
  const button = card.querySelector(".run-btn");
  const originalText = button.textContent;
  button.textContent = "Running…";
  button.disabled = true;

  try {
    const response = await fetch(`/run-test/${agentId}`, { method: "POST" });
    if (!response.ok) throw new Error(`Server responded with ${response.status}`);
    const result = await response.json();
    showResult(result);
    addToHistory(result);
  } catch (err) {
    console.error(err);
    alert("Something went wrong running this test. Check the Flask console for details.");
  } finally {
    button.textContent = originalText;
    button.disabled = false;
  }
}

function showResult(result) {
  const panel = document.getElementById("result-panel");
  const badge = document.getElementById("verdict-badge");
  const message = document.getElementById("result-message");
  const actionsBlock = document.getElementById("actions-block");

  panel.hidden = false;
  badge.textContent = result.verdict;
  badge.className = "verdict-badge verdict-" + result.verdict.toLowerCase();
  message.textContent = result.message;

  if (result.actions && result.actions.length > 0) {
    actionsBlock.innerHTML =
      "<h3>Tool calls made</h3><pre>" + JSON.stringify(result.actions, null, 2) + "</pre>";
  } else {
    actionsBlock.innerHTML = "<p>No tool calls were made.</p>";
  }
}

function addToHistory(result) {
  historyCount += 1;
  document.getElementById("no-history").style.display = "none";

  const row = document.createElement("tr");
  row.innerHTML = `
    <td>${historyCount}</td>
    <td>${result.agent}</td>
    <td class="mono">${result.category}</td>
    <td><span class="verdict-pill verdict-${result.verdict.toLowerCase()}">${result.verdict}</span></td>
    <td>${result.message}</td>
  `;
  document.getElementById("history-body").appendChild(row);
}
