.PHONY: help check check:fix docs:test git:sync test setup-hook install-hook clean-backups

# Default target
help:
	@echo "agent-scripts - Shared helper utilities"
	@echo ""
	@echo "Targets:"
	@echo "  make check          - Run consistency checks"
	@echo "  make check:fix      - Auto-fix consistency issues"
	@echo "  make docs:test      - Validate documentation"
	@echo "  make git:sync       - Show branch status (dry-run)"
	@echo "  make git:prune      - Remove merged/stale branches"
	@echo "  make test           - Run helper test suite"
	@echo "  make setup-hook     - Install pre-commit hook"
	@echo "  make clean-backups  - Remove old backups (keep 5)"
	@echo ""
	@echo "See docs/integration.md for detailed usage."

# Consistency checks
check:
	@./scripts/check-consistency

check:fix:
	@./scripts/check-consistency --fix

# Documentation validation
docs:test:
	@npx tsx scripts/doc-validator.ts

# Git workflow helpers
git:sync:
	@./scripts/git-sync --dry-run

git:prune:
	@./scripts/git-sync --prune

git:status:
	@./scripts/git-sync --check-force-push

# Run tests
test:
	@./scripts/test-helpers.sh

# Pre-commit hook
setup-hook:
	@echo "Installing pre-commit hook..."
	@mkdir -p .git/hooks
	@ln -sf ../../scripts/pre-commit.sh .git/hooks/pre-commit
	@chmod +x .git/hooks/pre-commit
	@echo "Pre-commit hook installed to .git/hooks/pre-commit"

install-hook: setup-hook

# Backup management
BACKUP_DIR ?= .context/backups
KEEP ?= 5

clean-backups:
	@echo "Cleaning backups (keeping $(KEEP) most recent per file)..."
	@if [ -d "$(BACKUP_DIR)" ]; then \
		find "$(BACKUP_DIR)" -name '*.bak' -type f | \
		awk -F/ '{print $$NF}' | \
		sed 's/\.[0-9].*//' | \
		sort -u | \
		while read base; do \
			ls -t "$(BACKUP_DIR)/$${base}"*.bak 2>/dev/null | \
			tail -n +$(KEEP) | \
			xargs rm -f 2>/dev/null || true; \
		done; \
		echo "Done."; \
	else \
		echo "No backups found."; \
	fi

# Show backup info
backups:
	@npx tsx scripts/safe-op.ts list

# Sync helpers to another repo
# Usage: make sync-to REPO=~/Projects/target-repo
sync-to:
	@if [ -z "$(REPO)" ]; then \
		echo "Usage: make sync-to REPO=~/Projects/target-repo"; \
		exit 1; \
	fi
	@echo "Syncing helpers to $(REPO)..."
	@mkdir -p $(REPO)/scripts
	@cp scripts/committer $(REPO)/scripts/ 2>/dev/null || true
	@cp scripts/check-consistency $(REPO)/scripts/ 2>/dev/null || true
	@cp scripts/git-sync $(REPO)/scripts/ 2>/dev/null || true
	@cp scripts/doc-validator.ts $(REPO)/scripts/ 2>/dev/null || true
	@cp scripts/safe-op.ts $(REPO)/scripts/ 2>/dev/null || true
	@cp scripts/test-helpers.sh $(REPO)/scripts/ 2>/dev/null || true
	@cp scripts/pre-commit.sh $(REPO)/scripts/ 2>/dev/null || true
	@chmod +x $(REPO)/scripts/*.sh $(REPO)/scripts/committer $(REPO)/scripts/check-consistency $(REPO)/scripts/git-sync 2>/dev/null || true
	@echo "Synced to $(REPO)/scripts/"
	@cd $(REPO) && git status scripts/
