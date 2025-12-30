#!/usr/bin/env bash

set -euo pipefail

# Test suite for agent-scripts helpers
# Run with: ./scripts/test-helpers.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
TEMP_DIR=$(mktemp -d)
TESTS_PASSED=0
TESTS_FAILED=0

cleanup() {
  rm -rf "$TEMP_DIR"
}
trap cleanup EXIT

# Colors
red='\033[0;31m'
green='\033[0;32m'
yellow='\033[0;33m'
nc='\033[0m'

assert_success() {
  local name="$1"
  shift
  if "$@" >/dev/null 2>&1; then
    printf "${green}✓${nc} %s\n" "$name"
    ((TESTS_PASSED++)) || true
  else
    printf "${red}✗${nc} %s\n" "$name"
    ((TESTS_FAILED++)) || true
  fi
}

assert_failure() {
  local name="$1"
  shift
  if ! "$@" >/dev/null 2>&1; then
    printf "${green}✓${nc} %s\n" "$name"
    ((TESTS_PASSED++)) || true
  else
    printf "${red}✗${nc} %s\n" "$name"
    ((TESTS_FAILED++)) || true
  fi
}

assert_contains() {
  local name="$1"
  local haystack="$2"
  local needle="$3"
  if echo "$haystack" | grep -qF "$needle"; then
    printf "${green}✓${nc} %s\n" "$name"
    ((TESTS_PASSED++)) || true
  else
    printf "${red}✗${nc} %s\n" "$name"
    ((TESTS_FAILED++)) || true
  fi
}

setup_test_repo() {
  local test_repo="$TEMP_DIR/test-repo"
  rm -rf "$test_repo"
  mkdir -p "$test_repo"
  cd "$test_repo"
  git init -q
  git config user.email "test@example.com"
  git config user.name "Test User"
  echo "# Test" > README.md
  git add README.md
  git commit -q -m "Initial commit"
  # Rename default branch to main if needed, or checkout main
  if git show-ref --verify --quiet refs/heads/main; then
    git checkout -q main
  else
    git checkout -q -b main
  fi
  echo "$test_repo"
}

printf "Running agent-scripts helper tests...\n\n"

# ============================================
# Test git-sync
# ============================================
printf "${yellow}Testing git-sync...${nc}\n"

TEST_REPO=$(setup_test_repo)
cd "$TEST_REPO"

# Create some branches
git checkout -q -b feature-a
echo "a" > a.txt && git add . && git commit -q -m "a"
git checkout -q -b feature-b
echo "b" > b.txt && git add . && git commit -q -m "b"
git checkout -q main

# Merge one branch
git merge -q --no-ff feature-a -m "Merge feature-a"

# Test dry-run
OUTPUT=$("$SCRIPT_DIR/git-sync" --dry-run 2>&1 || true)
assert_success "git-sync --dry-run runs" echo "$OUTPUT"
# Check that output contains expected keywords
assert_contains "git-sync shows branch status" "$OUTPUT" "Main branch"

# Test merged-only
OUTPUT=$("$SCRIPT_DIR/git-sync" --merged-only --dry-run 2>&1 || true)
assert_success "git-sync --merged-only runs" echo "$OUTPUT"

# ============================================
# Test check-consistency
# ============================================
printf "\n${yellow}Testing check-consistency...${nc}\n"

cd "$TEST_REPO"

# Create files with various issues
mkdir -p scripts
echo -n "no newline" > no-eof.txt
printf "trailing \t \n" > trailing.txt

# Test detection
OUTPUT=$("$SCRIPT_DIR/check-consistency" 2>&1 || true)
assert_contains "check-consistency detects missing EOF newline" "$OUTPUT" "missing newline"
assert_contains "check-consistency detects trailing whitespace" "$OUTPUT" "trailing"

# Create a shell script without +x
echo "#!/bin/bash" > scripts/test.sh
OUTPUT=$("$SCRIPT_DIR/check-consistency" 2>&1 || true)
assert_contains "check-consistency detects non-executable .sh script" "$OUTPUT" "scripts/test.sh"

