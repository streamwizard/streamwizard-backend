/**
 * Generates apps/docs/widgets/api/events.mdx from the same sources the widget
 * editor's autocomplete uses:
 *  - packages/types/src/overlay-ws.ts   -> which listener string maps to which payload type
 *  - src/widget-editor-declarations.ts  -> the payload type definitions (zod-derived)
 *
 * Run from packages/schemas:  bun run scripts/generate-widget-event-docs.ts
 * Commit the output. Re-run whenever event schemas change.
 */

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { WIDGET_EDITOR_DECLARATIONS } from "../src/widget-editor-declarations";

const repoRoot = join(import.meta.dir, "../../..");
const overlayWsSource = readFileSync(join(repoRoot, "packages/types/src/overlay-ws.ts"), "utf8");
const outPath = join(repoRoot, "apps/docs/widgets/api/events.mdx");

// listener string -> payload type name, from the OverlaySocketMessage union
const listenerMap: Array<{ listener: string; payloadType: string }> = [];
for (const match of overlayWsSource.matchAll(/\{ type: "([^"]+)";\s+(?:status: "connected";\s+)?payload: (\w+) \}/g)) {
  const [, listener, payloadType] = match;
  if (!listenerMap.some((e) => e.listener === listener)) {
    listenerMap.push({ listener: listener!, payloadType: payloadType! });
  }
}

// payload type name -> its declaration text, from the generated .d.ts string
const typeDefs = new Map<string, string>();
for (const block of WIDGET_EDITOR_DECLARATIONS.split(/\n(?=type )/)) {
  const nameMatch = block.match(/^type (\w+) =/);
  if (nameMatch) typeDefs.set(nameMatch[1]!, block.trim());
}

const sections: string[] = [];
let missing = 0;
for (const { listener, payloadType } of listenerMap) {
  const def = typeDefs.get(payloadType);
  if (!def) {
    missing++;
    continue;
  }
  sections.push(`## \`${listener}\`

\`\`\`ts
${def}
\`\`\`
`);
}

const page = `---
title: "Event reference"
description: "Every event your widget can receive, with its exact payload shape."
---

{/* GENERATED FILE - do not edit by hand.
    Regenerate from packages/schemas: bun run scripts/generate-widget-event-docs.ts */}

Every event arrives through the \`onEventReceived\` listener. \`detail.listener\`
is the event name below, \`detail.event\` is the payload. The widget editor
autocompletes all of these, so you rarely need to memorize them.

\`\`\`js
addEventListener('onEventReceived', (e) => {
  if (e.detail.listener === 'channel.follow') {
    console.log(e.detail.event.user_name, 'just followed');
  }
});
\`\`\`

Events prefixed \`channel.\` and \`stream.\` are Twitch EventSub payloads,
relayed as-is. Events prefixed \`streamwizard.\` come from StreamWizard itself
(GPS, ingest stats, and other IRL data).

${sections.join("\n")}`;

writeFileSync(outPath, page);
console.log(`Wrote ${outPath}: ${sections.length} events (${missing} without a payload type in the declarations, skipped)`);
