/**
 * Username colors.
 *
 * Twitch sends an empty `color` for chatters who never picked one, and its own
 * clients then assign one deterministically from the login. Doing the same
 * keeps a given chatter the same color across sessions and across devices,
 * which is most of what makes a chat scannable at a glance.
 */

/** Twitch's default chat palette, in its own order. */
const DEFAULT_COLORS = [
  "#FF0000",
  "#0000FF",
  "#00FF00",
  "#B22222",
  "#FF7F50",
  "#9ACD32",
  "#FF4500",
  "#2E8B57",
  "#DAA520",
  "#D2691E",
  "#5F9EA0",
  "#1E90FF",
  "#FF69B4",
  "#8A2BE2",
  "#00FF7F",
];

function fnv1a(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function parseHex(hex: string): [number, number, number] | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const int = parseInt(match[1]!, 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}

function toHex([r, g, b]: [number, number, number]): string {
  const clamp = (value: number) => Math.max(0, Math.min(255, Math.round(value)));
  return `#${[r, g, b].map((c) => clamp(c).toString(16).padStart(2, "0")).join("")}`;
}

/** WCAG relative luminance, 0 (black) to 1 (white). */
function luminance([r, g, b]: [number, number, number]): number {
  const channel = (raw: number) => {
    const c = raw / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function blend(
  color: [number, number, number],
  toward: [number, number, number],
  amount: number,
): [number, number, number] {
  return [
    color[0] + (toward[0] - color[0]) * amount,
    color[1] + (toward[1] - color[1]) * amount,
    color[2] + (toward[2] - color[2]) * amount,
  ];
}

const WHITE: [number, number, number] = [255, 255, 255];
const BLACK: [number, number, number] = [0, 0, 0];

/**
 * The chatter's color, made readable on the current surface.
 *
 * Several of Twitch's own defaults (and plenty of user picks) are unreadable on
 * a dark background — pure blue especially. Rather than discard the color, it
 * is blended toward the contrasting end until it clears the threshold, which
 * preserves the hue people recognise each other by.
 */
export function resolveUserColor(
  color: string | null | undefined,
  login: string,
  theme: "dark" | "light" = "dark",
): string {
  const chosen =
    (color && parseHex(color)) ||
    parseHex(DEFAULT_COLORS[fnv1a(login.toLowerCase()) % DEFAULT_COLORS.length]!)!;

  const lum = luminance(chosen);
  if (theme === "dark") {
    if (lum >= 0.35) return toHex(chosen);
    // Scale the correction with the shortfall so a nearly-fine color barely moves.
    return toHex(blend(chosen, WHITE, Math.min(0.75, (0.35 - lum) * 1.6)));
  }

  if (lum <= 0.6) return toHex(chosen);
  return toHex(blend(chosen, BLACK, Math.min(0.75, (lum - 0.6) * 1.6)));
}
