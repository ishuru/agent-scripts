---
summary: Web UI dashboard for agent-scripts helpers with live output and controls.
read_when:
  - Setting up the agent-scripts UI
  - Exploring the dashboard features
---

# Agent Scripts UI

A modern web dashboard for managing agent-scripts helpers with live output, status indicators, and quick actions.

## Features

- **Helper Dashboard**: Visual cards for all helpers with status indicators
- **Live Output**: Real-time command output with syntax highlighting
- **Quick Actions**: One-click actions for common tasks
- **Statistics**: Track passed checks, warnings, and errors
- **Settings**: Configure auto-fix, verbosity, and backup limits
- **Toast Notifications**: Get feedback on command results
- **Responsive Design**: Works on desktop and mobile

## Setup

### Option 1: Simple HTTP Server

```bash
cd ui
python3 -m http.server 8080
# Or with Node:
npx serve .
```

Then open http://localhost:8080

### Option 2: VS Code Live Server

1. Install "Live Server" extension
2. Right-click `index.html` → "Open with Live Server"

### Option 3: Integrate with Existing App

Add the UI files to your web root and serve them.

## Usage

### Running Helpers

1. Click "Run" on any helper card to execute
2. View live output in the Output panel
3. Status indicators show:
   - Gray: Not run yet
   - Blue: Currently running
   - Green: Passed
   - Yellow: Warning
   - Red: Error

### Quick Actions

| Action | Description |
|--------|-------------|
| Run All Checks | Execute all helpers in sequence |
| Sync Branches | Show git branch status |
| Create Backup | Create file backups (requires selection) |
| Setup Hooks | Install pre-commit hooks |

### Settings

- **Auto-fix**: Automatically fix issues when possible
- **Verbose output**: Show detailed command output
- **Max backups**: Maximum backups per file (default: 10)
- **Pre-commit checks**: Enable/disable automatic checks

## Customization

### Adding New Helpers

Edit `app.js` and add to the `helpers` array:

```javascript
{
  id: 'my-helper',
  name: 'My Helper',
  desc: 'Description of what it does',
  icon: 'check', // See icons object
  command: './scripts/my-helper',
  args: ['--flag', 'value']
}
```

### Custom Colors

Edit `styles.css` CSS variables:

```css
:root {
  --accent: #6366f1;      /* Primary accent color */
  --success: #22c55e;     /* Success/green */
  --warning: #f59e0b;     /* Warning/yellow */
  --error: #ef4444;       /* Error/red */
}
```

## Backend Integration

The UI is currently a frontend demo. For actual command execution, implement one of:

### Option A: Node.js Backend

```javascript
// server.js
import express from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const app = express();

app.post('/api/run/:id', async (req, res) => {
  const helper = helpers.find(h => h.id === req.params.id);
  const { stdout, stderr } = await execAsync(`${helper.command} ${helper.args.join(' ')}`);
  res.json({ output: stdout, error: stderr });
});

app.listen(3000);
```

### Option B: Python Backend

```python
# server.py
from flask import Flask, jsonify, request
import subprocess

app = Flask(__name__)

@app.route('/api/run/<id>', methods=['POST'])
def run_helper(id):
    helper = next(h for h in helpers if h['id'] == id)
    result = subprocess.run(
        [helper['command']] + helper['args'],
        capture_output=True,
        text=True
    )
    return jsonify({'output': result.stdout, 'error': result.stderr})
```

### Option C: Bun/Shell

```bash
# server.sh
#!/usr/bin/env bash
declare -r ROUTE="/api/run"

# Parse request and execute helper
# Return JSON response
```

Then update `app.js` `runHelper()` to fetch from your backend.

## Security Notes

- **Never run this UI on a public server** without authentication
- The UI executes shell commands - treat it as admin access
- Consider adding API keys/tokens for production use
- Sanitize all user inputs before command execution

## Development

```bash
# Watch for changes
npx serve --watch .

# Or with custom port
python3 -m http.server 9000
```

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

Uses native ES modules, no transpilation required.
