// Lazy process.env accessors, read at call time — the same convention as
// @repo/metrics and @repo/discord-api. Validation belongs to the host app
// (zod in apps/alert-worker, t3-env in web-admin); this module only maps names.
// Empty strings count as unset, matching t3-env's emptyStringAsUndefined.

function optional(name: string): string | undefined {
  const value = process.env[name];
  return value ? value : undefined;
}

function required(name: string): string {
  const value = optional(name);
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

export const alertConfig = {
  get influxdbUrl() {
    return required("INFLUXDB_URL");
  },
  get influxdbBucket() {
    return required("INFLUXDB_BUCKET");
  },
  get supabaseUrl() {
    return required("SUPABASE_URL");
  },
  /** The alert-worker reads WS_SERVER_URL; the NEXT_PUBLIC_ fallback keeps the
   * web-admin deployment working without a Doppler rename. */
  get wsServerUrl() {
    return optional("WS_SERVER_URL") ?? optional("NEXT_PUBLIC_WS_SERVER_URL");
  },
  get streamwizardApiUrl() {
    return optional("STREAMWIZARD_API_URL");
  },
  get alertDiscordChannelId() {
    return optional("ALERT_DISCORD_CHANNEL_ID");
  },
  get telegramChatId() {
    return optional("TELEGRAM_CHAT_ID");
  },
  get discordBotToken() {
    return optional("DISCORD_BOT_TOKEN");
  },
  get telegramBotToken() {
    return optional("TELEGRAM_BOT_TOKEN");
  },
  /** Where the web-admin dashboard lives; adds an "Open dashboard" button
   * to Discord alerts when set. */
  get monitorBaseUrl() {
    return optional("MONITOR_BASE_URL");
  },
  /** Escape hatch for the tick overlap lock, which rides the snapshot RPC and
   * so costs nothing. Default on — it guards against Dokploy accidentally
   * scaling the worker to two replicas. Only the literal "false" disables. */
  get lockEnabled() {
    return process.env.ALERT_LOCK_ENABLED !== "false";
  },
  /** Mirrors the worker's TICK_SECONDS (same default) so rule definitions can
   * derive tick-count debounces from wall-clock invariants — see
   * probe.node_unreachable. */
  get tickSeconds() {
    return Number(process.env.TICK_SECONDS) || 15;
  },
};
