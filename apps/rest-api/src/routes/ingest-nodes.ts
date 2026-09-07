import { createHash, randomBytes } from "crypto";
import { Hono } from "hono";
import { supabase } from "@repo/supabase";
import { encryptToken } from "@repo/supabase/crypto";
import {
  claimIngestNodeByTokenHash,
  consumeIngestClaimToken,
  insertIngestNodeApiKey,
  updateIngestNodeTailscaleIp,
} from "@repo/supabase/queries/ingest-nodes";
import { ingestNodeAuth } from "../middleware/ingest-node-auth";
import { env } from "../lib/env";

const ingestNodes = new Hono();

// ── Claim ─────────────────────────────────────────────────────────────────────

// Called by ingest-server's install script during node setup. No Supabase
// session involved -- a fresh, untrusted VM hits this with nothing but the
// one-time claim token in the body, which is why this lives in rest-api
// (brute-force protection, security headers, HTTPS enforcement already wired
// up here) instead of ingest-control, which doesn't even have its Supabase
// credentials configured yet -- that's exactly what this endpoint delivers.
//
// Duplicated from nodes.ts's slugifyHostname rather than shared, keeping the
// OBS and ingest claim domains fully independent of each other.
function slugifyHostname(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "ingest-node";
}

// "-" is Tailscale's shorthand for "the tailnet this credential belongs to" --
// works for OAuth clients since each one is scoped to exactly one tailnet.
const TAILSCALE_TAILNET = "-";

