#!/bin/bash
set -e

# Security Check Hook - Pre-commit validation for critical security issues
# Enforces OWASP Top 10 2025 critical vulnerabilities (A01, A02, A03)
# Exit code 0 = pass, non-zero = block commit

echo "🔐 Running security checks..."

SECURITY_ERRORS=0
SECURITY_WARNINGS=0

# Colors for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# Get list of staged TypeScript/JavaScript files
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(ts|tsx|js|jsx)$' || true)

if [ -z "$STAGED_FILES" ]; then
  echo "✅ No TypeScript/JavaScript files to check"
  exit 0
fi

echo "Checking $(echo "$STAGED_FILES" | wc -l) file(s)..."

# =============================================================================
# A01: Broken Access Control - CRITICAL (BLOCK)
# =============================================================================

echo ""
echo "🔴 A01: Checking for Broken Access Control vulnerabilities..."

# Check 1: Client-provided organizationId (CRITICAL)
echo "  → Checking for client-provided organizationId..."
CLIENT_ORG_ID=$(echo "$STAGED_FILES" | xargs grep -nH 'organizationId.*req\.body\|organizationId.*req\.query\|organizationId.*req\.params' 2>/dev/null || true)
if [ -n "$CLIENT_ORG_ID" ]; then
  echo -e "${RED}    ❌ CRITICAL: Client-provided organizationId detected${NC}"
  echo "$CLIENT_ORG_ID" | while read -r line; do
    echo "       $line"
  done
  echo "       → Use req.tenantId instead (derived from JWT/API key)"
  SECURITY_ERRORS=$((SECURITY_ERRORS + 1))
fi

# Check 2: Missing authenticate middleware on routes
echo "  → Checking for unprotected routes..."
UNPROTECTED_ROUTES=$(echo "$STAGED_FILES" | xargs grep -nH 'router\.\(get\|post\|put\|patch\|delete\)' 2>/dev/null | grep -v 'authenticate\|public' || true)
if [ -n "$UNPROTECTED_ROUTES" ]; then
  # This is a warning, not an error (some routes are intentionally public)
  echo -e "${YELLOW}    ⚠️  WARNING: Potential unprotected routes found${NC}"
  echo "       Review these routes to ensure they should be public:"
  echo "$UNPROTECTED_ROUTES" | head -5 | while read -r line; do
    echo "       $line"
  done
  SECURITY_WARNINGS=$((SECURITY_WARNINGS + 1))
fi

# Check 3: Prisma queries without organizationId filter
echo "  → Checking for missing tenant isolation in Prisma queries..."
MISSING_TENANT_FILTER=$(echo "$STAGED_FILES" | xargs grep -nH 'prisma\.\w\+\.find' 2>/dev/null | grep -v 'organizationId\|userId\|// no-tenant-check' || true)
if [ -n "$MISSING_TENANT_FILTER" ]; then
  echo -e "${YELLOW}    ⚠️  WARNING: Prisma queries without organizationId filter${NC}"
  echo "       Review these queries for tenant isolation:"
  echo "$MISSING_TENANT_FILTER" | head -5 | while read -r line; do
    echo "       $line"
  done
  echo "       → Add '// no-tenant-check' comment if intentional"
  SECURITY_WARNINGS=$((SECURITY_WARNINGS + 1))
fi

# =============================================================================
# A02: Security Misconfiguration - CRITICAL (BLOCK)
# =============================================================================

echo ""
echo "🔴 A02: Checking for Security Misconfiguration..."

# Check 1: Stack traces in error responses (CRITICAL)
echo "  → Checking for stack trace leakage..."
STACK_TRACE_LEAK=$(echo "$STAGED_FILES" | xargs grep -nH 'res\.json.*\.stack\|res\.send.*\.stack\|error\.stack' 2>/dev/null | grep -v 'logger\|log\|console' || true)
if [ -n "$STACK_TRACE_LEAK" ]; then
  echo -e "${RED}    ❌ CRITICAL: Stack trace leakage in response${NC}"
  echo "$STACK_TRACE_LEAK" | while read -r line; do
    echo "       $line"
  done
  echo "       → Log errors server-side, return sanitized errors to client"
  SECURITY_ERRORS=$((SECURITY_ERRORS + 1))
fi

