#!/usr/bin/env bash
#
# Pre-merge hook: Validate OpenAPI specification
#
# This hook ensures the OpenAPI spec is valid before allowing commits.
# It prevents broken specs from being merged into main.
#
# Usage: This hook is automatically triggered before tool execution in Claude Code
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Validating OpenAPI specification...${NC}"

# Change to repo root
cd "$(git rev-parse --show-toplevel)" || exit 1

# Check if openapi.yaml has been modified
OPENAPI_MODIFIED=$(git diff --cached --name-only | grep -c "packages/openapi/openapi.yaml" || true)

if [ "$OPENAPI_MODIFIED" -eq 0 ]; then
  echo -e "${GREEN}✓ OpenAPI spec not modified, skipping validation${NC}"
  exit 0
fi

echo -e "${YELLOW}OpenAPI spec modified, running validation...${NC}"

# Run OpenAPI validation
if pnpm --filter openapi validate --silent; then
  echo -e "${GREEN}✓ OpenAPI spec is valid${NC}"
else
  echo -e "${RED}✗ OpenAPI spec validation failed${NC}"
  echo ""
  echo "The OpenAPI specification has validation errors."
  echo "Please fix the errors in packages/openapi/openapi.yaml"
  echo ""
  echo "To validate manually:"
  echo "  pnpm --filter openapi validate"
  echo ""
  echo "Common issues:"
  echo "  - Invalid YAML syntax"
  echo "  - Missing schema references"
  echo "  - Duplicate operationIds"
  echo "  - Invalid OpenAPI 3.1 structure"
  exit 1
fi

# Check if types need regeneration
echo -e "${YELLOW}Checking if types are up to date...${NC}"

TYPES_MODIFIED=$(git diff --cached --name-only | grep -c "packages/types/src/generated.ts" || true)

if [ "$TYPES_MODIFIED" -eq 0 ]; then
  echo -e "${YELLOW}⚠ OpenAPI spec changed but types not regenerated${NC}"
  echo ""
  echo "It looks like you modified the OpenAPI spec but didn't regenerate types."
  echo "Please run:"
  echo "  pnpm --filter openapi generate:types"
  echo "  git add packages/types/src/generated.ts"
  echo ""
  echo "This ensures frontend types stay in sync with the API spec."
  exit 1
fi

echo -e "${GREEN}✓ Types are up to date${NC}"

# Verify types compile
echo -e "${YELLOW}Verifying generated types compile...${NC}"

if pnpm --filter types typecheck --silent 2>/dev/null; then
  echo -e "${GREEN}✓ Generated types compile successfully${NC}"
else
  echo -e "${RED}✗ Generated types have compilation errors${NC}"
  echo ""
  echo "The generated types from the OpenAPI spec don't compile."
  echo "This usually means:"
  echo "  - Invalid schema definitions in openapi.yaml"
  echo "  - Missing required fields"
  echo "  - Broken type references"
  echo ""
  echo "To debug:"
  echo "  pnpm --filter types typecheck"
  exit 1
fi

echo -e "${GREEN}✓ All OpenAPI validations passed${NC}"
exit 0
