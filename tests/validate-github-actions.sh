#!/usr/bin/env bash
set -eo pipefail

# GitHub Actions Workflow Validation Script
# Validates workflow logic, extraction patterns, and prerequisites
#
# Usage: ./tests/validate-github-actions.sh

echo "======================================================================"
echo "GitHub Actions Workflow Validation"
echo "======================================================================"
echo ""

WORKFLOW_FILE=".github/workflows/update-draws.yml"
SETUP_GUIDE="docs/GITHUB_ACTIONS_SETUP.md"
SSH_PRIVATE_KEY="$HOME/.ssh/github-actions-megasena"
SSH_PUBLIC_KEY="$HOME/.ssh/github-actions-megasena.pub"

PASSED=0
FAILED=0

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

pass() {
    echo -e "${GREEN}[OK]${NC} $1"
    PASSED=$((PASSED + 1))
}

fail() {
    echo -e "${RED}[ERROR]${NC} $1"
    FAILED=$((FAILED + 1))
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# Test 1: Workflow file exists
echo "[1/12] Checking workflow file exists..."
if [ -f "$WORKFLOW_FILE" ]; then
    pass "Workflow file exists: $WORKFLOW_FILE"
else
    fail "Workflow file not found: $WORKFLOW_FILE"
fi

# Test 2: Workflow YAML syntax
echo "[2/12] Validating YAML syntax..."
if command -v yamllint &> /dev/null; then
    if yamllint -d relaxed "$WORKFLOW_FILE" 2>/dev/null; then
        pass "YAML syntax valid"
    else
        fail "YAML syntax errors detected"
    fi
else
    if grep -q "^name:" "$WORKFLOW_FILE" && grep -q "^on:" "$WORKFLOW_FILE"; then
        pass "Basic YAML structure valid (yamllint not installed)"
    else
        fail "YAML structure appears invalid"
    fi
fi

# Test 3: Check for correct grep pattern
echo "[3/12] Verifying grep pattern matches script output..."
if grep -q 'grep -q "New draws added:"' "$WORKFLOW_FILE"; then
    pass "Workflow uses correct grep pattern: 'New draws added:'"
else
    fail "Workflow uses incorrect grep pattern (should be 'New draws added:')"
fi

# Test 4: Check for string equality (not numeric comparison)
echo "[4/12] Checking for type-safe GitHub Actions expressions..."
if grep -q "steps.fetch_draws.outputs.new_draws > 0" "$WORKFLOW_FILE"; then
    fail "Found numeric comparison on string output (bug!)"
elif grep -q "steps.fetch_draws.outputs.new_draws != '0'" "$WORKFLOW_FILE"; then
    pass "Uses string equality for GitHub Actions outputs"
else
    warn "Could not verify output comparison logic"
fi

# Test 5: Verify sed extraction pattern
echo "[5/12] Testing sed extraction pattern..."
TEST_OUTPUT="  New draws added: 11"
EXTRACTED=$(echo "$TEST_OUTPUT" | sed 's/[^0-9]*//g')
if [ "$EXTRACTED" = "11" ]; then
    pass "Sed extraction pattern works correctly"
else
    fail "Sed extraction failed (got '$EXTRACTED', expected '11')"
fi

# Test 6: SSH keys exist
echo "[6/12] Checking SSH key files..."
if [ -f "$SSH_PRIVATE_KEY" ] && [ -f "$SSH_PUBLIC_KEY" ]; then
    pass "SSH key pair exists"

    # Check permissions (portable way)
    if ls -l "$SSH_PRIVATE_KEY" | grep -q "^-rw-------"; then
        pass "Private key has correct permissions (600)"
    else
        warn "Private key permissions may be incorrect (should be 600)"
    fi
else
    fail "SSH key pair not found"
fi

# Test 7: Verify setup guide exists
echo "[7/12] Checking setup documentation..."
if [ -f "$SETUP_GUIDE" ]; then
    pass "Setup guide exists: $SETUP_GUIDE"
else
    fail "Setup guide not found: $SETUP_GUIDE"
fi

# Test 8: Check for required secrets documentation
echo "[8/12] Verifying secrets documentation..."
if grep -q "VPS_SSH_KEY" "$SETUP_GUIDE" && \
   grep -q "VPS_HOST" "$SETUP_GUIDE" && \
   grep -q "VPS_PORT" "$SETUP_GUIDE"; then
    pass "All required secrets documented"
else
    fail "Missing secrets documentation"
fi

# Test 9: Validate cron expression
echo "[9/12] Checking cron schedule..."
if grep -q "cron: '0 21 \* \* \*'" "$WORKFLOW_FILE"; then
    pass "Cron schedule set to 21:00 UTC daily"
else
    warn "Cron schedule not found or incorrect"
fi

# Test 10: Test pull-draws script output format
echo "[10/12] Verifying pull-draws script output..."
if [ -f "scripts/pull-draws.ts" ]; then
    # Run script with existing draw to verify output format
    TEST_OUTPUT=$(bun run scripts/pull-draws.ts --start 2932 --end 2932 2>&1 | grep "New draws added:" || echo "")
    if echo "$TEST_OUTPUT" | grep -q "New draws added:"; then
        pass "pull-draws script outputs expected format"
    else
        fail "pull-draws script output format mismatch"
    fi
else
    warn "Could not test pull-draws script (file not found)"
fi

# Test 11: Workflow conditional logic
echo "[11/12] Validating conditional step execution..."
if grep -q "if: steps.fetch_draws.outputs.new_draws != '0'" "$WORKFLOW_FILE"; then
    pass "Conditional logic uses string equality"
else
    fail "Conditional logic may be incorrect"
fi

# Test 12: Check for dry run mode
echo "[12/12] Verifying dry run mode..."
if grep -q "inputs.dry_run != 'true'" "$WORKFLOW_FILE"; then
    pass "Dry run mode implemented correctly"
else
    warn "Dry run mode not found or incorrect"
fi

echo ""
echo "======================================================================"
echo "Validation Summary"
echo "======================================================================"
echo -e "${GREEN}Passed:${NC} $PASSED"
echo -e "${RED}Failed:${NC} $FAILED"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}All validations passed!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Complete Step 2-6 in docs/GITHUB_ACTIONS_SETUP.md"
    echo "2. Add public key to VPS: ssh-copy-id -i ~/.ssh/github-actions-megasena.pub root@VPS_HOST"
    echo "3. Configure GitHub Secrets (VPS_SSH_KEY, VPS_HOST, VPS_PORT)"
    echo "4. Test workflow manually in GitHub Actions"
    exit 0
else
    echo -e "${RED}Some validations failed. Please review and fix.${NC}"
    exit 1
fi