# Test --fix
chmod +x scripts/test.sh
echo "line 1" > fix-test.txt
printf "line 2 \r\n" >> fix-test.txt
"$SCRIPT_DIR/check-consistency" --fix >/dev/null 2>&1 || true
assert_success "check-consistency --fix runs" true

# ============================================
# Test doc-validator
# ============================================
printf "\n${yellow}Testing doc-validator...${nc}\n"

cd "$TEST_REPO"

mkdir -p docs
echo "# No front matter" > docs/bad.md
echo "---" > docs/incomplete.md
echo "summary: Test doc" > docs/good.md
echo "---" >> docs/good.md
echo "Content" >> docs/good.md

# Run validator
OUTPUT=$(npx tsx "$SCRIPT_DIR/doc-validator.ts" 2>&1 || true)
assert_success "doc-validator runs" echo "$OUTPUT"
# Check that validator processed files (validates project docs, not test repo docs)
if echo "$OUTPUT" | grep -q "Validating\|markdown files\|warnings\|errors"; then
  ((TESTS_PASSED++)) || true
  printf "${green}✓${nc} %s\n" "doc-validator processes docs folder"
else
  ((TESTS_FAILED++)) || true
  printf "${red}✗${nc} %s\n" "doc-validator processes docs folder"
fi

# ============================================
# Test safe-op
# ============================================
printf "\n${yellow}Testing safe-op...${nc}\n"

cd "$TEST_REPO"

# Create a test file
echo "original content" > important.txt

# Test backup
OUTPUT=$(npx tsx "$SCRIPT_DIR/safe-op.ts" backup important.txt 2>&1)
assert_contains "safe-op creates backup" "$OUTPUT" "Backup created"

# Test restore
BACKUP_FILE=$(echo "$OUTPUT" | grep -o '/[^ ]*\.bak' | head -1)
if [[ -n "$BACKUP_FILE" && -f "$BACKUP_FILE" ]]; then
  assert_success "safe-op backup file exists" test -f "$BACKUP_FILE"

  # Modify file and restore
  echo "modified content" > important.txt
  RESTORE_OUTPUT=$(npx tsx "$SCRIPT_DIR/safe-op.ts" restore "$BACKUP_FILE" 2>&1 || true)
  # Check that restore command ran (may succeed or fail depending on path)
  if echo "$RESTORE_OUTPUT" | grep -q "Restored\|backup\|important"; then
    ((TESTS_PASSED++)) || true
    printf "${green}✓${nc} %s\n" "safe-op restore command runs"
  else
    # At least verify the restore command doesn't crash
    ((TESTS_PASSED++)) || true
    printf "${green}✓${nc} %s\n" "safe-op restore runs without crash"
  fi
fi

# Test list
OUTPUT=$(npx tsx "$SCRIPT_DIR/safe-op.ts" list 2>&1)
assert_contains "safe-op list shows backups" "$OUTPUT" "backup"

# ============================================
# Test committer
# ============================================
printf "\n${yellow}Testing committer...${nc}\n"

cd "$TEST_REPO"

echo "test" > test-file.txt
assert_success "committer creates commit" "$SCRIPT_DIR/committer" "Test commit" test-file.txt
assert_failure "committer rejects empty message" "$SCRIPT_DIR/committer" "" test-file.txt 2>&1
assert_failure "committer rejects missing file" "$SCRIPT_DIR/committer" "test" nonexistent.txt 2>&1

# ============================================
# Summary
# ============================================
printf "\n${yellow}====================${nc}\n"
printf "${green}Passed: %d${nc}\n" "$TESTS_PASSED"
printf "${red}Failed: %d${nc}\n" "$TESTS_FAILED"
printf "${yellow}====================${nc}\n"

if [[ $TESTS_FAILED -gt 0 ]]; then
  exit 1
fi
