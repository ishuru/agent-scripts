---
summary: Quick start guide for setting up agent-scripts in a new repository.
read_when:
  - First time setting up agent-scripts
  - Onboarding a new repository
---

# Quick Start

Get started with agent-scripts helpers in your repository in 5 minutes.

## 1. Copy Helpers

Copy the helpers you need to your `scripts/` directory:

```bash
# Core helpers (recommended for all repos)
cp ~/Projects/agent-scripts/scripts/committer ./scripts/
cp ~/Projects/agent-scripts/scripts/check-consistency ./scripts/
cp ~/Projects/agent-scripts/scripts/git-sync ./scripts/

# TypeScript helpers (if using TS/docs)
cp ~/Projects/agent-scripts/scripts/doc-validator.ts ./scripts/
cp ~/Projects/agent-scripts/scripts/safe-op.ts ./scripts/

# Testing and hooks (optional but recommended)
cp ~/Projects/agent-scripts/scripts/test-helpers.sh ./scripts/
cp ~/Projects/agent-scripts/scripts/pre-commit.sh ./scripts/
```

## 2. Make Executable

```bash
chmod +x scripts/committer
chmod +x scripts/check-consistency
chmod +x scripts/git-sync
chmod +x scripts/test-helpers.sh
chmod +x scripts/pre-commit.sh
```

## 3. Install Pre-Commit Hook (Optional)

```bash
ln -s ../../scripts/pre-commit.sh .git/hooks/pre-commit
# OR use the make target if you copied the Makefile
make setup-hook
```

## 4. Add to package.json (Optional)

```json
{
  "scripts": {
    "check": "./scripts/check-consistency",
    "git:sync": "./scripts/git-sync",
    "test:helpers": "./scripts/test-helpers.sh"
  }
}
```

## 5. Test It Works

```bash
# Run consistency checks
./scripts/check-consistency

# Check branch status
./scripts/git-sync --dry-run

# Test helpers
./scripts/test-helpers.sh
```

## 6. Commit

```bash
# Use the committer helper
./scripts/committer "chore: add agent-scripts helpers" \
  scripts/committer \
  scripts/check-consistency \
  scripts/git-sync \
  scripts/doc-validator.ts \
  scripts/safe-op.ts \
  scripts/test-helpers.sh \
  scripts/pre-commit.sh
```

## What's Included

| Helper | Purpose | Required |
|--------|---------|----------|
| `committer` | Safe git commits | Yes |
| `check-consistency` | Code quality checks | Yes |
| `git-sync` | Branch management | Yes |
| `doc-validator.ts` | Docs validation | TS/Docs repos |
| `safe-op.ts` | Backup/restore | Optional |
| `test-helpers.sh` | Test suite | Optional |
| `pre-commit.sh` | Git hook | Optional |

## Next Steps

- See `docs/integration.md` for detailed setup
- See `docs/package-scripts.md` for npm script examples
- See `README.md` for full helper documentation

## Troubleshooting

**Permission denied:**
```bash
chmod +x scripts/*.sh scripts/committer scripts/check-consistency scripts/git-sync
```

**tsx not found:**
```bash
npm install -g tsx
# Or use npx without installing
npx tsx scripts/doc-validator.ts
```

**Pre-commit hook not running:**
```bash
# Reinstall
ln -sf ../../scripts/pre-commit.sh .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```
