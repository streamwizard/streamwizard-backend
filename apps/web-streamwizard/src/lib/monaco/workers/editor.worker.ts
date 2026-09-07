// Worker entry points are thin re-export shims: `new Worker(new URL(...))` needs
// a module the bundler can see relative to this file. Importing the bare package
// path directly inside new URL() is not reliably resolved by Turbopack.
import "monaco-editor/esm/vs/editor/editor.worker";
