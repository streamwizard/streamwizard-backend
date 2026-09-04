"use client";

/**
 * Fetches a media file, decodes its audio and folds it into peaks, once per
 * URL for the session. Decoding happens off the main thread inside the
 * browser; an 8 kHz offline context keeps the decoded buffer small (a ten
 * minute song is a few megabytes) and still leaves sixteen samples per
 * slice, plenty for a picture. Anything that goes wrong reads as "no
 * waveform": a file without audio, one too big to be worth it, or a CDN
 * that does not allow this origin to read it.
 */

import { createUrlCache, useUrlCache } from "../url-cache";
import { foldPeaks, type WaveformPeaks } from "./waveform-peaks";

export const WAVEFORM_MAX_BYTES = 30 * 1024 * 1024;
const DECODE_SAMPLE_RATE = 8000;

async function fetchBytes(url: string): Promise<ArrayBuffer | null> {
  const controller = new AbortController();
  // no-store: the element that plays this URL may have cached a no-cors
  // response, which lacks the CORS header a fetch needs.
  const res = await fetch(url, { mode: "cors", credentials: "omit", cache: "no-store", signal: controller.signal });
  if (!res.ok) return null;
  const declared = Number(res.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > WAVEFORM_MAX_BYTES) {
    controller.abort();
    return null;
  }
  if (!res.body) return res.arrayBuffer();
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > WAVEFORM_MAX_BYTES) {
      controller.abort();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes.buffer;
}

export async function decodeWaveform(url: string): Promise<WaveformPeaks | null> {
  if (typeof window === "undefined" || typeof OfflineAudioContext === "undefined" || !url) return null;
  try {
    const bytes = await fetchBytes(url);
    if (!bytes) return null;
    const context = new OfflineAudioContext(1, 1, DECODE_SAMPLE_RATE);
    const buffer = await context.decodeAudioData(bytes);
    const channels: Float32Array[] = [];
    for (let c = 0; c < buffer.numberOfChannels; c++) channels.push(buffer.getChannelData(c));
    return foldPeaks(channels, buffer.sampleRate);
  } catch {
    return null;
  }
}

const waveformCache = createUrlCache<WaveformPeaks, undefined>((url) => decodeWaveform(url));

export function loadWaveform(url: string): Promise<WaveformPeaks | null> {
  return waveformCache.load(url, undefined);
}

/** undefined while decoding, null when there is nothing to draw. */
export function useWaveform(url: string): WaveformPeaks | null | undefined {
  return useUrlCache(waveformCache, url, undefined);
}
