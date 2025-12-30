// Helper definitions
const helpers = [
  {
    id: 'check-consistency',
    name: 'Consistency Checker',
    desc: 'Validate line endings, permissions, whitespace',
    icon: 'check',
    command: './scripts/check-consistency',
    args: []
  },
  {
    id: 'git-sync',
    name: 'Git Sync',
    desc: 'Branch hygiene and PR status',
    icon: 'git',
    command: './scripts/git-sync',
    args: ['--dry-run']
  },
  {
    id: 'doc-validator',
    name: 'Doc Validator',
    desc: 'Validate documentation front-matter and links',
    icon: 'file-text',
    command: 'npx',
    args: ['tsx', 'scripts/doc-validator.ts']
  },
  {
    id: 'safe-op',
    name: 'Safe Op',
    desc: 'Backup and restore utility',
    icon: 'shield',
    command: 'npx',
    args: ['tsx', 'scripts/safe-op.ts', 'list']
  },
  {
    id: 'committer',
    name: 'Committer',
    desc: 'Safe git commit helper',
    icon: 'git-commit',
    command: './scripts/committer',
    args: []
  },
  {
    id: 'test-helpers',
    name: 'Test Suite',
    desc: 'Run helper tests',
    icon: 'test',
    command: './scripts/test-helpers.sh',
    args: []
  },
  {
    id: 'pre-commit',
    name: 'Pre-Commit',
    desc: 'Run pre-commit checks',
    icon: 'hook',
    command: './scripts/pre-commit.sh',
    args: []
  }
];

// State
const state = {
  running: new Set(),
  results: new Map(),
  settings: {
    autoFix: true,
    verboseOutput: false,
    maxBackups: 10,
    runPreCommit: true
  }
};

// DOM Elements
const elements = {
  helpersGrid: document.getElementById('helpersGrid'),
  outputContainer: document.getElementById('outputContainer'),
  outputContent: document.getElementById('outputContent'),
  outputEmpty: document.querySelector('.output-empty'),
  toastContainer: document.getElementById('toastContainer'),
  settingsModal: document.getElementById('settingsModal'),
  systemStatus: document.getElementById('systemStatus'),
  totalHelpers: document.getElementById('totalHelpers'),
  passedChecks: document.getElementById('passedChecks'),
  warnings: document.getElementById('warnings'),
  errors: document.getElementById('errors')
};

// Icons
const icons = {
  check: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
  git: '<circle cx="12" cy="12" r="3"/><line x1="3" y1="12" x2="9" y2="12"/><line x1="15" y1="12" x2="21" y2="12"/><path d="M12 3v18"/>',
  'file-text': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  'git-commit': '<circle cx="12" cy="12" r="3"/><line x1="12" y1="3" x2="12" y2="9"/><line x1="12" y1="15" x2="12" y2="21"/>',
  test: '<polygon points="5 3 19 12 5 21 5 3"/>',
  hook: '<path d="M19 21v-8a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v8"/><path d="M12 3v7"/><path d="M12 10a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2z"/>'
};

// Initialize
function init() {
  renderHelpers();
  attachEventListeners();
  updateStats();
}

// Render helper cards
function renderHelpers() {
  elements.helpersGrid.innerHTML = helpers.map(helper => `
    <div class="helper-card" data-id="${helper.id}">
      <div class="helper-header">
        <div class="helper-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            ${icons[helper.icon] || icons.check}
          </svg>
        </div>
        <div class="helper-status"></div>
      </div>
      <div class="helper-name">${helper.name}</div>
      <div class="helper-desc">${helper.desc}</div>
      <div class="helper-actions">
        <button class="btn-xs primary" data-action="run" data-id="${helper.id}">Run</button>
        <button class="btn-xs" data-action="info" data-id="${helper.id}">Info</button>
      </div>
    </div>
  `).join('');
}

// Attach event listeners
function attachEventListeners() {
  // Helper actions
  elements.helpersGrid.addEventListener('click', (e) => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    const id = e.target.closest('[data-action]')?.dataset.id;
    if (action && id) {
      handleHelperAction(action, id);
    }
  });

  // Quick actions
  document.querySelectorAll('.action-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      handleQuickAction(action);
    });
  });

  // Output controls
  document.getElementById('clearOutput')?.addEventListener('click', clearOutput);
  document.getElementById('copyOutput')?.addEventListener('click', copyOutput);
  document.getElementById('refreshHelpers')?.addEventListener('click', refreshAll);

  // Settings
  document.getElementById('closeSettings')?.addEventListener('click', () => {
    elements.settingsModal?.classList.remove('active');
  });

  // Settings checkboxes
  ['autoFix', 'verboseOutput', 'runPreCommit'].forEach(setting => {
    document.getElementById(setting)?.addEventListener('change', (e) => {
      state.settings[setting] = e.target.checked;
      saveSettings();
    });
  });

  document.getElementById('maxBackups')?.addEventListener('change', (e) => {
    state.settings.maxBackups = parseInt(e.target.value) || 10;
    saveSettings();
  });

  // Load settings
  loadSettings();
}

// Handle helper action
async function handleHelperAction(action, id) {
  const helper = helpers.find(h => h.id === id);
  if (!helper) return;

  switch (action) {
    case 'run':
      await runHelper(helper);
      break;
    case 'info':
      showHelperInfo(helper);
      break;
  }
}

