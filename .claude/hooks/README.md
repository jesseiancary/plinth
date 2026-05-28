# Claude Code Hooks

Event-driven scripts that run in response to Claude Code actions.

## Available Hooks

### `validate-types.sh`

**Trigger:** Before Claude edits TypeScript files

**Purpose:** Runs `tsc --noEmit` to check for type errors before making changes.

**Behavior:** Warns if type errors exist but doesn't block the edit. Claude will be informed of the
type issues and can address them.

### `lint-staged.sh`

**Trigger:** Before git commit (via git pre-commit hook)

**Purpose:** Runs ESLint and Prettier on staged TypeScript files.

**Behavior:**

- Lints staged `.ts` and `.tsx` files
- Auto-fixes issues where possible
- Formats code with Prettier
- Re-adds formatted files to staging
- Blocks commit if unfixable lint errors exist

### `validate-openapi.sh`

**Trigger:** Before git commit when OpenAPI spec is modified

**Purpose:** Ensures OpenAPI specification is valid and types are regenerated when the spec changes.

**Behavior:**

- Detects if `packages/openapi/openapi.yaml` was modified
- Runs `pnpm --filter openapi validate` to check spec validity
- Verifies that `packages/types/src/generated.ts` was also updated
- Ensures generated types compile without errors
- Blocks commit if validation fails or types are out of sync

## Hook Configuration

Hooks are shell scripts that:

- Return exit code 0 for success
- Return non-zero exit code to block the action (use sparingly)
- Print useful feedback to help Claude understand what happened

## Installing Git Hooks

To enable the pre-commit hook:

```bash
# Create git pre-commit hook
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
.claude/hooks/lint-staged.sh
EOF

chmod +x .git/hooks/pre-commit
```

Or use a tool like `husky` to manage git hooks:

```bash
pnpm add -D husky
npx husky install
npx husky add .git/hooks/pre-commit ".claude/hooks/lint-staged.sh"
```

## Creating Custom Hooks

Example hook structure:

```bash
#!/bin/bash
set -e

echo "Running custom validation..."

# Your validation logic here

if [ $? -eq 0 ]; then
  echo "✅ Validation passed"
  exit 0
else
  echo "❌ Validation failed"
  exit 1  # Block the action
fi
```

Make the hook executable:

```bash
chmod +x .claude/hooks/your-hook.sh
```

## Best Practices

- **Keep hooks fast** — slow hooks frustrate the workflow
- **Provide clear feedback** — explain what passed/failed and why
- **Don't block unnecessarily** — warnings are often better than hard stops
- **Make hooks idempotent** — safe to run multiple times
- **Document behavior** — explain what each hook does in this README
