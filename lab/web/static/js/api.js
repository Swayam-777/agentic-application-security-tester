const FRIENDLY = {
  no_agent: "Choose at least one agent to test.",
  providers_busy: "The AI services are busy right now. Wait a minute and try again, or watch the simulated demo.",
  gone: "That item is no longer available.",
  unexpected: "Something went wrong during the test. Please try again.",
  network: "Can't reach the app. Make sure it is still running, then refresh the page.",
};
export const friendly = (code, fallback) => FRIENDLY[code] || fallback || FRIENDLY.unexpected;

async function call(method, url, body) {
  let res;
  try {
    res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  } catch (e) { throw new Error(FRIENDLY.network); }
  let data = null;
  try { data = await res.json(); } catch (e) { /* ignore */ }
  if (!res.ok) throw new Error(friendly(data && data.error && data.error.code, data && data.error && data.error.message));
  return data;
}
export const api = {
  state: () => call("GET", "/api/state"),
  start: (agents, mode) => call("POST", "/api/runs", { agents, mode }),
  job: (id, since) => call("GET", `/api/jobs/${id}?since=${since}`),
  runs: () => call("GET", "/api/runs"),
  run: (id) => call("GET", `/api/runs/${id}`),
  schedules: () => call("GET", "/api/schedules"),
  newSchedule: (b) => call("POST", "/api/schedules", b),
  editSchedule: (id, b) => call("PATCH", `/api/schedules/${id}`, b),
  delSchedule: (id) => call("DELETE", `/api/schedules/${id}`),
  runSchedule: (id) => call("POST", `/api/schedules/${id}/run`),
  providerStats: () => call("GET", "/api/provider-stats"),
  projectRuns: () => call("GET", "/api/project-runs"),
  alerts: () => call("GET", "/api/alerts"),
  readAlerts: () => call("POST", "/api/alerts/read"),
};
