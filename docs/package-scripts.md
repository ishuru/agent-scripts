---
summary: Recommended package.json scripts for agent-scripts integration.
read_when:
  - Setting up a new repository with agent-scripts
  - Adding npm scripts for helper utilities
---

# Package.json Scripts

Add these scripts to your `package.json` for convenient access to agent-scripts helpers.

## Full Reference

```json
{
  "scripts": {
    "check": "./scripts/check-consistency",
    "check:fix": "./scripts/check-consistency --fix",
    "check:verbose": "./scripts/check-consistency --verbose",

    "docs": "npx tsx scripts/docs-list.ts",
    "docs:check": "npx tsx scripts/doc-validator.ts",
    "docs:list": "npx tsx scripts/docs-list.ts",

    "git:sync": "./scripts/git-sync --dry-run",
    "git:prune": "./scripts/git-sync --prune",
    "git:status": "./scripts/git-sync --check-force-push",

    "backup": "npx tsx scripts/safe-op.ts",
    "backup:list": "npx tsx scripts/safe-op.ts list",
    "backup:clean": "npx tsx scripts/safe-op.ts clean",

    "test:helpers": "./scripts/test-helpers.sh",

    "precommit": "./scripts/pre-commit.sh",
    "setup:hooks": "ln -sf ../../scripts/pre-commit.sh .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit"
  }
}
```

## Script Categories

### Consistency Checks

```bash
# Run checks (fails on issues)
npm run check

# Auto-fix issues
npm run check:fix

# Show all checks including passes
npm run check:verbose
```

### Documentation

```bash
# List all docs with summaries
npm run docs

# Validate docs (fails on errors)
npm run docs:check

# Alias for docs list
npm run docs:list
```

### Git Workflow

```bash
# Show branch status (dry-run)
npm run git:sync

# Remove merged/stale branches
npm run git:prune

# Check for force-push issues
npm run git:status
```

### Backup Operations

```bash
# List all backups
npm run backup:list

# Clean old backups (interactive)
npm run backup:clean

# Create backup (use safe-op directly)
npx tsx scripts/safe-op.ts backup path/to/file
```

### Testing & Setup

```bash
# Run helper test suite
npm run test:helpers

# Run pre-commit checks manually
npm run precommit

# Install pre-commit hook
npm run setup:hooks
```

## Minimal Set

For a minimal setup, include just these essentials:

```json
{
  "scripts": {
    "check": "./scripts/check-consistency",
    "docs": "npx tsx scripts/docs-list.ts",
    "git:sync": "./scripts/git-sync",
    "test": "./scripts/test-helpers.sh"
  }
}
```

## CI Integration

For CI pipelines, use these directly in your workflow:

```yaml
- name: Consistency checks
  run: npm run check

- name: Validate docs
  run: npm run docs:check

- name: Test helpers
  run: npm run test
```

## Husky Integration

If using Husky for git hooks:

```json
{
  "scripts": {
    "prepare": "husky install",
    "pre-commit": "npm run check && npm run docs:check"
  },
  "devDependencies": {
    "husky": "^8.0.0"
  }
}
```

Then run:
```bash
npm install
npx husky add .husky/pre-commit "npm run pre-commit"
```
