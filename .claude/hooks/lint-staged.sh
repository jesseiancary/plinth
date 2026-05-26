#!/bin/bash
# Pre-commit hook: Run ESLint and Prettier on staged files

set -e

echo "Running lint-staged..."

# Get list of staged TypeScript files
STAGED_TS_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.tsx?$' || true)

if [ -z "$STAGED_TS_FILES" ]; then
  echo "No TypeScript files staged, skipping lint"
  exit 0
fi

# Run ESLint on staged files
echo "Linting staged files..."
pnpm eslint $STAGED_TS_FILES --fix || {
  echo "❌ Lint errors found. Please fix before committing."
  exit 1
}

# Run Prettier on staged files
echo "Formatting staged files..."
pnpm prettier --write $STAGED_TS_FILES || {
  echo "❌ Formatting failed."
  exit 1
}

# Re-add formatted files
git add $STAGED_TS_FILES

echo "✅ Lint and format passed"
exit 0
