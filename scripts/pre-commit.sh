#!/usr/bin/env bash

set -euo pipefail

# Pre-commit hook for agent-scripts
# Install: ln -s ../../scripts/pre-commit.sh .git/hooks/pre-commit

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

HAS_ERRORS=0

# Colors
red='\033[0;31m'
yellow='\033[0;33m'
green='\033[0;32m'
nc='\033[0m'

printf "${green}Running pre-commit checks...${nc}\n"

# 1. Check consistency (line endings, permissions, whitespace)
if [[ -x "$SCRIPT_DIR/check-consistency" ]]; then
  printf "\n${yellow}→ Consistency checks${nc}\n"
  if ! "$SCRIPT_DIR/check-consistency"; then
    printf "${red}Consistency checks failed${nc}\n"
    HAS_ERRORS=1
  fi
else
  printf "${yellow}Skipping consistency (not executable)${nc}\n"
fi

# 2. Validate docs if any changed
DOCS_CHANGED=$(git diff --cached --name-only | grep -c '^docs/.*\.md$' || true)
if [[ "$DOCS_CHANGED" -gt 0 ]]; then
  printf "\n${yellow}→ Docs validation${nc}\n"
  if command -v npx >/dev/null 2>&1 && command -v tsx >/dev/null 2>&1; then
    if ! npx tsx "$SCRIPT_DIR/doc-validator.ts" 2>&1; then
      printf "${red}Docs validation failed${nc}\n"
      printf "${yellow}Run: npx tsx scripts/doc-validator.ts${nc}\n"
      HAS_ERRORS=1
    fi
  else
    printf "${yellow}Skipping docs (tsx not available)${nc}\n"
  fi
fi

# 3. Check for staged files without backup of critical files
CRITICAL_FILES=()
CRITICAL_PATTERNS=(
  "AGENTS.MD"
  "README.md"
  "scripts/committer"
  "scripts/git-sync"
)

for pattern in "${CRITICAL_PATTERNS[@]}"; do
  if git diff --cached --name-only | grep -qF "$pattern"; then
    CRITICAL_FILES+=("$pattern")
  fi
done

if [[ ${#CRITICAL_FILES[@]} -gt 0 ]]; then
  printf "\n${yellow}→ Staging critical files: ${CRITICAL_FILES[*]}${nc}\n"
  printf "${yellow}Consider running: npx tsx scripts/safe-op.ts backup <file> before committing${nc}\n"
fi

# 4. Check commit message format if using committer
# This is informational only since committer already validates
if [[ -n "${COMMIT_MSG:-}" ]] && ! [[ "$COMMIT_MSG" =~ ^(feat|fix|refactor|build|ci|chore|docs|style|perf|test)(\(.*\))?: ]]; then
  printf "\n${yellow}→ Commit message doesn't follow Conventional Commits${nc}\n"
  printf "${yellow}Consider: feat|fix|refactor|build|ci|chore|docs|style|perf|test: description${nc}\n"
fi

# Exit with error if any checks failed
if [[ $HAS_ERRORS -eq 1 ]]; then
  printf "\n${red}Pre-commit checks failed. Commit aborted.${nc}\n"
  printf "${yellow}Fix issues or use --no-verify to bypass (not recommended)${nc}\n"
  exit 1
fi

printf "\n${green}All pre-commit checks passed!${nc}\n"
