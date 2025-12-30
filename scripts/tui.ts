#!/usr/bin/env tsx

/**
 * Agent Scripts TUI Dashboard
 *
 * A terminal-based UI for managing agent-scripts helpers.
 *
 * Usage: npx tsx scripts/tui.ts
 *
 * Controls:
 *   - Arrow keys / j,k : Navigate
 *   - Enter : Run selected helper
 *   - q : Quit
 *   - r : Refresh
 *   - 1-7 : Quick select helper
 */

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');

// Helper definitions
const helpers = [
  { id: 'check', name: 'Consistency Checker', desc: 'Validate line endings, permissions', cmd: './scripts/check-consistency', args: [], key: '1' },
  { id: 'sync', name: 'Git Sync', desc: 'Branch hygiene and PR status', cmd: './scripts/git-sync', args: ['--dry-run'], key: '2' },
  { id: 'docs', name: 'Doc Validator', desc: 'Validate documentation', cmd: 'npx', args: ['tsx', 'scripts/doc-validator.ts'], key: '3' },
  { id: 'backup', name: 'Safe Op', desc: 'Backup and restore utility', cmd: 'npx', args: ['tsx', 'scripts/safe-op.ts', 'list'], key: '4' },
  { id: 'test', name: 'Test Suite', desc: 'Run helper tests', cmd: './scripts/test-helpers.sh', args: [], key: '5' },
  { id: 'hook', name: 'Pre-Commit', desc: 'Run pre-commit checks', cmd: './scripts/pre-commit.sh', args: [], key: '6' },
  { id: 'all', name: 'Run All Checks', desc: 'Execute all helpers', cmd: null, args: [], key: '7', special: true },
];

