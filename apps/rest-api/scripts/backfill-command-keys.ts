import { createHash, randomBytes } from "crypto";
import { supabase } from "@repo/supabase";
import { encryptToken } from "@repo/supabase/crypto";
import { getNodeCommandKeyHash, insertNodeApiKey } from "@repo/supabase/queries/obs-nodes";

// One-off backfill for the per-node obs_command key (hard cutover to the /obs
// route). Nodes claimed before this change have a rest_api key but no
// obs_command key, so the obs-auto-switcher can't authenticate to them. This
// mints one for every linked node that's missing it.
//
// Run with the rest-api's env so TOKEN_ENCRYPTION_KEY / SUPABASE_* are present:
//   doppler run --config dev_rest_api -- bun apps/rest-api/scripts/backfill-command-keys.ts
// Idempotent: nodes that already have an obs_command key are skipped.

async function main() {
  const { data: nodes, error } = await supabase.from("obs_nodes").select("id, name").eq("status", "linked");
  if (error) throw new Error(`failed to list nodes: ${error.message}`);
  if (!nodes || nodes.length === 0) {
    console.log("no linked nodes — nothing to backfill");
    return;
  }

  let minted = 0;
  let skipped = 0;
  for (const node of nodes) {
    const existing = await getNodeCommandKeyHash(supabase, node.id);
    if (existing) {
      skipped++;
      console.log(`skip   ${node.name} (${node.id}) — already has an obs_command key`);
      continue;
    }
    const commandKey = randomBytes(32).toString("hex");
    const enc = encryptToken(commandKey);
    await insertNodeApiKey(supabase, node.id, {
      type: "obs_command",
      key_hash: createHash("sha256").update(commandKey).digest("hex"),
      key_ciphertext: enc.ciphertext,
      key_iv: enc.iv,
      key_tag: enc.authTag,
    });
    minted++;
    console.log(`minted ${node.name} (${node.id}) — obs_command key created`);
  }

  console.log(`\ndone — minted ${minted}, skipped ${skipped}, ${nodes.length} linked node(s) total`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
