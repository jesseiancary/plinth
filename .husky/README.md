# Husky Git Hooks

This directory contains Git hooks managed by Husky.

## Setup

Hooks are automatically installed when you run `pnpm install` (via the `prepare` script).

## Available Hooks

### pre-commit

Runs `lint-staged` which:

- Lints and fixes TypeScript files with ESLint
- Formats all staged files with Prettier
- Only runs on staged files (fast!)

Configuration: `.lintstagedrc.json`

## Manual Setup

If hooks don't install automatically:

```bash
pnpm exec husky install
```

## Bypassing Hooks

Sometimes you need to bypass hooks (use sparingly):

```bash
# Skip pre-commit hook
git commit --no-verify -m "message"
```