# Check 2: Hardcoded secrets (CRITICAL)
echo "  → Checking for hardcoded secrets..."
HARDCODED_SECRETS=$(echo "$STAGED_FILES" | xargs grep -nHiE '(password|secret|api_key|apikey|token|jwt_secret)\s*=\s*["\047][^"\047]{8,}' 2>/dev/null | grep -v 'process\.env\|PASSWORD_SCHEMA\|PASSWORD_MIN\|JWT_SECRET' || true)
if [ -n "$HARDCODED_SECRETS" ]; then
  echo -e "${RED}    ❌ CRITICAL: Hardcoded secrets detected${NC}"
  echo "$HARDCODED_SECRETS" | while read -r line; do
    echo "       $line"
  done
  echo "       → Use environment variables for secrets"
  SECURITY_ERRORS=$((SECURITY_ERRORS + 1))
fi

# Check 3: Missing helmet middleware in app setup
echo "  → Checking for helmet middleware..."
if echo "$STAGED_FILES" | grep -q 'app\.ts\|main\.ts\|server\.ts'; then
  HELMET_MISSING=$(echo "$STAGED_FILES" | xargs grep -L "import.*helmet\|require.*helmet" 2>/dev/null | grep -E 'app\.ts|main\.ts|server\.ts' || true)
  if [ -n "$HELMET_MISSING" ]; then
    echo -e "${YELLOW}    ⚠️  WARNING: helmet middleware not imported in app setup${NC}"
    echo "       Add: import helmet from 'helmet'"
    echo "       Add: app.use(helmet(...))"
    SECURITY_WARNINGS=$((SECURITY_WARNINGS + 1))
  fi
fi

# =============================================================================
# A03: Software Supply Chain Failures - CRITICAL (WARN)
# =============================================================================

echo ""
echo "🔴 A03: Checking for Software Supply Chain Failures..."

# Check 1: Dependencies with known vulnerabilities
echo "  → Running pnpm audit..."
if command -v pnpm &> /dev/null; then
  AUDIT_OUTPUT=$(pnpm audit --audit-level=moderate --json 2>/dev/null || true)
  if [ -n "$AUDIT_OUTPUT" ]; then
    VULN_COUNT=$(echo "$AUDIT_OUTPUT" | grep -c '"severity"' || echo "0")
    if [ "$VULN_COUNT" -gt 0 ]; then
      echo -e "${YELLOW}    ⚠️  WARNING: $VULN_COUNT vulnerability/vulnerabilities found in dependencies${NC}"
      echo "       Run: pnpm audit"
      echo "       Run: pnpm audit --fix (for auto-fixable issues)"
      SECURITY_WARNINGS=$((SECURITY_WARNINGS + 1))
    fi
  fi
else
  echo -e "${YELLOW}    ⚠️  WARNING: pnpm not found, skipping dependency audit${NC}"
fi

# Check 2: Unsafe eval or Function constructor (CRITICAL)
echo "  → Checking for eval() usage..."
EVAL_USAGE=$(echo "$STAGED_FILES" | xargs grep -nH '\beval\s*(\|new\s\+Function\s*(' 2>/dev/null || true)
if [ -n "$EVAL_USAGE" ]; then
  echo -e "${RED}    ❌ CRITICAL: eval() or Function() constructor detected${NC}"
  echo "$EVAL_USAGE" | while read -r line; do
    echo "       $line"
  done
  echo "       → Avoid eval() and Function() - potential code injection"
  SECURITY_ERRORS=$((SECURITY_ERRORS + 1))
fi

# =============================================================================
# A04: Cryptographic Failures - MODERATE (WARN)
# =============================================================================

echo ""
echo "🟡 A04: Checking for Cryptographic Failures..."

# Check 1: Math.random() used for security tokens (WARN)
echo "  → Checking for weak random number generation..."
WEAK_RANDOM=$(echo "$STAGED_FILES" | xargs grep -nH 'Math\.random()' 2>/dev/null | grep -iE 'token|key|secret|id|nonce' || true)
if [ -n "$WEAK_RANDOM" ]; then
  echo -e "${YELLOW}    ⚠️  WARNING: Math.random() used for security-sensitive values${NC}"
  echo "$WEAK_RANDOM" | head -3 | while read -r line; do
    echo "       $line"
  done
  echo "       → Use crypto.randomBytes() for tokens/keys/secrets"
  SECURITY_WARNINGS=$((SECURITY_WARNINGS + 1))
fi

# Check 2: Weak hashing algorithms (MD5, SHA1)
echo "  → Checking for weak hashing algorithms..."
WEAK_HASH=$(echo "$STAGED_FILES" | xargs grep -nH "createHash\(['\"]md5\|createHash\(['\"]sha1" 2>/dev/null || true)
if [ -n "$WEAK_HASH" ]; then
  echo -e "${YELLOW}    ⚠️  WARNING: Weak hashing algorithm detected (MD5/SHA1)${NC}"
  echo "$WEAK_HASH" | while read -r line; do
    echo "       $line"
  done
  echo "       → Use SHA-256 or bcrypt for password hashing"
  SECURITY_WARNINGS=$((SECURITY_WARNINGS + 1))
