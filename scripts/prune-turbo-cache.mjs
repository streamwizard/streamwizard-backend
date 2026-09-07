#!/usr/bin/env node
/**
 * Turbopack's dev filesystem cache (`experimental.turbopackFileSystemCacheForDev`,
 * on by default since Next 16) writes an SST store under `.next/dev/cache/turbopack`
 * and never compacts or prunes it. Across weeks of branch switching it grows
 * without bound — one app reached 5.1GB on disk, which the dev server then holds
 * resident, pushing `next-server` to ~6GB RSS.
 *
 * Run this before `next dev`: it drops the cache once it crosses the threshold,
 * so warm starts stay fast most of the time and we only pay an occasional cold
 * compile instead of a runaway one.
 */
import { rm, stat, readdir } from "node:fs/promises";
import path from "node:path";

const LIMIT_BYTES = Number(process.env.TURBO_CACHE_LIMIT_MB ?? 1536) * 1024 * 1024;
const cacheDir = path.resolve(process.cwd(), ".next/dev/cache/turbopack");

/** Recursive size walk. Returns 0 when the directory does not exist yet. */
async function dirSize(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (err) {
    if (err.code === "ENOENT") return 0;
    throw err;
  }

  let total = 0;
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      total += await dirSize(full);
    } else if (entry.isFile()) {
      try {
        total += (await stat(full)).size;
      } catch (err) {
        // Files churn while the cache is live; a vanished entry just counts as 0.
        if (err.code !== "ENOENT") throw err;
      }
    }
  }
  return total;
}

const toMB = (bytes) => Math.round(bytes / 1024 / 1024);

try {
  const size = await dirSize(cacheDir);
  if (size === 0) process.exit(0);

  if (size > LIMIT_BYTES) {
    await rm(cacheDir, { recursive: true, force: true });
    console.log(
      `[prune-turbo-cache] cleared ${toMB(size)}MB turbopack cache (limit ${toMB(LIMIT_BYTES)}MB) — next start will cold compile`,
    );
  } else {
    console.log(`[prune-turbo-cache] turbopack cache ${toMB(size)}MB / ${toMB(LIMIT_BYTES)}MB`);
  }
} catch (err) {
  // Never block `next dev` on a housekeeping failure.
  console.warn(`[prune-turbo-cache] skipped: ${err.message}`);
}
