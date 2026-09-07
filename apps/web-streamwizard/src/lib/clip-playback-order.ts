/*
 * The clips widget's play order. Lived inside use-clip-playlist.ts until the
 * public overlays page wanted the same rotation behaviour; the two have to
 * stay identical, so there is one of it.
 *
 * `rng` is injectable for the one caller that renders on the server: an
 * unseeded shuffle would produce a different first order on the server and the
 * client and break hydration. Everything else takes the Math.random default.
 */

export type Rng = () => number;

export function shuffleIndices(length: number, rng: Rng = Math.random): number[] {
  const indices = Array.from({ length }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices;
}

/**
 * Sequential sorts play the list in order. Random draws a fresh shuffle, and
 * when `previousFirst` is given it refuses to open on the clip that just
 * played, so a reshuffle never repeats a clip back to back.
 */
export function createPlaybackOrder(
  length: number,
  random: boolean,
  previousFirst?: number,
  rng: Rng = Math.random,
): number[] {
  if (length <= 1) return [0];
  if (!random) return Array.from({ length }, (_, i) => i);

  const order = shuffleIndices(length, rng);
  if (previousFirst !== undefined && length > 1 && order[0] === previousFirst) {
    const swapIndex = 1 + Math.floor(rng() * (length - 1));
    [order[0], order[swapIndex]] = [order[swapIndex], order[0]];
  }
  return order;
}

/**
 * A small deterministic generator, so a server-rendered shuffle matches the
 * client's first paint. Same shape as Math.random: 0 to 1, exclusive.
 */
export function seededRng(seed: number): Rng {
  let state = seed || 1;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}
