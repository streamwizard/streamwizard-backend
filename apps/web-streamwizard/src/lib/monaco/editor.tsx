"use client";

import Editor from "@monaco-editor/react";
import { setupMonaco } from "./setup";

// Runs at module evaluation, which is the only reliable "before the first
// <Editor> renders" hook. Safe because this module is only ever reached through
// a dynamic import with ssr: false.
setupMonaco();

export default Editor;
