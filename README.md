# ccptracker 🤖📊

> [한국어 문서](README_KR.md) | English Documentation

**Claude Code conversation tracker and satisfaction logger**

ccptracker allows you to automatically record all conversations with Claude Code and evaluate satisfaction ratings. Conversation data is saved in CSV format for later analysis and utilization.

## ✨ Key Features

- 🔄 **Automatic Conversation Recording**: All conversations with Claude Code are automatically saved to CSV
- ⭐ **Satisfaction Rating**: Rate each response from 1-5 stars
- 📊 **Statistics Dashboard**: Check total conversations, average ratings, and more
- 📁 **Data Export**: Export data in CSV or JSON format
- 🚀 **One-Click Installation**: Simple installation with `npx ccptracker init`
- 🔧 **Automatic Configuration**: `.claude/settings.json` hooks are automatically registered
- 📝 **Git-Friendly**: Conversation data is tracked by Git by default for team sharing

## 🚀 Quick Start

### 1. Installation

Run the following command in your Claude Code project directory:

```bash
# Basic installation (CSV file tracked by Git)
npx ccptracker init

# Hide CSV file in gitignore as well
npx ccptracker init --githide
```

### 2. Usage

Now use Claude Code as usual and all conversations will be automatically recorded!

You can rate satisfaction by entering a number 1-5 after each Claude response:

```
1 ⭐ Very Poor
2 ⭐⭐ Poor
3 ⭐⭐⭐ Average
4 ⭐⭐⭐⭐ Good
5 ⭐⭐⭐⭐⭐ Excellent
```

### 3. Check Status

```bash
npx ccptracker status
```

Example output:
```
📊 ccptracker Status
✅ Installed and configured
📝 Total conversations: 25
⭐ Average satisfaction: 4.2/5 ⭐⭐⭐⭐
🕒 Last conversation: 2025-01-03 13:45:32
📁 Data location: ./ccptracker/data/ccptracker.csv
```

## 📖 Usage

### Installation Commands

```bash
# Install ccptracker in new project (CSV file tracked by Git)
npx ccptracker init

# Force reinstallation
npx ccptracker init --force

# Hide CSV file in gitignore as well
npx ccptracker init --githide

# Force installation + hide CSV
npx ccptracker init --force --githide
```

### Check Status

```bash
# Check current status and statistics
npx ccptracker status
```

### Data Export

```bash
# Export as CSV (default)
npx ccptracker export

# Export as JSON
npx ccptracker export --format json

# Export to specific file
npx ccptracker export --output my-conversations.csv
```

### Removal

```bash
# Remove ccptracker completely (with confirmation)
npx ccptracker remove

# Force removal (without confirmation)
npx ccptracker remove --force
```

## 📁 File Structure

Installing ccptracker creates the following structure:

```
your-project/
├── .claude/
│   └── settings.json        # Claude Code hook configuration (auto-registered)
├── .gitignore               # ccptracker/ automatically added
└── ccptracker/
    ├── hooks/               # Hook scripts
    │   ├── user-prompt-submit
    │   ├── stop
    │   ├── csv-updater.py
    │   └── stop-parse-transcript.py
    ├── data/
    │   └── ccptracker.csv   # Conversation data (tracked by Git by default)
    ├── logs/                # Debug logs
    └── temp/                # Temporary files
```

## 📊 Data Format

### CSV Fields

| Field | Description | Example |
|-------|-------------|---------|
| `id` | Conversation ID (YYYYMMDDHHmmss) | `20250103134532` |
| `request` | User prompt | `"Create a React component"` |
| `response` | Claude response | `"I'll create a React component for you..."` |
| `star` | Satisfaction rating (1-5) | `4` |
| `star_desc` | Rating comment | `""` |
| `request_dtm` | Request time | `2025-01-03 13:45:32` |
| `response_dtm` | Response time | `2025-01-03 13:45:45` |
| `star_dtm` | Rating time | `2025-01-03 13:46:00` |

### JSON Format (export)

```json
{
  "exportedAt": "2025-01-03T13:50:00.000Z",
  "totalConversations": 25,
  "conversations": [
    {
      "id": "20250103134532",
      "request": "Create a React component",
      "response": "I'll create a React component for you...",
      "rating": 4,
      "ratingComment": null,
      "requestTime": "2025-01-03 13:45:32",
      "responseTime": "2025-01-03 13:45:45",
      "ratingTime": "2025-01-03 13:46:00"
    }
  ]
}
```

## 🔧 Advanced Configuration

### Manual Hook Registration

While ccptracker automatically modifies `.claude/settings.json`, if you want to manage it manually:

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "./ccptracker/hooks/user-prompt-submit"
          }
        ]
      }
    ],
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "./ccptracker/hooks/stop"
          }
        ]
      }
    ]
  }
}
```

### Log Inspection

When issues occur, you can check debug logs:

```bash
# User prompt hook logs
cat ccptracker/logs/user-prompt-submit-debug.log

# Response processing hook logs
cat ccptracker/logs/stop-hook-debug.log
```

## 🤝 Programming Interface

You can also use ccptracker directly in Node.js projects:

```javascript
const ccptracker = require('ccptracker');

// Install
const result = await ccptracker.install('/path/to/project');

// Check status
const status = await ccptracker.status('/path/to/project');

// Export data
const exported = await ccptracker.export('/path/to/project', {
  format: 'json',
  output: 'conversations.json'
});

// Remove
await ccptracker.remove('/path/to/project');
```

## ❓ FAQ

### Q: Can I use this in non-Claude Code projects?
A: No. ccptracker uses Claude Code's hook system, so it only works in Claude Code projects.

### Q: What happens to existing conversation data?
A: ccptracker preserves existing data. The `ccptracker/` directory is only deleted when removing.

### Q: Can I skip satisfaction rating?
A: Yes, enter anything other than numbers 1-5 to skip rating and continue to the next conversation.

### Q: Can I use ccptracker in multiple projects?
A: Yes, you can install and use it independently in each project.

### Q: Does it work on Windows?
A: Yes, it works on Windows, macOS, and Linux as long as Node.js and Python are installed.

### Q: How to prevent CSV file from being added to Git?
A: Use the `--githide` option: `npx ccptracker init --githide`. This will add the CSV file to gitignore as well.

### Q: I want to share conversation data with team members
A: Use the default installation (`npx ccptracker init`) - the CSV file will be tracked by Git and can be shared with team members.

## 🐛 Troubleshooting

### Installation Issues
1. Make sure you're in a Claude Code project directory (`.claude/` folder exists)
2. Verify Node.js 14+ is installed
3. Verify Python 3.x is installed

### Conversations Not Being Recorded
1. Check installation status with `npx ccptracker status`
2. Verify hooks are properly registered in `.claude/settings.json`
3. Check log files in `ccptracker/logs/` directory

### Satisfaction Rating Not Working
1. Make sure you're only entering numbers 1-5
2. Verify there's a previous conversation (can't rate the first conversation)

## 📄 License

MIT License

## 🤝 Contributing

1. Fork this repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📞 Support

- Issues: [GitHub Issues](https://github.com/phj1120/ccptracker/issues)
- Documentation: [README.md](https://github.com/claude-code/ccptracker/blob/main/README.md)

---

**Enjoy your Claude Code experience with ccptracker! 🤖✨**