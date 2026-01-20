# @repo/eslint-config

Shared ESLint and Prettier configurations for the StreamWizard platform.

## 🚀 Overview

Ensures consistent code style and catches common errors across all JS/TS projects in the monorepo. It aggregates best practices for TypeScript, React, and general Node.js development.

## 🛠 Features

- **Standardized Rules**: Consistent linting for all workspace projects.
- **Prettier Integration**: Ready-to-use formatting rules that play nice with ESLint.
- **Monorepo Aware**: Configured to work seamlessly with Turborepo's caching and task execution.

## 🏁 Usage

In your project's `.eslintrc.js` or `eslint.config.js`:

```javascript
module.exports = {
  extends: ["@repo/eslint-config/base"], // or other available configs
};
```
