// Every call to the Flask backend, in one place. Endpoints, HTTP methods,
// and payload shapes are UNCHANGED from the original frontend - this file
// only wraps them with consistent error handling so every view module
// doesn't repeat its own fetch/try-catch logic.

async function postJSON(url) {
  const response = await fetch(url, { method: "POST" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Server responded with ${response.status}`);
  }
  return data;
}

async function getJSON(url) {
  const response = await fetch(url);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Server responded with ${response.status}`);
  }
  return data;
}

export const api = {
  runQuickTest: (agentId) => postJSON(`/run-test/${agentId}`),
  runAttackSuite: (agentId) => postJSON(`/run-attack-suite/${agentId}`),
  getHistory: () => getJSON("/api/history"),
  getReport: (runId, categoryKey) =>
    getJSON(`/api/report/${encodeURIComponent(runId)}/${encodeURIComponent(categoryKey)}`),
};

// Cheap reachability check for the topbar connection indicator - reuses
// the history endpoint rather than needing a dedicated /health route
// that doesn't exist in app.py.
export async function pingBackend() {
  try {
    await getJSON("/api/history");
    return true;
  } catch (e) {
    return false;
  }
}