fi

# Check 3: Passwords in logs
echo "  → Checking for password logging..."
PASSWORD_LOGGING=$(echo "$STAGED_FILES" | xargs grep -nHiE 'log.*password|console.*password' 2>/dev/null | grep -v 'PASSWORD_SCHEMA\|passwordHash\|passwordResetToken' || true)
if [ -n "$PASSWORD_LOGGING" ]; then
  echo -e "${YELLOW}    ⚠️  WARNING: Password may be logged${NC}"
  echo "$PASSWORD_LOGGING" | while read -r line; do
    echo "       $line"
  done
  echo "       → Never log passwords or sensitive data"
  SECURITY_WARNINGS=$((SECURITY_WARNINGS + 1))
fi

# =============================================================================
# A05: Injection - MODERATE (WARN)
# =============================================================================

echo ""
echo "🟡 A05: Checking for Injection vulnerabilities..."

# Check 1: $queryRawUnsafe usage (SQL Injection risk)
echo "  → Checking for unsafe raw SQL queries..."
RAW_SQL_UNSAFE=$(echo "$STAGED_FILES" | xargs grep -nH '\$queryRawUnsafe\|\$executeRawUnsafe' 2>/dev/null || true)
if [ -n "$RAW_SQL_UNSAFE" ]; then
  echo -e "${YELLOW}    ⚠️  WARNING: Unsafe raw SQL query detected${NC}"
  echo "$RAW_SQL_UNSAFE" | while read -r line; do
    echo "       $line"
  done
  echo "       → Use \$queryRaw with template literals or Prisma ORM methods"
  SECURITY_WARNINGS=$((SECURITY_WARNINGS + 1))
fi

# Check 2: dangerouslySetInnerHTML in React
echo "  → Checking for XSS vulnerabilities in React..."
DANGEROUS_HTML=$(echo "$STAGED_FILES" | xargs grep -nH 'dangerouslySetInnerHTML' 2>/dev/null || true)
if [ -n "$DANGEROUS_HTML" ]; then
  echo -e "${YELLOW}    ⚠️  WARNING: dangerouslySetInnerHTML detected${NC}"
  echo "$DANGEROUS_HTML" | while read -r line; do
    echo "       $line"
  done
  echo "       → Ensure HTML is sanitized with DOMPurify before rendering"
  SECURITY_WARNINGS=$((SECURITY_WARNINGS + 1))
fi

# Check 3: Command execution with user input
echo "  → Checking for command injection risks..."
COMMAND_INJECTION=$(echo "$STAGED_FILES" | xargs grep -nH 'exec\|spawn\|execFile' 2>/dev/null | grep 'req\.body\|req\.query\|req\.params' || true)
if [ -n "$COMMAND_INJECTION" ]; then
  echo -e "${YELLOW}    ⚠️  WARNING: Command execution with user input${NC}"
  echo "$COMMAND_INJECTION" | while read -r line; do
    echo "       $line"
  done
  echo "       → Validate and sanitize all user input, use execFile with array args"
  SECURITY_WARNINGS=$((SECURITY_WARNINGS + 1))
fi

# =============================================================================
# Summary
# =============================================================================

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Security Check Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ $SECURITY_ERRORS -gt 0 ]; then
  echo -e "${RED}❌ CRITICAL ERRORS: $SECURITY_ERRORS${NC}"
  echo "   → These MUST be fixed before committing"
fi

if [ $SECURITY_WARNINGS -gt 0 ]; then
  echo -e "${YELLOW}⚠️  WARNINGS: $SECURITY_WARNINGS${NC}"
  echo "   → Review these issues (not blocking)"
fi

if [ $SECURITY_ERRORS -eq 0 ] && [ $SECURITY_WARNINGS -eq 0 ]; then
  echo -e "${GREEN}✅ No security issues detected${NC}"
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Exit with error if critical issues found
if [ $SECURITY_ERRORS -gt 0 ]; then
  echo -e "${RED}🚫 Commit blocked due to critical security issues${NC}"
  echo "   Fix the errors above and try again."
  echo ""
  exit 1
fi

if [ $SECURITY_WARNINGS -gt 0 ]; then
  echo -e "${YELLOW}⚠️  Commit allowed with warnings${NC}"
  echo "   Consider addressing warnings before pushing."
  echo ""
fi

echo -e "${GREEN}✅ Security check passed${NC}"
exit 0
