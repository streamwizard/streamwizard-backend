import * as monaco from "monaco-editor";
import { loader } from "@monaco-editor/react";
import { configureMonacoTailwindcss, tailwindcssData } from "monaco-tailwindcss";
import type { TailwindConfig } from "monaco-tailwindcss";

/**
 * The Tailwind config the widget runtime effectively uses. Widget documents load
 * the Tailwind Play CDN (see buildWidgetSrcdoc in @repo/ui) without a
 * `tailwind.config` script, so authors get stock Tailwind v3 defaults. Keep this
 * in sync with whatever the srcdoc injects, or the editor will suggest classes
 * that don't exist at runtime (or hide ones that do).
 */
const WIDGET_TAILWIND_CONFIG: TailwindConfig = {};

declare global {
  interface Window {
    MonacoEnvironment?: monaco.Environment;
  }
}

let configured = false;

/**
 * Self-host Monaco instead of letting @monaco-editor/react pull it from
 * jsdelivr, and register the Tailwind language service on top.
 *
 * Self-hosting is what makes the Tailwind integration possible at all:
 * monaco-tailwindcss is an npm module that patches a bundled `monaco-editor`
 * instance, and the CDN build is a separate AMD copy it can't reach. It also
 * lets the editor route drop a third-party origin from its CSP.
 *
 * Must run before the first <Editor> mounts, and only in the browser.
 */
export function setupMonaco(): void {
  if (configured || typeof window === "undefined") return;
  configured = true;

  // Classic workers, not { type: "module" } — Turbopack's worker bootstrap
  // pulls the real chunks in with importScripts(), which a module worker
  // doesn't have. The URLs must be inline literals for the bundler to see them.
  window.MonacoEnvironment = {
    getWorker(_moduleId, label) {
      switch (label) {
        case "json":
          return new Worker(new URL("./workers/json.worker.ts", import.meta.url));
        case "css":
        case "scss":
        case "less":
          return new Worker(new URL("./workers/css.worker.ts", import.meta.url));
        case "html":
        case "handlebars":
        case "razor":
          return new Worker(new URL("./workers/html.worker.ts", import.meta.url));
        case "typescript":
        case "javascript":
          return new Worker(new URL("./workers/ts.worker.ts", import.meta.url));
        case "tailwindcss":
          return new Worker(new URL("./workers/tailwindcss.worker.ts", import.meta.url));
        default:
          return new Worker(new URL("./workers/editor.worker.ts", import.meta.url));
      }
    },
  };

  // Teaches the built-in CSS service about @tailwind/@apply/@screen so the
  // Extra CSS tab stops flagging them as unknown at-rules, and hovers link to
  // the Tailwind docs.
  monaco.languages.css.cssDefaults.setOptions({
    ...monaco.languages.css.cssDefaults.options,
    data: {
      ...monaco.languages.css.cssDefaults.options.data,
      dataProviders: {
        ...monaco.languages.css.cssDefaults.options.data?.dataProviders,
        tailwindcss: tailwindcssData,
      },
    },
  });

  // Class-name completion, hover previews of the generated CSS, colour swatches
  // and unknown-class diagnostics — the same language service that powers the
  // Tailwind CSS IntelliSense VS Code extension.
  configureMonacoTailwindcss(monaco, { tailwindConfig: WIDGET_TAILWIND_CONFIG });

  loader.config({ monaco });
}
