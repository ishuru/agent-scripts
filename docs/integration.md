---
summary: Guide for integrating agent-scripts helpers into other repositories.
read_when:
  - Setting up a new repo with agent-scripts
  - Syncing helpers across multiple repositories
---

# Integration Guide

This guide covers integrating agent-scripts helpers into other repositories.

## Quick Setup

1. **Copy the helpers** you need to your repo's `scripts/` directory:
   ```bash
   cp ~/Projects/agent-scripts/scripts/committer ./scripts/
   cp ~/Projects/agent-scripts/scripts/check-consistency ./scripts/
   cp ~/Projects/agent-scripts/scripts/git-sync ./scripts/
   cp ~/Projects/agent-scripts/scripts/doc-validator.ts ./scripts/
   cp ~/Projects/agent-scripts/scripts/safe-op.ts ./scripts/
   ```

2. **Make shell scripts executable**:
   ```bash
   chmod +x scripts/committer scripts/check-consistency scripts/git-sync
   ```

3. **Update package.json** to add convenient scripts:
   ```json
   {
     "scripts": {
       "check": "./scripts/check-consistency",
       "check:fix": "./scripts/check-consistency --fix",
       "git:sync": "./scripts/git-sync",
       "docs:check": "npx tsx scripts/doc-validator.ts",
       "backup": "npx tsx scripts/safe-op.ts"
     }
   }
   ```

## Pre-Commit Hook

Install the pre-commit hook to run checks automatically:

```bash
ln -s ../../scripts/pre-commit.sh .git/hooks/pre-commit
```

Or add to `.git/config`:
```ini
[core]
  hooksPath = .githooks
```

Then copy the hook:
```bash
mkdir -p .githooks
cp scripts/pre-commit.sh .githooks/pre-commit
chmod +x .githooks/pre-commit
```

## CI Integration

### GitHub Actions

Add to `.github/workflows/checks.yml`:

```yaml
name: Checks

on: [push, pull_request]

jobs:
  consistency:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run consistency checks
        run: ./scripts/check-consistency --verbose

  docs:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Validate docs
        run: npx tsx scripts/doc-validator.ts
```

## Agent Instructions Integration

Add to your repo's `AGENTS.MD`:

```markdown
READ ~/Projects/agent-scripts/AGENTS.MD BEFORE ANYTHING (skip if missing).

## Repo-Specific Rules
- Your custom rules here...
```

## Helper Reference

### committer

Safe git commit helper that stages only listed files.

```bash
# Usage
./scripts/committer "feat: add new feature" file1.ts file2.ts

# With force (removes stale git locks)
./scripts/committer --force "fix: typo" README.md
```

### check-consistency

Enforces cross-platform code consistency.

```bash
# Check only
./scripts/check-consistency

# Auto-fix issues
./scripts/check-consistency --fix

# Verbose output
./scripts/check-consistency --verbose
```

### git-sync

Branch hygiene and PR awareness.

```bash
# Show what would be cleaned
./scripts/git-sync --dry-run

# Remove merged branches
./scripts/git-sync --prune

# Check for force-push issues
./scripts/git-sync --check-force-push
```

### doc-validator.ts

Validates documentation front-matter and links.

```bash
# Run validation
npx tsx scripts/doc-validator.ts

# Exit code 1 on errors, 0 on success
```

### safe-op.ts

Backup and restore utility for destructive operations.

```bash
# Create backup
npx tsx scripts/safe-op.ts backup src/config.ts

# Restore from backup
npx tsx scripts/safe-op.ts restore .context/backups/config.ts.2025-12-30T17-30-00.bak

# List backups
npx tsx scripts/safe-op.ts list

# Clean old backups (keep 5 most recent)
npx tsx scripts/safe-op.ts clean src/config.ts 5
```

## Sync Workflow

When updating agent-scripts in the canonical repo:

1. Pull latest changes in `~/Projects/agent-scripts`
2. Copy updated helpers to your target repos
3. Run tests: `./scripts/test-helpers.sh`
4. Commit changes with descriptive message

```bash
# Example sync script
for repo in project-a project-b project-c; do
  cd ~/Projects/$repo
  cp ~/Projects/agent-scripts/scripts/committer ./scripts/
  cp ~/Projects/agent-scripts/scripts/check-consistency ./scripts/
  # Add verification for each copied script
  git add scripts/
  git commit -m "chore: sync agent-scripts helpers"
done
```

## Troubleshooting

### Permission Denied

```bash
chmod +x scripts/committer scripts/check-consistency scripts/git-sync
```

### tsx Not Found

```bash
npm install -g tsx
# Or use npx without installing
npx tsx scripts/doc-validator.ts
```

### Pre-Commit Hook Not Running

```bash
# Check if hook is executable
ls -l .git/hooks/pre-commit

# Reinstall if needed
ln -sf ../../scripts/pre-commit.sh .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```