// Run a helper
async function runHelper(helper) {
  if (state.running.has(helper.id)) return;

  const card = document.querySelector(`[data-id="${helper.id}"]`);
  card?.classList.add('running');
  state.running.add(helper.id);

  appendOutput(`\n$ ${helper.command} ${helper.args.join(' ')}\n`, 'info');

  try {
    // Simulate command execution (in real app, use fetch/IPC)
    await simulateCommand(helper);

    card?.classList.remove('running');
    card?.classList.add('status-ok');
    state.results.set(helper.id, 'ok');
    showToast(`${helper.name} completed`, 'success');
  } catch (error) {
    card?.classList.remove('running');
    card?.classList.add('status-error');
    state.results.set(helper.id, 'error');
    appendOutput(`Error: ${error.message}\n`, 'error');
    showToast(`${helper.name} failed`, 'error');
  }

  state.running.delete(helper.id);
  updateStats();
}

// Simulate command (placeholder for real implementation)
async function simulateCommand(helper) {
  return new Promise((resolve, reject) => {
    const outputs = {
      'check-consistency': ['Checking line endings...', 'Checking permissions...', 'No issues found ✓'],
      'git-sync': ['Main branch: main', 'Current branch: analyze', 'No branches to remove', 'No stale branches'],
      'doc-validator': ['Validating 11 markdown files...', 'All docs valid ✓'],
      'safe-op': ['Backups:', '  2025-12-30 - backup - .context/backups/config.ts.bak'],
      'test-helpers': ['Running agent-scripts helper tests...', '✓ check-consistency', '✓ git-sync', '✓ doc-validator', 'All tests passed!']
    };

    const lines = outputs[helper.id] || ['Running...', 'Done'];
    let i = 0;

    const interval = setInterval(() => {
      if (i < lines.length) {
        appendOutput(lines[i] + '\n');
        i++;
      } else {
        clearInterval(interval);
        resolve();
      }
    }, 300);
  });
}

// Show helper info
function showHelperInfo(helper) {
  appendOutput(`\n${helper.name}\n${'='.repeat(40)}\n`, 'info');
  appendOutput(`Description: ${helper.desc}\n`);
  appendOutput(`Command: ${helper.command}\n`);
  appendOutput(`Arguments: ${helper.args.join(' ') || '(none)'}\n`);
}

// Handle quick action
async function handleQuickAction(action) {
  switch (action) {
    case 'check-all':
      for (const helper of helpers) {
        if (helper.id !== 'safe-op') {
          await runHelper(helper);
          await new Promise(r => setTimeout(r, 500));
        }
      }
      break;
    case 'sync-git':
      await runHelper(helpers.find(h => h.id === 'git-sync'));
      break;
    case 'backup-all':
      showToast('Backup feature requires file selection', 'warning');
      break;
    case 'setup-hook':
      appendOutput('\nInstalling pre-commit hook...\nln -s ../../scripts/pre-commit.sh .git/hooks/pre-commit\n✓ Hook installed\n', 'success');
      showToast('Pre-commit hook installed', 'success');
      break;
  }
}

// Append output
function appendOutput(text, type = '') {
  elements.outputEmpty?.classList.add('hidden');
  elements.outputContent?.classList.add('has-content');

  const line = document.createElement('span');
  line.className = `output-line ${type}`;
  line.textContent = text;
  elements.outputContent?.appendChild(line);

  // Auto-scroll
  elements.outputContainer?.scrollTo({
    top: elements.outputContainer.scrollHeight,
    behavior: 'smooth'
  });
}

// Clear output
function clearOutput() {
  if (elements.outputContent) {
    elements.outputContent.innerHTML = '';
  }
  elements.outputEmpty?.classList.remove('hidden');
  elements.outputContent?.classList.remove('has-content');
}

// Copy output
async function copyOutput() {
  const text = elements.outputContent?.textContent || '';
  if (text) {
    await navigator.clipboard.writeText(text);
    showToast('Output copied to clipboard', 'success');
  }
}

// Refresh all
async function refreshAll() {
  showToast('Refreshing helper status...', 'info');
  await new Promise(r => setTimeout(r, 1000));
  showToast('All helpers up to date', 'success');
}

// Update stats
function updateStats() {
  elements.totalHelpers.textContent = helpers.length;

  let passed = 0, warnings = 0, errors = 0;

  state.results.forEach(status => {
    if (status === 'ok') passed++;
    if (status === 'warning') warnings++;
    if (status === 'error') errors++;
  });

  elements.passedChecks.textContent = passed;
  elements.warnings.textContent = warnings;
  elements.errors.textContent = errors;
}

// Show toast
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const iconSvg = {
    success: '<polyline points="20 6 9 17 4 12"/>',
    warning: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
    error: '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>',
    info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>'
  };

  toast.innerHTML = `
    <svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      ${iconSvg[type] || iconSvg.info}
    </svg>
    <span class="toast-message">${message}</span>
  `;

  elements.toastContainer?.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'slideIn 0.3s ease reverse';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Save settings
function saveSettings() {
  localStorage.setItem('agent-scripts-settings', JSON.stringify(state.settings));
}

// Load settings
function loadSettings() {
  const saved = localStorage.getItem('agent-scripts-settings');
  if (saved) {
    try {
      state.settings = { ...state.settings, ...JSON.parse(saved) };
      document.getElementById('autoFix').checked = state.settings.autoFix;
      document.getElementById('verboseOutput').checked = state.settings.verboseOutput;
      document.getElementById('runPreCommit').checked = state.settings.runPreCommit;
      document.getElementById('maxBackups').value = state.settings.maxBackups;
    } catch (e) {
      console.error('Failed to load settings', e);
    }
  }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', init);