async function getTailscaleAccessToken(): Promise<string> {
  const res = await fetch("https://api.tailscale.com/api/v2/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.TAILSCALE_OAUTH_CLIENT_ID,
      client_secret: env.TAILSCALE_OAUTH_CLIENT_SECRET,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Tailscale OAuth token request failed ${res.status}: ${body}`);
  }
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

// Mints a fresh, single-use, pre-authorized auth key tagged tag:ingest-node --
// this is what lets install.sh join Tailscale automatically instead of an
// admin pasting a manually-generated key into the install command. Scoped to
// a short lifetime since it's only ever needed for the one `tailscale up`
// call made right after this response arrives. Non-fatal on failure: returns
// null rather than throwing, so a Tailscale API hiccup doesn't fail the
// whole claim -- install.sh falls back to warning and requiring a manual
// `tailscale up` in that case, same as if no key were available at all.
async function mintIngestNodeTailscaleAuthKey(nodeId: string): Promise<string | null> {
  try {
    const accessToken = await getTailscaleAccessToken();
    const res = await fetch(`https://api.tailscale.com/api/v2/tailnet/${TAILSCALE_TAILNET}/keys`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        capabilities: {
          devices: {
            create: {
              reusable: false,
              ephemeral: false,
              preauthorized: true,
              tags: ["tag:ingest-node"],
            },
          },
        },
        expirySeconds: 3600,
        description: `ingest-node claim ${nodeId}`,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Tailscale key creation failed ${res.status}: ${body}`);
    }
    const data = (await res.json()) as { key: string };
    return data.key;
  } catch (err) {
    console.warn("[ingest-nodes] failed to mint Tailscale auth key", {
      nodeId,
      error: (err as Error).message,
    });
    return null;
  }
}

ingestNodes.post("/claim", async (c) => {
  const body = await c.req.json();
  const { token, cpu_cores, ram_total_mb, storage_total_mb, public_ip, lan_ip, tailscale_ip } = body as {
    token?: string;
    cpu_cores?: number;
    ram_total_mb?: number;
    storage_total_mb?: number;
    public_ip?: string;
    lan_ip?: string;
    tailscale_ip?: string;
  };

  if (!token) {
    return c.json({ error: "token is required" }, 400);
  }

  const tokenHash = createHash("sha256").update(token).digest("hex");

  // Look up the pending node first so we can derive its hostname slug from
  // the admin-chosen name before the atomic claim UPDATE below.
  const pendingNode = await claimIngestNodeByTokenHash(supabase, tokenHash);
  const hostname = slugifyHostname(pendingNode?.name ?? "ingest-node");

  // Unlike OBS's shared NODE_API_KEY-scoped access, ingest-control talks to
  // Supabase directly with a service-role key, so each box also needs its own
  // INGEST_CONTROL_SECRET (replacing today's single Doppler-shared value).
  // Minted fresh per claim and encrypted at rest so admins can retrieve/rotate it.
  const controlSecret = randomBytes(32).toString("hex");
  const { ciphertext, iv, authTag } = encryptToken(controlSecret);

  // Atomic: the UPDATE itself is scoped by hash/status/expiry, so concurrent
  // claims with the same token can't both succeed (see consumeIngestClaimToken).
  const linked = await consumeIngestClaimToken(supabase, tokenHash, {
    cpu_cores,
    ram_total_mb,
    storage_total_mb,
    public_ip,
    lan_ip,
    tailscale_ip,
    hostname,
    control_secret_ciphertext: ciphertext,
    control_secret_iv: iv,
    control_secret_tag: authTag,
  });

  if (!linked) {
    // The atomic update matched nothing -- look the row up read-only just to
    // pick the right error code; this lookup never drives the mutation.
    const node = await claimIngestNodeByTokenHash(supabase, tokenHash);
    if (!node) {
      return c.json({ error: "Invalid claim token" }, 404);
    }
    if (node.status === "linked") {
      return c.json({ error: "This node has already been claimed" }, 409);
    }
    return c.json({ error: "Claim token has expired" }, 410);
  }

  const apiKey = randomBytes(32).toString("hex");
  const encApiKey = encryptToken(apiKey);
  await insertIngestNodeApiKey(supabase, linked.id, {
    key_hash: createHash("sha256").update(apiKey).digest("hex"),
    key_ciphertext: encApiKey.ciphertext,
    key_iv: encApiKey.iv,
    key_tag: encApiKey.authTag,
  });

  const tailscaleAuthKey = await mintIngestNodeTailscaleAuthKey(linked.id);

  return c.json({
    node_id: linked.id,
    hostname: linked.hostname,
    node_api_key: apiKey,
    ingest_control_secret: controlSecret,
    tailscale_authkey: tailscaleAuthKey,
    supabase_url: env.SUPABASE_URL,
    supabase_secret_key: env.SUPABASE_SECRET_KEY,
    rest_api_url: env.STREAMWIZARD_API_URL,
    // Present only when rest-api itself has InfluxDB configured for this
    // environment — omitted (not null/empty-string) otherwise, so a node
    // claimed before Influx was wired up just runs without host metrics
    // instead of writing empty env vars into its .env.
    ...(env.INFLUXDB_URL && env.INFLUXDB_ORG && env.INFLUXDB_BUCKET && env.INFLUXDB_TOKEN
      ? {
          influxdb_url: env.INFLUXDB_URL,
          influxdb_org: env.INFLUXDB_ORG,
          influxdb_bucket: env.INFLUXDB_BUCKET,
          influxdb_token: env.INFLUXDB_TOKEN,
        }
      : {}),
  });
});

// ── Self-report ──────────────────────────────────────────────────────────────

// Called by ingest-server's install script once it actually has a Tailscale
// IP -- in the deferred-join case that's only true after /claim already
// returned (the auth key needed to join comes back IN that response), so it
// can't be included in the original claim body and needs its own round trip.
ingestNodes.patch("/me", ingestNodeAuth(), async (c) => {
  const body = await c.req.json();
  const { tailscale_ip } = body as { tailscale_ip?: string };

  if (!tailscale_ip) {
    return c.json({ error: "tailscale_ip is required" }, 400);
  }

  const nodeId = c.get("ingestNodeId");
  const { data, error } = await updateIngestNodeTailscaleIp(supabase, nodeId, tailscale_ip);
  if (error) {
    return c.json({ error }, 500);
  }
  return c.json(data);
});

export default ingestNodes;
