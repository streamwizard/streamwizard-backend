/**
 * Waveform peaks: the loudest and quietest sample per slice of time, folded
 * once per file and re-bucketed per paint. Pure, so the shape of the picture
 * is testable without a decoder.
 */

export interface WaveformPeaks {
  peaksPerSecond: number;
  durationMs: number;
  /** Per slice, the lowest and highest sample scaled to -127..127. */
  min: Int8Array;
  max: Int8Array;
}

const SCALE = 127;

/**
 * Folds decoded channels into `peaksPerSecond` slices, taking the extremes
 * across channels. Slices start from 0, so silence is a flat line.
 */
export function foldPeaks(channels: ArrayLike<number>[], sampleRate: number, peaksPerSecond = 500): WaveformPeaks {
  const length = channels.reduce((longest, c) => Math.max(longest, c.length), 0);
  const samplesPerPeak = sampleRate / peaksPerSecond;
  const count = Math.ceil(length / samplesPerPeak);
  const min = new Int8Array(count);
  const max = new Int8Array(count);
  for (let i = 0; i < count; i++) {
    const from = Math.floor(i * samplesPerPeak);
    const to = Math.min(length, Math.max(from + 1, Math.floor((i + 1) * samplesPerPeak)));
    let lo = 0;
    let hi = 0;
    for (const channel of channels) {
      for (let j = from; j < to; j++) {
        const v = channel[j] ?? 0;
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
    }
    min[i] = Math.round(Math.max(-1, lo) * SCALE);
    max[i] = Math.round(Math.min(1, hi) * SCALE);
  }
  return { peaksPerSecond, durationMs: (length / sampleRate) * 1000, min, max };
}

/**
 * Folds the media range [fromMs, toMs) into `buckets` [min, max] pairs in
 * -1..1, one pair per pixel column. Time outside the peaks reads as silence.
 */
export function bucketPeaks(peaks: WaveformPeaks, fromMs: number, toMs: number, buckets: number, out?: Float32Array): Float32Array {
  const result = out && out.length >= buckets * 2 ? out : new Float32Array(buckets * 2);
  const span = (toMs - fromMs) / buckets;
  const peaksPerMs = peaks.peaksPerSecond / 1000;
  const total = peaks.min.length;
  for (let b = 0; b < buckets; b++) {
    const t0 = fromMs + b * span;
    const i0 = Math.floor(t0 * peaksPerMs);
    // At least one slice per bucket, so a zoomed-in column still shows something.
    const i1 = Math.max(i0 + 1, Math.ceil((t0 + span) * peaksPerMs));
    let lo = 0;
    let hi = 0;
    for (let i = Math.max(0, i0); i < Math.min(total, i1); i++) {
      const a = peaks.min[i]!;
      const z = peaks.max[i]!;
      if (a < lo) lo = a;
      if (z > hi) hi = z;
    }
    result[b * 2] = lo / SCALE;
    result[b * 2 + 1] = hi / SCALE;
  }
  return result;
}
