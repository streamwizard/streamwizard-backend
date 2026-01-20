# @repo/typescript-config

Shared TypeScript configurations for the StreamWizard platform.

## 🚀 Overview

This package provides a set of standardized `tsconfig.json` bases to ensure consistent compiler settings across all applications and packages in the monorepo.

## 🛠 Configurations Available

- `base.json`: The core configuration used by most internal packages.
- `nextjs.json`: Optimized settings for Next.js applications.
- `react-library.json`: Configuration for building shared React component libraries.

## 🏁 Usage

In your app or package's `tsconfig.json`:

```json
{
  "extends": "@repo/typescript-config/base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```
