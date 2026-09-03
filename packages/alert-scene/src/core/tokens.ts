const TOKEN_RE = /\{([a-zA-Z][a-zA-Z0-9_]*)\}/g;

/**
 * Replaces `{key}` with `values[key]`. Unknown tokens stay as typed so a typo
 * shows up on the canvas instead of vanishing.
 */
export function substituteTokens(template: string, values: Record<string, string>): string {
  if (!template.includes("{")) return template;
  return template.replace(TOKEN_RE, (whole, key: string) =>
    Object.prototype.hasOwnProperty.call(values, key) ? (values[key] ?? "") : whole
  );
}

/** Distinct token names in order of first appearance. */
export function extractTokens(template: string): string[] {
  const out: string[] = [];
  for (const m of template.matchAll(TOKEN_RE)) {
    const key = m[1];
    if (key && !out.includes(key)) out.push(key);
  }
  return out;
}
