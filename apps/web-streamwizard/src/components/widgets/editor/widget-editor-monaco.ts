import type { Monaco } from "@monaco-editor/react";

/** Monaco wiring for the widget editor: shared options and Emmet completion. */

export const EDITOR_OPTIONS = {
  fontSize: 14,
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  wordWrap: "on" as const,
  tabSize: 2,
  padding: { top: 16 },
  autoClosingBrackets: "beforeWhitespace" as const,
  autoClosingQuotes: "beforeWhitespace" as const,
  autoIndent: "brackets" as const,
  formatOnPaste: false,
  formatOnType: false,
};

// Module-scoped: Monaco's providers are global to the loaded instance, and this
// page never mounts two editors. Would need to become per-instance if it did.
let emmetProvidersRegistered = false;

export function registerEmmetProviders(monaco: Monaco) {
  if (emmetProvidersRegistered) return;
  emmetProvidersRegistered = true;

  // Lazily imported so the expand-abbreviation bundle never runs on the server
  import("@emmetio/expand-abbreviation").then(({ expand }) => {
    function makeProvider(syntax: "html" | "css") {
      return {
        triggerCharacters: syntax === "css" ? [" ", ":"] : [">", " "],
        provideCompletionItems(
          model: Parameters<
            Parameters<typeof monaco.languages.registerCompletionItemProvider>[1]["provideCompletionItems"]
          >[0],
          position: Parameters<
            Parameters<typeof monaco.languages.registerCompletionItemProvider>[1]["provideCompletionItems"]
          >[1]
        ) {
          const col = position.column - 1;
          const before = model.getLineContent(position.lineNumber).slice(0, col);
          const match = before.match(/[\w>+.*#[\](){}^$=@!|"'-]+$/);
          if (!match) return { suggestions: [] };
          const abbrev = match[0];

          let expanded: string;
          try {
            expanded = expand(abbrev, { syntax });
          } catch {
            return { suggestions: [] };
          }
          if (!expanded || expanded === abbrev) return { suggestions: [] };

          const startCol = col - abbrev.length + 1;
          return {
            suggestions: [
              {
                label: abbrev,
                kind: monaco.languages.CompletionItemKind.Snippet,
                insertText: expanded,
                insertTextRules:
                  monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                range: new monaco.Range(
                  position.lineNumber,
                  startCol,
                  position.lineNumber,
                  position.column
                ),
                detail: "Emmet",
                documentation: expanded,
              },
            ],
          };
        },
      };
    }

    monaco.languages.registerCompletionItemProvider("html", makeProvider("html"));
    monaco.languages.registerCompletionItemProvider("css", makeProvider("css"));
  });
}