// ANSI colors
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  bg: { blue: '\x1b[44m', gray: '\x1b[47m', green: '\x1b[42m', red: '\x1b[41m' },
  fg: { black: '\x1b[30m', white: '\x1b[37m', cyan: '\x1b[36m', green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m', gray: '\x1b[90m' },
  clear: '\x1b[J',
  home: '\x1b[H',
};

interface State {
  selected: number;
  running: Set<number>;
  results: Map<number, 'ok' | 'error' | 'warning'>;
  output: string[];
}

const state: State = {
  selected: 0,
  running: new Set(),
  results: new Map(),
  output: [],
};

// Clear screen
function clearScreen(): void {
  process.stdout.write('\x1b[2J\x1b[H');
}

// Hide cursor
function hideCursor(): void {
  process.stdout.write('\x1b[?25l');
}

// Show cursor
function showCursor(): void {
  process.stdout.write('\x1b[?25h');
}

// Get terminal size
function getTerminalSize(): { width: number; height: number } {
  return {
    width: process.stdout.columns || 80,
    height: process.stdout.rows || 24,
  };
}

// Render header
function renderHeader(width: number): void {
  const title = `${c.bold}Agent Scripts Dashboard${c.reset}`;
  const subtitle = `${c.dim}Helper utilities - Use arrow keys to navigate, Enter to run, q to quit${c.reset}`;

  const line = `${c.bg.blue}${c.fg.black} ${' '.repeat(width - 2)} ${c.reset}`;
  const titleLine = `${c.bg.blue}${c.fg.black}  ${title}${' '.repeat(width - title.length - 4)}  ${c.reset}`;

  console.log(line);
  console.log(titleLine);
  console.log(`${c.bg.blue}${c.fg.black}  ${subtitle}${' '.repeat(width - subtitle.length - 4)}  ${c.reset}`);
  console.log(line);
}

// Render helper list
function renderHelpers(width: number, height: number): void {
  const listHeight = Math.min(helpers.length, height - 12);
  const startRow = 5;

  console.log(`\n${c.bold}  Helpers${c.reset}`);
  console.log(`  ${'─'.repeat(width - 4)}`);

  for (let i = 0; i < helpers.length; i++) {
    const helper = helpers[i];
    const isSelected = i === state.selected;
    const isRunning = state.running.has(i);
    const result = state.results.get(i);

    let prefix = '  ';
    let bg = '';
    let fg = '';
    let suffix = '';

    if (isSelected) {
      bg = c.bg.blue;
      fg = c.fg.white;
      prefix = '▶ ';
    } else {
      fg = c.reset;
    }

    if (isRunning) {
      suffix = `${c.fg.cyan}⟳ ${c.dim}Running...${c.reset}`;
    } else if (result === 'ok') {
      suffix = `${c.fg.green}✓${c.reset}`;
    } else if (result === 'error') {
      suffix = `${c.fg.red}✗${c.reset}`;
    } else if (result === 'warning') {
      suffix = `${c.fg.yellow}⚠${c.reset}`;
    }

    const keyBadge = helper.key ? `${c.dim}[${helper.key}]${c.reset} ` : '';
    const name = isSelected ? `${c.bold}${helper.name}${c.reset}` : helper.name;
    const desc = `${c.dim}${helper.desc}${c.reset}`;
    const padding = width - name.length - desc.length - prefix.length - keyBadge.length - suffix.length - 8;

    console.log(`${bg}${fg}${prefix}${keyBadge}${name}  ${desc}${' '.repeat(Math.max(0, padding))}${suffix}${c.reset}`);
  }
}

// Render output panel
function renderOutput(width: number, height: number): void {
  const outputLines = state.output.slice(-10);
  const outputHeight = Math.min(outputLines.length + 2, 12);

  console.log(`\n${c.bold}  Output${c.reset}`);
  console.log(`  ${'─'.repeat(width - 4)}`);

  if (outputLines.length === 0) {
    console.log(`  ${c.dim}Run a helper to see output...${c.reset}`);
  } else {
    for (const line of outputLines) {
      const trimmed = line.substring(0, width - 8);
      console.log(`  ${trimmed}`);
    }
  }
}

// Render status bar
function renderStatusBar(width: number): void {
  const ok = state.results.get(0) === 'ok' ? 1 : 0;
  const errors = state.results.get(0) === 'error' ? 1 : 0;

  const stats = [
    `${c.bold}Helpers:${c.reset} ${helpers.length}`,
    `${c.fg.green}Passed:${c.reset} ${ok}`,
    `${c.fg.red}Errors:${c.reset} ${errors}`,
    `${c.dim}Press q to quit, r to refresh${c.reset}`,
  ].join('  │  ');

  console.log(`\n${c.bg.gray}${c.fg.black}  ${stats}${' '.repeat(width - stats.length - 4)}  ${c.reset}`);
}

// Main render function
function render(): void {
  clearScreen();
  const { width, height } = getTerminalSize();

  renderHeader(width);
  renderHelpers(width, height);
  renderOutput(width, height);
  renderStatusBar(width);
}

// Run a helper command
function runHelper(index: number): void {
  const helper = helpers[index];
  if (!helper || helper.special || !helper.cmd) return;

  state.running.add(index);
  state.results.delete(index);
  render();

  const fullArgs = helper.cmd === 'npx' ? helper.args : [helper.cmd, ...helper.args];
  const cmd = helper.cmd === 'npx' ? 'npx' : helper.cmd;

  const proc = spawn(cmd, fullArgs, {
    cwd: ROOT_DIR,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  state.output.push(`\n$ ${cmd} ${fullArgs.join(' ')}`);

  proc.stdout.on('data', (data) => {
    const lines = data.toString().split('\n').filter(Boolean);
    state.output.push(...lines);
    render();
  });

  proc.stderr.on('data', (data) => {
    const lines = data.toString().split('\n').filter(Boolean);
    state.output.push(...lines.map(l => `${c.fg.red}${l}${c.reset}`));
    render();
  });

  proc.on('close', (code) => {
    state.running.delete(index);
    state.results.set(index, code === 0 ? 'ok' : 'error');
    state.output.push(code === 0 ? `${c.fg.green}✓ Exit code: ${code}${c.reset}` : `${c.fg.red}✗ Exit code: ${code}${c.reset}`);
    render();
  });
}

// Run all helpers
async function runAll(): Promise<void> {
  for (let i = 0; i < helpers.length; i++) {
    if (!helpers[i].special && helpers[i].cmd) {
      runHelper(i);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

// Handle keyboard input
function handleKey(key: string): void {
  switch (key) {
    case 'q':
    case '\x03': // Ctrl+C
      showCursor();
      console.log(`\n${c.dim}Goodbye!${c.reset}\n`);
      process.exit(0);
      break;

    case 'r':
      state.results.clear();
      state.running.clear();
      state.output = [];
      render();
      break;

    case 'j':
    case '\x1b[B': // Down arrow
      state.selected = (state.selected + 1) % helpers.length;
      render();
      break;

    case 'k':
    case '\x1b[A': // Up arrow
      state.selected = (state.selected - 1 + helpers.length) % helpers.length;
      render();
      break;

    case '\r': // Enter
    case '\x0d':
      if (helpers[state.selected].special) {
        runAll();
      } else {
        runHelper(state.selected);
      }
      break;

    default:
      // Number keys for quick selection
      if (key >= '1' && key <= '7') {
        const index = parseInt(key) - 1;
        if (index < helpers.length) {
          state.selected = index;
          render();
          if (helpers[index].special) {
            runAll();
          } else {
            runHelper(index);
          }
        }
      }
  }
}

// Setup terminal
function setup(): void {
  // Set raw mode
  process.stdin.setRawMode(true);

  // Hide cursor
  hideCursor();

  // Handle input
  process.stdin.on('data', (data) => {
    const str = data.toString();
    handleKey(str);
  });

  // Handle resize
  process.stdout.on('resize', render);

  // Handle exit
  process.on('exit', showCursor);
  process.on('SIGINT', () => {
    showCursor();
    process.exit(0);
  });
}

// Main
function main(): void {
  clearScreen();
  setup();
  render();
}

// Start
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
