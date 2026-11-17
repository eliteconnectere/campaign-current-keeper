const endpoint = process.env.CAMPAIGN_PROCESSOR_URL || "https://eliteconnectere.site/api/public/process-campaigns";
const secret = process.env.CAMPAIGN_WORKER_SECRET;
const intervalMs = Number(process.env.POLL_INTERVAL_MS || 45_000);
const timeoutMs = Number(process.env.POLL_TIMEOUT_MS || 12_000);

if (!secret) {
  console.error(JSON.stringify({
    level: "fatal",
    event: "worker_configuration_error",
    at: new Date().toISOString(),
    message: "CAMPAIGN_WORKER_SECRET is required; refusing to start unauthenticated."
  }));
  process.exit(1);
}

if (!Number.isFinite(intervalMs) || intervalMs < 30_000 || intervalMs > 60_000) {
  console.error(JSON.stringify({
    level: "fatal",
    event: "worker_configuration_error",
    at: new Date().toISOString(),
    message: "POLL_INTERVAL_MS must be between 30000 and 60000."
  }));
  process.exit(1);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function summarize(body) {
  if (!body || typeof body !== "object") return { responseSummary: String(body ?? "").slice(0, 300) };
  return {
    ok: body.ok ?? null,
    campaigns: body.campaigns ?? null,
    processedRecipients: body.processed ?? null,
    completedCampaigns: body.completed ?? null,
    pausedCampaigns: body.paused ?? null,
    emailsSent: body.emailsSent ?? body.sent ?? null,
    error: body.error ?? null
  };
}

console.info(JSON.stringify({
  level: "info",
  event: "campaign_poller_started",
  at: new Date().toISOString(),
  endpoint,
  pollIntervalMs: intervalMs,
  requestTimeoutMs: timeoutMs
}));

while (true) {
  const requestedAt = new Date().toISOString();
  const started = Date.now();
  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${secret}`,
        "x-campaign-worker-secret": secret,
        Accept: "application/json"
      },
      signal: AbortSignal.timeout(timeoutMs)
    });
    const raw = await response.text();
    let parsed;
    try { parsed = JSON.parse(raw); } catch { parsed = { responseSummary: raw.slice(0, 300) }; }

    console.info(JSON.stringify({
      level: response.ok ? "info" : "error",
      event: "campaign_poller_cycle",
      requestedAt,
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - started,
      httpStatus: response.status,
      ...summarize(parsed)
    }));
  } catch (error) {
    console.error(JSON.stringify({
      level: "error",
      event: "campaign_poller_request_failed",
      requestedAt,
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - started,
      error: error instanceof Error ? error.message : String(error)
    }));
  }
  await sleep(intervalMs);
}
