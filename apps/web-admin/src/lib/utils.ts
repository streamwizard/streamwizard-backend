import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function formatBytesPerSec(bytesPerSec: number): string {
  if (bytesPerSec < 1024) return `${bytesPerSec.toFixed(0)} B/s`;
  if (bytesPerSec < 1024 ** 2) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
  if (bytesPerSec < 1024 ** 3) return `${(bytesPerSec / 1024 ** 2).toFixed(1)} MB/s`;
  return `${(bytesPerSec / 1024 ** 3).toFixed(2)} GB/s`;
}

// Network throughput in bits/s — the convention used for stream bitrates. Bits
// use decimal SI steps (1000), unlike the binary (1024) steps for byte sizes,
// so a 500 KB/s ingest reads as ~4.0 Mbit/s (× 8, then ÷ 1000 per step).
export function formatBitsPerSec(bytesPerSec: number): string {
  const bits = bytesPerSec * 8;
  if (bits < 1000) return `${bits.toFixed(0)} bit/s`;
  if (bits < 1000 ** 2) return `${(bits / 1000).toFixed(1)} Kbit/s`;
  if (bits < 1000 ** 3) return `${(bits / 1000 ** 2).toFixed(1)} Mbit/s`;
  return `${(bits / 1000 ** 3).toFixed(2)} Gbit/s`;
}

// Which unit family the bandwidth readouts render in, toggled globally from the
// header (see bandwidth-unit-context). "bits" is the default — stream operators
// think in Mbit/s.
export type BandwidthUnit = "bits" | "bytes";

export function formatBandwidth(bytesPerSec: number, unit: BandwidthUnit): string {
  return unit === "bits" ? formatBitsPerSec(bytesPerSec) : formatBytesPerSec(bytesPerSec);
}
