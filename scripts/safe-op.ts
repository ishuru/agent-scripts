#!/usr/bin/env tsx

import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync, copyFileSync, statSync } from 'node:fs';
import { join, dirname, basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const scriptFile = fileURLToPath(import.meta.url);
const scriptDir = dirname(scriptFile);
const ROOT_DIR = join(scriptDir, '..');
const BACKUP_DIR = join(ROOT_DIR, '.context', 'backups');

interface BackupOptions {
  maxBackups?: number;
  comment?: string;
}

interface BackupRecord {
  timestamp: string;
  originalPath: string;
  backupPath: string;
  operation: 'backup' | 'rollback';
  comment?: string;
}

function ensureBackupDir() {
  if (!existsSync(BACKUP_DIR)) {
    mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

function getTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
}

function getBackupPath(originalPath: string): string {
  const timestamp = getTimestamp();
  const filename = basename(originalPath);
  return join(BACKUP_DIR, `${filename}.${timestamp}.bak`);
}

function recordOperation(record: BackupRecord) {
  const logPath = join(BACKUP_DIR, 'operations.jsonl');
  const line = JSON.stringify({ ...record, timestamp: new Date().toISOString() }) + '\n';
  const existing = existsSync(logPath) ? readFileSync(logPath, 'utf8') : '';
  writeFileSync(logPath, existing + line, { flag: 'a' });
}

function backupFile(filePath: string, options: BackupOptions = {}): string {
  const resolvedPath = resolve(filePath);
  const backupPath = getBackupPath(resolvedPath);

  if (!existsSync(resolvedPath)) {
    throw new Error(`File not found: ${resolvedPath}`);
  }

  ensureBackupDir();
  copyFileSync(resolvedPath, backupPath);

  recordOperation({
    timestamp: new Date().toISOString(),
    originalPath: resolvedPath,
    backupPath,
    operation: 'backup',
    comment: options.comment,
  });

  // Clean old backups if maxBackups set
  if (options.maxBackups) {
    cleanOldBackups(resolvedPath, options.maxBackups);
  }

  return backupPath;
}

function rollback(backupPath: string, targetPath?: string): string {
  if (!existsSync(backupPath)) {
    throw new Error(`Backup not found: ${backupPath}`);
  }

  const resolvedTarget = targetPath || resolve(backupPath)
    .replace(/\.context\/backups\/[^/]+\.(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})\.bak$/, '$1')
    .replace(/\.context\/backups\//, '')
    .replace(/\.\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.bak$/, '');

  copyFileSync(backupPath, resolvedTarget);

  recordOperation({
    timestamp: new Date().toISOString(),
    originalPath: resolvedTarget,
    backupPath,
    operation: 'rollback',
  });

  return resolvedTarget;
}

function cleanOldBackups(originalPath: string, keep: number) {
  const basename = originalPath.split('/').pop()!;
  const backupFiles = execSync(`ls -t "${BACKUP_DIR}/${basename}".*.bak 2>/dev/null || true`, {
    shell: true,
    encoding: 'utf-8',
  }).split('\n').filter(Boolean);

  if (backupFiles.length > keep) {
    const toDelete = backupFiles.slice(keep);
    toDelete.forEach(f => {
      execSync(`rm "${f}"`, { shell: true });
    });
  }
}

function listBackups(filePath?: string): BackupRecord[] {
  const logPath = join(BACKUP_DIR, 'operations.jsonl');
  if (!existsSync(logPath)) return [];

  const records: BackupRecord[] = readFileSync(logPath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(line => JSON.parse(line));

  if (filePath) {
    const resolved = resolve(filePath);
    return records.filter(r => r.originalPath === resolved || r.backupPath === resolved);
  }

  return records;
}

// CLI interface
function printUsage() {
  console.log(`
Usage: safe-op.ts <command> [options]

Commands:
  backup <file>           Create backup of file
  restore <backup>        Restore from backup
  list [file]             List backups (all or for specific file)
  clean <file> <keep>     Keep only N most recent backups

Options:
  --max-backups N         Maximum backups to keep (default: 10)
  --comment TEXT          Add comment to backup record

Examples:
  safe-op.ts backup src/main.ts
  safe-op.ts backup config.json --max-backups 5 --comment "Before refactor"
  safe-op.ts restore .context/backups/main.ts.2025-12-30T17-30-00.bak
  safe-op.ts list src/main.ts
  safe-op.ts clean src/main.ts 3
`);
}

function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === '-h' || command === '--help') {
    printUsage();
    process.exit(0);
  }

  try {
    switch (command) {
      case 'backup': {
        const file = args[1];
        if (!file) throw new Error('File path required');

        const maxBackupsIdx = args.indexOf('--max-backups');
        const maxBackups = maxBackupsIdx >= 0 ? parseInt(args[maxBackupsIdx + 1], 10) || 10 : 10;

        const commentIdx = args.indexOf('--comment');
        const comment = commentIdx >= 0 ? args[commentIdx + 1] : undefined;

        const backupPath = backupFile(file, { maxBackups, comment });
        console.log(`Backup created: ${backupPath}`);
        break;
      }

      case 'restore': {
        const backup = args[1];
        if (!backup) throw new Error('Backup path required');
        const target = args[2];
        const restored = rollback(backup, target);
        console.log(`Restored: ${restored}`);
        break;
      }

      case 'list': {
        const file = args[1];
        const records = listBackups(file);
        if (records.length === 0) {
          console.log('No backups found.');
        } else {
          records.forEach(r => {
            console.log(`${r.timestamp} - ${r.operation}: ${r.backupPath}`);
            if (r.comment) console.log(`  Comment: ${r.comment}`);
          });
        }
        break;
      }

      case 'clean': {
        const file = args[1];
        const keep = parseInt(args[2], 10) || 5;
        if (!file) throw new Error('File path required');
        cleanOldBackups(file, keep);
        console.log(`Cleaned backups for ${file}, keeping ${keep} most recent`);
        break;
      }

      default:
        throw new Error(`Unknown command: ${command}`);
    }
  } catch (err) {
    console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { backupFile, rollback, listBackups, cleanOldBackups };
