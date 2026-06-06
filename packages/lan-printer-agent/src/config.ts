/**
 * Agent configuration loaded from environment variables.
 *
 * All required vars must be present at startup or the process will exit early
 * with a clear error message. PRINTER_IDS is optional — when omitted the agent
 * processes every LAN printer the signed-in user can read under RLS.
 */
export interface AgentConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  email: string;
  password: string;
  /** Optional allow-list of printer UUIDs. `null` = all printers under RLS. */
  printerIds: string[] | null;
  pollIntervalMs: number;
}

export function loadConfig(): AgentConfig {
  const required = [
    "SUPABASE_URL",
    "SUPABASE_ANON_KEY",
    "AGENT_EMAIL",
    "AGENT_PASSWORD",
  ] as const;

  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    throw new Error(
      `Missing required env vars: ${missing.join(", ")}. ` +
        `See packages/lan-printer-agent/README.md for setup instructions.`,
    );
  }

  const raw = process.env.PRINTER_IDS?.trim();
  const printerIds = raw
    ? raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : null;

  const pollIntervalMs = Number(process.env.POLL_INTERVAL_MS ?? 5000);
  if (!Number.isFinite(pollIntervalMs) || pollIntervalMs < 250) {
    throw new Error(
      `POLL_INTERVAL_MS must be a finite number >= 250 (got ${process.env.POLL_INTERVAL_MS}).`,
    );
  }

  return {
    supabaseUrl: process.env.SUPABASE_URL!,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY!,
    email: process.env.AGENT_EMAIL!,
    password: process.env.AGENT_PASSWORD!,
    printerIds,
    pollIntervalMs,
  };
}
